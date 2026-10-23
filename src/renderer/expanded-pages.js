'use strict';
// Owns page content only. It publishes requests; the renderer owns morphs,
// geometry and the native window. See docs/expanded-pages.md for the contract.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./notch-appearance'));
  else { root.ExpandedPages = factory(root.NotchAppearance); root.ExpandedPages.install(); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Appearance) {
  const spec = Object.freeze({ inset: 28, top: 16, bottom: 16, gap: 10, header: 28, group: 16, headingGap: 13, icon: 26, iconGap: 12, min: 180, max: 510 });
  const titles = { send: 'Send files', media: 'Music', clipboard: 'Clipboard', system: 'System', ai: 'AI Agents', timer: 'Timer', notes: 'Notes' };
  const selectors = { send: '#choose-files', clipboard: '#clip-capture', system: '#system-overview-action', ai: '#ai-refresh', timer: '#timer-action', notes: '#note-copy' };
  const requests = new Map(); let scheduled = false, started = false;
  function timeColor(value) {
    if (!/^#[0-9a-f]{6}$/i.test(value)) return '#ffffff';
    let rgb = value.slice(1).match(/../g).map(part => parseInt(part, 16)), color = value;
    while (Appearance.contrast(color, '#000000') < 4.5) {
      rgb = rgb.map(channel => Math.min(255, channel + Math.max(1, Math.ceil((255 - channel) * .04))));
      color = '#' + rgb.map(channel => channel.toString(16).padStart(2, '0')).join('');
    }
    return color;
  }
  function requestFor(id) { return requests.get(id) || null; }
  function fitScrollers(panel, body) {
    const budget = Math.max(0, panel.clientHeight - spec.header - spec.gap);
    for (const scroll of body.querySelectorAll('.clip-list,.ai-scroll,.scratchpad')) {
      const other = body.scrollHeight - scroll.offsetHeight;
      const floor = scroll.classList.contains('scratchpad') ? 128 : scroll.classList.contains('clip-list') ? 88 : 96;
      const available = Math.max(floor, budget - other);
      const max = available + 'px';
      if (scroll.style.maxHeight !== max) scroll.style.maxHeight = max;
      if (scroll.classList.contains('scratchpad')) {
        const key = [scroll.value, scroll.clientWidth, getComputedStyle(scroll).fontSize, available].join('|');
        if (scroll._expandedMeasure !== key) {
          scroll._expandedMeasure = key; scroll.style.height = '0px';
          scroll.style.height = Math.min(available, Math.max(floor, scroll.scrollHeight)) + 'px';
        }
      }
    }
  }
  function measure(panel) {
    const body = panel.querySelector('.expanded-page-content');
    if (!body || !panel.classList.contains('is-active')) return requestFor(panel.dataset.panel);
    fitScrollers(panel, body);
    let content = body.scrollHeight;
    for (const scroll of body.querySelectorAll('.clip-list,.ai-scroll,.scratchpad')) content += Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    const needed = Math.ceil(spec.top + spec.header + spec.gap + content + spec.bottom);
    const max = Math.max(1, Math.min(spec.max, innerHeight - 32)), min = Math.min(spec.min, max);
    const requested = panel.querySelector('.ai-customize[open]') ? max : Math.min(max, Math.max(min, needed));
    const next = Object.freeze({ id: panel.dataset.panel, content, needed, requested, min, max, overflow: needed > max });
    const old = requests.get(next.id); requests.set(next.id, next);
    panel.dataset.preferredHeight = String(requested);
    panel.style.setProperty('--expanded-requested-height', requested + 'px');
    if (!old || old.requested !== requested) {
      panel.dispatchEvent(new CustomEvent('islet:page-height', { bubbles: true, detail: { ...next } }));
      // Existing AI/Timer consumers already ask their modules for height.
      panel.dispatchEvent(new CustomEvent('notch:layout', { bubbles: true, detail: { ...next } }));
    }
    return next;
  }
  function syncMusic() {
    const panel = document.querySelector('[data-panel="media"]'), target = panel?.querySelector('.expanded-music-detail');
    if (!target) return;
    const accent = timeColor(getComputedStyle(panel.querySelector('.np')).getPropertyValue('--music-accent').trim());
    if (panel.style.getPropertyValue('--expanded-time-accent') !== accent) panel.style.setProperty('--expanded-time-accent', accent);
    const duration = panel.querySelector('.expanded-duration'), sourceDuration = document.getElementById('peek-remaining');
    if (duration && sourceDuration && duration.textContent !== sourceDuration.textContent) duration.textContent = sourceDuration.textContent;
    for (const name of ['album-info', 'album', 'playback-note', 'lyrics', 'lyric-before', 'lyric', 'lyric-after', 'lyrics-status']) {
      const source = document.getElementById('peek-' + name), copy = target.querySelector('[data-music-copy="' + name + '"]');
      if (!source || !copy) continue;
      if (!['album-info', 'lyrics'].includes(name) && copy.textContent !== source.textContent) copy.textContent = source.textContent;
      if (copy.hidden !== source.hidden) copy.hidden = source.hidden;
    }
    const sourceLabel = document.querySelector('.peek-detail-label'), label = target.querySelector('.expanded-detail-label');
    if (sourceLabel && label.textContent !== sourceLabel.textContent) label.textContent = sourceLabel.textContent;
    const sourceArt = document.querySelector('#peek-detail-art img'), art = target.querySelector('.expanded-lyrics-art img');
    const uri = sourceArt?.getAttribute('src');
    if (uri && art.getAttribute('src') !== uri) art.src = uri;
    else if (!uri && art.hasAttribute('src')) art.removeAttribute('src');
    const sourceToggle = document.getElementById('peek-lyrics-toggle'), toggle = panel.querySelector('.expanded-lyrics-toggle');
    if (sourceToggle && toggle) {
      toggle.disabled = sourceToggle.disabled || !document.body.classList.contains('has-media');
      const enabled = sourceToggle.getAttribute('aria-pressed') === 'true';
      toggle.setAttribute('aria-pressed', String(enabled));
      const text = enabled ? 'Hide lyrics' : 'Show lyrics'; if (toggle.textContent !== text) toggle.textContent = text;
      toggle.title = sourceToggle.title;
    }
  }
  function layout() {
    scheduled = false;
    if (!document.body.classList.contains('state-open') || document.body.classList.contains('is-exploring')) return;
    syncMusic();
    const active = document.querySelector('.expanded-page.is-active'); if (active) measure(active);
  }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(layout); } }
  function decorate(panel) {
    const id = panel.dataset.panel; if (!titles[id] || panel.classList.contains('expanded-page')) return;
    const body = document.createElement('div'); body.className = 'expanded-page-content';
    body.append(...panel.childNodes);
    const header = document.createElement('header'); header.className = 'expanded-page-header';
    const title = document.createElement('h2'); title.textContent = titles[id];
    const actions = document.createElement('div'); actions.className = 'expanded-page-actions';
    const primary = body.querySelector(selectors[id] || '.no-primary');
    if (primary) { primary.classList.add('expanded-primary'); actions.append(primary); }
    if (id === 'timer') { const reset = body.querySelector('#timer-reset'); if (reset) actions.prepend(reset); }
    if (id === 'media') {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'expanded-primary expanded-lyrics-toggle';
      button.textContent = 'Show lyrics'; button.addEventListener('click', event => {
        const source = document.getElementById('peek-lyrics-toggle');
        if (source) source.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: event.shiftKey }));
      }); actions.append(button);
    }
    header.append(title, actions); panel.append(header, body); panel.classList.add('expanded-page');
    new ResizeObserver(schedule).observe(body);
  }
  function install() {
    if (typeof document === 'undefined' || started) return;
    if (!document.getElementById('scratchpad') || !document.getElementById('timer-action')) { setTimeout(install, 30); return; }
    started = true;
    document.querySelectorAll('section[data-panel]').forEach(decorate);
    document.body.classList.add('expanded-pages-ready');
    for (const name of ['input', 'change', 'notch:layout']) document.getElementById('panels').addEventListener(name, schedule);
    new MutationObserver(schedule).observe(document.getElementById('panels'), { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'class', 'open'] });
    new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class', 'data-tab'] });
    const preview = document.querySelector('.layer-peek');
    if (preview) new MutationObserver(schedule).observe(preview, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'src', 'aria-pressed', 'style'] });
    addEventListener('resize', schedule); schedule();
  }
  return { spec, install, measure, requestFor, timeColor };
}));
