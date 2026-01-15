
import Bot from '../public/js/bot.js';

// Mock Logger
global.document = undefined; 
const TILE_SIZE = 64; 
const PLAYER_SIZE = 40;

// Setup Map
// 7x7 Map
const mapLayout = Array(7).fill(0).map(() => Array(7).fill(0));
// Walls
for(let i=0; i<7; i++) {
    mapLayout[0][i] = 1;
    mapLayout[6][i] = 1;
    mapLayout[i][0] = 1;
    mapLayout[i][6] = 1;
}

// Bot at (3, 3) (Center)
const botId = "bot1";
const startX = 3 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;
const startY = 3 * TILE_SIZE + (TILE_SIZE - PLAYER_SIZE) / 2;

// Scenario:
// Target 1: Crate at (3, 1) (Up). Path is clear. 
// Target 2: Crate at (3, 5) (Down). Path is clear. 
// Item at (3, 4) (Between Bot and Crate 2).
// Placing bomb at (3, 3) with range 2 hits both? 
// No, let's make the bot choose a placement.

// Bot is at (3,3). 
// Crate A at (3, 1). Distance 2. Impact 1.
// Crate B at (1, 3). Distance 2. Impact 1.
// Item at (2, 3) (Between Bot and Crate B).
// If bot places at (3,3), Range 2.
// Up: Hits Crate A.
// Left: Hits Item (destroyed) then Crate B.

// Note: calcImpact counts crates. Does it stop at items?
// Currently calcImpact in bot.js loops:
// if (layout[r][c] === 2) { crates++; break; }
// It ignores items (layout usually doesn't have items, state.activeItems has them).

// So, if we place at (3,3):
// Up impact: 1 Crate.
// Left impact: 1 Crate.
// Total impact 2.

// But Left direction hits an item at (2,3).
// We want the bot to NOT place here if it destroys an item?
// Or we want the bot to find a better spot?

// Let's force a choice between two spots.
// Spot A: (3, 2). Hits Crate at (3, 1). Safe. Item loss = 0.
// Spot B: (2, 3). Hits Crate at (1, 3). Safe. Item loss = 1 (The item is at 2,3 - wait, if I stand on it I picked it up?).
// Let's put the item at (1, 2).
// Bot at (2, 2).
// Crate 1 at (2, 0).
// Crate 2 at (0, 2).
// Item at (1, 2) (Left of bot).
// Bomb at (2, 2) hits Crate 1 (Up) and Crate 2 (Left).
// Left blast goes through (1, 2) [Item] -> Hits (0, 2) [Crate].
// Item destroyed.

// Alternate Spot?
// Maybe the bot shouldn't bomb from (2,2) if it destroys the item?
// But if it's the only spot...
// Let's give it a choice. 
// Two identical setups.
// Side Right: Crate at (6, 2) -> (Target 4, 2).
// Side Down: Crate at (2, 6) -> (Target 2, 4).
// Let's keep it simple.

// Bot at (3,3).
// Direction Up: Crate at (3,1). Distance 2.
// Direction Down: Crate at (3,5). Distance 2.
// Item at (3,4).
// If bot bombs at (3,4) (Down 1), it picks up item? Yes.
// If bot bombs at (3,3) (Center). 
// Range 2.
// Up: hits (3,1) Crate.
// Down: hits (3,4) Item, then (3,5) Crate.
// Destroyed Item count = 1.

// Ideally bot should prefer Up?
// Or maybe it should go pick up the item first?
// If MODE_COLLECT is on, it might go for item.
// But findBestTarget is for ATTACK.

// We want to test findBestTarget logic specifically.
mapLayout[1][3] = 2; // Crate Up
mapLayout[5][3] = 2; // Crate Down

const players = {
    [botId]: {
        id: botId,
        x: startX,
        y: startY,
        stats: { bombRange: 2, maxBombs: 1, speed: 250 },
        isDead: false
    }
};

const items = [
    { type: 'speed', col: 3, row: 4 } // Item Down
];

const state = {
    mapLayout,
    players,
    activeBombs: [],
    activeItems: items 
};

// Config useItems: true
const bot = new Bot(botId, { useItems: true, smart: true, difficulty: 10 });
bot.refreshMaps(state);

console.log("Running Item Avoidance Test...");
console.log("Bot at (3,3). Range 2.");
console.log("Up: Crate at (3,1).");
console.log("Down: Item at (3,4), Crate at (3,5).");

// Current Logic check
// Impact Up: 1 Crate
// Impact Down: 1 Crate (Assuming items don't block impact calc, which they shouldn't as itemMap is separate)
// Total Impact at (3,3) is 2.

// However, we want to Penalize the fact that Down destroys an item.
// So if we have another target that gives same impact but NO item destruction, we should take it?
// Or if we calculate 'score' for (3,3), it should be lower than if no item was there.

// Let's simulate two potential target TILES.
// Tile A: (3, 2). Neighbors (3,1) Crate. Impact 1.
// Tile B: (3, 4). Neighbors (3,5) Crate. Impact 1.
// Wait, if (3,4) has an item, walking there picks it up. That's GOOD.
// The penalty should be for BLOWING UP an item.
// i.e. The item is in the blast radius, but NOT at the player's position (or player places bomb before pickup?)
// If player is at (3,3) and drops bomb. (3,4) item is destroyed.
// If player walks to (3,4), item is picked up. Then drops bomb. Item saved.

// So, target (3,3) -> Destroys item at (3,4).
// Target (3,2) -> Safe.
// Target (3,4) -> Pick up item (Good), then safe.

// Let's see what findBestTarget returns for (3,3).
// If we penalize item destruction, (3,3) score should decrease.

// Let's just run findBestTarget from (3,3).
// Be careful: (3,3) itself is a target.
// (3,2) is a target.
// (3,4) is a target.

const best = bot.findBestTarget(3, 3, 2, state);

if (best) {
    console.log(`Best Target: (${best.col}, ${best.row}) Score: ${best.score}`);
    
    // Check if we calculate item loss
    const loss = bot.calcItemLoss ? bot.calcItemLoss(best.col, best.row, 2, state.mapLayout) : "N/A";
    console.log(`Item Loss for chosen target: ${loss}`);

    // We expect the bot to NOT choose (3,3) if it destroys the item?
    // Or at least, if we compare (3,2) vs (3,3) (assuming (3,3) hits both crates?)
    // Wait, (3,3) hits 2 crates. (3,2) hits 1 crate (Up).
    // Impact 2 (Score ~60) vs Impact 1 (Score ~30).
    // Even with penalty, Impact 2 is strong.
    // Penalty needs to be BIG. "Big penalty" requested.
    // Ensure penalty > 30 (Value of 1 crate).
    
    // If penalty is 50. (3,3) Score = 60 - 50 = 10.
    // (3,2) Score = 30 - 0 = 30.
    // So (3,2) should win.
    
    // If we assume (3,3) is chosen currently (Score ~60).
    // After fix, (3,2) or (3,4) should be chosen.
} 
