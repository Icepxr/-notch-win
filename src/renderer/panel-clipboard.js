'use strict';

// ClipboardPanel panel. Loaded both with require() (so the pure helpers can be
// tested without a window) and as a plain <script> in the renderer, hence
// the wrapper - and it lives in this folder so the page can load it as a
// same-directory script under the CSP.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ClipboardPanel = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const KIND = {
    url: { glyph: '🔗', label: 'Link' },
    path: { glyph: '📁', label: 'Path' },
    email: { glyph: '✉️', label: 'Email' },
    json: { glyph: '{ }', label: 'JSON' },
    code: { glyph: '⌘', label: 'Code' },
    hash: { glyph: '#', label: 'Hash' },
    image: { glyph: '🖼', label: 'Image' },
    text: { glyph: '¶', label: 'Text' },
  };

  let api = null;
  let listEl = null;
  let countEl = null;
  let pauseBtn = null;
  let paused = false;
  let searchEl = null;
  let lastEntries = [];

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
    node.title = 'Click to copy';

    const kind = KIND[entry.kind] || KIND.text;

    const badge = document.createElement('span');
    badge.className = 'clip-kind';
    badge.textContent = kind.glyph;
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
    meta.textContent = relativeTime(entry.at) + (entry.chars ? ' · ' + entry.chars + ' characters' : '');

    const remove = document.createElement('button');
    remove.className = 'clip-remove';
    remove.type = 'button';
    remove.title = 'Remove item';
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
      node.addEventListener('click', () => api.pick(entry.id));
      node.tabIndex = 0;
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', 'Copy ' + entry.preview);
      node.addEventListener('keydown', (event) => {
        if (event.target !== node || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        api.pick(entry.id);
      });
    }

    const text = document.createElement('span');
    text.className = 'clip-text';
    text.append(body, meta);

    node.append(badge, text, remove);
    return node;
  }

  function mount(root, bridge) {
    api = bridge;
    root.replaceChildren();

    const head = document.createElement('div');
    head.className = 'section-head';

    countEl = document.createElement('span');
    countEl.className = 'section-label';
    countEl.textContent = 'Clipboard';

    const actions = document.createElement('span');
    actions.className = 'section-actions';

    pauseBtn = document.createElement('button');
    pauseBtn.className = 'ghost-btn';
    pauseBtn.type = 'button';
    pauseBtn.textContent = 'Pause';
    pauseBtn.addEventListener('click', () => api.setPaused(!paused));

    const clearBtn = document.createElement('button');
    clearBtn.className = 'ghost-btn';
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => api.clear());

    actions.append(pauseBtn, clearBtn);
    head.append(countEl, actions);

    listEl = document.createElement('div');
    listEl.className = 'clip-list card';

    searchEl = document.createElement('input');
    searchEl.type = 'search';
    searchEl.className = 'clip-search';
    searchEl.placeholder = 'Search your clipboard…';
    searchEl.setAttribute('aria-label', 'Search clipboard');
    searchEl.addEventListener('input', paint);
    searchEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !searchEl.value) return;
      event.stopPropagation();
      event.preventDefault();
      searchEl.value = '';
      paint();
    });
    root.append(head, searchEl, listEl);
  }

  function setPaused(value) {
    paused = Boolean(value);
    if (!pauseBtn) return;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    pauseBtn.classList.toggle('is-on', paused);
  }

  function update(entries) {
    lastEntries = entries || [];
    paint();
  }

  function paint() {
    if (!listEl) return;
    const query = (searchEl?.value || '').trim().toLocaleLowerCase();
    const list = query ? lastEntries.filter((entry) =>
      [entry.preview, KIND[entry.kind]?.label].join(' ').toLocaleLowerCase().includes(query)) : lastEntries;
    countEl.textContent = lastEntries.length ? 'Clipboard · ' + list.length + (query ? '/' + lastEntries.length : '') : 'Clipboard';

    listEl.replaceChildren();
    if (!list.length) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = query ? 'No matching items.' : paused
        ? 'History is paused. Select Resume to continue.'
        : 'Copy something. Find it here.';
      listEl.append(hint);
      return;
    }
    for (const entry of list) listEl.append(row(entry));
  }

  return { mount, update, setPaused, relativeTime };
}));
