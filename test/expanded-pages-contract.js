'use strict';
const assert = require('node:assert/strict');
const Pages = require('../src/renderer/expanded-pages');
const Appearance = require('../src/renderer/notch-appearance');
// Public contrast guarantee, checked over an RGB cube rather than reproducing
// the implementation's adjustment algorithm or hard-coding its output shades.
for (const r of [0,32,96,160,224,255]) for (const g of [0,32,96,160,224,255]) for (const b of [0,32,96,160,224,255]) {
  const color = '#' + [r,g,b].map(c=>c.toString(16).padStart(2,'0')).join('');
  const result = Pages.timeColor(color);
  assert.ok(Appearance.contrast(result,'#000000')>=4.5, color + ' must be readable as text');
  if (Appearance.contrast(color,'#000000')>=4.5) assert.equal(result,color,'already-readable artwork colors must stay unchanged');
}
assert.equal(Pages.timeColor('invalid'),'#ffffff');
assert.equal(Pages.requestFor('unmounted'),null);
console.log('Expanded pages: 216 artwork colors hold 4.5:1 text contrast; readable colors and unmounted requests stay unchanged');
