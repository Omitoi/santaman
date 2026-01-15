
import GameEngine from '../public/js/game-engine.js';
import Bot from '../public/js/bot.js';
import { ServerToClientMessageType } from '../gamelogic/serverToClient.js';

// Mock Logger
global.document = undefined; 
const TILE_SIZE = 64; 
const PLAYER_SIZE = 40;

const mapLayoutTemplate = Array(15).fill(0).map(() => Array(15).fill(0));
// Setup a simple box
for(let r=0; r<15; r++) {
    for(let c=0; c<15; c++) {
        if (r===0||r===14||c===0||c===14) mapLayoutTemplate[r][c] = 1; 
    }
}

// Scenario:
// Bot at (2, 2).
// Crate at (2, 3) (Right).
// Bomb placed at (2, 2). Explodes.
// Crate at (2, 3) should be destroyed.
// Bot should calculate Impact 0 afterwards.

mapLayoutTemplate[2][2] = 0; // Bot/Bomb
mapLayoutTemplate[2][3] = 2; // Crate

const botId = "bot1"; // Strings vs Numbers? GameEngine uses what passed.
const playerConfigs = [
    { id: botId, name: 'Bot', isBot: true, config: { smart: true } }
];

// Mock event handler
const events = [];
const eventHandler = (e) => {
    events.push(e);
};

const gameEngine = new GameEngine({
    eventHandler,
    usernames: playerConfigs
});

gameEngine.init(mapLayoutTemplate);

// Verify initial state
let state = gameEngine.getState();
const p = state.players[botId] || state.players[0]; // ID mismatch? names vs ids
// GameEngine uses index as ID if usernames array passed?
// usernames: [{id: 'bot1', ...}]
// GameEngine constructor: 
// Object.keys(usernames).forEach... if array passed?
// Let's check state.players keys.
const pid = Object.keys(state.players)[0];
const player = state.players[pid];

// Force position to (2,2)
player.x = 2 * TILE_SIZE;
player.y = 2 * TILE_SIZE;

console.log(`Player moved to (${player.x}, ${player.y}) -> Grid (2,2)`);
console.log(`Initial Crate at (2,3): ${state.mapLayout[2][3]}`); // Should be 2

// Init Bot
const bot = new Bot(botId, { smart: true, useItems: true, difficulty: 10 });

// Bot checks impact at (2,2)
bot.refreshMaps(state);
let impact = bot.calcImpact(2, 2, 2, state.mapLayout);
console.log(`Initial Impact at (2,2): ${impact}`); // Should be 1

if (impact !== 1) {
    console.log("FAILURE: Initial impact wrong.");
    process.exit(1);
}

// Place Bomb
gameEngine.handleInput(pid, { dx: 0, dy: 0, placeBomb: true });
gameEngine.tryPlaceBomb(player, Date.now());

state = gameEngine.getState();
if (state.activeBombs.length !== 1) {
    console.log("FAILURE: Bomb not placed.");
    process.exit(1);
}

const bomb = state.activeBombs[0];
console.log(`Bomb placed at (${bomb.col}, ${bomb.row})`);

// Fast forward to explosion
const explodeTime = bomb.explodeAt;
// We can manually call explode or simulate update.
// Let's call explodeBomb directly to control precise flow
gameEngine.explodeBomb(bomb);

// Check Map Update
state = gameEngine.getState();
console.log(`Post-Explosion Crate at (2,3): ${state.mapLayout[2][3]}`);

if (state.mapLayout[2][3] !== 0) {
    console.log("FAILURE: Crate was not destroyed in GameEngine map!");
} else {
    console.log("SUCCESS: Crate destroyed in GameEngine map.");
}

// Check Bot Perception
bot.refreshMaps(state);
impact = bot.calcImpact(2, 2, 2, state.mapLayout);
console.log(`Post-Explosion Impact at (2,2): ${impact}`);

if (impact !== 0) {
    console.log("FAILURE: Bot still sees impact!");
    process.exit(1);
} else {
    console.log("SUCCESS: Bot sees 0 impact.");
}
