'use strict';

// The file shelf: files parked in the notch. Entries hold a path, so the
// shelf survives a restart but drops anything that has since been moved.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');

const MAX_ITEMS = 24;

class Shelf extends EventEmitter {
  constructor(storePath) {
    super();
    this.storePath = storePath;
    this.items = [];
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
      const items = Array.isArray(raw) ? raw : [];
      // Drop entries whose file is gone so the shelf never lies.
      this.items = items.filter((it) => it && it.path && fs.existsSync(it.path));
    } catch {
      this.items = [];
    }
    this._emit();
    return this.items;
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
      fs.writeFileSync(this.storePath, JSON.stringify(this.items, null, 2));
    } catch (err) {
      this.emit('log', 'could not save shelf: ' + err.message);
    }
  }

  /** @param {string[]} paths @returns {{added:number, rejected:Array<{path:string, reason:string}>}} */
  add(paths) {
    const rejected = [];
    let added = 0;

    for (const filePath of paths) {
      if (!filePath) continue;
      const resolved = path.resolve(filePath);

      if (this.items.some((it) => it.path === resolved)) continue; // already parked

      let stat;
      try {
        stat = fs.statSync(resolved);
      } catch {
        rejected.push({ path: resolved, reason: 'Cannot read file' });
        continue;
      }

      if (stat.isDirectory()) {
        rejected.push({ path: resolved, reason: 'Only individual files are supported.' });
        continue;
      }

      this.items.unshift({
        id: crypto.randomUUID(),
        path: resolved,
        name: path.basename(resolved),
        ext: path.extname(resolved).replace('.', '').toLowerCase(),
        size: stat.size,
        addedAt: Date.now(),
      });
      added += 1;
    }

    if (this.items.length > MAX_ITEMS) this.items.length = MAX_ITEMS;
    if (added) {
      this.save();
      this._emit();
    }
    return { added, rejected };
  }

  remove(id) {
    const before = this.items.length;
    this.items = this.items.filter((it) => it.id !== id);
    if (this.items.length !== before) {
      this.save();
      this._emit();
    }
  }

  clear() {
    if (!this.items.length) return;
    this.items = [];
    this.save();
    this._emit();
  }

  get(id) {
    return this.items.find((it) => it.id === id) || null;
  }

  /** Paths that still exist, newest last so transfers read in drop order. */
  paths() {
    return this.items
      .filter((it) => fs.existsSync(it.path))
      .map((it) => it.path)
      .reverse();
  }

  /** Forget entries whose file vanished behind our back. */
  prune() {
    const before = this.items.length;
    this.items = this.items.filter((it) => fs.existsSync(it.path));
    if (this.items.length !== before) {
      this.save();
      this._emit();
    }
  }

  _emit() {
    this.emit('change', this.items);
  }
}

module.exports = { Shelf, MAX_ITEMS };
