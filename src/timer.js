// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Vorssaint
// Windows/Node adaptation of NotchTimerSession. See THIRD_PARTY_NOTICES.md.
'use strict';
const { EventEmitter } = require('node:events');

class NotchTimer extends EventEmitter {
  constructor({ now = () => Number(process.hrtime.bigint()) / 1e9 } = {}) {
    super(); this.now = now; this.ticker = null; this.reset(false);
  }
  reset(publish = true) {
    this.mode = 'timer'; this.phase = 'timer'; this.duration = 300;
    this.anchor = null; this.paused = null; this.completed = false; this.focuses = 0;
    this.configuration = { focus: 25, shortBreak: 5, longBreak: 15, interval: 4, sessions: 4 };
    if (publish) this.publish();
  }
  get countsUp() { return this.mode === 'stopwatch'; }
  get hasSession() { return this.anchor !== null || this.paused !== null || this.completed; }
  reading() {
    return this.anchor !== null ? Math.max(0, this.countsUp ? this.now() - this.anchor : this.anchor - this.now())
      : this.paused ?? (this.completed || this.countsUp ? 0 : this.duration);
  }
  snapshot() {
    return { mode: this.mode, phase: this.phase, duration: this.duration, reading: this.reading(),
      running: this.anchor !== null, paused: this.paused !== null, completed: this.completed,
      hasSession: this.hasSession, countsUp: this.countsUp, focuses: this.focuses,
      canNext: this.mode === 'pomodoro' && this.completed && this.focuses < this.configuration.sessions };
  }
  finishIfDue() {
    if (this.countsUp || this.anchor === null || this.now() < this.anchor) return false;
    this.anchor = null; this.paused = null; this.completed = true;
    if (this.phase === 'focus') this.focuses++;
    this.emit('complete', this.snapshot());
    return true;
  }
  command(action, options = {}) {
    if (!options || typeof options !== 'object') options = {};
    if (action === 'reset') this.reset(false);
    else if (action === 'start' && !this.hasSession) {
      if (!['timer', 'stopwatch', 'pomodoro'].includes(options.mode)) return this.snapshot();
      this.mode = options.mode;
      this.phase = this.countsUp ? 'stopwatch' : this.mode === 'pomodoro' ? 'focus' : 'timer';
      const minutes = Number.isFinite(options.minutes) ? Math.round(Math.max(1, Math.min(180, options.minutes))) : 5;
      this.configuration.focus = minutes;
      this.duration = this.countsUp ? 0 : minutes * 60;
      this.anchor = this.countsUp ? this.now() : this.now() + this.duration;
    } else if (action === 'pause' && this.anchor !== null) {
      if (!this.finishIfDue()) { this.paused = this.reading(); this.anchor = null; }
    } else if (action === 'resume' && this.paused !== null) {
      this.anchor = this.countsUp ? this.now() - this.paused : this.now() + this.paused;
      this.paused = null;
    } else if (action === 'next' && this.snapshot().canNext) {
      this.phase = this.phase === 'focus' ? (this.focuses % this.configuration.interval === 0 ? 'longBreak' : 'shortBreak') : 'focus';
      this.duration = this.configuration[this.phase] * 60;
      this.completed = false; this.anchor = this.now() + this.duration;
    }
    this.publish();
    return this.snapshot();
  }
  publish() { const state = this.snapshot(); this.lastSecond = Math.ceil(state.reading); this.emit('change', state); }
  start() {
    if (this.ticker) return;
    this.ticker = setInterval(() => {
      const finished = this.finishIfDue();
      if (finished || (this.hasSession && Math.ceil(this.reading()) !== this.lastSecond)) this.publish();
    }, 200);
    this.ticker.unref();
  }
  stop() { clearInterval(this.ticker); this.ticker = null; }
}
module.exports = { NotchTimer };
