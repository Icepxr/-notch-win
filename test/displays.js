'use strict';
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { DisplayController, selectDisplay, placement, pointerInside } = require('../src/displays');
const Geometry = require('../src/renderer/notch-geometry');
const make = (id, x, y, width, height, scaleFactor = 1) => ({ id, label: 'Display ' + id, internal: id === 1,
  bounds: { x, y, width, height }, workArea: { x, y, width, height: height - 40 }, scaleFactor });
const main = make(1, 0, 0, 1920, 1080), left = make(2, -2560, -360, 2560, 1440, 1.5), top = make(3, 240, -1080, 1920, 1080, 2);
assert.equal(selectDisplay([main, left], 1, { displayId: 2 }).id, 2);
assert.equal(selectDisplay([main], 1, { displayId: 2 }).id, 1);
assert.equal(selectDisplay([main, left], 1, { displayMode: 'primary', displayId: 2 }).id, 1);
assert.equal(selectDisplay([main, left], 1, { displayMode: 'cursor' }, { x: -1000, y: -100 }).id, 2);
assert.equal(selectDisplay([main, top], 1, { displayMode: 'cursor' }, { x: 800, y: -500 }).id, 3);
assert.equal(selectDisplay([main, { ...left, id: 22 }], 1, { displayId: 2, displayLabel: left.label, displayInternal: false }).id, 22, 'one matching monitor name survives a new Windows ID');
assert.equal(selectDisplay([main, { ...left, id: 22 }, { ...left, id: 23 }], 1, { displayId: 2, displayLabel: left.label, displayInternal: false }).id, 1, 'duplicate monitor names do not choose a random display');
const p = placement(left);
assert.equal(p.bounds.x, -1566); assert.equal(p.bounds.y, -360);
assert.equal(p.zoomFactor, 1, 'DIP bounds are not multiplied by Windows scaling');
assert.equal(placement(top, 'capsule').bounds.y, -1072);
const small = make(4, 2000, 0, 640, 480, 2);
const fitted = placement(small);
assert.ok(fitted.zoomFactor < 1 && fitted.bounds.y + fitted.bounds.height <= small.workArea.height);
assert.ok(fitted.bounds.width <= small.bounds.width);
const region = { x: (Geometry.hostSize.width - 184) / 2, y: 0, width: 184, height: 28, radius: 10 };
const point = { x: fitted.bounds.x + Geometry.hostSize.width / 2 * fitted.zoomFactor, y: 14 * fitted.zoomFactor };
assert.equal(pointerInside(region, point, fitted.bounds, fitted.zoomFactor), true);
assert.equal(pointerInside(region, { ...point, y: 90 }, fitted.bounds, fitted.zoomFactor), false, 'transparent areas remain click-through at fitted zoom');

const screen = new EventEmitter(); let displays = [main, left], cursor = { x: 100, y: 100 }, primaryId = 1;
screen.getAllDisplays = () => displays;
screen.getPrimaryDisplay = () => displays.find((d) => d.id === primaryId);
screen.getCursorScreenPoint = () => cursor;
let settings = { displayId: 2, displayLabel: left.label, displayInternal: false }, now = 0, canFollow = true;
let bounds = p.bounds, zoom = 1, moves = 0;
const win = { isDestroyed: () => false, getBounds: () => bounds, setBounds: (b) => { bounds = b; moves++; },
  webContents: { getZoomFactor: () => zoom, setZoomFactor: (z) => { zoom = z; } } };
const controller = new DisplayController({ screen, settings: () => settings, now: () => now, canFollow: () => canFollow });
controller.initialPlacement(); controller.attach(win); controller.start();
async function settle() { await new Promise((resolve) => setTimeout(resolve, 150)); }
(async () => {
  try {
    displays = [main]; screen.emit('display-removed', {}, left); await settle();
    assert.equal(controller.currentId, 1); assert.equal(controller.snapshot().missing, true);
    assert.equal(settings.displayId, 2, 'disconnect fallback does not erase the preferred display');
    displays = [main, left]; screen.emit('display-added', {}, left); await settle();
    assert.equal(controller.currentId, 2); assert.equal(controller.snapshot().missing, false);
    settings = { ...settings, displayMode: 'primary' }; controller.settingsChanged();
    primaryId = 2; screen.emit('display-metrics-changed', {}, left, ['bounds']); await settle(); assert.equal(controller.currentId, 2);
    settings = { ...settings, displayMode: 'cursor' }; controller.settingsChanged();
    assert.equal(controller.currentId, 1);
    cursor = { x: -100, y: 100 }; controller.tick(); now += 200; controller.tick(); assert.equal(controller.currentId, 1, 'cursor must settle before moving the notch');
    now += 201; controller.tick(); assert.equal(controller.currentId, 2);
    canFollow = false; cursor = { x: 100, y: 100 }; controller.tick(); now += 1000; controller.tick(); assert.equal(controller.currentId, 2, 'an open panel or transfer cannot chase the cursor');
    displays = [main]; primaryId = 1; screen.emit('display-removed', {}, left); await settle(); assert.equal(controller.currentId, 1, 'disconnect recovers even while the panel is open');
    const before = moves; controller.apply(); controller.apply(); assert.equal(moves, before, 'unchanged metrics never resize the native surface');
    displays = [small]; primaryId = 4; controller.apply(); assert.equal(zoom, fitted.zoomFactor);
    console.log('Displays: mixed DPI, negative coordinates, docking, primary/cursor modes, fitted zoom and click-through passed');
  } finally { controller.stop(); assert.equal(screen.listenerCount('display-added'), 0); }
})().catch((error) => { console.error(error); process.exitCode = 1; });

// Leaving is judged against a slightly larger region than entering, so a
// pointer resting on the boundary does not flip the answer on every poll.
{
  const { growRegion, pointerInside } = require('../src/displays');
  const region = { x: 100, y: 0, width: 200, height: 40, radius: 12, topRadius: 0 };
  const bounds = { x: 0, y: 0 };
  const at = (x, y, r = region) => pointerInside(r, { x, y }, bounds, 1);

  assert.equal(at(200, 20), true, 'well inside is inside');
  assert.equal(at(200, 44), false, 'four pixels below the edge is outside');
  assert.equal(at(200, 44, growRegion(region, 6)), true, 'but still within the margin that keeps hover held');
  assert.equal(at(200, 52, growRegion(region, 6)), false, 'and far enough out is out even with the margin');

  const grown = growRegion(region, 6);
  assert.equal(grown.width, region.width + 12);
  assert.equal(grown.height, region.height + 12);
  assert.equal(grown.x, region.x - 6);
  assert.equal(grown.radius, region.radius + 6, 'the corners grow with it, or the margin would square them off');

  assert.equal(growRegion(region, 0), region, 'no margin returns the region untouched');
  assert.equal(growRegion(null, 6), null);
  assert.equal(growRegion(region, NaN), region, 'and nonsense is ignored rather than producing NaN edges');
}
console.log('Hover hysteresis: the leave test uses a larger region than the enter test');
