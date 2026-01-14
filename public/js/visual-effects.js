// visual-effects.js

import { TILE_SIZE } from './constants.js';
/**
 * Creates explosion animations at the given grid position
 * @param {HTMLElement} container - The game container to append to
 * @param {number} col - Grid column
 * @param {number} row - Grid row
 * @param {number} range - Explosion radius in tiles
 */
export function createExplosionVisuals(mapLayout, container, col, row, range) {
  // Create flame at center
  createFlame(container, col, row, 'center');

  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];
  directions.forEach((dir) => {
    for (let i = 1; i <= range; i++) {
      const targetCol = col + dir.dx * i;
      const targetRow = row + dir.dy * i;
      // Check walls? We don't have map state easily accessible unless we keep mapLayout updated.
      // We have mapLayout.
      if (
        targetRow < 0 ||
        targetRow >= mapLayout.length ||
        targetCol < 0 ||
        targetCol >= mapLayout[0].length
      )
        break;
      const tileType = mapLayout[targetRow][targetCol];
      if (tileType === 1) break; // Wall

      let flameType = dir.dx === 0 ? 'horizontal' : 'vertical';

      if (tileType === 2) {
        if (dir.dx === -1) flameType = 'end-left';
        if (dir.dx === 1) flameType = 'end-right';
        if (dir.dy === -1) flameType = 'end-top';
        if (dir.dy === 1) flameType = 'end-bottom';
        createFlame(container, targetCol, targetRow, flameType);
        break;
      }

      // If we reached the end of the range, draw the end of the flame.
      if (i === range && dir.dx === -1) flameType = 'end-left';
      if (i === range && dir.dx === 1) flameType = 'end-right';
      if (i === range && dir.dy === -1) flameType = 'end-top';
      if (i === range && dir.dy === 1) flameType = 'end-bottom';

      createFlame(container, targetCol, targetRow, flameType);
    }
  });
}

/**
 * Creates a single flame element
 * @param {HTMLElement} container - The game container
 * @param {number} col - Grid column
 * @param {number} row - Grid row
 * @param {string} flameType - Type of flame ('center', 'horizontal', etc.)
 */
export function createFlame(container, col, row, flameType) {
  const flame = document.createElement('div');
  flame.classList.add('explosion');
  flame.style.width = `${TILE_SIZE}px`;
  flame.style.height = `${TILE_SIZE}px`;
  flame.style.left = `${col * TILE_SIZE}px`;
  flame.style.top = `${row * TILE_SIZE}px`;
  flame.style.position = 'absolute';

  // Add sprite
  flame.classList.add(flameType);

  container.appendChild(flame);
  setTimeout(() => {
    if (flame.parentNode) flame.parentNode.removeChild(flame);
  }, 500);
}

/**
 * Creates a single map tile element
 * @param {HTMLElement} container - The game container
 * @param {number} x - Pixel X position
 * @param {number} y - Pixel Y position
 * @param {string} type - Tile type ('wall', 'crate')
 * @returns {HTMLElement} The created tile element
 */
export function createTile(container, x, y, type) {
  const tile = document.createElement('div');
  tile.classList.add('tile');
  tile.style.width = `${TILE_SIZE}px`;
  tile.style.height = `${TILE_SIZE}px`;
  tile.style.left = `${x}px`;
  tile.style.top = `${y}px`;
  tile.style.position = 'absolute';

  // Add sprite
  tile.classList.add(type);

  container.appendChild(tile);
  return tile;
}
