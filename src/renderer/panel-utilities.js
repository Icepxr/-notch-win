'use strict';
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Vorssaint
// NotchTimerView / NotchTimerSupport: centered ruler, saved cycle setup,
// explicit next phases and rolling readings, backed by the Windows timer service.
window.UtilityPanels = (() => {
  let timerRoot, timer = { hasSession: false }, bridge, ruler, saveTimer, busy = false;
  let setup = TimerTools.preferences(), failure = '';
  try { setup = TimerTools.preferences(JSON.parse(localStorage.getItem('timer-view') || '{}')); } catch {}
  function clock(value, up = false) {
    const seconds = Math.min(359999, Math.max(0, up ? Math.floor(value || 0) : Math.ceil(value || 0)));
    return (seconds >= 3600 ? Math.floor(seconds / 3600) + ':' : '')
      + String(Math.floor(seconds / 60) % 60).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }
  const phaseName = { timer: 'Timer', stopwatch: 'Stopwatch', focus: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' };
  const symbols = { play: 'm7 4 10 6-10 6Z', pause: 'M6 4h3v12H6zM12 4h3v12h-3z', check: 'm4 10 4 4 8-8' };
  function saveSetup() {
    clearTimeout(saveTimer);
    const previous = failure;
    try { localStorage.setItem('timer-view', JSON.stringify(setup)); if (failure.startsWith('Could not save')) failure = ''; }
    catch { failure = 'Could not save setup. These choices are kept for this window.'; }
    if (previous !== failure) paintTimer(); else showFailure();
  }
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveSetup, 180); }
  function showFailure() {
    if (!timerRoot) return;
    const node = timerRoot.querySelector('#timer-status'); node.textContent = failure || (busy ? 'Updating timer…' : ''); node.hidden = !failure && !busy;
    timerRoot.setAttribute('aria-busy', String(busy));
  }
  function selectMinutes(value) {
    if (timer.hasSession) return;
    const minutes = TimerTools.minute(value);
    if (setup.mode === 'pomodoro') setup.configuration.focus = minutes; else setup.minutes = minutes;
    paintTimer(); scheduleSave();
  }
  function phaseTitle() { return timer.cycleFinished ? 'Cycle complete' : timer.completed ? 'Time is up' : phaseName[timer.phase]; }
  function paintClock(value) {
    const node = timerRoot.querySelector('#timer-clock'), previous = node.dataset.reading;
    node.setAttribute('aria-label', (timer.hasSession ? phaseTitle() : phaseName[setup.mode === 'pomodoro' ? 'focus' : setup.mode]) + ': ' + value);
    if (value === previous) return;
    if (!previous || previous.length !== value.length) {
      node.replaceChildren(...Array.from(value, character => {
        const digit = document.createElement('span'); digit.textContent = character;
        digit.className = character === ':' ? 'timer-colon' : 'timer-digit'; digit.setAttribute('aria-hidden', 'true'); return digit;
      }));
    } else [...node.children].forEach((digit, i) => {
      if (digit.textContent === value[i]) return;
      digit.getAnimations().forEach(animation => animation.cancel()); digit.textContent = value[i];
      if (timer.hasSession && timerRoot.classList.contains('is-active') && document.body.classList.contains('state-open') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        digit.animate([{ transform: 'translateY(' + (timer.countsUp ? 8 : -8) + 'px)', opacity: .25 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.7,.3,1)' });
      }
    });
    node.dataset.reading = value;
  }
  async function command(action) {
    if (busy) return;
    const focusedControl = ['timer-action', 'timer-reset'].includes(document.activeElement.id) ? document.activeElement : null;
    busy = true; failure = ''; saveSetup(); paintTimer();
    try {
      const result = await bridge.timerCommand(action, { mode: setup.mode, minutes: setup.minutes, configuration: { ...setup.configuration } });
      if (!result || typeof result.hasSession !== 'boolean') throw new Error('Missing timer reply');
      updateTimer(result);
    } catch { failure = 'Could not update the timer. Try again.'; }
    finally {
      busy = false; paintTimer();
      if (focusedControl && document.activeElement === document.body && timerRoot.classList.contains('is-active') && document.body.classList.contains('state-open')) {
        const target = focusedControl.hidden ? timerRoot.querySelector('#timer-action') : focusedControl;
        target.focus({ preventScroll: true });
      }
    }
  }
  function mount(api) {
    bridge = api; timerRoot = document.querySelector('[data-panel="timer"]');
    const readouts = [['shortBreak', 'Short break', 60, ' min'], ['longBreak', 'Long break', 60, ' min'], ['interval', 'Long break every', 24, ' rounds'], ['sessions', 'Sessions', 24, '']];
    timerRoot.innerHTML = `<div class="timer-toolbar"><div class="utility-modes" role="group" aria-label="Timer mode">
      <button data-mode="timer" aria-pressed="true">Timer</button><button data-mode="pomodoro" aria-pressed="false">Focus</button><button data-mode="stopwatch" aria-pressed="false">Stopwatch</button></div>
      <div class="timer-session-heading" hidden><strong id="timer-session-phase"></strong><span id="timer-session-progress"></span></div>
      <button id="timer-reset" class="utility-secondary" type="button">End</button></div>
      <div class="timer-stage"><div class="timer-duration"><div class="timer-ruler"><input id="timer-minutes" aria-label="Duration in minutes" type="range" min="1" max="180" step="1" value="5" title="Drag, scroll, or use arrow keys to choose minutes"/></div><span id="timer-minutes-label">5 min</span></div>
      <div class="timer-face"><span id="timer-phase">Timer</span><strong id="timer-clock" role="timer" aria-live="off"></strong><span id="timer-description">Select a duration</span></div>
      <button id="timer-action" class="utility-primary" type="button">Start</button></div>
      <div class="timer-presets"><button data-minutes="5">5 min</button><button data-minutes="15">15 min</button><button data-minutes="25">25 min</button></div>
      <div class="timer-cycle-settings" role="group" aria-label="Focus cycle setup" hidden>${readouts.map(([key, label, max, suffix]) => `<label><span>${label}</span><select data-timer-setting="${key}" aria-label="${label}">${Array.from({ length: max }, (_, i) => `<option value="${i + 1}">${i + 1}${suffix}</option>`).join('')}</select></label>`).join('')}</div>
      <p id="timer-status" role="status" hidden></p>`;
    ruler = TimerRuler.mount(timerRoot.querySelector('#timer-minutes'), selectMinutes);
    timerRoot.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
      if (timer.hasSession || busy) return;
      ruler.cancel(); setup.mode = button.dataset.mode; paintTimer(); scheduleSave();
    }));
    timerRoot.querySelectorAll('[data-minutes]').forEach(button => button.addEventListener('click', () => selectMinutes(Number(button.dataset.minutes))));
    timerRoot.querySelectorAll('[data-timer-setting]').forEach(select => select.addEventListener('change', () => {
      if (timer.hasSession || busy) return;
      setup.configuration = TimerTools.configuration({ ...setup.configuration, [select.dataset.timerSetting]: Number(select.value) }); paintTimer(); scheduleSave();
    }));
    timerRoot.querySelector('#timer-reset').addEventListener('click', () => command('reset'));
    timerRoot.querySelector('#timer-action').addEventListener('click', () => command(timer.canNext ? 'next' : timer.running ? 'pause' : timer.paused ? 'resume' : timer.completed ? 'reset' : 'start'));
    window.addEventListener('beforeunload', saveSetup);
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
      if (event.matches) timerRoot.querySelectorAll('.timer-digit').forEach(digit => digit.getAnimations().forEach(animation => animation.cancel()));
    });
    paintTimer(); NotesPanel.mount(document.querySelector('[data-panel="notes"]'), bridge);
  }
  function paintTimer() {
    if (!timerRoot) return;
    const mode = timer.hasSession ? timer.mode : setup.mode;
    timerRoot.dataset.mode = mode; timerRoot.classList.toggle('has-session', Boolean(timer.hasSession));
    timerRoot.classList.toggle('is-paused', Boolean(timer.paused)); timerRoot.classList.toggle('is-complete', Boolean(timer.completed));
    const modes = timerRoot.querySelector('.utility-modes'); modes.hidden = timer.hasSession;
    timerRoot.querySelectorAll('[data-mode]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.mode === mode)); button.disabled = timer.hasSession || busy; });
    const minutes = mode === 'pomodoro' ? setup.configuration.focus : setup.minutes, input = timerRoot.querySelector('#timer-minutes');
    ruler.paint(minutes); input.setAttribute('aria-valuetext', minutes + ' minutes'); input.setAttribute('aria-label', mode === 'pomodoro' ? 'Focus duration in minutes' : 'Duration in minutes'); input.disabled = timer.hasSession || busy;
    timerRoot.querySelector('#timer-minutes-label').textContent = minutes + ' min';
    timerRoot.querySelector('.timer-duration').hidden = timer.hasSession || mode === 'stopwatch';
    timerRoot.querySelector('.timer-presets').hidden = timer.hasSession || mode !== 'timer';
    timerRoot.querySelector('.timer-cycle-settings').hidden = timer.hasSession || mode !== 'pomodoro';
    timerRoot.querySelectorAll('[data-timer-setting]').forEach(select => { select.value = String(setup.configuration[select.dataset.timerSetting]); select.disabled = timer.hasSession || busy; });
    const heading = timerRoot.querySelector('.timer-session-heading'); heading.hidden = !timer.hasSession;
    timerRoot.querySelector('#timer-session-phase').textContent = timer.hasSession ? phaseTitle() : '';
    timerRoot.querySelector('#timer-session-progress').textContent = timer.hasSession && mode === 'pomodoro' ? 'Session ' + timer.sessionNumber + ' of ' + timer.configuration.sessions : '';
    paintClock(clock(timer.hasSession ? timer.reading : mode === 'stopwatch' ? 0 : minutes * 60, mode === 'stopwatch'));
    timerRoot.querySelector('#timer-phase').textContent = phaseName[timer.hasSession ? timer.phase : mode === 'pomodoro' ? 'focus' : mode];
    timerRoot.querySelector('#timer-description').textContent = timer.cycleFinished ? 'You finished every focus session' : timer.completed && timer.canNext ? (timer.nextPhase === 'focus' ? 'Ready for your next focus session' : 'Ready for a ' + timer.configuration[timer.nextPhase] + ' minute break') : timer.completed ? 'Time is up' : timer.paused ? 'Paused' : timer.running ? (mode === 'pomodoro' ? 'One session at a time' : 'Take your time') : mode === 'pomodoro' ? 'Set your focus and rest rhythm' : mode === 'stopwatch' ? 'Ready when you are' : 'Select a duration';
    const reset = timerRoot.querySelector('#timer-reset'); reset.hidden = !timer.hasSession; reset.disabled = busy;
    reset.textContent = timer.completed && !timer.canNext ? 'Done' : 'End'; reset.setAttribute('aria-label', timer.completed ? 'Dismiss completed timer' : 'End this timer');
    const action = timerRoot.querySelector('#timer-action'), label = timer.canNext ? 'Start ' + phaseName[timer.nextPhase].toLowerCase() : timer.running ? 'Pause' : timer.paused ? 'Resume' : timer.completed ? 'Done' : 'Start';
    if (action.dataset.label !== label || action.dataset.session !== String(timer.hasSession)) {
      action.innerHTML = timer.hasSession ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="' + symbols[timer.running ? 'pause' : timer.completed && !timer.canNext ? 'check' : 'play'] + '"/></svg>' : 'Start';
      action.dataset.label = label; action.dataset.session = String(timer.hasSession);
    }
    action.setAttribute('aria-label', label); action.title = label; action.disabled = busy;
    showFailure();
    const layoutKey = mode + ':' + Boolean(timer.hasSession) + ':' + Boolean(failure);
    if (timerRoot.dataset.layout !== layoutKey) { timerRoot.dataset.layout = layoutKey; timerRoot.dispatchEvent(new CustomEvent('notch:layout', { bubbles: true })); }
  }
  function updateTimer(value) { timer = { ...value, configuration: TimerTools.configuration(value?.configuration) }; if (timer.hasSession) ruler?.cancel(); paintTimer(); }
  function updateNote(value) { NotesPanel.update(value); }
  function preferredHeight() { return window.ExpandedPages?.requestFor('timer')?.requested || (timer.hasSession ? 230 : setup.mode === 'pomodoro' ? 280 : 260) + (failure ? 24 : 0); }
  return { mount, updateTimer, updateNote, clock, phaseName, preferredHeight, hasSession: () => Boolean(timer.hasSession) };
})();
