'use strict';

// Synthetic data only. This bridge never reads files, the clipboard or LAN.
const { contextBridge, ipcRenderer } = require('electron');
const listen = (name, cb) => ipcRenderer.on('fixture:' + name, (_event, value) => cb(value));
contextBridge.exposeInMainWorld('notch', {
  init: () => ipcRenderer.invoke('fixture:init'),
  onDisplays: (cb) => listen('displays', cb),
  setInteraction: () => {},
  refreshAi: () => ipcRenderer.invoke('fixture:ai-refresh'),
  onAiDashboard: (cb) => listen('ai-dashboard', cb),
  onAiComplete: (cb) => listen('ai-complete', cb),
  setSize: (width, height) => ipcRenderer.invoke('fixture:size', { width, height }),
  setHitRegion: () => {},
  focus: () => {}, releaseFocus: () => {},
  timerCommand: (action, options) => ipcRenderer.invoke('fixture:timer', { action, options }),
  saveNote: (value) => ipcRenderer.invoke('fixture:note', value),
  cacheNote: () => {},
  updatePreferences: (value) => ipcRenderer.invoke('fixture:preferences', value),
  openSettings: () => ipcRenderer.send('fixture:open-settings'),
  onPreferences: (cb) => listen('preferences', cb),
  pathForFile: () => 'C:\\Demo\\Notes.pdf',
  addFiles: () => Promise.resolve({ added: 1, rejected: [] }),
  sendTo: () => ipcRenderer.invoke('fixture:send'),
  removeItem: () => {}, clearShelf: () => {}, reveal: () => {},
  mediaCommand: (action, value) => ipcRenderer.invoke('fixture:media', { action, value }), dragOut: () => {}, quit: () => {},
  clipPick: () => Promise.resolve(true), clipRemove: () => {},
  clipClear: () => {}, clipPause: () => {},
  onDevices: (cb) => listen('devices', cb), onShelf: (cb) => listen('shelf', cb),
  onTransfer: (cb) => listen('transfer', cb), onNowPlaying: (cb) => listen('now-playing', cb),
  onAiSessions: (cb) => listen('ai', cb), onToggle: (cb) => listen('toggle', cb),
  onPointer: (cb) => listen('pointer', cb), onClipboard: (cb) => listen('clipboard', cb),
  onDismiss: (cb) => listen('dismiss', cb), onMediaResult: (cb) => listen('media-result', cb),
  onTimer: (cb) => listen('timer', cb),
  onNavigate: (cb) => listen('navigate', cb),
  onClipboardPaused: (cb) => listen('paused', cb), onSystem: (cb) => listen('system', cb),
  onLog: () => {},
});
