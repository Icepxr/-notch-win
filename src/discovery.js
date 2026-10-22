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

class Discovery extends EventEmitter {
  /** @param {{alias:string, fingerprint:string, port:number, protocol:'http'|'https', deviceModel:string, deviceType:string}} self */
  constructor(self) {
    super();
    this.self = { version: '2.0', download: false, ...self };
    this.devices = new Map(); // fingerprint -> device
    this.socket = null;
    this.server = null;
    this.timers = [];
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
      }
      this.announce();
    });

    // Port already taken (the LocalSend app itself, usually). Fall back to an
    // ephemeral port: we lose passive discovery but keep active discovery.
    socket.once('error', (err) => {
      if (err.code !== 'EADDRINUSE') return;
      this.emit('log', `udp/${PROTOCOL_PORT} busy, falling back to an ephemeral port`);
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
      // The notch only sends. Say so plainly rather than letting a peer that
      // tries to send to us sit waiting for a session that will never open.
      if (req.url.startsWith('/api/localsend/v2/prepare-upload')) {
        res.writeHead(403, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ message: 'This device only sends files.' }));
        return;
      }
      if (req.method !== 'POST' || !req.url.startsWith('/api/localsend/v2/register')) {
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
    this.server.on('error', (err) => this.emit('log', `http server error: ${err.message}`));
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
    let msg;
    try { msg = JSON.parse(buf.toString('utf8')); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    // The fingerprint exists so that we can recognise our own announcements.
    if (!msg.fingerprint || msg.fingerprint === this.self.fingerprint) return;

    this._upsert(msg, rinfo.address);

    // Someone is asking who is around; answer directly so they see us too.
    if (msg.announce === true) {
      const reply = Buffer.from(JSON.stringify({ ...this.info, announce: false }));
      try {
        this.socket?.send(reply, 0, reply.length, msg.port || PROTOCOL_PORT, rinfo.address);
      } catch {}
    }
  }

  _upsert(msg, ip) {
    if (!msg?.fingerprint || !ip) return;
    const address = String(ip).replace(/^::ffff:/, '');
    const existing = this.devices.get(msg.fingerprint);
    const device = {
      fingerprint: msg.fingerprint,
      alias: msg.alias || address,
      deviceModel: msg.deviceModel || null,
      deviceType: msg.deviceType || 'desktop',
      protocol: msg.protocol === 'http' ? 'http' : 'https',
      port: Number(msg.port) || PROTOCOL_PORT,
      download: Boolean(msg.download),
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
    if (changed) this._emitDevices();
  }

  _emitDevices() {
    const list = [...this.devices.values()].sort((a, b) => a.alias.localeCompare(b.alias));
    this.emit('devices', list);
  }
}

module.exports = { Discovery, PROTOCOL_PORT };
