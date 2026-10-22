'use strict';
window.AiPanel = (() => {
  const root = document.getElementById('ai-dashboard');
  let data = { buckets: [], sessions: [], limits: {}, providers: [], accountStatus: 'loading' };
  let provider = 'all', period = 'today', hidden = [];
  try { const p = JSON.parse(localStorage.getItem('ai-view') || '{}'); provider = ['all', 'codex', 'claude'].includes(p.provider) ? p.provider : 'all'; period = ['today', '7', '30'].includes(p.period) ? p.period : 'today'; hidden = Array.isArray(p.hidden) ? p.hidden : []; } catch {}
  const labels = { all: 'All', codex: 'Codex', claude: 'Claude' };
  const cards = { limits: 'Remaining quota', tokens: 'Token', live: 'Sessions', trend: 'Trend', models: 'Models', projects: 'Projects', activity: 'Activity' };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const count = (n) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
  const dayKey = (value) => { const d = new Date(value); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };
  function save() { try { localStorage.setItem('ai-view', JSON.stringify({ provider, period, hidden })); } catch {} }
  root.innerHTML = `<div class="ai-toolbar"><div class="ai-providers" role="group" aria-label="AI provider">${Object.entries(labels).map(([id, label]) => `<button data-ai-provider="${id}" aria-pressed="false">${label}</button>`).join('')}</div><select id="ai-period" aria-label="Usage period"><option value="today">Today</option><option value="7">7d</option><option value="30">30d</option></select><button id="ai-refresh" class="icon-btn" title="Refresh usage" aria-label="Refresh AI usage">↻</button><details class="ai-customize"><summary aria-label="Visible cards" title="Customize">⋯</summary><div>${Object.entries(cards).map(([id, name]) => `<label><input type="checkbox" data-ai-card="${id}" checked> ${name}</label>`).join('')}</div></details></div><div class="ai-readout" id="ai-meta" role="status"></div><div class="ai-grid" id="ai-cards"></div><p class="ai-privacy">Local activity · Tokens are not your plan’s bill.</p>`;
  const container = root.querySelector('#ai-cards'), meta = root.querySelector('#ai-meta');
  root.querySelectorAll('[data-ai-provider]').forEach((button) => button.addEventListener('click', () => { provider = button.dataset.aiProvider; save(); paint(); }));
  root.querySelector('#ai-period').addEventListener('change', (e) => { period = e.target.value; save(); paint(); });
  root.querySelectorAll('[data-ai-card]').forEach((input) => {
    input.checked = !hidden.includes(input.dataset.aiCard);
    input.addEventListener('change', () => { hidden = [...root.querySelectorAll('[data-ai-card]')].filter((e) => !e.checked).map((e) => e.dataset.aiCard); save(); paint(); });
  });
  root.querySelector('#ai-refresh').addEventListener('click', async (e) => {
    const button = e.currentTarget; button.disabled = true; meta.textContent = 'Refreshing usage…';
    try { const next = await notch.refreshAi(); if (next) update(next); } catch { meta.textContent = 'Cannot refresh. Try again.'; }
    setTimeout(() => { button.disabled = false; }, 10000);
  });
  root.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-ai-connect]');
    if (!button) return;
    button.disabled = true;
    try {
      const result = await notch.connectClaude();
      meta.textContent = result?.ok ? 'Complete Claude sign-in in Terminal, then Refresh.' : 'Cannot open Claude sign-in. Run Claude Code in Terminal.';
    } catch { meta.textContent = 'Cannot open Claude sign-in. Run Claude Code in Terminal.'; }
    finally { if (button.isConnected) button.disabled = false; }
  });
  function card(id, content, wide = false) { return hidden.includes(id) ? '' : `<article class="ai-card ${wide ? 'ai-wide' : ''}" data-card="${id}">${content}</article>`; }
  function resetText(w, now) {
    if (!w.resetsAt) return 'Reset time unavailable';
    const delta = w.resetsAt - now;
    if (delta <= 0) return 'Reset due · Awaiting update';
    const m = Math.ceil(delta / 60000);
    return 'Resets in ' + (m >= 1440 ? Math.floor(m / 1440) + 'd ' + Math.floor(m % 1440 / 60) + 'h' : m >= 60 ? Math.floor(m / 60) + 'h ' + m % 60 + ' min' : m + ' min');
  }
  /** "5 hours", "Weekly" — the two windows people actually think in. */
  function windowLabel(minutes, scope) {
    const base = minutes >= 10080 ? 'Weekly'
      : minutes >= 1440 ? Math.round(minutes / 1440) + ' days'
        : minutes >= 60 ? Math.round(minutes / 60) + ' hours'
          : minutes ? minutes + ' min' : 'Window';
    return scope ? base + ' · ' + scope : base;
  }

  function agentMark(id) {
    const mark = ProviderMarks.markFor(id);
    return `<span class="ai-agent-mark" aria-hidden="true"><svg viewBox="${mark.viewBox}"><path d="${mark.path}"/></svg></span>`;
  }

  /** One window: its name, what is left, a bar, and when it comes back. */
  function windowCell(id, w, now, stale) {
    const expired = w.resetsAt && w.resetsAt <= now;
    const left = expired ? null : Math.round(100 - w.used);
    const label = windowLabel(w.minutes, w.scope);
    const level = left !== null && left <= 20 ? ' is-low' : '';
    return `<div class="ai-win${level}${expired || stale ? ' is-stale' : ''}">`
      + `<span class="ai-win-label">${esc(label)}</span>`
      + `<strong class="ai-win-value">${left === null ? '—' : left + '<i>%</i>'}</strong>`
      + `<span class="ai-win-bar" role="progressbar" aria-label="${labels[id]} remaining · ${esc(label)}"`
      + ` aria-valuemin="0" aria-valuemax="100" aria-valuenow="${left === null ? 0 : left}">`
      + `<i data-fill="${left === null ? 0 : left}"></i></span>`
      + `<small title="${w.resetsAt ? esc(new Date(w.resetsAt).toLocaleString('en-US')) : ''}">${resetText(w, now)}</small></div>`;
  }

  /**
   * An agent with no publishable quota keeps both window slots, so the two
   * agents stay the same shape, and fills them with what this machine does
   * know. An empty slot that is clearly an empty slot beats a missing row.
   */
  function activityCells(id, rows) {
    const mine = (rows || []).filter((r) => r.provider === id);
    const sums = mine.reduce((a, r) => ({ total: a.total + (r.total || 0), responses: a.responses + (r.responses || 0) }),
      { total: 0, responses: 0 });
    const window = period === 'today' ? 'Today' : 'Last ' + period + ' days';
    return `<div class="ai-win is-measured"><span class="ai-win-label">Tokens · ${window}</span>`
      + `<strong class="ai-win-value">${mine.length ? count(sums.total) : '—'}</strong>`
      + `<small>Counted on this machine</small></div>`
      + `<div class="ai-win is-measured"><span class="ai-win-label">Responses · ${window}</span>`
      + `<strong class="ai-win-value">${mine.length ? count(sums.responses) : '—'}</strong>`
      + `<small>Not a plan allowance</small></div>`;
  }

  function agentBlock(id, now, rows) {
    const limits = data.limits[id];
    const status = id === 'claude' ? data.claudeAccountStatus : data.accountStatus;
    if (!limits) {
      const reason = id === 'claude'
        ? { loading: 'Reading account limits…', missing: 'Claude Code CLI not found', signin: 'Not signed in',
          'no-limits': 'This plan publishes no limits', outdated: 'Update Claude Code to read limits',
          unavailable: 'Limits could not be read' }[status] || 'No account reading yet'
        : { loading: 'Reading account limits…', missing: 'Codex CLI not found', signin: 'Not signed in',
          unavailable: 'Quota temporarily unavailable' }[status] || 'No quota data yet';
      const signin = id === 'claude' && status === 'signin'
        ? '<div class="ai-agent-foot"><small>In Terminal: <code>claude auth login</code></small>'
          + '<button type="button" class="ai-connect" data-ai-connect>Connect <span aria-hidden="true">↗</span></button></div>'
        : '';
      return `<div class="ai-agent" data-agent="${id}">`
        + `<div class="ai-agent-head">${agentMark(id)}<span class="ai-agent-name">${labels[id]}</span>`
        + `<span class="ai-agent-plan is-reason">${esc(reason)}</span></div>`
        + `<div class="ai-agent-windows">${activityCells(id, rows)}</div>${signin}</div>`;
    }
    const stale = now - limits.observedAt > 600000 || limits.source !== 'account';
    return `<div class="ai-agent" data-agent="${id}">`
      + `<div class="ai-agent-head">${agentMark(id)}<span class="ai-agent-name">${labels[id]}</span>`
      + `<span class="ai-agent-plan">${esc(limits.plan)}</span>`
      + `<span class="ai-agent-source${stale ? ' is-stale' : ''}">${stale ? 'Log snapshot' : 'Live'}</span></div>`
      + `<div class="ai-agent-windows">${limits.windows.map((w) => windowCell(id, w, now, stale)).join('')}</div></div>`;
  }

  function limitCard(now, rows) {
    const providers = provider === 'all' ? ['codex', 'claude'] : [provider];
    const resets = data.resets !== null && data.resets !== undefined && provider !== 'claude'
      ? `<div class="ai-reset-credit">Codex resets available <b>${data.resets.toLocaleString()}</b></div>` : '';
    return card('limits', `<div class="ai-card-head"><span>Remaining quota</span><span class="ai-soft">Per account</span></div>`
      + providers.map((id) => agentBlock(id, now, rows)).join('') + resets, true);
  }

  function ranking(rows, key, title) {
    const groups = new Map(); for (const r of rows) groups.set(r[key], (groups.get(r[key]) || 0) + r.total);
    const list = [...groups].sort((a, b) => b[1] - a[1]).slice(0, 4), max = list[0]?.[1] || 1;
    return card(key === 'model' ? 'models' : 'projects', `<div class="ai-card-head">${title}<span class="ai-soft">token</span></div>` + (list.length ? list.map(([name, n]) => `<div class="ai-ranking"><div><span title="${esc(name)}">${esc(name)}</span><b>${count(n)}</b></div><progress max="${max}" value="${n}" aria-label="${esc(name)} ${n} token"></progress></div>`).join('') : '<p class="ai-empty">No activity in this period.</p>'));
  }
  function paint() {
    const now = Date.now(), today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - (period === 'today' ? 0 : Number(period) - 1));
    const matches = (r) => provider === 'all' || r.provider === provider;
    const allRows = (data.buckets || []).filter(matches), rows = allRows.filter((r) => r.day >= dayKey(start) && r.day <= dayKey(now));
    const sessions = AiState.sortSessions((data.sessions || []).filter(matches), now);
    root.querySelectorAll('[data-ai-provider]').forEach((e) => e.setAttribute('aria-pressed', String(e.dataset.aiProvider === provider)));
    root.querySelector('#ai-period').value = period;
    meta.textContent = data.scanFailed ? 'Cannot read activity. Restart the app to retry.' : data.scanning ? 'Reading history · Totals are incomplete' : data.updatedAt ? 'Updated ' + new Date(data.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' · ' + sessions.length + ' recent sessions' : 'Looking for Codex & Claude Code…';
    const totals = rows.reduce((a, r) => { for (const key of ['total', 'cached', 'input', 'output', 'write', 'responses']) a[key] += r[key] || 0; return a; }, { total: 0, cached: 0, input: 0, output: 0, write: 0, responses: 0 });
    const share = totals.input + totals.cached + totals.write;
    const tokenCard = card('tokens', `<div class="ai-card-head">Usage<span class="ai-soft">${period === 'today' ? 'Today' : period + 'd'}</span></div><div class="ai-total">${rows.length ? count(totals.total) : '—'}<small>token</small></div><div class="ai-token-split"><span>In ${count(totals.input)}</span><span>Out ${count(totals.output)}</span></div><div class="ai-cache">Cache ${share ? Math.round(totals.cached / share * 100) + '%' : '—'}<span>${count(totals.responses)} responses</span></div>`);
    const working = sessions.filter((s) => AiState.kindOf(s, now) === 'working').length;
    const liveCard = card('live', `<div class="ai-card-head">Recent sessions<span class="ai-live-count">${working} working</span></div><div id="ai-list" class="ai-live-list">${sessions.length ? sessions.slice(0, 5).map((s) => `<div class="ai-live-row" title="${esc(s.inferred ? 'Inferred from recent logs; the process may have closed.' : 'Reported by a running process')}"><span class="ai-dot is-${AiState.kindOf(s, now)}"></span><div><b>${esc(s.name)}</b><small>${labels[s.provider] || 'Claude'} · ${esc(AiState.describe(s, now))}${s.inferred ? ' · log' : ''}</small></div></div>`).join('') : '<p class="ai-empty">No recent sessions.</p>'}</div>`);
    const days = Array.from({ length: period === '30' ? 30 : 7 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - ((period === '30' ? 30 : 7) - 1 - i)); return { day: dayKey(d), label: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), short: d.getDate(), total: 0 }; });
    for (const r of allRows) { const d = days.find((d) => d.day === r.day); if (d) d.total += r.total; }
    const max = Math.max(1, ...days.map((d) => d.total));
    const trend = card('trend', `<div class="ai-card-head">Daily tokens<span class="ai-soft">${days.length} days</span></div><div class="ai-trend" role="img" aria-label="${esc(days.map((d) => d.label + ': ' + d.total).join(', '))}">${days.map((d) => `<div title="${d.label} · ${d.total.toLocaleString()} token"><i data-height="${Math.max(3, d.total / max * 54)}" class="${d.day === dayKey(now) ? 'is-today' : ''}"></i><small>${days.length === 7 ? d.short : ''}</small></div>`).join('')}</div>` , true);
    const activityDays = Array.from({ length: 28 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - 27 + i); const key = dayKey(d); return { key, value: allRows.filter((r) => r.day === key).reduce((sum, r) => sum + r.total, 0) }; });
    const activityMax = Math.max(1, ...activityDays.map((d) => d.value));
    const activity = card('activity', `<div class="ai-card-head">Activity<span class="ai-soft">28 days</span></div><div class="ai-heatmap">${activityDays.map((d) => `<i class="ai-level-${d.value ? Math.max(1, Math.ceil(d.value / activityMax * 4)) : 0}" title="${d.key} · ${count(d.value)} token"></i>`).join('')}</div>`, true);
    // Preserve scroll and keyboard focus: controls remain mounted across polls.
    container.dataset.agent = provider;
    container.innerHTML = limitCard(now, rows) + tokenCard + liveCard + trend + ranking(rows, 'model', 'Models') + ranking(rows, 'project', 'Projects') + activity;
    for (const fill of container.querySelectorAll('[data-fill]')) fill.style.width = fill.dataset.fill + '%';
    container.querySelectorAll('[data-height]').forEach((bar) => { bar.style.height = bar.dataset.height + 'px'; });
    if (hidden.length === Object.keys(cards).length) container.innerHTML = '<p class="ai-empty">Choose cards from the ⋯ menu.</p>';
  }
  function update(next) { data = next || data; paint(); return data.sessions || []; }
  function updateSessions(list) { if (!data.updatedAt) { data.sessions = list.map((s) => ({ ...s, provider: 'claude' })); paint(); } }
  paint();
  setInterval(paint, 30000);
  return { update, updateSessions };
})();
