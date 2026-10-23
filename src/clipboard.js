'use strict';
// SPDX-License-Identifier: GPL-3.0-or-later
// Pin ordering/clear recent adapted from Vorssaint ClipboardHistoryService.
// Copyright (C) 2026 Vorssaint

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
const PIN_LIMIT = 20;
const DEFAULT_INTERVAL = 700;
const MAX_PERSISTED_CHARS = 20000; // longer text stays in memory only
// Clipboard formats an app sets to say "do not keep this". Password managers
// set them when they copy a secret, which is precisely the case we must not
// write to disk.
// Both mean "exclude" by their presence alone. CanIncludeInClipboardHistory is
// deliberately not here: it carries a value, so its presence does not by
// itself mean no.
const EXCLUDED_FORMATS = [
  'ExcludeClipboardContentFromMonitorProcessing',
  'Clipboard Viewer Ignore',
];
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
 * A cheap identity for a clipboard image, taken from the thumbnail's own
 * pixels. Sampling a fixed number of bytes keeps the cost flat no matter how
 * large the original was, and the dimensions are mixed in so two different
 * images would have to collide on both to be mistaken for one another.
 *
 * This decides only whether to re-encode; a miss costs one redundant encode,
 * never a wrong history entry, because the real hash is still taken from the
 * encoded result.
 */
function thumbSignature(thumb, size) {
  let bytes;
  try {
    bytes = thumb.toBitmap();
  } catch {
    return null;
  }
  if (!bytes || !bytes.length) return null;

  const samples = 512;
  const step = Math.max(1, Math.floor(bytes.length / samples));
  let hash = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < bytes.length; i += step) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return `${size.width}x${size.height}:${bytes.length}:${hash >>> 0}`;
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
  const previous = entries.find((e) => e.hash === entry.hash);
  const next = previous ? { ...entry, id: previous.id, pinned: previous.pinned === true } : entry;
  // Vorssaint keeps pinned items in place; only recent items are promoted.
  const pinned = entries.filter((e) => e.pinned).map((e) => e.hash === next.hash ? next : e);
  const recent = entries.filter((e) => !e.pinned && e.hash !== next.hash);
  return [...pinned, ...(next.pinned ? recent : [next, ...recent]).slice(0, limit)];
}

/** Only the parts of an entry worth writing to disk. */
function serialize(entries) {
  return entries
    .filter((e) => e.persist && e.kind !== 'image')
    .map(({ id, kind, hash, preview, text, chars, at, pinned }) => ({ id, kind, hash, preview, text, chars, at, pinned: pinned === true }));
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
    // Set when an image is on the clipboard, so an unchanged one is not
    // re-encoded on every poll.
    this.lastImageSignature = null;
    this.lastImageSnapshot = null;
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
      if (Array.isArray(raw)) {
        const entries = raw.filter((e) => e && e.hash && typeof e.text === 'string' && e.text.length <= MAX_PERSISTED_CHARS)
          .map((e) => ({ ...e, pinned: e.pinned === true, persist: true }));
        this.entries = [...entries.filter((e) => e.pinned).slice(0, PIN_LIMIT), ...entries.filter((e) => !e.pinned).slice(0, this.limit)];
        this.lastHash = [...this.entries].sort((a, b) => b.at - a.at)[0]?.hash || null;
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
      fs.writeFileSync(this.storePath + '.tmp', JSON.stringify(serialize(this.entries), null, 2));
      fs.renameSync(this.storePath + '.tmp', this.storePath);
      return true;
    } catch (err) {
      this.emit('log', 'could not save clipboard history: ' + err.message);
      return false;
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
    // Password managers and other apps mark a copy as not-for-history using
    // these clipboard formats. Honouring them is the difference between a
    // history that is merely local and one that is safe to keep: a copied
    // password otherwise lands in clipboard.json in plain text.
    if (this._excluded()) return { text: '' };

    const text = this.clipboard.readText();
    if (text && text.trim()) return { text };

    // Only look at the image when there is no text, since copying from most
    // apps puts both on the clipboard and the text is the useful half.
    const image = this.clipboard.readImage ? this.clipboard.readImage() : null;
    if (image && !image.isEmpty()) {
      const size = image.getSize();
      // A thumbnail is all the list needs, and keeps memory sane.
      const thumb = image.resize({ height: Math.min(64, size.height) });

      // Encoding a PNG and base64ing it is by far the most expensive thing
      // this poll does, and while a screenshot sits on the clipboard it would
      // otherwise happen every 700ms to produce a byte-identical result. The
      // thumbnail's own pixels answer "is this still the same image?" far
      // more cheaply, so the encode only runs when the answer is no.
      const signature = thumbSignature(thumb, size);
      if (signature && signature === this.lastImageSignature) return this.lastImageSnapshot;

      const snapshot = { imageDataUrl: thumb.toDataURL(), imageSize: size };
      this.lastImageSignature = signature;
      this.lastImageSnapshot = snapshot;
      return snapshot;
    }
    this.lastImageSignature = null;
    this.lastImageSnapshot = null;

    return { text: '' };
  }

  /**
   * Whether the app that made this copy asked clipboard managers to leave it
   * alone. These are the format names Windows apps actually use; an Electron
   * build without `clipboard.has` records as it did before.
   */
  _excluded() {
    if (typeof this.clipboard.has !== 'function') return false;
    for (const format of EXCLUDED_FORMATS) {
      try {
        if (this.clipboard.has(format)) return true;
      } catch {}
    }
    return false;
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

  togglePin(id) {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return { ok: false, reason: 'missing' };
    if (!entry.persist || entry.kind === 'image') return { ok: false, reason: 'temporary' };
    if (!entry.pinned && this.entries.filter((e) => e.pinned).length >= PIN_LIMIT) return { ok: false, reason: 'limit' };
    const previous = this.entries;
    const updated = { ...entry, pinned: !entry.pinned };
    const rest = previous.filter((e) => e.id !== id);
    const pinned = rest.filter((e) => e.pinned), recent = rest.filter((e) => !e.pinned);
    this.entries = updated.pinned ? [updated, ...pinned, ...recent] : [...pinned, updated, ...recent].slice(0, pinned.length + this.limit);
    if (!this.save()) { this.entries = previous; return { ok: false, reason: 'save' }; }
    this._emit();
    return { ok: true, pinned: updated.pinned };
  }

  clear(keepPinned = false) {
    if (!this.entries.length) return;
    this.entries = keepPinned ? this.entries.filter((e) => e.pinned) : [];
    if (!keepPinned) this.lastHash = null;
    this.save();
    this._emit();
  }

  /** What the renderer needs; the full text stays in the main process. */
  view() {
    return this.entries.map(({ id, kind, preview, chars, at, dataUrl, pinned, persist }) => ({
      id, kind, preview, chars, at, dataUrl, pinned: pinned === true, canPin: persist === true && kind !== 'image',
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
  PIN_LIMIT,
};
