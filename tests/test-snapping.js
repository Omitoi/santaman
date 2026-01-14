import GameEngine from './public/js/game-engine.js';
import { TILE_SIZE, OFFSET } from './public/js/constants.js';

const engine = new GameEngine({ eventHandler: () => {}, usernames: ['p1'] });
// 3x3 empty map
const map = [
  [1, 1, 1],
  [1, 0, 1],
  [1, 1, 1],
];
engine.init(map);

const player = engine.players[0];
// Center of tile (1,1) is at 1*64 + OFFSET.
// OFFSET = (64 - 40)/2 = 12.
// Center Y = 76.
// Let's place player slightly off-center: 77.5 (1.5px off)
// Ideally it should snap towards 76 smoothly.
// Current logic: if abs(diff) < 2, snap instantly.
// So 77.5 -> 76 instantly.

player.x = 1 * TILE_SIZE + OFFSET;
player.y = 1 * TILE_SIZE + OFFSET + 1.5;

console.log(`Initial Y: ${player.y}`);
console.log(`Ideal Y: ${1 * TILE_SIZE + OFFSET}`);

// Simulate one frame of horizontal movement
// dx = 1, dy = 0
// This triggers the horizontal movement block which contains vertical snapping
engine.handleInput(0, { dx: 1, dy: 0 });

// Update with small delta time
const dt = 0.016; // 16ms
engine.update(dt);

console.log(`Y after 1 frame (dt=${dt}): ${player.y}`);

const diff = player.y - (1 * TILE_SIZE + OFFSET);
console.log(`Difference from ideal: ${diff}`);

if (Math.abs(diff) < 0.001) {
  console.log('RESULT: Snapped instantly (JITTER)');
} else {
  console.log('RESULT: Moved smoothly');
}
