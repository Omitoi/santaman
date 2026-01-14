/**
 * Convert a distance into a volume value (0 … 1).
 *
 * @param {number} dist               Distance returned by mahalanobisDistance().
 * @param {object} [options]          Optional tuning parameters.
 * @param {number} [options.minAudibleDist=0]   Distance at which volume = 1.
 * @param {number} [options.maxAudibleDist=400]   Distance at which volume = 0.
 * @param {function} [options.easing=easeOutQuad]  Mapping curve (default: smooth fall‑off).
 * @returns {number}  Volume clamped to the range [0,1].
 */
export function distanceToVolume(
  dist,
  { minAudibleDist = 0, maxAudibleDist = 400, easing = easeOutQuad } = {}
) {
  // Clamp distance to the configured range.
  const d = Math.min(Math.max(dist, minAudibleDist), maxAudibleDist);

  // Linear proportion: 0 at maxAudibleDist, 1 at minAudibleDist.
  const linear = 1 - (d - minAudibleDist) / (maxAudibleDist - minAudibleDist);

  // Apply easing for a nicer perceptual curve.
  return Math.min(Math.max(easing(linear), 0), 1);
}

/**
 * Simple quadratic “ease‑out” (fast start, slow finish) – feels natural for audio.
 * Input and output are both in the range [0,1].
 */
function easeOutQuad(t) {
  return t * (2 - t);
}
