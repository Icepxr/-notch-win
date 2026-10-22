'use strict';

// Exercises the Now Playing reducer: bridge JSON in, the state the notch
// paints out. No window, no PowerShell, no SMTC.

const assert = require('node:assert');

const {
  EMPTY,
  PAUSED_GRACE_MS,
  appLabel,
  parseBridgeLine,
  nextState,
  isActive,
  positionAt,
  formatClock,
} = require('../src/renderer/media-state');

const T0 = 1700000000000;

/** A state line shaped the way the bridge writes them. */
function line(extra = {}) {
  return {
    type: 'state',
    session: true,
    title: 'Blue Monday',
    artist: 'New Order',
    album: 'Power, Corruption & Lies',
    app: 'Spotify.exe',
    status: 'Playing',
    position: 30,
    duration: 270,
    lastUpdated: T0,
    canPlay: false,
    canPause: true,
    canNext: true,
    canPrev: true,
    ...extra,
  };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('parses a state line and ignores junk', () => {
  assert.strictEqual(parseBridgeLine('{"type":"hello","pollMs":900}').type, 'hello');
  assert.strictEqual(parseBridgeLine(''), null);
  assert.strictEqual(parseBridgeLine('not json'), null);
  assert.strictEqual(parseBridgeLine('{"half":'), null);
  assert.strictEqual(parseBridgeLine('[1,2]'), null);
  assert.strictEqual(parseBridgeLine('{"no":"type"}'), null);
  assert.strictEqual(parseBridgeLine(null), null);
  // PowerShell escapes non-ASCII, which has to survive the round trip.
  const thai = parseBridgeLine('{"type":"state","session":true,"title":"\\u0e40\\u0e1e\\u0e25\\u0e07"}');
  assert.strictEqual(thai.title, 'เพลง');
});

test('a playing session becomes a state the notch can paint', () => {
  const state = nextState(EMPTY, line(), T0);
  assert.strictEqual(state.active, true);
  assert.strictEqual(state.playing, true);
  assert.strictEqual(state.title, 'Blue Monday');
  assert.strictEqual(state.artist, 'New Order');
  assert.strictEqual(state.appLabel, 'Spotify');
  assert.strictEqual(state.duration, 270);
  assert.strictEqual(state.anchorAt, T0);
  assert.strictEqual(state.canToggle, true);
  assert.strictEqual(state.pausedSince, 0);
});

test('no session, or a new source with no metadata, is empty', () => {
  const playing = nextState(EMPTY, line(), T0);
  assert.strictEqual(nextState(playing, { type: 'state', session: false }, T0).active, false);
  // A browser tab that registered but published nothing is not worth a row.
  assert.strictEqual(nextState(EMPTY, line({ title: '', artist: '' }), T0).active, false);
  assert.strictEqual(nextState(playing, line({ title: '', artist: '', app: 'chrome.exe' }), T0).active, false);
  assert.strictEqual(nextState(playing, line({ title: '', artist: '' }), T0 + 1600).active, false);
  // Artist alone still counts.
  assert.strictEqual(nextState(EMPTY, line({ title: '' }), T0).active, true);
});

test('messages that are not state reports leave the state alone', () => {
  const playing = nextState(EMPTY, line(), T0);
  for (const message of [
    { type: 'hello', pollMs: 900 },
    { type: 'command', action: 'next', via: 'winrt' },
    { type: 'error', message: 'winrt call timed out' },
    null,
  ]) {
    assert.strictEqual(nextState(playing, message, T0 + 1000), playing);
  }
});

test('cover art is kept across polls and dropped on a new track', () => {
  const first = nextState(EMPTY, line({ thumb: 'data:image/png;base64,AAAA' }), T0);
  assert.strictEqual(first.thumb, 'data:image/png;base64,AAAA');

  // The bridge omits thumb while the track is unchanged.
  const same = nextState(first, line({ position: 40 }), T0 + 10000);
  assert.strictEqual(same.thumb, 'data:image/png;base64,AAAA');

  // A new track with no art of its own must not inherit the old cover.
  const next = nextState(same, line({ title: 'Temptation' }), T0 + 20000);
  assert.strictEqual(next.thumb, null);

  // An explicit null clears it too.
  const cleared = nextState(first, line({ thumb: null }), T0 + 30000);
  assert.strictEqual(cleared.thumb, null);
});

test('a pause is remembered, and expires after the grace period', () => {
  const playing = nextState(EMPTY, line(), T0);
  const paused = nextState(playing, line({ status: 'Paused' }), T0 + 5000);

  assert.strictEqual(paused.playing, false);
  assert.strictEqual(paused.pausedSince, T0 + 5000);
  assert.strictEqual(isActive(paused, T0 + 5000), true);

  // Still the same pause a minute later, not a fresh one.
  const stillPaused = nextState(paused, line({ status: 'Paused' }), T0 + 65000);
  assert.strictEqual(stillPaused.pausedSince, T0 + 5000);
  assert.strictEqual(isActive(stillPaused, T0 + 65000), true);

  assert.strictEqual(isActive(stillPaused, T0 + 5000 + PAUSED_GRACE_MS + 1), false);

  // Playing again clears the pause.
  const resumed = nextState(stillPaused, line(), T0 + 70000);
  assert.strictEqual(resumed.pausedSince, 0);
  assert.strictEqual(isActive(resumed, T0 + 70000 + PAUSED_GRACE_MS), true);
});

test('position runs forward from its anchor only while playing', () => {
  const playing = nextState(EMPTY, line(), T0);
  assert.strictEqual(positionAt(playing, T0), 30);
  assert.strictEqual(positionAt(playing, T0 + 4000), 34);
  // Never past the end of the track.
  assert.strictEqual(positionAt(playing, T0 + 999000), 270);

  const paused = nextState(playing, line({ status: 'Paused', position: 34 }), T0 + 4000);
  assert.strictEqual(positionAt(paused, T0 + 60000), 34);

  assert.strictEqual(positionAt(EMPTY, T0), 0);
});

test('a missing or junk timeline falls back to the time we heard it', () => {
  const live = nextState(EMPTY, line({ duration: -0.000001, position: 0, lastUpdated: 0 }), T0);
  assert.strictEqual(live.duration, 0, 'a live stream has no length');
  assert.strictEqual(live.anchorAt, T0, 'the anchor falls back to arrival time');

  const odd = nextState(EMPTY, line({ position: 'nope', duration: null }), T0);
  assert.strictEqual(odd.position, 0);
  assert.strictEqual(odd.duration, 0);
});

test('source app ids turn into something readable', () => {
  assert.strictEqual(appLabel('MSEdge'), 'Edge');
  assert.strictEqual(appLabel('Spotify.exe'), 'Spotify');
  assert.strictEqual(appLabel('Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic'), 'Media Player');
  assert.strictEqual(appLabel('SomeVendor.CoolPlayer_abc123!App'), 'App');
  assert.strictEqual(appLabel('Vendor.Player_abc123'), 'Player');
  assert.strictEqual(appLabel('mpv.exe'), 'mpv');
  assert.strictEqual(appLabel(''), '');
  assert.strictEqual(appLabel(undefined), '');
});

test('clock formatting', () => {
  assert.strictEqual(formatClock(0), '0:00');
  assert.strictEqual(formatClock(9.7), '0:09');
  assert.strictEqual(formatClock(65), '1:05');
  assert.strictEqual(formatClock(3661), '1:01:01');
  assert.strictEqual(formatClock(-5), '0:00');
  assert.strictEqual(formatClock(NaN), '0:00');
});

test('seeking is enabled only when the player supports it and has a timeline', () => {
  assert.strictEqual(nextState(EMPTY, line({ canSeek: true }), T0).canSeek, true);
  assert.strictEqual(nextState(EMPTY, line({ canSeek: false }), T0).canSeek, false);
  assert.strictEqual(nextState(EMPTY, line({ canSeek: true, duration: 0 }), T0).canSeek, false);
});

test('a brief metadata gap keeps the track until the source grace expires', () => {
  const playing = nextState(EMPTY, line(), T0);
  const waiting = nextState(playing, line({ title: '', artist: '' }), T0 + 1000);
  assert.strictEqual(waiting.active, true);
  assert.strictEqual(waiting.awaiting, true);
  assert.strictEqual(waiting.title, playing.title);
  assert.strictEqual(nextState(waiting, line({ title: '', artist: '' }), T0 + 2000), EMPTY);
});

test('playback sources are validated and deduplicated', () => {
  const state = nextState(EMPTY, line({ sources: ['Spotify.exe', 12, 'Spotify.exe', 'msedge.exe'], selectedSource: 'Spotify.exe' }), T0);
  assert.deepStrictEqual(state.sources, ['Spotify.exe', 'msedge.exe']);
  assert.strictEqual(state.selectedSource, 'Spotify.exe');
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
