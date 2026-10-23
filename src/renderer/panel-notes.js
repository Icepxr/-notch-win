'use strict';
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Vorssaint
// NotchScratchpadView/ScratchpadSupport: copy feedback, find and text size.
window.NotesPanel = (() => {
  let root, bridge, editor, query, findBar, size, copyButton, findButton;
  let saveTimer, copiedTimer, fontRevision = 0, fontSize = 13, hits = [], hitIndex = -1;
  const icons = {
    search: 'M13 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0m-1 4 5 5',
    copy: 'M7 7h10v11H7zM4 13H2V2h11v2',
    check: 'm3 10 4 4 10-10',
  };
  const svg = name => '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="' + icons[name] + '"/></svg>';
  const status = text => { root.querySelector('#note-status').textContent = text; };
  function applyPreferences(value = {}) {
    fontSize = NotesTools.textSize(value.notesTextSize);
    if (!root) return;
    editor.style.fontSize = fontSize + 'px'; size.value = String(fontSize);
  }
  async function saveNow(text) {
    let ok = false;
    try { ok = await bridge.saveNote(text); } catch {}
    if (editor.value === text) status(ok ? 'Saved locally' : 'Cannot save. Try editing again.');
    return ok;
  }
  function paintCount() {
    root.querySelector('#note-count').textContent = editor.value.length.toLocaleString('en') + ' characters';
    copyButton.disabled = !editor.value.length;
  }
  function refreshFind(select = false) {
    hits = NotesTools.matches(editor.value, query.value);
    hitIndex = hits.length ? Math.min(Math.max(0, hitIndex), hits.length - 1) : -1;
    root.querySelector('#note-find-count').textContent = hits.length ? (hitIndex + 1) + ' / ' + hits.length : query.value ? 'No matches' : 'Find text';
    root.querySelectorAll('[data-note-find]').forEach(button => { button.disabled = !hits.length; });
    if (select && hitIndex >= 0) selectHit();
  }
  function selectHit() {
    const match = hits[hitIndex]; if (!match) return;
    editor.setSelectionRange(match[0], match[1]);
    // A hidden mirror measures wrapped lines in the editor's actual font. It
    // runs only for find actions, never on a timer or a notch animation frame.
    const mirror = document.createElement('div'), style = getComputedStyle(editor);
    Object.assign(mirror.style, { position: 'fixed', visibility: 'hidden', pointerEvents: 'none',
      width: editor.clientWidth + 'px', boxSizing: 'border-box', whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
      font: style.font, letterSpacing: style.letterSpacing, padding: style.padding });
    mirror.setAttribute('aria-hidden', 'true'); mirror.textContent = editor.value.slice(0, match[0]);
    const marker = document.createElement('span'); marker.textContent = '\u200b'; mirror.append(marker); document.body.append(mirror);
    editor.scrollTop = Math.max(0, marker.offsetTop - editor.clientHeight / 2); mirror.remove();
  }
  function moveFind(direction) {
    if (!hits.length) return;
    hitIndex = (hitIndex + direction + hits.length) % hits.length; refreshFind(true);
  }
  function showFind() {
    const selected = editor.value.slice(editor.selectionStart, editor.selectionEnd);
    if (selected && selected.length <= 200) query.value = selected;
    findBar.hidden = false; findButton.setAttribute('aria-expanded', 'true');
    refreshFind(); query.focus(); query.select();
  }
  function closeFind() {
    findBar.hidden = true; findButton.setAttribute('aria-expanded', 'false'); editor.focus({ preventScroll: true });
  }
  function mount(element, api) {
    root = element; bridge = api;
    root.innerHTML = `<div class="section-head notes-toolbar"><span class="section-label">Scratchpad</span><div class="note-actions">
      <button id="note-find" type="button" class="note-icon" title="Find in note · Ctrl+F" aria-label="Find in note" aria-expanded="false" aria-controls="note-find-bar">${svg('search')}</button>
      <button id="note-copy" type="button" class="note-icon" title="Copy all" aria-label="Copy all" disabled>${svg('copy')}</button>
      <select id="note-text-size" aria-label="Note text size" title="Text size">${Array.from({ length: 13 }, (_, i) => `<option value="${i + 10}">${i + 10} px</option>`).join('')}</select></div></div>
      <div class="note-find-bar" id="note-find-bar" role="search" aria-label="Find in note" hidden><input id="note-query" type="search" aria-label="Find text in note" placeholder="Find in note" maxlength="200"/><span id="note-find-count" role="status">Find text</span><button type="button" data-note-find="-1" aria-label="Previous match" title="Previous · Shift+Enter">‹</button><button type="button" data-note-find="1" aria-label="Next match" title="Next · Enter">›</button><button type="button" id="note-find-close" aria-label="Close find">×</button></div>
      <textarea id="scratchpad" class="scratchpad" maxlength="100000" placeholder="Start writing…" aria-label="Notes" spellcheck="true"></textarea>
      <div class="notes-status"><span class="section-meta" id="note-status" role="status">Saved only on this device</span><span class="section-meta" id="note-action-status" role="status"></span><span class="section-meta" id="note-count">0 characters</span></div>`;
    editor = root.querySelector('#scratchpad'); query = root.querySelector('#note-query'); findBar = root.querySelector('#note-find-bar');
    size = root.querySelector('#note-text-size'); copyButton = root.querySelector('#note-copy'); findButton = root.querySelector('#note-find');
    applyPreferences({ notesTextSize: fontSize });
    findButton.addEventListener('click', () => findBar.hidden ? showFind() : closeFind());
    root.querySelector('#note-find-close').addEventListener('click', closeFind);
    query.addEventListener('input', () => { hitIndex = 0; refreshFind(true); });
    root.querySelectorAll('[data-note-find]').forEach(button => button.addEventListener('click', () => moveFind(Number(button.dataset.noteFind))));
    root.addEventListener('keydown', event => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === 'f') { event.preventDefault(); event.stopPropagation(); showFind(); }
      else if (modifier && event.key.toLowerCase() === 's') { event.preventDefault(); clearTimeout(saveTimer); saveNow(editor.value); }
      else if (modifier && event.key.toLowerCase() === 'g') { event.preventDefault(); if (findBar.hidden) showFind(); else moveFind(event.shiftKey ? -1 : 1); }
      else if (event.key === 'Enter' && event.target === query) { event.preventDefault(); moveFind(event.shiftKey ? -1 : 1); }
      else if (event.key === 'Escape' && !findBar.hidden) { event.preventDefault(); event.stopPropagation(); closeFind(); }
    });
    editor.addEventListener('input', () => {
      const text = editor.value; bridge.cacheNote(text); paintCount(); status('Saving…');
      if (!findBar.hidden) refreshFind();
      clearTimeout(saveTimer); saveTimer = setTimeout(() => saveNow(text), 250);
    });
    copyButton.addEventListener('click', async () => {
      let ok = false; try { ok = Boolean(await bridge.copyNote(editor.value)); } catch {}
      copyButton.innerHTML = svg(ok ? 'check' : 'copy');
      copyButton.setAttribute('aria-label', ok ? 'Copied' : 'Copy all');
      root.querySelector('#note-action-status').textContent = ok ? 'Copied' : 'Cannot copy. Try again.';
      root.querySelector('#note-action-status').classList.toggle('is-error', !ok);
      clearTimeout(copiedTimer); copiedTimer = setTimeout(() => { copyButton.innerHTML = svg('copy'); copyButton.setAttribute('aria-label', 'Copy all'); root.querySelector('#note-action-status').textContent = ''; }, 1600);
    });
    size.addEventListener('change', async () => {
      const previous = fontSize, next = NotesTools.textSize(Number(size.value)), revision = ++fontRevision;
      applyPreferences({ notesTextSize: next });
      let result; try { result = await bridge.updatePreferences({ notesTextSize: next }); } catch {}
      if (revision !== fontRevision) return;
      if (!result?.ok) { applyPreferences({ notesTextSize: result?.preferences?.notesTextSize ?? previous }); status('Could not save text size. Try again.'); }
    });
    paintCount();
  }
  function update(text) { if (!root) return; editor.value = text || ''; paintCount(); if (!findBar.hidden) refreshFind(); }
  return { mount, update, applyPreferences };
})();
