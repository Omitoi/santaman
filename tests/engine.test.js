import { jest } from '@jest/globals';
import GameEngine from '../public/js/game-engine.js';

describe('GameEngine', () => {
  let engine;
  const mapTemplate = [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
  ];

  beforeEach(() => {
    engine = new GameEngine({
      eventHandler: jest.fn(),
      usernames: ['p1'],
      onGameOver: jest.fn(),
    });
    engine.init(mapTemplate);
  });

  test('should initialize player correctly', () => {
    engine.addPlayer('p1', 'red', 1, 1);
    const player = engine.players['p1'];
    expect(player).toBeDefined();
    expect(player.x).toBeGreaterThan(0);
    expect(player.y).toBeGreaterThan(0);
  });

  test('should move player right', () => {
    engine.addPlayer('p1', 'red', 1, 1);
    const player = engine.players['p1'];
    const startX = player.x;

    const input = {
      dx: 1,
      dy: 0,
      placeBomb: false,
    };

    engine.handleInput('p1', input);
    engine.update(0.1); // 100ms

    expect(player.x).toBeGreaterThan(startX);
  });

  test('should place a bomb', () => {
    engine.addPlayer('p1', 'red', 1, 1);
    const input = {
      dx: 0,
      dy: 0,
      placeBomb: true,
    };

    // First frame: handle input
    engine.handleInput('p1', input);

    expect(engine.activeBombs.length).toBe(1);
  });

  test('should reset state on init', () => {
    engine.addPlayer('p1', 'red', 1, 1);
    const player = engine.players['p1'];

    // Simulate movement
    player.input.dx = 1;
    player.wasMoving = true;

    // Re-init
    engine.init(mapTemplate);

    const newPlayer = engine.players['p1'];
    expect(newPlayer.input.dx).toBe(0);
    expect(newPlayer.wasMoving).toBe(false);
    expect(engine.activeBombs.length).toBe(0);
  });
});
