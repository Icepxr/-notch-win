'use strict';
const assert = require('node:assert/strict');
const { LyricsService } = require('../src/lyrics');
const track = (values = {}) => ({ active: true, title: 'A & B', artist: 'Local Artist', album: 'After Hours', duration: 240, ...values });
(async () => {
  let calls = [], now = 10000;
  const service = new LyricsService({ now: () => now, capacity: 2, request: async (url, signal) => { calls.push({ url, signal }); return { status: 200, data: { syncedLyrics: '[00:00]First\n[00:30]Second' } }; } });
  const result = await service.get(track()); assert.equal(result.status, 'synced'); assert.equal(result.lines.length, 2);
  assert.equal(calls[0].url.origin, 'https://lrclib.net'); assert.equal(calls[0].url.pathname, '/api/get');
  assert.deepEqual(Object.fromEntries(calls[0].url.searchParams), { track_name: 'A & B', artist_name: 'Local Artist', album_name: 'After Hours', duration: '240' });
  assert.strictEqual(await service.get(track()), result); assert.equal(calls.length, 1);
  await service.get(track({ title: 'B', duration: 9000, album: '' })); assert.equal(calls[1].url.searchParams.has('duration'), false); assert.equal(calls[1].url.searchParams.has('album_name'), false);
  await service.get(track({ title: 'C' })); assert.equal(service.cache.size, 2);
  await service.get(track()); assert.equal(calls.length, 4, 'oldest cache entry is evicted');
  const count = calls.length;
  assert.equal((await service.get(track({ artist: '' }))).status, 'missing'); assert.equal(calls.length, count);
  let resolveOld, signal;
  const racing = new LyricsService({ request: (_url, currentSignal) => { signal = currentSignal; return new Promise(resolve => { resolveOld = resolve; }); } });
  const pending = racing.get(track()); assert.strictEqual(racing.get(track()), pending, 'same track shares its in-flight request');
  racing.cancel(); assert.equal(signal.aborted, true); resolveOld({ status: 200, data: { syncedLyrics: '[00:00]Old' } });
  assert.equal((await pending).status, 'cancelled'); assert.equal(racing.cache.size, 0);
  let limitedCalls = 0;
  const limited = new LyricsService({ now: () => now, request: async () => { limitedCalls++; return { status: 429, retryMs: 30000 }; } });
  assert.equal((await limited.get(track())).status, 'limited'); await limited.get(track({ title: 'Other' })); assert.equal(limitedCalls, 1);
  now += 30000; await limited.get(track()); assert.equal(limitedCalls, 2, 'Retry-After is honored');
  for (const [response, status] of [[{ status: 404 }, 'missing'], [{ status: 200, data: { instrumental: true } }, 'instrumental'], [{ status: 500 }, 'unavailable']]) {
    assert.equal((await new LyricsService({ request: async () => response }).get(track())).status, status);
  }
  assert.equal((await new LyricsService({ request: async () => { throw Error('offline'); } }).get(track())).status, 'unavailable');
  const timeout = new LyricsService({ timeout: 10, request: (_url, signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Error('aborted')), { once: true })) });
  const keepAlive = setTimeout(() => {}, 1000);
  try { assert.equal((await timeout.get(track())).status, 'cancelled'); } finally { clearTimeout(keepAlive); }
  console.log('Lyrics service: fixed-host query, exact metadata, cache bounds, deduplication, cancellation, timeout, offline and rate limits passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
