// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Vorssaint
// JavaScript adaptation of NotchMotion and NotchGestureSupport for Islet.
// Source revision and original paths: THIRD_PARTY_NOTICES.md.
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NotchMotion = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /** Spring constants for one axis, chosen by direction and by which axis. */
  function tuning(from, to, width) {
    const duration = to > from ? (width ? .44 : .38) : (width ? .30 : .26);
    let bounce = to > from ? (width ? .25 : .22) : 0;
    const travel = Math.abs(to - from);
    const damping = 1 - bounce;
    const overshoot = bounce ? Math.exp(-Math.PI * damping / Math.sqrt(1 - damping * damping)) : 0;
    // However much bounce the direction asks for, the overshoot in pixels is
    // capped: a long travel would otherwise visibly overrun its target.
    if (travel * overshoot > 12) {
      const share = Math.log(12 / travel);
      bounce = 1 + share / Math.sqrt(Math.PI ** 2 + share ** 2);
    }
    return { natural: 2 * Math.PI / duration, damping: 1 - bounce };
  }

  /** The original normalised curve, kept for callers that only want progress. */
  function spring(from, to, width) {
    const { natural, damping } = tuning(from, to, width);
    return (time) => {
      if (time <= 0) return 0;
      if (damping >= 1) return 1 - Math.exp(-natural * time) * (1 + natural * time);
      const damped = natural * Math.sqrt(1 - damping * damping);
      return 1 - Math.exp(-damping * natural * time)
        * (Math.cos(damped * time) + damping * natural / damped * Math.sin(damped * time));
    };
  }

  /**
   * One axis as an actual size over time, started from a given speed.
   *
   * A morph that is interrupted - hover, leave, hover again, or a page change
   * part way through - used to begin again from rest at wherever the shell had
   * got to. The shell therefore stopped dead and set off again, which is what
   * reads as instability. Handing the new spring the speed the old one was
   * carrying lets the motion bend into its new target instead.
   *
   * @param {number} from current size
   * @param {number} to target size
   * @param {number} speed current rate of change, in pixels per second
   * @param {boolean} width true for the horizontal axis, which moves slower
   */
  function axis(from, to, speed, width) {
    const { natural, damping } = tuning(from, to, width);
    const offset = from - to; // displacement from the target, which decays to 0
    const velocity = Number.isFinite(speed) ? speed : 0;
    if (damping >= 1) {
      return (time) => time <= 0 ? from
        : to + Math.exp(-natural * time) * (offset + (velocity + natural * offset) * time);
    }
    const damped = natural * Math.sqrt(1 - damping * damping);
    return (time) => {
      if (time <= 0) return from;
      return to + Math.exp(-damping * natural * time) * (
        offset * Math.cos(damped * time)
        + (velocity + damping * natural * offset) / damped * Math.sin(damped * time));
    };
  }

  /**
   * @param {{width:number,height:number}} from
   * @param {{width:number,height:number}} to
   * @param {{width:number,height:number}} [speed] pixels per second, carried
   *   over from a morph this one is interrupting.
   */
  // How finely the spring is written into a CSS easing. The compositor draws
  // straight lines between these points, so this is the only place the curve
  // is approximated. Measured against the closed-to-open morph, the worst gap
  // between the real spring and those lines is 1.42px at 48 samples, 0.38px
  // at 96 and 0.14px at 160; 160 keeps it comfortably inside a device pixel
  // even on a 200% display, and the string is still built once per morph
  // rather than sampled every frame.
  const EASING_SAMPLES = 160;

  function plan(from, to, speed) {
    const width = axis(from.width, to.width, speed?.width || 0, true);
    const height = axis(from.height, to.height, speed?.height || 0, false);
    const sizeAt = (time) => ({ width: width(time), height: height(time) });

    const step = 1 / 240;
    let duration = step;
    for (let time = step; time < 2; time += step) {
      const size = sizeAt(time);
      if (Math.abs(size.width - to.width) > .5 || Math.abs(size.height - to.height) > .5) duration = time + step;
    }
    const count = Math.max(1, Math.ceil(duration * 120));
    const sizes = Array.from({ length: count + 1 }, (_, i) => i === count ? to : sizeAt(duration * i / count));

    /**
     * One axis as a CSS `linear()` easing string.
     *
     * Handing the browser a sampled set of keyframes freezes the curve at
     * whatever rate we sampled it - ours was a hardcoded 120 a second, so on
     * a 144Hz or 165Hz screen the compositor was interpolating straight lines
     * between our samples instead of following the spring. An easing function
     * is sampled by the compositor itself, at the display's own rate, so the
     * curve is the same on every machine and the keyframe list collapses to
     * its two ends.
     *
     * Values outside 0..1 are legal and are what carries the overshoot.
     */
    const easingFor = (fn, from, to) => {
      const span = to - from;
      if (Math.abs(span) < 1e-6) return null;
      const points = [];
      for (let i = 0; i <= EASING_SAMPLES; i += 1) {
        const at = duration * i / EASING_SAMPLES;
        points.push(((fn(at) - from) / span).toFixed(5));
      }
      // The spring is only ever within half a pixel of its target, never
      // exactly on it, so the last point is pinned: the morph has to land on
      // the size it was asked for, not a sixteenth of a pixel short.
      points[0] = '0';
      points[points.length - 1] = '1';
      return 'linear(' + points.join(',') + ')';
    };

    /** How fast the shell is moving at `time`, in pixels per second. */
    const speedAt = (time) => {
      const h = 1 / 960;
      const before = Math.max(0, time - h), after = time + h;
      const a = sizeAt(before), b = sizeAt(after);
      const span = after - before;
      return { width: (b.width - a.width) / span, height: (b.height - a.height) / span };
    };

    return { duration: duration * 1000, sizes, sizeAt, speedAt,
      easing: {
        width: easingFor(width, from.width, to.width),
        height: easingFor(height, from.height, to.height),
      },
      envelope: {
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
  return { plan, spring, axis, Gesture, artworkTint };
}));
