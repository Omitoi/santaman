import GameEngine from './public/js/game-engine.js';
import { BOMB_TIMER } from './public/js/constants.js';

const mockEventHandler = () => {};
const usernames = ['p1'];
const engine = new GameEngine({ eventHandler: mockEventHandler, usernames });

// Mock map
const mapTemplate = [
  [1, 1, 1],
  [1, 0, 1],
  [1, 1, 1],
];

engine.init(mapTemplate);

console.log(`BOMB_TIMER is: ${BOMB_TIMER}`);

// Place Bomb
engine.handleInput(0, { dx: 0, dy: 0, placeBomb: true });
// Update to process bomb placement
engine.update(0.016);

if (engine.activeBombs.length === 0) {
  console.error('Bomb failed to place');
  process.exit(1);
}

const bomb = engine.activeBombs[0];
console.log(`Bomb placed. TimeLeft: ${bomb.timeLeft}`);

// Simulate 1 second
let elapsed = 0;
const dt = 0.033; // 33ms
let ticks = 0;

while (engine.activeBombs.length > 0) {
  engine.update(dt);
  elapsed += dt;
  ticks++;
  if (ticks % 30 === 0) {
    console.log(`Elapsed: ${elapsed.toFixed(2)}s, TimeLeft: ${bomb.timeLeft.toFixed(2)}`);
  }
  if (elapsed > 5) {
    console.error("Bomb didn't explode in 5 seconds");
    break;
  }
}

console.log(`Bomb exploded after ${elapsed.toFixed(2)}s`);

if (elapsed < 2.5) {
  console.log('FAILURE: Bomb exploded too early!');
} else if (elapsed > 3.5) {
  console.log('FAILURE: Bomb exploded too late!');
} else {
  console.log('SUCCESS: Bomb exploded at expected time.');
}
