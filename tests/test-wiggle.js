import GameEngine from './public/js/game-engine.js';
import { mapLayoutTemplate } from './public/js/constants.js';

const mockEventHandler = () => {};
const engine = new GameEngine({ eventHandler: mockEventHandler });
engine.init(mapLayoutTemplate);
const player = engine.players[0];

// Place player at (1,1) but slightly up, clipping into Row 0.
// Row 1 starts at 64.
// Player Y = 60.
// Center Y = 80. Row 1.
player.x = 90; // Close to right edge
player.y = 62;

console.log(`Start: ${player.x}, ${player.y}`);

// Input: UP (dx=0, dy=-1)
const input = { dx: 0, dy: -1, placeBomb: false };
engine.handleInput(0, input);

console.log('Simulating UP...');

let previousY = player.y;
let wiggles = 0;

for (let i = 0; i < 10; i++) {
  engine.update(0.016);
  console.log(`Frame ${i}: Y=${player.y.toFixed(2)}`);

  // Check for wiggle: moving down then up or vice versa?
  // Actually, in a single frame, update() does both.
  // We only see the net result.
  // If Slide moves Down (speed 250), and Input moves Up (speed 250).
  // Net change ~ 0?
  // Or if Slide is conditional?

  // If I am at 60.
  // Slide: 60 < 71. Move Down. +4.
  // Input: Move Up. -4.
  // Net: 60.
  // Player stuck at 60?

  // If I disable slide, I should move Up (-4). Y becomes 56.

  if (player.y >= previousY - 0.01) {
    // We expect to move UP (decrease Y).
    // If Y is constant or increasing, we are stuck/wiggling.
    console.log('STUCK/WIGGLING');
    wiggles++;
  }
  previousY = player.y;
}

if (wiggles > 5) {
  console.log('FAILURE: Player is wiggling/stuck.');
} else {
  console.log('SUCCESS: Player moved UP.');
}
