'use strict';
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Vorssaint
// NotchScrollEdgeFade: fade only an edge with content beyond it.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ScrollEdges = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function edges(offset, visible, total) {
    if (![offset, visible, total].every(Number.isFinite) || visible <= 0 || total <= visible + 1) return { start: false, end: false };
    return { start: offset > 1, end: offset + visible < total - 1 };
  }
  function observe(element, axis = 'vertical') {
    if (!element || element.dataset.edgeAxis) return;
    element.dataset.edgeAxis = axis;
    const horizontal = axis === 'horizontal'; let scheduled = false;
    function update() {
      scheduled = false;
      const state = edges(horizontal ? element.scrollLeft : element.scrollTop,
        horizontal ? element.clientWidth : element.clientHeight, horizontal ? element.scrollWidth : element.scrollHeight);
      for (const side of ['start','end']) {
        const value = state[side] ? '16px' : '0px';
        if (element.style.getPropertyValue('--edge-' + side) !== value) element.style.setProperty('--edge-' + side, value);
      }
    }
    function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } }
    element.addEventListener('scroll', schedule, { passive: true });
    new ResizeObserver(schedule).observe(element);
    new MutationObserver(schedule).observe(element, { childList: true, subtree: true, characterData: true });
    element.addEventListener('focusin', event => {
      const target = event.target.closest('.clip-row,.item,.ai-card'); if (!target) return;
      const outer = element.getBoundingClientRect(), inner = target.getBoundingClientRect();
      if (horizontal ? inner.left < outer.left + 16 || inner.right > outer.right - 16
        : inner.top < outer.top + 16 || inner.bottom > outer.bottom - 16) target.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    schedule();
  }
  return { edges, observe };
}));
