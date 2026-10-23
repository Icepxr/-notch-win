'use strict';
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Vorssaint
// Existing-module ordering/visibility follows Vorssaint's NotchSettings content editor.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NotchModules = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // One name per module, used by the notch tabs, the Explore gallery, the
  // module pager and the Settings list. They disagreed before: 'send' was
  // both Files and Send files, and 'ai' was AI, AI Agents and AI Monitor.
  // 'AI Monitor' is the honest one - it watches agents, it does not answer
  // for them.
  const names = Object.freeze({ send: 'Send files', media: 'Music', clipboard: 'Clipboard', system: 'System', ai: 'AI Monitor', timer: 'Timer', notes: 'Notes' });
  const ids = Object.keys(names);
  function normalize(value = {}) {
    const order = [...new Set([...(Array.isArray(value.moduleOrder) ? value.moduleOrder.filter(id => ids.includes(id)) : []), ...ids])];
    const hidden = [...new Set(Array.isArray(value.hiddenModules) ? value.hiddenModules.filter(id => ids.includes(id)) : [])];
    if (hidden.length === ids.length) hidden.splice(hidden.indexOf(order[0]), 1);
    return { moduleOrder: order, hiddenModules: hidden };
  }
  function visible(value) { const p = normalize(value); return p.moduleOrder.filter(id => !p.hiddenModules.includes(id)); }
  return { names, ids, normalize, visible };
}));
