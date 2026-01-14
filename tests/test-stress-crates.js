import GameEngine from './public/js/game-engine.js';

const engine = new GameEngine();

// 10x10 Grid
const size = 10;
const map = [];
for (let r = 0; r < size; r++) {
  const row = [];
  for (let c = 0; c < size; c++) {
    if (r === 0 || r === size - 1 || c === 0 || c === size - 1)
      row.push(1); // Walls
    else row.push(2); // Crates everywhere
  }
  map.push(row);
}

engine.init(map);
engine.addPlayer('p1', 'red', 1, 1);
engine.players['p1'].stats.maxBombs = 100;
engine.players['p1'].stats.bombRange = 10;

console.log('Setup: 10x10 Grid full of crates.');

// Place random bombs to stress it.
const bombCount = 10;
console.log(`Placing ${bombCount} random bombs...`);

for (let i = 0; i < bombCount; i++) {
  // Find a crate to replace with a bomb
  let r, c;
  do {
    r = Math.floor(Math.random() * (size - 2)) + 1;
    c = Math.floor(Math.random() * (size - 2)) + 1;
  } while (engine.mapLayout[r][c] !== 2);

  engine.mapLayout[r][c] = 0; // Clear crate for bomb
  engine.players['p1'].x = c * 64 + 12;
  engine.players['p1'].y = r * 64 + 12;
  engine.players['p1'].lastBombTime = 0;
  engine.handleInput('p1', { dx: 0, dy: 0, placeBomb: true, timestamp: 1000, deltaTime: 0 });
}

console.log(`Active Bombs: ${engine.activeBombs.length}`);

console.log('Simulating explosions...');
engine.update(3.1);

console.log(`Remaining Bombs: ${engine.activeBombs.length}`);

// Verification
let failures = 0;
if (engine.activeBombs.length > 0) {
  console.error('FAILURE: Bombs remaining.');
  failures++;
}

console.log('Logic Stress Test Complete.');
if (failures === 0) console.log('SUCCESS: Logic seems consistent.');
