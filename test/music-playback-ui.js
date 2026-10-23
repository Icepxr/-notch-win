'use strict';
// Synthetic media/IPC only; never changes Windows playback or reads user media.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const Appearance = require('../src/renderer/notch-appearance'), Geometry = require('../src/renderer/notch-geometry');
app.setPath('userData', path.join(__dirname, '..', '.tmp', 'music-playback-profile')); app.disableHardwareAcceleration();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  const commands = [], errors = []; let queued = true, checks = 0;
  const win = new BrowserWindow({ ...Geometry.hostSize, show: false, frame: false, transparent: true,
    webPreferences: { offscreen: true, contextIsolation: true, backgroundThrottling: false, preload: path.join(__dirname, 'fixtures', 'notch-preload.js') } });
  const cover = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#b84465"/><stop offset="1" stop-color="#29245b"/></linearGradient></defs><rect width="160" height="160" fill="url(#g)"/><circle cx="110" cy="36" r="60" fill="none" stroke="#f2b598" stroke-width="18" opacity=".6"/><path d="M0 127Q50 65 160 120v40H0" fill="#191a42"/><text x="14" y="138" font-family="sans-serif" font-size="14" fill="white">MIDNIGHT</text></svg>').toString('base64');
  const state = (status = 'Playing', values = {}) => ({ type: 'state', session: true, title: 'Midnight in Motion', artist: 'Local Artist', album: 'After Hours', app: 'chrome.exe',
    status, canPlay: true, canPause: true, canNext: true, canPrev: true, canSeek: true, duration: 240, position: 31, ...values });
  ipcMain.handle('fixture:init', () => ({ shelf: [], devices: [], clipboard: [], note: '', timer: { hasSession: false }, preferences: { ...Appearance.defaults, glass: 'off', musicPreview: false } }));
  ipcMain.handle('fixture:size', () => {});
  ipcMain.handle('fixture:media', async (_event, command) => { commands.push(command); await delay(100); return queued; });
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = code => win.webContents.executeJavaScript(code);
  const emit = (name, value) => win.webContents.send('fixture:' + name, value);
  const ack = (command, via = 'winrt') => emit('media-result', { type: 'command', id: command.playback.id, app: command.playback.app, action: command.action, via });
  const check = (value, message) => { assert.ok(value, message); checks++; console.log('  ok  ' + message); };
  async function shot(name) {
    await delay(550); const rect = await js(`(()=>{const r=card.getBoundingClientRect();return{x:Math.floor(r.x-20),y:0,width:Math.ceil(r.width+40),height:Math.ceil(r.height+32)}})()`);
    fs.writeFileSync(path.join(__dirname, '..', 'docs', 'previews', name + '.png'), (await win.webContents.capturePage(rect)).toPNG());
  }
  const icon = label => js(`els.npToggle.getAttribute('aria-label')===${JSON.stringify(label)}&&els.peekToggle.getAttribute('aria-label')===${JSON.stringify(label)}&&getComputedStyle(els.npToggle.querySelector('.icon-${label === 'Play' ? 'play' : 'pause'}')).display!=='none'`);
  try {
    await win.webContents.session.clearStorageData({ storages: ['localstorage'] }); await win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html')); await delay(250);
    await js(`openNotch('media');pointerInside=true;activityQueue.clear()`); emit('now-playing', state('Playing', { thumb: cover })); await delay(650);
    check(await js(`(()=>{const panel=document.querySelector('[data-panel="media"]'),player=document.querySelector('.np');return player.clientWidth>=panel.clientWidth-1&&els.npArt.offsetWidth===76&&getComputedStyle(els.npTitle.parentElement).fontSize==='16px'&&Math.round(card.getBoundingClientRect().height)===260})()`), 'larger artwork and type fill the music panel instead of a narrow floating column');
    await shot('music-fuller');
    check(await js(`els.npToggle.click();els.npToggle.getAttribute('aria-label')==='Play'&&!document.body.classList.contains('is-playing')`), 'Pause changes both icons and the equalizer synchronously before the IPC reply');
    await delay(30); check(commands[0].action === 'pause' && commands[0].playback.app === 'chrome.exe', 'playback uses an explicit action and the displayed player identity');
    emit('now-playing', state()); await delay(40); check(await icon('Play'), 'an old Windows Playing poll cannot flash the pause icon back');
    ack(commands[0]); await delay(40); check(await icon('Play'), 'the command acknowledgement keeps the requested icon while status catches up');
    emit('now-playing', state('Paused')); await delay(40); check(await js(`!playback.pending`) && await icon('Play'), 'the matching Paused observation settles the request');
    const count = commands.length;
    check(await js(`els.npToggle.click();els.npToggle.getAttribute('aria-label')==='Pause'`), 'Play also changes its icon in the same click');
    await delay(25); await js(`els.npToggle.click();els.npToggle.click();els.npToggle.click()`); await delay(25);
    check(commands.length === count + 1 && await icon('Play'), 'rapid clicks keep the latest intent and coalesce behind one in-flight command');
    ack(commands[count]); await delay(35); check(commands.length === count + 2 && commands.at(-1).action === 'pause', 'only the final changed intent is sent after the first command');
    emit('now-playing', state()); ack(commands[count], 'none'); await delay(35); check(await icon('Play'), 'older command replies and polls cannot undo the final Pause');
    ack(commands.at(-1)); emit('now-playing', state('Paused')); await delay(40);
    queued = false; await js(`els.npToggle.click()`); await delay(140);
    check(await icon('Play') && await js(`els.mediaFeedback.textContent.includes('declined')&&!els.npToggle.disabled`), 'a failed queue restores observed playback with an operable retry'); queued = true;
    await js(`els.npToggle.click()`); await delay(30); const old = commands.at(-1);
    emit('now-playing', state('Paused', { app: 'Spotify.exe', title: 'Another player' })); await delay(35); ack(old, 'none'); await delay(35);
    check(await icon('Play') && await js(`media.app==='Spotify.exe'&&els.mediaFeedback.textContent===''`), 'changing players retires the old intent and ignores its late failure');
    await js(`pinned=false;setState('peek')`); await delay(550);
    check(await js(`els.peekToggle.click();state==='peek'&&els.peekToggle.getAttribute('aria-label')==='Pause'`), 'compact Play responds immediately without opening the notch'); await delay(30);
    ack(commands.at(-1)); emit('now-playing', state('Playing', { app: 'Spotify.exe', title: 'Another player' })); await delay(40);
    await js(`openNotch('media');applyPreferences({...preferences,expandedWidth:480})`);
    emit('now-playing', state('Playing', { title: 'เรื่องเล่าและเสียงเพลงยามค่ำคืน — A very long title for the smallest music notch', sources: ['chrome.exe', 'Spotify.exe'], selectedSource: 'chrome.exe', duration: 3798, thumb: cover })); await delay(650);
    check(await js(`(()=>{const p=document.querySelector('[data-panel="media"]'),bar=document.querySelector('.np-progress'),buttons=document.querySelector('.np-buttons');return p.scrollWidth<=p.clientWidth&&p.scrollHeight<=p.clientHeight+1&&bar.getBoundingClientRect().width>=p.clientWidth-1&&buttons.getBoundingClientRect().bottom<=p.getBoundingClientRect().bottom})()`), 'long titles, hour-long tracks, player selection and larger controls fit the narrowest notch');
    await shot('music-fuller-narrow');
    assert.deepEqual(errors, []); console.log('Music playback UI: ' + checks + ' latency/state/layout checks passed'); app.exit(0);
  } catch (error) { console.error(error); console.error(errors); app.exit(1); }
});
