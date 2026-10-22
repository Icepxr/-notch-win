'use strict';
const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');
const path = require('node:path');
function normalize(sample) {
  if (!sample || sample.type !== 'system-actions') return null;
  const level = value => Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : null;
  return { volume: level(sample.volume), muted: typeof sample.muted === 'boolean' ? sample.muted : null,
    brightness: level(sample.brightness), brightnessSerial: Number.isSafeInteger(sample.brightnessSerial) && sample.brightnessSerial >= 0 ? sample.brightnessSerial : 0,
    capsLock: typeof sample.capsLock === 'boolean' ? sample.capsLock : null };
}
function changes(previous, current) {
  if (!previous || !current) return [];
  const events = [];
  if (current.volume !== null && previous.volume !== null && (current.volume !== previous.volume || current.muted !== previous.muted)) {
    events.push({ action: 'volume', value: current.volume, muted: current.muted === true });
  }
  if (current.brightness !== null && (previous.brightness !== null && current.brightness !== previous.brightness
    || current.brightnessSerial > previous.brightnessSerial)) events.push({ action: 'brightness', value: current.brightness });
  if (current.capsLock !== null && previous.capsLock !== null && current.capsLock !== previous.capsLock) events.push({ action: 'capslock', enabled: current.capsLock });
  return events;
}
class SystemActions extends EventEmitter {
  constructor({ spawnProcess = spawn, scriptPath = path.join(__dirname, 'media', 'system-actions.ps1') } = {}) {
    super(); this.spawnProcess = spawnProcess; this.scriptPath = scriptPath; this.stopped = true; this.failures = 0;
  }
  start() { if (!this.stopped || process.platform !== 'win32') return; this.stopped = false; this.launch(); }
  launch() {
    if (this.stopped) return;
    this.previous = null; let buffer = '', receivedSample = false;
    const started = Date.now(); let lastSample = started;
    const child = this.spawnProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this.scriptPath],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child = child;
    child.stdin.on('error', () => {});
    child.stderr.resume();
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      if (this.stopped || this.child !== child) return;
      buffer += chunk;
      if (buffer.length > 65536) { buffer = ''; child.kill(); return; }
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
        let sample; try { sample = normalize(JSON.parse(line)); } catch { continue; }
        if (!sample) continue;
        if (!receivedSample) this.emit('ready');
        lastSample = Date.now(); receivedSample = true; this.failures = 0;
        for (const action of changes(this.previous, sample)) this.emit('action', action);
        this.previous = sample;
      }
    });
    let ended = false;
    const end = () => {
      if (ended) return; ended = true;
      clearInterval(this.watchdog);
      if (this.child === child) this.child = null;
      if (this.stopped) return;
      if (!receivedSample) this.failures++;
      if (this.failures >= 3) { this.emit('unavailable'); return; }
      this.restart = setTimeout(() => this.launch(), 3000);
    };
    child.on('error', end); child.on('close', end);
    this.watchdog = setInterval(() => { if (Date.now() - lastSample > 15000) child.kill(); }, 5000);
    this.watchdog.unref();
  }
  stop() {
    this.stopped = true; clearTimeout(this.restart); clearInterval(this.watchdog);
    this.child?.stdin.end(); this.child?.kill(); this.child = null;
  }
}
module.exports = { SystemActions, normalize, changes };
