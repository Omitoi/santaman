import Bot from '../public/js/bot.js';

// Mock Logger
global.document = undefined;
const TILE_SIZE = 64;
const PLAYER_SIZE = 40;

// Create a scenario where the bot is at (13, 1) (Top Right)
// It places a bomb at (13, 1) hitting nothing/little.
// Ideal spot is (11, 1) (Two cols left).
// Map Layout (partial representation for test)
// 0 = Empty, 1 = Wall, 2 = Crate
const mapLayout = Array(15)
  .fill(0)
  .map(() => Array(15).fill(0));

// Fill boundaries
for (let i = 0; i < 15; i++) {
  mapLayout[0][i] = 1;
  mapLayout[14][i] = 1;
  mapLayout[i][0] = 1;
  mapLayout[i][14] = 1;
}

// Fixed walls pattern (simplified checkerboard)
for (let r = 2; r < 13; r += 2) {
  for (let c = 2; c < 13; c += 2) {
    mapLayout[r][c] = 1;
  }
}

// Bot at (13, 1)
// Let's Put Crates around (11, 1)
// (11, 2) is a Crate? (10, 1) is a Crate?
// Let's say (11, 1) is a junction that hits multiple crates.
mapLayout[1][10] = 2; // Crate left of 11,1
mapLayout[2][11] = 2; // Crate below 11,1 (Note: 2,11 is usually a wall in checkerboard? 11 is odd col, 2 is even row. 11,2 is empty)
// Wait, row 2, col 11. Row 2 is even. Col 11 is odd.
// In standard bomberman, (even, even) are walls.
// (2, 2) Wall. (2, 3) Empty.
// (2, 11) should be empty?
// Let's verify standard layout:
// [1, 2, 2...]
// [1, 2, 1...] row 2. odd cols are walls?
// looking at mapTemplate:
// Row 2 (index 2): [1, 0, 1, 2, 1 ... ] -> Col 2 is 1 (Wall). Col 3 is 2 (Crate).
// So (even, even) are walls.
// (2, 11) -> Row 2 (even), Col 11 (odd). This should be a WALL if pattern holds?
// No, mapTemplate row 2: [1, 0, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 1]
// Indices:
// 0: Wall
// 1: Empty
// 2: Wall
// 3: Crate
// ...
// 10: Wall (because 10 is even)
// 11: Crate
// 12: Wall
// 13: Empty
// 14: Wall

// Okay, so at Row 1 (Empty Row): (13,1) is empty. (12,1) is empty. (11,1) is empty.
// At (11,1):
// Left: (10,1) -> Row 1, Col 10. Map says: Row 1 is [1, 0, 0, 2, 2, 2...].
// Actually let's just make sure (11,1) is a specific good spot.
// Let's place crates at:
// (11, 2) -> Row 2, Col 11. mapTemplate[2][11] is '2' (Crate)?
// Row 2: 1,0,1,2,1,2,1,2,1,2,1,2,1,0,1
// 0,1,2,3,4,5,6,7,8,9,0,1,2,3,4
// Col 11 is '2' (Crate) in the template!
// So (11,1) hits (11,2).

// What about (13,1)?
// Hits (13,2)?
// Row 2, Col 13 is '0' (Empty) in template.
// So (13,1) hits NOTHING downwards.
// (12,1)? Row 1 is empty.

// So:
// Bot at (13,1).
// (13,2) is Empty.
// (14,1) is Wall.
// (13,0) is Wall.
// (12,1) is Empty.
// (11,1) is Empty.
// (11,2) is Crate.

// So (13,1) hits 0 crates.
// (11,1) hits 1 crate (at 11,2).
// With range 2:
// (13,1) -> Left to (11,1)? No, (12,1) is empty. (11,1) is empty. (10,1) is Crate?
// Map Row 1: 1,0,0,2,2,2,2,2,2,2,2,2,0,0,1
// Indices:   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4
// Col 10 is '2' (Crate).
// Col 11 is '2' (Crate).
// Wait, mapTemplate[1] (Row 1) has crates at 3,4,5,6,7,8,9,10,11.
// So (11,1) is a Crate??
// If (11,1) is a Crate, the bot cannot stand there.

// Ah, maybe the user's map is different.
// The user says "ideal placement should be two columns to the left".
// This implies the bot CAN walk there.
// So (11,1) must be empty.

// Let's construct a test map matching this logic:
// Row 1: [1, 0, 0, 0, 0... 0, 0, 0, 1] -> Top corridor empty.
// Row 2: [1, 2, 1, 2, 1... 2, 1, 0, 1]
// Bot at (13,1).
// If we put a crate at (11,2), then (11,1) hits it.
// If we put a crate at (9,1) and range is 2. (11,1) hits it?
// (10,1) is empty. (9,1) is crate.
// Then (11,1) hits (9,1).

// Case 1:
// Bot at (13,1).
// Crates at (11,2) and (9,1).
// (13,1) hits nothing.
// (11,1) hits (11,2) and (9,1).

mapLayout[1].fill(0);
mapLayout[1][0] = 1;
mapLayout[1][14] = 1;
mapLayout[1][9] = 2; // Crate at (9,1)

mapLayout[2].fill(0);
mapLayout[2][11] = 2; // Crate at (11,2)
mapLayout[2][13] = 0; // Empty below start

const botId = 'bot1';
const startX = 13 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;
const startY = 1 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;

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
// Mock refreshMaps to ensure Bot has the map
bot.refreshMaps(state);

console.log('Running Bad Placement Test...');
console.log('Bot at (13,1). Expected Target: (11,1)');

// Check Impact of (13,1)
const impactCurrent = bot.calcImpact(13, 1, 2, mapLayout);
console.log(`Impact at (13,1): ${impactCurrent}`); // Should be 0

// Check Impact of (11,1)
const impactIdeal = bot.calcImpact(11, 1, 2, mapLayout);
console.log(`Impact at (11,1): ${impactIdeal}`); // Should be 2 (Crate at 9,1 and 11,2?)
// (11,1) -> Left 1: (10,1) Empty. Left 2: (9,1) Crate. -> Hits 1
// (11,1) -> Down 1: (11,2) Crate. -> Hits 1
// Total 2.

// Check Safety of (11,1)
const safeIdeal = bot.isSafeToPlace(11, 1, 2);
console.log(`Safety at (11,1): ${safeIdeal}`);

const best = bot.findBestTarget(13, 1, 2, state);
if (best) {
  console.log(`Best Target: (${best.col}, ${best.row}) Score: ${best.score}`);
  if (best.col === 11 && best.row === 1) {
    console.log('SUCCESS: Bot chose (11,1)');
  } else {
    console.log('FAILURE: Bot chose wrong target');
    process.exit(1);
  }
} else {
  console.log('FAILURE: No target found');
  process.exit(1);
}
