'use strict';

// One contract for stored settings, monitor placement and both renderers.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NotchAppearance = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const defaults = Object.freeze({ closedWidth: 184, expandedWidth: 520, notchScale: 100,
    surfaceTint: '#000000', accentColor: '#ffffff' });
  const ranges = Object.freeze({ closedWidth: [160, 280, 4], expandedWidth: [480, 640, 8], notchScale: [85, 125, 5] });
  function normalize(value = {}) {
    if (!value || typeof value !== 'object') value = {};
    const result = { ...defaults };
    for (const [key, [min, max, step]] of Object.entries(ranges)) {
      if (typeof value[key] === 'number' && Number.isFinite(value[key])) {
        result[key] = Math.max(min, Math.min(max, min + Math.round((value[key] - min) / step) * step));
      }
    }
    return result;
  }
  const rgb = (hex) => hex.slice(1).match(/../g).map((part) => parseInt(part, 16));
  function luminance(values) {
    return values.map((v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; })
      .reduce((total, v, i) => total + v * [.2126, .7152, .0722][i], 0);
  }
  function contrast(a, b) {
    const x = luminance(rgb(a)), y = luminance(rgb(b));
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  }
  function colors() {
    // Legacy color patches are deliberately ignored. Only music meters own tint.
    return { surface: '#000000', rest: '#000000', sheen: '#000000', raised: '#181818', accent: '#ffffff' };
  }
  return { defaults, ranges, normalize, colors, contrast };
}));
