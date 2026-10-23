'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const M = require('../src/renderer/notch-modules');
const A = require('../src/renderer/notch-appearance');
const G = require('../src/renderer/notch-geometry');
app.setPath('userData', path.join(__dirname, '..', '.tmp', 'settings-source-profile'));
app.disableHardwareAcceleration();
let preferences = { ...A.defaults, ...M.normalize(), displayId: 1, displayMode: 'selected', silhouette: 'notch' };
const displayState = { mode: 'selected', preferredDisplayId: 1, activeDisplayId: 1, displays: [{ id: 1, label: 'Laptop', primary: true }, { id: 2, label: 'Studio' }] };
const state = () => ({ preferences, displayState, about: { alias: 'Demo PC', version: '0.1.0', electron: process.versions.electron } });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  let opened = null, menus = 0;
  ipcMain.handle('fixture:init', () => ({ shelf: [], devices: [], preferences, note: '', timer: { hasSession: false } }));
  ipcMain.handle('fixture:context-menu', () => { menus++; return true; });
  ipcMain.handle('fixture:panel-init', state);
  ipcMain.handle('fixture:preferences', (_event, patch) => {
    preferences = { ...preferences, ...patch, ...M.normalize({ ...preferences, ...patch }) };
    win.webContents.send('fixture:panel-state', state()); notchWin.webContents.send('fixture:preferences', { ok: true, ...state() }); return { ok: true, ...state() };
  });
  ipcMain.handle('fixture:panel-open-module', (_event, tab) => { opened = tab; notchWin.webContents.send('fixture:navigate', tab); return true; });
  const win = new BrowserWindow({ width: 960, height: 760, frame: false, show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, preload: path.join(__dirname, 'fixtures', 'panel-preload.js') } });
  const notchWin = new BrowserWindow({ ...G.hostSize, frame: false, show: false, transparent: true,
    webPreferences: { offscreen: true, backgroundThrottling: false, contextIsolation: true, preload: path.join(__dirname, 'fixtures', 'notch-preload.js') } });
  const errors = [];
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = code => win.webContents.executeJavaScript(code);
  const njs = code => notchWin.webContents.executeJavaScript(code);
  const capture = async name => { const out = path.join(__dirname,'..','docs','previews'); fs.mkdirSync(out,{recursive:true}); fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG()); };
  try {
    await notchWin.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html')); await delay(200);
    await win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'settings.html')); await delay(400);
    assert.equal(await js(`document.querySelector('#settings-page-title').textContent`), 'Dynamic Island');
    assert.equal(await js(`Math.round(document.querySelector('.settings-sidebar').getBoundingClientRect().width)`), 210);
    assert.equal(await js(`document.querySelectorAll('.settings-page:not([hidden])').length`), 1);
    await capture('source-settings-layout');
    await js(`document.querySelector('[data-settings-tab="content"][role="tab"]').click()`);
    assert.equal(await js(`document.querySelectorAll('.module-setting').length`), 7);
    await js(`document.querySelector('[data-module="media"] [data-direction="-1"]').click()`); await delay(100);
    assert.equal(preferences.moduleOrder[0], 'media');
    assert.equal(await njs(`els.tabs.firstElementChild.dataset.tab`), 'media');
    assert.equal(await js(`document.querySelector('#module-editor').firstElementChild.dataset.module`), 'media');
    await js(`{const dt=new DataTransfer();document.querySelector('[data-module="media"] .module-grip').dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));document.querySelector('[data-module="notes"]').dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));document.querySelector('[data-module="notes"]').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));}`); await delay(100);
    assert.equal(preferences.moduleOrder.at(-1), 'media');
    assert.equal(await njs(`els.tabs.querySelectorAll('.tab')[6].dataset.tab`), 'media');
    const beforeCancelledDrag = preferences.moduleOrder.join();
    await js(`{const grip=document.querySelector('[data-module="send"] .module-grip');const dt=new DataTransfer();grip.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));grip.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dt}));}`); await delay(50);
    assert.equal(preferences.moduleOrder.join(), beforeCancelledDrag);
    await js(`document.querySelector('#module-visible-send').click()`); await delay(100);
    assert.ok(preferences.hiddenModules.includes('send'));
    assert.equal(await njs(`els.tabs.querySelector('[data-tab="send"]').hidden`), true);
    for (const id of M.ids.filter(id => !['send','media'].includes(id))) { await js(`document.querySelector('#module-visible-${id}').click()`); await delay(30); }
    assert.equal(await js(`document.querySelector('#module-visible-media').disabled`), true);
    await js(`window.panel.update({moduleOrder:NotchModules.ids,hiddenModules:[]})`); await delay(100);
    await js(`document.querySelector('[data-module="timer"] [data-open-module]').click()`); await delay(60); assert.equal(opened, 'timer');
    assert.equal(await njs(`activeTab`), 'timer');
    await njs(`card.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))`); await delay(40); assert.equal(menus, 1);
    notchWin.webContents.send('fixture:menu-action', 'pin'); await delay(40); assert.equal(await njs(`pinned`), true);
    notchWin.webContents.send('fixture:menu-action', 'collapse'); await delay(60); assert.equal(await njs(`state`), 'closed');
    notchWin.webContents.send('fixture:menu-action', 'explore'); await delay(60); assert.equal(await njs(`exploring`), true);
    await capture('source-settings-content');
    await js(`{const s=document.querySelector('.settings-search input');s.value='Resting width';s.dispatchEvent(new Event('input'));}`);
    assert.equal(await js(`document.querySelectorAll('#settings-results button').length`), 1);
    await js(`document.querySelector('#settings-results button').click()`);
    assert.equal(await js(`document.querySelector('[role="tab"][aria-selected="true"]').textContent`), 'Layout');
    assert.equal(await js(`document.activeElement.id`), 'closed-width');
    await js(`{const b=document.querySelector('#settings-tab-layout');b.focus();b.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));}`);
    assert.equal(await js(`document.activeElement.id`), 'settings-tab-content');
    await js(`document.querySelector('[data-page="displays"]').click()`); await delay(100);
    await capture('source-settings-displays');
    await js(`document.querySelector('#settings-back').click()`);
    assert.equal(await js(`document.querySelector('#settings-page-title').textContent`), 'Dynamic Island');
    await js(`document.querySelector('[data-page="music"]').click()`);
    assert.equal(await js(`document.querySelector('[data-preference="musicColors"]').closest('.settings-page').hidden`), false);
    await capture('source-settings-music');
    win.setSize(740,540); await delay(180);
    for (const [page,tab] of [['island','layout'],['island','content'],['displays',''],['music','']]) {
      await js(`SettingsNavigation.showPage('${page}','${tab}')`);
      assert.ok(await js(`document.querySelector('.sheet').scrollWidth <= document.querySelector('.sheet').clientWidth + 1`), page + ' fits narrow detail');
    }
    win.setSize(600,480); await delay(150); await js(`SettingsNavigation.showPage('island','layout')`);
    assert.ok(await js(`document.querySelector('.sheet').scrollWidth <= document.querySelector('.sheet').clientWidth + 1`), 'small monitor has no horizontal settings overflow');
    assert.deepEqual(errors, []);
    console.log('Settings source port: sidebar, tabs, live notch order/visibility, last module, launch, context actions, search, keyboard/history and narrow-window layout passed');
    app.exit(0);
  } catch(error) { console.error(error); console.error(errors); app.exit(1); }
});
