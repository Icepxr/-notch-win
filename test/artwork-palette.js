'use strict';

// Palette extraction, on synthetic covers so the answers are knowable.

const assert = require('node:assert');
const { paletteFrom, rgbToHsl, hslToRgb } = require('../src/renderer/artwork-palette');
const { colors, contrast } = require('../src/renderer/notch-appearance');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/** Build RGBA pixel data from [[count, [r,g,b]], ...]. */
function cover(parts) {
  const out = [];
  for (const [count, [r, g, b], alpha = 255] of parts) {
    for (let i = 0; i < count; i += 1) out.push(r, g, b, alpha);
  }
  return out;
}

const hueOf = (hexValue) => {
  const [r, g, b] = hexValue.slice(1).match(/../g).map((p) => parseInt(p, 16));
  return rgbToHsl(r, g, b).h;
};
/** Shortest distance between two hues, in degrees. */
const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

test('hsl conversion round-trips', () => {
  for (const [r, g, b] of [[255, 0, 0], [0, 128, 64], [12, 34, 200], [200, 200, 200]]) {
    const { h, s, l } = rgbToHsl(r, g, b);
    const back = hslToRgb(h, s, l);
    assert.ok(back.every((v, i) => Math.abs(v - [r, g, b][i]) <= 1), [r, g, b] + ' -> ' + back);
  }
});

test('a vivid minority beats a muddy majority', () => {
  // 85% dull brown, 15% vivid orange. Averaging would return the brown.
  const palette = paletteFrom(cover([[850, [92, 74, 58]], [150, [255, 123, 20]]]));
  assert.ok(palette, 'a palette was found');
  assert.ok(hueGap(hueOf(palette.accentColor), 27) < 22,
    'accent follows the orange, got hue ' + Math.round(hueOf(palette.accentColor)));
});

test('a monochrome cover returns null so the user palette stands', () => {
  assert.strictEqual(paletteFrom(cover([[1000, [40, 40, 40]], [200, [210, 210, 210]]])), null);
  assert.strictEqual(paletteFrom(cover([[1000, [0, 0, 0]]])), null, 'a black cover has no hue');
  assert.strictEqual(paletteFrom(cover([[1000, [255, 255, 255]]])), null, 'nor a white one');
});

test('near-black and near-white pixels do not vote', () => {
  // The teal is 4% of the cover but the only thing with a hue in range.
  const palette = paletteFrom(cover([[480, [3, 3, 4]], [480, [252, 252, 253]], [40, [0, 170, 170]]]));
  assert.ok(palette, 'the teal still wins');
  assert.ok(hueGap(hueOf(palette.accentColor), 180) < 20, 'hue is teal');
});

test('hues either side of red do not average into cyan', () => {
  // 352° and 8° are neighbours on the wheel; a plain mean would say 180°.
  const palette = paletteFrom(cover([[500, [255, 0, 60]], [500, [255, 60, 0]]]));
  assert.ok(palette);
  const hue = hueOf(palette.accentColor);
  assert.ok(hueGap(hue, 0) < 30, 'stays red, got ' + Math.round(hue));
});

test('the surface stays dark and the accent stays readable on it', () => {
  for (const [name, rgb] of [['neon green', [0, 255, 60]], ['hot pink', [255, 0, 170]],
    ['deep blue', [10, 20, 220]], ['yellow', [255, 230, 0]]]) {
    const palette = paletteFrom(cover([[1000, rgb]]));
    assert.ok(palette, name + ' produced a palette');
    // What the app actually paints: seeds go through the appearance contract.
    const applied = colors(palette);
    const ratio = contrast(applied.accent, applied.raised);
    assert.ok(ratio >= 4.5, name + ' accent on its own surface is ' + ratio.toFixed(2) + ':1');
  }
});

test('transparent padding is ignored', () => {
  const palette = paletteFrom(cover([[900, [255, 0, 0], 0], [100, [0, 90, 255]]]));
  assert.ok(palette, 'the opaque blue decides it');
  assert.ok(hueGap(hueOf(palette.accentColor), 219) < 25,
    'hue is blue, got ' + Math.round(hueOf(palette.accentColor)));
});

test('malformed input is refused rather than guessed at', () => {
  assert.strictEqual(paletteFrom(null), null);
  assert.strictEqual(paletteFrom([]), null);
  assert.strictEqual(paletteFrom([1, 2]), null);
});

(async function run() {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log('  ok  ' + name);
    } catch (err) {
      failed += 1;
      console.log('FAIL  ' + name);
      console.log('      ' + (err.message || err).toString().split('\n').join('\n      '));
    }
  }
  console.log('');
  console.log(failed ? failed + ' of ' + tests.length + ' failed' : 'all ' + tests.length + ' passed');
  process.exit(failed ? 1 : 0);
})();
