import Bot from '../public/js/bot.js';

// Mock Logger
global.document = undefined;

const mapLayout = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 2, 2, 2, 2, 2, 1],
  [1, 2, 1, 0, 1, 2, 1],
  [1, 2, 0, 0, 0, 2, 1],
  [1, 2, 1, 0, 1, 2, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1],
];

const TILE_SIZE = 64;
const PLAYER_SIZE = 40;

const botId = 'bot1';
// Bot at Col 3, Row 5
// x = 3 * 64 + (64-40)/2 = 192 + 12 = 204
// y = 5 * 64 + 12 = 320 + 12 = 332
const startX = 3 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;
const startY = 5 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;

const players = {
  [botId]: {
    id: botId,
    x: startX,
    y: startY,
    stats: { bombRange: 2, maxBombs: 1, speed: 250 },
    isDead: false,
  },
};

const state = {
  mapLayout,
  players,
  activeBombs: [],
  activeItems: [],
};

const bot = new Bot(botId, { useItems: true, smart: true, difficulty: 10 });

console.log('Running Smart Targeting Test...');
console.log(`Map size: ${mapLayout[0].length}x${mapLayout.length}`);
console.log(`Bot pos: col 3, row 5`);

// 1. Refresh maps to parse layout
bot.refreshMaps(state);

// 2. Check reachability of (3,3)
const tiles = bot.getReachableTiles(3, 5);
const t33 = tiles.find((t) => t.col === 3 && t.row === 3);
if (t33) {
  console.log(`Target (3,3) is reachable. Dist: ${t33.dist}`);
} else {
  console.error('Target (3,3) is NOT reachable!');
}

// 3. Check Safety of (3,3)
const safe = bot.isSafeToPlace(3, 3, 2);
console.log(`Safety check for (3,3): ${safe ? 'SAFE' : 'UNSAFE'}`);

// 4. Check Impact of (3,3)
const impact = bot.calcImpact(3, 3, 2, mapLayout);
console.log(`Calculated impact for (3,3): ${impact}`);

// 5. Run findBestTarget
const best = bot.findBestTarget(3, 5, 2, state);
if (best) {
  console.log(`Best Target Found: (${best.col}, ${best.row}) Score: ${best.score}`);
  if (best.col === 3 && best.row === 3) {
    console.log('SUCCESS: Bot selected correct target (3,3).');
  } else {
    console.log('FAILURE: Bot selected wrong target.');
    process.exit(1);
  }
} else {
  console.log('FAILURE: No target found.');
  process.exit(1);
}
