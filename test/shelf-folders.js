'use strict';

// Folders and pasted text on the shelf, against a real temporary tree.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { Shelf, walkFolder } = require('../src/shelf');
const { safeName } = require('../src/sender');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'islet-shelf-'));
function makeTree() {
  const base = fs.mkdtempSync(path.join(root, 'tree-'));
  const folder = path.join(base, 'Trip photos');
  fs.mkdirSync(path.join(folder, 'day one', 'raw'), { recursive: true });
  fs.writeFileSync(path.join(folder, 'cover.jpg'), 'a'.repeat(10));
  fs.writeFileSync(path.join(folder, 'day one', 'a.jpg'), 'b'.repeat(20));
  fs.writeFileSync(path.join(folder, 'day one', 'raw', 'a.dng'), 'c'.repeat(30));
  return folder;
}
const shelfFor = () => new Shelf(path.join(fs.mkdtempSync(path.join(root, 'store-')), 'shelf.json'));

test('a folder is walked, keeping the path each file should arrive as', () => {
  const { files, truncated } = walkFolder(makeTree());
  assert.strictEqual(truncated, false);
  const names = files.map((f) => f.name).sort();
  assert.deepStrictEqual(names, [
    'Trip photos/cover.jpg',
    'Trip photos/day one/a.jpg',
    'Trip photos/day one/raw/a.dng',
  ], 'names are relative to the dropped folder, with forward slashes');
  assert.ok(files.every((f) => fs.existsSync(f.path)), 'every path resolves');
});

test('dropping a folder parks one item that knows its weight and count', () => {
  const shelf = shelfFor();
  const result = shelf.add([makeTree()]);
  assert.strictEqual(result.added, 1, 'one shelf item, not three');
  const item = shelf.items[0];
  assert.strictEqual(item.kind, 'folder');
  assert.strictEqual(item.count, 3);
  assert.strictEqual(item.size, 60, 'the weight is the sum of its files');
  assert.strictEqual(item.name, 'Trip photos');
});

test('a folder expands at send time, not at drop time', () => {
  const folder = makeTree();
  const shelf = shelfFor();
  shelf.add([folder]);
  assert.strictEqual(shelf.entries().length, 3);

  // Something lands in the folder after it was parked.
  fs.writeFileSync(path.join(folder, 'late.txt'), 'later');
  assert.strictEqual(shelf.entries().length, 4, 'the new file goes too');

  const names = shelf.entries().map((e) => e.name);
  assert.ok(names.includes('Trip photos/late.txt'));
});

test('the walk is bounded so a huge drop cannot run away', () => {
  const base = fs.mkdtempSync(path.join(root, 'many-'));
  const folder = path.join(base, 'many');
  fs.mkdirSync(folder);
  for (let i = 0; i < 12; i += 1) fs.writeFileSync(path.join(folder, 'f' + i + '.txt'), 'x');
  const { files, truncated } = walkFolder(folder, { maxFiles: 5 });
  assert.strictEqual(files.length, 5);
  assert.strictEqual(truncated, true, 'and it says so rather than pretending it took everything');
});

test('an empty folder is refused with a reason instead of sending nothing', () => {
  const base = fs.mkdtempSync(path.join(root, 'empty-'));
  const folder = path.join(base, 'nothing');
  fs.mkdirSync(folder);
  const shelf = shelfFor();
  const result = shelf.add([folder]);
  assert.strictEqual(result.added, 0);
  assert.match(result.rejected[0].reason, /no files/i);
});

test('names cannot climb out of the receiver\'s download folder', () => {
  assert.strictEqual(safeName('photos/trip/a.jpg'), 'photos/trip/a.jpg', 'ordinary structure survives');
  assert.strictEqual(safeName('..\\..\\Windows\\System32\\evil.dll'), 'Windows/System32/evil.dll');
  assert.strictEqual(safeName('/etc/passwd'), 'etc/passwd');
  assert.strictEqual(safeName('C:\\secret.txt'), 'secret.txt');
  assert.strictEqual(safeName('a\\b/c.txt'), 'a/b/c.txt', 'separators normalise to one kind');
  assert.strictEqual(safeName('../..'), 'file', 'nothing usable still yields something sendable');
  assert.strictEqual(safeName(''), 'file');
});

test('pasted text becomes a real file, because the protocol has no messages', () => {
  const shelf = shelfFor();
  const outbox = path.join(root, 'outbox');
  const result = shelf.addText('  ส่งข้อความนี้ไป\n\nบรรทัดสอง  ', outbox);
  assert.strictEqual(result.added, 1);

  const item = shelf.items[0];
  assert.strictEqual(item.kind, 'text');
  assert.match(item.name, /^Message .*\.txt$/);
  assert.strictEqual(fs.readFileSync(item.path, 'utf8'), '  ส่งข้อความนี้ไป\n\nบรรทัดสอง  ',
    'the text goes out exactly as copied');
  assert.strictEqual(item.preview, 'ส่งข้อความนี้ไป บรรทัดสอง', 'the shelf shows a tidied one-liner');
  assert.strictEqual(item.size, Buffer.byteLength('  ส่งข้อความนี้ไป\n\nบรรทัดสอง  ', 'utf8'));
});

test('empty or blank text is refused', () => {
  const shelf = shelfFor();
  const outbox = path.join(root, 'outbox');
  for (const value of ['', '   \n\t ', null, undefined, 42]) {
    const result = shelf.addText(value, outbox);
    assert.strictEqual(result.added, 0, JSON.stringify(value) + ' is not worth sending');
  }
  assert.strictEqual(shelf.items.length, 0);
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
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  console.log('');
  console.log(failed ? failed + ' of ' + tests.length + ' failed' : 'all ' + tests.length + ' passed');
  process.exit(failed ? 1 : 0);
})();
