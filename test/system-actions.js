'use strict';
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { normalize, changes, SystemActions } = require('../src/system-actions');
const sample = value => normalize({ type: 'system-actions', volume: 50, muted: false, brightness: 30, brightnessSerial: 0, capsLock: false, ...value });
const original = sample();
assert.deepEqual(changes(null, original), [], 'startup does not show a phantom adjustment');
assert.deepEqual(changes(original, original), []);
assert.deepEqual(changes(original, sample({ volume: 60 })), [{ action: 'volume', value: 60, muted: false }]);
assert.deepEqual(changes(original, sample({ muted: true })), [{ action: 'volume', value: 50, muted: true }]);
assert.deepEqual(changes(original, sample({ brightness: 40 })), [{ action: 'brightness', value: 40 }]);
assert.deepEqual(changes(original, sample({ capsLock: true })), [{ action: 'capslock', enabled: true }]);
assert.deepEqual(changes(sample({ brightness: null }), sample({ brightness: 10, brightnessSerial: 1 })), [{ action: 'brightness', value: 10 }], 'a brightness event can activate a newly attached supported panel');
assert.deepEqual(changes(original, sample({ volume: null, muted: null, brightness: null })), [], 'unavailable devices never become a zero-level alert');
assert.equal(normalize({ type: 'other' }), null);
assert.equal(sample({ volume: 101 }).volume, null);
assert.equal(sample({ brightness: '50' }).brightness, null);
assert.equal(sample({ brightnessSerial: -1 }).brightnessSerial, 0);
let child, killed = false;
const bridge = new SystemActions({ spawnProcess: (_exe, args, options) => {
  assert.equal(options.windowsHide, true);
  assert.ok(args.includes('-NonInteractive'));
  child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.kill = () => { killed = true; child.emit('close', 0); };
  return child;
} });
const events = []; bridge.on('action', value => events.push(value));
// Launch directly so the protocol tests run on non-Windows CI as well.
bridge.stopped = false; bridge.launch();
child.stdout.write('garbage\n{"type":"system-actions","volume":50,"muted":false,"capsLock":false}\n');
assert.equal(events.length, 0);
child.stdout.write('{"type":"system-actions","volume":');
child.stdout.write('52,"muted":false,"capsLock":false}\n');
assert.deepEqual(events, [{ action: 'volume', value: 52, muted: false }]);
bridge.stop(); assert.equal(killed, true); assert.equal(bridge.child, null);
console.log('System feedback: OS value validation, mute/brightness/lock transitions, partial pipe lines and shutdown passed');

// Stepping aside for a fullscreen app: the bridge reports whether the window
// in front covers a whole monitor, and which monitor that is.
{
  const { normalize, fullscreenChanged } = require('../src/system-actions');
  const base = { type: 'system-actions', volume: 50, muted: false, brightness: 40, brightnessSerial: 0, capsLock: false };
  const windowed = normalize({ ...base, fullscreen: false, monitor: { left: 0, top: 0, right: 1920, bottom: 1080 } });
  const full = normalize({ ...base, fullscreen: true, monitor: { left: 0, top: 0, right: 1920, bottom: 1080 } });
  const other = normalize({ ...base, fullscreen: true, monitor: { left: 1920, top: 0, right: 3840, bottom: 1080 } });

  assert.equal(windowed.fullscreen, false);
  assert.equal(full.fullscreen, true);
  assert.deepEqual(full.monitor, { left: 0, top: 0, right: 1920, bottom: 1080 });

  assert.equal(fullscreenChanged(windowed, full), true, 'going fullscreen is news');
  assert.equal(fullscreenChanged(full, windowed), true, 'leaving fullscreen is news');
  assert.equal(fullscreenChanged(full, full), false, 'staying fullscreen is not');
  assert.equal(fullscreenChanged(windowed, windowed), false);
  assert.equal(fullscreenChanged(full, other), true, 'a fullscreen app moving to another screen is news');
  assert.equal(fullscreenChanged(null, windowed), false, 'the first windowed sample announces nothing');

  // A monitor rectangle that makes no sense is dropped rather than used to
  // decide whether the notch disappears.
  for (const bad of [null, undefined, {}, { left: 0, top: 0, right: 0, bottom: 0 }, { left: 'a', top: 0, right: 1, bottom: 1 }]) {
    assert.equal(normalize({ ...base, fullscreen: true, monitor: bad }).monitor, null, JSON.stringify(bad) + ' is not a monitor');
  }
  assert.equal(normalize({ ...base, fullscreen: 'yes' }).fullscreen, false, 'only a real boolean counts');
}
console.log('Fullscreen detection: monitor parsing and change detection passed');
