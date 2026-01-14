import { jest } from '@jest/globals';
import GameEngine from '../public/js/game-engine.js';

describe('Bomb Loop & Lag Resilience', () => {
  let engine;

  beforeEach(() => {
    jest.useFakeTimers();
    engine = new GameEngine({
      eventHandler: jest.fn(),
      usernames: ['p1'],
      onGameOver: jest.fn(),
    });
    engine.init([
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('bomb explodes on time even with lag', () => {
    // 1. Place Bomb
    engine.handleInput(0, { dx: 0, dy: 0, placeBomb: true });
    expect(engine.activeBombs.length).toBe(1);

    // 2. Advance time near explosion
    // Simulate normal updates
    jest.advanceTimersByTime(2500);
    // User wrapper update? GameEngine.update uses Date.now().
    // We need to trigger update() manually.
    // jest.advanceTimersByTime updates Date.now() if we use 'modern' timers?
    // Let's check system time.

    // Default jest fake timers might not mock Date.now() automatically in "legacy" mode?
    // But in "modern" (default in Jest 27+), it does.
    // We verify:

    engine.update(0.1);
    expect(engine.activeBombs.length).toBe(1); // Still there (2.5s < 3s)

    // 3. Simulate huge lag spike (e.g. 2s freeze)
    // We advance time by 600ms. Total 3100ms.
    jest.advanceTimersByTime(600);

    // Call update with a HUGE DeltaTime to simulate the lag frame
    // The engine should clamp movement, but the bomb check uses Date.now() so it should explode.
    engine.update(0.6);

    expect(engine.activeBombs.length).toBe(0); // Exploded
  });
});
