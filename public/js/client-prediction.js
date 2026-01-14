import { TILE_SIZE, PLAYER_SIZE, OFFSET, SNAP_SPEED } from './constants.js';

export default class ClientPrediction {
  constructor() {
    this.positionBuffers = {}; // { playerId: [ { t, x, y }, ... ] }
    this.interpolationDelay = 100; // ms

    // History for local player reconciliation
    this.localHistory = []; // [ { t, x, y, input, deltaTime } ]
  }

  /**
   * Updates the local player's position based on input (Client-Side Prediction).
   */
  updateLocalPlayer(player, input, deltaTime, mapLayout, activeBombs) {
    // Record state before movement for history
    const startState = {
      t: Date.now(),
      x: player.x,
      y: player.y,
      input: { ...input }, // Clone input
      deltaTime: deltaTime,
    };

    this.applyMovement(player, input, deltaTime, mapLayout, activeBombs);

    this.localHistory.push(startState);

    // Keep history manageable (e.g., 1 second)
    const now = Date.now();
    while (this.localHistory.length > 0 && now - this.localHistory[0].t > 1000) {
      this.localHistory.shift();
    }
  }

  applyMovement(player, input, deltaTime, mapLayout, activeBombs) {
    const spd = player.stats?.speed ?? 250;
    let nextX = player.x + input.dx * spd * deltaTime;
    let nextY = player.y + input.dy * spd * deltaTime;

    if (input.dx !== 0) {
      // Horizontal movement with snapping/sliding
      const idealY = Math.round((player.y - OFFSET) / TILE_SIZE) * TILE_SIZE + OFFSET;
      const diff = idealY - player.y;
      if (diff !== 0) {
        const move = Math.sign(diff) * SNAP_SPEED * deltaTime;
        if (Math.abs(move) > Math.abs(diff)) {
          player.y = idealY;
        } else {
          player.y += move;
        }
      }

      if (!this.checkCollision(nextX, player.y, player, mapLayout, activeBombs)) {
        player.x = nextX;
      } else {
        // Corner sliding
        const gp = this.getGridPos(player.x, player.y);
        const cy = gp.row * TILE_SIZE + OFFSET;
        const thresh = TILE_SIZE / 4;
        if (player.y < cy - 5 && player.y > cy - thresh) player.y += spd * deltaTime;
        else if (player.y > cy + 5 && player.y < cy + thresh) player.y -= spd * deltaTime;
      }
    } else if (input.dy !== 0) {
      // Vertical movement with snapping/sliding
      const idealX = Math.round((player.x - OFFSET) / TILE_SIZE) * TILE_SIZE + OFFSET;
      const diff = idealX - player.x;
      if (diff !== 0) {
        const move = Math.sign(diff) * SNAP_SPEED * deltaTime;
        if (Math.abs(move) > Math.abs(diff)) {
          player.x = idealX;
        } else {
          player.x += move;
        }
      }

      if (!this.checkCollision(player.x, nextY, player, mapLayout, activeBombs)) {
        player.y = nextY;
      } else {
        // Corner sliding
        const gp = this.getGridPos(player.x, player.y);
        const cx = gp.col * TILE_SIZE + OFFSET;
        const thresh = TILE_SIZE / 4;
        if (player.x < cx - 5 && player.x > cx - thresh) player.x += spd * deltaTime;
        else if (player.x > cx + 5 && player.x < cx + thresh) player.x -= spd * deltaTime;
      }
    }
  }

  /**
   * Interpolates remote players based on buffered server updates.
   */
  interpolateRemotePlayers(clientPlayers, myPlayerId) {
    const renderTime = Date.now() - this.interpolationDelay;

    Object.keys(clientPlayers).forEach((id) => {
      if (id == myPlayerId) return; // Skip self (predicted)

      const buffer = this.positionBuffers[id];
      if (buffer && buffer.length >= 2) {
        // Find frames surrounding renderTime
        let i = 0;
        while (i < buffer.length - 1 && buffer[i + 1].t < renderTime) {
          i++;
        }
        const t0 = buffer[i];
        const t1 = buffer[i + 1] || buffer[i];

        if (t0.t <= renderTime && t1.t >= renderTime && t0 !== t1) {
          const factor = (renderTime - t0.t) / (t1.t - t0.t);
          clientPlayers[id].x = t0.x + (t1.x - t0.x) * factor;
          clientPlayers[id].y = t0.y + (t1.y - t0.y) * factor;
        } else if (renderTime > t1.t) {
          // Extrapolate
          const prev = buffer[buffer.length - 2];
          if (prev && prev.t !== t1.t) {
            const dt = t1.t - prev.t;
            const vx = (t1.x - prev.x) / dt;
            const vy = (t1.y - prev.y) / dt;
            const extra = renderTime - t1.t;
            clientPlayers[id].x = t1.x + vx * extra;
            clientPlayers[id].y = t1.y + vy * extra;
          } else {
            clientPlayers[id].x = t1.x;
            clientPlayers[id].y = t1.y;
          }
        } else {
          clientPlayers[id].x = t1.x;
          clientPlayers[id].y = t1.y;
        }
      }
    });
  }

  /**
   * Handles incoming server messages for position updates and reconciliation.
   */
  handleServerPosition(player, msg, isLocalPlayer, mapLayout, activeBombs) {
    if (isLocalPlayer) {
      // Look for a point in history where the position matches the server position.
      let matchIndex = -1;
      const threshold = 1.0; // Tolerance

      for (let i = 0; i < this.localHistory.length; i++) {
        const h = this.localHistory[i];
        const dx = Math.abs(h.x - msg.x);
        const dy = Math.abs(h.y - msg.y);
        if (dx < threshold && dy < threshold) {
          matchIndex = i;
          break;
        }
      }

      if (matchIndex !== -1) {
        // Found a match! The server confirms we were here.
        // Discard history older than this match, as it's confirmed.
        this.localHistory.splice(0, matchIndex + 1);
      } else {
        // No match found. We diverged.
        // Snap to server position
        player.x = msg.x;
        player.y = msg.y;

        // 1. Validated divergence.
        // 2. Snap to server position & Replay.

        const originalHistory = [...this.localHistory];
        this.localHistory = []; // Rebuild history

        originalHistory.forEach((h) => {
          // Record state at start of this step (which is the result of previous step)
          const newState = {
            t: h.t,
            x: player.x,
            y: player.y,
            input: h.input,
            deltaTime: h.deltaTime,
          };
          this.localHistory.push(newState);

          this.applyMovement(player, h.input, h.deltaTime, mapLayout, activeBombs);
        });
      }
    } else {
      // Buffer for interpolation
      if (!this.positionBuffers[player.id]) this.positionBuffers[player.id] = [];
      this.positionBuffers[player.id].push({ t: Date.now(), x: msg.x, y: msg.y });

      // Keep buffer small
      if (this.positionBuffers[player.id].length > 10) this.positionBuffers[player.id].shift();
    }
  }

  // --- Collision Helpers ---

  getGridPos(x, y) {
    return {
      col: Math.floor((x + PLAYER_SIZE / 2) / TILE_SIZE),
      row: Math.floor((y + PLAYER_SIZE / 2) / TILE_SIZE),
    };
  }

  checkCollision(newX, newY, player, mapLayout, activeBombs) {
    if (this.isSolid(newX, newY, player, mapLayout, activeBombs)) return true;
    if (this.isSolid(newX + PLAYER_SIZE - 1, newY, player, mapLayout, activeBombs)) return true;
    if (this.isSolid(newX, newY + PLAYER_SIZE - 1, player, mapLayout, activeBombs)) return true;
    if (
      this.isSolid(newX + PLAYER_SIZE - 1, newY + PLAYER_SIZE - 1, player, mapLayout, activeBombs)
    )
      return true;
    return false;
  }

  isSolid(x, y, player, mapLayout, activeBombs) {
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    if (row < 0 || row >= mapLayout.length || col < 0 || col >= mapLayout[0].length) return true;
    if (mapLayout[row][col] === 1 || mapLayout[row][col] === 2) return true;

    const bomb = activeBombs.find((b) => b.col === col && b.row === row);
    if (bomb) {
      if (player && this.checkOverlap(player.x, player.y, col, row)) return false;
      return true;
    }
    return false;
  }

  checkOverlap(x, y, tileCol, tileRow) {
    const pRight = x + PLAYER_SIZE;
    const pBottom = y + PLAYER_SIZE;
    const tLeft = tileCol * TILE_SIZE;
    const tRight = tLeft + TILE_SIZE;
    const tTop = tileRow * TILE_SIZE;
    const tBottom = tTop + TILE_SIZE;
    return !(pRight <= tLeft || x >= tRight || pBottom <= tTop || y >= tBottom);
  }
}
