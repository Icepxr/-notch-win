'use strict';
// Reading history happens off the Electron main thread. No transcript is sent
// across this boundary or cached on disk.
const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const { newState, parseLine, summarize } = require('./ai-usage');
const states = new Map();
let pendingTimer;
function files(root, depth = 0, result = []) {
  if (depth > 7 || result.length >= 5000) return result;
  let entries; try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return result; }
  for (const e of entries) {
    if (result.length >= 5000) break;
    const name = path.join(root, e.name);
    if (e.isDirectory()) files(name, depth + 1, result);
    else if (e.isFile() && e.name.endsWith('.jsonl')) {
      try { const stat = fs.statSync(name); if (stat.mtimeMs > Date.now() - 31 * 86400000) result.push({ name, stat }); } catch {}
    }
  }
  return result;
}
function scan() {
  clearTimeout(pendingTimer);
  let budget = 64 * 1024 * 1024, pending = false;
  const found = new Set();
  for (const [provider, roots] of Object.entries(workerData.roots)) {
    for (const root of roots) for (const file of files(root)) {
      found.add(file.name);
      let s = states.get(file.name);
      if (!s || file.stat.size < s.offset || s.ino !== file.stat.ino) {
        s = { ...newState(provider, path.basename(file.name)), offset: 0, tail: '', ino: file.stat.ino, dropping: false };
        states.set(file.name, s);
      }
      if (file.stat.size === s.offset) continue;
      if (budget <= 0) { pending = true; continue; }
      let fd;
      try {
        fd = fs.openSync(file.name, 'r');
        const end = Math.min(file.stat.size, s.offset + budget);
        while (s.offset < end) {
          const buffer = Buffer.alloc(Math.min(256 * 1024, end - s.offset));
          const count = fs.readSync(fd, buffer, 0, buffer.length, s.offset);
          if (!count) break;
          s.offset += count; budget -= count;
          // StringDecoder handles UTF-8 characters split across chunk writes.
          if (!s.decoder) s.decoder = new (require('node:string_decoder').StringDecoder)('utf8');
          const parts = (s.tail + s.decoder.write(buffer.subarray(0, count))).split('\n');
          s.tail = parts.pop();
          for (const line of parts) {
            if (s.dropping) { s.dropping = false; continue; }
            if (line.length <= 4 * 1024 * 1024) parseLine(line, s);
          }
          if (s.tail.length > 4 * 1024 * 1024) { s.tail = ''; s.dropping = true; }
        }
        if (s.offset < file.stat.size) pending = true;
      } catch { pending = true; }
      finally { if (fd !== undefined) fs.closeSync(fd); }
    }
  }
  for (const name of states.keys()) if (!found.has(name)) states.delete(name);
  const data = summarize(states.values());
  parentPort.postMessage({ ...data, scanning: pending, updatedAt: Date.now() });
  if (pending) pendingTimer = setTimeout(scan, 100);
}
parentPort.on('message', scan);
