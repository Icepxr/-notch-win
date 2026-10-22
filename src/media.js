'use strict';

// Owns the Now Playing bridge: one hidden PowerShell process that reports the
// Windows System Media Transport Controls over stdout and takes play/pause,
// next and previous over stdin.
//
// Deliberately free of electron imports so it can be exercised from plain node.

const { spawn } = require('node:child_process');
const readline = require('node:readline');
const { EventEmitter } = require('node:events');

const { parseBridgeLine, nextState, EMPTY } = require('./renderer/media-state');

const ACTIONS = new Set(['toggle', 'play', 'pause', 'next', 'prev', 'seek', 'source']);

// The bridge reports on a timer, so silence means it is wedged.
const SILENCE_MS = 12000;
const RESTART_DELAY_MS = 2500;
// A bridge that dies this fast never got as far as talking to WinRT.
const INSTANT_DEATH_MS = 3000;
const MAX_INSTANT_DEATHS = 3;

class MediaBridge extends EventEmitter {
  constructor({ scriptPath, pollMs = 900, shell = 'powershell.exe' } = {}) {
    super();
    this.scriptPath = scriptPath;
    this.pollMs = pollMs;
    this.shell = shell;
    this.state = EMPTY;
    this.child = null;
    this.stopped = false;
    this.lastLineAt = 0;
    this.instantDeaths = 0;
    this.restartTimer = null;
    this.watchdog = null;
  }

  start() {
    if (process.platform !== 'win32') {
      this.emit('log', 'not Windows, no media bridge');
      return;
    }
    this.stopped = false;
    this._spawn();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.restartTimer);
    clearInterval(this.watchdog);
    this.restartTimer = null;
    this.watchdog = null;
    this._kill();
  }

  /** Commands are validated before they cross the newline-delimited pipe. */
  command(action, value) {
    if (!ACTIONS.has(action)) return false;
    if (action === 'seek' && (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER / 10000000)) return false;
    if (action === 'source' && (typeof value !== 'string' || value.length > 512 || /[\r\n\0]/.test(value))) return false;
    if (!this.child || !this.child.stdin.writable) return false;
    try {
      this.child.stdin.write((action === 'seek' || action === 'source' ? JSON.stringify({ action, value }) : action) + '\n');
      return true;
    } catch (err) {
      this.emit('log', 'command failed: ' + err.message);
      return false;
    }
  }

  _kill() {
    const child = this.child;
    this.child = null;
    if (!child) return;
    try {
      // Closing stdin is the script's cue to exit; the kill is the backstop.
      child.stdin.end();
    } catch {
      // already gone
    }
    try {
      child.kill();
    } catch {
      // already gone
    }
  }

  _spawn() {
    if (this.stopped || this.child) return;

    const startedAt = Date.now();
    this.lastLineAt = startedAt;

    let child;
    try {
      child = spawn(this.shell, [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-WindowStyle', 'Hidden',
        '-File', this.scriptPath,
        '-PollMs', String(this.pollMs),
      ], {
        // windowsHide is what keeps a console from flashing over the desktop.
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      this.emit('log', 'could not start bridge: ' + err.message);
      this._giveUp();
      return;
    }

    this.child = child;

    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      if (this.child !== child) return;
      this.lastLineAt = Date.now();
      const message = parseBridgeLine(line);
      if (!message) return;

      if (message.type === 'state') {
        this.state = nextState(this.state, message, Date.now());
        // The raw message travels on: it carries art only when it changed, and
        // the renderer folds it in with the very same reducer.
        this.emit('message', message);
      } else if (message.type === 'error') {
        this.emit('log', 'bridge: ' + message.message);
      } else if (message.type === 'command') {
        this.emit('log', 'command ' + message.action + ' via ' + message.via);
        this.emit('command', message);
      } else if (message.type === 'hello') {
        this.instantDeaths = 0;
        this.emit('log', 'bridge up, polling every ' + message.pollMs + 'ms');
      }
    });

    child.stderr.on('data', (data) => {
      const line = String(data).trim();
      if (line) this.emit('log', 'bridge stderr: ' + line.split('\n')[0]);
    });

    child.on('error', (err) => this.emit('log', 'bridge error: ' + err.message));

    child.on('exit', (code) => {
      if (this.child !== child) return;
      this.child = null;
      if (this.stopped) return;

      if (Date.now() - startedAt < INSTANT_DEATH_MS) {
        this.instantDeaths += 1;
        if (this.instantDeaths >= MAX_INSTANT_DEATHS) {
          this.emit('log', 'bridge keeps dying (exit ' + code + '), giving up on Now Playing');
          this._giveUp();
          return;
        }
      }
      this.emit('log', 'bridge exited (' + code + '), restarting');
      this._scheduleRestart();
    });

    clearInterval(this.watchdog);
    this.watchdog = setInterval(() => {
      if (!this.child || Date.now() - this.lastLineAt < SILENCE_MS) return;
      this.emit('log', 'bridge went quiet, restarting');
      this._kill();
      this._scheduleRestart();
    }, SILENCE_MS);
  }

  _scheduleRestart() {
    clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => this._spawn(), RESTART_DELAY_MS);
  }

  _giveUp() {
    this.stopped = true;
    clearInterval(this.watchdog);
    this.watchdog = null;
    this.state = EMPTY;
    this.emit('message', { type: 'state', session: false });
    this.emit('unsupported');
  }
}

module.exports = { MediaBridge, ACTIONS };
