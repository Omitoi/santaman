import GameEngine from '../public/js/game-engine.js';
import { ClientToServerMessageType } from './clientToServer.js';
import { encodeServerMessage, ServerToClientMessageType } from './serverToClient.js';
import { mapLayoutTemplate } from '../public/js/constants.js';
import { logger } from '../public/js/logger.js';

export default class GameComms {
  #emit;
  #usernames;
  #isPaused;
  #gameEngine;

  constructor({ emit, usernames, isPaused }) {
    if (typeof emit !== 'function') {
      throw new TypeError('emit must be a function');
    }
    if (!Array.isArray(usernames) || usernames.length === 0) {
      throw new TypeError('usernames must be an array with at least one username');
    }

    this.#isPaused = isPaused;

    this.#gameEngine = new GameEngine({
      eventHandler: (...args) => {
        this.broadcast(...args);
      },
      usernames: this.#usernames,
      onGameOver: (state) => {
        this.#emit('state', state);
      },
    });
    this.#gameEngine.init(mapLayoutTemplate);
  }

  fromPlayer(playerId, payload) {
    const state = { dx: 0, dy: 0, placeBomb: false };
    switch (payload) {
      case ClientToServerMessageType.STOP:
        break;
      case ClientToServerMessageType.START_MOVE_UP:
        state.dy = -1;
        break;
      case ClientToServerMessageType.START_MOVE_DOWN:
        state.dy = 1;
        break;
      case ClientToServerMessageType.START_MOVE_LEFT:
        state.dx = -1;
        break;
      case ClientToServerMessageType.START_MOVE_RIGHT:
        state.dx = 1;
        break;
      case ClientToServerMessageType.PLACE_BOMB:
        state.placeBomb = true;
        break;
      default:
        logger.warn('Invalid payload received in gameComms.fromPlayer');
    }
    this.#gameEngine.handleInput(playerId, state);
  }

  start() {
    if (this.interval) clearInterval(this.interval);

    // Initialize lastTime on first run to prevent huge deltaTime
    let lastTime = null;

    this.interval = setInterval(() => {
      if (this.#isPaused && this.#isPaused()) {
        // We still want to keep sending the latest state so clients stay in sync
        this.#emit('state', this.#gameEngine.getState());
        return;
      }
      const now = Date.now();

      // Initialize or update deltaTime
      if (lastTime === null) {
        lastTime = now;
        // Skip first frame to avoid huge deltaTime
        return;
      }

      let dt = (now - lastTime) / 1000;
      lastTime = now;

      // Clamp delta time to maximum 0.1s to prevent huge simulation steps
      // This prevents physics tunneling and timer jumps if the server lags
      if (dt > 0.1) {
        logger.warn(`Server lag spike detected: ${dt.toFixed(3)}s. Clamping to 0.1s.`);
        dt = 0.1;
      }

      this.#gameEngine.update(dt);
    }, 1000 / 60); // 60 FPS

    // Send initial state
    this.#emit('state', this.#gameEngine.getState());
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  getState() {
    return this.#gameEngine.getState();
  }

  broadcast(args) {
    let message = { playerId: 0, type: 0, col: 0, row: 0, x: 0, y: 0 };
    message = { ...message, ...args };

    message = { ...message, ...args };

    if (message.type === ServerToClientMessageType.SPAWN_ITEM) {
      logger.debug(
        `[COMMS DEBUG] Broadcasting JSON SPAWN: typeIdx=${message.playerId}, col=${message.col}, row=${message.row}`
      );
      // Hybrid Protocol: Send as reliable JSON event instead of binary
      this.#emit('spawnItem', {
        col: message.col,
        row: message.row,
        typeIndex: message.playerId,
      });
      return;
    }
    // Send it
    this.#emit(
      'G',
      encodeServerMessage(
        message.playerId,
        message.type,
        message.col,
        message.row,
        message.x,
        message.y
      )
    );
  }

  restartGame() {
    this.#gameEngine.init(mapLayoutTemplate);
    this.#emit('state', this.#gameEngine.getState());
  }

  pause() {
    this.#gameEngine?.pause();
  }

  resume() {
    this.#gameEngine?.resume();
  }
}
