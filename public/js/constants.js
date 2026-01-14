// Exact pixel coordinates are communicated between server and client
// Do not increase tile size beyond 64.
export const TILE_SIZE = 64;
export const PLAYER_SIZE = 40;
export const SNAP_SPEED = 150;
export const OFFSET = (TILE_SIZE - PLAYER_SIZE) / 2;
export const BOMB_TIMER = 3000;
export const BOMB_COOLDOWN = 200;

export const ITEM_PROB = 0.45;
export const ITEM_TYPES = [
  { type: 'speed', chance: 0.15, class: 'item-speed' },
  { type: 'range', chance: 0.15, class: 'item-range' },
  { type: 'bomb', chance: 0.15, class: 'item-bomb' },
  { type: 'death', chance: 0.01, class: 'item-death' },
];

// Map locations are communicated together with tile sublocations
// Currently supports maps up to 16x16 (the below is 11x15).
export const mapLayoutTemplate = [
  // Template to restore from
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 1],
  [1, 0, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 0, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 1],
  [1, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];
