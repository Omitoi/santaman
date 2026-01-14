import GameEngine from './public/js/game-engine.js';

const mockEventHandler = () => {};
const usernames = ['p1'];
const engine = new GameEngine({ eventHandler: mockEventHandler, usernames });

// Empty map
const mapTemplate = [
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1],
];

engine.init(mapTemplate);
const player = engine.players[0];

// Center player at (1,1)
player.x = 76;
player.y = 76;

console.log(`Start: ${player.x}, ${player.y}`);

// Move Right for a bit
engine.handleInput(0, { dx: 1, dy: 0, placeBomb: false });
engine.update(0.1);
console.log(`After Move 1: ${player.x}, ${player.y}`);

// Place Bomb AND Move Right
console.log('Placing Bomb...');
engine.handleInput(0, { dx: 0, dy: 0, placeBomb: true });
engine.update(0.016);

// Now Move DOWN while inside bomb
console.log('Moving DOWN inside bomb...');
const startY = player.y;
engine.handleInput(0, { dx: 0, dy: 1, placeBomb: false });

for (let i = 0; i < 10; i++) {
  engine.update(0.016);
}
console.log(`End Y: ${player.y}`);

if (player.y > startY + 0.1) {
  console.log('SUCCESS: Player moved DOWN inside bomb.');
} else {
  console.log('FAILURE: Player stuck turning.');
}
