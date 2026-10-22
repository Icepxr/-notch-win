'use strict';
const { app, screen, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { placement } = require('../src/displays');
const path = require('node:path');
const fs = require('node:fs');
const profile = path.join(__dirname, '..', '.tmp', 'display-profile');
fs.mkdirSync(profile, { recursive: true }); app.setPath('userData', profile);
app.whenReady().then(async () => {
  const displays = screen.getAllDisplays();
  const win = new BrowserWindow({ show: false, frame: false, transparent: true, resizable: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true } });
  await win.loadURL('data:text/html,<title>Display placement test</title>');
  for (const display of displays) {
    const p = placement(display), bottom = (display.workArea || display.bounds).y + (display.workArea || display.bounds).height;
    assert.ok(p.bounds.x >= display.bounds.x);
    assert.ok(p.bounds.x + p.bounds.width <= display.bounds.x + display.bounds.width);
    assert.ok(p.bounds.y + p.bounds.height <= bottom);
    win.setBounds(p.bounds); win.webContents.setZoomFactor(p.zoomFactor);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const actual = win.getBounds();
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(actual[key] - p.bounds[key]) <= 1, 'native ' + key + ' matches requested DIP bounds');
  }
  win.destroy();
  console.log(JSON.stringify({ displays: displays.length, scales: displays.map((d) => d.scaleFactor), allPlacementsFit: true, nativeMovesVerified: true }));
  app.exit(0);
}).catch((error) => { console.error(error); app.exit(1); });
