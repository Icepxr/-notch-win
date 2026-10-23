'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('notch', {
  init: () => ipcRenderer.invoke('notch:init'),
  onDisplays: (cb) => ipcRenderer.on('notch:displays', (_e, value) => cb(value)),
  setInteraction: (state) => ipcRenderer.send('notch:interaction', state),
  refreshAi: () => ipcRenderer.invoke('notch:ai-refresh'),
  connectClaude: () => ipcRenderer.invoke('notch:claude-signin'),
  onSystemAction: (cb) => ipcRenderer.on('notch:system-action', (_e, value) => cb(value)),
  onAiDashboard: (cb) => ipcRenderer.on('notch:ai-dashboard', (_e, value) => cb(value)),
  onAiComplete: (cb) => ipcRenderer.on('notch:ai-complete', (_e, value) => cb(value)),

  // Electron removed File.path; this is the supported replacement.
  pathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return null;
    }
  },

  setSize: (width, height) => ipcRenderer.invoke('notch:size', { width, height }),
  setHitRegion: (region) => ipcRenderer.send('notch:hit-region', region),
  focus: () => ipcRenderer.send('notch:focus'),
  releaseFocus: () => ipcRenderer.send('notch:release-focus'),
  timerCommand: (action, options) => ipcRenderer.invoke('notch:timer', { action, options }),
  saveNote: (value) => ipcRenderer.invoke('notch:note', value),
  copyNote: (value) => ipcRenderer.invoke('notch:note-copy', value),
  cacheNote: (value) => ipcRenderer.send('notch:note-cache', value),
  updatePreferences: (patch) => ipcRenderer.invoke('notch:preferences', patch),
  openSettings: () => ipcRenderer.send('notch:open-settings'),
  contextMenu: (pinned) => ipcRenderer.invoke('notch:context-menu', pinned),
  onMenuAction: (cb) => ipcRenderer.on('notch:menu-action', (_e, action) => cb(action)),
  onPreferences: (cb) => ipcRenderer.on('notch:preferences', (_e, value) => cb(value)),
  addFiles: (paths) => ipcRenderer.invoke('notch:add-files', paths),
  addText: () => ipcRenderer.invoke('notch:add-text'),
  chooseFiles: (options) => ipcRenderer.invoke('notch:choose-files', options),
  sendTo: (fingerprint, pin) => ipcRenderer.invoke('notch:send', { fingerprint, pin }),
  removeItem: (id) => ipcRenderer.send('notch:shelf-remove', id),
  clearShelf: () => ipcRenderer.send('notch:shelf-clear'),
  reveal: (id) => ipcRenderer.send('notch:reveal', id),
  mediaCommand: (action, value, playback) => ipcRenderer.invoke('notch:media', { action, value, playback }),
  chooseLyrics: () => ipcRenderer.invoke('notch:choose-lyrics'),
  lyrics: (enabled) => ipcRenderer.invoke('notch:lyrics', enabled === true),
  dragOut: (id) => ipcRenderer.send('notch:drag-out', id),
  quit: () => ipcRenderer.send('notch:quit'),

  clipPick: (id) => ipcRenderer.invoke('notch:clip-pick', id),
  clipPin: (id) => ipcRenderer.invoke('notch:clip-pin', id),
  clipRemove: (id) => ipcRenderer.send('notch:clip-remove', id),
  clipClear: (keepPinned) => ipcRenderer.send('notch:clip-clear', keepPinned === true),
  clipPause: (paused) => ipcRenderer.send('notch:clip-pause', paused),

  onDevices: (cb) => ipcRenderer.on('notch:devices', (_e, list) => cb(list)),
  onShelf: (cb) => ipcRenderer.on('notch:shelf', (_e, items) => cb(items)),
  onTransfer: (cb) => ipcRenderer.on('notch:transfer', (_e, p) => cb(p)),
  onNowPlaying: (cb) => ipcRenderer.on('notch:now-playing', (_e, message) => cb(message)),
  onMediaResult: (cb) => ipcRenderer.on('notch:media-result', (_e, message) => cb(message)),
  onAiSessions: (cb) => ipcRenderer.on('notch:ai-sessions', (_e, list) => cb(list)),
  onToggle: (cb) => ipcRenderer.on('notch:toggle', () => cb()),
  onPointer: (cb) => ipcRenderer.on('notch:pointer', (_e, inside) => cb(inside)),
  onDismiss: (cb) => ipcRenderer.on('notch:dismiss', () => cb()),
  onTimer: (cb) => ipcRenderer.on('notch:timer-state', (_e, value) => cb(value)),
  onNavigate: (cb) => ipcRenderer.on('notch:navigate', (_e, name) => cb(name)),
  onClipboard: (cb) => ipcRenderer.on('notch:clipboard', (_e, entries) => cb(entries)),
  onClipboardPaused: (cb) => ipcRenderer.on('notch:clipboard-paused', (_e, paused) => cb(paused)),
  onSystem: (cb) => ipcRenderer.on('notch:system', (_e, sample) => cb(sample)),
  onLog: (cb) => ipcRenderer.on('notch:log', (_e, line) => cb(line)),
  onNetwork: (cb) => ipcRenderer.on('notch:network', (_e, trouble) => cb(trouble)),
});
