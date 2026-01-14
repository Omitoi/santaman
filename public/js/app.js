import { initGame } from './game.js';
import LocalGameManager from './local-game-manager.js';
import { DEFAULT_CONTROLS } from './local-input.js';
import { init as initSound, toggleMusic, isPlaying } from './sound-effects.js';

const OPEN_GAMES_REFRESH_MS = 10_000; // 10 seconds

document.addEventListener('DOMContentLoaded', () => {
  // Infer socket path from current location
  // If we are at /bomberman/, path should be /bomberman/socket.io
  // If we are at /bomberman/index.html, path should ALSO be /bomberman/socket.io
  let basePath = window.location.pathname;
  // Remove 'index.html' or 'index.htm' if present
  basePath = basePath.replace(/\/index\.html?$/, '');
  // Remove trailing slash
  basePath = basePath.replace(/\/$/, '');

  const path = basePath + '/socket.io';
  const socket = io({ path });

  // --- State Management ---
  let state = {
    isMaster: false,
    roomId: null,
    playerId: null,
    playerName: null,
    roster: [],
  };

  let localGameManager = null;

  // --- DOM Elements ---
  const views = {
    mainMenu: document.getElementById('view-main-menu'),
    hostGame: document.getElementById('view-host-game'),
    joinGame: document.getElementById('view-join-game'),
    localSetup: document.getElementById('view-local-setup'),
    lobby: document.getElementById('view-lobby'),
    game: document.getElementById('view-game'),
  };

  // UI references
  const openGamesSection = document.getElementById('open-games-section');
  const openGamesTableBody = document.querySelector('#open-games-table tbody');
  const noOpenGamesMsg = document.getElementById('no-open-games');

  // Helper: render the table rows
  function renderOpenGames(games) {
    // Clear any previous rows
    openGamesTableBody.innerHTML = '';
    openGamesSection.hidden = true;
    noOpenGamesMsg.hidden = true;

    if (views.mainMenu.hidden) return;

    if (!games.length) {
      noOpenGamesMsg.hidden = false;
      return;
    }

    openGamesSection.hidden = false;

    games.forEach((g) => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.title = 'Click to join this room';

      // Room ID cell
      const tdId = document.createElement('td');
      tdId.textContent = g.roomId;
      tr.appendChild(tdId);

      // Player count cell
      const tdCount = document.createElement('td');
      tdCount.textContent = `${g.players.length}`;
      tr.appendChild(tdCount);

      // Player names cell (comma‑separated)
      const tdNames = document.createElement('td');
      tdNames.textContent = g.players.map((p) => p.name).join(', ');
      tr.appendChild(tdNames);

      // Click handler – switch to Join view and pre‑fill the field
      tr.addEventListener('click', () => {
        // Show the Join view
        showView('joinGame');

        // Fill the room‑ID input
        const roomInput = document.getElementById('joinRoomId');
        roomInput.value = g.roomId;

        // Optionally focus the name field so the user can hit “Enter”
        document.getElementById('joinPlayerName').focus();
      });

      openGamesTableBody.appendChild(tr);
    });
  }

  socket.on('gameStarted', ({ roomId, state: initialState }) => {
    // Switch to game view
    showView('game');
    initGame(socket, roomId, state.playerId, state.roster, initialState);
  });

  // Main Menu
  const btnShowHost = document.getElementById('btn-show-host');
  const btnShowJoin = document.getElementById('btn-show-join');
  const btnShowLocal = document.getElementById('btn-show-local');

  // Host Game
  const hostForm = document.getElementById('hostForm');
  const hostPlayerNameInput = document.getElementById('hostPlayerName');
  const hostBtn = document.getElementById('hostBtn');
  const btnHostBack = document.getElementById('btn-host-back');
  const hostMessage = document.getElementById('hostMessage');

  // Join Game
  const joinForm = document.getElementById('joinForm');
  const joinPlayerNameInput = document.getElementById('joinPlayerName');
  const joinRoomIdInput = document.getElementById('joinRoomId');
  const joinBtn = document.getElementById('joinBtn');
  const btnJoinBack = document.getElementById('btn-join-back');
  const joinMessage = document.getElementById('joinMessage');

  // Local Game Setup
  const localSetupForm = document.getElementById('localSetupForm');
  const btnLocalBack = document.getElementById('btn-local-back');
  const localMessageEl = document.getElementById('localMessage');
  const controlsListEl = document.getElementById('controls-list');

  function renderControls() {
    if (!controlsListEl) return;
    controlsListEl.innerHTML = '';
    Object.entries(DEFAULT_CONTROLS).forEach(([id, mapping]) => {
      const group = document.createElement('div');
      group.className = 'control-group';

      const title = document.createElement('h4');
      title.innerText = `Player ${parseInt(id) + 1}`;
      group.appendChild(title);

      // Group by action for cleaner display
      const actionMap = {};
      Object.entries(mapping).forEach(([key, action]) => {
        // Simplify key names
        let keyName = key.replace('Key', '');
        if (keyName === 'ArrowUp') keyName = '<span class="arrow-key">⬆</span>';
        if (keyName === 'ArrowDown') keyName = '<span class="arrow-key">⬇</span>';
        if (keyName === 'ArrowLeft') keyName = '<span class="arrow-key">⬅</span>';
        if (keyName === 'ArrowRight') keyName = '<span class="arrow-key">➡</span>';
        if (keyName === ' ') keyName = 'Space';
        actionMap[action] = keyName;
      });

      // Movement
      const moveItem = document.createElement('div');
      moveItem.className = 'control-item';
      const up = actionMap['UP'];
      const left = actionMap['LEFT'];
      const down = actionMap['DOWN'];
      const right = actionMap['RIGHT'];

      moveItem.innerHTML = `<span>Move:</span> <span>${up}, ${left}, ${down}, ${right}</span>`;
      group.appendChild(moveItem);

      const bombItem = document.createElement('div');
      bombItem.className = 'control-item';
      bombItem.innerHTML = `<span>Bomb:</span> <span>${actionMap['BOMB']}</span>`;
      group.appendChild(bombItem);

      controlsListEl.appendChild(group);
    });
  }

  // Lobby
  const lobbyRoomIdEl = document.getElementById('lobby-room-id');
  const lobbyPlayerListEl = document.getElementById('lobby-player-list');
  const btnStartGame = document.getElementById('btn-start-game');
  const btnLeaveLobby = document.getElementById('btn-leave-lobby');
  const lobbyMessage = document.getElementById('lobby-message');

  // Game UI
  const uiVictory = document.getElementById('victory-message');
  const uiVictoryText = document.getElementById('victory-text');
  const uiTimer = document.getElementById('game-timer');

  // --- View Manager ---
  const showView = (viewName) => {
    Object.values(views).forEach((view) => (view.hidden = true));
    if (views[viewName]) {
      views[viewName].hidden = false;
    } else {
      console.error(`View '${viewName}' not found.`);
    }
  };

  // --- Navigation ---
  btnShowHost.addEventListener('click', () => showView('hostGame'));
  btnShowJoin.addEventListener('click', () => showView('joinGame'));
  btnShowLocal.addEventListener('click', () => {
    showView('localSetup');
    renderControls();
  });
  btnHostBack.addEventListener('click', () => showView('mainMenu'));
  btnJoinBack.addEventListener('click', () => showView('mainMenu'));
  btnLocalBack.addEventListener('click', () => showView('mainMenu'));

  btnLeaveLobby.addEventListener('click', () => {
    // Disconnect and reload to go back to main menu cleanly
    socket.disconnect();
    window.location.reload();
  });

  // Request the list from the server
  function requestOpenGames() {
    // The server expects an optional payload + ack callback
    socket.emit('getFreeGames', null, (response) => {
      // The server may also emit 'freeGamesList'; we handle both ways.
      if (response && response.success) {
        renderOpenGames(response.games);
      }
    });
  }
  // Listen for the broadcast version (if the server uses emit instead of ack)
  socket.on('freeGamesList', (data) => {
    if (data && Array.isArray(data.games)) {
      renderOpenGames(data.games);
    }
  });

  // Periodic refresh
  setInterval(requestOpenGames, OPEN_GAMES_REFRESH_MS);

  // Initial load (as soon as the socket connects)
  socket.on('connect', () => {
    requestOpenGames();
  });

  // Note: Reset button is handled separately:
  // - For online games: handled in game.js via socket.emit('restartGame')
  // - For local games: handled via form resubmission in localSetupForm listener

  // --- Form Logic ---
  hostForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = hostPlayerNameInput.value.trim();
    if (!username) {
      hostMessage.textContent = 'Please enter a player name.';
      hostMessage.hidden = false;
      return;
    }
    hostBtn.disabled = true;
    hostBtn.textContent = 'Hosting...';
    socket.emit('createGame', { username }, (response) => {
      if (response.success) {
        state.isMaster = true;
        state.playerId = response.player.id;
        state.playerName = response.player.name;
        state.roomId = response.roomId;
        enterLobby();
        updatePlayerList(response.roster);
      } else {
        hostMessage.textContent = `Error: ${response.error}`;
        hostMessage.hidden = false;
        hostBtn.disabled = false;
        hostBtn.textContent = 'Host Game';
      }
    });
  });

  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = joinPlayerNameInput.value.trim();
    const roomId = joinRoomIdInput.value.trim().toUpperCase();

    if (!username || !roomId) {
      joinMessage.textContent = 'Player name and Room ID are required.';
      joinMessage.hidden = false;
      return;
    }
    joinBtn.disabled = true;
    joinBtn.textContent = 'Joining...';
    socket.emit('joinGame', { username, roomId }, (response) => {
      if (response.success) {
        state.isMaster = false;
        state.playerId = response.player.id;
        state.playerName = response.player.name;
        state.roomId = response.roomId;
        enterLobby();
        updatePlayerList(response.roster);
      } else {
        joinMessage.textContent = `Error: ${response.error}`;
        joinMessage.hidden = false;
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join Game';
      }
    });
  });

  // Initialize Computer Checkboxes
  localSetupForm.querySelectorAll('.computer-checkbox').forEach((cb) => {
    cb.addEventListener('change', () => {
      const target = document.getElementById(cb.dataset.target);
      if (target) {
        target.disabled = cb.checked;
        const pid = cb.dataset.target.replace('localP', '').replace('Name', ''); // 1, 2...
        const configDiv = document.getElementById('config-p' + pid);

        if (cb.checked) {
          target.value = 'Computer ' + pid;
          if (configDiv) configDiv.hidden = false;
        } else {
          if (target.value.startsWith('Computer')) target.value = 'Player ' + pid;
          if (configDiv) configDiv.hidden = true;
        }
      }
    });
  });

  localSetupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(localSetupForm);

    // Helper to get name or computer default
    const getName = (key, compKey, defaultName) => {
      if (formData.get(compKey) === 'on') return defaultName;
      return (formData.get(key) || '').trim();
    };

    const getBotConfig = (prefix) => {
      // prefix is p1, p2 etc
      return {
        useItems: formData.get(prefix + 'Items') === 'on',
        smart: formData.get(prefix + 'Smart') === 'on',
        difficulty: parseInt(formData.get(prefix + 'Diff') || '5'),
      };
    };

    const p1 = getName('p1Name', 'p1Computer', 'Computer 1');
    const p2 = getName('p2Name', 'p2Computer', 'Computer 2');
    const p3 = getName('p3Name', 'p3Computer', 'Computer 3');
    const p4 = getName('p4Name', 'p4Computer', 'Computer 4');

    // Construct player config with IDs 0-3
    // If the field is non-empty, include it with its fixed ID
    const players = [];
    if (p1)
      players.push({
        id: 0,
        name: p1,
        isBot: formData.get('p1Computer') === 'on',
        config: formData.get('p1Computer') === 'on' ? getBotConfig('p1') : {},
      });
    if (p2)
      players.push({
        id: 1,
        name: p2,
        isBot: formData.get('p2Computer') === 'on',
        config: formData.get('p2Computer') === 'on' ? getBotConfig('p2') : {},
      });
    if (p3)
      players.push({
        id: 2,
        name: p3,
        isBot: formData.get('p3Computer') === 'on',
        config: formData.get('p3Computer') === 'on' ? getBotConfig('p3') : {},
      });
    if (p4)
      players.push({
        id: 3,
        name: p4,
        isBot: formData.get('p4Computer') === 'on',
        config: formData.get('p4Computer') === 'on' ? getBotConfig('p4') : {},
      });

    if (players.length < 2) {
      localMessageEl.textContent = 'At least two players are required.';
      localMessageEl.hidden = false;
      return;
    }

    if (players.every((p) => p.isBot)) {
      localMessageEl.textContent = 'At least one human player is required.';
      localMessageEl.hidden = false;
      return;
    }

    // Start Local Game
    showView('game');

    if (localGameManager) {
      localGameManager.stop();
    }

    localGameManager = new LocalGameManager('game-container', {
      timer: uiTimer,
      victoryMessage: uiVictory,
      victoryText: uiVictoryText,
    });

    localGameManager.start(players);

    // Ensure stats UI is hidden for local play
    document.getElementById('player-stats').hidden = true;
  });

  // --- Window Unload Safety ---
  window.addEventListener('beforeunload', (e) => {
    // Check if a game is active:
    // 1. Online: state.roomId is set AND we are not in the main menu (simplistic check)
    // 2. Local: localGameManager is active

    // Better check: If we are in 'game' view.
    const isGameView = !views.game.hidden;

    if (isGameView) {
      e.preventDefault();
      e.returnValue = ''; // Standard for Chrome/Firefox
      return '';
    }
  });

  // --- Lobby Logic ---
  const enterLobby = () => {
    lobbyRoomIdEl.textContent = state.roomId;
    btnStartGame.hidden = !state.isMaster;
    showView('lobby');
  };

  const updatePlayerList = (roster) => {
    state.roster = roster;
    lobbyPlayerListEl.innerHTML = '';
    roster.forEach((player) => {
      const li = document.createElement('li');
      li.textContent = player.name;
      if (player.id === state.playerId) {
        li.textContent += ' (You)';
        li.style.fontWeight = 'bold';
      }
      lobbyPlayerListEl.appendChild(li);
    });

    // Dynamically enable/disable Start button based on player count
    if (state.isMaster) {
      btnStartGame.disabled = roster.length < 2;
      if (roster.length < 2) {
        lobbyMessage.textContent = 'Waiting for more players...';
        lobbyMessage.hidden = false;
      } else {
        lobbyMessage.hidden = true;
      }
    }
  };

  btnStartGame.addEventListener('click', () => {
    btnStartGame.disabled = true;
    socket.emit('startGame', { roomId: state.roomId }, (response) => {
      if (!response.success) {
        lobbyMessage.textContent = `Error: ${response.error}`;
        lobbyMessage.hidden = false;
        btnStartGame.disabled = false;
      }
      // On success, wait for the 'gameStarted' broadcast
    });
  });

  // --- Socket Event Listeners ---
  socket.on('playerJoined', ({ roster }) => {
    if (views.lobby.hidden === false) {
      // Only update if in lobby
      updatePlayerList(roster);
    }
  });

  socket.on('playerLeft', ({ roster }) => {
    if (views.lobby.hidden === false) {
      updatePlayerList(roster);
      lobbyMessage.textContent = 'A player has left the lobby.';
      lobbyMessage.hidden = false;
    }
  });

  socket.on('gameCancelled', ({ reason }) => {
    alert(`Game cancelled: ${reason}. Returning to main menu.`);
    window.location.reload();
  });

  socket.on('disconnect', () => {
    // If not on the main menu, it's an unexpected disconnect
    // But if we are in local game, we don't care about socket disconnect!
    if (views.mainMenu.hidden === true && views.localSetup.hidden === true && !localGameManager) {
      alert('Lost connection to the server. Returning to main menu.');
      window.location.reload();
    }
  });

  // ---------- Sound initialization ----------
  initSound(); // locate <audio>, set volume, etc.

  const musicBtn = document.getElementById('music-toggle');
  if (musicBtn) {
    const updateLabel = (on) => {
      musicBtn.dataset.state = on ? 'on' : 'off';
      musicBtn.textContent = on ? '🎵 Music: On' : '🎵 Music: Off';
    };
    updateLabel(isPlaying());

    musicBtn.addEventListener('click', () => {
      // Unfocus the button so it won't catch the space key events.
      musicBtn.blur();
      // Toggle the music
      const nowOn = toggleMusic();
      updateLabel(nowOn);
    });
  }
  // --- Initial Load ---
  showView('mainMenu');
});
