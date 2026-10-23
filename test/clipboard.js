'use strict';

// Pure-logic tests for the clipboard history. The Electron clipboard is
// stubbed, so this runs under plain node.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert');

const {
  ClipboardWatcher, summarize, classify, makeEntry, insert, serialize, MAX_PERSISTED_CHARS,
} = require('../src/clipboard');
const { relativeTime } = require('../src/renderer/panel-clipboard');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-clip-'));
  return path.join(dir, 'clipboard.json');
}

/** A stand-in for Electron's clipboard. */
function stubClipboard(text = '') {
  return {
    value: text,
    readText() { return this.value; },
    writeText(v) { this.value = v; },
    readImage() { return { isEmpty: () => true }; },
  };
}

test('summarize collapses whitespace and truncates', () => {
  assert.strictEqual(summarize('  hello\n\n   world  '), 'hello world');
  const long = 'x'.repeat(300);
  const out = summarize(long, 20);
  assert.strictEqual(out.length, 20);
  assert.ok(out.endsWith('…'));
});

test('classify recognises the shapes worth labelling', () => {
  assert.strictEqual(classify('https://example.com/a?b=1'), 'url');
  assert.strictEqual(classify('C:\\Users\\demo\\notes.txt'), 'path');
  assert.strictEqual(classify('someone@example.com'), 'email');
  assert.strictEqual(classify('{"a":1}'), 'json');
  assert.strictEqual(classify('a'.repeat(40)), 'hash');
  assert.strictEqual(classify('just a sentence'), 'text');
  // Malformed JSON must fall through rather than throw.
  assert.strictEqual(classify('{not json]'), 'text');
});

test('makeEntry ignores empty clipboards', () => {
  assert.strictEqual(makeEntry({ text: '' }), null);
  assert.strictEqual(makeEntry({ text: '   \n\t ' }), null);
  assert.strictEqual(makeEntry({}), null);
});

test('makeEntry keeps the text and marks oversized text as not persisted', () => {
  const small = makeEntry({ text: 'hello' });
  assert.strictEqual(small.kind, 'text');
  assert.strictEqual(small.text, 'hello');
  assert.strictEqual(small.chars, 5);
  assert.strictEqual(small.persist, true);

  const huge = makeEntry({ text: 'x'.repeat(MAX_PERSISTED_CHARS + 1) });
  assert.strictEqual(huge.persist, false, 'huge text is kept in memory only');
});

test('an image entry is never persisted', () => {
  const entry = makeEntry({ imageDataUrl: 'data:image/png;base64,AAA', imageSize: { width: 12, height: 8 } });
  assert.strictEqual(entry.kind, 'image');
  assert.strictEqual(entry.persist, false);
  assert.match(entry.preview, /12×8/);
});

test('insert dedupes, reorders and trims', () => {
  const a = makeEntry({ text: 'a' });
  const b = makeEntry({ text: 'b' });

  let list = insert([], a);
  list = insert(list, b);
  assert.deepStrictEqual(list.map((e) => e.text), ['b', 'a']);

  // Copying what is already on top changes nothing, and returns the same
  // array so the UI can skip a repaint.
  const same = insert(list, makeEntry({ text: 'b' }));
  assert.strictEqual(same, list);

  // Copying something from further down moves it back to the top.
  list = insert(list, makeEntry({ text: 'a' }));
  assert.deepStrictEqual(list.map((e) => e.text), ['a', 'b']);
  assert.strictEqual(list.length, 2, 'no duplicate left behind');

  // The limit is honoured.
  let capped = [];
  for (let i = 0; i < 10; i += 1) capped = insert(capped, makeEntry({ text: 'n' + i }), 3);
  assert.strictEqual(capped.length, 3);
  assert.strictEqual(capped[0].text, 'n9');
});

test('serialize drops images and oversized text', () => {
  const entries = [
    makeEntry({ text: 'keep' }),
    makeEntry({ imageDataUrl: 'data:image/png;base64,AAA', imageSize: { width: 1, height: 1 } }),
    makeEntry({ text: 'x'.repeat(MAX_PERSISTED_CHARS + 1) }),
  ];
  const out = serialize(entries);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].text, 'keep');
  assert.ok(!('persist' in out[0]), 'the persist flag is not written to disk');
});

test('polling records a change once, not on every tick', () => {
  const clipboard = stubClipboard('first');
  const watcher = new ClipboardWatcher({ clipboard, storePath: tempStore() });

  let changes = 0;
  watcher.on('change', () => { changes += 1; });

  watcher.poll();
  watcher.poll();
  watcher.poll();
  assert.strictEqual(changes, 1, 'an unchanged clipboard emits nothing');
  assert.strictEqual(watcher.entries.length, 1);

  clipboard.value = 'second';
  watcher.poll();
  assert.strictEqual(changes, 2);
  assert.deepStrictEqual(watcher.entries.map((e) => e.text), ['second', 'first']);
});

test('a paused watcher keeps its history but records nothing', () => {
  const clipboard = stubClipboard('one');
  const watcher = new ClipboardWatcher({ clipboard, storePath: tempStore() });
  watcher.poll();

  watcher.setPaused(true);
  clipboard.value = 'two';
  watcher.poll();
  assert.strictEqual(watcher.entries.length, 1, 'nothing new while paused');

  watcher.setPaused(false);
  watcher.poll();
  assert.strictEqual(watcher.entries.length, 2, 'recording resumes');
});

test('picking writes back without recording it as a fresh copy', () => {
  const clipboard = stubClipboard('alpha');
  const watcher = new ClipboardWatcher({ clipboard, storePath: tempStore() });
  watcher.poll();
  clipboard.value = 'beta';
  watcher.poll();

  const alpha = watcher.entries.find((e) => e.text === 'alpha');
  assert.strictEqual(watcher.pick(alpha.id), true);
  assert.strictEqual(clipboard.value, 'alpha', 'the clipboard now holds it');
  assert.strictEqual(watcher.entries[0].text, 'alpha', 'and it moved to the top');

  const before = watcher.entries.length;
  watcher.poll(); // the poll that follows our own write
  assert.strictEqual(watcher.entries.length, before, 'our own write is not re-recorded');
});

test('history survives a reload, minus what must not be persisted', () => {
  const storePath = tempStore();
  const clipboard = stubClipboard('remember me');
  const first = new ClipboardWatcher({ clipboard, storePath });
  first.poll();
  clipboard.value = 'x'.repeat(MAX_PERSISTED_CHARS + 1);
  first.poll();

  const second = new ClipboardWatcher({ clipboard: stubClipboard(), storePath });
  second.load();
  assert.strictEqual(second.entries.length, 1);
  assert.strictEqual(second.entries[0].text, 'remember me');
});

test('remove and clear', () => {
  const clipboard = stubClipboard('a');
  const watcher = new ClipboardWatcher({ clipboard, storePath: tempStore() });
  watcher.poll();
  clipboard.value = 'b';
  watcher.poll();

  watcher.remove(watcher.entries[0].id);
  assert.strictEqual(watcher.entries.length, 1);

  watcher.clear();
  assert.strictEqual(watcher.entries.length, 0);
  assert.strictEqual(watcher.lastHash, null, 'clearing forgets what was last seen');
});

test('the renderer view never carries the full text', () => {
  const clipboard = stubClipboard('a secret value that is long enough to matter');
  const watcher = new ClipboardWatcher({ clipboard, storePath: tempStore() });
  watcher.poll();

  const view = watcher.view();
  assert.strictEqual(view.length, 1);
  assert.ok(!('text' in view[0]), 'full text stays in the main process');
  assert.ok(view[0].preview.length > 0);
});

test('relative time reads naturally in English', () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);
  assert.strictEqual(relativeTime(now - 5000, now), 'Just now');
  assert.strictEqual(relativeTime(now - 5 * 60000, now), '5m ago');
  assert.strictEqual(relativeTime(now - 3 * 3600000, now), '3h ago');
  assert.strictEqual(relativeTime(now - 2 * 86400000, now), '2d ago');
  // A clock that jumped backwards must not print a negative age.
  assert.strictEqual(relativeTime(now + 60000, now), 'Just now');
});

test('pinned text survives reload, promotion and recent-history eviction', () => {
  const clipboard = stubClipboard('keep this');
  const storePath = tempStore();
  const watcher = new ClipboardWatcher({ clipboard, storePath, limit: 2 }); watcher.poll();
  const id = watcher.entries[0].id;
  assert.deepStrictEqual(watcher.togglePin(id), { ok: true, pinned: true });
  for (const value of ['recent a','recent b','recent c','keep this']) { clipboard.value = value; watcher.poll(); }
  assert.strictEqual(watcher.entries[0].id, id);
  assert.strictEqual(watcher.entries[0].pinned, true);
  assert.strictEqual(watcher.entries.length, 3, 'pin does not consume the recent history budget');
  const restored = new ClipboardWatcher({ clipboard, storePath, limit: 2 }); restored.load();
  assert.strictEqual(restored.entries[0].id, id); assert.strictEqual(restored.entries[0].pinned, true);
  assert.ok(restored.view()[0].canPin && !('text' in restored.view()[0]));
  watcher.clear(true);
  assert.deepStrictEqual(watcher.entries.map(e => e.id), [id]);
  watcher.poll(); assert.strictEqual(watcher.entries.length, 1, 'clear recent does not re-record the current clipboard');
  assert.strictEqual(watcher.togglePin(id).pinned, false);
  watcher.clear(true); assert.strictEqual(watcher.entries.length, 0);
});

test('pinning is bounded and a failed write restores the old history', () => {
  const clipboard = stubClipboard(); const watcher = new ClipboardWatcher({ clipboard, storePath: tempStore() });
  for (let i = 0; i < 20; i++) { clipboard.value = 'pin ' + i; watcher.poll(); assert.ok(watcher.togglePin(watcher.entries.find(e => !e.pinned).id).ok); }
  clipboard.value = 'one more'; watcher.poll(); const id = watcher.entries.find(e => !e.pinned).id;
  assert.deepStrictEqual(watcher.togglePin(id), { ok: false, reason: 'limit' });
  watcher.togglePin(watcher.entries[0].id);
  const previous = watcher.entries;
  watcher.save = () => false;
  assert.deepStrictEqual(watcher.togglePin(id), { ok: false, reason: 'save' });
  assert.strictEqual(watcher.entries, previous);
  assert.deepStrictEqual(watcher.togglePin('missing'), { ok: false, reason: 'missing' });
  const image = makeEntry({ imageDataUrl: 'data:image/png;base64,AAA' }); watcher.entries = [image];
  assert.deepStrictEqual(watcher.togglePin(image.id), { ok: false, reason: 'temporary' });
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
