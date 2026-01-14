import GameEngine from './public/js/game-engine.js';

const engine = new GameEngine();

// Stress Test: Grid of Crates and Bombs
// 5x5 grid of crates.
// Bombs everywhere.

const size = 15;
const map = [];
for (let r = 0; r < size; r++) {
  const row = [];
  for (let c = 0; c < size; c++) {
    if (r === 0 || r === size - 1 || c === 0 || c === size - 1)
      row.push(1); // Walls
    else if (r % 2 === 0 && c % 2 === 0)
      row.push(1); // Pillars
    else row.push(2); // Crates everywhere else
  }
  map.push(row);
}

engine.init(map);
engine.addPlayer('p1', 'red', 1, 1);
engine.players['p1'].stats.maxBombs = 100;
engine.players['p1'].stats.bombRange = 5;

// Place bombs in a pattern to trigger massive chains
console.log('Placing massive bomb grid...');
for (let r = 1; r < size - 1; r++) {
  for (let c = 1; c < size - 1; c++) {
    if (map[r][c] === 2 && Math.random() < 0.2) {
      // Replace crate with bomb (and empty space)
      engine.mapLayout[r][c] = 0;
      engine.players['p1'].x = c * 64 + 12;
      engine.players['p1'].y = r * 64 + 12;
      engine.players['p1'].lastBombTime = 0;
      engine.handleInput('p1', { dx: 0, dy: 0, placeBomb: true, timestamp: 1000, deltaTime: 0 });
    }
  }
}

console.log(`Placed ${engine.activeBombs.length} bombs.`);

console.log('Simulating explosion...');
engine.update(3.1);

console.log('Remaining Bombs:', engine.activeBombs.length);
console.log('Checking for inconsistencies...');

if (engine.activeBombs.length > 0) {
  console.error('FAILURE: Not all bombs exploded.');
} else {
  console.log('SUCCESS: All bombs exploded.');
}
