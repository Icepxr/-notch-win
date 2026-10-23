'use strict';
const assert = require('node:assert/strict');
const { plan, Gesture, artworkTint } = require('../src/renderer/notch-motion');
const { NotchTimer } = require('../src/timer');
const small = { width: 184, height: 28 }, large = { width: 520, height: 390 };
const growth = plan(small, large);
assert.deepEqual(growth.sizes.at(-1), large);
assert.ok(growth.envelope.width <= large.width + 12 && growth.envelope.height <= large.height + 12);
assert.ok(growth.duration > 0 && growth.duration < 1500);
const shrink = plan(large, small);
assert.ok(shrink.sizes.every((size, i, all) => !i || (size.width <= all[i - 1].width && size.height <= all[i - 1].height)));
assert.ok(shrink.sizes.every((size) => size.width >= small.width && size.height >= small.height));
assert.equal(artworkTint([.5, .5, .5]), null);
assert.ok(artworkTint([.8, .2, .1]).every((value) => value >= 0 && value <= 255));

const gesture = new Gesture();
let time = 0;
function feed(x, y, extra = {}) { time += 10; return gesture.handle({ x, y, time, vertical: true, horizontal: true, expanded: false, ...extra }); }
assert.equal(feed(0, 5), null);
assert.equal(feed(0, 10), null);
assert.equal(feed(0, 10), 'open');
assert.equal(feed(0, -100, { expanded: true }), null);
time += 400;
assert.equal(feed(0, -30, { expanded: true }), 'close');
time += 400;
assert.equal(feed(-10, 0), null);
assert.equal(feed(-35, 0), 'next');
assert.equal(feed(-100, 0), null);
time += 400;
assert.equal(feed(40, 40), null);
time += 400;
assert.equal(feed(0, 40, { vertical: false, horizontal: false }), null);
assert.equal(feed(0, 40), null, 'a sequence that began over a control stays blocked');

let now = 0;
const timer = new NotchTimer({ now: () => now });
timer.command('start', { mode: 'timer', minutes: 1 });
now = 20; timer.command('pause');
assert.equal(timer.snapshot().reading, 40);
now = 200; timer.command('resume');
assert.equal(timer.snapshot().reading, 40);
now = 1000;
assert.equal(timer.finishIfDue(), true);
assert.equal(timer.snapshot().completed, true);
timer.command('reset'); now = 2000;
timer.command('start', { mode: 'stopwatch' }); now += 12.5;
assert.equal(timer.snapshot().reading, 12.5);
timer.command('pause'); now += 50;
assert.equal(timer.snapshot().reading, 12.5);
timer.command('reset');
timer.command('start', { mode: 'pomodoro', minutes: 1 }); now += 61;
timer.finishIfDue();
assert.equal(timer.snapshot().phase, 'focus');
assert.equal(timer.snapshot().canNext, true);
timer.command('next');
assert.equal(timer.snapshot().phase, 'shortBreak');
assert.equal(timer.snapshot().duration, 300);
console.log('Notch source ports: spring bounds, gesture sequences and timer lifecycle passed');

// The silhouette is a rule, not a table. These numbers come from the source
// spec: shoulder min(14, h*0.19) and corner min(28, h*0.34), with a capsule
// rounded to half its height instead.
{
  const Geometry = require('../src/renderer/notch-geometry');

  assert.equal(Geometry.shoulderFor(28).toFixed(2), '5.32');
  assert.equal(Geometry.shoulderFor(46).toFixed(2), '8.74');
  assert.equal(Geometry.shoulderFor(390), 14, 'the shoulder stops growing at its maximum');
  assert.equal(Geometry.shoulderFor(0), 0);

  assert.equal(Geometry.radiusFor(28, 'notch').toFixed(2), '9.52');
  assert.equal(Geometry.radiusFor(46, 'notch').toFixed(2), '15.64');
  assert.equal(Geometry.radiusFor(390, 'notch'), 28, 'the corner stops growing too');
  assert.equal(Geometry.radiusFor(28, 'capsule'), 14, 'a resting capsule is a half-round end');
  assert.equal(Geometry.radiusFor(390, 'capsule'), 28, 'a tall capsule is bounded like the notch');

  // Negative or absent heights can arrive mid-morph; they must not produce a
  // negative radius, which paints as a square corner without warning.
  for (const bad of [-20, NaN]) {
    assert.ok(!(Geometry.shoulderFor(bad) < 0), 'shoulder stays positive for ' + bad);
    assert.ok(!(Geometry.radiusFor(bad, 'notch') < 0), 'radius stays positive for ' + bad);
  }

  assert.equal(Geometry.borderRadiusFor(28, 'capsule'), '14px', 'a capsule is round all the way round');
  assert.ok(Geometry.borderRadiusFor(28, 'notch').startsWith('0 0 '), 'a notch keeps square top corners');
}

// Module names and shortcut positions come from one place, so that reordering
// or hiding a module cannot leave Alt+N pointing at the wrong page.
{
  const Modules = require('../src/renderer/notch-modules');
  assert.equal(Modules.names.send, 'Send files');
  assert.equal(Modules.names.ai, 'AI Monitor');
  assert.equal(new Set(Object.values(Modules.names)).size, Modules.ids.length, 'no two modules share a name');

  const reordered = Modules.visible({ moduleOrder: ['notes', 'send'], hiddenModules: ['clipboard'] });
  assert.equal(reordered[0], 'notes', 'the user\'s order wins over the declaration order');
  assert.ok(!reordered.includes('clipboard'), 'a hidden module takes no shortcut slot');
  assert.equal(reordered.length, Modules.ids.length - 1);
}
