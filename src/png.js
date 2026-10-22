'use strict';

// A tiny PNG encoder, just enough to draw the tray icon at runtime so the
// project carries no binary assets.

const zlib = require('node:zlib');

let CRC_TABLE = null;

function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  CRC_TABLE = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    CRC_TABLE[n] = c;
  }
  return CRC_TABLE;
}

function crc32(buf) {
  const table = crcTable();
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** @param {number} width @param {number} height @param {Buffer} rgba */
function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * The tray glyph: a notch hanging from the top edge, drawn in white so it
 * reads on the default dark Windows taskbar.
 */
function trayIconPNG(size = 32) {
  const rgba = Buffer.alloc(size * size * 4, 0);

  const w = Math.round(size * 0.72);
  const h = Math.round(size * 0.40);
  const x0 = Math.round((size - w) / 2);
  const y0 = Math.round(size * 0.18);
  const radius = Math.round(h * 0.75);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const lx = x - x0;
      const ly = y - y0;
      if (lx < 0 || lx >= w || ly < 0 || ly >= h) continue;

      // Round only the bottom corners, the way a screen notch looks.
      let inside = true;
      if (ly > h - radius) {
        if (lx < radius) {
          const dx = radius - lx;
          const dy = ly - (h - radius);
          inside = dx * dx + dy * dy <= radius * radius;
        } else if (lx > w - radius) {
          const dx = lx - (w - radius);
          const dy = ly - (h - radius);
          inside = dx * dx + dy * dy <= radius * radius;
        }
      }
      if (!inside) continue;

      const i = (y * size + x) * 4;
      rgba[i] = 255;
      rgba[i + 1] = 255;
      rgba[i + 2] = 255;
      rgba[i + 3] = 255;
    }
  }

  return encodePNG(size, size, rgba);
}

module.exports = { encodePNG, trayIconPNG };
