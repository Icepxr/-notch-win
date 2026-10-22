'use strict';

// Turns the JSON that Claude Code drops in ~/.claude/sessions into the rows the
// notch paints.
//
// Pure on purpose, the same way media-state.js is: the main process builds the
// list once and ships it over IPC, the renderer re-derives the wording and the
// status colour on every tick (durations age by themselves, with no new file
// event to trigger them), and test/aimon.js can exercise all of it without a
// window, a watcher, or a live session. Loaded both with require() and as a
// plain <script>, hence the wrapper - and it lives in this folder so the page
// can load it as a same-directory script under the CSP.
//
// Everything here stays on this machine. The session files describe what the
// user is working on, folder names and all, so nothing in this module reaches
// for the network and nothing is ever written back.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AiState = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // A session whose turn ended is waiting for the user - but only for a while.
  // Past this it is just something left open, and it stops claiming attention.
  const QUIET_AFTER_MS = 10 * 60 * 1000;

  // The only two values observed in the wild. Claude Code owns this field and
  // may well grow more, so anything else deliberately falls through to
  // 'unknown', which shows the raw string: a wrong colour is worse than an
  // unfamiliar word.
  const STATUS_KINDS = {
    busy: 'working',
    idle: 'waiting',
  };

  const KIND_ORDER = { working: 0, waiting: 1, unknown: 2, quiet: 3 };

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function stamp(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
  }

  /** One session file's contents, or null for anything that is not one. */
  function parseSessionFile(contents) {
    if (typeof contents !== 'string') return null;
    const trimmed = contents.trim();
    if (!trimmed || trimmed[0] !== '{') return null;
    let value;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return null; // half-written file; the next watch event brings the rest
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    // The pid is the one field we cannot do without: it is how we tell a live
    // session from a file left behind by one that died badly.
    const ok = typeof value.pid === 'number' && Number.isInteger(value.pid) && value.pid > 0;
    return ok ? value : null;
  }

  /**
   * Shorten a working directory to something that fits a 12px row: the home
   * folder becomes ~, and anything deeper than two levels keeps only its tail.
   */
  function shortenPath(cwd, home) {
    // Both separators turn up in these files, and the two paths being compared
    // need not agree on which, so settle on backslashes before anything else.
    let rest = text(cwd).replace(/\//g, '\\').replace(/\\+$/, '');
    if (!rest) return '';

    const base = text(home).replace(/\//g, '\\').replace(/\\+$/, '');
    const lower = rest.toLowerCase();
    const baseLower = base.toLowerCase();
    let prefix = '';

    // Windows paths differ in case without differing at all.
    if (base && (lower === baseLower || lower.startsWith(baseLower + '\\'))) {
      rest = rest.slice(base.length).replace(/^\\+/, '');
      prefix = '~';
      if (!rest) return prefix;
    }

    const parts = rest.split(/\\+/).filter(Boolean);
    const tail = parts.slice(-2);
    if (prefix) return prefix + '\\' + tail.join('\\');
    return (parts.length > tail.length ? '…\\' : '') + tail.join('\\');
  }

  /**
   * A session file's raw JSON as the stable record the notch stores. Timestamps
   * travel as they are so the renderer can age them without another IPC round.
   */
  function toSession(raw, options) {
    if (!raw || typeof raw.pid !== 'number') return null;

    const home = options && options.home;
    const cwd = text(raw.cwd);
    const sessionId = text(raw.sessionId);
    const folder = shortenPath(cwd, home);

    return {
      pid: raw.pid,
      sessionId,
      // An unnamed session still needs something to point at in the list.
      name: text(raw.name) || folder || (sessionId ? sessionId.slice(0, 8) : 'pid ' + raw.pid),
      cwd,
      folder,
      status: text(raw.status),
      // Not every session file carries every timestamp; walk down the chain
      // rather than claiming the status started at the epoch.
      statusAt: stamp(raw.statusUpdatedAt) || stamp(raw.updatedAt) || stamp(raw.startedAt),
      startedAt: stamp(raw.startedAt),
    };
  }

  /** How long the session has held its current status, in ms. */
  function sinceOf(session, now) {
    if (!session || !session.statusAt) return 0;
    const at = Number.isFinite(now) ? now : Date.now();
    // A clock that jumped backwards should read as "just now", not negative.
    return Math.max(0, at - session.statusAt);
  }

  /** 'working' | 'waiting' | 'quiet' | 'unknown' - what the dot colours by. */
  function kindOf(session, now) {
    if (!session) return 'unknown';
    const kind = STATUS_KINDS[session.status] || 'unknown';
    // A finished turn nobody came back to is not really waiting any more.
    if (kind === 'waiting' && sinceOf(session, now) >= QUIET_AFTER_MS) return 'quiet';
    return kind;
  }

  function formatSince(ms) {
    const total = Math.floor(Number.isFinite(ms) && ms > 0 ? ms : 0);
    const minutes = Math.floor(total / 60000);
    if (minutes < 1) return 'Under a minute';
    if (minutes < 60) return minutes + ' min';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      const rest = minutes % 60;
      return rest ? hours + 'h ' + rest + ' min' : hours + 'h';
    }
    return Math.floor(hours / 24) + 'd';
  }

  /** The right-hand column of a row: what it is doing, and for how long. */
  function describe(session, now) {
    const kind = kindOf(session, now);
    const since = sinceOf(session, now);
    // Under a minute the number is noise, and "0 min" reads like a bug.
    const duration = since >= 60000 ? formatSince(since) : '';

    if (kind === 'working') return duration ? 'Working · ' + duration : 'Working';
    if (kind === 'waiting') return duration ? 'Waiting · ' + duration : 'Waiting for you';
    if (kind === 'quiet') return 'Idle · ' + formatSince(since);
    // Unknown status: say what the file actually said instead of guessing.
    const raw = session && session.status ? session.status : 'Unknown status';
    return duration ? raw + ' ' + duration : raw;
  }

  /** Busiest first, then whoever has waited longest, so the top row matters. */
  function sortSessions(list, now) {
    return (list || []).slice().sort((a, b) => {
      const byKind = KIND_ORDER[kindOf(a, now)] - KIND_ORDER[kindOf(b, now)];
      if (byKind) return byKind;
      // Within a kind, the one that has sat there longest is the interesting one.
      if (a.statusAt !== b.statusAt) return a.statusAt - b.statusAt;
      return a.pid - b.pid;
    });
  }

  function waitingCount(list, now) {
    let count = 0;
    for (const session of list || []) {
      if (kindOf(session, now) === 'waiting') count += 1;
    }
    return count;
  }

  /**
   * A whole directory's worth of files as the notch's session list.
   *
   * @param {Array<{contents:string}>} files one entry per session file
   * @param {{now?:number, home?:string, isAlive?:(pid:number)=>boolean, pidDomain?:string}} opts
   *   isAlive decides whether a pid is still running, which is the one thing
   *   this cannot work out for itself: a session that died without cleaning up
   *   leaves its file behind, and a stale row is worse than no row. Injecting it
   *   is also what lets the tests cover dead pids without killing anything.
   */
  function buildSessions(files, opts) {
    const options = opts || {};
    const now = Number.isFinite(options.now) ? options.now : Date.now();
    const isAlive = typeof options.isAlive === 'function' ? options.isAlive : () => true;
    const byPid = new Map();

    for (const file of files || []) {
      const raw = parseSessionFile(file && file.contents);
      if (!raw) continue;

      // A roamed profile can carry another machine's session files, where that
      // pid means nothing to us - and might even be alive here by coincidence.
      if (options.pidDomain && raw.pidDomain && raw.pidDomain !== options.pidDomain) continue;

      let alive;
      try {
        alive = isAlive(raw.pid) === true;
      } catch {
        alive = false;
      }
      if (!alive) continue;

      const session = toSession(raw, { home: options.home });
      if (!session) continue;

      // One file per pid is the rule, but a duplicate must not double a row.
      const existing = byPid.get(session.pid);
      if (!existing || existing.statusAt < session.statusAt) byPid.set(session.pid, session);
    }

    return sortSessions([...byPid.values()], now);
  }

  return {
    QUIET_AFTER_MS,
    STATUS_KINDS,
    parseSessionFile,
    shortenPath,
    toSession,
    sinceOf,
    kindOf,
    formatSince,
    describe,
    sortSessions,
    waitingCount,
    buildSessions,
  };
}));
