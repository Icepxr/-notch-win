'use strict';

// Run with Electron, without starting production discovery or reading user data.
// Offscreen Chromium exercises the real renderer, preload boundary and resizes.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const geometry = require('../src/renderer/notch-geometry');
const appearance = require('../src/renderer/notch-appearance');
const modules = require('../src/renderer/notch-modules');
const { NotchTimer } = require('../src/timer');

const output = path.join(__dirname, '..', 'docs', 'previews');
const profile = path.join(__dirname, '..', '.tmp', 'renderer-profile');
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.disableHardwareAcceleration();

const files = [
  { id: '1', name: 'Project notes.pdf', ext: 'pdf', size: 2457600, path: 'C:\\Demo\\Project notes.pdf' },
  { id: '2', name: 'Holiday.heic', ext: 'heic', size: 4194304, path: 'C:\\Demo\\Holiday.heic' },
  { id: '3', name: 'Design assets.zip', ext: 'zip', size: 12582912, path: 'C:\\Demo\\Design assets.zip' },
];
const devices = [{ fingerprint: 'demo', alias: 'My iPad', deviceModel: 'iPad Pro', deviceType: 'mobile', address: '192.0.2.10' }];
const fixtureArt = 'data:image/png;base64,' + require('../src/png').trayIconPNG(128).toString('base64');
let sendResult = { ok: true, sent: 3 };
const mediaCommands = [];
let win;
const panelState = () => ({ preferences: fixturePreferences, displayState: fixtureDisplayState,
  acrylic: true, about: { version: '0.1.0', electron: process.versions.electron, alias: 'Demo PC Notch' } });
const fixtureTimer = new NotchTimer();
let fixtureNote = '';
let fixturePreferences = { autoDismiss: true, gestures: true, musicPreview: true, silhouette: 'notch', glass: 'high', displayId: 1 };
let fixtureDisplayState = { mode: 'selected', activeDisplayId: 1, preferredDisplayId: 1, missing: false,
  displays: [{ id: 1, label: 'Laptop display', primary: true, scaleFactor: 1.25 }, { id: 2, label: 'Studio display', primary: false, scaleFactor: 1.5 }] };
let panelWin;
let settingsOpened = 0;
let filePickerOpened = 0;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const js = (source) => win.webContents.executeJavaScript(source);
// The control panel is its own window, so it gets its own evaluator.
const pjs = (source) => panelWin.webContents.executeJavaScript(source);
const emit = (name, value) => win.webContents.send('fixture:' + name, value);
const errors = [];
let checks = 0;
let reservedHostWidth = geometry.hostSize.width;
let rejectPreferences = false;
let connectedClaude = 0;
let openedSystemSettings = null;
let stableHostViewport;
function check(value, message) { assert.ok(value, message); checks++; console.log('  ok  ' + message); }
async function settled() { await delay(780); }
/**
 * Measured, not assumed: capture the real pixels an element renders to and
 * read the contrast back out of them. Light text on a dark surface puts the
 * glyph cores at the bright end of the histogram and the surface at the dark
 * end, so the high and low percentiles are the two colours WCAG compares.
 * This is the only way to check contrast through translucency and a blurred
 * album cover, where no computed style tells you the real backdrop.
 */
function luminance(r, g, b) {
  const channel = (value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

async function meanLuminanceOf(selector) {
  const rect = await js(`(() => { const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null; const r = el.getBoundingClientRect();
    return { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height) }; })()`);
  if (!rect || rect.width < 2 || rect.height < 2) return null;
  const bitmap = (await win.webContents.capturePage(rect)).toBitmap();
  let total = 0;
  for (let i = 0; i < bitmap.length; i += 4) total += luminance(bitmap[i + 2], bitmap[i + 1], bitmap[i]);
  return total / (bitmap.length / 4);
}

async function contrastOf(selector) {
  const rect = await js(`(() => { const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null; const r = el.getBoundingClientRect();
    return { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height) }; })()`);
  if (!rect || rect.width < 2 || rect.height < 2) return null;
  const bitmap = (await win.webContents.capturePage(rect)).toBitmap();
  const levels = [];
  for (let i = 0; i < bitmap.length; i += 4) levels.push(luminance(bitmap[i + 2], bitmap[i + 1], bitmap[i]));
  levels.sort((a, b) => a - b);
  const at = (q) => levels[Math.min(levels.length - 1, Math.floor(levels.length * q))];
  const text = at(0.97);
  const background = at(0.2);
  return Math.round(((Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05)) * 100) / 100;
}

function solidCover([r, g, b], size = 64) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < rgba.length; i += 4) { rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255; }
  return require('../src/png').encodePNG(size, size, rgba);
}

/** The control panel opens later in the run; skip quietly until it does. */
async function pjsOrSkip(source) {
  if (!panelWin || panelWin.isDestroyed()) return null;
  return pjs(source);
}

async function cssColor(token, selector = ":root") {
  const value = await js(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).getPropertyValue(${JSON.stringify(token)}).trim()`);
  const rgb = value.match(/\d+/g);
  if (value.startsWith('#')) {
    const parts = value.slice(1).match(/../g).map((p) => parseInt(p, 16));
    return parts.join(',');
  }
  return rgb ? rgb.slice(0, 3).join(',') : value;
}

async function panelSnapshot(name) {
  fs.mkdirSync(output, { recursive: true });
  const shot = await panelWin.webContents.capturePage();
  fs.writeFileSync(path.join(output, name + '.png'), shot.toPNG());
}
async function snapshot(name) {
  fs.mkdirSync(output, { recursive: true });
  const rect = await js(`(() => { const r = card.getBoundingClientRect(); return { x: Math.max(0, Math.floor(r.x - 20)), y: 0, width: Math.ceil(r.width + 40), height: Math.ceil(r.height + 32) }; })()`);
  const shot = await win.webContents.capturePage(rect);
  fs.writeFileSync(path.join(output, name + '.png'), shot.toPNG());
}
async function layout() {
  return js(`(() => {
    const card = document.getElementById('card').getBoundingClientRect();
    const panel = document.querySelector('.panel.is-active');
    const footer = document.querySelector('.panel-footer').getBoundingClientRect();
    return { width: card.width, height: card.height, x: card.x, bottom: card.bottom,
      viewport: [innerWidth, innerHeight], panelOverflow: panel.scrollHeight - panel.clientHeight,
      footerBottom: footer.bottom, state: document.body.className,
      activeTab: document.body.dataset.tab };
  })()`);
}

app.whenReady().then(async () => {
  ipcMain.handle('fixture:init', () => ({ shelf: [], devices: [], aiSessions: [], clipboard: [],
    timer: fixtureTimer.snapshot(), note: fixtureNote, preferences: fixturePreferences, displays: fixtureDisplayState.displays, displayState: fixtureDisplayState }));
  ipcMain.handle('fixture:size', (_event, size) => { win.setBounds({ ...win.getBounds(), ...size }); });
  ipcMain.handle('fixture:send', () => sendResult);
  ipcMain.handle('fixture:choose-files', () => { filePickerOpened++; return { added: 1, rejected: [] }; });
  ipcMain.handle('fixture:media', (_event, command) => { mediaCommands.push(command); return true; });
  ipcMain.handle('fixture:clip-pick', () => true);
  ipcMain.handle('fixture:ai-refresh', () => null);
  ipcMain.handle('fixture:context-menu', () => true);
  ipcMain.handle('fixture:panel-open-module', (_event, tab) => { emit('navigate', tab); return true; });
  ipcMain.handle('fixture:claude-signin', () => { connectedClaude++; return { ok: true }; });
  ipcMain.handle('fixture:system-settings', (_event, page) => { openedSystemSettings = page; return true; });
  ipcMain.handle('fixture:timer', (_event, command) => {
    const state = fixtureTimer.command(command.action, command.options); emit('timer', state); return state;
  });
  ipcMain.handle('fixture:note', (_event, value) => { fixtureNote = value; return true; });
  ipcMain.handle('fixture:preferences', (_event, value) => {
    if (rejectPreferences) return { ok: false, ...panelState() };
    fixturePreferences = { ...fixturePreferences, ...value, ...appearance.normalize({ ...fixturePreferences, ...value }), ...modules.normalize({ ...fixturePreferences, ...value }) };
    reservedHostWidth = Math.max(reservedHostWidth, geometry.hostFor(fixturePreferences).width);
    const zoom = fixturePreferences.notchScale / 100;
    win.setSize(Math.ceil(reservedHostWidth * zoom), Math.ceil(geometry.hostSize.height * zoom));
    win.webContents.setZoomFactor(zoom);
    fixtureDisplayState = { ...fixtureDisplayState, mode: fixturePreferences.displayMode || 'selected', activeDisplayId: fixturePreferences.displayId, preferredDisplayId: fixturePreferences.displayId };
    const result = { ok: true, preferences: fixturePreferences, displayState: fixtureDisplayState };
    // Main broadcasts every change to both windows; the fixture has to as well,
    // or the notch would never hear about a setting changed in the panel.
    if (win && !win.isDestroyed()) win.webContents.send('fixture:preferences', result);
    if (panelWin && !panelWin.isDestroyed()) panelWin.webContents.send('fixture:panel-state', panelState());
    return result;
  });
  ipcMain.handle('fixture:panel-init', () => panelState());
  ipcMain.on('fixture:open-settings', () => { settingsOpened += 1; });
  win = new BrowserWindow({
    ...geometry.hostSize, show: false, frame: false,
    transparent: true, backgroundColor: '#00000000', resizable: false,
    webPreferences: { preload: path.join(__dirname, 'fixtures', 'notch-preload.js'),
      offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  win.webContents.on('console-message', (_event, ...args) => {
    const message = _event.message || args[1];
    if (_event.level === 'error' || args[0] === 3) errors.push(message);
  });
  try {
    await win.webContents.session.clearStorageData({ storages: ['localstorage'] });
    const region = { x: 20, y: 0, width: 184, height: 28, radius: 16 };
    check(geometry.contains(region, 112, 14) && !geometry.contains(region, 8, 14)
      && !geometry.contains(region, 21, 27), 'hit testing accepts the notch and excludes transparent shoulders and rounded corners');
    await win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
    await settled();
    let box = await layout();
    stableHostViewport = box.viewport;
    check(box.width === 184 && box.height === 28, 'closed notch uses shared geometry');
    // With nothing playing, parked or running, the notch is meant to be
    // indistinguishable from the bezel.
    check(await js(`(() => {
      if (!document.body.classList.contains('is-idle')) return false;
      const arrow = document.querySelector('.layer-closed > svg');
      const sensor = document.querySelector('.notch-sensor');
      return getComputedStyle(arrow).display === 'none'
        && getComputedStyle(sensor).backgroundColor === 'rgba(0, 0, 0, 0)';
    })()`), 'an idle notch paints no symbol at all');
    await snapshot('closed');

    // A working agent is the one thing worth showing on a resting notch:
    // which agent, and how long it has been going.
    emit('ai', [{ pid: 4242, name: 'Refactoring the shelf', folder: 'Islet', cwd: 'C:\Demo',
      provider: 'claude', status: 'busy', statusUpdatedAt: Date.now() - 95000, startedAt: Date.now() - 95000 }]);
    await settled();
    const agent = await js(`(() => {
      const el = document.getElementById('closed-agent');
      return { hidden: el.hidden, provider: el.dataset.agent, time: document.getElementById('closed-agent-time').textContent,
        shown: getComputedStyle(el).display !== 'none', idle: document.body.classList.contains('is-idle') };
    })()`);
    check(!agent.hidden && agent.shown && agent.provider === 'claude' && /^\d+:\d\d$/.test(agent.time) && !agent.idle,
      'a working agent shows its provider and running time on the resting notch (' + agent.time + ')');
    await snapshot('closed-agent');
    // Two things live at once used to mean two things drawn on top of each
    // other. Exactly one gets the notch, and the user can choose which.
    emit('now-playing', { type: 'state', session: true, title: 'A Quiet Morning', artist: 'Local artist',
      app: 'Spotify.exe', status: 'Playing', duration: 240, position: 12, thumb: fixtureArt,
      canPause: true, canNext: true, canPrev: true, canSeek: true, sources: ['Spotify.exe'] });
    await settled();
    check(await js(`JSON.stringify(liveActivities()) === '["music","agent"]' && document.body.dataset.focus === 'music'
      && document.getElementById('closed-agent').hidden
      && document.body.classList.contains('multi-activity')`),
      'with music and an agent both live the notch shows one of them, not both');

    // Hovering offers the choice: one mark per live activity, and picking one
    // switches what the notch is showing.
    await js(`pointerEntered()`); await settled();
    check(await js(`(() => {
      const picker = document.getElementById('focus-picker');
      if (picker.hidden || getComputedStyle(picker).display === 'none') return false;
      const names = [...picker.querySelectorAll('.focus-option')].map((b) => b.dataset.activity);
      return names.join(',') === 'music,agent'
        && picker.querySelector('[data-activity="music"]').getAttribute('aria-pressed') === 'true';
    })()`), 'hovering a busy notch offers one mark per live activity');

    await js(`document.querySelector('.focus-option[data-activity="agent"]').click()`);
    await delay(220);
    check(await js(`document.body.dataset.focus === 'agent'
      && document.querySelector('.focus-option[data-activity="agent"]').getAttribute('aria-pressed') === 'true'`),
      'picking an activity switches what the notch shows');
    await snapshot('focus-picker');
    await js(`collapseNotch()`); await settled();

    await pjsOrSkip(`{ const select = document.querySelector('[data-preference="notchFocus"]'); select.value = 'agent'; select.dispatchEvent(new Event('change')); }`);
    emit('now-playing', { type: 'state', session: false });
    await settled();
    emit('ai', []);
    await settled();
    check(await js(`document.getElementById('closed-agent').hidden && document.body.classList.contains('is-idle')
      && !document.body.classList.contains('multi-activity')`),
      'the notch goes quiet again when the agent finishes');

    await js(`document.getElementById('closed-trigger').click()`);
    await settled();
    box = await layout();
    check(box.width === 520 && box.height === 350, 'file shelf opens at a compact content height');
    check(box.viewport.every((value, i) => value === stableHostViewport[i]) && Math.abs(box.viewport[0] - geometry.hostSize.width) <= 1 && Math.abs(box.viewport[1] - geometry.hostSize.height) <= 1, 'Windows backing surface stays reserved for every state and spring overshoot (within one DIP of mixed-DPI rounding)');
    check(box.panelOverflow <= 1 && box.footerBottom < box.bottom, 'empty send panel fits without clipping');
    // The shelf clips its own overflow, so a caption can disappear inside it
    // while the panel around it still measures clean.
    check(await js(`(() => {
      const shelf = document.querySelector('.shelf');
      const caption = document.querySelector('.drop-caption');
      if (!shelf || !caption) return false;
      return Math.round(caption.getBoundingClientRect().bottom) <= Math.round(shelf.getBoundingClientRect().bottom);
    })()`), 'the empty shelf shows its whole invitation, captions included');
    await snapshot('send-empty');
    await js(`pointerInside = true`);
    await js(`els.explore.click()`); await settled();
    check(await js(`document.body.classList.contains('is-exploring') && getComputedStyle(els.tabs).display === 'grid'`), 'Explore opens the module gallery');
    await delay(300); // module colours fade in; let them land before capturing
    // Eight grey glyphs make the user read eight captions; colour is faster.
    const moduleHues = await js(`[...document.querySelectorAll('.tabs .tab')]
      .map((t) => getComputedStyle(t.querySelector('svg')).color)`);
    const saturation = moduleHues.map((c) => {
      const [r, g, b] = c.match(/\d+/g).map(Number);
      return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    });
    check(new Set(moduleHues).size === moduleHues.length && Math.min(...saturation) > 0.2,
      'every module icon carries its own saturated hue (lowest '
      + Math.min(...saturation).toFixed(2) + ')');
    await snapshot('explore');
    check(await js(`Math.round(document.querySelector('.tab').getBoundingClientRect().height) === 86 && getComputedStyle(els.tabs).gridTemplateColumns.split(' ').length === 4`), 'source-sized gallery places existing modules in four columns');
    check(await js(`els.tabs.scrollHeight <= els.tabs.clientHeight + 1`), 'both complete gallery rows remain visible without cutting tiles');
    await snapshot('explore-more');
    await js(`els.exploreSearch.value = 'Timer'; els.exploreSearch.dispatchEvent(new Event('input'));`);
    check(await js(`els.tabs.querySelectorAll('.tab:not([hidden])').length === 1`), 'module gallery search filters available destinations');
    await js(`setTab('send')`);

    emit('shelf', files); emit('devices', devices);
    await delay(80);
    check(await js(`document.querySelectorAll('.item').length === 3 && document.querySelector('.glyph svg') !== null`), 'file cards and vector device icons render');
    await snapshot('send-ready');

    await js(`document.querySelector('.device').click()`);
    await delay(80);
    check(await js(`document.getElementById('status').classList.contains('is-done')`), 'successful send shows confirmation: ' + await js(`els.statusText.textContent`));
    check((await layout()).panelOverflow <= 1, 'success feedback fits with the files and destination');
    await snapshot('send-success');

    sendResult = { ok: false, kind: 'pin' };
    await js(`document.querySelector('.device').click()`);
    await delay(80);
    check(await js(`!document.getElementById('pin-form').hidden && document.activeElement.id === 'pin-input'`), 'PIN request remains visible and receives keyboard focus');
    check((await layout()).panelOverflow <= 1, 'PIN form fits without scrolling away the section heading');
    await snapshot('send-pin');
    sendResult = { ok: false, kind: 'network', message: 'Cannot connect. Try again.' };
    await js(`document.querySelector('.device').click()`);
    await delay(80);
    check(await js(`document.getElementById('status').classList.contains('is-error') && !document.querySelector('.device').disabled`), 'failed sends restore the device action');
    await js(`hidePin(); els.status.hidden = true;`);

    emit('dismiss'); await settled();
    check((await layout()).state.includes('state-closed'), 'clicking outside dismisses an ordinary opened notch');
    await js(`openNotch('send'); document.getElementById('keep-open').click()`);
    await settled(); emit('dismiss'); await delay(80);
    check((await layout()).state.includes('state-open'), 'Keep open protects the notch from outside-click dismissal');
    await js(`document.getElementById('keep-open').click()`);
    emit('dismiss'); await settled();
    check((await layout()).state.includes('state-closed'), 'unpinning restores outside-click dismissal');
    await js(`openNotch('send')`); await settled();
    let finishTransfer;
    sendResult = new Promise((resolve) => { finishTransfer = resolve; });
    await js(`document.querySelector('.device').click()`); await delay(80);
    emit('dismiss'); await delay(80);
    check((await layout()).state.includes('state-open'), 'an outside click does not interrupt an active transfer');
    await js(`pointerInside = false`);
    finishTransfer({ ok: true, sent: 3 });
    await delay(2450);
    check((await layout()).state.includes('state-closed'), 'a completed transfer confirms success before returning to compact mode');
    sendResult = { ok: true, sent: 3 };
    await js(`openNotch('send'); pointerInside = true`); await settled();

    for (const name of ['media', 'clipboard', 'system', 'ai']) {
      await js(`els.explore.click(); document.querySelector('.tab[data-tab="${name}"]').click()`);
      await delay(300);
      check(await js(`document.querySelector('[data-panel="${name}"]').classList.contains('is-active') && document.querySelectorAll('[role="menuitemradio"][aria-checked="true"]').length === 1`), name + ' module is selectable with one active accessible panel');
    }
    for (const name of ['send', 'media', 'clipboard', 'system', 'ai', 'timer', 'notes']) {
      await js(`setTab('${name}')`);
      check(await js(`!/[\u0e00-\u0e7f]/.test(document.querySelector('.layer-open').innerText)`), name + ' module uses English interface text');
    }
    await js(`els.explore.click(); document.querySelector('.tab[data-tab="ai"]').focus(); els.tabs.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));`);
    check(await js(`document.activeElement.id === 'tab-send'`), 'gallery keyboard navigation moves focus to the first destination');
    await js(`document.activeElement.click()`);
    await js(`setTab('send'); document.getElementById('module-next').click()`); await settled();
    check((await layout()).activeTab === 'media' && (await layout()).height === 260, 'module buttons switch to the fuller music player');
    await js(`card.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true }))`); await settled();
    check((await layout()).activeTab === 'send', 'Alt+Arrow is an accessible alternative to module swipes');

    // Alt+N used to walk a fixed list while everything else walked the user's
    // own order, so reordering or hiding a module made the key - and the
    // caption printed on the tile - open the wrong page.
    await js(`applyPreferences({ ...preferences, moduleOrder: ['notes', 'media', 'send'], hiddenModules: ['clipboard'] })`); await settled();
    await js(`card.dispatchEvent(new KeyboardEvent('keydown', { key: '1', altKey: true, bubbles: true }))`); await settled();
    check((await layout()).activeTab === 'notes', 'Alt+1 opens whatever the user put first');
    check(await js(`document.querySelector('.tab[data-tab="notes"] .module-caption').textContent === 'Alt 1'`),
      'and the caption on the tile says the same number');
    check(await js(`document.querySelector('.tab[data-tab="clipboard"] .module-caption').hidden`),
      'a hidden module advertises no key at all');
    check(await js(`document.querySelector('.tab[data-tab="send"] span').textContent === NotchModules.names.send`),
      'the tab is named by the module registry, not by a third copy in the markup');
    await js(`applyPreferences({ ...preferences, moduleOrder: [], hiddenModules: [] })`); await settled();
    await js(`setTab('send')`); await settled();
    await js(`document.querySelector('.notch-header').dispatchEvent(new WheelEvent('wheel', { deltaX: 65, deltaY: 0, bubbles: true, cancelable: true }))`); await settled();
    check((await layout()).activeTab === 'media', 'a horizontal trackpad gesture on the header switches modules');
    await js(`setTab('send'); document.querySelector('.notch-header').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 8, button: 0, clientX: 250, clientY: 20, bubbles: true })); document.querySelector('.notch-header').dispatchEvent(new PointerEvent('pointerup', { pointerId: 8, clientX: 150, clientY: 20, bubbles: true }));`); await settled();
    check((await layout()).activeTab === 'media', 'a deliberate header swipe changes pages without touching music controls');
    await js(`setTab('send'); document.getElementById('choose-files').click()`); await delay(100);
    check(filePickerOpened === 1 && await js(`activeNotice?.title === '1 item parked' && state === 'open'`), 'native file picker provides a click alternative to drag and drop');
    await js(`activityQueue.clear(); pointerInside = false; hoverSuppressed = false; collapseNotch()`); await settled();
    emit('ai-complete', { provider: 'codex', name: 'Demo task' }); await settled();
    check(await js(`state === 'peek' && activeNotice.kind === 'ai' && !openedByClick && document.getElementById('notice-title').textContent === 'Agent finished'`), 'agent completion appears as a brief notch activity without opening a page');
    await snapshot('notice-agent');
    // A hidden offscreen window does not dispatch native focus events.
    await js(`document.getElementById('notice-open').focus(); document.getElementById('notice-open').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));`);
    check(await js(`activityQueue.paused`), 'notification focus handler pauses expiry');
    await js(`document.getElementById('notice-open').click()`); await settled();
    check((await layout()).activeTab === 'ai' && (await layout()).state.includes('state-open'), 'clicking an activity opens its own module');
    await js(`postActivity({ id: 'quiet-test', kind: 'success', title: 'Files parked', tab: 'send', priority: 20 });`);
    check((await layout()).activeTab === 'ai' && await js(`!document.getElementById('activity-inline').hidden`), 'notifications keep the current page while the notch is open');
    await js(`postActivity({ id: 'pending-test', kind: 'music', title: 'Queued preview', tab: 'media', priority: 5 }); card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`); await settled();
    check(await js(`state === 'closed' && !activityQueue.current && activityQueue.pending.length === 0`), 'Escape clears queued previews so they cannot reopen a dismissed notch');

    // Collapsing with the pointer still over the notch leaves hover
    // suppressed, which used to swallow whatever arrived next: the notice
    // became current, was drawn nowhere, announced nowhere, and held the slot
    // for its full duration. An outcome the user is waiting for must outrank
    // that; chatter must not.
    await js(`activityQueue.clear(); collapseNotch(); hoverSuppressed = true;`); await settled();
    await js(`postActivity({ id: 'chatter', kind: 'music', title: 'Now playing', tab: 'media', priority: 10 })`); await settled();
    check(await js(`state === 'closed'`), 'a low-priority preview still respects a lingering pointer');
    await js(`activityQueue.clear(); collapseNotch(); hoverSuppressed = true;`); await settled();
    await js(`postActivity({ id: 'outcome', kind: 'success', title: 'Transfer complete', tab: 'send', priority: 80 })`); await settled();
    check(await js(`state === 'peek' && document.getElementById('notice-title').textContent === 'Transfer complete'`),
      'an outcome the user is waiting for is shown even when the pointer never left the notch');
    await js(`activityQueue.clear(); hoverSuppressed = false; collapseNotch()`); await settled();
    await js(`openNotch('send')`); await settled();
    await js(`activityQueue.clear(); pointerInside = true`);
    emit('clipboard', [{ id: 'clip-demo', kind: 'text', preview: 'A note to take with you', chars: 23, at: Date.now() }]);
    emit('system', { host: 'Windows PC', uptime: 10800, cpu: { overall: .24, count: 8, model: 'Intel Core i7', history: [.1, .3, .25, .18, .24] }, memory: { ratio: .48, used: 8246337208, total: 17179869184, history: [.4, .43, .46, .48] }, disks: [{ mount: 'C:', ratio: .35, free: 300000000000 }] });
    emit('ai', [{ pid: 1234, name: 'Demo workspace', folder: 'Demo', cwd: 'C:\\Demo', status: 'idle', statusUpdatedAt: Date.now() - 60000 }]);
    for (const name of ['clipboard', 'system', 'ai']) {
      await js(`setTab('${name}')`); await delay(300); await snapshot(name);
    }
    const aiNow = Date.now();
    const aiDay = (() => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); })();
    emit('ai-dashboard', { updatedAt: aiNow, scanning: false, providers: ['codex', 'claude'], accountStatus: 'ready', resets: 2,
      sessions: [{ provider: 'codex', sessionId: 'demo', name: 'Demo workspace', folder: 'Demo', status: 'busy', statusAt: aiNow - 120000, startedAt: aiNow - 120000, inferred: true }, { provider: 'claude', sessionId: 'demo2', name: 'Demo notes', folder: 'Demo', status: 'idle', statusAt: aiNow - 60000, startedAt: aiNow - 180000, inferred: false }],
      limits: { codex: { source: 'account', observedAt: aiNow, plan: 'Demo plan', windows: [{ used: 27, minutes: 300, resetsAt: aiNow + 7200000 }, { used: 54, minutes: 10080, resetsAt: aiNow + 86400000 * 3 }] } },
      buckets: [{ provider: 'codex', day: aiDay, model: 'Demo model', project: '<Demo project>', total: 125000, input: 25000, cached: 80000, write: 0, output: 20000, responses: 12 }, { provider: 'claude', day: aiDay, model: 'Demo Claude', project: 'Demo notes', total: 5000, input: 2000, cached: 2000, write: 0, output: 1000, responses: 3 }] });
    await settled();
    check(await js(`document.querySelector('[data-card="limits"]').textContent.includes('73%')
      && document.querySelectorAll('.ai-agent[data-agent="codex"] .ai-win').length === 2`),
      'AI quota cards show remaining allowance and both reset windows');
    // An agent with no publishable quota gets the same card shape rather than
    // a bare sentence beside the other agent's full card.
    check(await js(`(() => {
      const block = document.querySelector('.ai-agent[data-agent="claude"]');
      return !!block && block.querySelectorAll('.ai-win').length === 2
        && block.textContent.includes('Not a plan allowance');
    })()`), 'an agent without a quota still reports its activity in the same shape');
    check(await js(`(() => {
      const codex = getComputedStyle(document.querySelector('.ai-agent[data-agent="codex"] .ai-win-value')).color;
      const claude = getComputedStyle(document.querySelector('.ai-agent[data-agent="claude"] .ai-win-value')).color;
      return codex !== claude;
    })()`), 'each agent reads in its own colour');
    check(await js(`document.querySelector('[data-card="projects"]').textContent.includes('<Demo project>') && !document.querySelector('demo')`), 'AI project names render as text, never HTML');
    check(await js(`document.body.classList.contains('ai-working') && document.querySelector('.ai-live-row').textContent.includes('Codex')`), 'Codex activity reaches the live card and compact indicator');
    check(await js(`parseFloat(document.querySelector('.ai-trend i.is-today').style.height) === 54`), 'daily graph heights render under the strict content security policy');
    await snapshot('ai-dashboard');
    await js(`document.querySelector('[data-ai-provider="claude"]').click()`);
    check(await js(`document.querySelector('[data-card="tokens"] .ai-total').textContent.includes('5K') && !document.querySelector('[data-card="limits"]').textContent.includes('73%')`), 'provider filter changes tokens and does not invent Claude quota');
    await js(`document.querySelector('[data-ai-provider="all"]').click(); document.getElementById('ai-period').value = '30'; document.getElementById('ai-period').dispatchEvent(new Event('change'))`);
    check(await js(`document.querySelectorAll('.ai-trend > [data-day]').length === 30`), '30-day period expands daily token history');
    await js(`document.querySelector('.ai-customize summary').click(); document.querySelector('[data-ai-card="activity"]').click()`);
    check(await js(`!document.querySelector('[data-card="activity"]')`), 'AI cards can be customized without hiding the controls');
    await js(`document.querySelector('[data-ai-card="activity"]').click(); document.querySelector('.ai-customize summary').click()`);
    await js(`document.querySelector('.ai-scroll').scrollTop = 400`); await delay(80); await snapshot('ai-detail');
    check(await js(`document.querySelector('.ai-scroll').scrollTop > 0 && document.querySelector('.ai-scroll').scrollWidth <= document.querySelector('.ai-scroll').clientWidth`), 'AI details scroll inside the notch without horizontal overflow');
    check(await js(`document.body.classList.contains('ai-waiting')&&!document.querySelector('#peek-ai,.layer-peek .ai-dot')`), 'waiting AI sessions remain tracked without adding a green hover badge');
    await js(`setTab('clipboard'); const search = document.querySelector('[data-panel="clipboard"] .clip-search'); search.value = 'missing'; search.dispatchEvent(new Event('input'));`);
    check(await js(`document.querySelectorAll('.clip-row').length === 0 && document.querySelector('.clip-list').textContent.includes('No matching')`), 'clipboard search filters the local preview list');
    await js(`document.querySelector('[data-panel="clipboard"] .clip-search').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
    check(await js(`document.querySelectorAll('.clip-row').length === 1 && state === 'open'`), 'Escape clears clipboard search before dismissing the notch');
    await js(`document.querySelector('.clip-row').click()`); await delay(80);
    check(await js(`els.footerHint.textContent.includes('Copied')`), 'copying a clipboard item confirms the action');

    emit('now-playing', { type: 'state', session: true, title: 'A Quiet Morning', artist: 'Local artist', app: 'Spotify.exe', status: 'Playing', duration: 240, position: 87, thumb: fixtureArt, canPause: true, canNext: true, canPrev: true, canSeek: true, sources: ['Spotify.exe', 'msedge.exe'] });
    await js(`setTab('media')`);
    await delay(300);
    check(await js(`document.body.classList.contains('has-media') && !document.getElementById('np-toggle').disabled`), 'Now Playing renders with working playback controls');
    await snapshot('media');
    await js(`els.npSource.value = 'msedge.exe'; els.npSource.dispatchEvent(new Event('change'))`); await delay(50);
    check(mediaCommands.some((command) => command.action === 'source' && command.value === 'msedge.exe'), 'the player source selector routes its choice through the Windows bridge');
    await js(`els.npSeek.value = '120'; els.npSeek.dispatchEvent(new Event('input')); els.npSeek.dispatchEvent(new Event('change'));`);
    await delay(80);
    check(mediaCommands.some((command) => command.action === 'seek' && command.value === 120), 'seeking sends a validated time through the media bridge');
    emit('media-result', { action: 'seek', via: 'none' }); await delay(50);
    check(await js(`els.mediaFeedback.textContent.includes('declined')`), 'a player that refuses seeking produces visible feedback');
    await js(`els.mediaFeedback.textContent = ''`);

    // A long media title must use the CSS custom properties the renderer sets.
    await js(`els.npTitle.textContent = 'An exceptionally long song title that should scroll at a readable speed'; fitMarquee(els.npTitle)`);
    check(await js(`parseFloat(getComputedStyle(els.npTitle).animationDuration) === parseFloat(els.npTitle.style.getPropertyValue('--marquee-dur'))`), 'marquee duration matches the measured text distance');

    const musicFrames = await js(`new Promise((resolve) => {
      const frames = [], morphs = new Set(); let changes = 0;
      const observer = new MutationObserver((items) => { changes += items.length; });
      observer.observe(els.closedArt.querySelector('img'), { attributes: true, attributeFilter: ['src'] });
      collapseNotch(); const start = performance.now(); let previous = start;
      const poll = setInterval(() => { renderNowPlaying(); updateGeometry(); }, 35);
      function frame(now) {
        if (currentMorph) morphs.add(currentMorph);
        frames.push({ at: now - start, delta: now - previous, layerWidth: document.querySelector('.layer-open').offsetWidth,
          outgoing: Number(getComputedStyle(document.querySelector('.layer-open')).opacity),
          compact: Number(getComputedStyle(document.querySelector('.layer-closed')).opacity), viewport: innerWidth });
        previous = now;
        if (now - start < 650) requestAnimationFrame(frame);
        else { clearInterval(poll); observer.disconnect(); resolve({ frames, changes, morphs: morphs.size, art: els.closedArt.querySelector('img').complete }); }
      }
      requestAnimationFrame(frame);
    })`);
    check(musicFrames.frames.filter((f) => f.at > 130).every((f) => f.outgoing < .01), 'large music artwork exits before the shell finishes collapsing');
    check(musicFrames.changes === 0 && musicFrames.art, 'media polling never reloads compact artwork during collapse');
    check(musicFrames.morphs === 1 && musicFrames.frames.every((f) => f.viewport === stableHostViewport[0]), 'repeated media updates do not restart the spring or resize the native surface');
    check(Math.max(...musicFrames.frames.map((f) => f.layerWidth)) - Math.min(...musicFrames.frames.map((f) => f.layerWidth)) < 1, 'music content keeps a stable layout throughout shell motion');
    const deltas = musicFrames.frames.map((f) => f.delta).sort((a, b) => a - b);
    console.log('  music collapse frame timing (isolated renderer): p95=' + deltas[Math.floor(deltas.length * .95)].toFixed(1) + 'ms, max=' + deltas.at(-1).toFixed(1) + 'ms');
    await js(`openNotch('media')`); await settled();

    await js(`pinned = false; setState('peek')`); await settled();
    box = await layout();
    check(box.width === geometry.sizes.peekMedia.width && box.height === geometry.sizes.peekMedia.height, 'music hover opens its full player without clipping');
    await snapshot('peek-media');
    await js(`els.peekToggle.click()`); await delay(80);
    check((await layout()).state.includes('state-peek') && mediaCommands.some((command) => ['play','pause'].includes(command.action)), 'compact play/pause controls do not expand the notch');
    await js(`collapseNotch()`); await settled();
    await js(`els.closedTrigger.click()`); await settled();
    check((await layout()).activeTab === 'media', 'clicking the compact album art opens Now Playing directly');
    await js(`pinned = false; openedByClick = false; setState('peek')`); await settled();
    emit('now-playing', { type: 'state', session: false }); await settled();
    box = await layout();
    check(box.width === 300 && box.height === 46, 'ending media returns to the standard peek');
    await snapshot('peek');

    await js(`setState('closed'); setTimeout(() => setState('open'), 35); setTimeout(() => setState('peek'), 75); setTimeout(() => setState('closed'), 110)`);
    await delay(900);
    box = await layout();
    check(box.width === 184 && box.height === 28 && box.viewport[0] === stableHostViewport[0], 'rapid morph reversals settle without reallocating the Windows backing surface');

    await js(`pinned = false; openedByClick = false; window.demoDrag = new DataTransfer(); window.demoDrag.items.add(new File(['demo'], 'Notes.pdf')); document.dispatchEvent(new DragEvent('dragenter', { dataTransfer: window.demoDrag }));`); await settled();
    check(await js(`document.body.classList.contains('dragging') && getComputedStyle(els.shelf, '::after').content.includes('Release to park')`), 'dragging files shows a clear shelf drop intention');
    await snapshot('drop-shelf');
    await js(`document.querySelector('.device').dispatchEvent(new DragEvent('dragover', { dataTransfer: window.demoDrag, bubbles: true, cancelable: true }))`);
    check(await js(`document.querySelector('.device').classList.contains('drop-target') && document.body.classList.contains('aiming-device')`), 'a device drop target highlights the actual send action');
    await snapshot('drop-device');
    await js(`document.querySelector('.device').dispatchEvent(new DragEvent('dragleave', { dataTransfer: window.demoDrag })); document.dispatchEvent(new DragEvent('dragleave', { dataTransfer: window.demoDrag })); delete window.demoDrag;`);
    await delay(1250);
    check((await layout()).state.includes('state-closed'), 'abandoning a file drag does not leave the notch pinned open');

    await js(`card.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, bubbles: true, cancelable: true }))`); await settled();
    check((await layout()).state.includes('state-open'), 'scrolling down on the compact notch opens it');
    await delay(80);
    await js(`document.querySelector('.notch-header').dispatchEvent(new WheelEvent('wheel', { deltaY: -60, bubbles: true, cancelable: true }))`); await settled();
    check((await layout()).state.includes('state-closed'), 'scrolling up on the shell collapses it');

    await js(`pointerInside = false; hoverSuppressed = false; openedByClick = false;`);
    emit('now-playing', { type: 'state', session: true, title: 'New Track', artist: 'Local artist', app: 'Spotify.exe', status: 'Playing', duration: 240, position: 0, canPause: true });
    await settled();
    check((await layout()).state.includes('state-peek'), 'a newly playing song briefly appears without taking focus');
    await delay(2000);
    await settled();
    box = await layout();
    check(box.state.includes('state-closed') && box.width === 184 && box.viewport[0] === stableHostViewport[0], 'the song preview returns to compact mode automatically');
    await snapshot('closed-media');

    await js(`openNotch('timer')`); await settled();
    check((await layout()).panelOverflow <= 1, 'compact timer keeps its controls visible without clipping');
    await snapshot('timer');
    await js(`document.getElementById('timer-action').click()`); await delay(100);
    check(fixtureTimer.snapshot().running, 'the timer UI starts a real main-process session');
    await js(`collapseNotch()`); await settled();
    check(await js(`document.body.classList.contains('has-timer') && els.closedTimer.textContent.length > 0`), 'a running timer keeps its compact countdown while the panel is closed');
    await js(`els.closedTrigger.click()`); await settled();
    check((await layout()).activeTab === 'timer', 'compact countdown opens its own timer module');
    await js(`document.getElementById('timer-action').click()`); await delay(80);
    check(fixtureTimer.snapshot().paused, 'the timer can pause without losing its remaining time');
    await js(`document.getElementById('timer-reset').click()`); await delay(80);

    await js(`{ setTab('notes'); const note = document.getElementById('scratchpad'); note.value = ${JSON.stringify('A local note\nบันทึกบนเครื่องนี้')}; note.dispatchEvent(new Event('input')); }`);
    await delay(400);
    check(fixtureNote.includes('บันทึกบนเครื่องนี้'), 'scratchpad edits are sent to persistent storage');
    await snapshot('notes');
    // --- control panel window ---------------------------------------------
    // Settings moved out of the notch into a window of their own, so the rest
    // of this suite drives that window and checks the notch reacts to it.
    await js(`setTab('settings')`); await delay(120);
    check(settingsOpened === 1 && (await layout()).activeTab !== 'settings',
      'the Settings tile opens the control panel instead of taking over the notch');

    panelWin = new BrowserWindow({
      width: 960, height: 760, show: false, frame: false,
      webPreferences: { preload: path.join(__dirname, 'fixtures', 'panel-preload.js'),
        offscreen: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
    });
    panelWin.webContents.on('console-message', (_event, ...args) => {
      const message = _event.message || args[1];
      if (_event.level === 'error' || args[0] === 3) errors.push('[panel] ' + message);
    });
    await panelWin.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'settings.html'));
    await settled();
    await panelSnapshot('settings');
    await pjs(`SettingsNavigation.showPage('displays')`);

    check(await pjs(`!/[฀-๿]/.test(document.body.innerText)`), 'the control panel uses English interface text');
    check(await pjs(`document.querySelectorAll('[data-preference="displayId"] option').length === 2
      && document.querySelector('#display-count').textContent === '2 displays'`),
      'the control panel lists both connected monitors');

    await pjs(`{ const d = document.querySelector('[data-preference="displayId"]'); d.value = '2'; d.dispatchEvent(new Event('change')); }`);
    await delay(140);
    check(fixturePreferences.displayId === 2 && await pjs(`document.querySelector('#display-active').textContent.includes('Studio')`),
      'a display can be selected from the control panel');

    fixtureDisplayState = { ...fixtureDisplayState, missing: true, preferredLabel: 'Studio display', activeDisplayId: 1, displays: [fixtureDisplayState.displays[0]] };
    panelWin.webContents.send('fixture:panel-state', panelState()); await delay(120);
    check(await pjs(`document.querySelector('#display-status').textContent.includes('Reconnect')
      && document.querySelector('[data-preference="displayId"] option:checked').disabled`),
      'unplugging keeps the preferred display and explains the temporary fallback');

    fixtureDisplayState = { mode: 'selected', activeDisplayId: 2, preferredDisplayId: 2, missing: false,
      displays: [{ id: 1, label: 'Laptop display', primary: true, scaleFactor: 1.25 }, { id: 2, label: 'Studio display', primary: false, scaleFactor: 1.5 }] };
    panelWin.webContents.send('fixture:panel-state', panelState()); await delay(120);
    check(await pjs(`document.querySelectorAll('[data-preference="displayId"] option').length === 2
      && !document.querySelector('[data-preference="displayId"] option:checked').disabled`),
      'reconnecting updates the display picker without restarting');

    await pjs(`{ const d = document.querySelector('[data-preference="displayMode"]'); d.value = 'cursor'; d.dispatchEvent(new Event('change')); }`);
    await delay(140);
    check(fixturePreferences.displayMode === 'cursor' && await pjs(`document.querySelector('#display-picker-row').hidden
      && document.querySelector('#display-status').textContent.includes('cursor')`),
      'cursor mode explains when the notch follows and hides the fixed display picker');
    await pjs(`{ const d = document.querySelector('[data-preference="displayMode"]'); d.value = 'selected'; d.dispatchEvent(new Event('change')); }`);
    await delay(140);
    // The preview should show the section it is named after.
    await pjs(`document.querySelector('#group-displays').scrollIntoView({ block: 'start' })`);
    await delay(160);
    await panelSnapshot('settings-displays');
    await pjs(`SettingsNavigation.showPage('island','layout')`);

    // Black is invariant, including old saved glass/color preferences.
    check(await js(`document.body.dataset.glass==='off'&&getComputedStyle(card).backgroundColor==='rgb(0, 0, 0)'&&getComputedStyle(card).backgroundImage==='none'`), 'the notch stays opaque black with legacy glass preferences');
    check(await pjs(`!document.querySelector('input[type="color"],[data-preset],[data-preference="glass"]')`), 'Settings offers the fixed black theme without palette or glass controls');
    emit('now-playing', {type:'state',session:true,title:'A Quiet Morning',artist:'Local artist',app:'Spotify.exe',status:'Playing',duration:240,position:87,thumb:fixtureArt,canPause:true,canNext:true,canPrev:true,canSeek:true,sources:['Spotify.exe']});
    await js(`setTab('media')`); await settled();
    check(await js(`getComputedStyle(document.querySelector('.shell-content'),'::before').display==='none'&&getComputedStyle(document.querySelector('.shell-content'),'::after').boxShadow==='none'`), 'artwork adds neither a shell bloom nor a colored rim');
    await snapshot('black-music');

    // Worst case for legibility: the brightest possible cover blooming behind
    // the panel. Anything that passes here passes on a dark album too.
    const measured = {};
    for (const [label, selector] of [['track title', '#np-title'], ['artist and app', '#np-sub'],
      ['elapsed time', '#np-time'], ['panel title', '#panel-title'], ['footer hint', '#footer-hint']]) {
      measured[label] = await contrastOf(selector);
    }
    console.log('      contrast over a white cover: '
      + Object.entries(measured).map(([k, v]) => k + ' ' + v + ':1').join(', '));
    const worst = Math.min(...Object.values(measured).filter((v) => v !== null));
    check(worst >= 4.5, 'every music label stays above 4.5:1 over the fixed black base (worst ' + worst + ':1)');

    // The source artwork average colors music meters only.
    const neutral = await cssColor('--accent');
    const teal='data:image/png;base64,'+solidCover([0,170,170]).toString('base64');
    emit('now-playing',{type:'state',session:true,title:'Teal',artist:'Local artist',app:'Spotify.exe',status:'Playing',duration:200,position:10,thumb:teal,canPause:true,canNext:true,canPrev:true,canSeek:true,sources:['Spotify.exe']});
    await settled(); await settled();
    const musicColor=await cssColor('--music-accent','.np');
    check(musicColor!==neutral&&await cssColor('--accent')===neutral&&await cssColor('--surface-open')==='0,0,0', 'cover tint changes music meters while the shell and global accent remain fixed');
    const [r,g,b]=musicColor.split(',').map(Number);
    check(g>r+40&&b>r+40&&Math.abs(g-b)<60, 'source averaging produces the cover hue on the music meter');
    check(await contrastOf('#np-sub')>=4.5,'neutral music labels remain readable');
    await snapshot('music-colour');
    await js(`setTab('ai')`);await settled();
    check(await cssColor('--accent')===neutral&&await js(`getComputedStyle(card).backgroundColor==='rgb(0, 0, 0)'`),'switching modules does not inherit music tint');
    emit('now-playing',{type:'state',session:false});await settled();
    check(await cssColor('--music-accent','.np')===neutral&&!await js(`document.querySelector('.np').classList.contains('music-tinted')`),'ending music clears the scoped tint to white');
    emit('now-playing',{type:'state',session:true,title:'A Quiet Morning',artist:'Local artist',app:'Spotify.exe',status:'Playing',duration:240,position:87,thumb:fixtureArt,canPause:true,canNext:true,canPrev:true,canSeek:true,sources:['Spotify.exe']});
    await js(`setTab('media')`);await settled();

    await pjs(`document.querySelector('.segmented[data-preference="silhouette"] button[data-value="capsule"]').click()`);
    await settled();
    check(await js(`document.body.dataset.silhouette === 'capsule' && parseFloat(getComputedStyle(card).borderTopLeftRadius) > 0`),
      'capsule preference applies a floating rounded silhouette');
    await snapshot('capsule');
    await pjs(`document.querySelector('.segmented[data-preference="silhouette"] button[data-value="notch"]').click()`);
    await settled();

    await pjs(`{ const d = document.querySelector('[data-preference="autoDismiss"]'); d.checked = false; d.dispatchEvent(new Event('change')); }`);
    await delay(160);
    emit('dismiss'); await delay(120);
    check((await layout()).state.includes('state-open') && !fixturePreferences.autoDismiss,
      'auto-dismiss turned off in the control panel keeps an unpinned panel open');
    await pjs(`{ const d = document.querySelector('[data-preference="autoDismiss"]'); d.checked = true; d.dispatchEvent(new Event('change')); }`);
    await delay(160);

    // Appearance edits cross the same IPC boundary as the real Settings window.
    await js(`openNotch('media')`); await settled();
    await pjs(`SettingsNavigation.showPage('island','layout'); document.querySelector('.sheet').scrollTop = 0`);
    await pjs(`{ const input = document.querySelector('#expanded-width'); for (const width of [552,576,600,624,640]) { input.value = width; input.dispatchEvent(new Event('input')); } }`);
    check(await pjs(`document.querySelector('#expanded-width-value').textContent === '640 px' && document.querySelector('#preview-caption').textContent.includes('640 px')`), 'sliders update their value and live preview immediately');
    check(fixturePreferences.expandedWidth === 520, 'a slider drag batches persistence instead of resizing the HWND on every input');
    await settled();
    check((await layout()).width === 640 && await js(`document.querySelector('.layer-open').getBoundingClientRect().width === 640`), 'expanded width reaches both the painted shell and its content layout');
    const widerHost = win.getSize();
    await pjs(`{ const input = document.querySelector('#expanded-width'); input.value = 480; input.dispatchEvent(new Event('change')); }`);
    await settled();
    check((await layout()).width === 480 && win.getSize()[0] === widerHost[0], 'shrinking a customized shell preserves its backing surface for the outgoing animation');
    check(await js(`document.querySelector('.layer-open').scrollWidth <= 480 && document.querySelector('.np').scrollWidth <= 436`), 'music content fits the narrowest supported expanded width');
    await pjs(`{ const input = document.querySelector('#closed-width'); input.value = 280; input.dispatchEvent(new Event('change')); }`);
    await js(`collapseNotch()`); await settled();
    check((await layout()).width === 280, 'resting width is independently customizable while music is playing');
    await pjs(`{ const input = document.querySelector('#notch-scale'); input.value = 125; input.dispatchEvent(new Event('change')); }`);
    await settled();
    check(win.webContents.getZoomFactor() === 1.25 && Math.abs((await layout()).width - 280) < 1, 'overall size scales text and controls through Electron zoom without corrupting CSS geometry');
    await pjs(`{ const input = document.querySelector('#notch-scale'); input.value = 85; input.dispatchEvent(new Event('change')); }`);
    await settled();
    check(win.webContents.getZoomFactor() === .85 && await js(`Math.abs(card.getBoundingClientRect().x + card.getBoundingClientRect().width / 2 - innerWidth / 2) < 1`), 'the smallest overall size remains centered');
    await pjs(`{ const input = document.querySelector('#notch-scale'); input.value = 100; input.dispatchEvent(new Event('change')); } `);
    await js(`openNotch('media')`); await settled();
    await js(`applyPreferences({...preferences,surfaceTint:'#30213e',accentColor:'#ccb4ff',glass:'high'})`); await settled();
    check(await cssColor('--surface-open')==='0,0,0'&&await cssColor('--accent')==='255,255,255', 'legacy named palettes are normalized to the fixed black theme');
    await snapshot('appearance-music');
    await pjs(`document.querySelector('[data-preview="resting"]').click()`); await delay(450);
    check(await pjs(`document.querySelector('#appearance-preview').dataset.expanded === 'false' && document.querySelector('[data-preview="resting"]').getAttribute('aria-pressed') === 'true'`), 'the preview can morph independently between resting and expanded states');
    await panelSnapshot('appearance-studio');
    check(await contrastOf('#np-sub')>=4.5,'fixed-theme music labels remain readable');
    rejectPreferences = true;
    await pjs(`{const input=document.querySelector("#expanded-width");input.value=616;input.dispatchEvent(new Event("change"));}`); await delay(180);
    check(await pjs(`document.querySelector('#status').textContent.includes('Cannot save') && document.querySelector('#expanded-width').value === '480'`), 'failed saves restore stored appearance and show an error');
    rejectPreferences = false;
    await pjs(`document.querySelector('#reset-appearance').click()`); await settled();
    check(Object.keys(appearance.defaults).every(key => fixturePreferences[key] === appearance.defaults[key]), 'Reset size restores dimensions without changing behavior preferences');
    await pjs(`document.querySelector('[data-preview="expanded"]').click(); document.querySelector('#group-color').scrollIntoView({ block: 'start' });`); await delay(450);
    await panelSnapshot('appearance-black-theme');

    const claudeNow = Date.now();
    emit('ai-dashboard', { updatedAt: claudeNow, buckets: [], providers: ['claude'], sessions: [{ provider: 'claude', sessionId: 'live', name: 'Local project', status: 'busy', statusAt: claudeNow, startedAt: claudeNow, inferred: false }], limits: { claude: { source: 'account', plan: 'Claude', observedAt: claudeNow, windows: [{ used: 26, minutes: 300, resetsAt: claudeNow + 3600000 }, { used: 40, minutes: 10080, scope: 'Opus', resetsAt: claudeNow + 86400000 }] } }, claudeAccountStatus: 'ready' });
    await js(`openNotch('ai'); document.querySelector('[data-ai-provider="claude"]').click()`); await settled();
    check(await js(`document.querySelector('[data-card="limits"]').textContent.includes('74%') && document.querySelector('[data-card="limits"]').textContent.includes('Opus') && document.querySelector('.ai-live-row .ai-dot').classList.contains('is-working')`), 'Claude renders actual account windows, model scope and live working status');
    await snapshot('ai-claude');
    emit('ai-dashboard', { updatedAt: claudeNow, buckets: [], sessions: [], limits: {}, claudeAccountStatus: 'signin' }); await delay(180);
    check(await js(`document.querySelector('[data-card="limits"]').textContent.includes('claude auth login') && !document.querySelector('[data-card="limits"]').textContent.includes('0%')`), 'a signed-out Claude account explains how to reconnect without inventing a zero quota');
    await snapshot('ai-claude-signin');
    await js(`document.querySelector('[data-ai-connect]').click()`); await delay(100);
    check(connectedClaude === 1 && await js(`document.querySelector('#ai-meta').textContent.includes('Terminal')`), 'Connect Claude routes to its own terminal sign-in and explains the next step');

    await js(`activityQueue.clear(); pointerInside = false; hoverSuppressed = false; collapseNotch()`); await settled();
    emit('system-action', { action: 'volume', value: 40, muted: false }); await settled();
    check((await layout()).state.includes('state-peek') && await js(`document.querySelector('#notice-title').textContent === 'Volume' && document.querySelector('#notice-meter').getAttribute('aria-valuenow') === '40'`), 'Windows volume adjustments appear as a compact meter without opening a module');
    const hardwareHost = win.getSize();
    for (const value of [42,44,46,48,50,52]) emit('system-action', { action: 'volume', value, muted: false });
    await delay(160);
    check(await js(`activeNotice.detail === '52%' && activityQueue.pending.length === 0 && !document.body.classList.contains('is-morphing')`) && win.getSize()[0] === hardwareHost[0], 'held volume keys update one meter without a notification backlog or repeated shell morphs');
    await snapshot('feedback-volume');
    emit('system-action', { action: 'volume', value: 52, muted: true }); await delay(160);
    check(await js(`document.querySelector('#notice-title').textContent === 'Muted' && document.querySelector('#notice-meter').getAttribute('aria-valuenow') === '0'`), 'mute uses its own icon and an empty meter while preserving the stored level');
    emit('system-action', { action: 'brightness', value: 70 }); await delay(160);
    check(await js(`document.querySelector('#notice-title').textContent === 'Display brightness' && document.querySelector('#notice-meter').getAttribute('aria-valuenow') === '70'`), 'brightness replaces volume immediately with the real percentage');
    await snapshot('feedback-brightness');
    // Hardware feedback acknowledges something the user already did with a
    // key. It must not turn into a button that opens Windows Settings.
    await js(`document.querySelector('#notice-open').click()`); await delay(100);
    check(openedSystemSettings === null && await js(`document.querySelector('#notice-open').disabled
      && document.querySelector('#activity-inline').disabled
      && document.body.classList.contains('notice-passive')`),
      'hardware feedback stays a readout and opens nothing when pressed, in both the peek and inline forms');
    emit('system-action', { action: 'capslock', enabled: true }); await delay(180);
    check(await js(`activeNotice.title === 'Caps Lock' && activeNotice.detail.startsWith('On') && document.querySelector('#notice-meter').hidden`), 'Caps Lock feedback is explicit text and does not show a fake percentage');
    await snapshot('feedback-capslock');
    await delay(1800); await settled();
    check((await layout()).state.includes('state-closed'), 'system feedback expires and returns to the customized resting notch');
    await js(`openNotch('media')`); await settled();
    emit('system-action', { action: 'volume', value: 60, muted: false }); await delay(180);
    check((await layout()).activeTab === 'media' && await js(`document.querySelector('#activity-inline-label').textContent.includes('60%')`), 'volume feedback stays inline while music is open');
    await snapshot('feedback-inline');
    await js(`activityQueue.clear()`);
    await pjs(`{ const input = document.querySelector('[data-preference="systemFeedback"]'); input.checked = false; input.dispatchEvent(new Event('change')); }`); await delay(100);
    emit('system-action', { action: 'brightness', value: 20 }); await delay(150);
    check(await js(`activeNotice === null`), 'system feedback can be disabled in Settings');
    await pjs(`{ const input = document.querySelector('[data-preference="systemFeedback"]'); input.checked = true; input.dispatchEvent(new Event('change')); }`); await delay(100);
    check(errors.length === 0, 'renderer completes without console errors' + (errors.length ? ': ' + errors.join('; ') : ''));
    console.log('\nAll ' + checks + ' renderer checks passed. Screenshots: docs/previews');
    app.exit(0);
  } catch (error) {
    console.error(error);
    if (errors.length) console.error(errors.join('\n'));
    app.exit(1);
  }
});
