import { encodeServerMessage, decodeServerMessage } from './gamelogic/serverToClient.js';
const TILE_SIZE = 64;

console.log('Testing encoding for jumps (9-bit precision)...');

let x = 12; // Start position
let lastDecodedX = 12;

for (let i = 0; i < 600; i++) {
  // 600 * 1.5 = 900 < 960
  x += 1.5; // Simulate movement

  const col = Math.floor(x / TILE_SIZE);
  const offset = x - col * TILE_SIZE;

  // Encode
  const encoded = encodeServerMessage(0, 0, col, 0, offset, 0);

  // Decode
  const decoded = decodeServerMessage(encoded);
  const decodedX = decoded.x;

  // Check for jump
  const diff = decodedX - lastDecodedX;

  if (Math.abs(diff) > 30 && i > 0) {
    console.log(`JUMP DETECTED at step ${i}!`);
    console.log(`  x=${x}`);
    console.log(`  col=${col}, offset=${offset}`);
    console.log(`  decodedX=${decodedX}`);
    console.log(`  lastDecodedX=${lastDecodedX}`);
    console.log(`  diff=${diff}`);
  }

  // Check precision
  const error = Math.abs(decodedX - x);
  if (error > 0.125) {
    // Should be within 1/8th pixel
    console.log(`Precision error at step ${i}: ${error}`);
  }

  lastDecodedX = decodedX;
}
console.log('Test complete.');
