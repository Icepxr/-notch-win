'use strict';
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Vorssaint
// ScratchpadSupport text-size bounds; literal find for Electron's plain editor.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NotesTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function textSize(value) { return typeof value === 'number' && Number.isFinite(value) ? Math.min(22, Math.max(10, Math.round(value))) : 13; }
  function matches(text, query) {
    if (typeof text !== 'string' || typeof query !== 'string' || !query) return [];
    const literal = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(literal, 'giu'), hits = [];
    for (const match of text.matchAll(pattern)) hits.push([match.index, match.index + match[0].length]);
    return hits;
  }
  return { textSize, matches };
}));
