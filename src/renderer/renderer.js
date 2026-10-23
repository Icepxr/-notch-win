'use strict';

let SIZES = NotchGeometry.sizes;

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
  closedAgent: document.getElementById('closed-agent'),
  focusPicker: document.getElementById('focus-picker'),
  closedAgentTime: document.getElementById('closed-agent-time'),
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
let activeNotice = null;
let choosingFiles = false;
const PAGE_NAMES = { send: 'Files', media: 'Music', clipboard: 'Clipboard', system: 'System', ai: 'AI Agents', timer: 'Timer', notes: 'Notes' };
const PAGE_ORDER = Object.keys(PAGE_NAMES);
const pageSwipe = new NotchActivity.Swipe();

for (const [name, size] of Object.entries(SIZES)) {
  document.documentElement.style.setProperty('--' + name + '-width', size.width + 'px');
  document.documentElement.style.setProperty('--' + name + '-height', size.height + 'px');
}

// --- geometry ---------------------------------------------------------------

/** The card size for a state, which depends on whether music is showing. */
function geometryFor(name) {
  if (name === 'peek') return activeNotice ? SIZES.peekNotice : mediaVisible && !timerState.hasSession ? SIZES.peekMedia : SIZES.peek;
  if (name === 'open') {
    if (exploring) return SIZES.openGallery;
    if (activeTab === 'system') return SystemPanel.detailOpen() ? SIZES.openSystemDetail : SIZES.openSystem;
    if (activeTab === 'timer') return { ...SIZES.openTools, height: UtilityPanels.preferredHeight() };
    if (activeTab === 'ai') return { ...SIZES.openAi, height: Math.min(SIZES.openAi.height,AiPanel.preferredHeight()) };
    return activeTab === 'media' ? SIZES.openMusic
      : activeTab === 'send' || activeTab === 'notes' ? SIZES.openShelf : SIZES.open;
  }
  return SIZES.closed;
}

/**
 * What the resting notch is for, when several things are happening at once.
 *
 * Music, a working agent and a countdown all want the same few pixels, and
 * before this they simply drew on top of each other. Only one of them gets
 * the notch: the one the user asked for if it is live, otherwise the first
 * of these that is.
 *
 * The order follows what the notch already did. A transfer has an end
 * someone is waiting on. A countdown was set deliberately and already took
 * the notch from music. Music is the thing people glance down at constantly.
 * A working agent is the newest of the four and the least glanceable, so it
 * yields by default — and the preference is there for anyone who disagrees.
 */
const FOCUS_ORDER = ['transfer', 'timer', 'music', 'agent'];

function liveActivities() {
  return FOCUS_ORDER.filter((name) => (
    name === 'transfer' ? transferActive
      : name === 'agent' ? document.body.classList.contains('ai-working')
        : name === 'timer' ? timerState.hasSession
          : mediaVisible));
}

let focusOverride = null;

function refreshIdle() {
  const live = liveActivities();
  const busy = live.length || activeNotice || shelfItems.length
    || document.body.classList.contains('ai-waiting');
  document.body.classList.toggle('is-idle', !busy);

  // The override only survives while the thing it points at is still live.
  if (focusOverride && !live.includes(focusOverride)) focusOverride = null;
  const preferred = preferences.notchFocus && preferences.notchFocus !== 'auto' ? preferences.notchFocus : null;
  const focus = focusOverride
    || (preferred && live.includes(preferred) ? preferred : null)
    || live[0] || 'none';
  document.body.dataset.focus = focus;
  // More than one live activity is what makes the notch worth cycling.
  document.body.classList.toggle('multi-activity', live.length > 1);
  paintFocusPicker(live, focus);
  els.closedTrigger.dataset.live = String(live.length);
}

/** Step to the next live activity, so a crowded notch stays browsable. */
function cycleFocus() {
  const live = liveActivities();
  if (live.length < 2) return false;
  const current = document.body.dataset.focus;
  chooseFocus(live[(live.indexOf(current) + 1) % live.length]);
  return true;
}

function chooseFocus(name) {
  focusOverride = name;
  refreshIdle();
  renderAiSessions();
}

const ACTIVITY_GLYPH = {
  transfer: '<path d="M12 17V5m-4 4 4-4 4 4M5 15v4h14v-4"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M9 2h6m-3 3V2m0 7v5l3 2"/>',
  music: '<path d="M9 18V5l10-2v13M9 8l10-2"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
};
const ACTIVITY_NAME = { transfer: 'Transfer', timer: 'Timer', music: 'Music', agent: 'AI agent' };

/**
 * With more than one thing live, hovering the notch offers the choice
 * directly: one small mark per activity, the current one lit. Picking is one
 * movement from the hover the user is already making, which beats a hidden
 * gesture or a button parked in a corner.
 */
function paintFocusPicker(live, focus) {
  const picker = els.focusPicker;
  picker.hidden = live.length < 2;
  if (picker.hidden) { picker.replaceChildren(); return; }
  const signature = live.join(',') + '|' + focus;
  if (picker.dataset.signature === signature) return;
  picker.dataset.signature = signature;
  picker.replaceChildren(...live.map((name) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'focus-option';
    button.dataset.activity = name;
    button.setAttribute('aria-pressed', String(name === focus));
    button.title = ACTIVITY_NAME[name];
    button.setAttribute('aria-label', 'Show ' + ACTIVITY_NAME[name]);
    if (name === 'agent') {
      const running = aiSessions.find((session) => AiState.kindOf(session, Date.now()) === 'working');
      button.append(ProviderMarks.markElement(running?.provider === 'codex' ? 'codex' : 'claude', document));
      button.classList.add('is-mark');
    } else {
      button.append(icon(ACTIVITY_GLYPH[name]));
    }
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      chooseFocus(name);
    });
    return button;
  }));
}

function applyVisualState() {
  notch.setInteraction(state);
  document.body.classList.remove('state-closed', 'state-peek', 'state-open');
  document.body.classList.add('state-' + state);
  document.body.classList.toggle('has-media', mediaVisible);
  document.body.classList.toggle('has-notice', !!activeNotice);
  refreshIdle();
  for (const name of ['closed', 'peek', 'open']) {
    document.querySelector('.layer-' + name).inert = name !== state || name === 'peek' && !!activeNotice;
  }
  document.querySelector('.layer-notice').inert = state !== 'peek' || !activeNotice;
}

let morphTarget = '';
async function updateGeometry() {
  const target = geometryFor(state);
  card.style.setProperty('--page-height', geometryFor('open').height + 'px');
  const key = [state, target.width, target.height, preferences.silhouette].join(':');
  if (key === morphTarget) { applyVisualState(); return; }
  morphTarget = key;
  document.body.classList.add('is-morphing');
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
  card.style.setProperty('--notch-shoulder', Math.min(14, target.height * .19) + 'px');
  const radius = preferences.silhouette === 'capsule' ? Math.min(28, target.height / 2) : Math.min(28, target.height * .34);
  // Persist the entire contour below the animation. Updating only the lower
  // corners let media-preview CSS square the capsule's top when fill was removed.
  card.style.borderRadius = preferences.silhouette === 'capsule' ? radius + 'px' : '0 0 ' + radius + 'px ' + radius + 'px';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const morph = card.animate(motion.sizes.map((size) => ({
    width: size.width + 'px', height: size.height + 'px',
    '--notch-shoulder': Math.min(14, size.height * .19) + 'px',
    borderRadius: preferences.silhouette === 'capsule' ? Math.min(28, size.height / 2) + 'px'
      : '0 0 ' + Math.min(28, size.height * .34) + 'px ' + Math.min(28, size.height * .34) + 'px',
  })), { duration: reduced ? 1 : motion.duration, easing: 'linear', fill: 'both' });
  currentMorph = morph;
  await morph.finished.catch(() => {});
  if (revision !== geometryRevision) return;
  morph.cancel();
  currentMorph = null;
  document.body.classList.remove('is-shrinking');
  document.body.classList.remove('is-morphing');
  updateHitRegion(); // A silhouette-only change need not trigger ResizeObserver.
}

function setState(next) {
  if (next === state) return;
  if (next !== 'open') ClipboardPanel.closePreview();
  if (next !== 'open') AiPanel.closeEditor();
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

// The shell is always black. Artwork tint belongs only to music meters.
let musicTint = null;

function applyColors() {
  const colors = NotchAppearance.colors();
  for (const [token, color] of Object.entries({ '--panel': colors.surface, '--surface-rest': colors.rest,
    '--surface-open': colors.surface, '--surface-sheen': colors.sheen, '--accent': colors.accent })) {
    document.documentElement.style.setProperty(token, color);
  }
  applyMusicTint();
}

function applyMusicTint() {
  const tint = preferences.musicColors !== false ? musicTint?.accentColor : null;
  for (const element of [document.querySelector('.np'), document.querySelector('.equalizer')]) {
    element.style.setProperty('--music-accent', tint || '#ffffff');
    element.classList.toggle('music-tinted', Boolean(tint));
  }
}

function setMusicTint(value) {
  const next = value || null;
  if (next?.accentColor === musicTint?.accentColor) return;
  musicTint = next;
  applyMusicTint();
}

function applyModulePreferences() {
  const modulePrefs = NotchModules.normalize(preferences);
  const arranged = [...modulePrefs.moduleOrder, 'settings'];
  const actual = [...els.tabs.querySelectorAll('.tab')].map(tab => tab.dataset.tab);
  if (actual.join() !== arranged.join()) for (const id of arranged) els.tabs.append(els.tabs.querySelector('[data-tab="' + id + '"]'));
  filterGallery();
}

function applyPreferences(value) {
  const previousWidth = SIZES.open.width;
  preferences = { ...preferences, ...value, ...NotchAppearance.normalize({ ...preferences, ...value }), glass: 'off' };
  SIZES = NotchGeometry.sizesFor(preferences);
  for (const [name, size] of Object.entries(SIZES)) {
    document.documentElement.style.setProperty('--' + name + '-width', size.width + 'px');
    document.documentElement.style.setProperty('--' + name + '-height', size.height + 'px');
  }
  applyColors();
  applyModulePreferences();
  NotesPanel.applyPreferences(preferences);
  document.body.dataset.silhouette = preferences.silhouette;
  document.body.dataset.glass = 'off';
  updateGeometry();
  if (previousWidth !== SIZES.open.width) requestAnimationFrame(() => { fitMarquee(els.npTitle); fitMarquee(els.peekTitle); });
}

notch.onDisplays((value) => {
  if (value.preferences) applyPreferences(value.preferences);
});

// Settings live in their own window now, so the notch has to be told when the
// user changes something over there.
notch.onPreferences((result) => {
  if (result?.preferences) applyPreferences(result.preferences);
});

function setExploring(value, resize = true) {
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
    filterGallery();
    els.exploreSearch.focus();
  } else if (els.tabs.contains(document.activeElement) || document.activeElement === els.exploreSearch) {
    els.explore.focus();
  }
  if (resize && state === 'open') updateGeometry();
}

els.explore.addEventListener('click', () => {
  if (exploring) setTab(activeTab);
  else setExploring(true);
});
els.exploreSearch.addEventListener('input', () => {
  filterGallery();
});
function filterGallery() {
  const query = els.exploreSearch.value.toLocaleLowerCase().trim();
  const hidden = NotchModules.normalize(preferences).hiddenModules;
  for (const tab of els.tabs.querySelectorAll('.tab')) tab.hidden = hidden.includes(tab.dataset.tab) || ![tab.textContent, tab.getAttribute('aria-label')].join(' ').toLocaleLowerCase().includes(query);
  els.tabs.scrollTop = 0; updateGalleryRail();
}

// Brief activities are rendered in the notch itself and never steal focus.
const activityQueue = new NotchActivity.Queue({ change: (item) => {
  activeNotice = item;
  const inline = document.getElementById('activity-inline');
  inline.hidden = !item;
  if (item) {
    document.getElementById('notice-title').textContent = item.title;
    document.getElementById('notice-detail').textContent = item.detail || '';
    document.getElementById('activity-inline-label').textContent = item.title + (item.coalesceKey === 'hardware' ? ' · ' + item.detail : '');
    document.body.dataset.notice = item.kind;
    const hasMeter = Number.isFinite(item.progress);
    document.body.classList.toggle('has-notice-meter', hasMeter);
    const meter = document.getElementById('notice-meter');
    meter.hidden = !hasMeter;
    if (hasMeter) {
      const value = Math.max(0, Math.min(100, item.progress));
      meter.setAttribute('aria-valuenow', value);
      meter.setAttribute('aria-valuetext', item.title + ' · ' + item.detail);
      document.body.style.setProperty('--notice-progress', value / 100);
      document.body.style.setProperty('--notice-fill', value + '%');
    }
    const open = document.getElementById('notice-open');
    open.disabled = Boolean(item.passive);
    open.title = item.passive ? '' : item.settings ? 'Open ' + item.settings + ' settings' : 'Open activity';
    document.body.classList.toggle('notice-passive', Boolean(item.passive));
    const paths = item.kind === 'music' ? '<path d="M9 18V5l10-2v13M9 8l10-2"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>'
      : item.kind === 'timer' ? '<circle cx="12" cy="13" r="8"/><path d="M9 2h6m-3 3V2m0 7v5l3 2"/>'
      : item.kind === 'ai' ? '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>'
      : item.kind === 'volume' ? '<path d="M4 9h4l5-4v14l-5-4H4Zm12-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>'
      : item.kind === 'muted' ? '<path d="M4 9h4l5-4v14l-5-4H4Zm13 0 5 6m0-6-5 6"/>'
      : item.kind === 'brightness' ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>'
      : item.kind === 'capslock' ? '<path d="m5 13 7-9 7 9h-4v4H9v-4Zm4 7h6"/>'
      : item.kind === 'error' ? '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3h.01"/>' : '<path d="m5 12 4 4L19 6"/>';
    const symbol = document.getElementById('notice-symbol');
    symbol.replaceChildren(icon(paths));
    if (item.kind === 'music' && media.thumb) {
      const image = document.createElement('img'); image.alt = ''; image.src = media.thumb;
      image.onerror = () => symbol.replaceChildren(icon(paths)); symbol.replaceChildren(image);
    }
    if (state === 'closed' && !dragDepth && !transferActive && (!hoverSuppressed || item.coalesceKey === 'hardware')) setState('peek');
    else updateGeometry();
  } else {
    document.body.classList.remove('has-notice', 'has-notice-meter', 'notice-passive');
    if (state === 'peek' && !pointerInside && !pinned && !openedByClick) collapseNotch();
    else updateGeometry();
  }
} });
function postActivity(item) { activityQueue.push(item); }
function openActivity() {
  if (activeNotice?.passive) return;
  const tab = activeNotice?.tab, settingsPage = activeNotice?.settings; activityQueue.clear();
  if (settingsPage) { notch.openSystemSettings(settingsPage); return; }
  if (tab) openNotch(tab);
}
notch.onSystemAction((event) => {
  if (preferences.systemFeedback === false) return;
  // Passive: the user already did the thing with a key. Showing them a
  // button that opens Windows Settings turns an acknowledgement into an
  // interruption they have to dismiss.
  const base = { id: 'hardware:' + event.action, coalesceKey: 'hardware', replace: true, priority: 70,
    passive: true, duration: 1700, expiresAt: Date.now() + 2200 };
  if (event.action === 'volume' && Number.isFinite(event.value)) postActivity({ ...base,
    kind: event.muted ? 'muted' : 'volume', title: event.muted ? 'Muted' : event.value === 0 ? 'Volume off' : 'Volume',
    detail: event.value + '%', progress: event.muted ? 0 : event.value });
  if (event.action === 'brightness' && Number.isFinite(event.value)) postActivity({ ...base,
    kind: 'brightness', title: 'Display brightness', detail: event.value + '%', progress: event.value });
  if (event.action === 'capslock' && typeof event.enabled === 'boolean') postActivity({ ...base,
    kind: 'capslock', title: 'Caps Lock', detail: event.enabled ? 'On · Capital letters' : 'Off · Lowercase letters' });
});
document.getElementById('notice-open').addEventListener('click', openActivity);
document.getElementById('activity-inline').addEventListener('click', openActivity);
document.getElementById('notice-dismiss').addEventListener('click', () => activityQueue.clear());
const noticeLayer = document.querySelector('.layer-notice');
noticeLayer.addEventListener('mouseenter', () => activityQueue.pause());
noticeLayer.addEventListener('mouseleave', () => { if (!noticeLayer.contains(document.activeElement)) activityQueue.resume(); });
noticeLayer.addEventListener('focusin', () => activityQueue.pause());
noticeLayer.addEventListener('focusout', (event) => { if (!noticeLayer.contains(event.relatedTarget) && !noticeLayer.matches(':hover')) activityQueue.resume(); });

function cyclePage(direction) {
  if (state !== 'open' || exploring || dragDepth || transferActive) return;
  const order = NotchModules.visible(preferences), at = order.indexOf(activeTab);
  const next = at < 0 ? order[direction > 0 ? 0 : order.length - 1] : order[(at + direction + order.length) % order.length];
  document.body.dataset.pageDirection = direction > 0 ? 'next' : 'previous';
  setTab(next);
}

async function chooseFiles() {
  if (choosingFiles || transferActive) return;
  choosingFiles = true; document.getElementById('choose-files').disabled = true;
  try {
    const result = await notch.chooseFiles();
    if (result.added) { openNotch('send'); postActivity({ id: 'chosen:' + Date.now(), kind: 'success', title: result.added + (result.added === 1 ? ' file parked' : ' files parked'), tab: 'send', priority: 30, duration: 1800 }); }
    if (result.rejected?.length) showStatus(result.rejected[0].reason, null, 'error');
  } catch { showStatus('Cannot open these files. Try again.', null, 'error'); }
  finally { choosingFiles = false; document.getElementById('choose-files').disabled = false; }
}
document.getElementById('choose-files').addEventListener('click', chooseFiles);

document.getElementById('paste-text').addEventListener('click', async () => {
  const result = await notch.addText();
  focusSendTab();
  if (result.added) flashFooter('Text parked. Choose a device.');
  else showStatus(result.rejected[0]?.reason || 'Nothing to paste', null, 'error');
});

function collapseNotch() {
  activityQueue.resume();
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
  if (!preferences.autoDismiss || pinned || dragDepth > 0 || choosingFiles) return;
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
  refreshIdle();
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
document.addEventListener('notch:layout', (event) => {
  if (!exploring && event.target.matches('.panel.is-active')) updateGeometry();
});

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
  refreshIdle();
  els.shelfCount.textContent = count ? 'File shelf · ' + count : 'File shelf';
  els.peekShelf.textContent = count ? count + ' files ready' : 'Ready to share';
  els.closedCount.textContent = count ? count : '';
  els.closedCount.hidden = count === 0;
  els.shelf.classList.toggle('is-empty', count === 0);
  els.clear.hidden = count === 0;

  if (!count) {
    // NotchFilesView uses one quiet tray inside a dashed drop surface.
    const hint = document.createElement('div');
    hint.className = 'drop-empty';
    const symbol = document.createElement('span');
    symbol.className = 'drop-symbol'; symbol.setAttribute('aria-hidden', 'true');
    symbol.append(icon('<path d="M12 3v11m-4-4 4 4 4-4M4 12l-2 7h20l-2-7M2 19v3h20v-3"/>'));
    const title = document.createElement('span');
    title.className = 'drop-title';
    title.textContent = 'Drop files here';
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
    node.dataset.kind = item.kind === 'folder' ? 'folder' : item.kind === 'text' ? 'text'
      : /^(png|jpg|jpeg|gif|webp|heic|svg)$/.test(extension) ? 'image'
        : /^(zip|rar|7z|tar|gz)$/.test(extension) ? 'archive'
          : /^(mp4|mov|mkv|webm)$/.test(extension) ? 'video' : extension === 'pdf' ? 'pdf' : 'file';

    const ext = document.createElement('div');
    ext.className = 'file-icon';
    ext.textContent = item.kind === 'folder' ? '' : item.kind === 'text' ? 'TXT'
      : (extension || 'FILE').slice(0, 5).toUpperCase();
    if (item.kind === 'folder') ext.append(icon('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'));

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = item.kind === 'text' && item.preview ? item.preview : item.name;
    if (item.kind === 'text' && item.preview) node.title = item.preview;

    const size = document.createElement('div');
    size.className = 'size';
    // A folder's weight is useless without knowing how much is in it.
    size.textContent = item.kind === 'folder'
      ? item.count.toLocaleString() + (item.count === 1 ? ' file' : ' files') + (item.truncated ? '+' : '') + ' · ' + formatBytes(item.size)
      : formatBytes(item.size);

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
  updateModulePager();
  deviceList = list || [];
  els.devices.replaceChildren();

  if (!deviceList.length) {
    const hint = document.createElement('div');
    hint.className = 'device-empty';
    const badge = document.createElement('span');
    badge.className = 'device-badge is-searching';
    badge.append(icon('<path d="M8.5 15.5a5 5 0 0 1 7 0M5 12a10 10 0 0 1 14 0M1.5 8.5a15 15 0 0 1 21 0"/><circle cx="12" cy="19" r="1"/>'));
    hint.append(badge);
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
      document.body.classList.add('aiming-device');
    });
    chip.addEventListener('dragleave', () => { chip.classList.remove('drop-target'); document.body.classList.remove('aiming-device'); });
    chip.addEventListener('drop', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (transferActive) return;
      chip.classList.remove('drop-target');
      document.body.classList.remove('aiming-device');
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
  document.body.classList.add('transfer-active', 'transfer-waiting');
  card.style.setProperty('--transfer-progress', '.04');
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
      const target = deviceList.find((d) => d.fingerprint === fingerprint);
      postActivity({ id: 'sent:' + Date.now(), title: 'Transfer complete', detail: target ? 'Delivered to ' + target.alias : parts.join(' · '), tab: 'send', kind: 'success', priority: 80 });
    } else if (result.kind === 'pin') {
      showPin(fingerprint);
    } else {
      showStatus(result.message, 0, 'error');
    }
  } catch (error) {
    showStatus(error.message || 'Transfer failed. Try again.', 0, 'error');
  } finally {
    transferActive = false;
    document.body.classList.remove('transfer-active', 'transfer-waiting');
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

const FOCUS_TAB = { transfer: 'send', agent: 'ai', timer: 'timer', music: 'media' };

els.closedTrigger.addEventListener('click', () => {
  // Open whatever the notch is currently showing, so the click lands where
  // the user is looking rather than on a fixed guess.
  openNotch(FOCUS_TAB[document.body.dataset.focus] || (shelfItems.length ? 'send' : activeTab));
});

// Several things live at once: the right button steps between them. The left
// button keeps opening the panel, which is the gesture people already know.
card.addEventListener('contextmenu', (event) => {
  if (event.target.closest('input, textarea')) return;
  event.preventDefault();
  notch.contextMenu(pinned);
});
card.addEventListener('keydown', (event) => {
  if (event.key === 'F10' && event.shiftKey) { event.preventDefault(); notch.contextMenu(pinned); }
  if (event.key === ',' && event.ctrlKey) { event.preventDefault(); notch.openSettings(); }
});
notch.onMenuAction((action) => {
  if (action === 'pin') setPinned(!pinned);
  if (action === 'next-activity') cycleFocus();
  if (action === 'explore') { openNotch(); setExploring(true); }
  if (action === 'collapse') { setPinned(false); activityQueue.clear(); collapseNotch(); }
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
  activityQueue.clear();
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
  if (state === 'open' && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o' && !event.target.closest('input, textarea')) { event.preventDefault(); chooseFiles(); return; }
  if (state === 'open' && event.altKey && !event.ctrlKey && !event.metaKey && (!event.target.closest('input, textarea, select') || event.target === els.exploreSearch)) {
    if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); cyclePage(event.key === 'ArrowRight' ? 1 : -1); return; }
    const index = Number(event.key) - 1;
    if (index >= 0 && index < 8) { event.preventDefault(); setTab(index === 7 ? 'settings' : PAGE_ORDER[index]); return; }
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && activeTab === 'clipboard' && state === 'open') {
    event.preventDefault();
    ClipboardPanel.focusSearch();
  }
  if (event.key === 'Escape') {
    if (exploring) { setTab(activeTab); return; }
    setPinned(false);
    activityQueue.clear();
    collapseNotch();
  }
});

// Gestures stay on the shell; scrolling file and clipboard content still works.
card.addEventListener('wheel', (event) => {
  if (!preferences.gestures || event.ctrlKey || event.metaKey || exploring) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
  const control = !!event.target.closest('button:not(#closed-trigger), input, textarea, select');
  if (state === 'open' && !control && event.target.closest('.notch-header, .panel-footer')) {
    const direction = pageSwipe.wheel(event.deltaX * unit, event.deltaY * unit, Date.now());
    if (direction) { event.preventDefault(); cyclePage(direction); return; }
  }
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
  updateModulePager();
  focusSendTab(); // dropping a file is a send-tab action, whatever is showing
  clearTimeout(collapseTimer);
  document.body.classList.add('dragging');
  setState('open');
});

document.addEventListener('dragover', (event) => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  if (dragDepth) {
    card.style.setProperty('--drop-x', Math.max(-2, Math.min(2, (event.clientX - innerWidth / 2) / 70)) + 'px');
    card.style.setProperty('--drop-y', Math.max(-2, Math.min(2, (event.clientY - 160) / 70)) + 'px');
  }
});

document.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    document.body.classList.remove('dragging');
    document.body.classList.remove('aiming-device');
    updateModulePager();
    openedByClick = pinnedBeforeDrag;
    scheduleCollapse(600);
  }
});

document.addEventListener('drop', async (event) => {
  event.preventDefault();
  if (!event.dataTransfer?.types.includes('Files')) return;
  dragDepth = 0;
  updateModulePager();
  document.body.classList.remove('dragging');
  openedByClick = true;
  notch.focus();
  const added = await intake(event.dataTransfer);
  if (added) {
    showStatus(added + (added === 1 ? ' file parked. Choose a device.' : ' files parked. Choose a device.'), null, 'done');
    document.body.classList.add('drop-complete');
    setTimeout(() => document.body.classList.remove('drop-complete'), 650);
    postActivity({ id: 'park:' + Date.now(), title: added + (added === 1 ? ' file parked' : ' files parked'), detail: 'Ready whenever you are.', tab: 'send', kind: 'success', priority: 30, duration: 1800 });
  }
});

notch.onDevices(renderDevices);
notch.onShelf(renderShelf);

notch.onTransfer((p) => {
  if (p.phase === 'waiting') {
    document.body.classList.add('transfer-waiting');
    showStatus('Waiting for ' + p.alias + ' to accept…', 0);
  } else if (p.phase === 'sending') {
    document.body.classList.remove('transfer-waiting');
    const ratio = p.totalBytes ? p.sentBytes / p.totalBytes : 0;
    card.style.setProperty('--transfer-progress', String(Math.max(0, Math.min(1, ratio))));
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
      // Source NotchMusicService averages the cover into one sRGB pixel.
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      try {
        const context = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'medium';
        context.drawImage(img, 0, 0, 1, 1);
        setMusicTint(ArtworkPalette.paletteFrom(context.getImageData(0, 0, 1, 1).data));
      } catch {
        setMusicTint(null);
      }
    };
    img.onerror = () => {
      host.classList.remove('has-art');
      if (host !== els.npArt) return;
      setMusicTint(null);
    };
    if (img.getAttribute('src') !== dataUri) { if (host === els.npArt) setMusicTint(null); img.src = dataUri; }
    host.classList.add('has-art');
  } else {
    img.removeAttribute('src');
    host.classList.remove('has-art');
    if (host === els.npArt) {
      setMusicTint(null);
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
  if (action === 'toggle') { playback.toggle(); return; }
  if (['source', 'next', 'prev'].includes(action)) playback.cancel();
  let queued = false;
  try { queued = await notch.mediaCommand(action, value); } catch { /* report below */ }
  if (!queued) {
    if (action === 'seek') seekPending = null;
    els.mediaFeedback.textContent = 'Cannot control this player. Try again.';
  } else {
    els.mediaFeedback.textContent = '';
  }
}

const playback = new MediaPlayback.Controller({ send: (action, value, context) => notch.mediaCommand(action, value, context),
  change: () => { media = playback.view(); renderNowPlaying(); }, error: text => { els.mediaFeedback.textContent = text; } });

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
  if (playback.result(result)) return;
  if (result.via !== 'none') return;
  seekPending = null;
  els.mediaFeedback.textContent = result.action === 'seek' ? 'This player declined the seek request.' : 'This player declined the playback command.';
});

notch.onNowPlaying((message) => {
  const previous = media;
  playback.receive(message);
  const newTrack = previous.title !== media.title || previous.artist !== media.artist || previous.app !== media.app;
  if (newTrack) { seekPending = null; els.mediaFeedback.textContent = ''; }
  if (preferences.musicPreview && !timerState.hasSession && media.active && media.playing && (newTrack || !previous.playing) && state === 'closed'
    && !dragDepth && !transferActive && !hoverSuppressed) {
    postActivity({ id: 'track:' + media.app + ':' + media.title, kind: 'music', title: media.title || 'Now playing', detail: media.artist || media.appLabel,
      tab: 'media', priority: 10, duration: 2400 });
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
  refreshIdle();
  els.peekAi.hidden = waiting + working === 0;
  els.peekAi.title = working + ' working · ' + waiting + ' waiting';
  els.peekAiCount.textContent = waiting + working > 1 ? String(waiting + working) : '';
  AiPanel.updateSessions(aiSessions);
  paintClosedAgent(now);
}

/**
 * While an agent is working the resting notch carries its provider and how
 * long it has been going, so the answer to "is it still thinking?" does not
 * require opening anything.
 */
function paintClosedAgent(now = Date.now()) {
  const running = AiState.sortSessions(aiSessions, now)
    .filter((session) => AiState.kindOf(session, now) === 'working')
    .sort((a, b) => (a.startedAt || now) - (b.startedAt || now))[0];
  els.closedAgent.hidden = !running || document.body.dataset.focus !== 'agent';
  if (!running) return;
  const provider = running.provider === 'codex' ? 'codex' : 'claude';
  if (els.closedAgent.dataset.agent !== provider) {
    els.closedAgent.querySelector('.agent-mark').replaceChildren(ProviderMarks.markElement(provider, document));
  }
  els.closedAgent.dataset.agent = provider;
  els.closedAgent.title = (provider === 'codex' ? 'Codex' : 'Claude') + ' · ' + running.name;
  const reading = AiPanel.closedReading(provider,now);
  els.closedAgent.dataset.readout = reading ? 'quota' : 'elapsed';
  if (reading) els.closedAgent.title += ' · ' + reading.label;
  els.closedAgentTime.textContent = reading?.text || (running.startedAt
    ? UtilityPanels.clock(Math.max(0, (now - running.startedAt) / 1000), true) : '');
}
document.addEventListener('ai:view-change', () => paintClosedAgent());

let aiDashboardReady = false;
notch.onAiDashboard((value) => {
  aiDashboardReady = true;
  aiSessions = AiPanel.update(value);
  renderAiSessions();
});
notch.onAiComplete((value) => {
  postActivity({ id: 'ai:' + Date.now(), kind: 'ai', title: 'Agent finished', detail: value.provider + ' · ' + value.name, tab: 'ai', priority: 50 });
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
  if (timerState.hasSession) els.peekShelf.textContent = timerState.cycleFinished ? 'Cycle complete' : timerState.completed ? 'Time is up' : UtilityPanels.phaseName[timerState.phase];
}

function renderTimer(value) {
  const wasActive = timerState.hasSession;
  const wasComplete = timerState.completed;
  timerState = value || { hasSession: false };
  if (wasComplete && !timerState.completed) activityQueue.remove('timer-complete');
  document.body.classList.toggle('has-timer', !!timerState.hasSession);
  refreshIdle();
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
  if (timerState.completed && !wasComplete) {
    const title = timerState.cycleFinished ? 'Cycle complete' : 'Time is up';
    els.closedTrigger.setAttribute('aria-label', title + '. Open timer');
    postActivity({ id: 'timer-complete', replace: true, kind: 'timer', title,
      detail: timerState.cycleFinished ? timerState.configuration.sessions + ' focus sessions completed' : UtilityPanels.phaseName[timerState.phase] + ' completed', tab: 'timer', priority: 100, duration: 3200 });
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
      return ok;
    },
    remove: (id) => notch.clipRemove(id),
    clear: () => notch.clipClear(true),
    pin: (id) => notch.clipPin(id),
    setPaused: (paused) => notch.clipPause(paused),
  });

  SystemPanel.mount(document.querySelector('.panel[data-panel="system"]'));
  UtilityPanels.mount({ timerCommand: notch.timerCommand, saveNote: notch.saveNote, cacheNote: notch.cacheNote,
    copyNote: notch.copyNote, updatePreferences: notch.updatePreferences });
  ScrollEdges.observe(document.querySelector('.clip-list'));
  ScrollEdges.observe(document.querySelector('.ai-scroll'));
  ScrollEdges.observe(els.shelf, 'horizontal');
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
  setExploring(false, false);
  activeTab = name;
  if (name !== 'clipboard') ClipboardPanel.closePreview();
  if (name !== 'ai') AiPanel.closeEditor();
  clearTimeout(feedbackTimer);
  els.footerHint.classList.remove('is-confirmed');
  document.body.dataset.tab = name;
  const titles = PAGE_NAMES;
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
  updateModulePager();
  if (name === 'media') requestAnimationFrame(() => { fitMarquee(els.npTitle); });
  if (state === 'open') updateGeometry();
}

els.tabs.setAttribute('role', 'menu');
for (const tab of els.tabs.querySelectorAll('.tab')) {
  const name = tab.dataset.tab;
  const shortcut = tab.querySelector('.module-caption');
  if (shortcut) shortcut.textContent = 'Alt ' + (name === 'settings' ? 8 : PAGE_ORDER.indexOf(name) + 1);
  tab.setAttribute('role', 'menuitemradio');
  tab.id = 'tab-' + name;
  tab.setAttribute('aria-controls', 'panel-' + name);
  const panel = document.querySelector('[data-panel="' + name + '"]');
  if (!panel) continue;
  panel.id = 'panel-' + name;
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', tab.id);
}
const modulePager = document.getElementById('page-dots');
modulePager.innerHTML = '<button type="button" id="module-previous" title="Previous module · Alt+Left" aria-label="Previous module"><svg viewBox="0 0 20 20"><path d="m12 5-5 5 5 5"/></svg></button><button type="button" class="module-index" id="module-index" aria-label="Choose a module">1 / 7</button><button type="button" id="module-next" title="Next module · Alt+Right" aria-label="Next module"><svg viewBox="0 0 20 20"><path d="m8 5 5 5-5 5"/></svg></button>';
document.getElementById('module-previous').addEventListener('click', () => cyclePage(-1));
document.getElementById('module-next').addEventListener('click', () => cyclePage(1));
document.getElementById('module-index').addEventListener('click', () => setExploring(true));
function updateModulePager() {
  const index = document.getElementById('module-index'); if (!index) return;
  index.textContent = (PAGE_ORDER.indexOf(activeTab) + 1) + ' / ' + PAGE_ORDER.length;
  index.setAttribute('aria-label', PAGE_NAMES[activeTab] + '. Choose a module');
  for (const button of modulePager.querySelectorAll('button')) button.disabled = transferActive || dragDepth > 0;
  document.getElementById('choose-files').disabled = transferActive || choosingFiles;
}
const header = document.querySelector('.notch-header');
let headerDrag = null;
header.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.target.closest('button, input, select') || exploring || transferActive) return;
  headerDrag = { x: event.clientX, y: event.clientY, id: event.pointerId }; header.dataset.dragging = 'true';
  try { header.setPointerCapture(event.pointerId); } catch {}
});
header.addEventListener('pointermove', (event) => {
  if (!headerDrag || event.pointerId !== headerDrag.id) return;
  header.style.setProperty('--page-pull', Math.max(-12, Math.min(12, (event.clientX - headerDrag.x) * .15)) + 'px');
});
function finishHeaderSwipe(event) {
  if (!headerDrag || event.pointerId !== headerDrag.id) return;
  const x = event.clientX - headerDrag.x, y = event.clientY - headerDrag.y;
  headerDrag = null; delete header.dataset.dragging; header.style.removeProperty('--page-pull');
  if (event.type !== 'pointercancel' && Math.abs(x) > 60 && Math.abs(x) > Math.abs(y) * 1.4) cyclePage(x < 0 ? 1 : -1);
}
header.addEventListener('pointerup', finishHeaderSwipe); header.addEventListener('pointercancel', finishHeaderSwipe);
header.addEventListener('lostpointercapture', () => { headerDrag = null; delete header.dataset.dragging; header.style.removeProperty('--page-pull'); });
const galleryRail = document.createElement('div'); galleryRail.id = 'gallery-rail'; galleryRail.setAttribute('aria-label', 'Module rows');
document.querySelector('.notch-header').append(document.getElementById('page-dots'));
els.tabs.after(galleryRail);
function updateGalleryRail() {
  const positions = Math.max(1, Math.ceil(els.tabs.querySelectorAll('.tab:not([hidden])').length / 4) - 1);
  galleryRail.replaceChildren();
  for (let i = 0; i < positions; i++) {
    const button = document.createElement('button'); button.type = 'button'; button.setAttribute('aria-label', 'Module row ' + (i + 1));
    button.setAttribute('aria-pressed', String(Math.round(els.tabs.scrollTop / 94) === i));
    button.addEventListener('click', () => els.tabs.scrollTo({ top: i * 94, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
    galleryRail.append(button);
  }
}
els.tabs.addEventListener('scroll', () => { galleryRail.querySelectorAll('button').forEach((button, i) => button.setAttribute('aria-pressed', String(Math.round(els.tabs.scrollTop / 94) === i))); }, { passive: true });
els.tabs.addEventListener('keydown', (event) => {
  const tabs = [...els.tabs.querySelectorAll('.tab:not([hidden])')];
  const index = tabs.indexOf(document.activeElement);
  if (index < 0 || !['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowDown' ? 4 : -4) + tabs.length) % tabs.length;
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
  setInterval(() => { if (!els.closedAgent.hidden) paintClosedAgent(); }, 1000);

  mountModulePanels();
  setTab('send');

  const initial = await notch.init();
  renderShelf(initial.shelf);
  renderDevices(initial.devices);
  playback.reset(initial.nowPlaying || MediaState.EMPTY);
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
