'use strict';
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Vorssaint
// Centered NotchTimerRuler: relative dragging, click-to-pick and scroll accumulation.
window.TimerRuler = (() => {
  function mount(input, changed) {
    const root = input.closest('.timer-ruler'), track = document.createElement('div');
    track.className = 'timer-ruler-track'; track.setAttribute('aria-hidden', 'true');
    const ticks = Array.from({ length: 180 }, (_, i) => {
      const minute = i + 1, tick = document.createElement('span');
      tick.className = 'timer-ruler-tick'; tick.style.left = (i * TimerTools.spacing) + 'px';
      if (minute === 1 || minute % 5 === 0) {
        const label = document.createElement('b'); label.textContent = TimerTools.label(minute); tick.append(label);
      }
      track.append(tick); return tick;
    });
    const pointer = document.createElement('i'); pointer.className = 'timer-ruler-pointer'; pointer.setAttribute('aria-hidden', 'true');
    const viewport = document.createElement('div'); viewport.className = 'timer-ruler-viewport'; viewport.setAttribute('aria-hidden', 'true'); viewport.append(track);
    root.prepend(viewport, pointer);
    let selected = null, drag = null, scrolled = null, lastWheel = 0;
    function paint(value) {
      const minute = TimerTools.minute(value); input.value = String(minute);
      if (selected === minute) return;
      const from = selected === null ? 1 : Math.min(selected, minute) + 1, to = selected === null ? 180 : Math.max(selected, minute);
      for (let i = from; i <= to; i++) ticks[i - 1].classList.toggle('is-past', i <= minute);
      track.style.transform = 'translateX(' + (-(minute - 1) * TimerTools.spacing) + 'px)'; selected = minute;
    }
    function choose(value) {
      const minute = TimerTools.minute(value);
      if (minute === selected) return;
      paint(minute); changed(minute);
    }
    function end(event, cancelled = false) {
      if (!drag || drag.id !== event.pointerId) return;
      if (!cancelled && !drag.moved) {
        const rect = root.getBoundingClientRect();
        choose(TimerTools.moving(drag.value, -(event.clientX - rect.left - rect.width / 2) * (root.clientWidth / rect.width)));
      }
      const id = drag.id; drag = null; root.classList.remove('is-adjusting');
      if (input.hasPointerCapture(id)) input.releasePointerCapture(id);
    }
    input.addEventListener('pointerdown', event => {
      if (input.disabled || event.button !== 0 || event.ctrlKey || event.metaKey) return;
      event.preventDefault(); event.stopPropagation(); input.focus({ preventScroll: true });
      const rect = root.getBoundingClientRect();
      drag = { id: event.pointerId, startX: event.clientX, lastX: event.clientX, value: selected, scale: root.clientWidth / rect.width, moved: false };
      scrolled = null; root.classList.add('is-adjusting'); input.setPointerCapture(event.pointerId);
    });
    input.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const points = (event.clientX - drag.startX) * drag.scale;
      if (Math.abs(points) >= 3) drag.moved = true;
      if (drag.moved) { drag.value = TimerTools.moving(drag.value, (event.clientX - drag.lastX) * drag.scale); drag.lastX = event.clientX; choose(drag.value); }
    });
    input.addEventListener('pointerup', event => end(event));
    input.addEventListener('pointercancel', event => end(event, true));
    input.addEventListener('lostpointercapture', () => { drag = null; root.classList.remove('is-adjusting'); });
    input.addEventListener('input', () => { scrolled = null; paint(Number(input.value)); changed(selected); });
    input.addEventListener('keydown', () => { scrolled = null; });
    input.addEventListener('wheel', event => {
      if (input.disabled || drag || event.ctrlKey || event.metaKey) return;
      event.preventDefault(); event.stopPropagation();
      const now = performance.now(); if (now - lastWheel > 180) scrolled = null; lastWheel = now;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const points = delta * (event.deltaMode === 1 ? TimerTools.spacing : event.deltaMode === 2 ? 82 : 1);
      scrolled = TimerTools.moving(scrolled ?? selected, -points); choose(scrolled);
    }, { passive: false });
    paint(Number(input.value));
    return { paint, cancel() { if (drag) end({ pointerId: drag.id }, true); scrolled = null; } };
  }
  return { mount };
})();
