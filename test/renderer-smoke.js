'use strict';

// Run with Electron, without starting production discovery or reading user data.
// Offscreen Chromium exercises the real renderer, preload boundary and resizes.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const geometry = require('../src/renderer/notch-geometry');
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
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const js = (source) => win.webContents.executeJavaScript(source);
// The control panel is its own window, so it gets its own evaluator.
const pjs = (source) => panelWin.webContents.executeJavaScript(source);
const emit = (name, value) => win.webContents.send('fixture:' + name, value);
const errors = [];
let checks = 0;
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
  ipcMain.handle('fixture:media', (_event, command) => { mediaCommands.push(command); return true; });
  ipcMain.handle('fixture:ai-refresh', () => null);
  ipcMain.handle('fixture:timer', (_event, command) => {
    const state = fixtureTimer.command(command.action, command.options); emit('timer', state); return state;
  });
  ipcMain.handle('fixture:note', (_event, value) => { fixtureNote = value; return true; });
  ipcMain.handle('fixture:preferences', (_event, value) => {
    fixturePreferences = { ...fixturePreferences, ...value };
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
    check(box.width === 184 && box.height === 28, 'closed notch uses shared geometry');
    await snapshot('closed');

    await js(`document.getElementById('closed-trigger').click()`);
    await settled();
    box = await layout();
    check(box.width === 520 && box.height === 390, 'click opens the full surface');
    check(box.viewport[0] === geometry.hostSize.width && box.viewport[1] === geometry.hostSize.height, 'Windows backing surface stays reserved for every state and spring overshoot');
    check(box.panelOverflow <= 1 && box.footerBottom < box.bottom, 'empty send panel fits without clipping');
    await snapshot('send-empty');
    await js(`pointerInside = true`);
    await js(`els.explore.click()`); await delay(300);
    check(await js(`document.body.classList.contains('is-exploring') && getComputedStyle(els.tabs).display === 'grid'`), 'Explore opens the module gallery');
    await snapshot('explore');
    await js(`els.exploreSearch.value = 'Timer'; els.exploreSearch.dispatchEvent(new Event('input'));`);
    check(await js(`els.tabs.querySelectorAll('.tab:not([hidden])').length === 1`), 'module gallery search filters available destinations');
    await js(`setTab('send')`);

    emit('shelf', files); emit('devices', devices);
    await delay(80);
    check(await js(`document.querySelectorAll('.item').length === 3 && document.querySelector('.glyph svg') !== null`), 'file cards and vector device icons render');
    await snapshot('send-ready');

    await js(`document.querySelector('.device').click()`);
    await delay(80);
    check(await js(`document.getElementById('status').classList.contains('is-done')`), 'successful send shows confirmation');
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
    check(await js(`document.querySelector('[data-card="limits"]').textContent.includes('73%') && document.querySelectorAll('.ai-window').length === 2`), 'AI quota cards show remaining allowance and both reset windows');
    check(await js(`document.querySelector('[data-card="projects"]').textContent.includes('<Demo project>') && !document.querySelector('demo')`), 'AI project names render as text, never HTML');
    check(await js(`document.body.classList.contains('ai-working') && document.querySelector('.ai-live-row').textContent.includes('Codex')`), 'Codex activity reaches the live card and compact indicator');
    check(await js(`parseFloat(document.querySelector('.ai-trend i.is-today').style.height) === 54`), 'daily graph heights render under the strict content security policy');
    await snapshot('ai-dashboard');
    await js(`document.querySelector('[data-ai-provider="claude"]').click()`);
    check(await js(`document.querySelector('[data-card="tokens"] .ai-total').textContent.includes('5K') && !document.querySelector('[data-card="limits"]').textContent.includes('73%')`), 'provider filter changes tokens and does not invent Claude quota');
    await js(`document.querySelector('[data-ai-provider="all"]').click(); document.getElementById('ai-period').value = '30'; document.getElementById('ai-period').dispatchEvent(new Event('change'))`);
    check(await js(`document.querySelectorAll('.ai-trend > div').length === 30`), '30-day period expands daily token history');
    await js(`document.querySelector('.ai-customize summary').click(); document.querySelector('[data-ai-card="activity"]').click()`);
    check(await js(`!document.querySelector('[data-card="activity"]')`), 'AI cards can be customized without hiding the controls');
    await js(`document.querySelector('[data-ai-card="activity"]').click(); document.querySelector('.ai-customize summary').click()`);
    await js(`document.querySelector('[data-panel="ai"]').scrollTop = 400`); await delay(80); await snapshot('ai-detail');
    check(await js(`document.querySelector('[data-panel="ai"]').scrollTop > 0 && document.querySelector('[data-panel="ai"]').scrollWidth <= document.querySelector('[data-panel="ai"]').clientWidth`), 'AI details scroll inside the notch without horizontal overflow');
    check(await js(`document.body.classList.contains('ai-waiting')`), 'waiting AI sessions keep their compact indicator');
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
    check(await js(`getComputedStyle(els.npTitle).animationDuration === els.npTitle.style.getPropertyValue('--marquee-dur')`), 'marquee uses measured title distance and duration');

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
    check(musicFrames.morphs === 1 && musicFrames.frames.every((f) => f.viewport === geometry.hostSize.width), 'repeated media updates do not restart the spring or resize the native surface');
    check(Math.max(...musicFrames.frames.map((f) => f.layerWidth)) - Math.min(...musicFrames.frames.map((f) => f.layerWidth)) < 1, 'music content keeps a stable layout throughout shell motion');
    const deltas = musicFrames.frames.map((f) => f.delta).sort((a, b) => a - b);
    console.log('  music collapse frame timing (isolated renderer): p95=' + deltas[Math.floor(deltas.length * .95)].toFixed(1) + 'ms, max=' + deltas.at(-1).toFixed(1) + 'ms');
    await js(`openNotch('media')`); await settled();

    await js(`pinned = false; setState('peek')`); await settled();
    box = await layout();
    check(box.width === 360 && box.height === 50, 'media peek resizes without clipping');
    await snapshot('peek-media');
    await js(`els.peekToggle.click()`); await delay(80);
    check((await layout()).state.includes('state-peek') && mediaCommands.some((command) => command.action === 'toggle'), 'compact play/pause controls do not expand the notch');
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
    check(box.width === 184 && box.height === 28 && box.viewport[0] === geometry.hostSize.width, 'rapid morph reversals settle without reallocating the Windows backing surface');

    await js(`pinned = false; openedByClick = false; const transfer = new DataTransfer(); transfer.items.add(new File(['demo'], 'Notes.pdf')); document.dispatchEvent(new DragEvent('dragenter', { dataTransfer: transfer })); document.dispatchEvent(new DragEvent('dragleave', { dataTransfer: transfer }));`);
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
    check(box.state.includes('state-closed') && box.width === 184 && box.viewport[0] === geometry.hostSize.width, 'the song preview returns to compact mode automatically');
    await snapshot('closed-media');

    await js(`openNotch('timer')`); await settled();
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
      width: 560, height: 660, show: false, frame: false,
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

    // --- glass ---------------------------------------------------------------
    check(await js(`document.body.dataset.glass === 'high'`), 'the notch starts on the full glass treatment');
    const lit = await js(`(() => {
      const surface = getComputedStyle(document.querySelector('.panel.is-active .card') || document.querySelector('.shelf'));
      return { blur: surface.backdropFilter, card: getComputedStyle(card).backgroundImage };
    })()`);
    check(lit.blur.includes('blur') && lit.card.includes('gradient'),
      'open glass gives inner surfaces a real backdrop blur over a lit card');

    await pjs(`document.querySelector('.segmented[data-preference="glass"] button[data-value="off"]').click()`);
    await delay(200);
    check(fixturePreferences.glass === 'off' && await js(`document.body.dataset.glass === 'off'
      && getComputedStyle(document.querySelector('.shelf')).backdropFilter === 'none'`),
      'turning glass off in the control panel reaches the notch and drops the blur');
    await pjs(`document.querySelector('.segmented[data-preference="glass"] button[data-value="high"]').click()`);
    await delay(200);
    // Glass is at its most visible with a cover behind it, which is the
    // state it was designed around.
    emit('now-playing', { type: 'state', session: true, title: 'A Quiet Morning', artist: 'Local artist',
      app: 'Spotify.exe', status: 'Playing', duration: 240, position: 87, thumb: fixtureArt,
      canPause: true, canNext: true, canPrev: true, canSeek: true, sources: ['Spotify.exe'] });
    await js(`setTab('media')`); await settled();
    check(await js(`getComputedStyle(document.querySelector('.shell-content'), '::before').backgroundImage.includes('url("data:image')`),
      'a playing cover becomes the light behind the glass');
    await snapshot('glass');

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
    check(worst >= 4.5, 'every label stays above 4.5:1 with the brightest cover behind the glass (worst ' + worst + ':1)');

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

    check(errors.length === 0, 'renderer completes without console errors' + (errors.length ? ': ' + errors.join('; ') : ''));
    console.log('\nAll ' + checks + ' renderer checks passed. Screenshots: docs/previews');
    app.exit(0);
  } catch (error) {
    console.error(error);
    if (errors.length) console.error(errors.join('\n'));
    app.exit(1);
  }
});
