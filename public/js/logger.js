// Check for debug flag in URL (Browser only)
let IS_DEBUG_MODE = false;
let IS_PRODUCTION = false; // Default to false

if (typeof window !== 'undefined') {
  const urlParams = new URLSearchParams(window.location.search);
  IS_DEBUG_MODE = urlParams.has('debug');
}

// In Node environment, we might check process.env (optional)
if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
  IS_PRODUCTION = true;
}

// On-screen terminal helper (Browser only)
function writeToTerminal(msg) {
  if (typeof document === 'undefined') return;

  const terminal = document.getElementById('debug-terminal');
  const content = document.getElementById('debug-content');
  if (terminal && content) {
    terminal.style.display = 'block';
    const line = document.createElement('div');
    line.innerText = '> ' + msg;
    line.style.borderBottom = '1px solid #333';
    line.style.padding = '2px 0';
    content.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
  }
}

export const logger = {
  /**
   * Log debug messages only in development
   * @param {...any} args
   */
  debug: (...args) => {
    if (!IS_PRODUCTION) {
      console.log(...args);
    }
    if (IS_DEBUG_MODE) {
      writeToTerminal(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' '));
    }
  },

  /**
   * Log info messages (always visible)
   * @param {...any} args
   */
  info: (...args) => {
    console.log(...args);
  },

  /**
   * Log warning messages
   * @param {...any} args
   */
  warn: (...args) => {
    console.warn(...args);
  },

  /**
   * Log error messages
   * @param {...any} args
   */
  error: (...args) => {
    console.error(...args);
  },
};
