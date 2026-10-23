'use strict';
// SPDX-License-Identifier: GPL-3.0-or-later
// Clipboard card/search interactions adapted from Vorssaint's NotchClipboardView.
// Copyright (C) 2026 Vorssaint

// ClipboardPanel panel. Loaded both with require() (so the pure helpers can be
// tested without a window) and as a plain <script> in the renderer, hence
// the wrapper - and it lives in this folder so the page can load it as a
// same-directory script under the CSP.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ClipboardPanel = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const KIND = {
    url: { glyph: '↗', label: 'Link' },
    path: { glyph: '⌑', label: 'Path' },
    email: { glyph: '@', label: 'Email' },
    json: { glyph: '{ }', label: 'JSON' },
    code: { glyph: '⌘', label: 'Code' },
    hash: { glyph: '#', label: 'Hash' },
    image: { glyph: '▧', label: 'Image' },
    text: { glyph: '¶', label: 'Text' },
  };

  let api = null;
  let listEl = null;
  let countEl = null;
  let pauseBtn = null;
  let paused = false;
  let searchEl = null;
  let lastEntries = [];
  let searchButton, panelRoot, copiedID, copiedUntil = 0, pinnedOnly = false;
  let pinFilter, clearButton, feedbackEl, peek, peekID, heldPreview = false, dwellTimer, closeTimer;
  let restoringFocus = false;
  const paths = {
    url: 'M8 12l4-4m-6 2-2 2a3 3 0 0 0 4 4l3-3m-2-6 3-3a3 3 0 0 1 4 4l-2 2',
    path: 'M2 6h6l2 2h8v9H2zM2 6V4h6l2 2',
    email: 'M2 4h16v12H2zM2 4l8 7 8-7',
    image: 'M2 3h16v14H2zM2 14l5-5 4 4 3-3 4 4M12 7h1',
    text: 'M4 4h12M10 4v12M7 16h6',
    code: 'M6 5l-4 5 4 5m8-10 4 5-4 5m-3-13-2 16',
  };

  function glyph(path) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 20 20'); svg.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path'); shape.setAttribute('d', path); svg.append(shape); return svg;
  }
  function findRow(id) { return [...listEl.children].find(row => row.dataset.id === id); }
  function closePreview(restoreFocus = false) {
    clearTimeout(dwellTimer); clearTimeout(closeTimer);
    const id = peekID; peekID = null; heldPreview = false;
    if (peek) peek.hidden = true;
    panelRoot?.querySelectorAll('.clip-preview-button').forEach(button => button.setAttribute('aria-expanded', 'false'));
    if (restoreFocus) { restoringFocus = true; findRow(id)?.focus({ preventScroll: true }); restoringFocus = false; }
  }
  function placePreview(node) {
    const rootBox = panelRoot.getBoundingClientRect(), listBox = listEl.getBoundingClientRect(), rowBox = node.getBoundingClientRect();
    const height = Math.min(156, listBox.height);
    peek.style.maxHeight = height + 'px';
    peek.style.top = Math.max(listBox.top - rootBox.top, Math.min(rowBox.top - rootBox.top, listBox.bottom - rootBox.top - height)) + 'px';
  }
  function showPreview(entry, node, hold = false) {
    if (!panelRoot.classList.contains('is-active') || !node.isConnected) return;
    clearTimeout(dwellTimer); clearTimeout(closeTimer);
    peekID = entry.id; heldPreview = hold;
    peek.replaceChildren();
    const head = document.createElement('div'); head.className = 'clip-peek-head';
    const label = document.createElement('span'); label.textContent = (KIND[entry.kind] || KIND.text).label + ' preview';
    const close = document.createElement('button'); close.type = 'button'; close.className = 'clip-peek-close';
    close.textContent = '×'; close.setAttribute('aria-label', 'Close clipboard preview'); close.addEventListener('click', () => closePreview(true));
    head.append(label, close);
    const content = document.createElement('div'); content.className = 'clip-peek-content';
    if (entry.kind === 'image' && entry.dataUrl) {
      const image = document.createElement('img'); image.src = entry.dataUrl; image.alt = 'Clipboard image thumbnail'; content.append(image);
    } else content.textContent = entry.preview;
    const footer = document.createElement('div'); footer.className = 'clip-peek-footer';
    const detail = document.createElement('span'); detail.textContent = entry.kind === 'image' ? 'Thumbnail only' : entryMeta(entry);
    footer.append(detail);
    if (entry.kind !== 'image') {
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'ghost-btn'; copy.textContent = 'Copy';
      copy.addEventListener('click', () => { closePreview(true); copyEntry(entry, findRow(entry.id)); }); footer.append(copy);
    }
    peek.append(head, content, footer); peek.hidden = false; placePreview(node);
    panelRoot.querySelectorAll('.clip-preview-button').forEach(button => button.setAttribute('aria-expanded', String(button.closest('.clip-row') === node)));
    if (hold) close.focus({ preventScroll: true });
  }
  function dwell(entry, node, delay = 700) {
    clearTimeout(dwellTimer); clearTimeout(closeTimer);
    if (heldPreview || peekID === entry.id) return;
    dwellTimer = setTimeout(() => showPreview(entry, node), delay);
  }
  function leavePreview() {
    clearTimeout(dwellTimer);
    if (!heldPreview) closeTimer = setTimeout(() => closePreview(), 150);
  }
  async function togglePin(entry) {
    const result = await api.pin(entry.id).catch(() => ({ ok: false, reason: 'save' }));
    feedbackEl.textContent = result?.ok ? '' : result?.reason === 'limit' ? 'Up to 20 items can be pinned.' : 'Could not save this pin. Try again.';
    feedbackEl.hidden = !feedbackEl.textContent;
  }

  function focusSearch() {
    if (!searchEl) return;
    searchEl.hidden = false;
    searchButton.setAttribute('aria-expanded', 'true');
    searchEl.focus();
  }

  async function copyEntry(entry, node) {
    let ok = false;
    try { ok = Boolean(await api.pick(entry.id)); } catch {}
    // A new clipboard poll may replace the row while the IPC is in flight.
    node = node?.isConnected ? node : [...listEl.children].find((row) => row.dataset.id === entry.id);
    if (!node) return;
    node.classList.toggle('is-copied', Boolean(ok));
    node.querySelector('.clip-meta').textContent = ok ? 'Copied · Ready to paste' : 'Could not copy. Try again.';
    if (!ok) return;
    copiedID = entry.id;
    copiedUntil = Date.now() + 1600;
    setTimeout(() => {
      if (copiedID !== entry.id || Date.now() < copiedUntil) return;
      copiedID = null;
      const current = [...listEl.children].find((row) => row.dataset.id === entry.id);
      current?.classList.remove('is-copied');
      if (current) current.querySelector('.clip-meta').textContent = entryMeta(entry);
    }, 1650);
  }

  function entryMeta(entry) {
    return relativeTime(entry.at) + (entry.chars ? ' · ' + entry.chars + ' characters' : '');
  }

  /** "Just now", "5m ago", "2h ago" */
  function relativeTime(at, now = Date.now()) {
    const secs = Math.max(0, Math.round((now - at) / 1000));
    if (secs < 45) return 'Just now';
    const mins = Math.round(secs / 60);
    if (mins < 60) return mins + 'm ago';
    const hours = Math.round(mins / 60);
    if (hours < 24) return hours + 'h ago';
    return Math.round(hours / 24) + 'd ago';
  }

  function row(entry) {
    const node = document.createElement('div');
    node.className = 'clip-row';
    node.classList.toggle('is-pinned', entry.pinned === true);
    node.dataset.id = entry.id;
    node.classList.toggle('is-copied', copiedID === entry.id && Date.now() < copiedUntil);
    node.title = 'Click to copy';

    const kind = KIND[entry.kind] || KIND.text;

    const badge = document.createElement('span');
    badge.className = 'clip-kind';
    if (paths[entry.kind]) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 20 20');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', paths[entry.kind]); svg.append(path); badge.append(svg);
    } else badge.textContent = kind.glyph;
    badge.setAttribute('aria-label', kind.label);

    const body = document.createElement('span');
    body.className = 'clip-body';

    if (entry.kind === 'image' && entry.dataUrl) {
      const img = document.createElement('img');
      img.className = 'clip-thumb';
      img.src = entry.dataUrl;
      img.alt = '';
      body.append(img);
    }

    const preview = document.createElement('span');
    preview.className = 'clip-preview';
    preview.textContent = entry.preview;
    body.append(preview);

    const meta = document.createElement('span');
    meta.className = 'clip-meta';
    meta.textContent = node.classList.contains('is-copied') ? 'Copied · Ready to paste' : entryMeta(entry);
    meta.setAttribute('role', 'status');

    const remove = document.createElement('button');
    remove.className = 'clip-remove';
    remove.type = 'button';
    remove.title = 'Remove item';
    remove.dataset.clipAction = 'remove';
    remove.setAttribute('aria-label', 'Remove ' + entry.preview);
    remove.textContent = '×';
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      api.remove(entry.id);
    });

    // An image entry can only be looked at; the history keeps a thumbnail, and
    // writing that back would hand the user a shrunken copy of their picture.
    if (entry.kind === 'image') {
      node.classList.add('is-readonly');
      node.title = 'Image preview only. Cannot copy back.';
    } else {
      node.addEventListener('click', () => copyEntry(entry, node));
      node.tabIndex = 0;
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', 'Copy ' + entry.preview);
      node.addEventListener('keydown', (event) => {
        if (event.target !== node || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        copyEntry(entry, node);
      });
    }

    const text = document.createElement('span');
    text.className = 'clip-text';
    text.append(body, meta);

    const actions = document.createElement('span'); actions.className = 'clip-row-actions';
    const previewButton = document.createElement('button'); previewButton.type = 'button'; previewButton.className = 'clip-preview-button';
    previewButton.dataset.clipAction = 'preview'; previewButton.title = 'Preview · F2'; previewButton.setAttribute('aria-label', 'Preview ' + entry.preview);
    previewButton.setAttribute('aria-expanded', String(peekID === entry.id)); previewButton.setAttribute('aria-controls', 'clip-peek');
    previewButton.append(glyph('M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5zM12 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0'));
    previewButton.addEventListener('click', event => { event.stopPropagation(); showPreview(entry, node, true); });
    const pin = document.createElement('button'); pin.type = 'button'; pin.className = 'clip-pin'; pin.dataset.clipAction = 'pin';
    pin.title = entry.canPin === false ? 'Only saved text can be pinned' : entry.pinned ? 'Unpin item' : 'Pin item';
    pin.setAttribute('aria-label', entry.pinned ? 'Unpin item' : 'Pin item'); pin.setAttribute('aria-pressed', String(Boolean(entry.pinned)));
    pin.disabled = entry.canPin === false || entry.kind === 'image';
    pin.append(glyph('M7 2h6l-1 5 4 4v2H4v-2l4-4zM10 13v5'));
    pin.addEventListener('click', async event => { event.stopPropagation(); pin.disabled = true; await togglePin(entry); if (pin.isConnected) pin.disabled = false; });
    actions.append(previewButton, pin, remove);
    node.append(badge, text, actions);
    node.addEventListener('pointerenter', () => dwell(entry, node));
    node.addEventListener('pointerleave', leavePreview);
    node.addEventListener('focusin', event => { if (!restoringFocus && event.target === node) dwell(entry, node, 1400); });
    node.addEventListener('focusout', event => { if (!peek.contains(event.relatedTarget)) leavePreview(); });
    return node;
  }

  function mount(root, bridge) {
    api = bridge;
    panelRoot = root;
    root.replaceChildren();

    const head = document.createElement('div');
    head.className = 'section-head';

    countEl = document.createElement('span');
    countEl.className = 'section-label';
    countEl.textContent = 'Clipboard';

    const actions = document.createElement('span');
    actions.className = 'section-actions';

    pauseBtn = document.createElement('button');
    pauseBtn.id = 'clip-capture';
    pauseBtn.className = 'ghost-btn';
    pauseBtn.type = 'button';
    pauseBtn.textContent = 'Pause';
    pauseBtn.addEventListener('click', () => api.setPaused(!paused));

    const clearBtn = document.createElement('button'); clearButton = clearBtn;
    clearBtn.className = 'ghost-btn';
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear recent'; clearBtn.title = 'Clear recent items and keep pinned items';
    clearBtn.addEventListener('click', () => api.clear());

    searchButton = document.createElement('button');
    searchButton.className = 'ghost-btn clip-search-toggle';
    searchButton.type = 'button'; searchButton.textContent = 'Search';
    searchButton.title = 'Search clipboard · Ctrl+F';
    searchButton.setAttribute('aria-expanded', 'false');
    searchButton.addEventListener('click', () => {
      if (searchEl.hidden) focusSearch();
      else { searchEl.value = ''; searchEl.hidden = true; searchButton.setAttribute('aria-expanded', 'false'); paint(); searchButton.focus(); }
    });
    pinFilter = document.createElement('button'); pinFilter.type = 'button'; pinFilter.className = 'ghost-btn clip-pinned-filter'; pinFilter.textContent = 'Pinned';
    pinFilter.setAttribute('aria-pressed', 'false');
    pinFilter.addEventListener('click', () => { pinnedOnly = !pinnedOnly; pinFilter.setAttribute('aria-pressed', String(pinnedOnly)); closePreview(); paint(); });
    actions.append(searchButton, pinFilter, pauseBtn, clearBtn);
    head.append(countEl, actions);

    listEl = document.createElement('div');
    listEl.className = 'clip-list card';

    searchEl = document.createElement('input');
    searchEl.type = 'search';
    searchEl.className = 'clip-search';
    searchEl.hidden = true;
    searchEl.placeholder = 'Search your clipboard…';
    searchEl.setAttribute('aria-label', 'Search clipboard');
    searchEl.addEventListener('input', paint);
    searchEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      event.preventDefault();
      if (searchEl.value) searchEl.value = '';
      else { searchEl.hidden = true; searchButton.setAttribute('aria-expanded', 'false'); searchButton.focus(); }
      paint();
    });
    peek = document.createElement('aside'); peek.className = 'clip-peek'; peek.id = 'clip-peek'; peek.hidden = true;
    peek.setAttribute('aria-label', 'Clipboard preview'); peek.setAttribute('role', 'region');
    peek.addEventListener('pointerenter', () => clearTimeout(closeTimer)); peek.addEventListener('pointerleave', leavePreview);
    listEl.addEventListener('scroll', () => closePreview(), { passive: true });
    new ResizeObserver(() => { if (peekID) { const node = findRow(peekID); if (node) placePreview(node); else closePreview(); } }).observe(listEl);
    feedbackEl = document.createElement('p'); feedbackEl.className = 'clip-feedback'; feedbackEl.hidden = true; feedbackEl.setAttribute('role', 'status');
    root.append(head, searchEl, listEl, feedbackEl, peek);
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !peek.hidden) { event.preventDefault(); event.stopPropagation(); closePreview(true); return; }
      if (event.key === 'F2') {
        const node = event.target.closest('.clip-row'), entry = lastEntries.find(item => item.id === node?.dataset.id);
        if (entry) { event.preventDefault(); showPreview(entry, node, true); } return;
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && !(event.target === searchEl && ['Home', 'End'].includes(event.key)) && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const rows = [...listEl.querySelectorAll('.clip-row:not(.is-readonly)')];
        if (!rows.length) return;
        event.preventDefault(); event.stopPropagation();
        const index = rows.indexOf(document.activeElement?.closest('.clip-row'));
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1
          : index < 0 ? (event.key === 'ArrowDown' ? 0 : rows.length - 1)
            : Math.min(rows.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)));
        rows[next].focus(); rows[next].scrollIntoView({ block: 'nearest' });
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('input,button') && event.key !== ' ') {
        event.preventDefault(); focusSearch(); searchEl.value += event.key; paint();
      }
    });
  }

  function setPaused(value) {
    paused = Boolean(value);
    if (!pauseBtn) return;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    pauseBtn.classList.toggle('is-on', paused);
    pauseBtn.setAttribute('aria-pressed', String(paused));
    paint();
  }

  function update(entries) {
    lastEntries = entries || [];
    paint();
  }

  function paint() {
    if (!listEl) return;
    const query = (searchEl?.value || '').trim().toLocaleLowerCase();
    if (query) { searchEl.hidden = false; searchButton.setAttribute('aria-expanded', 'true'); }
    const list = lastEntries.filter(entry => (!pinnedOnly || entry.pinned) && (!query || [entry.preview, KIND[entry.kind]?.label].join(' ').toLocaleLowerCase().includes(query)));
    clearButton.disabled = !lastEntries.some(entry => !entry.pinned);
    countEl.textContent = lastEntries.length ? 'Clipboard · ' + list.length + (query ? '/' + lastEntries.length : '') : 'Clipboard';

    const active = panelRoot.contains(document.activeElement) ? document.activeElement : null;
    const focused = active?.closest('.clip-row')?.dataset.id, action = active?.dataset.clipAction;
    listEl.replaceChildren();
    if (!list.length) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = query ? 'No matching items.' : pinnedOnly ? 'Pin something you want to keep.' : paused
        ? 'History is paused. Select Resume to continue.'
        : 'Copy something. Find it here.';
      listEl.append(hint);
      closePreview();
      return;
    }
    for (const entry of list) listEl.append(row(entry));
    if (focused) { const node = findRow(focused); (action ? node?.querySelector('[data-clip-action="' + action + '"]') : node)?.focus({ preventScroll: true }); }
    if (peekID) { const node = findRow(peekID); if (node) placePreview(node); else closePreview(); }
  }

  return { mount, update, setPaused, relativeTime, focusSearch, closePreview };
}));

// Local, CSP-safe content bootstrap. The shell's script list is owned by the
// transition session; no inline script or cross-lane HTML change is needed.
if (typeof document !== 'undefined' && document.currentScript) {
  const expandedPagesScript = document.createElement('script');
  expandedPagesScript.src = new URL('expanded-pages.js', document.currentScript.src).href;
  document.head.append(expandedPagesScript);
}
