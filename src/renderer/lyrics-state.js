'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LyricsState = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function parseLrc(value) {
    if (typeof value !== 'string' || value.length > 262144) return [];
    const lines = [], offset = Math.max(-10000, Math.min(10000, Number(value.match(/\[offset:([+-]?\d+)\]/i)?.[1]) || 0)) / 1000;
    for (const row of value.split(/\r?\n/).slice(0, 2000)) {
      const stamps = [...row.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
      const text = row.replace(/\[[^\]]*\]/g, '').trim().slice(0, 500);
      for (const match of stamps) {
        if (Number(match[2]) >= 60) continue;
        lines.push({ at: Math.max(0, Number(match[1]) * 60 + Number(match[2]) + Number('0.' + (match[3] || '0')) - offset), text });
      }
    }
    const grouped = [];
    for (const line of lines.sort((a, b) => a.at - b.at).slice(0, 2000)) {
      const previous = grouped.at(-1);
      if (previous && previous.at === line.at) previous.text = [previous.text, line.text].filter(Boolean).join('\n').slice(0, 1000);
      else grouped.push(line);
    }
    return grouped;
  }
  function indexAt(lines, seconds) {
    let low = 0, high = lines.length - 1, result = -1;
    while (low <= high) {
      const mid = (low + high) >>> 1;
      if (lines[mid].at <= seconds) { result = mid; low = mid + 1; } else high = mid - 1;
    }
    return result;
  }
  const key = state => JSON.stringify([state.app || '', state.title || '', state.artist || '', state.album || '']);
  return { parseLrc, indexAt, key };
}));
