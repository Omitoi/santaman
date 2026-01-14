import {
  TILE_SIZE,
  PLAYER_SIZE,
  OFFSET,
  BOMB_TIMER,
  BOMB_COOLDOWN,
  SNAP_SPEED,
  ITEM_TYPES,
  ITEM_PROB,
} from './constants.js';

import { ServerToClientMessageType } from '../gamelogic/serverToClient.js';
import { logger } from './logger.js';

export default class GameEngine {
  constructor({ eventHandler, usernames, onGameOver }) {
    // Communications callback used to send messages about game state
    this.eventHandler = eventHandler;
    this.onGameOver = onGameOver;

    this.mapLayout = [];
    this.players = {};
    this.activeBombs = [];
    this.activeItems = [];
    this.isGameOver = false;
    this.gameStartTime = 0;
    this.addPlayers(usernames);
    this.isPaused = false;
    this.pauseTimestamp = null;
  }

  init(mapTemplate) {
    this.mapLayout = mapTemplate.map((row) => [...row]);
    this.activeBombs = [];
    this.activeItems = [];
    this.isGameOver = false;
    this.gameStartTime = Date.now();

    // Reset players
    Object.values(this.players).forEach((p) => {
      p.isDead = false;
      p.x = p.startCol * TILE_SIZE + OFFSET;
      p.y = p.startRow * TILE_SIZE + OFFSET;
      p.lastBombTime = 0;
      // Reset stats to default, but wins persist
      p.stats = { speed: 250, bombRange: 2, maxBombs: 1 };
      // Reset input and movement state
      p.input = { dx: 0, dy: 0 };
      p.wasMoving = false;
    });
    // Make the players stand still at the starting positions
    Object.values(this.players).forEach((p) => {
      const col = Math.floor(p.x / TILE_SIZE);
      const row = Math.floor(p.y / TILE_SIZE);

      this.eventHandler({
        playerId: p.id,
        type: ServerToClientMessageType.STOP_AT,
        col,
        row,
        x: 0,
        y: 0,
      });
    });
  }

  addPlayers(playerConfigs) {
    // defined Order: TL, BR, TR, BL
    const SPAWN_POSITIONS = [
      { col: 1, row: 1 }, // 1st Player (Index 0)
      { col: 13, row: 9 }, // 2nd Player (Index 1)
      { col: 13, row: 1 }, // 3rd Player (Index 2)
      { col: 1, row: 9 }, // 4th Player (Index 3)
    ];

    const COLORS = {
      0: '#e74c3c', // P1 Red
      1: '#3498db', // P2 Blue
      2: '#2ecc71', // P3 Green
      3: '#f1c40f', // P4 Yellow
    };

    // Check if input is new format (Array of Objects) or legacy (Array of Strings)
    const isNewFormat = playerConfigs.length > 0 && typeof playerConfigs[0] === 'object';

    playerConfigs.forEach((config, index) => {
      if (index >= SPAWN_POSITIONS.length) return; // Max 4 players

      const spawn = SPAWN_POSITIONS[index];
      let id, color;

      if (isNewFormat) {
        id = config.id;
        color = COLORS[id] || '#ffffff';
      } else {
        // Legacy/Online: ID is the index
        id = index;
        color = COLORS[index] || '#ffffff';
      }

      this.addPlayer(id, color, spawn.col, spawn.row);
    });
  }

  addPlayer(id, color, col, row) {
    this.players[id] = {
      id: id,
      startCol: col,
      startRow: row,
      x: col * TILE_SIZE + OFFSET,
      y: row * TILE_SIZE + OFFSET,
      color: color,
      isDead: false,
      wins: 0,
      stats: { speed: 250, bombRange: 2, maxBombs: 1 },
      lastBombTime: 0,
      input: { dx: 0, dy: 0 },
      wasMoving: false,
    };
  }

  removePlayer(id) {
    delete this.players[id];
  }

  handleInput(playerId, input) {
    const player = this.players[playerId];
    if (!player || this.isGameOver) return; // Allow dead players to process input

    // Bomb placement (immediate)
    if (input.placeBomb) {
      if (player.isDead) return; // Ghosts cannot place bombs
      this.tryPlaceBomb(player, Date.now());
      // Do not overwrite movement input when placing a bomb
      // The protocol sends discrete events; PLACE_BOMB should not stop the player
      return;
    }

    // Store input for update loop
    player.input = { dx: input.dx, dy: input.dy };
  }

  update(deltaTime) {
    if (this.isPaused || this.isGameOver) return;
    const now = Date.now();

    // Update Players (Movement)
    Object.values(this.players).forEach((player) => {
      const moving = player.input && (player.input.dx !== 0 || player.input.dy !== 0);
      if (moving) {
        this.movePlayer(player, player.input.dx, player.input.dy, deltaTime);
        player.wasMoving = true;
      } else if (player.wasMoving) {
        // Player just stopped. Send one final update with STOP_AT (dx=0, dy=0)
        this.movePlayer(player, 0, 0, deltaTime);
        player.wasMoving = false;
      }
    });

    // Update Bombs
    // Iterate a copy because explodeBomb modifies activeBombs (chain reactions)
    const bombs = [...this.activeBombs];
    for (const bomb of bombs) {
      if (!this.activeBombs.includes(bomb)) continue; // Already exploded

      // Broadcast timer updates to clients
      // Send every 500ms OR when crossing second boundaries for accuracy
      const timeLeft = Math.floor((bomb.explodeAt - now) / 500);
      if (!bomb.lastUpdate || bomb.lastUpdate > timeLeft) {
        bomb.lastUpdate = timeLeft;
        // Send timer update to all clients
        this.eventHandler({
          playerId: bomb.ownerId,
          type: ServerToClientMessageType.BOMB_TIMER_UPDATE,
          col: bomb.col,
          row: bomb.row,
          x: Math.max(0, timeLeft), // timeLeft in 500ms (encoded in x field)
          y: 0,
        });

        this.explodeBomb(bomb);
      }
    }
  }

  movePlayer(player, dx, dy, deltaTime) {
    const spd = player.stats.speed;
    let nextX = player.x + dx * spd * deltaTime;
    let nextY = player.y + dy * spd * deltaTime;

    let moveType = ServerToClientMessageType.STOP_AT;

    if (dx !== 0) {
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

      let collision = false;
      if (player.isDead) {
        // Ghost logic: Check map boundaries only
        if (nextX < OFFSET || nextX > this.mapLayout[0].length * TILE_SIZE + OFFSET - PLAYER_SIZE) {
          collision = true;
        }
      } else {
        collision = this.checkCollision(nextX, player.y, player);
      }

      if (!collision) player.x = nextX;
      else {
        // Corner sliding
        const gp = this.getGridPos(player.x, player.y);
        const cy = gp.row * TILE_SIZE + OFFSET;
        const thresh = TILE_SIZE / 4;
        if (player.y < cy - 5 && player.y > cy - thresh) player.y += spd * deltaTime;
        else if (player.y > cy + 5 && player.y < cy + thresh) player.y -= spd * deltaTime;
      }
      if (dx < 0) {
        moveType = ServerToClientMessageType.START_MOVE_LEFT;
      } else if (dx > 0) {
        moveType = ServerToClientMessageType.START_MOVE_RIGHT;
      }
    } else if (dy !== 0) {
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

      let collision = false;
      if (player.isDead) {
        // Ghost logic: Check map boundaries only
        if (nextY < OFFSET || nextY > this.mapLayout.length * TILE_SIZE + OFFSET - PLAYER_SIZE) {
          collision = true;
        }
      } else {
        collision = this.checkCollision(player.x, nextY, player);
      }

      if (!collision) player.y = nextY;
      else {
        // Corner sliding
        const gp = this.getGridPos(player.x, player.y);
        const cx = gp.col * TILE_SIZE + OFFSET;
        const thresh = TILE_SIZE / 4;
        if (player.x < cx - 5 && player.x > cx - thresh) player.x += spd * deltaTime;
        else if (player.x > cx + 5 && player.x < cx + thresh) player.x -= spd * deltaTime;
      }
      if (dy < 0) {
        moveType = ServerToClientMessageType.START_MOVE_UP;
      } else if (dy > 0) {
        moveType = ServerToClientMessageType.START_MOVE_DOWN;
      }
    }

    // Item Collection
    const pg = this.getGridPos(player.x, player.y);

    // Broadcast new position
    // Use top-left based grid position for message encoding to ensure offsets are positive (0-63)
    const msgCol = Math.floor(player.x / TILE_SIZE);
    const msgRow = Math.floor(player.y / TILE_SIZE);

    this.eventHandler({
      playerId: player.id,
      type: moveType,
      col: msgCol,
      row: msgRow,
      x: player.x - msgCol * TILE_SIZE,
      y: player.y - msgRow * TILE_SIZE,
    });

    const iIdx = this.activeItems.findIndex((i) => i.col === pg.col && i.row === pg.row);

    // Debug collision logic if there are items but no pickup
    if (this.activeItems.length > 0 && Math.random() < 0.05) {
      logger.debug(
        `[COLLISION DEBUG] Player at ${pg.col},${pg.row}. Items: ${this.activeItems.length} (${this.activeItems[0].col},${this.activeItems[0].row})`
      );
    }

    if (iIdx !== -1 && !player.isDead) {
      const item = this.activeItems[iIdx];
      logger.debug(
        `[PICKUP DEBUG] Server detected pickup: ${item.type} at ${item.col},${item.row} by Player ${player.id}`
      );

      if (item.type === 'speed') player.stats.speed = Math.min(600, player.stats.speed + 25);
      if (item.type === 'range') player.stats.bombRange++;
      if (item.type === 'bomb') player.stats.maxBombs++;
      if (item.type === 'death') this.killPlayer(player);

      // Determine item type index (0=speed, 1=range, 2=bomb, 3=death)
      // We can match by object ref or type string
      const typeIdx = ITEM_TYPES.findIndex((t) => t.type === item.type);

      this.activeItems.splice(iIdx, 1);
      this.eventHandler({
        playerId: player.id,
        type: ServerToClientMessageType.PICKUP_ITEM,
        col: item.col,
        row: item.row,
        x: typeIdx, // Send item type index in X field (9 bits available, we need 2)
      });

      // [DEBUG] Log item pickup
      logger.debug(
        `[ITEM DEBUG] Player ${player.id} picked up item type '${item.type}' (index ${typeIdx}) at (${item.col}, ${item.row})`
      );
      logger.debug(
        `  New Stats - Speed: ${player.stats.speed}, Range: ${player.stats.bombRange}, MaxBombs: ${player.stats.maxBombs}`
      );
    }
  }

  tryPlaceBomb(player, timestamp) {
    if (timestamp - player.lastBombTime < BOMB_COOLDOWN) {
      logger.debug('Bomb cooldown reject');
      return;
    }
    const myActiveBombs = this.activeBombs.filter((b) => b.ownerId === player.id);
    if (myActiveBombs.length >= player.stats.maxBombs) {
      logger.debug(`Max bombs reject: ${myActiveBombs.length} >= ${player.stats.maxBombs}`);
      return;
    }

    const gridPos = this.getGridPos(player.x, player.y);
    if (this.activeBombs.some((b) => b.col === gridPos.col && b.row === gridPos.row)) {
      logger.debug(`Bomb overlap reject at ${gridPos.col}, ${gridPos.row}`);
      return;
    }

    const bomb = {
      col: gridPos.col,
      row: gridPos.row,
      ownerId: player.id,
      range: player.stats.bombRange,
      createdAt: timestamp,
      explodeAt: timestamp + BOMB_TIMER,
      lastUpdate: null,
    };

    this.activeBombs.push(bomb);

    // Broadcast new bomb
    this.eventHandler({
      playerId: player.id,
      type: ServerToClientMessageType.PLACE_BOMB_AT,
      col: gridPos.col,
      row: gridPos.row,
    });
    player.lastBombTime = timestamp;
  }

  explodeBomb(bomb) {
    if (!this.activeBombs.includes(bomb)) return;
    this.activeBombs = this.activeBombs.filter((b) => b !== bomb);

    logger.debug(
      `[BOMB DEBUG] 💥 Exploding bomb at (${bomb.col}, ${bomb.row}), range: ${bomb.range}`
    );

    this.eventHandler({
      type: ServerToClientMessageType.EXPLODE_AT,
      col: bomb.col,
      row: bomb.row,
      x: bomb.range, // Pass range in the x field (will be encoded as xOffset)
    });

    this.checkPlayerHit(bomb.col, bomb.row);

    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];
    directions.forEach((dir) => {
      for (let i = 1; i <= bomb.range; i++) {
        const targetCol = bomb.col + dir.dx * i;
        const targetRow = bomb.row + dir.dy * i;
        if (
          targetRow < 0 ||
          targetRow >= this.mapLayout.length ||
          targetCol < 0 ||
          targetCol >= this.mapLayout[0].length
        )
          break;

        const tileType = this.mapLayout[targetRow][targetCol];
        if (tileType === 1) break;
        else if (tileType === 2) {
          this.destroyCrate(targetCol, targetRow);
          this.checkPlayerHit(targetCol, targetRow);
          break;
        } else {
          const hitBomb = this.activeBombs.find((b) => b.col === targetCol && b.row === targetRow);
          if (hitBomb) {
            // Chain reaction: explode immediately
            logger.debug(
              `[BOMB DEBUG] 🔗 Chain reaction! Bomb at (${targetCol}, ${targetRow}) triggered by explosion at (${bomb.col}, ${bomb.row})`
            );
            this.explodeBomb(hitBomb);
          }

          const now = Date.now();
          // Don't thrash items that were just spawned in a chain explosion
          const itemIdx = this.activeItems.findIndex(
            (i) => i.col === targetCol && i.row === targetRow && now - (i.spawnedAt || 0) > 50
          );
          if (itemIdx !== -1) {
            const removedItem = this.activeItems.splice(itemIdx, 1)[0];
            this.eventHandler({
              playerId: 0, // playerId is irrelevant for removal
              type: ServerToClientMessageType.REMOVE_ITEM,
              col: removedItem.col,
              row: removedItem.row,
              x: 0,
              y: 0,
            });
          }

          this.checkPlayerHit(targetCol, targetRow);
        }
      }
    });

    // Notify listeners (renderer) about explosion
    if (this.onExplosion) {
      this.onExplosion(bomb.col, bomb.row, bomb.range);
    }
  }

  destroyCrate(col, row) {
    this.mapLayout[row][col] = 0;
    this.eventHandler({
      type: ServerToClientMessageType.CLEAR_AT,
      col: col,
      row: row,
    });
    // Drop Loot
    if (Math.random() < ITEM_PROB) {
      const rand = Math.random();
      let acc = 0;

      for (const type of ITEM_TYPES) {
        acc += type.chance;
        if (rand < acc) {
          setTimeout(() => {
            this.activeItems.push({ col, row, type: type.type, spawnedAt: Date.now() });
            // Use playerId field to send item type index (0-3)
            const typeIdx = ITEM_TYPES.indexOf(type);
            logger.debug(`[LOOT DEBUG] Selected item: ${type.type} (Index: ${typeIdx})`);
            this.eventHandler({
              playerId: typeIdx, // reusing 2-bit field for type index
              type: ServerToClientMessageType.SPAWN_ITEM,
              col: col,
              row: row,
              x: 0,
              y: 0,
            });
          }, 150); // Show loot after flame animation is finished

          break;
        }
      }
    }
  }

  checkPlayerHit(col, row) {
    Object.values(this.players).forEach((p) => {
      if (p.isDead) return;
      if (this.checkOverlap(p.x, p.y, col, row)) this.killPlayer(p);
    });
  }

  killPlayer(player) {
    player.isDead = true;
    this.eventHandler({
      playerId: player.id,
      type: ServerToClientMessageType.PLAYER_DIED,
      col: 0,
      row: 0,
      x: 0,
      y: 0, // Coordinates don't matter for death
    });
    this.checkWinCondition();
  }

  checkWinCondition() {
    if (this.isGameOver) return;
    const alivePlayers = Object.values(this.players).filter((p) => !p.isDead);

    if (alivePlayers.length <= 1) {
      this.isGameOver = true;
      if (alivePlayers.length === 1) {
        alivePlayers[0].wins++;
      }
      if (this.onGameOver) {
        this.onGameOver(this.getState());
      }
    }
  }

  // Helpers
  getGridPos(x, y) {
    return {
      col: Math.floor((x + PLAYER_SIZE / 2) / TILE_SIZE),
      row: Math.floor((y + PLAYER_SIZE / 2) / TILE_SIZE),
    };
  }

  isSolid(x, y, player = null) {
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    if (row < 0 || row >= this.mapLayout.length || col < 0 || col >= this.mapLayout[0].length)
      return true;
    if (this.mapLayout[row][col] === 1 || this.mapLayout[row][col] === 2) return true;

    const bomb = this.activeBombs.find((b) => b.col === col && b.row === row);
    if (bomb) {
      if (player && this.checkOverlap(player.x, player.y, col, row)) return false;
      return true;
    }
    return false;
  }

  checkCollision(newX, newY, player) {
    if (this.isSolid(newX, newY, player)) return true;
    if (this.isSolid(newX + PLAYER_SIZE - 1, newY, player)) return true;
    if (this.isSolid(newX, newY + PLAYER_SIZE - 1, player)) return true;
    if (this.isSolid(newX + PLAYER_SIZE - 1, newY + PLAYER_SIZE - 1, player)) return true;
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

  getState() {
    return {
      players: this.players,
      activeBombs: this.activeBombs,
      activeItems: this.activeItems,
      mapLayout: this.mapLayout,
      isGameOver: this.isGameOver,
      gameStartTime: this.gameStartTime,
    };
  }

  pause() {
    if (this.isPaused) return;
    this.isPaused = true;
    this.pauseTimestamp = Date.now();
  }

  resume() {
    if (!this.isPaused) return;
    const now = Date.now();
    const pauseDuration = now - this.pauseTimestamp;

    // 1️⃣ Shift every bomb’s timer forward by the amount we were paused
    this.activeBombs.forEach((bomb) => {
      bomb.explodeAt += pauseDuration;
    });

    // 2️⃣ If you keep any other time‑based state (e.g. power‑up timers) do the same here.

    this.isPaused = false;
    this.pauseTimestamp = null;
  }
}
