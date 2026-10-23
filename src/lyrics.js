'use strict';
const https = require('node:https');
const { parseLrc } = require('./renderer/lyrics-state');
// Requests occur only while lyrics are enabled; no credentials or file data
// are sent. The renderer cannot supply a URL or arbitrary track payload.
function requestLyrics(url, signal) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { signal, headers: { 'User-Agent': 'Islet/0.1.0', Accept: 'application/json' } }, response => {
      if (response.statusCode !== 200) {
        const retry = Number(response.headers['retry-after']);
        const date = Date.parse(response.headers['retry-after']);
        response.resume();
        resolve({ status: response.statusCode, retryMs: Number.isFinite(retry) ? retry * 1000 : Math.max(0, date - Date.now()) || 60000 }); return;
      }
      let size = 0; const chunks = [];
      response.on('data', chunk => { size += chunk.length; if (size > 262144) request.destroy(new Error('Response limit')); else chunks.push(chunk); });
      response.on('error', reject);
      response.on('end', () => { try { resolve({ status: 200, data: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); } catch (error) { reject(error); } });
    });
    request.on('error', reject);
  });
}
class LyricsService {
  constructor({ request = requestLyrics, now = Date.now, timeout = 8000, capacity = 32 } = {}) {
    Object.assign(this, { request, now, timeout, capacity }); this.cache = new Map(); this.active = null; this.blockedUntil = 0;
  }
  cancel() { this.active?.controller.abort(); this.active = null; }
  get(track) {
    const title = typeof track?.title === 'string' ? track.title.trim().slice(0, 512) : '';
    const artist = typeof track?.artist === 'string' ? track.artist.trim().slice(0, 512) : '';
    const album = typeof track?.album === 'string' ? track.album.trim().slice(0, 512) : '';
    const duration = Number.isFinite(track?.duration) ? Math.round(track.duration) : 0;
    if (!title || !artist || !track.active || track.awaiting) { this.cancel(); return Promise.resolve({ status: 'missing' }); }
    const key = JSON.stringify([title, artist, album, duration]);
    if (this.active?.key === key) return this.active.promise;
    this.cancel();
    if (this.cache.has(key)) {
      const cached = this.cache.get(key), lifetime = cached.result.status === 'synced' ? 1800000 : 60000;
      this.cache.delete(key);
      if (this.now() - cached.at < lifetime) { this.cache.set(key, cached); return Promise.resolve(cached.result); }
    }
    if (this.now() < this.blockedUntil) return Promise.resolve({ status: 'limited' });
    const url = new URL('https://lrclib.net/api/get');
    url.searchParams.set('track_name', title); url.searchParams.set('artist_name', artist);
    if (album) url.searchParams.set('album_name', album);
    if (duration > 0 && duration <= 3600) url.searchParams.set('duration', duration);
    const operation = { key, controller: new AbortController() }; this.active = operation;
    operation.promise = this.load(operation, url);
    return operation.promise;
  }
  async load(operation, url) {
    const timer = setTimeout(() => operation.controller.abort(), this.timeout); timer.unref?.();
    try {
      const response = await this.request(url, operation.controller.signal);
      if (operation.controller.signal.aborted) return { status: 'cancelled' };
      if (response.status === 429) { this.blockedUntil = this.now() + Math.max(1000, response.retryMs || 60000); return { status: 'limited' }; }
      if (response.status !== 200 && response.status !== 404) return { status: 'unavailable' };
      const lines = parseLrc(response.data?.syncedLyrics);
      const result = { status: lines.some(line => line.text) ? 'synced' : response.data?.instrumental ? 'instrumental' : 'missing', lines };
      this.cache.set(operation.key, { result, at: this.now() });
      if (this.cache.size > this.capacity) this.cache.delete(this.cache.keys().next().value);
      return result;
    } catch { return { status: operation.controller.signal.aborted ? 'cancelled' : 'unavailable' }; }
    finally { clearTimeout(timer); if (this.active === operation) this.active = null; }
  }
}
module.exports = { LyricsService };
