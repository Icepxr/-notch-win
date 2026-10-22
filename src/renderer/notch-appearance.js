'use strict';

// One contract for stored settings, monitor placement and both renderers.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NotchAppearance = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const defaults = Object.freeze({ closedWidth: 184, expandedWidth: 520, notchScale: 100,
    surfaceTint: '#080809', accentColor: '#aac4ef' });
  const ranges = Object.freeze({ closedWidth: [160, 280, 4], expandedWidth: [480, 640, 8], notchScale: [85, 125, 5] });
  const presets = Object.freeze([
    { name: 'Obsidian', surfaceTint: '#080809', accentColor: '#aac4ef' },
    { name: 'Midnight', surfaceTint: '#14233d', accentColor: '#92c5ff' },
    { name: 'Iris', surfaceTint: '#30213e', accentColor: '#ccb4ff' },
    { name: 'Moss', surfaceTint: '#19362c', accentColor: '#a6d9bb' },
  ]);
  function normalize(value = {}) {
    const result = { ...defaults };
    for (const [key, [min, max, step]] of Object.entries(ranges)) {
      if (typeof value[key] === 'number' && Number.isFinite(value[key])) {
        result[key] = Math.max(min, Math.min(max, min + Math.round((value[key] - min) / step) * step));
      }
    }
    for (const key of ['surfaceTint', 'accentColor']) {
      if (typeof value[key] === 'string' && /^#[0-9a-f]{6}$/i.test(value[key])) result[key] = value[key].toLowerCase();
    }
    return result;
  }
  const rgb = (hex) => hex.slice(1).match(/../g).map((part) => parseInt(part, 16));
  const hex = (values) => '#' + values.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, amount) => a.map((v, i) => v + (b[i] - v) * amount);
  function luminance(values) {
    return values.map((v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; })
      .reduce((total, v, i) => total + v * [.2126, .7152, .0722][i], 0);
  }
  function contrast(a, b) {
    const x = luminance(rgb(a)), y = luminance(rgb(b));
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  }
  function colors(value) {
    const prefs = normalize(value);
    let surface = rgb(prefs.surfaceTint);
    // Accept any hue, keeping the dark surface readable under bright artwork.
    for (let i = 0; i < 80 && luminance(surface) > .022; i++) surface = mix(surface, [0, 0, 0], .04);
    const raised = mix(surface, [255, 255, 255], .12);
    let accent = rgb(prefs.accentColor);
    for (let i = 0; i < 100 && contrast(hex(accent), hex(raised)) < 4.5; i++) accent = mix(accent, [255, 255, 255], .06);
    return { surface: hex(surface), rest: hex(mix(surface, [0, 0, 0], .38)),
      sheen: hex(mix(surface, [255, 255, 255], .025)), raised: hex(raised), accent: hex(accent) };
  }
  return { defaults, ranges, presets, normalize, colors, contrast };
}));
