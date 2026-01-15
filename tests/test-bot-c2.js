
import Bot from '../public/js/bot.js';

// Mock Logger
global.document = undefined; 
const TILE_SIZE = 64; 
const PLAYER_SIZE = 40;

// Setup Map 15x11
// Bot C2 starts at (13, 9) (Bottom Right corner area)
// 15 cols (0-14), 11 rows (0-10).
// (13, 9) is Row 9, Col 13.
// Surroundings:
// Row 9: [..., 11=Crate, 12=Empty, 13=Empty, 14=Wall]
// Row 8: [..., 11=Wall, 12=Wall, 13=Empty, 14=Wall] ?
// Let's check template.
// Row 9 (index 9) is same as Row 1 (index 1)? 
// Template is 13 rows? User file says 11x15 or 15x11.
// game-engine.js says:
// export const mapLayoutTemplate = [ ... 11 rows ... ]
// Row 9: [1, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 1]
// Col 13 is 0 (Empty).
// Col 12 is 0 (Empty).
// Col 11 is 2 (Crate).
// Col 14 is 1 (Wall).

// Row 8: [1, 0, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 1]
// Col 13 is 0 (Empty).
// Col 12 is 1 (Wall). (Wait, row 8 is even, col 12 is even -> Wall? Yes).
// Col 11 is 2 (Crate).

// Row 7: [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1]
// Col 13 is 2 (Crate).

// So, setup:
// (13, 9) Empty. (Start).
// (12, 9) Empty.
// (11, 9) Crate.
// (13, 8) Empty.
// (12, 8) Wall.
// (13, 7) Crate.

// Expected:
// Move to (13, 9) (Stay). Place Bomb.
// Impact: Left -> (12, 9) -> (11, 9) Crate. (1 Hit).
// Impact: Up -> (13, 8) -> (13, 7) Crate. (1 Hit).
// Total: 2 Crates.

// "Bad" Move:
// Move to (12, 9). Place Bomb.
// Impact: Left -> (11, 9) Crate. (1 Hit).
// Impact: Up -> (12, 8) Wall. (0 Hit).
// Impact: Right -> (13, 9) Empty. (0 Hit).
// Impact: Down -> (12, 10). Row 10 is [1, 0...]. Col 12 is 0. Empty.
// Total: 1 Crate.

// Why would bot choose (12, 9) (Score ~30) over (13, 9) (Score ~60)?

const mapLayout = Array(11).fill(0).map(() => Array(15).fill(0));

// Fill based on standard template + logic above
for(let r=0; r<11; r++) {
    for(let c=0; c<15; c++) {
        mapLayout[r][c] = 0;
        if (r===0 || r===10 || c===0 || c===14) mapLayout[r][c] = 1; // Borders
    }
}

// Custom setup around C2 - Second Bomb Scenario
// First layer cleared: (11, 9) and (13, 7) are now 0 (Empty)
mapLayout[9][13] = 0; // Bot Start
mapLayout[9][12] = 0; // Empty
mapLayout[9][11] = 0; // Cleared Crate -> Empty
mapLayout[7][13] = 0; // Cleared Crate -> Empty

// Second layer exposed:
mapLayout[9][10] = 2; // Crate deeper left
mapLayout[8][11] = 2; // Crate deeper up (at col 11, row 8)
mapLayout[10][11] = 1; // Wall (Border)

mapLayout[8][13] = 0;
mapLayout[8][12] = 1; // Wall

// Bot 2
const botId = "bot2";
const startX = 13 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;
const startY = 9 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;

const players = {
    [botId]: {
        id: botId,
        x: startX,
        y: startY,
        stats: { bombRange: 2, maxBombs: 1, speed: 250 },
        isDead: false
    }
};

const state = {
    mapLayout,
    players,
    activeBombs: [],
    activeItems: []
};

// Mode Smart
const bot = new Bot(botId, { useItems: true, smart: true, difficulty: 10 });
bot.refreshMaps(state);

console.log("Running C2 Second Bomb Test...");
console.log("Bot at (13,9). Range 2.");
console.log("Scenario: Immediate crates cleared. Target is deeper.");

// Analysis:
// Target A: (11, 9).
// Neighbors: (10,9 Crate), (12,9 Empty), (11,8 Crate), (11,10 Wall).
// Impact: (10,9) + (11,8) = 2 Crates.
// Safety: Escape to (12,9) -> (13,9) -> (13,8).
// Distance: 2 moves.

// Target B: (12, 9).
// Neighbors: (11,9 Empty), (13,9 Empty), (12,8 Wall), (12,10 Wall).
// Impact: Left -> (11,9 Empty) -> (10,9 Crate). = 1 Crate.
// Safety: Escape to (13,9).
// Distance: 1 move.

const impact11_9 = bot.calcImpact(11, 9, 2, mapLayout);
console.log(`Impact (11,9): ${impact11_9}`);

const impact12_9 = bot.calcImpact(12, 9, 2, mapLayout);
console.log(`Impact (12,9): ${impact12_9}`);

const safe11_9 = bot.isSafeToPlace(11, 9, 2);
console.log(`Safety (11,9): ${safe11_9}`);

const best = bot.findBestTarget(13, 9, 2, state);

if (best) {
    console.log(`Best Target: (${best.col}, ${best.row}) Score: ${best.score}`);
    if (best.col === 11 && best.row === 9) {
        console.log("SUCCESS: Bot chose (11,9)"); 
    } else if (best.col === 12 && best.row === 9) {
        console.log("FAILURE: Bot chose (12,9) - The shallow target");
    } else {
        console.log(`FAILURE: Bot chose (${best.col}, ${best.row})`);
    }
} else {
    console.log("FAILURE: No target found");
}
