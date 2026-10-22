'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NotchActivity = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // A bounded, priority-aware queue: background music cannot replace a timer.
  class Queue {
    constructor({ change, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (id) => clearTimeout(id), now = Date.now }) {
      this.change = change; this.setTimer = setTimer; this.clearTimer = clearTimer;
      this.current = null; this.pending = []; this.timer = null;
      this.now = now; this.paused = false; this.remaining = 0;
    }
    push(value) {
      if (!value || !value.id || !value.title) return;
      const item = { priority: 20, duration: 2800, kind: 'info', ...value };
      if (item.expiresAt && item.expiresAt <= this.now()) return;
      if (this.current?.id === item.id) { if (item.replace) this.show(item); return; }
      this.pending = this.pending.filter((p) => p.id !== item.id && (!item.coalesceKey || p.coalesceKey !== item.coalesceKey));
      if (item.coalesceKey && this.current?.coalesceKey === item.coalesceKey) { this.show(item); return; }
      if (!this.current || item.priority > this.current.priority) {
        // An interrupted low-priority preview is already old news.
        this.show(item); return;
      }
      this.pending.push(item); this.pending.sort((a, b) => b.priority - a.priority);
      this.pending = this.pending.slice(0, 4);
    }
    show(item) {
      this.clearTimer(this.timer); this.current = item;
      this.remaining = Math.max(800, Math.min(8000, item.duration));
      this.deadline = this.now() + this.remaining; this.change(item);
      this.schedule();
    }
    schedule() { if (!this.current || this.paused) return; this.deadline = this.now() + this.remaining; this.timer = this.setTimer(() => this.dismiss(), this.remaining); }
    pause() { if (this.paused) return; this.paused = true; if (this.current) this.remaining = Math.max(0, this.deadline - this.now()); this.clearTimer(this.timer); }
    resume() { if (!this.paused) return; this.paused = false; this.schedule(); }
    dismiss() {
      this.clearTimer(this.timer); this.current = null;
      let next;
      do { next = this.pending.shift(); } while (next?.expiresAt && next.expiresAt <= this.now());
      if (next) this.show(next); else this.change(null);
    }
    clear() { this.pending = []; this.paused = false; this.dismiss(); }
  }
  class Swipe {
    constructor() { this.reset(); }
    reset() { this.distance = 0; this.last = 0; this.fired = false; }
    wheel(x, y, time) {
      if (![x, y, time].every(Number.isFinite)) return null;
      if (time - this.last > 320 || time < this.last) this.reset();
      this.last = time;
      if (this.fired || Math.abs(x) < Math.abs(y) * 1.4) return null;
      this.distance += x;
      if (Math.abs(this.distance) < 48) return null;
      this.fired = true; return this.distance > 0 ? 1 : -1;
    }
  }
  return { Queue, Swipe };
}));
