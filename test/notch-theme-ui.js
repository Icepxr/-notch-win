'use strict';
// Opaque black pixel checks with synthetic artwork and legacy preferences.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const Geometry = require('../src/renderer/notch-geometry'), Appearance = require('../src/renderer/notch-appearance');
app.setPath('userData', path.join(__dirname, '..', '.tmp', 'black-theme-profile')); app.disableHardwareAcceleration();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  const legacy = { ...Appearance.defaults, surfaceTint: '#30213e', accentColor: '#00ff00', glass: 'high', musicColors: true, musicPreview: false };
  const win = new BrowserWindow({ ...Geometry.hostSize, show: false, frame: false, transparent: true,
    webPreferences: { offscreen: true, contextIsolation: true, backgroundThrottling: false, preload: path.join(__dirname, 'fixtures', 'notch-preload.js') } });
  ipcMain.handle('fixture:init', () => ({ shelf: [], devices: [], clipboard: [], note: '', timer: { hasSession: false }, preferences: legacy }));
  ipcMain.handle('fixture:size', () => {});
  const errors = []; let checks = 0;
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = code => win.webContents.executeJavaScript(code);
  const check = (value, text) => { assert.ok(value, text); checks++; console.log('  ok  ' + text); };
  function cover(rgb) { return 'data:image/png;base64,' + require('../src/png').encodePNG(8,8,Buffer.from(Array.from({length:64},()=>[...rgb,255]).flat())).toString('base64'); }
  async function music(name, art) {
    win.webContents.send('fixture:now-playing', { type: 'state', session: true, title: name, artist: 'Local artist', app: 'Spotify.exe', status: 'Playing', duration: 240, position: 45, canPlay: true, canPause: true, canSeek: true, thumb: art }); await delay(180);
  }
  async function blackPixel() {
    const point = await js(`(()=>{const r=card.getBoundingClientRect();return{x:Math.round(r.x+6),y:Math.round(r.y+r.height/2),width:1,height:1}})()`);
    const pixel = (await win.webContents.capturePage(point)).toBitmap();
    return pixel.length >= 4 && pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0 && pixel[3] === 255;
  }
  async function shot(name) {
    const rect = await js(`(()=>{const r=card.getBoundingClientRect();return{x:Math.floor(r.x-20),y:0,width:Math.ceil(r.width+40),height:Math.ceil(r.height+32)}})()`);
    fs.writeFileSync(path.join(__dirname,'..','docs','previews',name+'.png'),(await win.webContents.capturePage(rect)).toPNG());
  }
  try {
    await win.webContents.session.clearStorageData({ storages: ['localstorage'] }); await win.loadFile(path.join(__dirname,'..','src','renderer','index.html')); await delay(300);
    await js(`openNotch('media');pointerInside=true;activityQueue.clear()`); await delay(600);
    check(await js(`preferences.surfaceTint==='#000000'&&preferences.accentColor==='#ffffff'&&preferences.glass==='off'`), 'legacy saved theme and glass values cannot change the black surface');
    await music('Teal cover',cover([0,170,170]));
    check(await js(`document.querySelector('.np').style.getPropertyValue('--music-accent')==='#0febeb'&&getComputedStyle(els.npFill).backgroundColor==='rgb(15, 235, 235)'`), 'source averaged tint reaches only the music meter');
    check(await js(`document.documentElement.style.getPropertyValue('--accent')==='#ffffff'&&!document.body.style.getPropertyValue('--artwork-rgb')&&!document.body.style.getPropertyValue('--artwork-url')&&!document.documentElement.style.getPropertyValue('--mood')`), 'artwork does not write any global theme or backdrop token');
    check(await js(`getComputedStyle(els.npTime).color===getComputedStyle(els.npFill).backgroundColor&&getComputedStyle(document.querySelector('.expanded-duration')).color===getComputedStyle(els.npTime).color&&getComputedStyle(document.querySelector('.shell-content'),'::before').display==='none'&&getComputedStyle(document.querySelector('.shell-content'),'::after').boxShadow==='none'`), 'readable time labels follow the music while the backdrop and shell edge remain neutral');
    for (const tab of ['send','media','clipboard','system','ai','timer','notes']) {
      await js(`setTab(${JSON.stringify(tab)});activityQueue.clear()`); await delay(550);
      check(await blackPixel() && await js(`getComputedStyle(card).backgroundColor==='rgb(0, 0, 0)'&&getComputedStyle(card).backgroundImage==='none'`), tab + ' keeps an opaque black shell while music plays');
    }
    await js(`setTab('media');applyPreferences({...preferences,musicColors:false})`); await delay(250);
    check(await js(`document.querySelector('.np').style.getPropertyValue('--music-accent')==='#ffffff'&&getComputedStyle(els.npFill).backgroundColor==='rgb(255, 255, 255)'`), 'turning artwork colors off immediately restores white music meters');
    await js(`applyPreferences({...preferences,musicColors:true})`);
    check(await js(`getComputedStyle(els.npFill).backgroundColor==='rgb(15, 235, 235)'`), 'turning artwork colors back on reuses the current cover without reloading it');
    await music('White cover',cover([255,255,255]));
    check(await js(`!document.querySelector('.np').classList.contains('music-tinted')&&getComputedStyle(els.npFill).backgroundColor==='rgb(255, 255, 255)'`) && await blackPixel(), 'neutral artwork restores white without changing the black surface');
    await music('Red cover',cover([220,30,30])); await music('No cover',null);
    check(await js(`getComputedStyle(els.npFill).backgroundColor==='rgb(255, 255, 255)'`), 'missing artwork clears the previous song tint');
    await music('Blue cover',cover([0,0,220]));
    check(await js(`NotchAppearance.contrast(document.querySelector('.np').style.getPropertyValue('--music-accent'),'#000000')>=3`), 'a dark artwork hue stays visible on the interactive meter');
    check(await js(`NotchAppearance.contrast(document.querySelector('[data-panel="media"]').style.getPropertyValue('--expanded-time-accent'),'#000000')>=4.5`), 'dark artwork also supplies a readable text accent without changing the meter or hover');
    await shot('black-theme-music');
    await js(`pinned=false;setState('peek')`); await delay(600);
    check(await blackPixel() && await js(`getComputedStyle(document.querySelector('.equalizer i')).backgroundColor!==getComputedStyle(card).backgroundColor`), 'compact music uses a tinted equalizer on an opaque black strip');
    await js(`collapseNotch()`); await delay(600); check(await blackPixel(), 'resting music keeps the same opaque black base');
    await js(`openNotch('media');applyPreferences({...preferences,silhouette:'capsule',glass:'medium',surfaceTint:'#ffffff',accentColor:'#ff0000'})`); await delay(600);
    check(await blackPixel() && await js(`preferences.surfaceTint==='#000000'&&preferences.accentColor==='#ffffff'`), 'capsule and legacy white-theme patches remain black too');
    win.webContents.send('fixture:now-playing',{type:'state',session:false});await delay(180);
    check(await js(`document.querySelector('.np').style.getPropertyValue('--music-accent')==='#ffffff'&&document.querySelector('.equalizer').style.getPropertyValue('--music-accent')==='#ffffff'`), 'ending playback clears both music-only tint scopes');
    assert.deepEqual(errors,[]); console.log('Black theme: '+checks+' rendered-pixel/color-scope checks passed'); app.exit(0);
  } catch(error) { console.error(error); console.error(errors); app.exit(1); }
});
