'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, globalShortcut, shell, dialog,
  clipboard: electronClipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const { Discovery } = require('./discovery');
const { sendFiles, TransferError } = require('./sender');
const { Shelf } = require('./shelf');
const { loadOrCreate } = require('./identity');
const { MediaBridge } = require('./media');
const { AiMonitor } = require('./aimon');
const { AiDashboard } = require('./ai-dashboard');
const { ClipboardWatcher } = require('./clipboard');
const { SystemMonitor } = require('./sysmon');
const { trayIconPNG } = require('./png');
const { Notification } = require('electron');
const { NotchTimer } = require('./timer');
const { NotesStore } = require('./notes');
const NotchGeometry = require('./renderer/notch-geometry');
const NotchAppearance = require('./renderer/notch-appearance');
const { DisplayController, pointerInside, MODES: DISPLAY_MODES } = require('./displays');
const { chooseProfile } = require('./profile');
const { SystemActions } = require('./system-actions');
const { findClaude, signInCommand } = require('./ai-claude');

const initialUserData = app.getPath('userData');
const persistentUserData = chooseProfile(initialUserData, path.join(app.getPath('appData'), 'localsend-island'));
if (persistentUserData !== initialUserData) app.setPath('userData', persistentUserData);

// Our own register endpoint. Deliberately not 53317 so the notch can run
// alongside the real LocalSend app without fighting it for the port.
const SELF_PORT = 53318;

const CLOSED = NotchGeometry.windowSize(NotchGeometry.sizes.closed);

let win = null;
let tray = null;
let discovery = null;
let shelf = null;
let settings = {};
let devices = [];
let identity = null;
let media = null;
let systemActions = null;
let aimon = null;
let aiSessions = [];
let aiDashboard = null;
let clipboard = null;
let clipEntries = [];
let sysmon = null;
let sysSample = null;
let activeTransfer = null;
let pointerTimer = null;
let hitRegion = { x: NotchGeometry.gutter, y: 0, ...NotchGeometry.sizes.closed };
let mouseInside = null;
let timer = null;
let notes = null;
let displayController = null;
let notchExpanded = false;
let panelWin = null;
let lastClaudeSignIn = 0;

function userFile(name) {
  return path.join(app.getPath('userData'), name);
}

function loadSettings() {
  let stored = {};
  try {
    stored = JSON.parse(fs.readFileSync(userFile('settings.json'), 'utf8'));
  } catch {
    stored = {};
  }
  return {
    alias: os.hostname() + ' Notch',
    fingerprint: crypto.randomBytes(16).toString('hex'),
    pin: '',
    ...stored,
  };
}

function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(userFile('settings.json')), { recursive: true });
    fs.writeFileSync(userFile('settings.json'), JSON.stringify(settings, null, 2));
    return true;
  } catch {
    // a read-only profile is not worth crashing over
    return false;
  }
}

const GLASS_LEVELS = ['high', 'medium', 'off'];
// What the resting notch shows when several things are happening at once.
const NOTCH_FOCUS = ['auto', 'transfer', 'timer', 'music', 'agent'];

function clientPreferences() {
  return { ...NotchAppearance.normalize(settings), autoDismiss: settings.autoDismiss !== false, musicPreview: settings.musicPreview !== false,
    systemFeedback: settings.systemFeedback !== false, musicColors: settings.musicColors !== false,
    gestures: settings.gestures !== false, silhouette: settings.silhouette === 'capsule' ? 'capsule' : 'notch',
    glass: GLASS_LEVELS.includes(settings.glass) ? settings.glass : 'high',
    notchFocus: NOTCH_FOCUS.includes(settings.notchFocus) ? settings.notchFocus : 'auto',
    displayMode: DISPLAY_MODES.includes(settings.displayMode) ? settings.displayMode : 'selected',
    displayId: displayController?.snapshot().preferredDisplayId ?? screen.getPrimaryDisplay().id };
}

/**
 * Validate and store one settings patch. Both the notch and the control panel
 * window write preferences, and both have to see the result, so every change
 * goes through here and is broadcast to whichever windows are open.
 */
function applyPreferencePatch(patch) {
  const previous = { ...settings };
  const appearance = NotchAppearance.normalize({ ...settings, ...patch });
  for (const key of Object.keys(NotchAppearance.defaults)) settings[key] = appearance[key];
  for (const key of ['autoDismiss', 'musicPreview', 'gestures', 'systemFeedback', 'musicColors']) {
    if (typeof patch?.[key] === 'boolean') settings[key] = patch[key];
  }
  if (['notch', 'capsule'].includes(patch?.silhouette)) settings.silhouette = patch.silhouette;
  if (GLASS_LEVELS.includes(patch?.glass)) settings.glass = patch.glass;
  if (NOTCH_FOCUS.includes(patch?.notchFocus)) settings.notchFocus = patch.notchFocus;
  if (DISPLAY_MODES.includes(patch?.displayMode)) settings.displayMode = patch.displayMode;
  const display = screen.getAllDisplays().find((d) => d.id === patch?.displayId);
  if (display) {
    settings.displayId = display.id;
    settings.displayLabel = display.label || '';
    settings.displayInternal = !!display.internal;
  }
  const ok = saveSettings();
  if (!ok) settings = previous;
  reflowNotch();
  const result = { ok, preferences: clientPreferences(), displayState: displayController?.snapshot() };
  send('notch:preferences', result);
  sendPanel('panel:state', panelState());
  return result;
}

function selfInfo() {
  return {
    alias: settings.alias,
    version: '2.0',
    deviceModel: 'Windows',
    deviceType: 'desktop',
    // In HTTPS mode the protocol expects the certificate hash here.
    fingerprint: identity ? identity.fingerprint : settings.fingerprint,
    port: SELF_PORT,
    protocol: 'http',
    download: false,
  };
}

// --- window -----------------------------------------------------------------

function createWindow() {
  displayController = new DisplayController({ screen, settings: () => settings,
    canFollow: () => !notchExpanded && !activeTransfer && !win?.isFocused() });
  const initialPlacement = displayController.initialPlacement();

  win = new BrowserWindow({
    ...initialPlacement.bounds,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    acceptFirstMouse: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  displayController.on('change', (state) => { send('notch:displays', { ...state, preferences: clientPreferences() }); sendPanel('panel:state', panelState()); refreshTrayMenu(); });
  displayController.on('moved', () => { mouseInside = null; win.setIgnoreMouseEvents(true, { forward: true }); });
  displayController.attach(win);
  displayController.start();

  // A frameless window swallows renderer errors, which makes a broken panel
  // look like a styling bug. Surface warnings and errors on the terminal.
  win.webContents.on('console-message', (...args) => {
    // Electron changed this signature: older builds pass (event, level, message,
    // line, source), newer ones a single event object.
    const e = args[0];
    const level = typeof e === 'object' && e !== null && 'level' in e ? e.level : args[1];
    const message = typeof e === 'object' && e !== null && 'message' in e ? e.message : args[2];
    const source = typeof e === 'object' && e !== null && 'sourceId' in e ? e.sourceId : args[4];
    const bad = level === 'error' || level === 'warning' || level === 2 || level === 3;
    if (bad) console.log('[renderer]', message, source ? '(' + String(source).split(/[\/]/).pop() + ')' : '');
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => displayController.apply());

  // showInactive keeps the notch from stealing focus from whatever the user
  // is actually working in.
  win.once('ready-to-show', () => win.showInactive());
  win.on('blur', () => send('notch:dismiss'));

  // Shadows and transparent corners should never cover browser tabs below.
  // Polling the cursor lets file drags re-enter even while clicks pass through.
  pointerTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return;
    displayController.tick();
    const point = screen.getCursorScreenPoint();
    const bounds = win.getBounds();
    const inside = pointerInside(hitRegion, point, bounds, win.webContents.getZoomFactor());
    if (inside === mouseInside) return;
    mouseInside = inside;
    win.setIgnoreMouseEvents(!inside, { forward: true });
    send('notch:pointer', inside);
  }, 50);
  pointerTimer.unref();

  // A frameless always-on-top window has no business being closed by a stray
  // keystroke; the tray menu is the way out.
  win.on('close', (event) => {
    if (!app.isQuitting) event.preventDefault();
  });

}

// The painted card sizes itself in the renderer; the native window only has
// to re-fit the display it sits on.
function reflowNotch() {
  if (!win || win.isDestroyed()) return;
  displayController?.settingsChanged();
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

// --- control panel window ---------------------------------------------------

function sendPanel(channel, payload) {
  if (panelWin && !panelWin.isDestroyed()) panelWin.webContents.send(channel, payload);
}

function panelState() {
  return {
    preferences: clientPreferences(),
    displayState: displayController?.snapshot(),
    acrylic: acrylicMaterial() !== null,
    about: { version: app.getVersion(), electron: process.versions.electron, alias: settings.alias },
  };
}

/**
 * Windows 11 22H2 is where DWM gained the backdrop material the control panel
 * uses. Anything older keeps an opaque window, which the stylesheet already
 * reads well against, so the check is about not asking for a material the
 * compositor would ignore.
 */
function acrylicMaterial() {
  if (process.platform !== 'win32') return null;
  const build = Number(os.release().split('.')[2]);
  return Number.isFinite(build) && build >= 22621 ? 'acrylic' : null;
}

function openPanelWindow() {
  if (panelWin && !panelWin.isDestroyed()) {
    if (panelWin.isMinimized()) panelWin.restore();
    panelWin.show();
    panelWin.focus();
    return;
  }
  const material = acrylicMaterial();
  panelWin = new BrowserWindow({
    width: 560,
    height: 660,
    minWidth: 480,
    minHeight: 520,
    show: false,
    frame: false,
    // The notch cannot use a system backdrop because it needs a transparent
    // window for its shoulders; this one is an ordinary window, so it can.
    ...(material ? { backgroundMaterial: material, backgroundColor: '#00000000' } : { backgroundColor: '#0d0d12' }),
    title: 'Islet Settings',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'panel-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  panelWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  panelWin.once('ready-to-show', () => panelWin.show());
  panelWin.on('closed', () => { panelWin = null; });
}

// --- tray -------------------------------------------------------------------

function buildTray() {
  const icon = nativeImage.createFromBuffer(trayIconPNG(32));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Islet');
  refreshTrayMenu();
  tray.on('click', toggleNotch);
}

function refreshTrayMenu() {
  if (!tray) return;
  const openAtLogin = app.getLoginItemSettings().openAtLogin;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Toggle notch', click: toggleNotch },
    { label: 'Display', submenu: [
      { label: 'Choose a display', type: 'radio', checked: !settings.displayMode || settings.displayMode === 'selected', click: () => setDisplayPreference({ displayMode: 'selected' }) },
      { label: 'Follow primary display', type: 'radio', checked: settings.displayMode === 'primary', click: () => setDisplayPreference({ displayMode: 'primary' }) },
      { label: 'Follow cursor', type: 'radio', checked: settings.displayMode === 'cursor', click: () => setDisplayPreference({ displayMode: 'cursor' }) },
      { type: 'separator' },
      ...screen.getAllDisplays().map((display, i) => ({ label: (display.label || 'Display ' + (i + 1)) + (display.id === screen.getPrimaryDisplay().id ? ' · Primary' : ''),
        type: 'checkbox', checked: (!settings.displayMode || settings.displayMode === 'selected') && displayController?.snapshot().preferredDisplayId === display.id,
        click: () => setDisplayPreference({ displayMode: 'selected', displayId: display.id }) })),
    ] },
    { type: 'separator' },
    {
      label: 'Clear file shelf' + (shelf && shelf.items.length ? ' (' + shelf.items.length + ')' : ''),
      enabled: Boolean(shelf && shelf.items.length),
      click: () => shelf.clear(),
    },
    { label: 'Settings…', click: () => openPanelWindow() },
    { label: 'Open settings folder', click: () => shell.openPath(app.getPath('userData')) },
    { type: 'separator' },
    {
      label: 'Launch at login',
      type: 'checkbox',
      checked: openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked, args: [] });
        refreshTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]));
}

function setDisplayPreference(patch) {
  const previous = { ...settings };
  if (DISPLAY_MODES.includes(patch?.displayMode)) settings.displayMode = patch.displayMode;
  const display = screen.getAllDisplays().find((d) => d.id === patch?.displayId);
  if (display) {
    settings.displayId = display.id; settings.displayLabel = display.label || '';
    settings.displayInternal = !!display.internal;
  }
  const ok = saveSettings();
  if (!ok) settings = previous;
  displayController?.settingsChanged(); return ok;
}

function toggleNotch() {
  // Explicit activation should appear on the cursor display immediately.
  if (settings.displayMode === 'cursor') displayController?.settingsChanged();
  send('notch:toggle');
}

// --- wiring -----------------------------------------------------------------

function startDiscovery() {
  discovery = new Discovery(selfInfo());
  discovery.on('devices', (list) => {
    devices = list;
    send('notch:devices', list);
  });
  discovery.on('log', (line) => {
    console.log('[discovery]', line);
    send('notch:log', line);
  });
  discovery.start();
}

function startShelf() {
  shelf = new Shelf(userFile('shelf.json'));
  shelf.on('change', (items) => {
    send('notch:shelf', items);
    refreshTrayMenu();
  });
  shelf.on('log', (line) => console.log('[shelf]', line));
  shelf.load();
  // Files get moved and deleted outside the app; re-check periodically.
  setInterval(() => shelf.prune(), 30000);
}

function startMedia() {
  systemActions = new SystemActions();
  systemActions.on('ready', () => console.log('[system-actions] ready'));
  systemActions.on('action', (action) => { if (settings.systemFeedback !== false) send('notch:system-action', action); });
  systemActions.on('unavailable', () => console.log('[system-actions] System feedback unavailable'));
  systemActions.start();
  media = new MediaBridge({ scriptPath: mediaScriptPath() });
  media.on('message', (message) => send('notch:now-playing', message));
  media.on('command', (result) => send('notch:media-result', result));
  media.on('log', (line) => console.log('[media]', line));
  media.on('unsupported', () => console.log('[media] Now Playing unavailable on this machine'));
  media.start();
}

// Session metadata/counters stay local. Quotas use the local Codex app-server's
// read-only account API; authentication remains with Codex.
function startAiMonitor() {
  aiDashboard = new AiDashboard();
  aiDashboard.on('change', (state) => send('notch:ai-dashboard', state));
  aiDashboard.on('complete', (session) => {
    send('notch:ai-complete', { provider: session.provider, name: session.name });
    if (!Notification.isSupported()) return;
    const notification = new Notification({ title: 'AI task complete', body: session.provider + ' · ' + session.name });
    notification.on('click', () => send('notch:navigate', 'ai'));
    notification.show();
  });
  aiDashboard.on('limit', ({ used, provider = 'codex' }) => {
    if (!Notification.isSupported()) return;
    const notification = new Notification({ title: (provider === 'claude' ? 'Claude' : 'Codex') + ' quota is running low', body: 'Used ' + Math.round(used) + '% · Click to view reset times' });
    notification.on('click', () => send('notch:navigate', 'ai'));
    notification.show();
  });
  aiDashboard.start();
  aimon = new AiMonitor();
  aimon.on('sessions', (list) => {
    aiSessions = list;
    aiDashboard.setClaude(list);
    send('notch:ai-sessions', list);
  });
  aimon.on('log', (line) => console.log('[aimon]', line));
  aimon.start();
}

// Clipboard history is the most sensitive thing the notch touches, so it
// stays in the user's own profile, the renderer only ever receives previews,
// and the full text is handed back only when they pick an entry.
function startClipboard() {
  clipboard = new ClipboardWatcher({
    clipboard: electronClipboard,
    storePath: userFile('clipboard.json'),
  });
  clipboard.on('change', (entries) => {
    clipEntries = entries;
    send('notch:clipboard', entries);
  });
  clipboard.on('paused', (paused) => send('notch:clipboard-paused', paused));
  clipboard.on('log', (line) => console.log('[clipboard]', line));
  clipboard.load();
  clipboard.start();
}

function startSystemMonitor() {
  sysmon = new SystemMonitor();
  sysmon.on('sample', (sample) => {
    sysSample = sample;
    send('notch:system', sample);
  });
  sysmon.start();
}

/**
 * Where PowerShell can read the bridge script. A packaged app keeps its source
 * inside app.asar, which only Electron's own fs can see, so hand the script to
 * the user's profile instead of asking PowerShell to read an archive.
 */
function mediaScriptPath() {
  const source = path.join(__dirname, 'media', 'nowplaying.ps1');
  if (!app.isPackaged) return source;
  const target = userFile('nowplaying.ps1');
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, fs.readFileSync(source));
    return target;
  } catch (err) {
    console.log('[media] could not unpack bridge script:', err.message);
    return source;
  }
}

function registerIpc() {
  ipcMain.handle('notch:init', () => {
    // The renderer only gets this far once every panel script has parsed and
    // mounted, so it doubles as a "the window is alive" signal.
    console.log('[renderer] ready');
    return {
      devices,
      shelf: shelf.items,
      self: selfInfo(),
      closed: CLOSED,
      nowPlaying: media ? media.state : null,
      aiSessions,
      aiDashboard: aiDashboard?.snapshot(),
      clipboard: clipEntries,
      clipboardPaused: clipboard ? clipboard.paused : false,
      system: sysSample,
      timer: timer.snapshot(),
      note: notes.text,
      preferences: clientPreferences(),
      displays: screen.getAllDisplays().map((display) => ({ id: display.id, label: display.label || display.size.width + ' × ' + display.size.height })),
      displayState: displayController?.snapshot(),
    };
  });

  ipcMain.handle('notch:timer', (_event, command) => timer.command(command?.action, command?.options));
  ipcMain.handle('notch:note', (_event, value) => notes.set(value));
  ipcMain.on('notch:note-cache', (_event, value) => notes.cache(value));
  ipcMain.handle('notch:preferences', (_event, patch) => applyPreferencePatch(patch));
  ipcMain.on('notch:open-settings', () => openPanelWindow());

  // The control panel is a separate window with a deliberately small surface:
  // read the settings, write the settings, and manage its own frame.
  ipcMain.handle('panel:init', () => panelState());
  ipcMain.handle('panel:update', (_event, patch) => applyPreferencePatch(patch));
  ipcMain.on('panel:close', () => panelWin?.close());
  ipcMain.on('panel:minimize', () => panelWin?.minimize());
  ipcMain.on('panel:reveal-data', () => shell.openPath(app.getPath('userData')));

  ipcMain.handle('notch:media', (_event, command) => {
    if (!media || !command) return false;
    if (command.action === 'seek') {
      if (!media.state.canSeek || !Number.isFinite(command.value) || media.state.duration <= 0) return false;
      return media.command('seek', Math.max(0, Math.min(command.value, media.state.duration)));
    }
    if (command.action === 'source') {
      if (command.value !== '' && !media.state.sources?.includes(command.value)) return false;
      return media.command('source', command.value);
    }
    return media.command(command.action);
  });

  ipcMain.on('notch:focus', () => { if (win && !win.isDestroyed()) win.focus(); });
  ipcMain.on('notch:release-focus', () => { if (win && !win.isDestroyed()) win.blur(); });
  ipcMain.on('notch:interaction', (_event, state) => { if (['closed', 'peek', 'open'].includes(state)) notchExpanded = state !== 'closed'; });

  ipcMain.handle('notch:size', () => reflowNotch());

  ipcMain.on('notch:hit-region', (_event, region) => {
    if (!region || !['x', 'y', 'width', 'height'].every((key) => Number.isFinite(region[key]))) return;
    hitRegion = region;
  });

  ipcMain.handle('notch:add-files', (_event, paths) => {
    if (!Array.isArray(paths)) return { added: 0, rejected: [] };
    return shelf.add(paths.filter((p) => typeof p === 'string'));
  });
  ipcMain.handle('notch:choose-files', async () => {
    const result = await dialog.showOpenDialog(win, { title: 'Add files to Islet', properties: ['openFile', 'multiSelections'] });
    return result.canceled ? { added: 0, rejected: [] } : shelf.add(result.filePaths);
  });

  ipcMain.handle('notch:add-text', () => {
    const text = electronClipboard.readText();
    return shelf.addText(text, userFile('outbox'));
  });

  ipcMain.on('notch:shelf-remove', (_event, id) => shelf.remove(id));
  ipcMain.on('notch:shelf-clear', () => shelf.clear());

  ipcMain.handle('notch:clip-pick', (_event, id) => (clipboard ? clipboard.pick(id) : false));
  ipcMain.on('notch:clip-remove', (_event, id) => clipboard?.remove(id));
  ipcMain.on('notch:clip-clear', () => clipboard?.clear());
  ipcMain.on('notch:clip-pause', (_event, paused) => clipboard?.setPaused(paused));

  ipcMain.on('notch:reveal', (_event, id) => {
    const item = shelf.get(id);
    if (item) shell.showItemInFolder(item.path);
  });

  // Native drag out of the notch and into Explorer or any other app.
  ipcMain.on('notch:drag-out', async (event, id) => {
    const item = shelf.get(id);
    if (!item || !fs.existsSync(item.path)) return;
    let icon;
    try {
      icon = await app.getFileIcon(item.path, { size: 'normal' });
    } catch {
      icon = nativeImage.createFromBuffer(trayIconPNG(32));
    }
    try {
      event.sender.startDrag({ file: item.path, icon });
    } catch (err) {
      console.log('[drag-out]', err.message);
    }
  });

  ipcMain.handle('notch:send', async (_event, payload) => {
    const { fingerprint, pin } = payload || {};

    if (activeTransfer) {
      return { ok: false, kind: 'busy', message: 'A transfer is already in progress.' };
    }

    const device = devices.find((d) => d.fingerprint === fingerprint);
    if (!device) {
      return { ok: false, kind: 'gone', message: 'This device is no longer available.' };
    }

    const files = shelf.entries();
    if (!files.length) {
      return { ok: false, kind: 'empty', message: 'Your shelf is empty.' };
    }

    activeTransfer = { fingerprint, startedAt: Date.now() };

    try {
      const result = await sendFiles(device, selfInfo(), files, {
        identity,
        pin: pin || settings.pin || undefined,
        onProgress: (p) => send('notch:transfer', { ...p, alias: device.alias }),
      });

      settings.lastDevice = fingerprint;
      // A PIN that worked is worth keeping for the next transfer.
      if (pin) settings.pin = pin;
      saveSettings();

      return { ok: true, ...result, alias: device.alias };
    } catch (err) {
      const kind = err instanceof TransferError ? err.kind : 'unknown';
      // A rejected PIN should not be remembered.
      if (kind === 'pin') {
        settings.pin = '';
        saveSettings();
      }
      send('notch:transfer', { phase: 'error', message: err.message, kind, alias: device.alias });
      return { ok: false, kind, message: err.message };
    } finally {
      activeTransfer = null;
    }
  });

  ipcMain.on('notch:quit', () => {
    app.isQuitting = true;
    app.quit();
  });
  ipcMain.handle('notch:ai-refresh', () => aiDashboard?.refresh());
  ipcMain.handle('notch:claude-signin', () => {
    const executable = findClaude();
    if (!executable) return { ok: false };
    if (Date.now() - lastClaudeSignIn < 3000) return { ok: true };
    lastClaudeSignIn = Date.now();
    // A visible terminal is intentional here: the person clicks Connect and
    // completes the CLI's own browser sign-in. No credentials enter Islet.
    return new Promise(resolve => {
      const env = { ...process.env, DISABLE_AUTOUPDATER: '1' }; delete env.CLAUDECODE;
      const child = spawn('powershell.exe', ['-NoProfile', '-NoExit', '-Command', signInCommand(executable)],
        { detached: true, windowsHide: false, stdio: 'ignore', cwd: os.homedir(), env });
      child.once('error', () => resolve({ ok: false }));
      child.once('spawn', () => { child.unref(); resolve({ ok: true }); });
    });
  });
  ipcMain.handle('notch:system-settings', async (_event, page) => {
    const pages = { sound: 'ms-settings:sound', display: 'ms-settings:display', keyboard: 'ms-settings:easeofaccess-keyboard' };
    if (!Object.hasOwn(pages, page)) return false;
    try { await shell.openExternal(pages[page]); return true; } catch { return false; }
  });
}

// --- lifecycle --------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', toggleNotch);

  app.whenReady().then(async () => {
    settings = loadSettings();
    saveSettings();
    notes = new NotesStore(userFile('scratchpad.txt'));
    notes.load();
    timer = new NotchTimer();
    timer.on('change', (state) => send('notch:timer-state', state));
    timer.on('complete', () => {
      try {
        if (!Notification.isSupported()) { shell.beep(); return; }
        const notification = new Notification({ title: 'Islet', body: 'Time is up · Click to open the timer', silent: false });
        notification.on('click', () => send('notch:navigate', 'timer'));
        notification.on('failed', () => shell.beep());
        notification.show();
      } catch { shell.beep(); }
    });
    timer.start();

    // Receivers demand a client certificate, so have ours ready before the
    // first announcement goes out: our fingerprint is derived from it.
    identity = await loadOrCreate(app.getPath('userData'));
    console.log('[identity]', (identity.created ? 'generated' : 'loaded') + ' cert, fingerprint ' + identity.fingerprint.slice(0, 16) + '…');

    startShelf();
    registerIpc();
    createWindow();
    buildTray();
    startDiscovery();
    startMedia();
    startAiMonitor();
    startClipboard();
    startSystemMonitor();

    globalShortcut.register('Control+Alt+D', toggleNotch);
  });

  app.on('window-all-closed', () => {
    // The notch lives in the tray; closing the window is not quitting.
  });

  app.on('will-quit', () => {
    clearInterval(pointerTimer);
    globalShortcut.unregisterAll();
    discovery?.stop();
    media?.stop();
    systemActions?.stop();
    aimon?.stop();
    aiDashboard?.stop();
    clipboard?.stop();
    sysmon?.stop();
    timer?.stop();
    notes?.flush();
    displayController?.stop();
  });
}
