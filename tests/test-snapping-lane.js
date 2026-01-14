import GameEngine from './public/js/game-engine.js';
import { TILE_SIZE, OFFSET } from './public/js/constants.js';

const engine = new GameEngine({ eventHandler: () => {}, usernames: ['p1'] });
engine.init([
  [1, 1],
  [1, 1],
]); // Dummy map

const player = engine.players[0];

// Lane 0 center: 12
// Lane 1 center: 76
// Midpoint: 44
// Tile boundary: 32

// Test case 1: Y = 33.
// Should snap to Lane 0 (12) because 33 is closer to 12 than 76.
// Current buggy logic: round(33/64) = 1 -> Snaps to 76.

player.x = 12;
player.y = 33;

console.log(`Player Y: ${player.y}`);
console.log(`Lane 0 Center: ${0 * TILE_SIZE + OFFSET}`);
console.log(`Lane 1 Center: ${1 * TILE_SIZE + OFFSET}`);

// Move horizontally to trigger vertical snapping
engine.handleInput(0, { dx: 1, dy: 0 });
engine.update(0.016);

console.log(`New Y: ${player.y}`);

if (player.y > 33) {
  console.log('RESULT: Snapped UP towards 76 (WRONG LANE)');
} else {
  console.log('RESULT: Snapped DOWN towards 12 (CORRECT LANE)');
}
