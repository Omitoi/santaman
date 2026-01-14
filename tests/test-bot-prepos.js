import Bot from '../public/js/bot.js';
import { TILE_SIZE, PLAYER_SIZE } from '../public/js/constants.js';

// Mock Logger
global.document = undefined;

// Mock State
const rows = 10;
const cols = 10;
const mapLayout = Array(rows)
  .fill(0)
  .map(() => Array(cols).fill(0));

// Setup Map
// Target at (5,5).
mapLayout[5][6] = 2; // Crate next to (5,5)

const botId = 'bot1';
const players = {
  [botId]: {
    id: botId,
    x: 1 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2, // At (1,1)
    y: 1 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2,
    stats: { bombRange: 2, maxBombs: 1 },
    isDead: false,
  },
};

// No Bombs, No Items
const state = {
  mapLayout,
  players,
  activeBombs: [{ ownerId: botId, row: 8, col: 8, range: 2 }], // 1 active bomb means "maxBombs: 1" is reached -> canBomb = false
  activeItems: [],
};

const bot = new Bot(botId);
// Bot starts in ATTACK mode by default in constructor,
// let's force it to IDLE to test the transition logic
bot.mode = 'IDLE';

console.log('Running Pre-positioning Test...');
console.log(`Bot at (1,1). Target valid at (5,5). canBomb=false (1 active bomb).`);

bot.update(state); // Should switch to ATTACK to go to (5,5)

console.log(`Bot Mode: ${bot.mode}`);
if (bot.mode === 'ATTACK') {
  // Check path
  const targetNode = bot.targetPath[bot.targetPath.length - 1];
  if (targetNode && targetNode.col === 5 && targetNode.row === 5) {
    console.log('SUCCESS: Bot switched to ATTACK to pre-position at (5,5)');
  } else {
    console.log(`FAILURE: Bot is in ATTACK but path target is ${JSON.stringify(targetNode)}`);
    process.exit(1);
  }
} else {
  console.log(`FAILURE: Bot did not switch to ATTACK. Mode: ${bot.mode}`);
  process.exit(1);
}
