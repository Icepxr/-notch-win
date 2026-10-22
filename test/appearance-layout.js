'use strict';
// Focused layout regression: custom widths must update a long music title.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const Appearance = require('../src/renderer/notch-appearance');
const Geometry = require('../src/renderer/notch-geometry');
app.setPath('userData', path.join(__dirname, '..', '.tmp', 'appearance-layout-profile'));
app.disableHardwareAcceleration();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  ipcMain.handle('fixture:init', () => ({ shelf: [], devices: [], preferences: Appearance.defaults, note: '', timer: { hasSession: false } }));
  const win = new BrowserWindow({ ...Geometry.hostSize, show: false, frame: false, transparent: true,
    webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true,
      preload: path.join(__dirname, 'fixtures', 'notch-preload.js') } });
  const js = code => win.webContents.executeJavaScript(code);
  try {
    await win.webContents.session.clearStorageData({ storages: ['localstorage'] });
    await win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html')); await delay(300);
    await js(`openNotch('media')`);
    win.webContents.send('fixture:now-playing', { type: 'state', session: true, title: 'A wonderfully long track title that should move only as far as the available space requires', artist: 'Local artist', app: 'Spotify.exe', status: 'Playing', duration: 240, position: 20 });
    async function width(value) {
      win.setSize(692, 554);
      win.webContents.send('fixture:preferences', { preferences: { ...Appearance.defaults, expandedWidth: value } });
      await delay(240);
      return js(`(() => ({ overflow: els.npTitle.scrollWidth - els.npTitle.parentElement.clientWidth, shift: parseFloat(els.npTitle.style.getPropertyValue('--marquee-shift')), duration: parseFloat(els.npTitle.style.getPropertyValue('--marquee-dur')) }))()`);
    }
    const wide = await width(640), narrow = await width(480);
    assert.equal(narrow.overflow - wide.overflow, 160);
    assert.equal(narrow.shift, -narrow.overflow);
    assert.ok(narrow.duration > wide.duration);
    console.log('Appearance layout: a long music title remeasures once at the selected natural width');
    await width(520);
    const now = Date.now();
    const data = { updatedAt: now, buckets: [], sessions: [], limits: {}, claudeAccountStatus: 'signin' };
    win.webContents.send('fixture:ai-dashboard', data);
    await js(`openNotch('ai'); document.querySelector('[data-ai-provider="claude"]').click(); document.querySelector('[data-panel="ai"]').scrollTop = 0`);
    await delay(800);
    const output = path.join(__dirname, '..', 'docs', 'previews'); fs.mkdirSync(output, { recursive: true });
    const rect = await js(`(() => { const r=card.getBoundingClientRect(); return {x:Math.floor(r.x-20),y:0,width:Math.ceil(r.width+40),height:Math.ceil(r.height+32)} })()`);
    fs.writeFileSync(path.join(output, 'ai-claude-signin.png'), (await win.webContents.capturePage(rect)).toPNG());
    win.webContents.send('fixture:ai-dashboard', { ...data, claudeAccountStatus: 'ready', limits: { claude: { source: 'account', observedAt: now, plan: 'Claude', windows: [{ used: 26, minutes: 300, resetsAt: now + 3600000 }, { used: 40, minutes: 10080, scope: 'Opus', resetsAt: now + 86400000 }] } } });
    await delay(250);
    fs.writeFileSync(path.join(output, 'ai-claude.png'), (await win.webContents.capturePage(rect)).toPNG());
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
