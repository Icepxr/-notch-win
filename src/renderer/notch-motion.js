// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Vorssaint
// JavaScript adaptation of NotchMotion and NotchGestureSupport for Islet.
// Source revision and original paths: THIRD_PARTY_NOTICES.md.
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NotchMotion = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function spring(from, to, width) {
    const duration = to > from ? (width ? .44 : .38) : (width ? .30 : .26);
    let bounce = to > from ? (width ? .25 : .22) : 0;
    const travel = Math.abs(to - from);
    const damping = 1 - bounce;
    const overshoot = bounce ? Math.exp(-Math.PI * damping / Math.sqrt(1 - damping * damping)) : 0;
    if (travel * overshoot > 12) {
      const share = Math.log(12 / travel);
      bounce = 1 + share / Math.sqrt(Math.PI ** 2 + share ** 2);
    }
    return (time) => {
      if (time <= 0) return 0;
      const natural = 2 * Math.PI / duration;
      const damping = 1 - bounce;
      if (damping >= 1) return 1 - Math.exp(-natural * time) * (1 + natural * time);
      const damped = natural * Math.sqrt(1 - damping * damping);
      return 1 - Math.exp(-damping * natural * time)
        * (Math.cos(damped * time) + damping * natural / damped * Math.sin(damped * time));
    };
  }
  function plan(from, to) {
    const width = spring(from.width, to.width, true);
    const height = spring(from.height, to.height, false);
    const sizeAt = (time) => ({
      width: from.width + (to.width - from.width) * width(time),
      height: from.height + (to.height - from.height) * height(time),
    });
    let duration = 1 / 240;
    for (let time = 1 / 240; time < 2; time += 1 / 240) {
      const size = sizeAt(time);
      if (Math.abs(size.width - to.width) > .5 || Math.abs(size.height - to.height) > .5) duration = time + 1 / 240;
    }
    const count = Math.max(1, Math.ceil(duration * 120));
    const sizes = Array.from({ length: count + 1 }, (_, i) => i === count ? to : sizeAt(duration * i / count));
    return { duration: duration * 1000, sizes, envelope: {
      width: Math.ceil(Math.max(...sizes.map((size) => size.width))),
      height: Math.ceil(Math.max(...sizes.map((size) => size.height))),
    } };
  }
  class Gesture {
    reset() { this.origin = null; this.axis = null; this.x = 0; this.y = 0; this.distance = 0; this.fired = false; }
    constructor() { this.reset(); this.last = null; }
    handle({ x, y, time, vertical, horizontal, expanded }) {
      if (![x, y, time].every(Number.isFinite)) { this.reset(); this.last = null; return null; }
      if (this.last === null || time < this.last || time - this.last > 350) this.reset();
      this.last = time;
      if (!this.origin) this.origin = { vertical, horizontal, expanded };
      if (this.fired) return null;
      if (!this.axis) {
        this.x += x; this.y += y;
        if (this.origin.horizontal && Math.abs(this.x) >= 4 && Math.abs(this.x) >= Math.abs(this.y) * 1.5) {
          this.axis = 'horizontal'; this.distance = this.x;
        } else if (this.origin.vertical && Math.abs(this.y) >= 4 && Math.abs(this.y) >= Math.abs(this.x) * 1.5) {
          this.axis = 'vertical'; this.distance = this.y;
        } else return null;
      } else this.distance += this.axis === 'horizontal' ? x : y;
      if (Math.abs(this.distance) < (this.axis === 'horizontal' ? 40 : 16)) return null;
      this.fired = true;
      if (this.axis === 'horizontal') return this.distance < 0 ? 'next' : 'prev';
      if (this.distance > 0 && !this.origin.expanded) return 'open';
      if (this.distance < 0 && this.origin.expanded) return 'close';
      return null;
    }
  }
  // NotchArtworkTint.from: neutral covers keep the surface black; coloured
  // covers share one exposure-independent range. Samples are 0..1 channels.
  function artworkTint(channels) {
    if (channels.length !== 3 || !channels.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) return null;
    const high = Math.max(...channels), low = Math.min(...channels), range = high - low;
    if (high <= .05 || range / high < .12) return null;
    return channels.map((value) => Math.round(((value - low) / range * .86 + .06) * 255));
  }
  return { plan, spring, Gesture, artworkTint };
}));
