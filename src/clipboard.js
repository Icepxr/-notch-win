'use strict';

// Clipboard history.
//
// Electron gives no clipboard-changed event on Windows, so this polls. The
// Electron `clipboard` object is injected rather than required directly, which
// keeps the logic testable under plain node.
//
// Privacy: entries live in the user's own profile and never leave the machine.
// Text is capped before it is written to disk, and images are kept in memory
// only — a clipboard full of screenshots should not quietly grow a file on
// disk forever.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');

const DEFAULT_LIMIT = 60;
const DEFAULT_INTERVAL = 700;
const MAX_PERSISTED_CHARS = 20000; // longer text stays in memory only
const PREVIEW_CHARS = 140;

/** Collapse whitespace into a single line for the list preview. */
function summarize(text, max = PREVIEW_CHARS) {
  const flat = String(text).replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
}

/** Rough classification, used only to pick an icon and a label. */
function classify(text) {
  const trimmed = String(text).trim();
  if (!trimmed) return 'text';
  if (/^https?:\/\/\S+$/i.test(trimmed)) return 'url';
  if (/^[a-z]:\\|^\\\\|^\/(?:[^\0]+)$/i.test(trimmed) && !/\s{2,}/.test(trimmed) && trimmed.length < 260) return 'path';
  if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(trimmed)) return 'email';
  if (/^[0-9a-f]{32,}$/i.test(trimmed)) return 'hash';
  if (/^\s*[[{][\s\S]*[\]}]\s*$/.test(trimmed)) {
    try { JSON.parse(trimmed); return 'json'; } catch { /* not json after all */ }
  }
  if (/\n/.test(trimmed) && /[;{}()=>]|^\s{2,}\S/m.test(trimmed)) return 'code';
  return 'text';
}

function digest(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 16);
}

/**
 * Build a history entry from what the clipboard currently holds.
 * Returns null when there is nothing worth recording.
 */
function makeEntry({ text, imageDataUrl, imageSize }, now = Date.now()) {
  if (imageDataUrl) {
    return {
      id: crypto.randomUUID(),
      kind: 'image',
      hash: digest(imageDataUrl),
      preview: summarize(imageSize ? imageSize.width + '×' + imageSize.height : 'Image'),
      dataUrl: imageDataUrl,
      chars: 0,
      at: now,
      persist: false, // images stay in memory
    };
  }

  const value = typeof text === 'string' ? text : '';
  if (!value.trim()) return null;

  return {
    id: crypto.randomUUID(),
    kind: classify(value),
    hash: digest(value),
    preview: summarize(value),
    text: value,
    chars: value.length,
    at: now,
    persist: value.length <= MAX_PERSISTED_CHARS,
  };
}

/**
 * Put `entry` at the front, dropping any earlier copy of the same content and
 * trimming to `limit`. Returns a new array, or the original when nothing
 * changed (so callers can skip a redundant repaint).
 */
function insert(entries, entry, limit = DEFAULT_LIMIT) {
  if (!entry) return entries;
  if (entries.length && entries[0].hash === entry.hash) return entries; // unchanged
  const rest = entries.filter((e) => e.hash !== entry.hash);
  return [entry, ...rest].slice(0, limit);
}

/** Only the parts of an entry worth writing to disk. */
function serialize(entries) {
  return entries
    .filter((e) => e.persist && e.kind !== 'image')
    .map(({ id, kind, hash, preview, text, chars, at }) => ({ id, kind, hash, preview, text, chars, at }));
}

class ClipboardWatcher extends EventEmitter {
  /**
   * @param {{clipboard:object, storePath:string, limit?:number, interval?:number}} opts
   *   clipboard: Electron's clipboard module (or a stub in tests)
   */
  constructor({ clipboard, storePath, limit = DEFAULT_LIMIT, interval = DEFAULT_INTERVAL }) {
    super();
    this.clipboard = clipboard;
    this.storePath = storePath;
    this.limit = limit;
    this.interval = interval;
    this.entries = [];
    this.timer = null;
    this.paused = false;
    // Remembers what we last saw so our own writes do not re-enter history.
    this.lastHash = null;
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
      if (Array.isArray(raw)) {
        this.entries = raw
          .filter((e) => e && e.hash && typeof e.text === 'string')
          .map((e) => ({ ...e, persist: true }))
          .slice(0, this.limit);
        this.lastHash = this.entries.length ? this.entries[0].hash : null;
      }
    } catch {
      this.entries = [];
    }
    this._emit();
    return this.entries;
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
      fs.writeFileSync(this.storePath, JSON.stringify(serialize(this.entries), null, 2));
    } catch (err) {
      this.emit('log', 'could not save clipboard history: ' + err.message);
    }
  }

  start() {
    if (this.timer) return;
    this.poll();
    this.timer = setInterval(() => this.poll(), this.interval);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  /** While paused nothing new is recorded, but the history stays. */
  setPaused(paused) {
    this.paused = Boolean(paused);
    this.emit('paused', this.paused);
  }

  /** Read the clipboard once and record anything new. */
  poll() {
    if (this.paused) return;

    let snapshot;
    try {
      snapshot = this._read();
    } catch (err) {
      this.emit('log', 'clipboard read failed: ' + err.message);
      return;
    }

    const entry = makeEntry(snapshot);
    if (!entry || entry.hash === this.lastHash) return;

    this.lastHash = entry.hash;
    const next = insert(this.entries, entry, this.limit);
    if (next === this.entries) return;

    this.entries = next;
    this.save();
    this._emit();
  }

  _read() {
    const text = this.clipboard.readText();
    if (text && text.trim()) return { text };

    // Only look at the image when there is no text, since copying from most
    // apps puts both on the clipboard and the text is the useful half.
    const image = this.clipboard.readImage ? this.clipboard.readImage() : null;
    if (image && !image.isEmpty()) {
      const size = image.getSize();
      // A thumbnail is all the list needs, and keeps memory sane.
      const thumb = image.resize({ height: Math.min(64, size.height) });
      return { imageDataUrl: thumb.toDataURL(), imageSize: size };
    }

    return { text: '' };
  }

  /** Copy an entry back to the clipboard. */
  pick(id) {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return false;

    if (entry.kind === 'image' && entry.dataUrl && this.clipboard.writeImage) {
      // Writing back the thumbnail would lose resolution, so images are
      // offered as a preview only; refuse rather than silently degrade.
      return false;
    }
    if (typeof entry.text !== 'string') return false;

    this.clipboard.writeText(entry.text);
    // Our own write must not look like a new copy.
    this.lastHash = entry.hash;
    // Re-inserting moves it back to the top, which is what a picker should do.
    this.entries = insert(this.entries, { ...entry, at: Date.now() }, this.limit);
    this.save();
    this._emit();
    return true;
  }

  remove(id) {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.id !== id);
    if (this.entries.length === before) return;
    this.save();
    this._emit();
  }

  clear() {
    if (!this.entries.length) return;
    this.entries = [];
    this.lastHash = null;
    this.save();
    this._emit();
  }

  /** What the renderer needs; the full text stays in the main process. */
  view() {
    return this.entries.map(({ id, kind, preview, chars, at, dataUrl }) => ({
      id, kind, preview, chars, at, dataUrl,
    }));
  }

  _emit() {
    this.emit('change', this.view());
  }
}

module.exports = {
  ClipboardWatcher,
  summarize,
  classify,
  digest,
  makeEntry,
  insert,
  serialize,
  MAX_PERSISTED_CHARS,
  DEFAULT_LIMIT,
};
