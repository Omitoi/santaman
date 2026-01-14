import { jest } from '@jest/globals';
import GameEngine from '../public/js/game-engine.js';

describe('Ghost Character', () => {
  let engine;
  const mapTemplate = [
    [1, 1, 1, 1, 1],
    [1, 0, 1, 0, 1], // Wall in the middle at (2,1)
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
  ];

  beforeEach(() => {
    engine = new GameEngine({
      eventHandler: jest.fn(),
      usernames: ['p1', 'p2'],
    });
    engine.init(mapTemplate);
    engine.init(mapTemplate);
  });

  test('dead player should become a ghost', () => {
    const player = engine.players['0'];
    engine.killPlayer(player);
    expect(player.isDead).toBe(true);
  });

  test('ghost should be able to move through walls', () => {
    const player = engine.players['0'];
    engine.killPlayer(player);
    engine.isGameOver = false; // Force game to continue for test

    const startX = player.x;

    // Try to move Right into the wall at (2,1)
    // Try to move Right into the wall at (2,1)
    // Wall is at col 2. Player is at col 1.
    const input = { dx: 1, dy: 0 };
    engine.handleInput('0', input);
    engine.update(0.1); // 100ms

    expect(player.x).toBeGreaterThan(startX); // Should have moved
  });

  test('alive player should NOT move through walls', () => {
    const player = engine.players['0'];
    const startX = player.x; // At (1,1)

    // Try to move Right into the wall at (2,1)
    const input = { dx: 1, dy: 0 };
    engine.handleInput('0', input);
    engine.update(0.1);

    // Should be blocked or corrected.
    expect(player.x).toBe(startX);
  });

  test('ghost should be constrained by map boundaries', () => {
    const player = engine.players['0'];
    engine.killPlayer(player);

    // teleport to left edge
    player.x = 0;

    // Try to move left
    const input = { dx: -1, dy: 0 };
    engine.handleInput('0', input);
    engine.update(0.1);

    expect(player.x).toBeGreaterThanOrEqual(0);
    expect(player.x).toBeGreaterThanOrEqual(0);
  });

  test('ghost cannot place bombs', () => {
    const player = engine.players['0'];
    engine.killPlayer(player);

    const input = { placeBomb: true };
    engine.handleInput('0', input); // Should be ignored or safe

    expect(engine.activeBombs.length).toBe(0);
  });

  test('ghost cannot pick up items', () => {
    const player = engine.players['0'];
    engine.killPlayer(player);

    // Place item at player's location
    const col = 1;
    const row = 1;
    // player is at 1,1
    engine.activeItems.push({ col, row, type: 'speed' });

    // Move slightly to trigger pickup logic if it relies on movement/update
    engine.handleInput('0', { dx: 1, dy: 0 }); // small move
    engine.update(0.01);

    // Should still be there
    expect(engine.activeItems.length).toBe(1);
    expect(player.stats.speed).toBe(250); // Default, unchanged
  });
});
