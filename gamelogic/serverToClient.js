import { TILE_SIZE } from '../public/js/constants.js';

export const ServerToClientMessageType = {
  STOP_AT: 0,
  START_MOVE_LEFT: 1,
  START_MOVE_RIGHT: 2,
  START_MOVE_UP: 3,
  START_MOVE_DOWN: 4,
  PLACE_BOMB_AT: 5,
  EXPLODE_AT: 6,
  CLEAR_AT: 7,
  PLAYER_DIED: 8,
  SPAWN_ITEM: 9,
  PICKUP_ITEM: 10,
  BOMB_TIMER_UPDATE: 11,
  REMOVE_ITEM: 12,
  // Current maximum for this is 0-15 (4 bits).
};

/**
 * Encode a server‑to‑client message into a Uint8Array (4 bytes).
 *
 * Bit layout (big‑endian, most‑significant bit first):
 *
 * 31 ................. 0
 * ┌─────┬───────┬─────┬─────┬───────┬───────┐
 * │ type │ player │  col │  row │    x   │    y   │
 * │  4   │   2    │  4   │  4   │    6   │    6   │
 * └─────┴───────┴─────┴─────┴───────┴───────┘
 *
 * Total = 26 bits → stored in a 32‑bit word → transmitted as 4 bytes.
 *
 * @param {number} playerId – 0‑3  (2 bits)
 * @param {number} type     – 0‑15 (4 bits)
 * @param {number} col      – 0‑15 (4 bits)
 * @param {number} row      – 0‑15 (4 bits)
 * @param {number} x        – 0‑63 (6 bits)
 * @param {number} y        – 0‑63 (6 bits)
 * @returns {Uint8Array} 4‑byte buffer ready for the wire.
 */
export const encodeServerMessage = function (playerId, type, col, row, x, y) {
  /* ---------- 1️⃣  Clamp / mask each field ---------- */
  playerId = playerId & 0x03; // 2 bits
  type = type & 0x0f; // 4 bits
  col = col & 0x0f; // 4 bits
  row = row & 0x0f; // 4 bits

  // Multiply by 8 to preserve 3 bits of fractional precision
  // 9 bits can store 0..511. Max tile offset is 64. 64*8 = 512.
  x = Math.min(Math.round(x * 8), 511) & 0x1ff; // 9 bits
  y = Math.min(Math.round(y * 8), 511) & 0x1ff; // 9 bits

  const packed = (type << 28) | (playerId << 26) | (col << 22) | (row << 18) | (x << 9) | (y << 0);

  const out = new Uint8Array(4);
  out[0] = (packed >>> 24) & 0xff; // most‑significant byte
  out[1] = (packed >>> 16) & 0xff;
  out[2] = (packed >>> 8) & 0xff;
  out[3] = packed & 0xff; // least‑significant byte

  return out;
};

/**
 * Decode a 4-byte Uint8Array produced by `encodeServerMessage`.
 *
 * @param {Uint8Array} buf – Must be length 4.
 * @returns {{playerId:number,type:number,col:number,row:number,x:number,y:number}}
 */
export const decodeServerMessage = function (buf) {
  if (!(buf instanceof Uint8Array) || buf.length !== 4) {
    throw new Error('decodeServerMessage expects a Uint8Array of length 4');
  }

  // Re‑assemble the 32‑bit word (big‑endian)
  // Use >>> 0 to ensure unsigned 32-bit integer
  const packed = ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) >>> 0;

  // Extract fields
  const yRaw = (packed >>> 0) & 0x1ff; // 9 bits
  const xRaw = (packed >>> 9) & 0x1ff; // 9 bits
  const row = (packed >>> 18) & 0x0f; // 4 bits
  const col = (packed >>> 22) & 0x0f; // 4 bits
  const playerId = (packed >>> 26) & 0x03; // 2 bits
  const type = (packed >>> 28) & 0x0f; // 4 bits

  // Convert back to pixels (divide by 8)
  const xOffset = xRaw / 8;
  const yOffset = yRaw / 8;

  // Convert to the on-screen x and y including tiles
  return {
    playerId,
    type,
    col,
    row,
    x: col * TILE_SIZE + xOffset,
    y: row * TILE_SIZE + yOffset,
    raw: xOffset, // Some messages encode a value in x field
  };
};
