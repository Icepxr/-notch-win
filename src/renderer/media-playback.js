'use strict';
// Playback intent is separate from Windows observations. Old polls cannot undo
// a click; only the matching command and a matching state settle its intent.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./media-state'));
  else root.MediaPlayback = factory(root.MediaState);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (State) {
  const key = state => JSON.stringify([state.app, state.title, state.artist]);
  class Controller {
    constructor({ send, change, error, now = Date.now, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id), timeout = 5500 }) {
      Object.assign(this, { send, change, error, now, setTimer, clearTimer, timeout });
      this.reported = State.EMPTY; this.observedAt = 0; this.pending = null; this.request = null; this.timer = null;
      this.sequence = 0; this.prefix = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }
    view() {
      if (!this.pending) return this.reported;
      const p = this.pending;
      return { ...this.reported, playing: p.playing, position: p.position, anchorAt: p.at, pausedSince: p.playing ? 0 : p.at };
    }
    reset(state = State.EMPTY) { this.cancel(false); this.reported = state; this.observedAt = this.now(); this.change(); }
    receive(message) {
      this.reported = State.nextState(this.reported, message, this.now()); this.observedAt = this.now();
      if (this.pending && (!this.reported.active || this.reported.awaiting || key(this.reported) !== this.pending.key)) this.cancel(false);
      if (this.pending?.acknowledged && this.reported.playing === this.pending.playing) this.cancel(false);
      this.change();
    }
    toggle() {
      const view = this.view(); if (!view.active || !view.canToggle) return;
      const now = this.now();
      this.pending = { key: key(view), playing: !view.playing, position: State.positionAt(view, now), at: now, acknowledged: false };
      if (this.request?.accepted) { this.clearTimer(this.timer); this.timer = null; this.request = null; }
      this.error(''); this.change(); this.pump();
    }
    pump() {
      if (this.request || !this.pending) return;
      const request = { id: this.prefix + '-' + (++this.sequence), playing: this.pending.playing, app: this.reported.app, at: this.now() };
      this.request = request;
      this.timer = this.setTimer(() => {
        if (this.request?.id !== request.id) return;
        this.cancel(); this.error('The player did not confirm playback. Try again.');
      }, this.timeout);
      Promise.resolve().then(() => this.request?.id === request.id ? this.send(request.playing ? 'play' : 'pause', undefined, { id: request.id, app: request.app }) : true)
        .then(queued => { if (!queued) this.finish(request.id, false); }, () => this.finish(request.id, false));
    }
    result(result) {
      if (!result || typeof result.id !== 'string') return false;
      // Results from retired requests must not roll back a newer intent/source.
      if (this.request?.id === result.id) this.finish(result.id, result.via !== 'none');
      return true;
    }
    finish(id, accepted) {
      const request = this.request; if (request?.id !== id || !this.pending) return;
      if (request.playing !== this.pending.playing) {
        this.clearTimer(this.timer); this.request = null; this.timer = null; this.pump(); return;
      }
      if (!accepted) { this.cancel(); this.error('This player declined the playback command.'); return; }
      request.accepted = true;
      this.pending.acknowledged = true;
      if (this.observedAt >= request.at && this.reported.playing === this.pending.playing) this.cancel(false);
      this.change();
    }
    cancel(paint = true) {
      this.clearTimer(this.timer); this.timer = null; this.request = null; this.pending = null;
      if (paint) this.change();
    }
  }
  return { Controller };
}));
