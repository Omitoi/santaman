import GameEngine from './public/js/game-engine.js';
import { mapLayoutTemplate } from './public/js/constants.js';

// Initialize Game Engine
const eventHandler = () => {};
const gameEngine = new GameEngine({
  eventHandler,
  usernames: ['p1', 'p2', 'p3', 'p4'],
});

gameEngine.init(mapLayoutTemplate);

// Simulation Loop
const FPS = 60;
const frameTime = 1000 / FPS;
let currentTime = 0;
const maxTime = 5000; // Run for 5 seconds

console.log('Starting simulation...');

// Simulate input for player 1 (moving right)
const input = { dx: 1, dy: 0, placeBomb: false };

while (currentTime < maxTime) {
  // Update engine
  gameEngine.handleInput(0, input);
  gameEngine.update(frameTime / 1000);

  // Log position every second
  if (currentTime % 1000 < frameTime) {
    const p1 = gameEngine.players[0];
    console.log(
      `Time: ${Math.round(currentTime)}ms | P1 Pos: (${p1.x.toFixed(2)}, ${p1.y.toFixed(2)})`
    );
  }

  currentTime += frameTime;
}

console.log('Simulation finished.');
