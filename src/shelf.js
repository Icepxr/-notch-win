'use strict';

// The file shelf: files parked in the notch. Entries hold a path, so the
// shelf survives a restart but drops anything that has since been moved.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');

const MAX_ITEMS = 24;
// A dropped folder is walked, not refused. The caps are there so a stray drop
// of a repository or a home directory cannot hang the notch or hand a
// receiver tens of thousands of files.
const MAX_FOLDER_FILES = 500;
const MAX_FOLDER_DEPTH = 12;

/**
 * Every file under `root`, with the path each one should arrive as.
 * Symbolic links are skipped rather than followed: a link out of the folder
 * is not part of what the user dropped, and a link back into it loops.
 */
function walkFolder(root, { maxFiles = MAX_FOLDER_FILES, maxDepth = MAX_FOLDER_DEPTH } = {}) {
  const base = path.basename(root) || 'folder';
  const files = [];
  let truncated = false;

  const visit = (dir, relative, depth) => {
    if (truncated || depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // an unreadable subfolder is skipped, not fatal
    }
    for (const entry of entries) {
      if (truncated) return;
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      // Receivers join this onto a download directory, so it travels with
      // forward slashes and never with a drive letter or a leading slash.
      const name = relative + '/' + entry.name;
      if (entry.isDirectory()) {
        visit(full, name, depth + 1);
      } else if (entry.isFile()) {
        if (files.length >= maxFiles) { truncated = true; return; }
        let size = 0;
        try { size = fs.statSync(full).size; } catch { continue; }
        files.push({ path: full, name, size });
      }
    }
  };

  visit(root, base, 0);
  return { files, truncated };
}

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

  /**
   * @param {string[]} paths
   * @returns {{added:number, duplicates:number, evicted:number, truncated:string[],
   *   rejected:Array<{path:string, reason:string}>}}
   *
   * `added` counts what is actually on the shelf afterwards, not what was
   * offered: the shelf holds MAX_ITEMS, so a large drop can push earlier items
   * off the end. The caller needs the difference to tell the truth about it.
   */
  add(paths) {
    const rejected = [];
    const addedIds = [];
    const truncated = [];
    let duplicates = 0;

    for (const filePath of paths) {
      if (!filePath) continue;
      const resolved = path.resolve(filePath);

      if (this.items.some((it) => it.path === resolved)) { duplicates += 1; continue; }

      let stat;
      try {
        stat = fs.statSync(resolved);
      } catch {
        rejected.push({ path: resolved, reason: 'Cannot read file' });
        continue;
      }

      if (stat.isDirectory()) {
        const walk = walkFolder(resolved);
        if (!walk.files.length) {
          rejected.push({ path: resolved, reason: 'That folder has no files in it.' });
          continue;
        }
        const id = crypto.randomUUID();
        if (walk.truncated) {
          // The user has to hear this: what gets sent will be an incomplete
          // copy of what they dropped.
          // The limit travels with the name so the message can state it
          // without the renderer keeping its own copy of the number.
          truncated.push({ name: path.basename(resolved), limit: MAX_FOLDER_FILES });
          this.emit('log', path.basename(resolved) + ': only the first ' + MAX_FOLDER_FILES + ' files were parked');
        }
        this.items.unshift({
          id,
          kind: 'folder',
          path: resolved,
          name: path.basename(resolved),
          ext: '',
          size: walk.files.reduce((total, file) => total + file.size, 0),
          count: walk.files.length,
          truncated: walk.truncated,
          addedAt: Date.now(),
        });
        addedIds.push(id);
        continue;
      }

      const id = crypto.randomUUID();
      this.items.unshift({
        id,
        kind: 'file',
        path: resolved,
        name: path.basename(resolved),
        ext: path.extname(resolved).replace('.', '').toLowerCase(),
        size: stat.size,
        addedAt: Date.now(),
      });
      addedIds.push(id);
    }

    const before = this.items.length;
    if (this.items.length > MAX_ITEMS) this.items.length = MAX_ITEMS;
    const overflow = before - this.items.length;

    // Oldest items fall off the end, so some of what we just added may have
    // survived while earlier shelf items did not. Count what is really there.
    const kept = new Set(this.items.map((it) => it.id));
    const added = addedIds.filter((id) => kept.has(id)).length;
    const evicted = overflow - (addedIds.length - added);

    if (addedIds.length) {
      this.save();
      this._emit();
    }
    return { added, duplicates, evicted, truncated, rejected };
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
    return this.entries().map((entry) => entry.path);
  }

  /**
   * What to actually send: one entry per file, newest shelf item last so
   * transfers read in drop order. A folder expands here rather than at drop
   * time, so its contents are whatever is on disk when Send is pressed.
   */
  entries() {
    const out = [];
    for (const item of [...this.items].reverse()) {
      if (!fs.existsSync(item.path)) continue;
      if (item.kind === 'folder') {
        for (const file of walkFolder(item.path).files) out.push({ path: file.path, name: file.name });
      } else {
        out.push({ path: item.path, name: item.name });
      }
    }
    return out;
  }

  /**
   * Park a piece of text as a real file. The protocol has no notion of a text
   * message, so the only thing every receiver understands is a .txt.
   */
  addText(text, outbox) {
    if (typeof text !== 'string' || !text.trim()) {
      return { added: 0, rejected: [{ path: '', reason: 'There is no text on the clipboard.' }] };
    }
    const stamp = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    const name = 'Message ' + stamp.getFullYear() + '-' + pad(stamp.getMonth() + 1) + '-' + pad(stamp.getDate())
      + ' ' + pad(stamp.getHours()) + pad(stamp.getMinutes()) + pad(stamp.getSeconds()) + '.txt';
    const target = path.join(outbox, name);
    try {
      fs.mkdirSync(outbox, { recursive: true });
      fs.writeFileSync(target, text, 'utf8');
    } catch (err) {
      return { added: 0, rejected: [{ path: target, reason: 'Could not save the text: ' + err.message }] };
    }
    this.items.unshift({
      id: crypto.randomUUID(),
      kind: 'text',
      path: target,
      name,
      ext: 'txt',
      size: Buffer.byteLength(text, 'utf8'),
      preview: text.replace(/\s+/g, ' ').trim().slice(0, 120),
      addedAt: Date.now(),
    });
    if (this.items.length > MAX_ITEMS) this.items.length = MAX_ITEMS;
    this.save();
    this._emit();
    return { added: 1, rejected: [] };
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

module.exports = { Shelf, MAX_ITEMS, MAX_FOLDER_FILES, walkFolder };
