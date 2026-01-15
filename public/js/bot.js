import { TILE_SIZE, PLAYER_SIZE, BOMB_COOLDOWN } from './constants.js';
import { logger } from './logger.js';

// Bot Modes
const MODE_IDLE = 'IDLE';
const MODE_ATTACK = 'ATTACK';
const MODE_PLACE_BOMB = 'PLACE_BOMB';
const MODE_FLEE = 'FLEE';
const MODE_COLLECT = 'COLLECT';

const DIRECTIONS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

export default class Bot {
  constructor(id, config) {
    this.id = id;
    this.mode = MODE_ATTACK;
    this.prevMode = null;
    this.targetPath = [];
    this.lastPathCalcTime = 0;
    this.placeReady = false;

    this.config = config || { useItems: true, smart: true, difficulty: 5 };
    logger.debug(`[Bot ${this.id}] Initialized. Config: ${JSON.stringify(this.config)}`);
    this.logicUpdateInterval = Math.floor(500 - (this.config.difficulty - 1) * (400 / 9));
    this.lastLogicTime = 0;

    this.solidMap = null;
    this.dangerMap = null;
    this.itemMap = null;
    this.rows = 0;
    this.rows = 0;
    this.cols = 0;

    this.lastPos = { x: 0, y: 0 };
    this.stuckFrames = 0;
  }

  update(state) {
    const player = state.players[this.id];
    if (!player || player.isDead || state.isGameOver) return { dx: 0, dy: 0, placeBomb: false };

    const myCol = Math.floor((player.x + PLAYER_SIZE / 2) / TILE_SIZE);
    const myRow = Math.floor((player.y + PLAYER_SIZE / 2) / TILE_SIZE);
    const now = Date.now();

    this.refreshMaps(state);

    if (now - this.lastLogicTime > this.logicUpdateInterval) {
      this.lastLogicTime = now;
      this.decideState(player, myCol, myRow, state, now);
    }

    let placeBomb = false;
    if (this.mode === MODE_PLACE_BOMB) {
      if (this.canPlaceBomb(player, state)) {
        placeBomb = true;
        this.placeReady = false;
        this.changeMode(MODE_FLEE);
        this.targetPath = [];
      } else {
        this.changeMode(MODE_IDLE);
      }
    }

    let dx = 0;
    let dy = 0;
    if (this.targetPath.length > 0) {
      const move = this.followPath(player, state);
      dx = move.dx;
      dy = move.dy;

      // Stuck Detection
      const movedDist = Math.abs(player.x - this.lastPos.x) + Math.abs(player.y - this.lastPos.y);
      if ((dx !== 0 || dy !== 0) && movedDist < 1) {
        this.stuckFrames++;
        if (this.stuckFrames > 10) {
          // Approx 160ms stuck
          logger.debug(`[Bot ${this.id}] Stuck! Resetting path.`);
          this.targetPath = [];
          this.changeMode(MODE_IDLE); // Force re-evaluation
          dx = 0;
          dy = 0;
          this.stuckFrames = 0;
        }
      } else {
        this.stuckFrames = 0;
      }
      this.lastPos = { x: player.x, y: player.y };

      // Safety check: is next step dangerous?
      if (this.mode !== MODE_FLEE && this.targetPath.length > 0) {
        const next = this.targetPath[0];
        if (this.dangerMap[next.row][next.col]) {
          this.targetPath = [];
          this.changeMode(MODE_IDLE);
          dx = 0;
          dy = 0;
        }
      }
    } else {
      this.stuckFrames = 0;
      // Passive Snapping: If strictly IDLE or waiting, ensure we are centered to avoid hitbox clipping
      if (this.mode === MODE_IDLE || this.mode === MODE_PLACE_BOMB) {
        const tx = myCol * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;
        const ty = myRow * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;
        const dxRaw = tx - player.x;
        const dyRaw = ty - player.y;

        // If off-center > 2px, drift to center
        if (Math.abs(dxRaw) > 2 || Math.abs(dyRaw) > 2) {
          if (Math.abs(dxRaw) > Math.abs(dyRaw)) dx = Math.sign(dxRaw);
          else dy = Math.sign(dyRaw);
        }
      }
    }

    return { dx, dy, placeBomb };
  }

  changeMode(newMode) {
    if (this.mode !== newMode) {
      logger.debug(`[Bot ${this.id}] ${this.mode} -> ${newMode}`);
      this.prevMode = this.mode;
      this.mode = newMode;
    }
  }

  decideState(player, col, row, state, now) {
    // High Priority: Escape Danger
    if (this.dangerMap[row][col] && this.mode !== MODE_FLEE) {
      this.changeMode(MODE_FLEE);
      this.targetPath = [];
      this.placeReady = false; // ABORT BOMBING if forced to flee
    }

    switch (this.mode) {
      case MODE_IDLE:
        this.updateIdle(player, col, row, state);
        break;
      case MODE_FLEE:
        this.updateFlee(col, row, now);
        break;
      case MODE_COLLECT:
        this.updateCollect(col, row, now);
        break;
      case MODE_ATTACK:
        this.updateAttack(player, col, row, state, now);
        break;
    }
  }

  updateIdle(player, col, row, state) {
    // Pre-place check
    if (this.placeReady && this.canPlaceBomb(player, state)) {
      // Verify safety again before committing
      if (this.isSafeToPlace(col, row, player.stats.bombRange)) {
        this.changeMode(MODE_PLACE_BOMB);
        return;
      } else {
        this.placeReady = false;
      }
    }

    if (this.config.useItems) {
      const item = this.findBestItem(col, row);
      if (item) {
        this.targetPath = this.findPath(col, row, item.col, item.row);
        if (this.targetPath.length > 0) {
          this.changeMode(MODE_COLLECT);
          return;
        }
      }
    }

    this.findTargetAndMove(player, col, row, state);
  }

  updateFlee(col, row, now) {
    if (this.targetPath.length === 0 || now - this.lastPathCalcTime > 500) {
      this.targetPath = this.findPathToSafety(col, row);
      this.lastPathCalcTime = now;
    }
    if (!this.dangerMap[row][col] && this.targetPath.length === 0) {
      this.changeMode(MODE_IDLE);
    }
  }

  updateCollect(col, row, now) {
    if (this.targetPath.length === 0 || now - this.lastPathCalcTime > 500) {
      const item = this.findBestItem(col, row);
      if (item) {
        this.targetPath = this.findPath(col, row, item.col, item.row);
        this.lastPathCalcTime = now;
      } else {
        this.changeMode(MODE_IDLE);
      }
    }
  }

  updateAttack(player, col, row, state, now) {
    if (this.targetPath.length === 0 || now - this.lastPathCalcTime > 1000) {
      this.findTargetAndMove(player, col, row, state);
      this.lastPathCalcTime = now;
    }

    let shouldBomb = false;

    if (this.config.smart) {
      // Smart Check: Do we have impact from here?
      const impact = this.calcImpact(col, row, player.stats.bombRange, state.mapLayout);
      const hitsP = this.hitsPlayer(col, row, player.stats.bombRange, state);
      if (hitsP || (this.targetPath.length === 0 && impact > 0)) shouldBomb = true;
    } else {
      // Basic Check: Adjacency
      if (this.isNearTarget(col, row, state)) shouldBomb = true;
    }

    if (shouldBomb) {
        if (this.isSafeToPlace(col, row, player.stats.bombRange)) {
            this.placeReady = true;
            this.changeMode(MODE_IDLE); // Go to IDLE to execute placement next frame
        } else {
            // Unsafe target.
            // If we are boxed in by TEMPORARY danger (blocked by blasts or other bombs), we should WAIT.
            // If we are boxed in by PERMANENT walls/crates, waiting won't help (unless we are stuck forever).
            if (this.isBlockedByDanger(col, row, state)) {
                // Stay in ATTACK mode (Wait)
                // logger.debug(`[Bot ${this.id}] Boxed in by danger. Waiting...`);
                return;
            }

            // Otherwise, give up and find a new target
            logger.debug(`[Bot ${this.id}] Target reached but UNSAFE to place bomb.`);
            this.changeMode(MODE_IDLE);
        }
    }
  }

  findTargetAndMove(player, col, row, state) {
    let target = this.config.smart
      ? this.findBestTarget(col, row, player.stats.bombRange, state)
      : this.findRandomTarget(col, row, player.stats.bombRange, state);

    if (target) {
      if (target.col === col && target.row === row) {
        this.placeReady = true;
        if (this.mode !== MODE_IDLE) this.changeMode(MODE_IDLE);
      } else {
        this.targetPath = this.findPath(col, row, target.col, target.row);
        if (this.targetPath.length > 0) {
          logger.debug(`[Bot ${this.id}] Targeting (${target.col},${target.row})`);
          this.changeMode(MODE_ATTACK);
        }
      }
    } else {
      if (this.mode === MODE_ATTACK) this.changeMode(MODE_IDLE);
    }
  }

  followPath(player) {
    if (this.targetPath.length === 0) return { dx: 0, dy: 0 };

    const next = this.targetPath[0];
    const tx = next.col * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;
    const ty = next.row * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;

    const dxRaw = tx - player.x;
    const dyRaw = ty - player.y;

    if (Math.abs(dxRaw) <= 2 && Math.abs(dyRaw) <= 2) {
      this.targetPath.shift();
      if (this.targetPath.length > 0) {
        return this.followPath(player);
      }
      return { dx: 0, dy: 0 };
    }

    if (Math.abs(dxRaw) > Math.abs(dyRaw)) {
      return { dx: Math.sign(dxRaw), dy: 0 };
    } else {
      return { dx: 0, dy: Math.sign(dyRaw) };
    }
  }

  canPlaceBomb(player, state) {
    const active = state.activeBombs.filter((b) => b.ownerId === this.id).length;
    if (active >= player.stats.maxBombs) return false;
    // Check cooldown to avoid spamming and getting stuck in placement loop
    const now = Date.now();
    if (now - player.lastBombTime < BOMB_COOLDOWN) return false;

    return true;
  }

  refreshMaps(state) {
    const rows = state.mapLayout.length;
    const cols = state.mapLayout[0].length;
    this.rows = rows;
    this.cols = cols;

    if (!this.solidMap || this.solidMap.length !== rows || this.solidMap[0].length !== cols) {
      this.solidMap = Array(rows)
        .fill(0)
        .map(() => Array(cols).fill(false));
      this.dangerMap = Array(rows)
        .fill(0)
        .map(() => Array(cols).fill(false));
      this.itemMap = Array(rows)
        .fill(0)
        .map(() => Array(cols).fill(null));
    } else {
      for (let r = 0; r < rows; r++) {
        this.solidMap[r].fill(false);
        this.dangerMap[r].fill(false);
        this.itemMap[r].fill(null);
      }
    }

    this.layout = state.mapLayout;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (state.mapLayout[r][c] !== 0) {
          // 1=Wall, 2=Crate
          this.solidMap[r][c] = true;
        }
      }
    }
    for (const bomb of state.activeBombs) {
      this.solidMap[bomb.row][bomb.col] = true;
      this.markDanger(bomb.row, bomb.col, bomb.range, state.mapLayout);
    }
    for (const item of state.activeItems) {
      this.itemMap[item.row][item.col] = item.type;
      if (item.type === 'death') {
        this.dangerMap[item.row][item.col] = true;
        this.solidMap[item.row][item.col] = true;
      }
    }
  }

  isSafeToPlace(col, row, range) {
    // Simulate bomb placement and check for escape path
    const undoList = [];
    const markDanger = (c, r) => {
      if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
        undoList.push({ c, r, d: this.dangerMap[r][c] });
        this.dangerMap[r][c] = true;
      }
    };
    const markSolid = (c, r) => {
      if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
        undoList.push({ c, r, s: this.solidMap[r][c] });
        this.solidMap[r][c] = true;
      }
    };

    markSolid(col, row);
    markDanger(col, row);

    // Blast Radius
    for (const d of DIRECTIONS) {
      for (let i = 1; i <= range; i++) {
        const r = row + d.dy * i;
        const c = col + d.dx * i;
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) break;
        if (this.layout[r][c] === 1) break; // Wall stops blast

        markDanger(c, r); // Mark danger

        if (this.layout[r][c] === 2) break; // Crate stops blast
      }
    }

    const path = this.findPathToSafety(col, row);

    // Revert
    for (const u of undoList) {
      if (u.d !== undefined) this.dangerMap[u.r][u.c] = u.d;
      if (u.s !== undefined) this.solidMap[u.r][u.c] = u.s;
    }

    return path.length > 0;
  }

  markDanger(row, col, range, layout) {
    this.dangerMap[row][col] = true;
    for (const d of DIRECTIONS) {
      for (let i = 1; i <= range; i++) {
        const r = row + d.dy * i;
        const c = col + d.dx * i;
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) break;
        if (layout[r][c] === 1) break;
        this.dangerMap[r][c] = true;
        if (layout[r][c] === 2) break;
      }
    }
  }

  // BFS Utils

  bfs(sc, sr, goalFn, limit, avoidDanger = false) {
    const queue = [{ col: sc, row: sr, path: [] }];
    const visited = new Set([sc + ',' + sr]);
    let i = 0;
    while (queue.length > 0 && i++ < limit) {
      const curr = queue.shift();
      if (goalFn(curr.col, curr.row)) return curr.path;

      for (const d of DIRECTIONS) {
        const nc = curr.col + d.dx;
        const nr = curr.row + d.dy;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          const key = nc + ',' + nr;
          if (!visited.has(key)) {
            const solid = this.solidMap[nr][nc];
            const danger = this.dangerMap[nr][nc];
            if (!solid && (!avoidDanger || !danger)) {
              visited.add(key);
              queue.push({ col: nc, row: nr, path: [...curr.path, { col: nc, row: nr }] });
            }
          }
        }
      }
    }
    return [];
  }

  findPathToSafety(col, row) {
    return this.bfs(col, row, (c, r) => !this.dangerMap[r][c], 1000);
  }

  findPath(sc, sr, tc, tr) {
    return this.bfs(sc, sr, (c, r) => c === tc && r === tr, 1000, true);
  }

  findBestItem(col, row) {
    // Specialized BFS for finding closest item
    const queue = [{ col, row }];
    const visited = new Set([col + ',' + row]);
    let i = 0;
    while (queue.length && i++ < 1000) {
      const curr = queue.shift();
      const type = this.itemMap[curr.row][curr.col];
      if (type && type !== 'death') return curr;

      for (const d of DIRECTIONS) {
        const nc = curr.col + d.dx;
        const nr = curr.row + d.dy;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          const key = nc + ',' + nr;
          if (!visited.has(key)) {
            if (!this.solidMap[nr][nc] && !this.dangerMap[nr][nc]) {
              visited.add(key);
              queue.push({ col: nc, row: nr });
            }
          }
        }
      }
    }
    return null;
  }

  getReachableTiles(col, row) {
    const queue = [{ col, row, dist: 0 }];
    const visited = new Set([col + ',' + row]);
    const reach = [];
    let i = 0;
    while (queue.length && i++ < 500) {
      const curr = queue.shift();
      reach.push(curr);
      for (const d of DIRECTIONS) {
        const nc = curr.col + d.dx;
        const nr = curr.row + d.dy;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          const key = nc + ',' + nr;
          if (!visited.has(key) && !this.solidMap[nr][nc] && !this.dangerMap[nr][nc]) {
            visited.add(key);
            queue.push({ col: nc, row: nr, dist: curr.dist + 1 });
          }
        }
      }
    }
    return reach;
  }

  findBestTarget(col, row, range, state) {
    const tiles = this.getReachableTiles(col, row);
    let best = null;
    for (const t of tiles) {
      // We used to check isNearTarget here, but that only checked adjacency (range 1).
      // Smart bots should check if they can hit anything from here using their full range.

      // 1. Calculate potential Score impact
      const impact = this.calcImpact(t.col, t.row, range, state.mapLayout); // Crates
      const hitsP = this.hitsPlayer(t.col, t.row, range, state); // Players

      if (impact === 0 && !hitsP) continue;

      // 2. Safety Check
      if (!this.isSafeToPlace(t.col, t.row, range)) continue;

      const openNeighbors = this.countOpenNeighbors(t.col, t.row, state.mapLayout);
      let penalty = 0;
      
      // 3. Item Preservation Check
      if (this.config.useItems) {
         const destroyedItems = this.calcItemLoss(t.col, t.row, range, state.mapLayout);
         penalty += destroyedItems * 50; // Big penalty for destroying items
      }

      // Score: Impact (very high), Openness (low), Distance (penalty)
      // Hitting a player is critical (100)
      // Hitting a crate is high (30)
      // Open neighbors are minor convenience (1)
      const baseScore = impact * 30 + (hitsP ? 100 : 0);
      const score = baseScore + openNeighbors - t.dist * 5 - penalty;

      // Debug significant candidates
      if (score > 20) {
          logger.debug(`[Bot ${this.id}] [Loc:${col},${row}] Candidate (${t.col},${t.row}) Score: ${score} (Imp:${impact} Pen:${penalty} Dist:${t.dist})`);
          if (impact > 0) {
             // scan neighbors
             const neighbors = [];
             for(const d of DIRECTIONS) {
                 const nr = t.row + d.dy;
                 const nc = t.col + d.dx;
                 if (nr>=0 && nr<this.rows && nc>=0 && nc<this.cols) {
                     neighbors.push(`(${nc},${nr})=${state.mapLayout[nr][nc]}`);
                 }
             }
             logger.debug(`[Bot ${this.id}]   Impact Source? Neighbors: ${neighbors.join(', ')}`);
          }
      }

      if (!best || score > best.score) best = { ...t, score };
    }
    return best;
  }

  countOpenNeighbors(col, row, layout) {
    let count = 0;
    for (const d of DIRECTIONS) {
      const nr = row + d.dy;
      const nc = col + d.dx;
      if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
        if (layout[nr][nc] === 0) count++;
      }
    }
    return count;
  }

  findRandomTarget(col, row, range, state) {
    const tiles = this.getReachableTiles(col, row);
    tiles.sort((a, b) => a.dist - b.dist);
    for (const t of tiles) {
      const impact = this.calcImpact(t.col, t.row, range, state.mapLayout);
      const hitsP = this.hitsPlayer(t.col, t.row, range, state);

      if (impact > 0 || hitsP) {
        if (this.isSafeToPlace(t.col, t.row, range)) return t;
      }
    }
    return null;
  }

  isBlockedByDanger(col, row, state) {
    let safeMoves = 0;
    let blockedByDanger = false;

    for (const d of DIRECTIONS) {
      const nc = col + d.dx;
      const nr = row + d.dy;
      if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
        const isSolid = this.solidMap[nr][nc];
        const isDanger = this.dangerMap[nr][nc];
        const isBomb = state.activeBombs.some(b => b.col === nc && b.row === nr);
        
        if (!isSolid && !isDanger) {
            safeMoves++;
        }

        // If blocked by danger (blast) or a bomb (solid but temporary), it's waitable
        if (isDanger || isBomb) {
            blockedByDanger = true;
        }
      }
    }

    // We are "Blocked By Danger" if we have NO safe moves, AND at least one blockage is temporary.
    return safeMoves === 0 && blockedByDanger;
  }

  isNearTarget(col, row, state) {
    const layout = state.mapLayout;
    for (const d of DIRECTIONS) {
      const nr = row + d.dy;
      const nc = col + d.dx;
      if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
        if (layout[nr][nc] === 2) return true; // Crate

        // Check Players
        for (const key in state.players) {
          const p = state.players[key];
          if (p.id === this.id || p.isDead) continue;
          const pCol = Math.floor((p.x + PLAYER_SIZE / 2) / TILE_SIZE);
          const pRow = Math.floor((p.y + PLAYER_SIZE / 2) / TILE_SIZE);
          if (pCol === nc && pRow === nr) return true;
        }
      }
    }
    return false;
  }

  calcImpact(col, row, range, layout) {
    let crates = 0;
    for (const d of DIRECTIONS) {
      for (let i = 1; i <= range; i++) {
        const r = row + d.dy * i;
        const c = col + d.dx * i;
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) break;
        if (layout[r][c] === 1) break;
        if (layout[r][c] === 2) {
          crates++;
          break;
        }
      }
    }
    return crates;
  }

  calcItemLoss(col, row, range, layout) {
    let lost = 0;
    for (const d of DIRECTIONS) {
      for (let i = 1; i <= range; i++) {
        const r = row + d.dy * i;
        const c = col + d.dx * i;
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) break;
        if (layout[r][c] === 1) break; // Wall
        if (layout[r][c] === 2) break;

        // Check if there is an active item here
        const itemType = this.itemMap[r][c];
        if (itemType && itemType !== 'death') lost++;
      }
    }
    return lost;
  }

  hitsPlayer(col, row, range, state) {
    for (const d of DIRECTIONS) {
      for (let i = 1; i <= range; i++) {
        const r = row + d.dy * i;
        const c = col + d.dx * i;
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) break;
        const cell = state.mapLayout[r][c];
        if (cell === 1) break;
        if (cell === 2) break; // Crate blocks check for player behind it

        // Check players at this cell
        for (const key in state.players) {
          const p = state.players[key];
          if (p.id === this.id || p.isDead) continue;
          const pCol = Math.floor((p.x + PLAYER_SIZE / 2) / TILE_SIZE);
          const pRow = Math.floor((p.y + PLAYER_SIZE / 2) / TILE_SIZE);
          if (pCol === c && pRow === r) return true;
        }
      }
    }
    return false;
  }
}
