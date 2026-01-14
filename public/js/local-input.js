export const DEFAULT_CONTROLS = {
  0: { KeyW: 'UP', KeyS: 'DOWN', KeyA: 'LEFT', KeyD: 'RIGHT', KeyQ: 'BOMB' },
  1: { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', Enter: 'BOMB' },
  2: { KeyI: 'UP', KeyK: 'DOWN', KeyJ: 'LEFT', KeyL: 'RIGHT', KeyU: 'BOMB' },
  3: { Numpad8: 'UP', Numpad5: 'DOWN', Numpad4: 'LEFT', Numpad6: 'RIGHT', Numpad0: 'BOMB' },
};

export default class LocalInputManager {
  constructor() {
    this.players = {};
    for (const [id, mapping] of Object.entries(DEFAULT_CONTROLS)) {
      this.players[id] = { keys: [], placeBomb: false, mapping: mapping };
    }

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  handleKeyDown(e) {
    // Check which player this key belongs to
    for (let id in this.players) {
      const p = this.players[id];
      const action = p.mapping[e.code];
      if (action) {
        if (action === 'BOMB') {
          p.placeBomb = true;
        } else {
          if (!p.keys.includes(action)) {
            p.keys.push(action);
          }
        }
        // Prevent default scrolling for arrows/space
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }
      }
    }
  }

  handleKeyUp(e) {
    for (let id in this.players) {
      const p = this.players[id];
      const action = p.mapping[e.code];
      if (action) {
        if (action === 'BOMB') {
          p.placeBomb = false;
        } else {
          p.keys = p.keys.filter((k) => k !== action);
        }
      }
    }
  }

  getInputState(playerId) {
    const p = this.players[playerId];
    if (!p) return { dx: 0, dy: 0, placeBomb: false };

    const state = { dx: 0, dy: 0, placeBomb: p.placeBomb };

    if (p.keys.length > 0) {
      const lastKey = p.keys[p.keys.length - 1];
      switch (lastKey) {
        case 'UP':
          state.dy = -1;
          break;
        case 'DOWN':
          state.dy = 1;
          break;
        case 'LEFT':
          state.dx = -1;
          break;
        case 'RIGHT':
          state.dx = 1;
          break;
      }
    }
    return state;
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  reset() {
    for (let id in this.players) {
      this.players[id].keys = [];
      this.players[id].placeBomb = false;
    }
  }
}
