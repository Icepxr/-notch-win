'use strict';
const { EventEmitter } = require('node:events');
const { Worker } = require('node:worker_threads');
const path = require('node:path');
const os = require('node:os');
const { readLimits } = require('./ai-codex');
const { readClaudeLimits } = require('./ai-claude');
const { dayKey } = require('./ai-usage');
class AiDashboard extends EventEmitter {
  constructor(options = {}) {
    super(); this.options = options; this.data = { records: [], sessions: [], limits: {}, providers: [] };
    this.account = { status: 'loading' }; this.claudeAccount = { status: 'loading' };
    this.claude = []; this.updatedAt = 0; this.stopped = false;
  }
  start() {
    const home = this.options.home || os.homedir();
    const codexHome = this.options.codexHome || process.env.CODEX_HOME || path.join(home, '.codex');
    this.worker = new Worker(path.join(__dirname, 'ai-worker.js'), { workerData: { roots: {
      codex: [path.join(codexHome, 'sessions'), path.join(codexHome, 'archived_sessions')],
      claude: [path.join(this.options.claudeHome || process.env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'), 'projects')],
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
      this.refreshAccount(); this.refreshClaudeAccount();
      this.accountPoller = setInterval(() => { this.refreshAccount(); this.refreshClaudeAccount(); }, 300000);
    } else { this.account = { status: 'unavailable' }; this.claudeAccount = { status: 'unavailable' }; }
  }
  setClaude(sessions) { this.claude = sessions; this.publish(); }
  refreshClaudeAccount(force = false) {
    if (this.fetchingClaude || this.stopped) return this.fetchingClaude;
    if (!force && Date.now() < (this.claudeNextCheck || 0)) return Promise.resolve(this.claudeAccount);
    this.fetchingClaude = (this.options.readClaudeLimits || readClaudeLimits)({ onChild: (child) => { this.claudeChild = child; } }).then((account) => {
      if (this.stopped) return;
      if (account.limits && this.claudeAccount.limits) {
        for (const current of account.limits.windows) {
          const previous = this.claudeAccount.limits.windows.find((w) => w.id === current.id);
          if (current.used >= 80 && previous && previous.used < 80) this.emit('limit', { provider: 'claude', used: current.used, minutes: current.minutes });
        }
      }
      this.claudeAccount = account;
      this.claudeFailures = account.status === 'ready' ? 0 : (this.claudeFailures || 0) + 1;
      const delay = account.status === 'ready' ? 300000 : ['missing', 'signin', 'outdated'].includes(account.status)
        ? 1800000 : Math.min(1800000, 300000 * 2 ** Math.min(3, this.claudeFailures - 1));
      this.claudeNextCheck = Date.now() + delay;
      this.publish();
    }).finally(() => { this.fetchingClaude = null; });
    return this.fetchingClaude;
  }
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
    this.lastManual = Date.now(); this.worker?.postMessage('scan'); this.refreshAccount(); this.refreshClaudeAccount(true); return this.snapshot();
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
      providers: [...new Set([...this.data.providers, ...(this.claude.length || this.claudeAccount.status === 'ready' ? ['claude'] : []), ...(this.account.status === 'ready' ? ['codex'] : [])])],
      buckets: [...buckets.values()], sessions: [...live, ...this.claude.map((s) => ({ ...s, provider: 'claude', inferred: false }))],
      limits: { ...this.data.limits, ...(this.account.limits ? { codex: this.account.limits } : {}),
        ...(this.claudeAccount.limits ? { claude: this.claudeAccount.limits } : {}) },
      accountStatus: this.account.status, claudeAccountStatus: this.claudeAccount.status, resets: this.account.resets ?? null };
  }
  publish() { if (!this.stopped) this.emit('change', this.snapshot()); }
  stop() { this.stopped = true; clearInterval(this.poller); clearInterval(this.accountPoller); this.worker?.terminate(); this.worker = null; this.child?.kill(); this.claudeChild?.kill(); }
}
module.exports = { AiDashboard };
