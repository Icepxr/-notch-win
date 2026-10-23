'use strict';
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Vorssaint
// Windows adaptation of SettingsView, NotchSettingsTabRow and SettingsCard.
window.SettingsNavigation = (() => {
  const sheet = document.querySelector('.sheet');
  const workspace = document.createElement('div'); workspace.className = 'settings-workspace';
  const sidebar = document.createElement('aside'); sidebar.className = 'settings-sidebar';
  const detail = document.createElement('div'); detail.className = 'settings-detail';
  const identity = document.querySelector('.identity');
  identity.querySelector('.monogram').textContent = 'I';
  const searchLabel = document.createElement('label'); searchLabel.className = 'settings-search';
  searchLabel.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg><input type="search" placeholder="Search settings" aria-label="Search settings" />';
  const search = searchLabel.querySelector('input');
  const results = document.createElement('div'); results.id = 'settings-results'; results.hidden = true;
  const nav = document.createElement('nav'); nav.setAttribute('aria-label', 'Settings pages');
  const paths = {
    general: '<path d="M4 5h12M4 10h12M4 15h12"/><circle cx="7" cy="5" r="2"/><circle cx="13" cy="10" r="2"/><circle cx="8" cy="15" r="2"/>',
    island: '<path d="M3 4h14v7a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Z"/>',
    displays: '<rect x="2" y="3" width="16" height="11" rx="2"/><path d="M7 18h6m-3-4v4"/>',
    music: '<path d="M8 15V5l9-2v10M8 8l9-2"/><ellipse cx="5" cy="15" rx="3" ry="2"/><ellipse cx="14" cy="13" rx="3" ry="2"/>',
  };
  const pages = { general: ['General', 'Your app and local data.'], island: ['Dynamic Island', 'Your music, activity and tools at the top of your screen.'], displays: ['Displays', 'Choose where your island belongs.'], music: ['Music', 'Now Playing, previews and artwork color.'] };
  nav.innerHTML = '<p class="sidebar-label">Workspace</p>' + Object.entries(pages).map(([id, [title]]) => `<button type="button" data-page="${id}"><svg viewBox="0 0 20 20" aria-hidden="true">${paths[id]}</svg><span>${title}</span></button>`).join('');
  const tools = document.createElement('div'); tools.className = 'settings-tools';
  tools.innerHTML = '<p class="sidebar-label">Open in the island</p>';
  for (const [id, title] of Object.entries(NotchModules.names)) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.openModule = id;
    button.innerHTML = '<span></span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10"/></svg>';
    button.querySelector('span').textContent = title; button.title = 'Open ' + title + ' in the notch'; tools.append(button);
  }
  sidebar.append(identity, searchLabel, results, nav, tools);
  const header = document.createElement('header'); header.className = 'settings-page-header';
  header.innerHTML = '<div class="settings-history"><button type="button" id="settings-back" aria-label="Back">‹</button><button type="button" id="settings-forward" aria-label="Forward">›</button></div><div><h1 id="settings-page-title"></h1><p id="settings-page-description"></p></div><button type="button" class="settings-open ghost" data-open-module="send" aria-label="Open notch" title="Open notch">↗</button>';
  const tabs = document.createElement('div'); tabs.className = 'settings-tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Dynamic Island settings');
  for (const name of ['Layout', 'Content', 'Activity', 'Behavior']) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.settingsTab = name.toLowerCase();
    button.setAttribute('role', 'tab'); button.id = 'settings-tab-' + name.toLowerCase(); button.textContent = name; tabs.append(button);
  }
  detail.append(header, tabs, sheet); workspace.append(sidebar, detail); document.querySelector('.titlebar').after(workspace);
  const panes = new Map();
  function pane(page, tab = '') {
    const key = page + ':' + tab;
    if (!panes.has(key)) {
      const section = document.createElement('div'); section.className = 'settings-page'; section.dataset.settingsPage = page; section.dataset.settingsTab = tab;
      section.id = 'settings-pane-' + (tab || page); section.hidden = true;
      if (tab) { section.setAttribute('role', 'tabpanel'); section.setAttribute('aria-labelledby', 'settings-tab-' + tab); }
      panes.set(key, section); sheet.append(section);
    }
    return panes.get(key);
  }
  function move(selector, page, tab = '') { const element = document.querySelector(selector); if (element) pane(page, tab).append(element); }
  function card(title, rows, page, tab) {
    const group = document.createElement('section'); group.className = 'group';
    const heading = document.createElement('h2'); heading.className = 'group-label'; heading.textContent = title; group.append(heading);
    for (const element of rows) if (element) group.append(element);
    pane(page, tab).append(group); return group;
  }
  const row = key => document.querySelector('[data-preference="' + key + '"]')?.closest('.row');
  card('Now Playing', [row('musicColors'), row('musicPreview')], 'music');
  card('Activity', [row('notchFocus'), row('systemFeedback')], 'island', 'activity');
  move('.appearance-studio', 'island', 'layout');
  // Group headings are nested in their section.
  for (const id of ['group-size', 'group-color', 'group-appearance']) {
    const group = document.getElementById(id)?.closest('.group'); if (group) pane('island', 'layout').append(group);
  }
  const behaviorGroup = row('autoDismiss').closest('.group'); behaviorGroup.prepend(document.getElementById('group-behavior')); pane('island', 'behavior').append(behaviorGroup);
  const displayGroup = document.getElementById('group-displays').closest('.group'); pane('displays').append(displayGroup);
  const aboutGroup = document.getElementById('group-about').closest('.group'); pane('general').append(aboutGroup);
  document.getElementById('studio-title').textContent = 'Layout preview';
  document.querySelector('.studio-heading p').textContent = 'Resting and expanded, as you adjust them.';
  const moduleCard = card('Modules', [], 'island', 'content');
  const intro = document.createElement('p'); intro.className = 'module-help'; intro.textContent = 'Choose what appears in Explore and arrange your tools. Shortcuts remain available.'; moduleCard.append(intro);
  const editor = document.createElement('div'); editor.id = 'module-editor'; moduleCard.append(editor);
  const moduleRows = new Map(); let prefs = NotchModules.normalize(), draggedModule = null;
  function finishModuleDrag() {
    draggedModule = null;
    for (const element of moduleRows.values()) element.classList.remove('is-dragging','is-drop-target');
  }
  for (const element of sheet.querySelectorAll('.row')) {
    if (element.classList.contains('theme-policy')) continue;
    const key = element.querySelector('[data-preference]')?.dataset.preference;
    const symbol = document.createElement('span'); symbol.className = 'settings-row-icon'; symbol.setAttribute('aria-hidden','true');
    const glyph = ['musicColors','musicPreview'].includes(key) ? paths.music : ['displayId','displayMode'].includes(key) ? paths.displays
      : key === 'silhouette' ? paths.island
      : key === 'autoDismiss' ? '<path d="m5 5 10 10M15 5 5 15"/>'
      : key === 'systemFeedback' ? '<path d="M3 8h4l5-4v12l-5-4H3Zm12-2a6 6 0 0 1 0 8"/>' : paths.general;
    symbol.innerHTML = '<svg viewBox="0 0 20 20">' + glyph + '</svg>'; element.prepend(symbol);
  }
  const patch = detail => document.dispatchEvent(new CustomEvent('settings:patch', { detail }));
  for (const id of NotchModules.ids) {
    const element = document.createElement('div'); element.className = 'module-setting'; element.dataset.module = id;
    const grip = document.createElement('span'); grip.className = 'module-grip'; grip.draggable = true; grip.setAttribute('aria-hidden','true'); grip.title = 'Drag to reorder';
    grip.innerHTML = '<svg viewBox="0 0 16 20"><path d="M5 5h.01M11 5h.01M5 10h.01M11 10h.01M5 15h.01M11 15h.01"/></svg>';
    grip.addEventListener('dragstart', event => { draggedModule = id; element.classList.add('is-dragging'); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-islet-module',id); });
    grip.addEventListener('dragend', finishModuleDrag);
    element.addEventListener('dragover', event => { if (!draggedModule || draggedModule === id) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; element.classList.add('is-drop-target'); });
    element.addEventListener('dragleave', event => { if (!element.contains(event.relatedTarget)) element.classList.remove('is-drop-target'); });
    element.addEventListener('drop', event => {
      if (!draggedModule || draggedModule === id) { finishModuleDrag(); return; }
      event.preventDefault();
      const order = [...prefs.moduleOrder], from = order.indexOf(draggedModule), to = order.indexOf(id);
      if (from >= 0 && to >= 0) { order.splice(from,1); order.splice(to,0,draggedModule); patch({ moduleOrder: order }); }
      finishModuleDrag();
    });
    const label = document.createElement('label'); label.className = 'module-name'; label.textContent = NotchModules.names[id]; label.htmlFor = 'module-visible-' + id;
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'switch'; checkbox.id = 'module-visible-' + id;
    checkbox.setAttribute('aria-label', 'Show ' + NotchModules.names[id] + ' in Explore');
    checkbox.addEventListener('change', () => patch({ hiddenModules: checkbox.checked ? prefs.hiddenModules.filter(item => item !== id) : [...prefs.hiddenModules, id] }));
    const open = document.createElement('button'); open.type = 'button'; open.className = 'module-open'; open.dataset.openModule = id; open.textContent = 'Open';
    const arrows = document.createElement('div'); arrows.className = 'module-order';
    for (const [direction, name, glyph] of [[-1,'up','↑'],[1,'down','↓']]) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = glyph; button.dataset.direction = direction;
      button.setAttribute('aria-label', 'Move ' + NotchModules.names[id] + ' ' + name);
      button.addEventListener('click', () => { const order = [...prefs.moduleOrder], at = order.indexOf(id), next = at + direction; if (next < 0 || next >= order.length) return; [order[at], order[next]] = [order[next], order[at]]; patch({ moduleOrder: order }); });
      arrows.append(button);
    }
    element.append(grip, label, open, arrows, checkbox); moduleRows.set(id, element); editor.append(element);
  }
  let current = { page: 'island', tab: 'layout' }, history = [], cursor = -1;
  function showPage(page, tab = 'layout', remember = true) {
    if (!pages[page]) return;
    if (page === 'island' && !['layout','content','activity','behavior'].includes(tab)) tab = 'layout';
    if (page !== 'island') tab = '';
    current = { page, tab };
    if (remember && JSON.stringify(history[cursor]) !== JSON.stringify(current)) { history = history.slice(0, cursor + 1); history.push(current); cursor++; }
    for (const [key, section] of panes) section.hidden = key !== page + ':' + tab;
    for (const button of nav.querySelectorAll('button')) button.setAttribute('aria-current', button.dataset.page === page ? 'page' : 'false');
    for (const button of tabs.children) { const active = button.dataset.settingsTab === tab; button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1; button.setAttribute('aria-controls', 'settings-pane-' + button.dataset.settingsTab); }
    tabs.hidden = page !== 'island';
    document.getElementById('settings-page-title').textContent = pages[page][0]; document.getElementById('settings-page-description').textContent = pages[page][1];
    document.getElementById('settings-back').disabled = cursor <= 0; document.getElementById('settings-forward').disabled = cursor >= history.length - 1;
    sheet.scrollTop = 0;
  }
  nav.addEventListener('click', event => { const button = event.target.closest('[data-page]'); if (button) showPage(button.dataset.page); });
  tabs.addEventListener('click', event => { const button = event.target.closest('[data-settings-tab]'); if (button) showPage('island', button.dataset.settingsTab); });
  tabs.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const list = [...tabs.children], at = list.indexOf(document.activeElement); if (at < 0) return;
    event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : (at + (event.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
    list[next].click(); list[next].focus();
  });
  function go(delta) { if (cursor + delta < 0 || cursor + delta >= history.length) return; cursor += delta; showPage(history[cursor].page, history[cursor].tab, false); }
  document.getElementById('settings-back').addEventListener('click', () => go(-1)); document.getElementById('settings-forward').addEventListener('click', () => go(1));
  document.addEventListener('click', event => { const button = event.target.closest('[data-open-module]'); if (button) window.panel.openModule(button.dataset.openModule); });
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase(); results.replaceChildren(); results.hidden = !query; nav.hidden = !!query; tools.hidden = !!query;
    if (!query) return;
    for (const element of sheet.querySelectorAll('.row,.slider-row,.module-setting,.color-control')) {
      if (!element.textContent.toLowerCase().includes(query)) continue;
      const location = element.closest('.settings-page'); if (!location) continue;
      const button = document.createElement('button'); button.type = 'button';
      const title = element.querySelector('.row-title,.slider-label label,.module-name')?.textContent || element.textContent.trim().split('\n')[0];
      button.textContent = title.trim().slice(0, 64);
      button.addEventListener('click', () => { search.value = ''; search.dispatchEvent(new Event('input')); showPage(location.dataset.settingsPage, location.dataset.settingsTab); element.scrollIntoView({ block: 'center' }); element.classList.add('settings-match'); setTimeout(() => element.classList.remove('settings-match'), 1400); element.querySelector('input,select,button')?.focus({ preventScroll: true }); });
      results.append(button);
    }
    if (!results.childElementCount) { const empty = document.createElement('p'); empty.textContent = 'No matching settings'; results.append(empty); }
  });
  search.addEventListener('keydown', event => { if (event.key === 'Escape' && search.value) { event.stopPropagation(); search.value = ''; search.dispatchEvent(new Event('input')); } });
  document.addEventListener('keydown', event => {
    if (event.ctrlKey && ['f','k'].includes(event.key.toLowerCase())) { event.preventDefault(); search.focus(); }
    if (event.altKey && ['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); go(event.key === 'ArrowLeft' ? -1 : 1); }
  });
  showPage('island');
  function paint(value) {
    const focused = editor.contains(document.activeElement) ? document.activeElement : null;
    prefs = NotchModules.normalize(value);
    for (const [index, id] of prefs.moduleOrder.entries()) {
      const element = moduleRows.get(id); if (editor.children[index] !== element) editor.append(element);
      const checkbox = element.querySelector('input'); checkbox.checked = !prefs.hiddenModules.includes(id); checkbox.disabled = checkbox.checked && prefs.hiddenModules.length === NotchModules.ids.length - 1;
      element.querySelector('[data-direction="-1"]').disabled = index === 0;
      element.querySelector('[data-direction="1"]').disabled = index === prefs.moduleOrder.length - 1;
    }
    if (focused?.isConnected && !focused.disabled) focused.focus({ preventScroll: true });
  }
  return { showPage, paint };
})();
