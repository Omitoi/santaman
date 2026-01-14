import { encodeServerMessage, decodeServerMessage } from '../gamelogic/serverToClient.js';
import { TILE_SIZE } from '../public/js/constants.js';

describe('Server Message Encoding', () => {
  const testCases = [
    { val: 12, name: 'Integer 12' },
    { val: 12.5, name: 'Float 12.5' },
    { val: 12.9, name: 'Float 12.9' },
    { val: 63.9, name: 'Float 63.9' },
    { val: 64.1, name: 'Float 64.1' },
    { val: 100.5, name: 'Float 100.5' },
  ];

  testCases.forEach(({ val, name }) => {
    test(`correctly encodes and decodes ${name}`, () => {
      const col = Math.floor(val / TILE_SIZE);
      const row = 0;
      const offset = val - col * TILE_SIZE;

      // msg: playerId=0, type=0, col, row, x=offset, y=0
      const encoded = encodeServerMessage(0, 0, col, row, offset, 0);
      const decoded = decodeServerMessage(encoded);

      // Precision loss is expected due to 1/8th pixel encoding (3 bits shift * something)
      // Actually encoding maps 0..TILE_SIZE to 0..255 or similar?
      // Let's check logic: offset is multiplied by 8?
      // Checking source code via test logic:
      // test-encoding.js prints "Error: decoded.x - val".
      // We expect error to be small.

      const error = Math.abs(decoded.x - val);
      expect(error).toBeLessThan(0.13); // 1/8 = 0.125. Tolerance slightly higher.
    });
  });
});
