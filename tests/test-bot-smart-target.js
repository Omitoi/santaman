import Bot from '../public/js/bot.js';
import { TILE_SIZE, PLAYER_SIZE } from '../public/js/constants.js';

// Mock Logger
global.document = undefined; // Ensure Node env behavior

// Mock State
const rows = 10;
const cols = 10;
const mapLayout = Array(rows)
  .fill(0)
  .map(() => Array(cols).fill(0));

// Setup Map
// Crate A Setup: Crate at (1,3). Target Spot (1,2).
// Bot at (1,1). Move to (1,2) -> Dist 1.
// Bomb at (1,2) hits (1,3). Impact 1.
mapLayout[3][1] = 2;

// Cluster B Setup: Cluster around (5,5).
// Crates at (4,5), (6,5), (5,6).
// Target Spot (5,5). Dist from (1,1) = |5-1|+|5-1| = 8.
// Impact 3.
mapLayout[4][5] = 2;
mapLayout[6][5] = 2;
mapLayout[5][6] = 2;

const botId = 'bot1';
const players = {
  [botId]: {
    id: botId,
    x: 1 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2,
    y: 1 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2,
    stats: { bombRange: 2, maxBombs: 1 },
    isDead: false,
  },
};

const state = {
  mapLayout,
  players,
  activeBombs: [],
  activeItems: [],
};

const bot = new Bot(botId);

console.log('Running FindBestTarget Test...');
const target = bot.findBestTarget(1, 1, state, 2); // myCol=1, myRow=1, range=2

if (!target) {
  console.error('FAILED: No target found');
  process.exit(1);
}

console.log(
  `Target Found: (${target.col}, ${target.row}) Score: ${target.score} Impact: ${target.impact} Dist: ${target.dist}`
);

// Expected: (5,5)
// Score A: (1 * 10) - 1 = 9
// Score B: (3 * 10) - 8 = 22
// B should win.

if (target.col === 5 && target.row === 5) {
  console.log('SUCCESS: Bot chose Cluster B at (5,5)');
} else {
  // Check if it picked A
  if (target.col === 1 && target.row === 2) {
    console.error('FAILED: Bot chose Crate A (local minimum) instead of Cluster B');
  } else {
    console.error(`FAILED: Bot chose unexpected target (${target.col}, ${target.row})`);
  }
  process.exit(1);
}
