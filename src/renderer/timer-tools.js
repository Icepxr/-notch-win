'use strict';
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Vorssaint
// NotchTimerRulerScale and NotchPomodoroConfiguration for Windows.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TimerTools = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function bounded(value, min, max, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
  }
  function configuration(value) {
    const v = value && typeof value === 'object' ? value : {};
    return { focus: bounded(v.focus, 1, 180, 25), shortBreak: bounded(v.shortBreak, 1, 60, 5),
      longBreak: bounded(v.longBreak, 1, 60, 15), interval: bounded(v.interval, 1, 24, 4), sessions: bounded(v.sessions, 1, 24, 4) };
  }
  function preferences(value) {
    const v = value && typeof value === 'object' ? value : {};
    return { mode: ['timer', 'pomodoro', 'stopwatch'].includes(v.mode) ? v.mode : 'timer',
      minutes: bounded(v.minutes, 1, 180, 5), configuration: configuration(v.configuration) };
  }
  function moving(value, points) {
    return Number.isFinite(value) && Number.isFinite(points) ? Math.min(180, Math.max(1, value - points / 14)) : 1;
  }
  function minute(value) { return Math.round(moving(value, 0)); }
  function label(value) { return value < 60 ? String(value) : Math.floor(value / 60) + 'h' + String(value % 60).padStart(2, '0'); }
  return { bounded, configuration, preferences, moving, minute, label, spacing: 14 };
}));
