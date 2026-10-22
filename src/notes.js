'use strict';
const fs = require('node:fs');
const path = require('node:path');
class NotesStore {
  constructor(file) { this.file = file; this.text = ''; this.timer = null; }
  load() { try { this.text = fs.readFileSync(this.file, 'utf8').slice(0, 100000); } catch {} return this.text; }
  set(text) {
    if (typeof text !== 'string') return false;
    this.text = text.slice(0, 100000);
    clearTimeout(this.timer);
    // Acknowledge only after an atomic local save. Failure remains visible in UI.
    return this.flush();
  }
  cache(text) {
    if (typeof text !== 'string') return;
    this.text = text.slice(0, 100000);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 250);
    this.timer.unref();
  }
  flush() {
    clearTimeout(this.timer);
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file + '.tmp', this.text, 'utf8');
      fs.renameSync(this.file + '.tmp', this.file);
      return true;
    } catch { return false; }
  }
}
module.exports = { NotesStore };
