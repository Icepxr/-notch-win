'use strict';

// LocalSend protocol v2 discovery.
// Spec: https://github.com/localsend/protocol
//   - announcements go to UDP multicast 224.0.0.167:53317
//   - peers reply with an HTTP POST /api/localsend/v2/register, or, if that
//     fails, a UDP message carrying the same fields plus announce:false

const dgram = require('node:dgram');
const http = require('node:http');
const { EventEmitter } = require('node:events');

const MULTICAST_ADDR = '224.0.0.167';
const PROTOCOL_PORT = 53317;
const ANNOUNCE_INTERVAL = 4000;
const DEVICE_TTL = 25000;
const PRUNE_INTERVAL = 2000;

// Everything below arrives from whoever is on the network, so it is bounded
// rather than trusted. A peer that lies, floods or sends the wrong type must
// cost us a dropped packet, never a crash and never unbounded memory.
const MAX_DEVICES = 64;
const MAX_TEXT = 64;          // alias and model, in characters
const MAX_FINGERPRINT = 128;
const DEVICE_TYPES = ['mobile', 'desktop', 'web', 'headless', 'server'];
// One device list per quarter second at most: a flood of packets must not turn
// into a flood of renders.
const EMIT_COALESCE = 250;
// We answer announcements so peers can see us. Answering every one would make
// us a UDP reflector, so each address gets at most one reply per interval.
const REPLY_INTERVAL = 1000;

/** A bounded string, or '' when there is nothing usable. Control characters
 *  are dropped so an alias cannot forge a line in the log or the device list. */
function text(value, limit) {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit);
}

class Discovery extends EventEmitter {
  /** @param {{alias:string, fingerprint:string, port:number, protocol:'http'|'https', deviceModel:string, deviceType:string}} self */
  constructor(self) {
    super();
    this.self = { version: '2.0', download: false, ...self };
    this.devices = new Map(); // fingerprint -> device
    this.socket = null;
    this.server = null;
    this.timers = [];
    this.emitTimer = null;
    this.lastSignature = null; // what the last emitted list looked like
    this.lastReply = new Map(); // address -> when we last answered it
    // When the LocalSend desktop app already holds 53317 we may not get to
    // join the multicast group. We can still discover by announcing and
    // listening for the unicast/HTTP replies our announcement provokes.
    this.multicastJoined = false;
  }

  get info() {
    const { alias, version, deviceModel, deviceType, fingerprint, port, protocol, download } = this.self;
    return { alias, version, deviceModel, deviceType, fingerprint, port, protocol, download };
  }

  start() {
    this._startSocket();
    this._startServer();
    this.timers.push(setInterval(() => this.announce(), ANNOUNCE_INTERVAL));
    this.timers.push(setInterval(() => this._prune(), PRUNE_INTERVAL));
  }

  stop() {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    if (this.emitTimer) { clearTimeout(this.emitTimer); this.emitTimer = null; }
    this.lastReply.clear();
    try { this.socket?.close(); } catch {}
    try { this.server?.close(); } catch {}
  }

  _startSocket() {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.socket = socket;

    socket.on('message', (buf, rinfo) => this._onMessage(buf, rinfo));
    socket.on('error', (err) => this.emit('log', `udp error: ${err.message}`));

    socket.bind(PROTOCOL_PORT, () => {
      try {
        socket.addMembership(MULTICAST_ADDR);
        socket.setMulticastTTL(1);
        socket.setMulticastLoopback(true);
        this.multicastJoined = true;
        this.emit('log', `listening on udp/${PROTOCOL_PORT}, joined ${MULTICAST_ADDR}`);
      } catch (err) {
        this.emit('log', `could not join multicast group: ${err.message}`);
        // Passive discovery is gone: we will only see peers that answer us.
        this.emit('trouble', { code: 'no-multicast',
          reason: 'This machine would not join the discovery group, so only devices that answer us will appear.' });
      }
      this.announce();
    });

    // Port already taken (the LocalSend app itself, usually). Fall back to an
    // ephemeral port: we lose passive discovery but keep active discovery.
    socket.once('error', (err) => {
      if (err.code !== 'EADDRINUSE') return;
      this.emit('log', `udp/${PROTOCOL_PORT} busy, falling back to an ephemeral port`);
      this.emit('trouble', { code: 'udp-busy',
        reason: 'Another LocalSend app holds the discovery port, so devices may take longer to appear.' });
      const fallback = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      this.socket = fallback;
      fallback.on('message', (buf, rinfo) => this._onMessage(buf, rinfo));
      fallback.on('error', (e) => this.emit('log', `udp error: ${e.message}`));
      fallback.bind(0, () => {
        try { fallback.setMulticastTTL(1); } catch {}
        this.announce();
      });
    });
  }

  // Peers that prefer the HTTP reply path POST their info to us here.
  _startServer() {
    this.server = http.createServer((req, res) => {
      // Match on the parsed path, not on the raw URL: '/api/localsend/v2/register'
      // also prefixes '/api/localsend/v2/registeranything'.
      let route = '';
      try { route = new URL(req.url, 'http://localhost').pathname; } catch { route = ''; }

      // The notch only sends. Say so plainly rather than letting a peer that
      // tries to send to us sit waiting for a session that will never open.
      if (route === '/api/localsend/v2/prepare-upload') {
        res.writeHead(403, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ message: 'This device only sends files.' }));
        return;
      }
      if (req.method !== 'POST' || route !== '/api/localsend/v2/register') {
        res.writeHead(404).end();
        return;
      }
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 64 * 1024) req.destroy(); });
      req.on('end', () => {
        try {
          this._upsert(JSON.parse(body), req.socket.remoteAddress);
        } catch {}
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(this.info));
      });
    });
    this.server.on('error', (err) => {
      if (err.code !== 'EADDRINUSE') {
        this.emit('log', `http server error: ${err.message}`);
        this.emit('trouble', { code: 'server-error',
          reason: 'Nearby devices cannot register with this machine: ' + err.message });
        return;
      }
      // Another copy of Islet, or another user's session, holds the port.
      // Take an ephemeral one and advertise that instead of announcing a port
      // where nothing of ours is listening.
      this.emit('log', `tcp/${this.self.port} busy, taking an ephemeral port`);
      this.server.listen(0, () => {
        this.self.port = this.server.address().port;
        this.emit('log', `register endpoint on tcp/${this.self.port}`);
      });
    });
    this.server.listen(this.self.port, () => {
      this.emit('log', `register endpoint on tcp/${this.self.port}`);
    });
  }

  announce() {
    const payload = Buffer.from(JSON.stringify({ ...this.info, announce: true }));
    try {
      this.socket?.send(payload, 0, payload.length, PROTOCOL_PORT, MULTICAST_ADDR);
    } catch (err) {
      this.emit('log', `announce failed: ${err.message}`);
    }
  }

  _onMessage(buf, rinfo) {
    // Anyone on the network can reach this handler, so it may not throw: an
    // exception here escapes the dgram listener and takes the process with it.
    try {
      let msg;
      try { msg = JSON.parse(buf.toString('utf8')); } catch { return; }
      if (!msg || typeof msg !== 'object') return;
      // The fingerprint exists so that we can recognise our own announcements.
      if (typeof msg.fingerprint !== 'string' || !msg.fingerprint) return;
      if (msg.fingerprint === this.self.fingerprint) return;

      this._upsert(msg, rinfo.address);

      // Someone is asking who is around; answer directly so they see us too.
      // Rate limited per address: answering every announcement would let one
      // peer use us to amplify traffic at a third party.
      if (msg.announce === true) this._reply(msg, rinfo.address);
    } catch (err) {
      this.emit('log', `ignored a malformed packet: ${err.message}`);
    }
  }

  _reply(msg, address) {
    const now = Date.now();
    const last = this.lastReply.get(address) || 0;
    if (now - last < REPLY_INTERVAL) return;
    this.lastReply.set(address, now);

    const port = Number(msg.port);
    const target = Number.isInteger(port) && port > 0 && port <= 65535 ? port : PROTOCOL_PORT;
    const reply = Buffer.from(JSON.stringify({ ...this.info, announce: false }));
    try {
      this.socket?.send(reply, 0, reply.length, target, address);
    } catch {}
  }

  _upsert(msg, ip) {
    if (!msg || typeof msg !== 'object' || !ip) return;
    const fingerprint = text(msg.fingerprint, MAX_FINGERPRINT);
    if (!fingerprint) return;

    const address = String(ip).replace(/^::ffff:/, '');
    const existing = this.devices.get(fingerprint);
    // A new fingerprint from a full table is dropped rather than evicting a
    // device the user may be about to send to.
    if (!existing && this.devices.size >= MAX_DEVICES) return;

    const port = Number(msg.port);
    const deviceType = text(msg.deviceType, MAX_TEXT);
    const device = {
      fingerprint,
      alias: text(msg.alias, MAX_TEXT) || address,
      deviceModel: text(msg.deviceModel, MAX_TEXT) || null,
      deviceType: DEVICE_TYPES.includes(deviceType) ? deviceType : 'desktop',
      protocol: msg.protocol === 'http' ? 'http' : 'https',
      port: Number.isInteger(port) && port > 0 && port <= 65535 ? port : PROTOCOL_PORT,
      download: msg.download === true,
      address,
      firstSeen: existing?.firstSeen ?? Date.now(),
      lastSeen: Date.now(),
    };
    this.devices.set(device.fingerprint, device);
    if (!existing) this.emit('log', `found ${device.alias} at ${address}:${device.port}`);
    this._emitDevices();
  }

  _prune() {
    const cutoff = Date.now() - DEVICE_TTL;
    let changed = false;
    for (const [fp, d] of this.devices) {
      if (d.lastSeen < cutoff) { this.devices.delete(fp); changed = true; }
    }
    // The reply ledger is keyed by address, so a flood from many addresses
    // would grow it without this.
    for (const [address, when] of this.lastReply) {
      if (when < cutoff) this.lastReply.delete(address);
    }
    if (changed) this._emitDevices();
  }

  /**
   * Coalesced, and silent when nothing actually changed. Peers announce
   * themselves every few seconds; emitting on each one made the renderer
   * rebuild the device list - and throw away the keyboard focus inside it -
   * for news that was identical to what it already had.
   */
  _emitDevices() {
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null;
      const list = [...this.devices.values()]
        .sort((a, b) => String(a.alias).localeCompare(String(b.alias)));
      // lastSeen is deliberately not part of this: it changes on every
      // announcement and nothing on screen shows it.
      const signature = list
        .map((d) => [d.fingerprint, d.alias, d.address, d.port, d.protocol, d.download].join('\u0000'))
        .join('\u0001');
      if (signature === this.lastSignature) return;
      this.lastSignature = signature;
      this.emit('devices', list);
    }, EMIT_COALESCE);
    this.emitTimer.unref?.();
  }
}

module.exports = { Discovery, PROTOCOL_PORT };
