'use strict';
const assert = require('node:assert/strict');
const { Controller } = require('../src/renderer/media-playback');
let now = 10000, timerId = 0, sends = [], feedback = '', timers = new Map(), paints = 0, queued = true;
const control = new Controller({ now: () => now, change: () => paints++, error: text => { feedback = text; },
  send: (action, value, playback) => { sends.push({ action, value, ...playback }); return queued; },
  setTimer: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, at: now + ms }); return id; }, clearTimer: id => timers.delete(id) });
const line = (values = {}) => ({ type: 'state', session: true, app: 'Spotify.exe', title: 'Track', artist: 'Artist',
  status: 'Playing', canPlay: true, canPause: true, position: 30, duration: 240, ...values });
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
const result = (request, via = 'winrt') => control.result({ type: 'command', action: request.action, id: request.id, via });
(async () => {
  control.receive(line()); const firstPaint = paints; now += 1000; control.toggle();
  assert.equal(control.view().playing, false); assert.equal(control.view().position, 31); assert.ok(paints > firstPaint, 'a click paints synchronously before IPC');
  await flush(); assert.equal(sends[0].action, 'pause'); assert.equal(sends[0].app, 'Spotify.exe');
  now += 100; control.receive(line({ position: 32 })); assert.equal(control.view().playing, false, 'a stale playing poll cannot undo a pause click');
  result(sends[0]); assert.equal(control.view().playing, false); assert.ok(control.pending, 'acknowledgement alone cannot invent a confirmed state');
  now += 100; control.receive(line({ status: 'Paused', position: 31 })); assert.equal(control.pending, null); assert.equal(control.view().playing, false);
  control.toggle(); await flush(); assert.equal(sends.at(-1).action, 'play');
  control.receive(line({ status: 'Paused', position: 31 })); assert.equal(control.view().playing, true);
  const play = sends.at(-1); result(play); control.receive(line({ position: 31 })); assert.equal(control.pending, null);
  sends = []; control.toggle(); await flush(); const pause = sends[0]; control.toggle(); control.toggle(); control.toggle();
  assert.equal(control.view().playing, true); assert.equal(sends.length, 1, 'rapid clicks coalesce behind one in-flight command');
  result(pause); await flush(); assert.equal(sends.length, 2); assert.equal(sends[1].action, 'play');
  control.receive(line({ status: 'Paused' })); assert.equal(control.view().playing, true);
  result(pause, 'none'); assert.equal(control.view().playing, true, 'a retired failure cannot roll back the newest intent');
  result(sends[1]); control.receive(line()); assert.equal(control.pending, null);
  sends = []; control.toggle(); await flush(); result(sends[0]); control.toggle(); await flush();
  assert.equal(sends.length, 2, 'clicking again after an ack need not wait for a slow state poll');
  result(sends[1]); control.receive(line()); assert.equal(control.pending, null);
  sends = []; control.toggle(); await flush(); control.receive(line({ position: 88 })); result(sends[0], 'none');
  assert.equal(control.view().playing, true); assert.equal(control.view().position, 88); assert.match(feedback, /declined/);
  queued = false; control.toggle(); await flush(); assert.equal(control.pending, null); assert.equal(control.view().playing, true); queued = true;
  control.toggle(); await flush(); const stale = sends.at(-1); now += 5600;
  for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); }
  assert.equal(control.pending, null); assert.equal(control.view().playing, true); assert.match(feedback, /did not confirm/); result(stale, 'none');
  control.toggle(); await flush(); const oldSource = sends.at(-1); control.receive(line({ app: 'msedge.exe', title: 'Another track', status: 'Paused' }));
  result(oldSource, 'none'); assert.equal(control.view().app, 'msedge.exe'); assert.equal(control.view().playing, false);
  control.toggle(); control.receive({ type: 'state', session: false }); await flush(); assert.equal(control.view().active, false); assert.equal(timers.size, 0);
  control.reset(); assert.equal(control.view().active, false);
  console.log('Playback intent: immediate paint, stale polls, correlated acks, coalescing, retries, deadlines and source changes passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
