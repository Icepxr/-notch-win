'use strict';

const SIZES = NotchGeometry.sizes;

// Small, consistent line icons; no platform-dependent emoji rendering.
const GLYPH = {
  mobile: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M10 18.5h4"/>',
  tablet: '<rect x="3" y="2" width="18" height="20" rx="2.5"/><path d="M10 18.5h4"/>',
  desktop: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  web: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>',
  headless: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="m6 9 3 3-3 3m6 0h5"/>',
};
function icon(paths, viewBox = '0 0 24 24') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = paths; // Only static paths defined in this file are passed here.
  return svg;
}

const card = document.getElementById('card');
const els = {
  clock: document.getElementById('peek-clock'),
  peekShelf: document.getElementById('peek-shelf'),
  shelfCount: document.getElementById('shelf-count'),
  shelf: document.getElementById('shelf'),
  devices: document.getElementById('devices'),
  deviceHint: document.getElementById('device-hint'),
  clear: document.getElementById('clear'),
  collapse: document.getElementById('collapse'),
  status: document.getElementById('status'),
  barFill: document.getElementById('bar-fill'),
  statusText: document.getElementById('status-text'),
  pinForm: document.getElementById('pin-form'),
  pinInput: document.getElementById('pin-input'),
  peekArt: document.getElementById('peek-art'),
  peekTitle: document.getElementById('peek-title'),
  npArt: document.getElementById('np-art'),
  npTitle: document.getElementById('np-title'),
  npSub: document.getElementById('np-sub'),
  npPrev: document.getElementById('np-prev'),
  npToggle: document.getElementById('np-toggle'),
  npNext: document.getElementById('np-next'),
  npFill: document.getElementById('np-fill'),
  npTime: document.getElementById('np-time'),
  npProgress: document.querySelector('.np-progress'),
  tabs: document.getElementById('tabs'),
  quit: document.getElementById('quit'),
  peekAi: document.getElementById('peek-ai'),
  peekAiCount: document.getElementById('peek-ai-count'),
  closedTrigger: document.getElementById('closed-trigger'),
  closedCount: document.getElementById('closed-count'),
  panelTitle: document.getElementById('panel-title'),
  footerHint: document.getElementById('footer-hint'),
  keepOpen: document.getElementById('keep-open'),
  closedArt: document.getElementById('closed-art'),
  peekToggle: document.getElementById('peek-toggle'),
  npSeek: document.getElementById('np-seek'),
  npRemaining: document.getElementById('np-remaining'),
  mediaFeedback: document.getElementById('media-feedback'),
  explore: document.getElementById('explore'),
  exploreSearch: document.getElementById('explore-search'),
  closedTimer: document.getElementById('closed-timer'),
  npSource: document.getElementById('np-source'),
};

let state = 'closed';
let pinned = false;        // explicit Keep open; ordinary clicks can dismiss
let openedByClick = false;
let dragDepth = 0;
let transferActive = false;
let collapseTimer = null;
let statusTimer = null;
let pendingPinFor = null;
let shelfItems = [];
let deviceList = [];
let media = MediaState.EMPTY;   // what the media bridge last told us
let mediaVisible = false;       // whether the card is making room for it
let aiSessions = [];
let lastClipboard = [];
let geometryRevision = 0;
let pointerInside = false;
let hoverTimer = null;
let pinnedBeforeDrag = false;
let mediaPreviewTimer = null;
let feedbackTimer = null;
let seeking = false;
let seekPending = null;
let outsideDuringTransfer = false;
let hoverSuppressed = false;
const wheelGesture = new NotchMotion.Gesture();
let currentMorph = null;
let preferences = { autoDismiss: true, musicPreview: true, gestures: true, silhouette: 'notch' };
let timerState = { hasSession: false };
let exploring = false;

for (const [name, size] of Object.entries(SIZES)) {
  document.documentElement.style.setProperty('--' + name + '-width', size.width + 'px');
  document.documentElement.style.setProperty('--' + name + '-height', size.height + 'px');
}

// --- geometry ---------------------------------------------------------------

/** The card size for a state, which depends on whether music is showing. */
function geometryFor(name) {
  if (name === 'peek') return mediaVisible && !timerState.hasSession ? SIZES.peekMedia : SIZES.peek;
  if (name === 'open') return activeTab === 'ai' ? SIZES.openAi : SIZES.open;
  return SIZES.closed;
}

function applyVisualState() {
  notch.setInteraction(state);
  document.body.classList.remove('state-closed', 'state-peek', 'state-open');
  document.body.classList.add('state-' + state);
  document.body.classList.toggle('has-media', mediaVisible);
  for (const name of ['closed', 'peek', 'open']) {
    document.querySelector('.layer-' + name).inert = name !== state;
  }
}

let morphTarget = '';
async function updateGeometry() {
  const target = geometryFor(state);
  const key = [state, target.width, target.height, preferences.silhouette].join(':');
  if (key === morphTarget) { applyVisualState(); return; }
  morphTarget = key;
  const revision = ++geometryRevision;
  const drawn = card.getBoundingClientRect();
  document.body.classList.toggle('is-shrinking', target.width < drawn.width || target.height < drawn.height);
  const motion = NotchMotion.plan({ width: drawn.width, height: drawn.height }, target);
  currentMorph?.cancel();
  card.style.width = drawn.width + 'px';
  card.style.height = drawn.height + 'px';
  applyVisualState();
  card.style.width = target.width + 'px';
  card.style.height = target.height + 'px';
  const radius = preferences.silhouette === 'capsule' ? Math.min(28, target.height / 2) : Math.min(28, target.height * .34);
  card.style.borderBottomLeftRadius = card.style.borderBottomRightRadius = radius + 'px';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const morph = card.animate(motion.sizes.map((size) => ({
    width: size.width + 'px', height: size.height + 'px',
    borderRadius: preferences.silhouette === 'capsule' ? Math.min(28, size.height / 2) + 'px'
      : '0 0 ' + Math.min(28, size.height * .34) + 'px ' + Math.min(28, size.height * .34) + 'px',
  })), { duration: reduced ? 1 : motion.duration, easing: 'linear', fill: 'both' });
  currentMorph = morph;
  await morph.finished.catch(() => {});
  if (revision !== geometryRevision) return;
  morph.cancel();
  currentMorph = null;
  document.body.classList.remove('is-shrinking');
}

function setState(next) {
  if (next === state) return;
  state = next;
  updateGeometry();
  if (next !== 'open') hidePin();
}

function openNotch(tab) {
  clearTimeout(mediaPreviewTimer);
  clearTimeout(collapseTimer);
  clearTimeout(hoverTimer);
  openedByClick = true;
  if (tab) setTab(tab);
  setState('open');
  notch.focus();
}

function applyPreferences(value) {
  preferences = { ...preferences, ...value };
  document.body.dataset.silhouette = preferences.silhouette;
  document.body.dataset.glass = preferences.glass || 'high';
  updateGeometry();
}

notch.onDisplays((value) => {
  if (value.preferences) applyPreferences(value.preferences);
});

// Settings live in their own window now, so the notch has to be told when the
// user changes something over there.
notch.onPreferences((result) => {
  if (result?.preferences) applyPreferences(result.preferences);
});

function setExploring(value) {
  exploring = value;
  document.body.classList.toggle('is-exploring', value);
  els.explore.setAttribute('aria-expanded', String(value));
  els.explore.title = value ? 'Back to your module' : 'Explore modules';
  els.exploreSearch.inert = !value;
  els.tabs.inert = !value;
  document.getElementById('panels').inert = value;
  if (value) {
    els.panelTitle.textContent = 'Explore';
    els.footerHint.textContent = 'A little space for everything.';
    els.exploreSearch.value = '';
    for (const tab of els.tabs.querySelectorAll('.tab')) tab.hidden = false;
    els.exploreSearch.focus();
  } else if (els.tabs.contains(document.activeElement) || document.activeElement === els.exploreSearch) {
    els.explore.focus();
  }
}

els.explore.addEventListener('click', () => {
  if (exploring) setTab(activeTab);
  else setExploring(true);
});
els.exploreSearch.addEventListener('input', () => {
  const query = els.exploreSearch.value.toLocaleLowerCase().trim();
  for (const tab of els.tabs.querySelectorAll('.tab')) tab.hidden = ![tab.textContent, tab.getAttribute('aria-label')].join(' ').toLocaleLowerCase().includes(query);
});

function collapseNotch() {
  clearTimeout(mediaPreviewTimer);
  clearTimeout(collapseTimer);
  clearTimeout(hoverTimer);
  openedByClick = false;
  hoverSuppressed = pointerInside;
  setState('closed');
  notch.releaseFocus();
}

function setPinned(value) {
  pinned = value;
  els.keepOpen.setAttribute('aria-pressed', String(pinned));
  els.keepOpen.title = pinned ? 'Unpin notch' : 'Keep open';
  els.keepOpen.setAttribute('aria-label', els.keepOpen.title);
}

function dismissOutside() {
  if (state === 'closed') return;
  if (!preferences.autoDismiss || pinned || dragDepth > 0) return;
  if (transferActive) { outsideDuringTransfer = true; return; }
  collapseNotch();
}

function flashFooter(message) {
  clearTimeout(feedbackTimer);
  const tab = activeTab;
  const original = els.footerHint.textContent;
  els.footerHint.textContent = message;
  els.footerHint.classList.add('is-confirmed');
  feedbackTimer = setTimeout(() => {
    els.footerHint.classList.remove('is-confirmed');
    if (activeTab === tab) els.footerHint.textContent = original;
  }, 1800);
}

/** Music arriving or leaving resizes whichever card is currently showing. */
function setMediaVisible(visible) {
  if (visible === mediaVisible) return;
  mediaVisible = visible;
  if (state !== 'peek') {
    document.body.classList.toggle('has-media', visible);
    return;
  }
  updateGeometry();
}

// Transparent shadow pixels must allow clicks through to the application below.
// ResizeObserver follows the *painted* bounds throughout every animation.
function updateHitRegion() {
  const bounds = card.getBoundingClientRect();
  notch.setHitRegion({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    radius: parseFloat(getComputedStyle(card).borderBottomLeftRadius) || 0,
    topRadius: parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0 });
}
new ResizeObserver(updateHitRegion).observe(card);
window.addEventListener('resize', updateHitRegion);

function scheduleCollapse(delay = 420) {
  clearTimeout(collapseTimer);
  collapseTimer = setTimeout(() => {
    if (dragDepth > 0 || pinned || transferActive || openedByClick) return;
    setState('closed');
  }, delay);
}

// --- formatting -------------------------------------------------------------

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return (value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)) + ' ' + units[i];
}

// --- rendering --------------------------------------------------------------

function renderShelf(items) {
  shelfItems = items || [];
  els.shelf.replaceChildren();

  const count = shelfItems.length;
  document.body.classList.toggle('has-files', count > 0);
  els.shelfCount.textContent = count ? 'File shelf · ' + count : 'File shelf';
  els.peekShelf.textContent = count ? count + ' files ready' : 'Ready to share';
  els.closedCount.replaceChildren();
  if (count) els.closedCount.textContent = count;
  else {
    const dot = document.createElement('span');
    dot.className = 'ready-dot';
    els.closedCount.append(dot);
  }
  els.shelf.classList.toggle('is-empty', count === 0);
  els.clear.hidden = count === 0;

  if (!count) {
    const hint = document.createElement('div');
    hint.className = 'drop-empty';
    const symbol = document.createElement('span');
    symbol.className = 'drop-symbol';
    symbol.append(icon('<path d="M12 17V5m-4 4 4-4 4 4M5 15v5h14v-5"/>'));
    const title = document.createElement('span');
    title.className = 'drop-title';
    title.textContent = 'Drop something here';
    const caption = document.createElement('span');
    caption.className = 'drop-caption';
    caption.textContent = 'Send to your iPad or another nearby device.';
    hint.append(symbol, title, caption);
    els.shelf.append(hint);
    updateDeviceHint();
    return;
  }

  for (const item of shelfItems) {
    const node = document.createElement('div');
    node.className = 'item';
    node.title = item.path;
    node.draggable = true;
    node.tabIndex = 0;
    const extension = (item.ext || '').replace(/^\./, '').toLowerCase();
    node.dataset.kind = /^(png|jpg|jpeg|gif|webp|heic|svg)$/.test(extension) ? 'image'
      : /^(zip|rar|7z|tar|gz)$/.test(extension) ? 'archive'
        : /^(mp4|mov|mkv|webm)$/.test(extension) ? 'video' : extension === 'pdf' ? 'pdf' : 'file';

    const ext = document.createElement('div');
    ext.className = 'file-icon';
    ext.textContent = (extension || 'FILE').slice(0, 5).toUpperCase();

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = item.name;

    const size = document.createElement('div');
    size.className = 'size';
    size.textContent = formatBytes(item.size);

    const drop = document.createElement('button');
    drop.className = 'drop';
    drop.type = 'button';
    drop.title = 'Remove from shelf';
    drop.textContent = '×';
    drop.addEventListener('click', (event) => {
      event.stopPropagation();
      notch.removeItem(item.id);
    });

    // Dragging an item out hands the real file to Explorer or any other app.
    node.addEventListener('dragstart', (event) => {
      event.preventDefault();
      notch.dragOut(item.id);
    });
    node.addEventListener('dblclick', () => notch.reveal(item.id));
    node.addEventListener('keydown', (event) => {
      if (event.target !== node) return;
      if (event.key === 'Enter') notch.reveal(item.id);
      if (event.key === 'Delete') notch.removeItem(item.id);
    });

    node.append(ext, name, size, drop);
    els.shelf.append(node);
  }

  updateDeviceHint();
}

function updateDeviceHint() {
  if (!shelfItems.length) {
    els.deviceHint.textContent = '';
    return;
  }
  const total = shelfItems.reduce((sum, it) => sum + (it.size || 0), 0);
  els.deviceHint.textContent = formatBytes(total);
}

function renderDevices(list) {
  deviceList = list || [];
  els.devices.replaceChildren();

  if (!deviceList.length) {
    const hint = document.createElement('div');
    hint.className = 'device-empty';
    hint.append(icon('<path d="M8.5 15.5a5 5 0 0 1 7 0M5 12a10 10 0 0 1 14 0M1.5 8.5a15 15 0 0 1 21 0"/><circle cx="12" cy="19" r="1"/>'));
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = 'Looking for nearby devices';
    const caption = document.createElement('small');
    caption.textContent = 'Open LocalSend on your iPad on the same Wi-Fi.';
    copy.append(title, caption);
    hint.append(copy);
    els.devices.append(hint);
    return;
  }

  for (const device of deviceList) {
    const chip = document.createElement('button');
    chip.className = 'device';
    chip.type = 'button';
    chip.title = 'Send files to ' + device.alias;
    chip.disabled = transferActive;

    const glyph = document.createElement('span');
    glyph.className = 'glyph';
    const isTablet = /ipad|tablet/i.test([device.deviceModel, device.alias].join(' '));
    glyph.append(icon(GLYPH[isTablet ? 'tablet' : device.deviceType] || GLYPH.desktop));

    const labels = document.createElement('span');
    labels.className = 'labels';

    const alias = document.createElement('span');
    alias.className = 'alias';
    alias.textContent = device.alias;

    const addr = document.createElement('span');
    addr.className = 'addr';
    addr.textContent = device.deviceModel || (isTablet ? 'iPad' : device.deviceType === 'mobile' ? 'Phone' : 'Ready to share');

    labels.append(alias, addr);
    const arrow = icon('<path d="M4 12h16m-6-6 6 6-6 6"/>');
    arrow.classList.add('device-send');
    chip.append(glyph, labels, arrow);
    chip.title += '\n' + device.address;

    chip.addEventListener('click', () => {
      if (!shelfItems.length) {
        showStatus('Add a file before sending.', null, 'error');
        return;
      }
      doSend(device.fingerprint);
    });

    // Dropping straight onto a device parks the files and sends in one motion.
    chip.addEventListener('dragover', (event) => {
      if (transferActive || !event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      chip.classList.add('drop-target');
    });
    chip.addEventListener('dragleave', () => chip.classList.remove('drop-target'));
    chip.addEventListener('drop', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (transferActive) return;
      chip.classList.remove('drop-target');
      dragDepth = 0;
      document.body.classList.remove('dragging');
      openedByClick = true;
      notch.focus();
      const added = await intake(event.dataTransfer);
      if (added || shelfItems.length) doSend(device.fingerprint);
    });

    els.devices.append(chip);
  }
}

// --- status -----------------------------------------------------------------

function showStatus(text, ratio, kind) {
  clearTimeout(statusTimer);
  els.status.hidden = false;
  els.status.classList.toggle('is-error', kind === 'error');
  els.status.classList.toggle('is-done', kind === 'done');
  document.body.classList.toggle('transfer-done', kind === 'done');
  els.statusText.textContent = text;
  if (ratio != null) els.barFill.style.width = Math.round(Math.max(0, Math.min(1, ratio)) * 100) + '%';
  if (kind === 'error' || kind === 'done') {
    statusTimer = setTimeout(() => { els.status.hidden = true; document.body.classList.remove('transfer-done'); }, 3200);
  }
}

function showPin(fingerprint) {
  pendingPinFor = fingerprint;
  els.pinForm.hidden = false;
  els.pinInput.value = '';
  els.pinInput.focus();
  showStatus('Enter the receiver’s 6-digit PIN.', 0, 'error');
}

function hidePin() {
  pendingPinFor = null;
  els.pinForm.hidden = true;
}

// --- actions ----------------------------------------------------------------

function pathsFrom(dataTransfer) {
  const paths = [];
  for (const file of dataTransfer.files) {
    const filePath = notch.pathForFile(file);
    if (filePath) paths.push(filePath);
  }
  return paths;
}

async function intake(dataTransfer) {
  const paths = pathsFrom(dataTransfer);
  if (!paths.length) {
    showStatus('Cannot read these files.', null, 'error');
    return 0;
  }
  try {
    const result = await notch.addFiles(paths);
    if (result.rejected?.length) {
      const first = result.rejected[0];
      showStatus(first.reason + ' (' + first.path.split(/[\\/]/).pop() + ')', null, 'error');
    }
    return result.added;
  } catch (error) {
    showStatus(error.message || 'Cannot add files. Try again.', null, 'error');
    return 0;
  }
}

async function doSend(fingerprint, pin) {
  if (transferActive) return;
  clearTimeout(collapseTimer);
  transferActive = true;
  openedByClick = true;
  outsideDuringTransfer = false;
  renderDevices(deviceList); // disable the chips while sending
  showStatus('Waiting for the receiver…', 0);

  let completed = false;
  try {
    const result = await notch.sendTo(fingerprint, pin);
    if (result.ok) {
      completed = true;
      hidePin();
      const parts = [];
      if (result.sent) parts.push('Sent ' + result.sent + ' files');
      if (result.skipped) parts.push('Skipped ' + result.skipped);
      showStatus(parts.join(' · ') || 'Done', 1, 'done');
    } else if (result.kind === 'pin') {
      showPin(fingerprint);
    } else {
      showStatus(result.message, 0, 'error');
    }
  } catch (error) {
    showStatus(error.message || 'Transfer failed. Try again.', 0, 'error');
  } finally {
    transferActive = false;
    renderDevices(deviceList);
    if (!pendingPinFor && !pinned && (completed || outsideDuringTransfer) && (outsideDuringTransfer || !pointerInside)) {
      clearTimeout(collapseTimer);
      collapseTimer = setTimeout(() => {
        if (!pinned && !transferActive && !pendingPinFor && !pointerInside) collapseNotch();
      }, 1800);
    }
  }
}

// --- events -----------------------------------------------------------------

function pointerEntered() {
  pointerInside = true;
  clearTimeout(collapseTimer);
  clearTimeout(hoverTimer);
  if (state === 'closed' && !hoverSuppressed) hoverTimer = setTimeout(() => { if (pointerInside && state === 'closed' && !hoverSuppressed) setState('peek'); }, 90);
}

function pointerLeft() {
  pointerInside = false;
  hoverSuppressed = false;
  clearTimeout(hoverTimer);
  if (pinned || openedByClick || dragDepth > 0 || transferActive) return;
  scheduleCollapse(300);
}
card.addEventListener('mouseenter', pointerEntered);
card.addEventListener('mouseleave', pointerLeft);
notch.onPointer((inside) => inside ? pointerEntered() : pointerLeft());
notch.onDismiss(dismissOutside);

els.closedTrigger.addEventListener('click', () => {
  openNotch(timerState.hasSession ? 'timer' : mediaVisible ? 'media' : 'send');
});
document.querySelector('.layer-peek').addEventListener('keydown', (event) => {
  if (event.target !== event.currentTarget) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  openNotch(timerState.hasSession ? 'timer' : mediaVisible ? 'media' : activeTab);
});

card.addEventListener('click', (event) => {
  if (event.target.closest('button, input, .item')) return;
  if (state === 'open') return;
  openNotch(timerState.hasSession ? 'timer' : event.target.closest('.layer-peek') && mediaVisible ? 'media' : activeTab);
});

els.collapse.addEventListener('click', () => {
  setPinned(false);
  collapseNotch();
});
els.keepOpen.addEventListener('click', () => setPinned(!pinned));

els.clear.addEventListener('click', () => notch.clearShelf());

els.pinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = els.pinInput.value.trim();
  if (!value || !pendingPinFor) return;
  doSend(pendingPinFor, value);
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && activeTab === 'clipboard' && state === 'open') {
    event.preventDefault();
    document.querySelector('[data-panel="clipboard"] .clip-search').focus();
  }
  if (event.key === 'Escape') {
    if (exploring) { setTab(activeTab); return; }
    setPinned(false);
    collapseNotch();
  }
});

// Gestures stay on the shell; scrolling file and clipboard content still works.
card.addEventListener('wheel', (event) => {
  if (!preferences.gestures || event.ctrlKey || event.metaKey || exploring) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
  const control = !!event.target.closest('button:not(#closed-trigger), input, textarea, select');
  const musicSurface = !!event.target.closest('.np, .layer-peek, .layer-closed');
  const action = wheelGesture.handle({ x: -event.deltaX * unit, y: event.deltaY * unit, time: Date.now(),
    expanded: state === 'open', vertical: !control && (state !== 'open' || !!event.target.closest('.notch-header, .tabs, .panel-footer') || musicSurface),
    horizontal: !control && mediaVisible && (state !== 'open' || musicSurface) });
  if (action === 'next' || action === 'prev') {
    if (!(action === 'next' ? media.canNext : media.canPrev)) return;
    event.preventDefault();
    mediaCommand(action);
  } else if (action === 'open') {
    event.preventDefault();
    openNotch(timerState.hasSession ? 'timer' : mediaVisible ? 'media' : activeTab);
  } else if (action === 'close') {
    event.preventDefault();
    setPinned(false);
    collapseNotch();
  }
}, { passive: false });

// A file drag anywhere over the notch opens it straight to the shelf.
document.addEventListener('dragenter', (event) => {
  if (!event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  if (dragDepth === 0) pinnedBeforeDrag = openedByClick;
  dragDepth += 1;
  focusSendTab(); // dropping a file is a send-tab action, whatever is showing
  clearTimeout(collapseTimer);
  document.body.classList.add('dragging');
  setState('open');
});

document.addEventListener('dragover', (event) => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
});

document.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    document.body.classList.remove('dragging');
    openedByClick = pinnedBeforeDrag;
    scheduleCollapse(600);
  }
});

document.addEventListener('drop', async (event) => {
  event.preventDefault();
  if (!event.dataTransfer?.types.includes('Files')) return;
  dragDepth = 0;
  document.body.classList.remove('dragging');
  openedByClick = true;
  notch.focus();
  const added = await intake(event.dataTransfer);
  if (added) showStatus('Added ' + added + ' files added. Choose a device.', null, 'done');
});

notch.onDevices(renderDevices);
notch.onShelf(renderShelf);

notch.onTransfer((p) => {
  if (p.phase === 'waiting') {
    showStatus('Waiting for ' + p.alias + ' to accept…', 0);
  } else if (p.phase === 'sending') {
    const ratio = p.totalBytes ? p.sentBytes / p.totalBytes : 0;
    const label = p.fileName ? p.fileName + ' · ' : '';
    showStatus(label + formatBytes(p.sentBytes) + ' / ' + formatBytes(p.totalBytes), ratio);
  } else if (p.phase === 'error') {
    showStatus(p.message, 0, 'error');
  }
});

notch.onToggle(() => {
  if (state === 'open') {
    setPinned(false);
    collapseNotch();
  } else {
    openNotch(shelfItems.length ? 'send' : timerState.hasSession ? 'timer' : mediaVisible ? 'media' : activeTab);
  }
});

// --- now playing ------------------------------------------------------------

function setArt(host, dataUri) {
  const img = host.querySelector('img');
  if (dataUri) {
    if (host === els.npArt) img.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
      try {
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(img, 0, 0, 8, 8);
        const pixels = context.getImageData(0, 0, 8, 8).data;
        const sum = [0, 0, 0];
        for (let i = 0; i < pixels.length; i += 4) for (let channel = 0; channel < 3; channel++) sum[channel] += pixels[i + channel];
        const tint = NotchMotion.artworkTint(sum.map((value) => value / (64 * 255)));
        document.body.style.setProperty('--artwork-rgb', tint ? tint.join(', ') : '0, 0, 0');
      } catch { document.body.style.setProperty('--artwork-rgb', '0, 0, 0'); }
    };
    img.onerror = () => { host.classList.remove('has-art'); if (host === els.npArt) document.body.style.setProperty('--artwork-rgb', '0, 0, 0'); };
    if (img.getAttribute('src') !== dataUri) img.src = dataUri;
    host.classList.add('has-art');
    if (host === els.npArt) document.body.style.setProperty('--artwork-url', 'url("' + dataUri + '")');
  } else {
    img.removeAttribute('src');
    host.classList.remove('has-art');
    if (host === els.npArt) {
      document.body.style.setProperty('--artwork-rgb', '0, 0, 0');
      document.body.style.removeProperty('--artwork-url');
    }
  }
}

/** Scroll a title only if it does not fit, and scale the drift to its length. */
function fitMarquee(track) {
  const box = track.parentElement;
  if (!box.clientWidth) return; // laid out but hidden; nothing to measure yet
  const overflow = track.scrollWidth - box.clientWidth;
  if (overflow > 4) {
    track.style.setProperty('--marquee-shift', '-' + overflow + 'px');
    track.style.setProperty('--marquee-dur', Math.max(5, overflow / 26).toFixed(1) + 's');
    track.classList.add('is-scrolling');
  } else {
    track.classList.remove('is-scrolling');
    track.style.removeProperty('--marquee-shift');
  }
}

function renderNowPlaying() {
  const active = MediaState.isActive(media, Date.now());
  setMediaVisible(active);
  document.body.classList.toggle('is-playing', active && media.playing);

  if (!active) {
    seekPending = null;
    seeking = false;
    setArt(els.closedArt, null);
    setArt(els.peekArt, null);
    setArt(els.npArt, null);
    els.peekTitle.textContent = '';
    els.npTitle.textContent = '';
    els.npSub.textContent = '';
    els.npSeek.disabled = true;
    els.npSeek.value = '0';
    els.npTime.textContent = '';
    els.npRemaining.textContent = '';
    if (!timerState.hasSession) {
      els.closedTrigger.setAttribute('aria-label', 'Open file shelf');
      els.closedTrigger.title = 'Click to open · Ctrl+Alt+D';
    }
    return;
  }

  const heading = media.title || media.artist;
  const peekHeading = media.title && media.artist
    ? media.title + ' — ' + media.artist
    : heading;
  const subtitle = [media.artist, media.album, media.appLabel]
    .filter(Boolean)
    .join(' · ');
  const changed = els.peekTitle.textContent !== peekHeading || els.npTitle.textContent !== heading;
  if (els.peekTitle.textContent !== peekHeading) els.peekTitle.textContent = peekHeading;
  if (els.npTitle.textContent !== heading) els.npTitle.textContent = heading;
  if (els.npSub.textContent !== subtitle) els.npSub.textContent = subtitle;
  const sourceKey = JSON.stringify([media.sources || [], media.selectedSource]);
  if (els.npSource.dataset.sources !== sourceKey) {
    els.npSource.dataset.sources = sourceKey;
    const ids = [...new Set(['', ...(media.sources || []), ...(media.selectedSource ? [media.selectedSource] : [])])];
    els.npSource.replaceChildren(...ids.map((id) => {
      const option = document.createElement('option'); option.value = id;
      option.textContent = id ? MediaState.appLabel(id) : 'Automatic source'; return option;
    }));
  }
  els.npSource.hidden = (media.sources || []).length < 2 && !media.selectedSource;
  els.npSource.value = media.selectedSource || '';

  setArt(els.peekArt, media.thumb);
  setArt(els.npArt, media.thumb);
  setArt(els.closedArt, media.thumb);
  if (!timerState.hasSession) {
    els.closedTrigger.setAttribute('aria-label', 'Open Now Playing: ' + heading);
    els.closedTrigger.title = heading + (media.artist ? ' · ' + media.artist : '') + ' · Open Now Playing';
  }
  const toggleLabel = media.playing ? 'Pause' : 'Play';
  for (const button of [els.npToggle, els.peekToggle]) {
    button.setAttribute('aria-label', toggleLabel);
    button.title = toggleLabel;
    button.setAttribute('aria-pressed', String(media.playing));
  }

  els.npPrev.disabled = !media.canPrev;
  els.npNext.disabled = !media.canNext;
  els.npToggle.disabled = !media.canToggle;
  els.peekToggle.disabled = !media.canToggle;
  els.npSeek.disabled = !media.canSeek;
  els.npSeek.max = String(Math.floor(media.duration));
  els.npSeek.title = media.canSeek ? 'Seek' : 'This player does not support seeking.';

  tickNowPlaying();
  if (changed) { fitMarquee(els.npTitle); fitMarquee(els.peekTitle); }
}

function tickNowPlaying() {
  if (!media.active) return;

  const now = Date.now();
  if (!MediaState.isActive(media, now)) {
    // A long pause means the notch stops holding the row open.
    renderNowPlaying();
    return;
  }

  if (media.duration > 0) {
    const position = seeking ? Number(els.npSeek.value)
      : seekPending && now < seekPending.until ? Math.min(media.duration, seekPending.position + (media.playing ? (now - seekPending.at) / 1000 : 0))
        : MediaState.positionAt(media, now);
    els.npProgress.classList.remove('is-live');
    els.npFill.style.width = (Math.min(1, position / media.duration) * 100).toFixed(2) + '%';
    if (!seeking) els.npSeek.value = String(Math.floor(position));
    els.npTime.textContent = MediaState.formatClock(position);
    els.npRemaining.textContent = '−' + MediaState.formatClock(Math.max(0, media.duration - position));
    els.npSeek.setAttribute('aria-valuetext', MediaState.formatClock(position) + ' of ' + MediaState.formatClock(media.duration));
  } else {
    // Live streams report no length, so there is no bar to draw.
    els.npProgress.classList.add('is-live');
  }

}

async function mediaCommand(action, value) {
  if (!media.active) return;
  const before = media;
  if (action === 'toggle') {
    const now = Date.now();
    media = { ...media, playing: !media.playing, position: MediaState.positionAt(media, now),
      anchorAt: now, pausedSince: media.playing ? now : 0 };
    renderNowPlaying();
  }
  let queued = false;
  try { queued = await notch.mediaCommand(action, value); } catch { /* report below */ }
  if (!queued) {
    if (action === 'toggle' && media.title === before.title && media.app === before.app) { media = before; renderNowPlaying(); }
    if (action === 'seek') seekPending = null;
    els.mediaFeedback.textContent = 'Cannot control this player. Try again.';
  } else {
    els.mediaFeedback.textContent = '';
  }
}

els.npPrev.addEventListener('click', () => mediaCommand('prev'));
els.npToggle.addEventListener('click', () => mediaCommand('toggle'));
els.npNext.addEventListener('click', () => mediaCommand('next'));
els.peekToggle.addEventListener('click', (event) => { event.stopPropagation(); mediaCommand('toggle'); });
els.npSeek.addEventListener('input', () => { seeking = true; tickNowPlaying(); });
els.npSeek.addEventListener('change', () => {
  const position = Math.max(0, Math.min(media.duration, Number(els.npSeek.value)));
  seeking = false;
  if (!media.canSeek) return;
  const now = Date.now();
  seekPending = { position, at: now, until: now + 1500 };
  tickNowPlaying();
  mediaCommand('seek', position);
});
els.npSeek.addEventListener('pointercancel', () => { seeking = false; tickNowPlaying(); });
els.npSource.addEventListener('change', () => mediaCommand('source', els.npSource.value));
notch.onMediaResult((result) => {
  if (result.via !== 'none') return;
  seekPending = null;
  els.mediaFeedback.textContent = result.action === 'seek' ? 'This player declined the seek request.' : 'This player declined the playback command.';
});

notch.onNowPlaying((message) => {
  const previous = media;
  media = MediaState.nextState(media, message, Date.now());
  const newTrack = previous.title !== media.title || previous.artist !== media.artist || previous.app !== media.app;
  if (newTrack) { seekPending = null; els.mediaFeedback.textContent = ''; }
  renderNowPlaying();
  if (preferences.musicPreview && !timerState.hasSession && media.active && media.playing && (newTrack || !previous.playing) && state === 'closed'
    && !dragDepth && !transferActive && !hoverSuppressed) {
    setState('peek');
    clearTimeout(mediaPreviewTimer);
    mediaPreviewTimer = setTimeout(() => {
      if (state === 'peek' && !pointerInside && !pinned && !openedByClick) setState('closed');
    }, 2400);
  }
});

// --- ai sessions ------------------------------------------------------------

// The main process sends the stable half of each session (name, folder, raw
// status, when that status began); everything the user reads is derived here, on
// a tick, because a duration ages with no file event to announce it.

function renderAiSessions() {
  const now = Date.now();
  const list = AiState.sortSessions(aiSessions, now);
  const waiting = AiState.waitingCount(list, now);
  const working = list.filter((s) => AiState.kindOf(s, now) === 'working').length;
  document.body.classList.toggle('ai-waiting', waiting > 0);
  document.body.classList.toggle('ai-working', working > 0);
  els.peekAi.hidden = waiting + working === 0;
  els.peekAi.title = working + ' working · ' + waiting + ' waiting';
  els.peekAiCount.textContent = waiting + working > 1 ? String(waiting + working) : '';
  AiPanel.updateSessions(aiSessions);
}

let aiDashboardReady = false;
notch.onAiDashboard((value) => {
  aiDashboardReady = true;
  aiSessions = AiPanel.update(value);
  renderAiSessions();
});
notch.onAiComplete((value) => {
  els.footerHint.textContent = value.provider + ' · ' + value.name + ' · Task complete';
});

notch.onClipboard((entries) => {
  lastClipboard = entries || [];
  ClipboardPanel.update(lastClipboard);
});
notch.onClipboardPaused((paused) => {
  ClipboardPanel.setPaused(paused);
  ClipboardPanel.update(lastClipboard);
});
notch.onSystem((sample) => SystemPanel.update(sample));

notch.onAiSessions((list) => {
  if (aiDashboardReady) return;
  aiSessions = list || [];
  renderAiSessions();
});

// --- peek widgets -----------------------------------------------------------

function tickClock() {
  const now = new Date();
  els.clock.textContent = timerState.hasSession ? UtilityPanels.clock(timerState.reading, timerState.countsUp)
    : String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  if (timerState.hasSession) els.peekShelf.textContent = timerState.completed ? 'Time is up' : UtilityPanels.phaseName[timerState.phase];
}

function renderTimer(value) {
  const wasActive = timerState.hasSession;
  const wasComplete = timerState.completed;
  timerState = value || { hasSession: false };
  document.body.classList.toggle('has-timer', !!timerState.hasSession);
  els.closedTimer.textContent = timerState.hasSession ? UtilityPanels.clock(timerState.reading, timerState.countsUp) : '';
  UtilityPanels.updateTimer(timerState);
  tickClock();
  if (timerState.hasSession) {
    els.closedTrigger.setAttribute('aria-label', 'Open timer: ' + els.closedTimer.textContent);
    els.closedTrigger.title = 'Open timer · ' + UtilityPanels.phaseName[timerState.phase];
  }
  if (!timerState.hasSession && wasActive) {
    els.peekShelf.textContent = shelfItems.length ? shelfItems.length + ' files ready' : 'Ready to share';
    renderNowPlaying();
  }
  if (state === 'peek' && wasActive !== timerState.hasSession) updateGeometry();
  if (timerState.completed && !wasComplete && state === 'closed' && !transferActive) {
    setState('peek');
    els.closedTrigger.setAttribute('aria-label', 'Time is up. Open timer');
    clearTimeout(mediaPreviewTimer);
    mediaPreviewTimer = setTimeout(() => {
      if (state === 'peek' && !pointerInside && !pinned && !openedByClick) setState('closed');
    }, 3200);
  }
}
notch.onTimer(renderTimer);
notch.onNavigate((name) => openNotch(name));

// --- module panels ----------------------------------------------------------

// panel-clipboard.js and panel-system.js build their own markup, so all this
// layer does is hand them a root and a way back to the main process.
function mountModulePanels() {
  ClipboardPanel.mount(document.querySelector('.panel[data-panel="clipboard"]'), {
    pick: async (id) => {
      let ok = false;
      try { ok = await notch.clipPick(id); } catch { /* keep feedback in the current panel */ }
      flashFooter(ok ? 'Copied. Ready to paste.' : 'This item cannot be copied.');
    },
    remove: (id) => notch.clipRemove(id),
    clear: () => notch.clipClear(),
    setPaused: (paused) => notch.clipPause(paused),
  });

  SystemPanel.mount(document.querySelector('.panel[data-panel="system"]'));
  UtilityPanels.mount({ timerCommand: notch.timerCommand, saveNote: notch.saveNote, cacheNote: notch.cacheNote });
}

// --- tabs -------------------------------------------------------------------

// Each tab button carries data-tab; the panel it shows carries data-panel with
// the same value. A module is added by appending one of each.
let activeTab = 'send';

function setTab(name) {
  // Settings is a window of its own, so its tile hands off and leaves the
  // notch showing whatever it was showing.
  if (name === 'settings') {
    setExploring(false);
    notch.openSettings();
    return;
  }
  const panel = document.querySelector('.panel[data-panel="' + name + '"]');
  if (!panel) return;
  setExploring(false);
  activeTab = name;
  clearTimeout(feedbackTimer);
  els.footerHint.classList.remove('is-confirmed');
  document.body.dataset.tab = name;
  const titles = { send: 'Send files', media: 'Now Playing', clipboard: 'Clipboard', system: 'System', ai: 'AI Monitor', timer: 'Timer', notes: 'Notes' };
  const hints = { send: 'Drop files. Choose a device. Send.', media: 'Your music, a little closer.', clipboard: 'Click an item to copy it.', system: 'A quiet look at your Windows PC.', ai: 'Codex & Claude · Local activity', timer: 'Keep time, even with the notch closed.', notes: 'Autosaved · Only on this device' };
  els.panelTitle.textContent = titles[name];
  els.footerHint.textContent = hints[name];

  for (const tab of els.tabs.querySelectorAll('.tab')) {
    tab.classList.toggle('is-active', tab.dataset.tab === name);
    tab.setAttribute('aria-checked', String(tab.dataset.tab === name));
    tab.tabIndex = tab.dataset.tab === name ? 0 : -1;
  }
  for (const section of document.querySelectorAll('.panel')) {
    section.classList.toggle('is-active', section === panel);
    section.inert = section !== panel;
  }
  if (name === 'media') requestAnimationFrame(() => { fitMarquee(els.npTitle); });
  if (state === 'open') updateGeometry();
}

els.tabs.setAttribute('role', 'menu');
for (const tab of els.tabs.querySelectorAll('.tab')) {
  const name = tab.dataset.tab;
  tab.setAttribute('role', 'menuitemradio');
  tab.id = 'tab-' + name;
  tab.setAttribute('aria-controls', 'panel-' + name);
  const panel = document.querySelector('[data-panel="' + name + '"]');
  if (!panel) continue;
  panel.id = 'panel-' + name;
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', tab.id);
}
els.tabs.addEventListener('keydown', (event) => {
  const tabs = [...els.tabs.querySelectorAll('.tab:not([hidden])')];
  const index = tabs.indexOf(document.activeElement);
  if (index < 0 || !['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowDown' ? 3 : -3) + tabs.length) % tabs.length;
  tabs[next].focus();
});

els.tabs.addEventListener('click', (event) => {
  const tab = event.target.closest('.tab');
  if (tab) setTab(tab.dataset.tab);
});

els.quit.addEventListener('click', () => notch.quit());

// A transfer or a drop belongs to the send tab; jump there so the user sees it.
function focusSendTab() {
  if (activeTab !== 'send') setTab('send');
}

// --- boot -------------------------------------------------------------------

(async function boot() {
  applyVisualState();
  tickClock();
  setInterval(tickClock, 10000);
  setInterval(tickNowPlaying, 250);
  // Only the wording and the quiet threshold move between file events, and the
  // shortest thing either can say is a minute, so twice a minute is plenty.
  setInterval(renderAiSessions, 30000);

  mountModulePanels();
  setTab('send');

  const initial = await notch.init();
  renderShelf(initial.shelf);
  renderDevices(initial.devices);
  media = initial.nowPlaying || MediaState.EMPTY;
  renderNowPlaying();
  aiDashboardReady = !!initial.aiDashboard;
  aiSessions = initial.aiDashboard ? AiPanel.update(initial.aiDashboard) : initial.aiSessions || [];
  renderAiSessions();

  lastClipboard = initial.clipboard || [];
  ClipboardPanel.setPaused(initial.clipboardPaused);
  ClipboardPanel.update(lastClipboard);
  SystemPanel.update(initial.system);
  renderTimer(initial.timer);
  UtilityPanels.updateNote(initial.note);
  if (initial.preferences) applyPreferences(initial.preferences);
})();
