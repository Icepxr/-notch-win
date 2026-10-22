'use strict';

// The control panel window reads and writes preferences and nothing else.
// It never sees the clipboard, the file shelf, devices or AI session data,
// so its bridge stays deliberately narrower than the notch's.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('panel', {
  init: () => ipcRenderer.invoke('panel:init'),
  update: (patch) => ipcRenderer.invoke('panel:update', patch),
  onState: (cb) => ipcRenderer.on('panel:state', (_e, value) => cb(value)),
  revealData: () => ipcRenderer.send('panel:reveal-data'),
  close: () => ipcRenderer.send('panel:close'),
  minimize: () => ipcRenderer.send('panel:minimize'),
});
