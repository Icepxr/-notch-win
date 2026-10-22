'use strict';

// Fixture bridge for the control panel window. Synthetic preferences only;
// nothing here touches real settings on disk.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('panel', {
  init: () => ipcRenderer.invoke('fixture:panel-init'),
  update: (patch) => ipcRenderer.invoke('fixture:preferences', patch),
  onState: (cb) => ipcRenderer.on('fixture:panel-state', (_event, value) => cb(value)),
  revealData: () => {},
  close: () => {},
  minimize: () => {},
});
