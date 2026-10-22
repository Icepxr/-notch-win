'use strict';
// Timer and notes views for the notch. Timer session logic lives in the main
// process, so a collapsed surface or renderer refresh never stops an active
// countdown. Settings are their own window; see src/renderer/settings.js.
window.UtilityPanels = (() => {
  let timerRoot, notesRoot, timer = { hasSession: false }, bridge;
  let noteTimer = null;
  function clock(value, up = false) {
    const seconds = Math.min(359999, Math.max(0, up ? Math.floor(value || 0) : Math.ceil(value || 0)));
    return (seconds >= 3600 ? Math.floor(seconds / 3600) + ':' : '')
      + String(Math.floor(seconds / 60) % 60).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }
  const phaseName = { timer: 'Timer', stopwatch: 'Stopwatch', focus: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' };
  function mount(api) {
    bridge = api;
    timerRoot = document.querySelector('[data-panel="timer"]');
    timerRoot.innerHTML = `<div class="utility-modes" role="group" aria-label="Timer mode">
      <button data-mode="timer" aria-pressed="true">Timer</button><button data-mode="pomodoro" aria-pressed="false">Focus</button><button data-mode="stopwatch" aria-pressed="false">Stopwatch</button></div>
      <div class="timer-face"><span id="timer-phase">Timer</span><strong id="timer-clock">05:00</strong><span id="timer-description">Make a little room for focus.</span></div>
      <div class="timer-duration"><input id="timer-minutes" aria-label="Duration in minutes" type="range" min="1" max="180" value="5"/><span id="timer-minutes-label">5 min</span></div>
      <div class="timer-presets"><button data-minutes="5">5 min</button><button data-minutes="15">15 min</button><button data-minutes="25">25 min</button></div>
      <div class="utility-actions"><button id="timer-reset" class="utility-secondary">Reset</button><button id="timer-action" class="utility-primary">Start</button></div>`;
    timerRoot.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => {
      if (timer.hasSession) return;
      timerRoot.dataset.mode = button.dataset.mode;
      timerRoot.querySelector('#timer-minutes').value = button.dataset.mode === 'pomodoro' ? 25 : 5;
      paintTimer();
    }));
    timerRoot.querySelectorAll('[data-minutes]').forEach((button) => button.addEventListener('click', () => {
      timerRoot.querySelector('#timer-minutes').value = button.dataset.minutes;
      paintTimer();
    }));
    timerRoot.querySelector('#timer-minutes').addEventListener('input', paintTimer);
    timerRoot.querySelector('#timer-reset').addEventListener('click', () => bridge.timerCommand('reset').then(updateTimer));
    timerRoot.querySelector('#timer-action').addEventListener('click', async () => {
      const action = timer.canNext ? 'next' : timer.running ? 'pause' : timer.paused ? 'resume' : timer.completed ? 'reset' : 'start';
      updateTimer(await bridge.timerCommand(action, { mode: timerRoot.dataset.mode || 'timer', minutes: Number(timerRoot.querySelector('#timer-minutes').value) }));
    });
    timerRoot.dataset.mode = 'timer';
    paintTimer();

    notesRoot = document.querySelector('[data-panel="notes"]');
    notesRoot.innerHTML = `<textarea id="scratchpad" class="scratchpad" maxlength="100000" placeholder="A thought worth keeping…" aria-label="Notes"></textarea><div class="section-head"><span class="section-meta" id="note-status" role="status">Saved only on this device</span><span class="section-meta" id="note-count">0 characters</span></div>`;
    notesRoot.querySelector('textarea').addEventListener('input', () => {
      const text = notesRoot.querySelector('textarea').value;
      bridge.cacheNote(text);
      notesRoot.querySelector('#note-count').textContent = text.length.toLocaleString() + ' characters';
      notesRoot.querySelector('#note-status').textContent = 'Saving…';
      clearTimeout(noteTimer);
      // The invoke acknowledges an atomic disk write, rather than a UI-only save.
      noteTimer = setTimeout(async () => {
        let ok = false;
        try { ok = await bridge.saveNote(text); } catch {}
        if (notesRoot.querySelector('textarea').value === text) notesRoot.querySelector('#note-status').textContent = ok ? 'Saved locally' : 'Cannot save. Try editing again.';
      }, 250);
    });
    notesRoot.querySelector('textarea').addEventListener('keydown', async (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      clearTimeout(noteTimer);
      const ok = await bridge.saveNote(notesRoot.querySelector('textarea').value);
      notesRoot.querySelector('#note-status').textContent = ok ? 'Saved locally' : 'Cannot save';
    });
  }

  function paintTimer() {
    if (!timerRoot) return;
    const mode = timer.hasSession ? timer.mode : timerRoot.dataset.mode;
    timerRoot.dataset.mode = mode;
    timerRoot.querySelectorAll('[data-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
      button.disabled = timer.hasSession;
    });
    const minutes = Number(timerRoot.querySelector('#timer-minutes').value);
    timerRoot.querySelector('#timer-minutes-label').textContent = minutes + ' min';
    timerRoot.querySelector('#timer-minutes').disabled = timer.hasSession;
    timerRoot.querySelector('.timer-duration').hidden = mode === 'stopwatch';
    timerRoot.querySelector('.timer-presets').hidden = timer.hasSession || mode === 'stopwatch';
    timerRoot.querySelector('#timer-clock').textContent = clock(timer.hasSession ? timer.reading : mode === 'stopwatch' ? 0 : minutes * 60, mode === 'stopwatch');
    timerRoot.querySelector('#timer-phase').textContent = phaseName[timer.hasSession ? timer.phase : mode === 'pomodoro' ? 'focus' : mode];
    timerRoot.querySelector('#timer-description').textContent = timer.completed ? 'Time is up' : timer.paused ? 'Paused. Pick up where you left off.' : mode === 'pomodoro' ? 'Focus and rest · 4 focus sessions' : 'Make a little room for focus.';
    timerRoot.querySelector('#timer-reset').hidden = !timer.hasSession;
    timerRoot.querySelector('#timer-action').textContent = timer.canNext ? 'Next session' : timer.running ? 'Pause' : timer.paused ? 'Resume' : timer.completed ? 'Done' : 'Start';
  }
  function updateTimer(value) { timer = value || { hasSession: false }; paintTimer(); }
  function updateNote(value) {
    if (!notesRoot) return;
    notesRoot.querySelector('textarea').value = value || '';
    notesRoot.querySelector('#note-count').textContent = (value || '').length.toLocaleString() + ' characters';
  }
  return { mount, updateTimer, updateNote, clock, phaseName };
})();
