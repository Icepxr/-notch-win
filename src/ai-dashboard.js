'use strict';
const { EventEmitter } = require('node:events');
const { Worker } = require('node:worker_threads');
const path = require('node:path');
const os = require('node:os');
const { readLimits } = require('./ai-codex');
const { dayKey } = require('./ai-usage');
class AiDashboard extends EventEmitter {
  constructor(options = {}) {
    super(); this.options = options; this.data = { records: [], sessions: [], limits: {}, providers: [] };
    this.account = { status: 'loading' }; this.claude = []; this.updatedAt = 0; this.stopped = false;
  }
  start() {
    const home = this.options.home || os.homedir();
    const codexHome = this.options.codexHome || process.env.CODEX_HOME || path.join(home, '.codex');
    this.worker = new Worker(path.join(__dirname, 'ai-worker.js'), { workerData: { roots: {
      codex: [path.join(codexHome, 'sessions'), path.join(codexHome, 'archived_sessions')],
      claude: [path.join(home, '.claude', 'projects')],
    } } });
    this.worker.on('message', (data) => {
      const old = new Map(this.data.sessions.map((s) => [s.provider + ':' + s.sessionId, s]));
      this.data = data; this.updatedAt = data.updatedAt;
      for (const session of data.sessions) {
        const previous = old.get(session.provider + ':' + session.sessionId);
        if (previous?.status === 'busy' && session.status === 'idle' && session.completed
          && session.statusAt - session.startedAt >= 60000 && Date.now() - session.statusAt < 120000) this.emit('complete', session);
      }
      this.publish();
    });
    this.worker.on('error', () => { this.scanFailed = true; this.publish(); });
    this.worker.postMessage('scan');
    this.poller = setInterval(() => this.worker?.postMessage('scan'), 15000);
    if (this.options.account !== false) {
      this.refreshAccount(); this.accountPoller = setInterval(() => this.refreshAccount(), 300000);
    } else this.account = { status: 'unavailable' };
  }
  setClaude(sessions) { this.claude = sessions; this.publish(); }
  refreshAccount() {
    if (this.fetching || this.stopped) return this.fetching;
    this.fetching = readLimits({ onChild: (child) => { this.child = child; } }).then((account) => {
      if (this.stopped) return;
      if (account.limits && this.account.limits) {
        for (const current of account.limits.windows) {
          const previous = this.account.limits.windows.find((w) => w.minutes === current.minutes);
          if (current.used >= 80 && previous && previous.used < 80) this.emit('limit', { used: current.used, minutes: current.minutes });
        }
      }
      this.account = account; this.publish();
    }).finally(() => { this.fetching = null; });
    return this.fetching;
  }
  refresh() {
    // Bounded manual refresh prevents clicks from spawning multiple servers.
    if (Date.now() - (this.lastManual || 0) < 10000) return this.snapshot();
    this.lastManual = Date.now(); this.worker?.postMessage('scan'); this.refreshAccount(); return this.snapshot();
  }
  snapshot() {
    const buckets = new Map();
    for (const row of this.data.records) {
      const day = dayKey(row.at), key = JSON.stringify([row.provider, day, row.model, row.project]);
      let b = buckets.get(key);
      if (!b) { b = { provider: row.provider, day, model: row.model, project: row.project, input: 0, output: 0, cached: 0, write: 0, total: 0, responses: 0 }; buckets.set(key, b); }
      for (const name of ['input', 'output', 'cached', 'write', 'total']) b[name] += row[name];
      b.responses++;
    }
    const live = this.data.sessions.filter((s) => s.provider !== 'claude' || !this.claude.some((c) => c.sessionId === s.sessionId));
    return { updatedAt: this.updatedAt, scanning: !!this.data.scanning, scanFailed: !!this.scanFailed,
      providers: [...new Set([...this.data.providers, ...(this.claude.length ? ['claude'] : []), ...(this.account.status === 'ready' ? ['codex'] : [])])],
      buckets: [...buckets.values()], sessions: [...live, ...this.claude.map((s) => ({ ...s, provider: 'claude', inferred: false }))],
      limits: { ...this.data.limits, ...(this.account.limits ? { codex: this.account.limits } : {}) },
      accountStatus: this.account.status, resets: this.account.resets ?? null };
  }
  publish() { if (!this.stopped) this.emit('change', this.snapshot()); }
  stop() { this.stopped = true; clearInterval(this.poller); clearInterval(this.accountPoller); this.worker?.terminate(); this.worker = null; this.child?.kill(); }
}
module.exports = { AiDashboard };
