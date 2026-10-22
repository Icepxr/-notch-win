'use strict';
// SPDX-License-Identifier: GPL-3.0-or-later
// Usage/event mapping adapted from Vorssaint's CodexReader/ClaudeReader.
// Only derived counters and lifecycle metadata survive parseLine().
const clean = (value, fallback = '') => typeof value === 'string' ? value.replace(/[\x00-\x1f]/g, '').slice(0, 200) : fallback;
const num = (value) => Number.isFinite(value) && value >= 0 ? value : 0;
const folder = (cwd) => clean(cwd).split(/[\\/]/).filter(Boolean).pop() || 'Unknown project';
function tokens(raw = {}, provider = 'codex') {
  const cached = num(provider === 'claude' ? raw.cache_read_input_tokens : raw.cached_input_tokens);
  const write = num(provider === 'claude' ? raw.cache_creation_input_tokens : raw.cache_write_input_tokens);
  const input = Math.max(0, num(raw.input_tokens) - (provider === 'codex' ? cached + write : 0));
  const output = num(raw.output_tokens);
  return { input, output, cached, write, total: input + output + cached + write };
}
function windows(raw = {}, observedAt = Date.now(), source = 'log') {
  if (raw.limit_id && raw.limit_id !== 'codex' || raw.limitId && raw.limitId !== 'codex') return null;
  const result = ['primary', 'secondary'].flatMap((slot) => {
    const item = raw[slot];
    if (!item) return [];
    const used = item.usedPercent ?? item.used_percent;
    if (!Number.isFinite(used)) return [];
    const resets = item.resetsAt ?? item.resets_at;
    return [{ used: Math.min(100, Math.max(0, used)), minutes: num(item.windowDurationMins ?? item.window_minutes),
      resetsAt: Number.isFinite(resets) && resets > 0 ? resets * 1000 : null }];
  }).sort((a, b) => a.minutes - b.minutes);
  return result.length ? { windows: result, observedAt, source, plan: clean(raw.planType ?? raw.plan_type) } : null;
}
function newState(provider, id) {
  return { provider, id, sessionId: id, counterSession: id, model: 'Unknown model', project: 'Unknown project',
    lastTotal: 0, status: 'unknown', statusAt: 0, lastAt: 0, startedAt: 0, records: new Map(), totals: new Map(), limits: null, modern: false };
}
function parseLine(line, state) {
  // Skip response/tool bodies before JSON decoding wherever possible.
  if (!/"type"\s*:\s*"(?:session_meta|turn_context|event_msg|token_usage_record|assistant|user)"/.test(line)) return;
  let event; try { event = JSON.parse(line); } catch { return; }
  const at = Date.parse(event.timestamp);
  if (!Number.isFinite(at)) return;
  const p = event.payload || {};
  function activity(status) {
    state.lastAt = at;
    if (state.status !== status) { state.status = status; state.statusAt = at; }
    if (status === 'busy' && !state.startedAt) state.startedAt = at;
  }
  function record(key, usage, modern = false) {
    const t = tokens(usage, state.provider);
    if (!t.total) return;
    (modern ? state.records : state.totals).set(key, { key, at, provider: state.provider,
      sessionId: state.sessionId, project: state.project, model: state.model, ...t });
  }
  if (state.provider === 'codex') {
    if (event.type === 'session_meta') {
      const id = clean(p.id, state.id);
      if (state.counterSession !== id) state.lastTotal = 0;
      state.counterSession = id;
      if (!state.header) { state.header = true; state.sessionId = id; state.project = folder(p.cwd); }
    } else if (event.type === 'turn_context') {
      state.model = clean(p.model, state.model); if (p.cwd) state.project = folder(p.cwd);
    } else if (event.type === 'token_usage_record' && p.usage) {
      state.modern = true;
      record('codex:' + clean(p.response_id, state.counterSession + ':' + at), p.usage, true);
      activity(state.status === 'idle' ? 'idle' : 'busy');
    } else if (event.type === 'event_msg') {
      if (p.type === 'task_started') { state.startedAt = at; activity('busy'); }
      if (p.type === 'task_complete' || p.type === 'turn_aborted') { activity('idle'); state.completed = p.type === 'task_complete'; }
      if (p.type === 'token_count') {
        const limit = windows(p.rate_limits || {}, at); if (limit) state.limits = limit;
        const info = p.info;
        if (info?.total_token_usage) {
          const total = tokens(info.total_token_usage).total;
          if (total > state.lastTotal) {
            const usage = info.last_token_usage || Object.fromEntries(Object.entries(info.total_token_usage).map(([key, value]) => [key, Math.max(0, num(value) - num(state.previous?.[key]))]));
            record('codex:' + state.counterSession + ':total:' + total, usage);
          }
          state.lastTotal = total; state.previous = info.total_token_usage;
        }
        activity(state.status === 'idle' ? 'idle' : 'busy');
      }
    }
  } else if (state.provider === 'claude') {
    state.sessionId = clean(event.sessionId, state.sessionId);
    if (event.cwd) state.project = folder(event.cwd);
    if (event.type === 'assistant') {
      const m = event.message || {};
      state.model = clean(m.model, state.model);
      if (m.usage) record('claude:' + clean(m.id, state.sessionId + ':' + at) + ':' + clean(event.requestId), m.usage);
      if (!event.isSidechain) {
        const ended = ['end_turn', 'stop_sequence', 'max_tokens', 'refusal'].includes(m.stop_reason);
        activity(ended ? 'idle' : 'busy'); state.completed = ended && !event.isApiErrorMessage;
      }
    } else if (event.type === 'user' && !event.isSidechain && !event.isMeta) {
      // Tool results do not begin a new turn; never retain their contents.
      const content = event.message?.content;
      if (Array.isArray(content) && content.some((block) => block.type === 'tool_result')) return;
      if (event.toolEndsTurn || typeof content === 'string' && /^(\[Request interrupted by user|<local-command-std)/.test(content)) { activity('idle'); return; }
      state.startedAt = at; activity('busy'); state.completed = false;
    }
  }
}
function dayKey(time) { const d = new Date(time); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); }
function summarize(states, now = Date.now()) {
  const rows = new Map(), sessions = [], limits = {}, seen = new Set();
  for (const state of states) {
    seen.add(state.provider);
    for (const [key, row] of (state.modern ? state.records : state.totals)) {
      if (row.at >= now - 31 * 86400000 && row.at <= now + 60000) rows.set(key, row);
    }
    for (const map of [state.records, state.totals]) for (const [key, row] of map) if (row.at < now - 31 * 86400000) map.delete(key);
    if (state.limits && (!limits[state.provider] || state.limits.observedAt > limits[state.provider].observedAt)) limits[state.provider] = state.limits;
    if (state.lastAt > now - 600000 && state.lastAt <= now + 60000 && state.status !== 'unknown') {
      sessions.push({ provider: state.provider, sessionId: state.sessionId, name: state.project, folder: state.project,
        model: state.model, status: state.status, statusAt: state.statusAt, startedAt: state.startedAt,
        completed: !!state.completed, inferred: true });
    }
  }
  // Deduplicate a thread appearing in both a resumed and a copied log.
  const live = new Map();
  for (const s of sessions) { const key = s.provider + ':' + s.sessionId; if (!live.has(key) || live.get(key).statusAt < s.statusAt) live.set(key, s); }
  return { records: [...rows.values()], sessions: [...live.values()], limits, providers: [...seen] };
}
module.exports = { newState, parseLine, summarize, tokens, windows, dayKey };
