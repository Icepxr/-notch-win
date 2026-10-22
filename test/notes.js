'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { NotesStore } = require('../src/notes');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-notes-'));
const file = path.join(directory, 'note.txt');
try {
  const notes = new NotesStore(file);
  assert.equal(notes.load(), '');
  assert.equal(notes.set('สวัสดี\nA local note'), true);
  assert.equal(new NotesStore(file).load(), 'สวัสดี\nA local note');
  assert.equal(notes.set(null), false);
  assert.equal(notes.set('x'.repeat(100001)), true);
  assert.equal(new NotesStore(file).load().length, 100000);
  notes.cache('The final keystroke before quitting');
  assert.equal(notes.flush(), true);
  assert.equal(new NotesStore(file).load(), 'The final keystroke before quitting');
  console.log('Scratchpad: atomic local persistence, Unicode and size bounds passed');
} finally {
  if (fs.existsSync(file)) fs.unlinkSync(file);
  if (fs.existsSync(file + '.tmp')) fs.unlinkSync(file + '.tmp');
  fs.rmdirSync(directory);
}
