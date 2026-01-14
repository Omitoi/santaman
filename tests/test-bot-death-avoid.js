import Bot from '../public/js/bot.js';
import { TILE_SIZE, PLAYER_SIZE } from '../public/js/constants.js';

// Mock Logger
global.document = undefined;

// Mock State
const rows = 4;
const cols = 3;
const mapLayout = Array(rows)
  .fill(0)
  .map(() => Array(cols).fill(0));

// Setup Walls to force a single corridor
// C 0 C
// W . W
// W . W
// W . W
// Bot at (1,0) (Top Center)
// Target at (1,3) (Bottom Center)

for (let r = 0; r < rows; r++) {
  mapLayout[r][0] = 1; // Left Wall
  mapLayout[r][2] = 1; // Right Wall
}

const botId = 'bot1';
const players = {
  [botId]: {
    id: botId,
    x: 1 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2,
    y: 0 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2,
    stats: { bombRange: 2, maxBombs: 1 },
    isDead: false,
  },
};

const bot = new Bot(botId);

console.log('Running Death Avoidance Test...');

// Scenario 1: Path blocked by Death Item
const stateDeath = {
  mapLayout,
  players,
  activeBombs: [],
  activeItems: [{ row: 1, col: 1, type: 'death' }],
};

console.log("Test 1: Corridor blocked by 'death' item");
const pathDeath = bot.findPath(1, 0, 1, 3, stateDeath);
if (pathDeath.length === 0) {
  console.log('SUCCESS: Path is empty (blocked by death)');
} else {
  console.error(`FAILURE: Bot found path through death: ${JSON.stringify(pathDeath)}`);
  process.exit(1);
}

// Scenario 2: Path open (Speed Item)
const stateSpeed = {
  mapLayout,
  players,
  activeBombs: [],
  activeItems: [{ row: 1, col: 1, type: 'speed' }],
};

console.log("Test 2: Corridor with 'speed' item");
const pathSpeed = bot.findPath(1, 0, 1, 3, stateSpeed);
if (pathSpeed.length > 0) {
  console.log('SUCCESS: Bot found path through speed');
} else {
  console.error('FAILURE: Bot refused to go through speed item');
  process.exit(1);
}
