'use strict';
const fs = require('node:fs'), path = require('node:path');
const { parseLrc } = require('./renderer/lyrics-state');
// Reads only the file explicitly selected in the native dialog, with a bound
// that still holds if the file grows between selection and reading.
async function readLyricsFile(filename) {
  if (typeof filename !== 'string' || path.extname(filename).toLowerCase() !== '.lrc') return { status: 'invalid' };
  try {
    const chunks = []; let bytes = 0;
    for await (const chunk of fs.createReadStream(filename, { end: 262144 })) {
      bytes += chunk.length;
      if (bytes > 262144) return { status: 'large' };
      chunks.push(chunk);
    }
    const lines = parseLrc(Buffer.concat(chunks).toString('utf8'));
    return lines.some(line => line.text) ? { status: 'ready', lines } : { status: 'invalid' };
  } catch { return { status: 'unavailable' }; }
}
module.exports = { readLyricsFile };
