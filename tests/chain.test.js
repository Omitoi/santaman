import { jest } from '@jest/globals';
import GameEngine from '../public/js/game-engine.js';

describe('Chain Reactions', () => {
  let engine;

  beforeEach(() => {
    jest.useFakeTimers();
    engine = new GameEngine({
      eventHandler: jest.fn(),
      usernames: ['p1'],
      onGameOver: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('bombs chain reaction destroys crate', () => {
    const mapTemplate = [
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 2, 0, 1], // Crate at (2, 2)
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ];

    engine.init(mapTemplate);
    // GameEngine.addPlayers was called in constructor with usernames=['p1'].
    // So player 0 is already there at default spawn pos (1, 1).
    // The legacy test called engine.addPlayer explicit with specific coords.
    // engine.addPlayer method appends to players dict.

    // Let's assume addPlayer is available or we manipulate existing player.
    const p1 = engine.players[0]; // ID 0 is 'p1' from constructor

    expect(p1).toBeDefined();

    p1.stats.maxBombs = 2; // Allow 2 bombs
    // Or simpler: just overwrite x/y.

    // Bomb A at (2, 1) - Above crate
    // TILE_SIZE=64. Center = +32.
    // Col 2, Row 1.
    p1.x = 2 * 64 + 32;
    p1.y = 1 * 64 + 32;
    p1.lastBombTime = 0;

    engine.handleInput(0, { dx: 0, dy: 0, placeBomb: true });

    // Bomb B at (1, 2) - Left of crate
    p1.x = 1 * 64 + 32;
    p1.y = 2 * 64 + 32;
    p1.lastBombTime = 0; // Force reset cooldown

    engine.handleInput(0, { dx: 0, dy: 0, placeBomb: true });

    expect(engine.activeBombs.length).toBe(2);

    // Simulate explosion
    // Bombs explode after 3000ms.
    // Advance time by 3.1s
    jest.advanceTimersByTime(3100);
    // Also need to pump the engine update loop to trigger the check
    engine.update(3.1);

    expect(engine.activeBombs.length).toBe(0);

    // Check crate at (2, 2)
    // mapLayout[row][col]
    // Crate is 2. Empty is 0.
    expect(engine.mapLayout[2][2]).toBe(0);
  });
});
