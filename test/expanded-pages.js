'use strict';
// Offscreen only. Never starts production services or opens a crash dialog.
let electron, assert, fs, path, Geometry, Appearance, Modules, expandedChecks;
try {
  electron = require('electron'); assert = require('node:assert/strict');
  fs = require('node:fs'); path = require('node:path');
  Geometry = require('../src/renderer/notch-geometry'); Appearance = require('../src/renderer/notch-appearance'); Modules = require('../src/renderer/notch-modules');
  expandedChecks = require('./expanded-pages-checks');
} catch (error) { process.stderr.write(String(error.stack || error)); process.exit(1); }
const { app, BrowserWindow, ipcMain } = electron;
const p = (...parts) => path.resolve(__dirname, '..', ...parts).replaceAll('\\', '/');
const baseline = process.argv.includes('--baseline');
app.setPath('userData', p('.tmp', 'expanded-pages-profile')); app.disableHardwareAcceleration();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  let checks = 0; const errors = [], windows = [], metrics = {};
  const preferences = { ...Appearance.defaults, ...Modules.normalize(), musicPreview: false, silhouette: 'notch' };
  const displayState = { mode: 'selected', activeDisplayId: 1, preferredDisplayId: 1, displays: [{ id: 1, label: 'Test display', primary: true }] };
  ipcMain.handle('fixture:init', () => ({ shelf: [], devices: [], clipboard: [], note: '', timer: { hasSession: false }, preferences }));
  ipcMain.handle('fixture:size', () => {});
  ipcMain.handle('fixture:panel-init', () => ({ preferences, displayState, about: { alias: 'Test PC', version: '0.1.0' } }));
  ipcMain.handle('fixture:media', () => true);
  ipcMain.handle('fixture:ai-refresh', () => ({ providers: [], sessions: [], buckets: [], limits: {}, accountStatus: 'unavailable' }));
  ipcMain.handle('fixture:note', () => true); ipcMain.handle('fixture:note-copy', () => true);
  ipcMain.handle('fixture:preferences', () => ({ ok: true, preferences }));
  const win = new BrowserWindow({ ...Geometry.hostSize, frame: false, transparent: true, show: false,
    webPreferences: { offscreen: true, contextIsolation: true, backgroundThrottling: false, preload: p('test/fixtures/notch-preload.js') } });
  windows.push(win);
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = source => win.webContents.executeJavaScript(source);
  const emit = (name, value) => win.webContents.send('fixture:' + name, value);
  const check = (value, label) => { assert.ok(value, label); checks++; console.log('  ok  ' + label); };
  async function snapshot(id) {
    fs.mkdirSync(p('docs/previews'), { recursive: true });
    const rect = await js(`(()=>{const r=card.getBoundingClientRect();return{x:Math.max(0,Math.floor(r.x-16)),y:0,width:Math.ceil(r.width+32),height:Math.ceil(r.height+24)}})()`);
    fs.writeFileSync(p('docs/previews/expanded-' + id + '.png'), (await win.webContents.capturePage(rect)).toPNG());
  }
  try {
    await win.loadFile(p('src/renderer/index.html')); await delay(800);
    metrics.stylesheets = await js(`Array.from(document.styleSheets,s=>s.href?.split('/').pop())`);
    const art = 'data:image/svg+xml;base64,' + fs.readFileSync(p('test/fixtures/music-cover.svg')).toString('base64');
    const media = { type: 'state', session: true, title: 'Midnight in Motion', artist: 'Local Artist', album: 'After Hours', app: 'Spotify.exe', status: 'Playing', duration: 240, position: 31, thumb: art,
      canPlay: true, canPause: true, canNext: true, canPrev: true, canSeek: true, sources: ['Spotify.exe', 'chrome.exe'] };
    emit('now-playing', media); await delay(100);
    for (const id of ['send', 'media', 'clipboard', 'system', 'ai', 'timer', 'notes']) {
      await js(`pointerInside=true;openNotch(${JSON.stringify(id)});activityQueue.clear()`); await delay(650);
      metrics[id] = await js(`(()=>{const panel=document.querySelector('[data-panel="${id}"]'),head=panel.querySelector('.expanded-page-header')||document.querySelector('.notch-header'),h=head.getBoundingClientRect(),layer=document.querySelector('.layer-open'),s=getComputedStyle(layer),body=panel.querySelector('.expanded-page-content')||panel;return{
        header:Math.round(h.height),headerWidth:Math.round(h.width),headingVisible:getComputedStyle(document.querySelector('.notch-heading')).display!=='none',
        padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft].map(parseFloat),gap:parseFloat(getComputedStyle(body).rowGap),actual:Math.round(card.getBoundingClientRect().height),
        content:Math.round(body.scrollHeight),request:window.ExpandedPages?.requestFor('${id}')||null,words:body.innerText.trim().length}})()`);
      if (!baseline) await snapshot(id);
    }
    const settings = new BrowserWindow({ width: 960, height: 760, frame: false, show: false,
      webPreferences: { offscreen: true, contextIsolation: true, preload: p('test/fixtures/panel-preload.js') } });
    windows.push(settings); await settings.loadFile(p('src/renderer/settings.html')); await delay(400);
    metrics.settings = await settings.webContents.executeJavaScript(`(()=>{const h=document.querySelector('.titlebar').getBoundingClientRect();return{header:h.height,stylesheets:Array.from(document.styleSheets,s=>s.href?.split('/').pop()),words:document.body.innerText.trim().length,externalWindow:true}})()`);
    if (!baseline) fs.writeFileSync(p('docs/previews/expanded-settings.png'), (await settings.webContents.capturePage()).toPNG());
    fs.mkdirSync(p('.tmp'), { recursive: true });
    fs.writeFileSync(p('.tmp', baseline ? 'expanded-before.json' : 'expanded-after.json'), JSON.stringify(metrics, null, 2));
    if (!baseline) {
      metrics.contract = await expandedChecks({ win, emit, check, ipcMain, snapshot });
      fs.writeFileSync(p('.tmp/expanded-after.json'), JSON.stringify(metrics, null, 2));
      check(await js(`!!window.ExpandedPages`), 'expanded-page contract is installed without editing renderer or geometry');
      for (const [id, reading] of Object.entries(metrics).filter(([id]) => !['stylesheets', 'settings', 'contract'].includes(id))) {
        check(reading.header === 28, id + ' has the common 28px header');
        check(reading.padding.join() === '16,28,16,28' && reading.gap === 10, id + ' shares the source insets and row rhythm');
        check(reading.request && Math.abs(reading.request.requested - Math.min(reading.request.max, Math.max(reading.request.min, reading.request.needed))) <= 1, id + ' requests its bounded content height');
        check(reading.words > 0, id + ' renders words while empty or waiting');
      }
      check(metrics.settings.externalWindow && !metrics.settings.stylesheets.includes('panels.css'), 'Settings is truthfully reported as a separate out-of-scope window');
    }
    assert.deepEqual(errors, []); console.log((baseline ? 'Baseline' : 'Expanded pages: ' + checks + ' checks') + ' measured; report saved in .tmp');
    app.exit(0);
  } catch (error) { console.error(error); console.error(errors); app.exit(1); }
}).catch(error => { console.error(error); app.exit(1); });
