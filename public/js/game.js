// Client-side Game Logic
import InputManager from './input.js';
import { TILE_SIZE, OFFSET, ITEM_TYPES, BOMB_TIMER } from './constants.js';
import { updatePlayerAnimation, updateElementAnimation } from './animate.js';
import { ServerToClientMessageType, decodeServerMessage } from '../gamelogic/serverToClient.js';
import { ClientToServerMessageType } from '../gamelogic/clientToServer.js';
import { createTile, createExplosionVisuals } from './visual-effects.js';
import { logger } from './logger.js';
import { playSound } from './sound-effects.js';
import { distanceToVolume } from './sound-utils.js';
import ClientPrediction from './client-prediction.js';

// Pause management
let isPaused = false;
let pauseOwnerId = null;

function pauseToggle() {
  if (isPaused) {
    if (mySocket && mySocket.id === pauseOwnerId) {
      mySocket.emit('requestUnpause', { roomId: myRoomId });
    }
    return;
  }

  if (mySocket) {
    mySocket.emit('requestPause', { roomId: myRoomId });
  }
}

const gameContainer = document.getElementById('game-container');
const inputManager = new InputManager({ onPause: pauseToggle });

// UI Elements
const uiTimer = document.getElementById('game-timer');
const uiVictory = document.getElementById('victory-message');
const uiVictoryText = document.getElementById('victory-text');
const btnReset = document.getElementById('reset-btn');
const pauseOverlay = document.getElementById('pause-overlay');
const btnQuit = document.getElementById('quit-btn');
btnQuit.onclick = () => {
  // Return to lobby by reloading the page
  location.reload();
};

// Player Stats UI
const uiPlayerStats = document.getElementById('player-stats');
const uiStatRange = document.getElementById('stat-range-value');
const uiStatSpeed = document.getElementById('stat-speed-value');
const uiStatBombs = document.getElementById('stat-bombs-value');

let lastTime = 0;
let mySocket = null;
let myRoomId = null;
let myPlayerId = null; // 0-3

// Client-side state for animation (prevX, prevY, animation counters)
// Key: playerId, Value: { prevX, prevY, x, y, el, animation: { currentDir, currentFrame, animTime } }
let clientPlayers = {};
let activeBombs = [];
let mapLayout = [];
let isGameOver = false;
let gameStartTime = 0;
let gamePausedDuration = 0;

let clientPrediction = null;

let roster = [];

let isMapInitialized = false;

// Local stats tracking for immediate UI updates
let localPlayerStats = null; // { speed, bombRange, maxBombs }

export function initGame(socket, roomId, playerId, initialRoster, initialState) {
  mySocket = socket;
  myRoomId = roomId;
  roster = initialRoster;
  isMapInitialized = false; // Reset map flag
  clientPrediction = new ClientPrediction();

  // Map socket ID to numeric player ID (0-3)
  // Roster order matches player ID order (0, 1, 2, 3)
  const myIndex = roster.findIndex((p) => p.id === mySocket.id);
  if (myIndex !== -1) {
    myPlayerId = myIndex; // 0, 1, 2, or 3
    console.log('My Player ID:', myPlayerId);
  } else {
    console.error('Could not find my ID in roster!');
  }

  // Initialize local stats for online play updates from server state
  localPlayerStats = { speed: 250, bombRange: 2, maxBombs: 1 };

  // Attempt to load from initial state if available to be accurate
  if (initialState && initialState.players && initialState.players[myPlayerId]) {
    const pState = initialState.players[myPlayerId];
    if (pState.stats) {
      localPlayerStats.speed = pState.stats.speed;
      localPlayerStats.bombRange = pState.stats.bombRange;
      localPlayerStats.maxBombs = pState.stats.maxBombs;
    }
  }

  // Synchronize UI immediate
  uiStatSpeed.innerText = localPlayerStats.speed;
  uiStatRange.innerText = localPlayerStats.bombRange;
  uiStatBombs.innerText = localPlayerStats.maxBombs;

  // Unhide stats for online play
  uiPlayerStats.hidden = false;

  setupSocketListeners();

  if (initialState) {
    processState(initialState);
  }

  // Start loop
  requestAnimationFrame(gameLoop);
}

function setupSocketListeners() {
  mySocket.on('state', (state) => {
    processState(state);
  });

  // Option 1: Hybrid Protocol Handler for Items (Robust)
  mySocket.on('spawnItem', (data) => {
    logger.debug(
      `[ITEM DEBUG] Hybrid SPAWN: typeIdx=${data.typeIndex}, at (${data.col},${data.row})`
    );
    createItemVisual(data.col, data.row, data.typeIndex);
  });

  mySocket.on('G', (buffer) => {
    const msg = decodeServerMessage(new Uint8Array(buffer));
    handleServerMessage(msg);
  });

  mySocket.on('gameCancelled', () => {
    alert('Game cancelled!');
    location.reload();
  });

  mySocket.on('pauseGranted', ({ pausedBy }) => {
    const name = roster.find((p) => p.id === pausedBy)?.name || pausedBy;
    const pauseText = pauseOverlay.querySelector('.pause-text');
    const isMe = mySocket && mySocket.id === pausedBy;
    const msg = isMe ? 'You paused - press Esc to resume' : `Player ${name} paused`;
    if (pauseText) {
      pauseText.textContent = msg;
    }
    isPaused = true;
    pauseOwnerId = pausedBy;
    pauseOverlay.hidden = false;
    inputManager.reset(); // clear any stuck keys
  });

  mySocket.on('unpauseGranted', () => {
    isPaused = false;
    pauseOwnerId = null;
    pauseOverlay.hidden = true;
  });
}

function processState(state) {
  // Initial state
  mapLayout = state.mapLayout;

  // Detect new game start
  if (state.gameStartTime !== gameStartTime) {
    isGameOver = false;
    uiVictory.style.display = 'none';
    isMapInitialized = false;
    gameStartTime = state.gameStartTime;
    gamePausedDuration = 0;

    // Reset input state to prevent stuck movement keys
    inputManager.reset();

    // Clear bombs
    activeBombs.forEach((b) => {
      if (b.el && b.el.parentNode) b.el.parentNode.removeChild(b.el);
    });
    activeBombs = [];
    // Also clear dead status from DOM elements if needed,
    // but renderPlayers will handle new positions.
    // We should remove 'dead' class from existing elements or just let initMap/renderPlayers handle it.
    // Since we reset isMapInitialized, initMap will clear container.
  }
  gameStartTime = state.gameStartTime;

  // Check for Game Over transition
  if (!isGameOver && state.isGameOver) {
    isGameOver = true;
    setTimeout(() => {
      showVictoryScreen(state.players);
    }, 2000); // 2 second delay for death animation
  }
  isGameOver = state.isGameOver;

  // Initialize client players
  updatePlayersFromState(state.players);

  // Render map only if not initialized
  if (!isMapInitialized) {
    initMap();
    isMapInitialized = true;
  }

  // Render items
  if (state.activeItems) {
    // Clear existing items first to avoid duplicates if full sync?
    // Or just reconcile. For now, simple clear and add if we assume full sync.
    document.querySelectorAll('.item').forEach((el) => el.remove());
    state.activeItems.forEach((item) => {
      const typeIdx = ITEM_TYPES.findIndex((t) => t.type === item.type);
      if (typeIdx !== -1) {
        createItemVisual(item.col, item.row, typeIdx);
      }
    });
  }

  // Render initial players
  renderPlayers();

  // Start timer
  updateTimer();
}

function showVictoryScreen(players) {
  const alive = Object.values(players).filter((p) => !p.isDead);
  let text = 'DRAW!';
  let color = 'white';

  if (alive.length === 1) {
    const winnerId = alive[0].id;
    // Find name from roster
    // Roster uses socket ID, but we don't have the mapping here easily
    // However, roster order matches player ID order (0, 1, 2, 3)
    // Let's assume roster[winnerId] is correct based on initGame logic

    // Actually, roster is an array. roster[0] is player 0.
    const winnerName = roster[winnerId]
      ? roster[winnerId].name
      : `Player ${parseInt(winnerId) + 1}`;
    text = `${winnerName} WINS!`;
    color = alive[0].color;
  }

  uiVictoryText.innerText = text;
  uiVictoryText.style.color = color;
  uiVictory.style.display = 'block';

  // Show reset button only if master (we need to know if we are master)
  // We can check if myPlayerId is 0 (usually master) or pass isMaster flag to initGame
  // For now, let's just show it. The server validates anyway.
  btnReset.style.display = 'inline-block';

  // Remove old listeners to avoid duplicates? Or just use onclick
  btnReset.onclick = () => {
    mySocket.emit('restartGame', { roomId: myRoomId });
  };
}

function handleServerMessage(msg) {
  const pId = msg.playerId; // 0-3
  const player = clientPlayers[pId];
  if (!player) return;

  // Only process position updates for movement-related messages (Types 0-4)
  if (msg.type <= 4) {
    const isLocal = myPlayerId !== null && pId === myPlayerId;
    clientPrediction.handleServerPosition(player, msg, isLocal, mapLayout, activeBombs);
  }

  // Actions
  if (msg.type === ServerToClientMessageType.PLACE_BOMB_AT) {
    createBombVisual(msg.col, msg.row);
  }

  if (msg.type === ServerToClientMessageType.PICKUP_ITEM) {
    removeItemVisual(msg.col, msg.row);

    // Update stats if it is ME who picked it up
    if (myPlayerId !== null && pId === myPlayerId) {
      const itemTypeIndex = Math.round(msg.x - msg.col * TILE_SIZE);
      const itemType = ITEM_TYPES[itemTypeIndex];

      logger.debug(
        `[ITEM DEBUG] Client received pickup: typeIndex=${itemTypeIndex}, type=${itemType ? itemType.type : 'UNKNOWN'}`
      );

      // Ensure local stats tracker is initialized
      if (!localPlayerStats) {
        localPlayerStats = { speed: 250, bombRange: 2, maxBombs: 1 };
      }

      if (itemType) {
        if (itemType.type === 'speed') {
          localPlayerStats.speed = Math.min(600, localPlayerStats.speed + 25);
          uiStatSpeed.innerText = localPlayerStats.speed;
        }
        if (itemType.type === 'range') {
          localPlayerStats.bombRange++;
          uiStatRange.innerText = localPlayerStats.bombRange;
        }
        if (itemType.type === 'bomb') {
          localPlayerStats.maxBombs++;
          uiStatBombs.innerText = localPlayerStats.maxBombs;
        }
      }
    }
  }
  if (msg.type === ServerToClientMessageType.EXPLODE_AT) {
    // Range is encoded in the x field (msg.x = col * TILE_SIZE + range)
    // So range = msg.x - col * TILE_SIZE
    // We use Math.round to be safe against floating point errors
    const range = Math.round(msg.x - msg.col * TILE_SIZE);

    // Remove bomb at this location
    const bombIdx = activeBombs.findIndex((b) => b.col === msg.col && b.row === msg.row);
    if (bombIdx !== -1) {
      const bomb = activeBombs[bombIdx];
      if (bomb.el && bomb.el.parentNode) bomb.el.parentNode.removeChild(bomb.el);
      activeBombs.splice(bombIdx, 1);
      const dist = distanceFromPlayer(bomb.x, bomb.y);
      const vol = distanceToVolume(dist, {
        minAudibleDist: 0,
        maxAudibleDist: 800, // 800px ≈ 14 tiles
      });
      playSound('explode', vol);
    }
    createExplosionVisuals(mapLayout, gameContainer, msg.col, msg.row, range);
  }
  if (msg.type === ServerToClientMessageType.CLEAR_AT) {
    removeCrate(msg.col, msg.row);
  }

  if (msg.type === ServerToClientMessageType.PLAYER_DIED) {
    logger.debug(`Player ${pId} died`);
    // Remove "dead" class if it exists (cleanup)
    player.el.classList.remove('dead');
    // Add "ghost" class
    player.el.classList.add('ghost');
  }

  if (msg.type === ServerToClientMessageType.BOMB_TIMER_UPDATE) {
    // Server sends timer update - x field contains timeLeft in ms
    const bomb = activeBombs.find((b) => b.col === msg.col && b.row === msg.row);
    if (bomb) {
      // Update from server (server is authoritative)
      bomb.timeLeft = msg.raw; // Extract timeLeft
    }
  }
  if (msg.type === ServerToClientMessageType.REMOVE_ITEM) {
    // Just erase the DOM element – no stat changes needed
    removeItemVisual(msg.col, msg.row);
    logger.debug(`[ITEM DEBUG] Client removed exploded item at (${msg.col},${msg.row})`);
    return;
  }
}

function updatePlayersFromState(playersData) {
  // Identify players to remove
  const currentIds = Object.keys(playersData);
  Object.keys(clientPlayers).forEach((id) => {
    if (!currentIds.includes(id)) {
      // Remove DOM elements
      if (clientPlayers[id].container) clientPlayers[id].container.remove();
      else if (clientPlayers[id].el) clientPlayers[id].el.remove();
      delete clientPlayers[id];
    }
  });

  // playersData is from GameEngine.
  // If I fix GameEngine to use 0-3, then keys are "0", "1", "2", "3".
  Object.entries(playersData).forEach(([key, p]) => {
    // We want to use the numeric ID if possible.
    // If key is "0", id is 0.
    const id = key;

    if (!clientPlayers[id]) {
      clientPlayers[id] = {
        id: id,
        prevX: p.x,
        prevY: p.y,
        x: p.x,
        y: p.y,
        isDead: p.isDead || false,
        color: p.color,
        container: null, // Wrapper for positioning
        el: null, // Sprite for animation
        animation: {
          currentDir: 'down',
          currentFrame: 1,
          animTime: 0,
        },
      };
    } else {
      // Update existing
      clientPlayers[id].x = p.x;
      clientPlayers[id].y = p.y;
      clientPlayers[id].isDead = p.isDead; // Store dead state for animation logic

      // Reset dead status visually if player is alive in new state
      if (!p.isDead) {
        if (clientPlayers[id].el.classList.contains('dead'))
          clientPlayers[id].el.classList.remove('dead');
        if (clientPlayers[id].el.classList.contains('ghost'))
          clientPlayers[id].el.classList.remove('ghost');

        // Reset transform/opacity if needed (CSS animation might leave it modified)
        clientPlayers[id].el.style.transform = '';
        clientPlayers[id].el.style.opacity = '';
        clientPlayers[id].el.style.filter = '';
        clientPlayers[id].el.style.backgroundImage = ''; // Clear override
      } else {
        // Ensure ghost class is present if dead
        if (!clientPlayers[id].el.classList.contains('ghost')) {
          clientPlayers[id].el.classList.add('ghost');
        }
        // Ensure dead class is removed if present
        if (clientPlayers[id].el.classList.contains('dead')) {
          clientPlayers[id].el.classList.remove('dead');
        }
      }
    }
  });

  // Update Scoreboard
  // We have #score-p1, #score-p2, etc. in HTML
  // playersData keys are "0", "1", "2", "3"
  Object.entries(playersData).forEach(([key, p]) => {
    const pId = parseInt(key) + 1; // 1-based index for DOM IDs
    const scoreEl = document.getElementById(`score-p${pId}`);
    if (scoreEl) {
      // Find name
      // roster is array of objects {id, name}.
      // If we can't match by socket ID (p.id might be missing in some states? No, GameEngine has it), use index.
      // GameEngine players have 'id' which is 0-3. Wait, GameEngine.addPlayer sets id to 0,1,2,3.
      // So p.id is 0-3.
      // But roster has socket IDs.
      // We need to map 0-3 to roster names.
      // In initGame we saw roster order matches player ID order.
      const name = roster[key] ? roster[key].name : `P${pId}`;
      scoreEl.innerText = `${name}: ${p.wins}`;
      // Hide if player doesn't exist?
      // If we have fewer than 4 players, hide the extras?
      scoreEl.style.display = 'block';
    }
  });

  // Hide unused score cards
  for (let i = Object.keys(playersData).length + 1; i <= 4; i++) {
    const scoreEl = document.getElementById(`score-p${i}`);
    if (scoreEl) scoreEl.style.display = 'none';
  }

  // Update player stats if we're in an online game
  updatePlayerStats(playersData);
}

function updatePlayerStats(playersData) {
  // Initialize or reset local stats from server state
  if (myPlayerId !== null && playersData[myPlayerId]) {
    const myPlayer = playersData[myPlayerId];
    if (myPlayer.stats) {
      // Initialize local stats from server (happens on game start/restart)
      localPlayerStats = {
        speed: myPlayer.stats.speed,
        bombRange: myPlayer.stats.bombRange,
        maxBombs: myPlayer.stats.maxBombs,
      };
      updatePlayerStatsUI();
    }
  } else {
    localPlayerStats = null;
    uiPlayerStats.hidden = true;
  }
}

function updatePlayerStatsUI() {
  // Update UI from local stats
  if (localPlayerStats) {
    uiStatRange.innerText = localPlayerStats.bombRange;
    uiStatSpeed.innerText = localPlayerStats.speed;
    uiStatBombs.innerText = localPlayerStats.maxBombs;
    uiPlayerStats.hidden = false;
  } else {
    uiPlayerStats.hidden = true;
  }
}

function initMap() {
  gameContainer.innerHTML = '';
  uiVictory.style.display = 'none'; // Hide victory screen on new map load
  gameContainer.appendChild(uiVictory);

  // Clear player DOM references so they are recreated
  Object.values(clientPlayers).forEach((p) => {
    p.el = null;
    p.container = null;
  });

  // Use shared function from visual-effects.js to create tiles
  mapLayout.forEach((row, rowIndex) => {
    row.forEach((tileType, colIndex) => {
      const x = colIndex * TILE_SIZE;
      const y = rowIndex * TILE_SIZE;
      if (tileType === 1) {
        createTile(gameContainer, x, y, 'wall');
      } else if (tileType === 2) {
        const crate = createTile(gameContainer, x, y, 'crate');
        crate.dataset.col = colIndex;
        crate.dataset.row = rowIndex;
      }
    });
  });
}

function renderPlayers() {
  Object.values(clientPlayers).forEach((p) => {
    if (!p.el) {
      // Create Container (handles positioning)
      const container = document.createElement('div');
      container.classList.add('player-container');
      container.style.width = `${TILE_SIZE}px`;
      container.style.height = `${TILE_SIZE}px`;
      container.style.position = 'absolute';
      container.style.willChange = 'transform';
      container.style.zIndex = '10';

      // Create Sprite Element (handles visuals & animations)
      const el = document.createElement('div');
      el.classList.add('player');
      el.style.width = `${TILE_SIZE}px`;
      el.style.height = `${TILE_SIZE}px`;
      el.style.position = 'absolute';
      el.style.willChange = 'transform';
      el.style.zIndex = '10';

      // Add ID for CSS sprites (player-p1, player-p2, etc.)
      el.id = `player-p${parseInt(p.id) + 1}`;

      container.appendChild(el);
      gameContainer.appendChild(container);

      p.container = container;
      p.el = el;
    }

    // Update position on the CONTAINER
    if (p.container) {
      p.container.style.transform = `translate3d(${p.x - OFFSET}px, ${p.y - OFFSET}px, 0)`;
    }
  });
}

function createBombVisual(col, row) {
  const el = document.createElement('div');
  el.classList.add('bomb');
  el.style.left = `${col * TILE_SIZE}px`;
  el.style.top = `${row * TILE_SIZE}px`;

  // Add timer text
  const timerText = document.createElement('div');
  timerText.classList.add('bomb-timer');
  timerText.innerText = '3000';
  el.appendChild(timerText);

  gameContainer.appendChild(el);

  const bomb = {
    col,
    row,
    el,
    timerText, // Store reference to timer element
    animation: { currentFrame: 0, animTime: 0 },
    timeLeft: BOMB_TIMER, // Track time left for display
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
  activeBombs.push(bomb);
  return bomb;
}

function removeCrate(col, row) {
  const crate = document.querySelector(`.crate[data-col='${col}'][data-row='${row}']`);
  if (crate) crate.remove();
  // Update local map layout to prevent flames stopping there next time?
  if (mapLayout[row] && mapLayout[row][col]) mapLayout[row][col] = 0;
}

function createItemVisual(col, row, typeIndex) {
  const type = ITEM_TYPES[typeIndex];
  if (!type) return;

  const el = document.createElement('div');
  el.classList.add('item', type.class);
  el.style.left = `${col * TILE_SIZE}px`;
  el.style.top = `${row * TILE_SIZE}px`;
  el.dataset.col = col;
  el.dataset.row = row;
  gameContainer.appendChild(el);
}

function removeItemVisual(col, row) {
  const item = document.querySelector(`.item[data-col='${col}'][data-row='${row}']`);
  if (item) item.remove();
}

function updateTimer() {
  if (isPaused || isGameOver) return;
  const elapsed = Date.now() - gameStartTime - gamePausedDuration;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  uiTimer.innerText =
    (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const deltaTime = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  if (isPaused) {
    gamePausedDuration += deltaTime * 1000;
    requestAnimationFrame(gameLoop);
    return;
  }

  // 1. Input & Prediction
  const input = inputManager.getInputState();
  if (myPlayerId !== null) {
    handleInput(input);
  }

  // ---- CLIENT PREDICTION ----
  if (myPlayerId !== null) {
    const pl = clientPlayers[myPlayerId];
    clientPrediction.updateLocalPlayer(pl, input, deltaTime, mapLayout, activeBombs);
  }

  // 2. Interpolation (Remote Players)
  clientPrediction.interpolateRemotePlayers(clientPlayers, myPlayerId);

  // 3. Render
  Object.values(clientPlayers).forEach((p) => {
    if (p.container) {
      p.container.style.transform = `translate3d(${p.x - OFFSET}px, ${p.y - OFFSET}px, 0)`;
    }
    if (p.el) {
      updatePlayerAnimation(deltaTime, p);
      // Update previous position for next frame's animation calculation
      p.prevX = p.x;
      p.prevY = p.y;
    }
  });

  activeBombs.forEach((b) => {
    // Display timer (server-authoritative, no longer counting down locally)
    if (b.timeLeft !== undefined && b.timerText) {
      const sLeft = Math.max(0, Math.floor(b.timeLeft)); // 500 ms units

      // Compute distance from the local player to this bomb:
      const dist = distanceFromPlayer(b.x, b.y);
      const vol = distanceToVolume(dist, {
        minAudibleDist: 0,
        maxAudibleDist: 400, // 400px ≈ 6‑7 tiles; beyond that the tick is silent
      });

      // b.lastDisplayed is undefined initially and will cause a tick upon first and subsequent updates
      if (b.lastDisplayed === undefined) {
        playSound('bomb', vol);
      } else if (b.lastDisplayed !== sLeft) {
        playSound('tick', vol);
      }
      b.lastDisplayed = sLeft;
      b.timerText.innerText = sLeft;
      // Add urgency styling when < 1000ms
      if (sLeft < 1 / 0.5) {
        b.timerText.style.color = '#ff0000';
        b.timerText.style.fontWeight = 'bold';
      }
    }
    updateElementAnimation(deltaTime, b, 50);
  });
  updateTimer();
  requestAnimationFrame(gameLoop);
}

let lastInput = { dx: 0, dy: 0, placeBomb: false };

function handleInput(input) {
  if (!mySocket) return;
  if (isPaused) return;

  // Network Sync (Only send changes)
  // Only check movement changes, not bomb changes
  const movementChanged = input.dx !== lastInput.dx || input.dy !== lastInput.dy;

  if (movementChanged) {
    if (input.dx === 0 && input.dy === 0) {
      mySocket.emit('G', ClientToServerMessageType.STOP);
    } else if (input.dx === -1) {
      mySocket.emit('G', ClientToServerMessageType.START_MOVE_LEFT);
    } else if (input.dx === 1) {
      mySocket.emit('G', ClientToServerMessageType.START_MOVE_RIGHT);
    } else if (input.dy === -1) {
      mySocket.emit('G', ClientToServerMessageType.START_MOVE_UP);
    } else if (input.dy === 1) {
      mySocket.emit('G', ClientToServerMessageType.START_MOVE_DOWN);
    }
  }

  // Bomb (independent of movement)
  if (input.placeBomb && !lastInput.placeBomb) {
    mySocket.emit('G', ClientToServerMessageType.PLACE_BOMB);
    // Optional: Predict bomb placement locally?
    // localGame.tryPlaceBomb(...)
    // But we need to be careful about IDs and syncing.
    // For now, let's leave bomb placement as server-authoritative visual.
  }

  lastInput = { ...input };
}

/**
 * Returns the distance between the current player (the one controlling
 * this client) and an arbitrary point (x, y) in world/pixel space.
 *
 * @param {number} targetX   X coordinate of the point you want to measure.
 * @param {number} targetY   Y coordinate of the point you want to measure.
 * @param {boolean} [useManhattan=false]  If true, uses |dx|+|dy| instead of Euclidean.
 * @returns {number} Distance ≥ 0.  If the player is not yet known, returns Infinity.
 */
export function distanceFromPlayer(targetX, targetY, useManhattan = false) {
  // Guard against the situation where the player ID hasn't been resolved yet.
  if (myPlayerId === null || !(myPlayerId in clientPlayers)) {
    // No valid player position – callers can treat this as “out of range”.
    return Infinity;
  }

  const player = clientPlayers[myPlayerId];
  const dx = player.x - targetX;
  const dy = player.y - targetY;

  // Identity covariance → classic Euclidean distance.
  // Switch to Manhattan‑style if you explicitly ask for it.
  return useManhattan ? Math.abs(dx) + Math.abs(dy) : Math.hypot(dx, dy);
}
