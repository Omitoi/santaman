import GameEngine from './game-engine.js';
import LocalInputManager from './local-input.js';
import { TILE_SIZE, OFFSET, ITEM_TYPES, mapLayoutTemplate } from './constants.js';
import { updatePlayerAnimation, updateElementAnimation } from './animate.js';
import { ServerToClientMessageType } from '../gamelogic/serverToClient.js';
import { createExplosionVisuals, createTile } from './visual-effects.js';
import { playSound } from './sound-effects.js';
import Bot from './bot.js';

export default class LocalGameManager {
  constructor(containerId, uiElements) {
    this.gameContainer = document.getElementById(containerId);
    this.uiElements = uiElements;
    this.inputManager = new LocalInputManager();
    this.gameEngine = null;
    this.animationFrameId = null;
    this.lastTime = 0;

    // Rendering state
    this.renderedBombs = [];
    this.renderedItems = [];
    // We need to track player state for animations (prevX, prevY)
    this.clientPlayers = {};
  }

  start(playerConfigs) {
    this.inputManager.reset();
    // Preserve wins from previous game if restarting
    let previousWins = {};
    if (this.gameEngine) {
      const prevState = this.gameEngine.getState();
      Object.values(prevState.players).forEach((p) => {
        previousWins[p.id] = p.wins;
      });
    }

    // Create a name lookup map: ID -> Name
    this.playerConfigs = playerConfigs;
    this.usernames = {}; // Map ID to Name
    playerConfigs.forEach((p) => {
      // Handle both object {id, name} and legacy string formats if necessary (though app.js sends objects now)
      if (typeof p === 'object') {
        this.usernames[p.id] = p.name;
      } else {
        // Fallback if strings passed (should not happen with new app.js)
        // If passing strings, IDs are implied 0,1,2... which might mismatch if we skipped
        // But we control inputs.
      }
    });

    // Initialize Bots
    this.botManagers = {};
    playerConfigs.forEach((p) => {
      if (p.isBot) {
        this.botManagers[p.id] = new Bot(p.id, p.config);
      }
    });

    // Initialize Engine
    this.gameEngine = new GameEngine({
      eventHandler: (e) => this.handleGameEvent(e),
      usernames: playerConfigs,
    });

    this.gameEngine.init(mapLayoutTemplate);

    // Restore wins if this is a restart
    if (Object.keys(previousWins).length > 0) {
      Object.values(this.gameEngine.players).forEach((p) => {
        if (previousWins[p.id] !== undefined) {
          p.wins = previousWins[p.id];
        }
      });
    }

    // Clear container
    this.gameContainer.innerHTML = '';
    this.gameContainer.appendChild(this.uiElements.victoryMessage);

    // Render Map
    this.initMap();

    this.clientPlayers = {};

    // Render Players
    const state = this.gameEngine.getState();
    Object.values(state.players).forEach((p) => {
      // Container for positioning
      const container = document.createElement('div');
      container.classList.add('player-container');
      container.style.position = 'absolute';
      container.style.width = `${TILE_SIZE}px`;
      container.style.height = `${TILE_SIZE}px`;
      container.style.zIndex = '10';
      container.style.willChange = 'transform';

      // Sprite for animation/visuals
      const el = document.createElement('div');
      el.classList.add('player');
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.position = 'absolute';
      el.style.backgroundColor = '';

      // Use sprite IDs
      el.id = `player-p${parseInt(p.id) + 1}`;

      container.appendChild(el);

      // Display Name Label
      const nameLabel = document.createElement('div');
      nameLabel.innerText = this.usernames[p.id] || `P${parseInt(p.id) + 1}`;
      nameLabel.style.position = 'absolute';
      nameLabel.style.top = '-20px'; // Position above player
      nameLabel.style.left = '50%';
      nameLabel.style.transform = 'translateX(-50%)';
      nameLabel.style.color = 'white';
      nameLabel.style.fontSize = '12px';
      nameLabel.style.fontWeight = 'bold';
      nameLabel.style.textShadow = '1px 1px 2px black';
      nameLabel.style.whiteSpace = 'nowrap';
      nameLabel.style.pointerEvents = 'none';
      container.appendChild(nameLabel);

      this.gameContainer.appendChild(container);

      // Init client player state for animation
      this.clientPlayers[p.id] = {
        id: p.id,
        container: container, // Use this for positioning
        el: el, // Use this for animation (animate.js uses .el)
        prevX: p.x,
        prevY: p.y,
        x: p.x,
        y: p.y,
        animation: {
          currentDir: 'down',
          currentFrame: 1,
          animTime: 0,
          isMoving: false,
        },
      };
    });

    this.updateScoreboard();
    this.uiElements.victoryMessage.style.display = 'none';

    // Start Loop
    this.lastTime = 0;
    this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.inputManager.destroy();
  }

  gameLoop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const deltaTime = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // 1. Input
    // We need to handle input for ALL players
    const state = this.gameEngine.getState();
    Object.keys(state.players).forEach((id) => {
      let input;
      if (this.botManagers[id]) {
        input = this.botManagers[id].update(state, deltaTime);
      } else {
        input = this.inputManager.getInputState(id);
      }
      this.gameEngine.handleInput(id, input);
    });

    // 2. Update Engine
    this.gameEngine.update(deltaTime);

    // 3. Render
    this.render(deltaTime);

    this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
  }

  render(deltaTime) {
    const state = this.gameEngine.getState();

    // Update Players
    Object.values(state.players).forEach((p) => {
      const clientP = this.clientPlayers[p.id];
      if (clientP && clientP.el) {
        // Calculate movement for animation
        // We need to compare current engine position (p.x, p.y) with previous frame's position (clientP.prevX, clientP.prevY)
        // BUT updatePlayerAnimation uses (player.x - player.prevX).
        // So we set clientP.x = p.x, clientP.y = p.y BEFORE calling it.
        // AND we must ensure prevX/prevY are set from the LAST frame.

        clientP.x = p.x;
        clientP.y = p.y;

        // Explicitly set isMoving based on input for local game to ensure responsiveness
        // GameEngine stores input in p.input
        const enginePlayer = state.players[p.id];
        if (enginePlayer && enginePlayer.input) {
          clientP.animation.isMoving = enginePlayer.input.dx !== 0 || enginePlayer.input.dy !== 0;
        }

        if (enginePlayer && enginePlayer.input) {
          clientP.animation.isMoving = enginePlayer.input.dx !== 0 || enginePlayer.input.dy !== 0;
        }

        if (clientP.container) {
          clientP.container.style.transform = `translate3d(${Math.round(p.x - OFFSET)}px, ${Math.round(p.y - OFFSET)}px, 0)`;
        } else {
          // Fallback if container not created yet (should not happen with match reset)
          clientP.el.style.transform = `translate3d(${Math.round(p.x - OFFSET)}px, ${Math.round(p.y - OFFSET)}px, 0)`;
        }

        if (p.isDead && !clientP.el.classList.contains('dead')) {
          clientP.el.classList.add('dead');
        }

        updatePlayerAnimation(deltaTime, clientP);

        // Update prev position for next frame
        clientP.prevX = clientP.x;
        clientP.prevY = clientP.y;
      }
    });

    // Sync Bombs and Items
    this.syncRenderedObjects(state.activeBombs, this.renderedBombs, 'bomb');
    this.syncRenderedObjects(state.activeItems, this.renderedItems, 'item');

    // Animate Bombs
    this.renderedBombs.forEach((b) => {
      // We need animation state on the bomb object
      if (!b.animation) {
        b.animation = { currentFrame: 0, animTime: 0 };
      }

      // Update timer text
      // In local game, we calculate timeLeft directly from explodeAt
      // GameEngine updates explodeAt when paused, so Date.now() comparison is valid
      const timeLeftMs = b.explodeAt - Date.now();
      const sLeft = Math.max(0, Math.floor(timeLeftMs / 500)); // 500 ms units

      if (b.timerText) {
        b.timerText.innerText = sLeft;

        // Sound Logic (Ticking)
        // In local game, we play sound at full volume for everyone
        if (b.lastDisplayed === undefined) {
          playSound('bomb', 1.0);
        } else if (b.lastDisplayed !== sLeft) {
          playSound('tick', 1.0);
        }
        b.lastDisplayed = sLeft;
      }

      if (b._domElement) {
        const animObj = { el: b._domElement, animation: b.animation };
        updateElementAnimation(deltaTime, animObj, 50); // 50px is bomb size in css
      }
    });

    this.updateTimer(state);
    this.checkVictory(state);
  }

  initMap() {
    // Clear container
    this.gameContainer.innerHTML = '';
    this.uiElements.victoryMessage.style.display = 'none';
    this.gameContainer.appendChild(this.uiElements.victoryMessage);

    // Get current map layout
    const state = this.gameEngine.getState();

    // Create tiles using shared function
    state.mapLayout.forEach((row, rowIndex) => {
      row.forEach((tileType, colIndex) => {
        const x = colIndex * TILE_SIZE;
        const y = rowIndex * TILE_SIZE;
        if (tileType === 1) {
          createTile(this.gameContainer, x, y, 'wall');
        } else if (tileType === 2) {
          const crate = createTile(this.gameContainer, x, y, 'crate');
          crate.dataset.col = colIndex;
          crate.dataset.row = rowIndex;
        }
      });
    });
  }

  syncRenderedObjects(sourceList, renderedList, type) {
    // Remove
    for (let i = renderedList.length - 1; i >= 0; i--) {
      const obj = renderedList[i];
      if (!sourceList.includes(obj)) {
        if (obj._domElement && obj._domElement.parentNode) {
          obj._domElement.parentNode.removeChild(obj._domElement);
        }
        renderedList.splice(i, 1);
      }
    }
    // Add
    sourceList.forEach((obj) => {
      if (!renderedList.includes(obj)) {
        const el = document.createElement('div');
        if (type === 'bomb') {
          el.classList.add('bomb');

          // Add timer text
          const timerText = document.createElement('div');
          timerText.classList.add('bomb-timer');
          timerText.innerText = '3000'; // Initial placeholder
          el.appendChild(timerText);
          obj.timerText = timerText;
        } else {
          const typeDef = ITEM_TYPES.find((t) => t.type === obj.type);
          el.classList.add('item', typeDef ? typeDef.class : '');
        }
        el.style.left = `${Math.round(obj.col * TILE_SIZE)}px`;
        el.style.top = `${Math.round(obj.row * TILE_SIZE)}px`;
        this.gameContainer.appendChild(el);
        obj._domElement = el;
        renderedList.push(obj);
      }
    });
  }

  handleGameEvent(event) {
    // Handle explosions visuals, etc.
    if (event.type === ServerToClientMessageType.EXPLODE_AT) {
      // event.x holds the range
      createExplosionVisuals(
        this.gameEngine.getState().mapLayout,
        this.gameContainer,
        event.col,
        event.row,
        event.x
      );

      // Play explosion sound
      // In local game, play at full volume
      playSound('explode', 1.0);
    }
    if (event.type === ServerToClientMessageType.CLEAR_AT) {
      // Use querySelector on gameContainer to be safe
      const crate = this.gameContainer.querySelector(
        `.crate[data-col='${event.col}'][data-row='${event.row}']`
      );
      if (crate) crate.remove();
    }
  }

  updateTimer(state) {
    if (state.isGameOver) return;
    const elapsed = Date.now() - state.gameStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    this.uiElements.timer.innerText =
      (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  }

  updateScoreboard() {
    const state = this.gameEngine.getState();
    Object.values(state.players).forEach((p) => {
      // Assuming scoreboard elements exist with id score-p1, score-p2...
      const el = document.getElementById(`score-p${parseInt(p.id) + 1}`);
      const name = this.usernames[p.id] || `P${parseInt(p.id) + 1}`;
      if (el) {
        el.innerText = `${name}: ${p.wins}`;
        el.style.display = 'block';
      }
    });

    // Hide unused score cards
    const numPlayers = Object.keys(state.players).length;
    for (let i = numPlayers + 1; i <= 4; i++) {
      const scoreEl = document.getElementById(`score-p${i}`);
      if (scoreEl) scoreEl.style.display = 'none';
    }
  }

  checkVictory(state) {
    if (state.isGameOver && this.uiElements.victoryMessage.style.display === 'none') {
      this.uiElements.victoryMessage.style.display = 'block';
      const alivePlayers = Object.values(state.players).filter((p) => !p.isDead);
      if (alivePlayers.length === 1) {
        const winner = alivePlayers[0];
        const name = this.usernames[winner.id] || `P${parseInt(winner.id) + 1}`;
        this.uiElements.victoryText.innerText = `${name} WINS!`;
        this.uiElements.victoryText.style.color = winner.color;
      } else {
        this.uiElements.victoryText.innerText = 'DRAW!';
        this.uiElements.victoryText.style.color = 'white';
      }
      this.updateScoreboard();

      // Setup reset button for local game
      const btnReset = document.getElementById('reset-btn');
      if (btnReset) {
        btnReset.style.display = 'inline-block';
        btnReset.onclick = () => {
          // Restart the game with the same players
          this.start(this.playerConfigs);
        };
      }
    }
  }
}
