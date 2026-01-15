
import Bot from '../public/js/bot.js';

// Mock Logger
global.document = undefined; 
const TILE_SIZE = 64; 
const PLAYER_SIZE = 40;

// Setup Map 15x13 (Standardish)
// We want to simulate the scenario:
// Bot at (10, 9).
// Target A (Local): (10, 9). Impact: 1 Crate (e.g. at 10, 8). Dist: 0.
// Target B (Distant): (11, 3). Impact: 2 Crates. Dist: ~11.

// Create a mostly empty map
const rows = 13;
const cols = 15;
const mapLayout = Array(rows).fill(0).map(() => Array(cols).fill(0));

// Borders
for(let r=0; r<rows; r++) {
    for(let c=0; c<cols; c++) {
        if (r===0 || r===rows-1 || c===0 || c===cols-1) mapLayout[r][c] = 1;
    }
}

// Bot Position: (10, 9)
// Local Target: (10, 9)
// Needs to hit something. Let's put a crate at (10, 8).
mapLayout[8][10] = 2;

// Distant Target: (11, 3)
// Needs to hit 2 things.
// Let's put crates at (11, 2) and (12, 3).
mapLayout[2][11] = 2;
mapLayout[3][12] = 2;

// Ensure path is clear between (10, 9) and (11, 3).
// (10, 9) -> ... -> (11, 3)
// Just ensure no walls in the way. The map is mostly empty 0s, so it should be fine.

const botId = "botTest";
const startX = 10 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;
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

const bot = new Bot(botId, { useItems: true, smart: true, difficulty: 10 });
bot.refreshMaps(state);

console.log("Running Targeting Test...");
console.log(`Bot at (10, 9). Range 2.`);

// Verify Impact Calculations
const impactLocal = bot.calcImpact(10, 9, 2, mapLayout);
console.log(`Impact Local (10,9): ${impactLocal} (Expected 1)`);

const impactDistant = bot.calcImpact(11, 3, 2, mapLayout);
console.log(`Impact Distant (11,3): ${impactDistant} (Expected 2)`);

// Find Best Target
const best = bot.findBestTarget(10, 9, 2, state);

if (best) {
    console.log(`Best Target: (${best.col}, ${best.row}) Score: ${best.score} Dist: ${best.dist}`);
    
    // We expect the bot to prefer Local (10, 9) over Distant (11, 3)
    if (best.col === 10 && best.row === 9) {
        console.log("SUCCESS: Bot chose local target (10,9)");
    } else if (best.col === 11 && best.row === 3) {
        console.log("FAILURE: Bot chose distant target (11,3)");
    } else {
        console.log(`FAILURE: Bot chose unexpected target (${best.col}, ${best.row})`);
    }
} else {
    console.log("FAILURE: No target found");
}
