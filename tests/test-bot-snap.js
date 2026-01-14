import Bot from '../public/js/bot.js';
import { TILE_SIZE, PLAYER_SIZE } from '../public/js/constants.js';

// Mock Logger
global.document = undefined;

const botId = 'bot1';
const players = {
  [botId]: {
    id: botId,
    x: 100,
    y: 100, // Arbitrary start
    stats: { bombRange: 2, maxBombs: 1, speed: 100 },
    isDead: false,
  },
};

const state = {
  mapLayout: Array(10)
    .fill(0)
    .map(() => Array(10).fill(0)),
  players,
  activeBombs: [],
  activeItems: [],
};

const bot = new Bot(botId);
// Force path
// Target Tile (2, 2).
// TILE_SIZE = 48 (assuming constant).
// TargetX = 2*48 + (48-32)/2 = 96 + 8 = 104.
// TargetY = 104.
bot.targetPath = [{ col: 2, row: 2 }];
bot.mode = 'ATTACK'; // Just need non-IDLE to move
bot.lastPathCalcTime = Date.now(); // Prevent recalc clearing mode

const targetX = 2 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;
const targetY = 2 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;

// Move player CLOSE to target
// Distance 1px
players[botId].x = targetX - 5;
players[botId].y = targetY;

console.log(`Running Bot Input Test...`);
console.log(
  `Start Pos: (${players[botId].x}, ${players[botId].y}). Target: (${targetX}, ${targetY})`
);

// Run update
const input = bot.update(state);
console.log(`Input received: dx=${input.dx}, dy=${input.dy}`);

// Expectation: Bot should move RIGHT (dx=1)
if (input.dx === 1 && input.dy === 0) {
  console.log('SUCCESS: Bot requested move towards target.');
} else {
  console.log('FAILURE: Bot input is incorrect.');
  process.exit(1);
}

// Check for side effects (should NOT allow direct mutation anymore)
if (players[botId].x !== targetX - 5) {
  console.log(
    'WARNING: Bot is still mutating player position directly. Prefer input-based control.'
  );
}
