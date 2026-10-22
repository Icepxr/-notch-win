'use strict';

// Watches the AI sessions running on this machine.
//
// Claude Code writes one JSON file per live session into ~/.claude/sessions,
// named after the process id, and keeps "status" and "statusUpdatedAt" current
// inside it. That is the whole signal: it already says busy or idle and when it
// last changed, so there is no reason to go near the transcripts in
// ~/.claude/projects - those run to megabytes and would have to be tail-read on
// every event to learn what this file states outright.
//
// What the file cannot tell us is whether the session is still alive: a process
// that dies badly leaves its file behind. So every pid gets checked before its
// row is shown.
//
// Deliberately free of electron imports so it can be exercised from plain node.
//
// Nothing here leaves the machine. The session list names the user's folders and
// whatever they called each session; it goes to the notch window and nowhere
// else, and the directory is only ever read.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const { buildSessions } = require('./renderer/ai-state');

// fs.watch on Windows fires a burst per write, and Claude Code rewrites the
// whole file; wait for the burst to settle rather than re-reading five times.
const SETTLE_MS = 180;
// A backstop, for the two things a watch cannot report: a watcher that quietly
// stopped working (it happens on Windows, especially over a network profile),
// and a pid that died without touching its file at all.
const POLL_MS = 15000;
// If the directory is not there yet, Claude Code has simply not run since boot.
const RETRY_WATCH_MS = 30000;

class AiMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.dir = options.dir || path.join(os.homedir(), '.claude', 'sessions');
    this.home = options.home || os.homedir();
    this.pollMs = options.pollMs || POLL_MS;
    // Session files carry the pid's domain, so files that roamed in from
    // another machine can be told apart from ours. Matches what Claude Code
    // writes: platform plus the user name, lowercased.
    this.pidDomain = options.pidDomain || defaultPidDomain();
    this.sessions = [];
    this.watcher = null;
    this.settleTimer = null;
    this.poller = null;
    this.retryTimer = null;
    this.stopped = false;
    this.signature = '';
  }

  start() {
    this.stopped = false;
    this.refresh();
    this._watch();
    this.poller = setInterval(() => this.refresh(), this.pollMs);
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.settleTimer);
    clearTimeout(this.retryTimer);
    clearInterval(this.poller);
    this.settleTimer = null;
    this.retryTimer = null;
    this.poller = null;
    this._unwatch();
  }

  /** Read the directory now and emit if the list actually changed. */
  refresh() {
    if (this.stopped) return this.sessions;

    const files = this._read();
    const sessions = buildSessions(files, {
      now: Date.now(),
      home: this.home,
      isAlive,
      pidDomain: this.pidDomain,
    });

    // Durations are derived in the renderer, so the record only changes when
    // the files do. That keeps a 15s poll from redrawing the list for nothing.
    const signature = JSON.stringify(sessions);
    if (signature === this.signature) return this.sessions;
    this.signature = signature;
    this.sessions = sessions;
    this.emit('sessions', sessions);
    return sessions;
  }

  _read() {
    let names;
    try {
      names = fs.readdirSync(this.dir);
    } catch (err) {
      // ENOENT just means Claude Code has not started a session on this box.
      if (err.code !== 'ENOENT') this.emit('log', 'cannot read ' + this.dir + ': ' + err.message);
      return [];
    }

    const files = [];
    for (const name of names) {
      // Session state only; the directory also holds per-session .key files.
      if (!name.endsWith('.json')) continue;
      try {
        files.push({ name, contents: fs.readFileSync(path.join(this.dir, name), 'utf8') });
      } catch {
        // Gone or locked between the listing and the read; skip it this round.
      }
    }
    return files;
  }

  _watch() {
    if (this.stopped || this.watcher) return;
    try {
      this.watcher = fs.watch(this.dir, () => this._settle());
    } catch (err) {
      // The directory appears the first time a session starts; keep looking.
      this.emit('log', 'not watching yet (' + err.code + '), retrying');
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this._watch();
      }, RETRY_WATCH_MS);
      return;
    }
    this.watcher.on('error', (err) => {
      this.emit('log', 'watch error: ' + err.message);
      this._unwatch();
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this._watch();
      }, RETRY_WATCH_MS);
    });
  }

  _unwatch() {
    try {
      this.watcher?.close();
    } catch {
      // already gone
    }
    this.watcher = null;
  }

  _settle() {
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      this.refresh();
    }, SETTLE_MS);
  }
}

function defaultPidDomain() {
  let user = '';
  try {
    user = os.userInfo().username || '';
  } catch {
    user = '';
  }
  return process.platform + ':' + user.toLowerCase();
}

/** Whether a pid is still running. Signal 0 only tests, it does not signal. */
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but belongs to someone else, which still
    // counts as alive; only ESRCH means nothing is there.
    return err.code === 'EPERM';
  }
}

module.exports = { AiMonitor, isAlive, POLL_MS };
