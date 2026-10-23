'use strict';
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Vorssaint
// NotchAgentSupport: ordered cards, paired rows, readout and quota semantics.
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.AiView = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const providers = ['codex','claude'];
  const cards = { limits: 'Account limits', tokens: 'Token usage', live: 'Sessions', trend: 'Daily trend', models: 'Models', projects: 'Projects', activity: 'Activity' };
  function normalize(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
    const order = [...new Set([...(Array.isArray(value.order) ? value.order : []), ...Object.keys(cards)])].filter(id => Object.hasOwn(cards,id));
    return { provider: ['all',...providers].includes(value.provider) ? value.provider : 'all', period: ['today','7','30'].includes(value.period) ? value.period : 'today',
      hidden: [...new Set(Array.isArray(value.hidden) ? value.hidden : [])].filter(id => Object.hasOwn(cards,id)), order,
      limitDisplay: value.limitDisplay === 'used' ? 'used' : 'remaining', readout: value.readout === 'quota' ? 'quota' : 'elapsed' };
  }
  const number = n => typeof n === 'number' && Number.isFinite(n) ? Math.max(0,n) : 0;
  function dayKey(value) { const d = new Date(value); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); }
  function days(count, now) {
    const today = new Date(now); today.setHours(0,0,0,0);
    return Array.from({length:count},(_,i) => { const date = new Date(today); date.setDate(date.getDate()-count+1+i); return { day:dayKey(date), date:date.getTime(), total:0, codex:0, claude:0 }; });
  }
  function totals(rows) {
    return rows.reduce((sum,row) => { for (const key of Object.keys(sum)) sum[key] += number(row[key]); return sum; }, { total:0,input:0,output:0,cached:0,write:0,responses:0 });
  }
  function buckets(rows, count, now) {
    const result = days(count,now), lookup = new Map(result.map(day => [day.day,day]));
    for (const row of rows) { const day = lookup.get(row.day); if (day && providers.includes(row.provider)) { day[row.provider] += number(row.total); day.total += number(row.total); } }
    return result;
  }
  function shownProviders(data, chosen = 'all') {
    if (providers.includes(chosen)) return [chosen];
    return providers.filter(id => (data.providers || []).includes(id) || data.limits?.[id]
      || (data.sessions || []).some(row => row.provider === id) || (data.buckets || []).some(row => row.provider === id)
      || ['ready','signin','outdated','no-limits'].includes(id === 'codex' ? data.accountStatus : data.claudeAccountStatus));
  }
  function windowReading(window, limits, mode, now) {
    const used = Number.isFinite(window.used) ? Math.max(0,Math.min(100,window.used)) : null;
    const reset = Number.isFinite(window.resetsAt) && window.resetsAt > 0 ? window.resetsAt : null;
    const expired = reset !== null && reset <= now;
    const stale = limits.source !== 'account' || !Number.isFinite(limits.observedAt) || now-limits.observedAt > 600000;
    const value = used === null || expired ? null : Math.round(mode === 'used' ? used : 100-used);
    const elapsed = reset !== null && window.minutes > 0 ? 1-(reset-now)/(window.minutes*60000) : null;
    const pace = !stale && value !== null && elapsed > .02 && elapsed < .98 ? (mode === 'used' ? elapsed : 1-elapsed)*100 : null;
    return { used,value,reset,expired,stale,pace,level: used >= 95 ? 'critical' : used >= 80 ? 'low' : 'normal' };
  }
  function quota(data, id, mode, now) {
    const limits = data.limits?.[id], status = id === 'codex' ? data.accountStatus : data.claudeAccountStatus;
    // A signed-out account must not inherit a previous account's reading.
    if (!limits || status === 'signin') return [];
    return (Array.isArray(limits.windows) ? limits.windows : []).map((window,index) => ({ ...window, key: window.id || [window.minutes,window.scope || '',index].join(':'), ...windowReading(window,limits,mode,now) }));
  }
  function tiles(view, shown) {
    const sequence = [];
    for (const id of view.order.filter(id => !view.hidden.includes(id))) {
      if (id === 'limits') for (const provider of shown) sequence.push({ key:'limits.'+provider,card:id,provider });
      else sequence.push({ key:id,card:id });
    }
    const rows = []; let pending;
    for (const tile of sequence) {
      if (['trend','activity'].includes(tile.card)) { if (pending) rows.push([pending]); pending=null; rows.push([tile]); }
      else if (pending) { rows.push([pending,tile]); pending=null; }
      else pending=tile;
    }
    if (pending) rows.push([pending]);
    return rows.flatMap(row => row.map(tile => ({ ...tile,wide:row.length === 1 })));
  }
  function height(tiles, empty = false) {
    if (empty || !tiles.length) return 280;
    let height = 164;
    for (let i=0;i<tiles.length;i++) {
      const tile = tiles[i];
      height += (tile.card === 'limits' ? 152 : ['trend','activity'].includes(tile.card) ? 128 : 112)+10;
      if (!tile.wide) i++;
    }
    return Math.min(510,Math.max(250,height));
  }
  return { providers,cards,normalize,number,dayKey,days,totals,buckets,shownProviders,windowReading,quota,tiles,height };
}));
