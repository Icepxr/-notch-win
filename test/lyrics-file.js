'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { parseLrc, indexAt, key } = require('../src/renderer/lyrics-state');
const { readLyricsFile } = require('../src/lyrics-file');
(async () => {
  const lines = parseLrc('[ar:Local artist]\n[offset:100]\n[00:10.50][00:20.500]แสงในห้อง\n[00:15]A quiet room\n[00:17]\n[00:99]invalid');
  assert.equal(lines.length, 4); assert.equal(lines[0].at, 10.4); assert.equal(lines[3].at, 20.4);
  assert.equal(indexAt(lines, 10.39), -1); assert.equal(indexAt(lines, 10.4), 0); assert.equal(indexAt(lines, 15), 1);
  assert.equal(indexAt(lines, 17), 2); assert.equal(lines[2].text, ''); assert.equal(indexAt(lines, 999), 3);
  assert.deepEqual(parseLrc('a plain paragraph'), []); assert.deepEqual(parseLrc('x'.repeat(262145)), []);
  assert.notEqual(key({ title: 'A', artist: 'B' }), key({ title: 'A', artist: 'C' }));
  assert.equal(parseLrc('[00:10]Line one\n[00:10]Line two')[0].text, 'Line one\nLine two');
  const dir = await fs.mkdtemp(path.join(__dirname, '..', '.tmp', 'lyrics-test-'));
  const file = path.join(dir, 'local.lrc');
  try {
    await fs.writeFile(file, '\ufeff[00:00]Local verse\n[00:10.25]Another line');
    const result = await readLyricsFile(file); assert.equal(result.status, 'ready'); assert.equal(result.lines[0].text, 'Local verse');
    assert.equal((await readLyricsFile(path.join(dir, 'not.txt'))).status, 'invalid');
    assert.equal((await readLyricsFile(path.join(dir, 'missing.lrc'))).status, 'unavailable');
    await fs.writeFile(file, Buffer.alloc(262145)); assert.equal((await readLyricsFile(file)).status, 'large');
    await fs.writeFile(file, '[ar:Artist]\nno timed lines'); assert.equal((await readLyricsFile(file)).status, 'invalid');
  } finally { await fs.unlink(file); await fs.rmdir(dir); }
  console.log('Local lyrics: timestamps, offsets, Unicode, seeking, metadata separation, file limits and failure states passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
