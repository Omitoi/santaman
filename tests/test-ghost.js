import GameEngine from './public/js/game-engine.js';

const engine = new GameEngine();

// 5x5 Grid
const map2 = [
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1], // (1, 1) Empty
  [1, 0, 0, 0, 1], // (1, 2) Empty
  [1, 0, 0, 0, 1], // (1, 3) Empty
  [1, 0, 2, 0, 1], // (1, 4) Crate
  [1, 1, 1, 1, 1],
];
engine.init(map2);
engine.addPlayer('p1', 'red', 1, 1);
engine.players['p1'].stats.maxBombs = 10;
engine.players['p1'].stats.bombRange = 5;

// Track explosions
const explosions = [];
engine.onExplosion = (col, row, range) => {
  explosions.push({ col, row, range });
  console.log(`Explosion callback at (${col}, ${row})`);
};

// Bomb A at (1, 1)
engine.players['p1'].x = 1 * 64 + 12;
engine.players['p1'].y = 1 * 64 + 12;
engine.players['p1'].lastBombTime = 0;
engine.handleInput('p1', { dx: 0, dy: 0, placeBomb: true, timestamp: 1000, deltaTime: 0 });

// Bomb B at (1, 2)
engine.players['p1'].x = 1 * 64 + 12;
engine.players['p1'].y = 2 * 64 + 12;
engine.players['p1'].lastBombTime = 0;
engine.handleInput('p1', { dx: 0, dy: 0, placeBomb: true, timestamp: 1000, deltaTime: 0 });

// Bomb C at (1, 3)
engine.players['p1'].x = 1 * 64 + 12;
engine.players['p1'].y = 3 * 64 + 12;
engine.players['p1'].lastBombTime = 0;
engine.handleInput('p1', { dx: 0, dy: 0, placeBomb: true, timestamp: 1000, deltaTime: 0 });

console.log(`Active Bombs before update: ${engine.activeBombs.length}`);
console.log('Simulating...');
engine.update(3.1);

console.log(`Explosions: ${explosions.length}`);
if (explosions.length !== 3) {
  console.error('FAILURE: Missing explosion callback.');
}

// Check Crate at (1, 4)
if (engine.mapLayout[4][1] !== 0) {
  console.error('FAILURE: Crate not destroyed.');
} else {
  console.log('SUCCESS: Crate destroyed.');
}
