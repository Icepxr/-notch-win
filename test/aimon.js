'use strict';

// Exercises the AI monitor's pure half: the JSON Claude Code writes into
// ~/.claude/sessions in, the rows the notch paints out. No watcher, no live
// session, nothing killed to prove a pid is gone.

const assert = require('node:assert');

const {
  QUIET_AFTER_MS,
  parseSessionFile,
  shortenPath,
  toSession,
  sinceOf,
  kindOf,
  formatSince,
  describe,
  sortSessions,
  waitingCount,
  buildSessions,
} = require('../src/renderer/ai-state');

const T0 = 1792653916914;
const HOME = 'C:\\Users\\demo';
const MINUTE = 60000;

/** A session file shaped the way Claude Code writes them. */
function file(extra = {}) {
  return {
    contents: JSON.stringify({
      pid: 17816,
      sessionId: '2cc8dbf9-c06b-4443-ae75-507ef92f15ae',
      cwd: 'C:\\Users\\demo\\Documents',
      startedAt: T0 - 5 * MINUTE,
      version: '2.1.299',
      kind: 'interactive',
      entrypoint: 'claude-desktop',
      pidDomain: 'win32:demo',
      name: 'โมดูล AI monitor ในนอตช์',
      nameSource: 'user',
      status: 'busy',
      updatedAt: T0,
      statusUpdatedAt: T0,
      ...extra,
    }),
  };
}

const alive = () => true;
const dead = () => false;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// --- parsing ----------------------------------------------------------------

test('parses a session file and refuses anything that is not one', () => {
  assert.strictEqual(parseSessionFile(file().contents).pid, 17816);
  assert.strictEqual(parseSessionFile(''), null);
  assert.strictEqual(parseSessionFile('   '), null);
  assert.strictEqual(parseSessionFile('not json'), null);
  // Caught mid-write, which is exactly what a watch event races with.
  assert.strictEqual(parseSessionFile('{"pid":17816,"status":"bu'), null);
  assert.strictEqual(parseSessionFile('[{"pid":1}]'), null);
  assert.strictEqual(parseSessionFile('null'), null);
  assert.strictEqual(parseSessionFile(null), null);
  assert.strictEqual(parseSessionFile(undefined), null);
  // No pid means no way to tell a live session from a leftover file.
  assert.strictEqual(parseSessionFile('{"status":"busy"}'), null);
  assert.strictEqual(parseSessionFile('{"pid":"17816"}'), null);
  assert.strictEqual(parseSessionFile('{"pid":0}'), null);
  assert.strictEqual(parseSessionFile('{"pid":-4}'), null);
  assert.strictEqual(parseSessionFile('{"pid":17816.5}'), null);
});

test('a broken file never takes the live ones down with it', () => {
  const list = buildSessions([
    { contents: '{"pid":17816,"status":"bu' },
    file({ pid: 12848, name: 'ส่งไฟล์ระหว่างอุปกรณ์' }),
    { contents: 'rubbish' },
  ], { now: T0, home: HOME, isAlive: alive });

  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].pid, 12848);
});

// --- liveness ---------------------------------------------------------------

test('a session whose pid is gone is not shown', () => {
  const files = [file(), file({ pid: 12848, status: 'idle' })];
  assert.strictEqual(buildSessions(files, { now: T0, home: HOME, isAlive: dead }).length, 0);

  const only = buildSessions(files, {
    now: T0,
    home: HOME,
    isAlive: (pid) => pid === 12848,
  });
  assert.strictEqual(only.length, 1);
  assert.strictEqual(only[0].pid, 12848);
});

test('a liveness check that throws counts as dead, not as a crash', () => {
  const list = buildSessions([file()], {
    now: T0,
    home: HOME,
    isAlive: () => { throw new Error('EPERM-ish'); },
  });
  assert.deepStrictEqual(list, []);
});

test('session files that roamed in from another machine are skipped', () => {
  const files = [file(), file({ pid: 999, pidDomain: 'win32:someoneelse' })];
  const list = buildSessions(files, {
    now: T0,
    home: HOME,
    isAlive: alive,
    pidDomain: 'win32:demo',
  });
  assert.deepStrictEqual(list.map((s) => s.pid), [17816]);

  // With no domain to compare against, every file is ours.
  assert.strictEqual(buildSessions(files, { now: T0, isAlive: alive }).length, 2);
});

test('two files claiming one pid make one row, the fresher one', () => {
  const list = buildSessions([
    file({ statusUpdatedAt: T0 - 9 * MINUTE, name: 'เก่า' }),
    file({ statusUpdatedAt: T0, name: 'ใหม่' }),
  ], { now: T0, home: HOME, isAlive: alive });

  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].name, 'ใหม่');
});

// --- missing fields ---------------------------------------------------------

test('a session with almost nothing in it still makes a row', () => {
  const bare = toSession({ pid: 17816 }, { home: HOME });
  assert.strictEqual(bare.pid, 17816);
  assert.strictEqual(bare.name, 'pid 17816');
  assert.strictEqual(bare.cwd, '');
  assert.strictEqual(bare.folder, '');
  assert.strictEqual(bare.status, '');
  assert.strictEqual(bare.statusAt, 0);
  // No timestamp at all must not read as "waiting since 1970".
  assert.strictEqual(sinceOf(bare, T0), 0);
  assert.strictEqual(describe(bare, T0), 'Unknown status');
});

test('an unnamed session falls back to its folder, then to its id', () => {
  const byFolder = toSession({ pid: 1, cwd: 'C:\\Users\\demo\\Documents' }, { home: HOME });
  assert.strictEqual(byFolder.name, '~\\Documents');

  const byId = toSession({ pid: 1, sessionId: '2cc8dbf9-c06b-4443' }, { home: HOME });
  assert.strictEqual(byId.name, '2cc8dbf9');

  // A blank name is as good as no name.
  const blank = toSession({ pid: 1, name: '   ', cwd: 'C:\\dev\\app' }, { home: HOME });
  assert.strictEqual(blank.name, '…\\dev\\app');
});

test('a missing statusUpdatedAt walks down to the next timestamp it has', () => {
  const viaUpdated = toSession({ pid: 1, updatedAt: T0, startedAt: T0 - MINUTE });
  assert.strictEqual(viaUpdated.statusAt, T0);

  const viaStarted = toSession({ pid: 1, startedAt: T0 - MINUTE });
  assert.strictEqual(viaStarted.statusAt, T0 - MINUTE);

  // Nonsense timestamps are no timestamp at all.
  const junk = toSession({ pid: 1, statusUpdatedAt: 'เมื่อกี้', updatedAt: -1, startedAt: NaN });
  assert.strictEqual(junk.statusAt, 0);
});

// --- status mapping ---------------------------------------------------------

test('the two known statuses get their colours', () => {
  const busy = toSession({ pid: 1, status: 'busy', statusUpdatedAt: T0 });
  const idle = toSession({ pid: 2, status: 'idle', statusUpdatedAt: T0 });
  assert.strictEqual(kindOf(busy, T0), 'working');
  assert.strictEqual(kindOf(idle, T0), 'waiting');
});

test('an unknown status shows its raw value instead of guessing', () => {
  const odd = toSession({ pid: 1, status: 'compacting', statusUpdatedAt: T0 - 3 * MINUTE });
  assert.strictEqual(kindOf(odd, T0), 'unknown');
  assert.strictEqual(describe(odd, T0), 'compacting 3 min');

  // Still 'unknown' however long it sits there - no decay to a state we guessed.
  assert.strictEqual(kindOf(odd, T0 + 5 * 60 * MINUTE), 'unknown');

  const empty = toSession({ pid: 2, statusUpdatedAt: T0 });
  assert.strictEqual(kindOf(empty, T0), 'unknown');
  assert.strictEqual(describe(empty, T0), 'Unknown status');
});

test('a finished turn nobody came back to goes quiet', () => {
  const idle = toSession({ pid: 1, status: 'idle', statusUpdatedAt: T0 });

  assert.strictEqual(kindOf(idle, T0 + QUIET_AFTER_MS - 1000), 'waiting');
  assert.strictEqual(kindOf(idle, T0 + QUIET_AFTER_MS), 'quiet');
  assert.strictEqual(describe(idle, T0 + 2 * QUIET_AFTER_MS), 'Idle · 20 min');

  // Working never decays: busy is busy however long it has been thinking.
  const busy = toSession({ pid: 2, status: 'busy', statusUpdatedAt: T0 });
  assert.strictEqual(kindOf(busy, T0 + 4 * QUIET_AFTER_MS), 'working');
});

// --- durations --------------------------------------------------------------

test('durations read the way a person would say them', () => {
  assert.strictEqual(formatSince(0), 'Under a minute');
  assert.strictEqual(formatSince(59_999), 'Under a minute');
  assert.strictEqual(formatSince(MINUTE), '1 min');
  assert.strictEqual(formatSince(2 * MINUTE + 30_000), '2 min');
  assert.strictEqual(formatSince(59 * MINUTE), '59 min');
  assert.strictEqual(formatSince(60 * MINUTE), '1h');
  assert.strictEqual(formatSince(65 * MINUTE), '1h 5 min');
  assert.strictEqual(formatSince(23 * 60 * MINUTE), '23h');
  assert.strictEqual(formatSince(24 * 60 * MINUTE), '1d');
  assert.strictEqual(formatSince(50 * 60 * MINUTE), '2d');
  // Garbage in, no NaN out.
  assert.strictEqual(formatSince(-5), 'Under a minute');
  assert.strictEqual(formatSince(NaN), 'Under a minute');
  assert.strictEqual(formatSince(undefined), 'Under a minute');
});

test('a status younger than a minute is described without a number', () => {
  const busy = toSession({ pid: 1, status: 'busy', statusUpdatedAt: T0 });
  assert.strictEqual(describe(busy, T0 + 20_000), 'Working');
  assert.strictEqual(describe(busy, T0 + 2 * MINUTE), 'Working · 2 min');

  const idle = toSession({ pid: 2, status: 'idle', statusUpdatedAt: T0 });
  assert.strictEqual(describe(idle, T0 + 5_000), 'Waiting for you');
  assert.strictEqual(describe(idle, T0 + 9 * MINUTE), 'Waiting · 9 min');
});

test('a clock that jumped backwards reads as just now, not as negative', () => {
  const busy = toSession({ pid: 1, status: 'busy', statusUpdatedAt: T0 });
  assert.strictEqual(sinceOf(busy, T0 - 60 * MINUTE), 0);
  assert.strictEqual(describe(busy, T0 - 60 * MINUTE), 'Working');
});

// --- paths ------------------------------------------------------------------

test('working directories shorten to something that fits a row', () => {
  assert.strictEqual(shortenPath('C:\\Users\\demo', HOME), '~');
  assert.strictEqual(shortenPath('C:\\Users\\demo\\', HOME), '~');
  assert.strictEqual(shortenPath('C:\\Users\\demo\\Documents', HOME), '~\\Documents');
  assert.strictEqual(
    shortenPath('C:\\Users\\demo\\Documents\\islet', HOME),
    '~\\Documents\\islet',
  );
  // Deep under home keeps the tail, since the leading ~ already says where.
  assert.strictEqual(shortenPath('C:\\Users\\demo\\a\\b\\c\\d', HOME), '~\\c\\d');
  // Outside home the elision has to be visible.
  assert.strictEqual(shortenPath('D:\\work\\repos\\api', HOME), '\u2026\\repos\\api');
  assert.strictEqual(shortenPath('D:\\work', HOME), 'D:\\work');
  // Windows paths are compared case-insensitively, and / works too.
  assert.strictEqual(shortenPath('c:\\users\\DEMO\\Documents', HOME), '~\\Documents');
  assert.strictEqual(shortenPath('C:/Users/demo/Documents', HOME), '~\\Documents');
  // A folder that merely starts with the home string is not inside it.
  assert.strictEqual(shortenPath('C:\\Users\\someoneelse\\Documents', HOME), '\u2026\\someoneelse\\Documents');
  assert.strictEqual(shortenPath('', HOME), '');
  assert.strictEqual(shortenPath(null, HOME), '');
  // With no home to anchor on, the same two-segment rule still applies.
  assert.strictEqual(shortenPath('C:\\dev\\app', ''), '\u2026\\dev\\app');
  assert.strictEqual(shortenPath('C:\\dev\\app', undefined), '\u2026\\dev\\app');
});

// --- ordering and the peek indicator ---------------------------------------

test('the list puts the sessions that matter on top', () => {
  const list = sortSessions([
    toSession({ pid: 4, status: 'idle', statusUpdatedAt: T0 - 40 * MINUTE }),  // quiet
    toSession({ pid: 3, status: 'reindexing', statusUpdatedAt: T0 - MINUTE }), // unknown
    toSession({ pid: 2, status: 'idle', statusUpdatedAt: T0 - 2 * MINUTE }),   // waiting
    toSession({ pid: 1, status: 'busy', statusUpdatedAt: T0 - 8 * MINUTE }),   // working
  ], T0);
  assert.deepStrictEqual(list.map((s) => s.pid), [1, 2, 3, 4]);
});

test('within one kind the session that has waited longest comes first', () => {
  const list = sortSessions([
    toSession({ pid: 2, status: 'idle', statusUpdatedAt: T0 - MINUTE }),
    toSession({ pid: 1, status: 'idle', statusUpdatedAt: T0 - 7 * MINUTE }),
  ], T0);
  assert.deepStrictEqual(list.map((s) => s.pid), [1, 2]);
});

test('the peek indicator counts only the sessions actually waiting', () => {
  const list = [
    toSession({ pid: 1, status: 'busy', statusUpdatedAt: T0 }),
    toSession({ pid: 2, status: 'idle', statusUpdatedAt: T0 }),
    toSession({ pid: 3, status: 'idle', statusUpdatedAt: T0 - 3 * MINUTE }),
    toSession({ pid: 4, status: 'idle', statusUpdatedAt: T0 - 40 * MINUTE }), // gone quiet
    toSession({ pid: 5, status: 'summarising', statusUpdatedAt: T0 }),
  ];
  assert.strictEqual(waitingCount(list, T0), 2);
  assert.strictEqual(waitingCount([], T0), 0);
  assert.strictEqual(waitingCount(null, T0), 0);
  // Everyone goes quiet eventually, and the peek stops nagging.
  assert.strictEqual(waitingCount(list, T0 + QUIET_AFTER_MS), 0);
});

// --- the whole directory ----------------------------------------------------

test('a real directory listing becomes the list the notch paints', () => {
  const list = buildSessions([
    file(),
    file({ pid: 12848, name: 'ส่งไฟล์ระหว่างอุปกรณ์', status: 'idle', statusUpdatedAt: T0 - 2 * MINUTE }),
    file({ pid: 35096, name: 'กำลังเล่น ในนอตช์', status: 'idle', statusUpdatedAt: T0 - 90 * MINUTE }),
    { contents: '{"pid":404,"status":"busy","statusUpdatedAt":' + T0 + ',"pidDomain":"win32:demo"}' },
  ], {
    now: T0,
    home: HOME,
    isAlive: (pid) => pid !== 404, // the one that died without cleaning up
    pidDomain: 'win32:demo',
  });

  assert.deepStrictEqual(list.map((s) => s.pid), [17816, 12848, 35096]);
  assert.deepStrictEqual(list.map((s) => kindOf(s, T0)), ['working', 'waiting', 'quiet']);
  assert.deepStrictEqual(list.map((s) => describe(s, T0)), [
    'Working',
    'Waiting · 2 min',
    'Idle · 1h 30 min',
  ]);
  assert.strictEqual(list[0].folder, '~\\Documents');
  assert.strictEqual(waitingCount(list, T0), 1);
});

test('an empty or unreadable directory is simply an empty list', () => {
  assert.deepStrictEqual(buildSessions([], { now: T0, isAlive: alive }), []);
  assert.deepStrictEqual(buildSessions(null, { now: T0, isAlive: alive }), []);
  assert.deepStrictEqual(buildSessions([null, undefined, {}], { now: T0, isAlive: alive }), []);
  // No options at all must not throw: every pid is assumed live, nothing parses.
  assert.deepStrictEqual(buildSessions([]), []);
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
