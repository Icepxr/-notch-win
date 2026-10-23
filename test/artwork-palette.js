'use strict';
const assert = require('node:assert/strict');
const { paletteFrom } = require('../src/renderer/artwork-palette');
const Appearance = require('../src/renderer/notch-appearance');
assert.equal(paletteFrom([255,0,0,255]).sourceColor, '#eb0f0f');
assert.equal(paletteFrom([0,170,170,255]).sourceColor, '#0febeb');
assert.equal(paletteFrom([255,0,0,255,0,255,0,255]).sourceColor, '#ebeb0f', 'the source averages pixels before channel stretching');
assert.equal(paletteFrom([255,0,0,255,0,255,255,255]), null, 'complementary cover colors average to a neutral fallback');
assert.equal(paletteFrom([220,220,220,255]), null); assert.equal(paletteFrom([0,0,0,255]), null);
assert.equal(paletteFrom([5,0,0,255]), null); assert.equal(paletteFrom([255,0,0,0]), null);
assert.equal(paletteFrom([255,0,0,0,0,0,255,255]).sourceColor, '#0f0feb', 'transparent pixels do not introduce their hidden color');
assert.equal(paletteFrom([20,100,100,255]).sourceColor, paletteFrom([40,200,200,255]).sourceColor, 'fixed source stretching does not follow exposure');
for (const rgb of [[255,0,0],[0,255,0],[0,0,255],[150,0,180],[255,100,0],[0,200,200]]) {
  const tint = paletteFrom([...rgb,255]); assert.ok(tint);
  assert.ok(Appearance.contrast(tint.accentColor, '#000000') >= 3, 'interactive music meters remain visible on black');
  assert.equal('surfaceTint' in tint, false, 'artwork never supplies a surface color');
}
for (const invalid of [null, [], [1,2], [1,2,3], [256,0,0,255], [0,NaN,0,255], [0,0,0,-1]]) assert.equal(paletteFrom(invalid), null);
console.log('Artwork tint: source pixel averaging/stretching, alpha, neutral fallback, meter contrast and no surface color passed');
