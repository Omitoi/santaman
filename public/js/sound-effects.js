// js/sound-effects.js

let audioCtx = null;
let musicBuffer = null;
let musicSource = null;
let gainNode = null;
let enabled = false; // false = silent, true = audible
let isInitialized = false;

export async function init() {
  if (isInitialized) return;

  const musicEl = document.getElementById('bg-music');
  if (!musicEl) {
    console.warn('[Sound] No <audio id="bg-music"> found.');
    return;
  }

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();

    // Create a gain node for volume control
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.4; // Initial volume
    gainNode.connect(audioCtx.destination);

    // Fetch and decode the audio
    const src = musicEl.src;
    const response = await fetch(src);
    const arrayBuffer = await response.arrayBuffer();

    // Decode audio data
    musicBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    isInitialized = true;
    console.log('[Sound] Background music loaded and decoded.');
  } catch (err) {
    console.error('[Sound] Failed to init Web Audio API:', err);
  }
}

export function toggleMusic() {
  if (!isInitialized || !audioCtx) return false;

  // Resume context if suspended (browser policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  enabled = !enabled;

  if (enabled) {
    startMusic();
  } else {
    stopMusic();
  }
  return enabled;
}

function startMusic() {
  if (musicSource) {
    // Already playing
    return;
  }

  try {
    musicSource = audioCtx.createBufferSource();
    musicSource.buffer = musicBuffer;
    musicSource.loop = true;
    musicSource.connect(gainNode);
    musicSource.start(0);
  } catch (err) {
    console.error('[Sound] Failed to start music:', err);
    enabled = false;
  }
}

function stopMusic() {
  if (musicSource) {
    try {
      musicSource.stop();
    } catch {
      // Ignore errors if already stopped
    }
    musicSource.disconnect();
    musicSource = null;
  }
}

export function isPlaying() {
  return enabled;
}

const clips = {
  // identifier : path‑to‑file
  tick: './assets/sound-placeholder/ticking-clock-37157-cut.mp3',
  bomb: './assets/sound/merryxmas.mp3',
  explode: './assets/sound-placeholder/big-boom-14752.mp3',
};

/* Pre‑create Audio objects for each clip – they stay in memory. */
const audioBank = {};
Object.entries(clips).forEach(([id, src]) => {
  const a = new Audio(src);
  a.preload = 'auto';
  a.volume = 0.6;
  audioBank[id] = a;
});

/**
 * Play a sound once.
 *
 * @param {string} id          Identifier defined in the `clips` map.
 * @param {number} [vol=0.6]   Desired volume (0 … 1). If omitted the default 0.6 is used.
 */
export function playSound(id, vol = 0.6) {
  const base = audioBank[id];
  if (!base) {
    console.warn(`[Sound] No audio registered for id="${id}"`);
    return;
  }

  const clone = base.cloneNode(true);
  clone.volume = Math.min(Math.max(vol, 0), 1); // clamp safely
  clone.play().catch((err) => {
    console.debug(`[Sound] Playback suppressed for "${id}":`, err);
  });
}
