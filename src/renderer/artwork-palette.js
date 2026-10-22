'use strict';

// Pull a usable colour out of album art.
//
// The average colour of a cover is almost always mud: average enough pixels
// together and every record turns the same grey-brown. What the eye actually
// reads as "the colour of this album" is the most *vivid* region, even when it
// covers a minority of the artwork. So this votes by hue, weighting each pixel
// by how saturated and how mid-toned it is, and returns the winning hue rather
// than the mean.
//
// The result is deliberately a pair of seed colours, not finished UI colours:
// NotchAppearance.colors() takes them from here and enforces the readability
// floor, so a neon cover cannot produce an unreadable panel.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ArtworkPalette = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const BUCKETS = 24;              // 15° per bucket
  const MIN_ALPHA = 128;
  const DARK = 0.07;               // below this a pixel carries no usable hue
  const LIGHT = 0.93;
  const MIN_SATURATION = 0.14;
  // A cover has to be colourful somewhere. Below this share of the sampled
  // pixels we treat it as monochrome and let the user's own palette stand.
  const MIN_COLOURFUL_SHARE = 0.035;

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (!d) return { h: 0, s: 0, l };
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return { h: h * 360, s, l };
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    if (!s) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)].map((v) => Math.round(v * 255));
  }

  const hex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  /**
   * @param {ArrayLike<number>} pixels RGBA, as from CanvasRenderingContext2D.getImageData
   * @returns {{surfaceTint: string, accentColor: string, hue: number, saturation: number}|null}
   *   null when the artwork has no hue worth following.
   */
  function paletteFrom(pixels) {
    if (!pixels || pixels.length < 4) return null;
    const total = Math.floor(pixels.length / 4);
    // Each bucket keeps its vote weight plus the sums needed for a circular
    // mean, so a hue near 0° does not average with one near 360° into cyan.
    const buckets = Array.from({ length: BUCKETS }, () => ({ weight: 0, x: 0, y: 0, s: 0, l: 0 }));
    let colourful = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < MIN_ALPHA) continue;
      const { h, s, l } = rgbToHsl(pixels[i], pixels[i + 1], pixels[i + 2]);
      if (l < DARK || l > LIGHT || s < MIN_SATURATION) continue;
      colourful += 1;
      // Vivid beats pale (s²) and mid-tones beat extremes: those are the
      // pixels a person would point at and call "the colour of the cover".
      const weight = s * s * (1 - Math.abs(l - 0.5));
      const bucket = buckets[Math.floor(h / (360 / BUCKETS)) % BUCKETS];
      const radians = h * Math.PI / 180;
      bucket.weight += weight;
      bucket.x += Math.cos(radians) * weight;
      bucket.y += Math.sin(radians) * weight;
      bucket.s += s * weight;
      bucket.l += l * weight;
    }

    if (colourful / total < MIN_COLOURFUL_SHARE) return null;

    const winner = buckets.reduce((best, bucket) => (bucket.weight > best.weight ? bucket : best), buckets[0]);
    if (!winner.weight) return null;

    const hue = (Math.atan2(winner.y, winner.x) * 180 / Math.PI + 360) % 360;
    const saturation = winner.s / winner.weight;
    const lightness = winner.l / winner.weight;

    return {
      hue,
      saturation,
      // Bright enough to read as an accent on a dark panel, never neon.
      accentColor: hex(hslToRgb(hue, clamp(saturation, 0.42, 0.85), clamp(lightness + 0.18, 0.58, 0.74))),
      // The same hue, pulled down to a surface that text can live on.
      surfaceTint: hex(hslToRgb(hue, clamp(saturation * 0.55, 0.12, 0.46), 0.075)),
    };
  }

  return { paletteFrom, rgbToHsl, hslToRgb, hex };
}));
