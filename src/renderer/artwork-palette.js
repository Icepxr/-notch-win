'use strict';
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Vorssaint
// NotchMusicService.artworkTint / NotchArtworkTint: one averaged sRGB pixel,
// premultiplied alpha, neutral-cover fallback and fixed channel stretching.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./notch-motion'), require('./notch-appearance'));
  else root.ArtworkPalette = factory(root.NotchMotion, root.NotchAppearance);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Motion, Appearance) {
  const hex = values => '#' + values.map(value => Math.round(value).toString(16).padStart(2, '0')).join('');
  function paletteFrom(pixels) {
    if (!pixels || !pixels.length || pixels.length % 4) return null;
    const sum = [0, 0, 0], count = pixels.length / 4;
    for (let i = 0; i < pixels.length; i += 4) {
      for (let c = 0; c < 4; c++) if (!Number.isFinite(pixels[i + c]) || pixels[i + c] < 0 || pixels[i + c] > 255) return null;
      for (let c = 0; c < 3; c++) sum[c] += pixels[i + c] / 255 * pixels[i + 3] / 255;
    }
    const tint = Motion.artworkTint(sum.map(value => value / count));
    if (!tint) return null;
    let accent = [...tint];
    // Windows meter adaptation: keep the thin interactive line at 3:1 over
    // black. Text stays neutral; the raw source tint remains available below.
    for (let i = 0; i < 40 && Appearance.contrast(hex(accent), '#000000') < 3; i++) accent = accent.map(value => value + (255 - value) * .06);
    return { sourceColor: hex(tint), accentColor: hex(accent) };
  }
  return { paletteFrom };
}));
