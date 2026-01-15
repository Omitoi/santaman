export default class InputManager {
  constructor(opts = {}) {
    this.keys = []; // A stack to track order of presses

    // Map physical keys to logical directions
    this.keyMap = {
      ArrowUp: 'UP',
      KeyW: 'UP',
      ArrowDown: 'DOWN',
      KeyS: 'DOWN',
      ArrowLeft: 'LEFT',
      KeyA: 'LEFT',
      ArrowRight: 'RIGHT',
      KeyD: 'RIGHT',
      Space: 'BOMB',
      Escape: 'PAUSE',
    };

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.onPause = typeof opts.onPause === 'function' ? opts.onPause : null;
    this.pauseAlreadyHandled = false;
  }

  handleKeyDown(e) {
    const action = this.keyMap[e.code];
    if (!action) return; // Ignore irrelevant keys

    if (action == 'PAUSE') {
      if (this.onPause && !this.pauseAlreadyHandled) {
        this.pauseAlreadyHandled = true;
        this.onPause();
      }
      return;
    }

    // If it's the bomb, handle separately (it's a trigger, not a direction
    if (action === 'BOMB') {
      this.placeBomb = true;
      return;
    }

    // Prevent default scrolling for arrows/space
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }

    // Add to stack if not already there
    if (!this.keys.includes(action)) {
      this.keys.push(action);
    }
  }

  handleKeyUp(e) {
    const action = this.keyMap[e.code];
    if (!action) return; // Ignore irrelevant keys

    this.pauseAlreadyHandled = false;

    // If it's the bomb, handle separately
    if (action === 'BOMB') {
      this.placeBomb = false;
      return;
    }
    this.keys = this.keys.filter((k) => k !== action);
  }

  /**
   * Returns the dominant movement vector based on the LAST key pressed.
   */
  getInputState() {
    const state = { dx: 0, dy: 0, placeBomb: this.placeBomb };

    // If no keys pressed, return empty
    if (this.keys.length === 0) return state;

    // Get the last key in the stack (the most recent one)
    const lastKey = this.keys[this.keys.length - 1];

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

    return state;
  }
  // Clean up listeners if needed (good for restarting game without refreshing)
  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  reset() {
    this.keys = [];
    this.placeBomb = false;
    this.pauseAlreadyHandled = false;
  }
}
