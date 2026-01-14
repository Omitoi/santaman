import GameEngine from './public/js/game-engine.js';

const engine = new GameEngine();

// Mock map
const mapTemplate = [
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1],
];

engine.init(mapTemplate);
engine.addPlayer('p1', 'red', 1, 1);

console.log('Placing bomb...');
// Use timestamp > BOMB_COOLDOWN (200ms)
engine.handleInput('p1', { dx: 0, dy: 0, placeBomb: true, timestamp: 1000, deltaTime: 0 });

if (engine.activeBombs.length !== 1) {
  console.error('FAILURE: Bomb not placed.');
  process.exit(1);
}

console.log('Simulating 1 second...');
engine.update(1.0);
if (engine.activeBombs.length !== 1) {
  console.error('FAILURE: Bomb exploded too early.');
  process.exit(1);
}

console.log('Simulating 2.1 seconds (Total 3.1s)...');
engine.update(2.1);

if (engine.activeBombs.length === 0) {
  console.log('SUCCESS: Bomb exploded after time passed!');
} else {
  console.error('FAILURE: Bomb did not explode.');
  console.log('Time left:', engine.activeBombs[0].timeLeft);
  process.exit(1);
}
