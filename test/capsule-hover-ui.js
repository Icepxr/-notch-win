'use strict';
// Exercise real hover events and the settled contour after Web Animations ends.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const Geometry = require('../src/renderer/notch-geometry'), Appearance = require('../src/renderer/notch-appearance');
app.setPath('userData', path.join(__dirname, '..', '.tmp', 'capsule-hover-profile'));
app.disableHardwareAcceleration();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ ...Geometry.hostSize, show: false, frame: false, transparent: true,
    webPreferences: { offscreen: true, contextIsolation: true, backgroundThrottling: false, preload: path.join(__dirname, 'fixtures', 'notch-preload.js') } });
  ipcMain.handle('fixture:init', () => ({ shelf: [], devices: [], clipboard: [], note: '', timer: { hasSession: false },
    preferences: { ...Appearance.defaults, silhouette: 'capsule', musicPreview: false } }));
  ipcMain.handle('fixture:size', () => {});
  const errors = [], failures = []; let checks = 0;
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const js = code => win.webContents.executeJavaScript(code);
  const emit = (name, value) => win.webContents.send('fixture:' + name, value);
  const check = (value, text) => { checks++; if (!value) failures.push(text); console.log((value ? '  ok  ' : '  FAIL  ') + text); };
  async function contour(label, capsule = true) {
    const shape = await js(`(()=>{const s=getComputedStyle(card),r=card.getBoundingClientRect();return{
      width:r.width,height:r.height,radii:[s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomRightRadius,s.borderBottomLeftRadius].map(parseFloat),
      shoulders:[getComputedStyle(card,'::before').display,getComputedStyle(card,'::after').display],
      animating:!!currentMorph,silhouette:preferences.silhouette}})()`);
    const radius = Math.min(28, shape.height * (capsule ? .5 : .34));
    check(!shape.animating && shape.radii.every((r,i) => Math.abs(r - (!capsule && i < 2 ? 0 : radius)) < .1)
      && shape.shoulders.every(display => (display === 'none') === capsule), label);
  }
  async function shot(name) {
    // A neutral desktop backdrop makes the black contour visible in previews.
    await js(`document.documentElement.style.background='#303036'`); await delay(40);
    const rect = await js(`(()=>{const r=card.getBoundingClientRect();return{x:Math.floor(r.x-16),y:0,width:Math.ceil(r.width+32),height:Math.ceil(r.height+24)}})()`);
    fs.writeFileSync(path.join(__dirname,'..','docs','previews',name+'.png'), (await win.webContents.capturePage(rect)).toPNG());
    await js(`document.documentElement.style.removeProperty('background')`); await delay(40);
  }
  try {
    await win.webContents.session.clearStorageData({ storages: ['localstorage'] });
    await win.loadFile(path.join(__dirname,'..','src','renderer','index.html')); await delay(700);
    check(await js(`!document.querySelector('#closed-count .ready-dot')`), 'an empty shelf never mounts the green ready dot that could flash on hover');
    await contour('resting capsule has equal semicircular ends after the animation is released');
    emit('pointer', true); await delay(700);
    check(await js(`state==='peek'&&preferences.silhouette==='capsule'`), 'pointer entry opens the preview without changing the chosen silhouette');
    await contour('idle hover keeps four equal rounded capsule corners'); await shot('capsule-hover-idle');
    emit('pointer', false); await delay(900); await contour('leaving hover returns to the same rounded resting capsule');
    emit('now-playing', { type: 'state', session: true, title: 'Quiet morning', artist: 'Local artist', app: 'Spotify.exe', status: 'Playing', duration: 240, position: 45 });
    await delay(650); emit('pointer', true); await delay(700);
    await contour('music hover stays capsule after the more-specific media CSS and animation finish');
    await shot('capsule-hover-music');
    const pixels = await js(`(()=>{const r=card.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}})()`);
    const bitmap = (await win.webContents.capturePage(pixels)).toBitmap();
    const alpha = (x,y) => bitmap[(y * pixels.width + x) * 4 + 3];
    check(alpha(1,1) < 100 && alpha(pixels.width-2,1) < 100 && alpha(1,pixels.height-2) < 100 && alpha(pixels.width-2,pixels.height-2) < 100
      && alpha(Math.floor(pixels.width/2),1) === 255, 'actual music hover pixels have four cut-away round corners and an opaque middle');
    const now=Date.now(),dashboard={updatedAt:now,providers:['claude'],buckets:[],limits:{},claudeAccountStatus:'ready',
      sessions:Array.from({length:3},(_,i)=>({provider:'claude',sessionId:'hover-'+i,name:'Local task '+(i+1),status:'idle',statusAt:now,startedAt:now-60000,inferred:false}))};
    emit('ai-dashboard',dashboard); await delay(150);
    check(await js(`document.body.classList.contains('ai-waiting')&&!document.querySelector('#peek-ai,.layer-peek .ai-dot')`), 'three waiting AI sessions cannot add the green dot/count badge beside the song');
    await shot('capsule-music-no-green-badge');
    dashboard.sessions[0].status='busy'; emit('ai-dashboard',dashboard); await delay(150);
    check(await js(`document.body.classList.contains('ai-working')&&!document.querySelector('#peek-ai,.layer-peek .ai-dot')&&document.querySelector('.focus-option[data-activity="agent"] .provider-logo')`), 'working and waiting agents use the existing activity picker without the redundant badge');
    await js(`openNotch('ai')`); await delay(650);
    check(await js(`aiSessions.length===3&&document.getElementById('ai-live-summary').textContent.includes('1 working')&&document.getElementById('ai-live-summary').textContent.includes('2 waiting')&&document.querySelector('.ai-live-row .ai-dot.is-waiting')`), 'the AI page retains the three-session summary and meaningful waiting states');
    await js(`openedByClick=false;setState('peek');applyPreferences({...preferences,silhouette:'notch'})`); await delay(650);
    check(await js(`!document.querySelector('#peek-ai,.layer-peek .ai-dot')&&getComputedStyle(card).borderTopLeftRadius==='0px'`), 'attached-notch music hover also has no green activity badge');
    emit('ai-dashboard',{...dashboard,sessions:[]}); await js(`applyPreferences({...preferences,silhouette:'capsule'})`); await delay(650);
    await js(`openNotch('media')`); await delay(650); await contour('expanded capsule keeps the source 28px corners on all sides');
    await shot('capsule-open-music');
    await js(`collapseNotch()`); await delay(600); emit('pointer', false); await delay(40); emit('pointer', true); await delay(700);
    await contour('collapse then hover cannot revert the music capsule to an attached notch');
    await js(`applyPreferences({...preferences,silhouette:'notch'})`); await delay(600); await contour('switching to notch restores square top corners and shoulders', false);
    await js(`applyPreferences({...preferences,silhouette:'capsule'})`); await delay(600); await contour('switching back while music is hovered restores all capsule corners');
    check(await js(`(()=>{const r=card.getBoundingClientRect(),s=getComputedStyle(card),region={x:r.x,y:r.y,width:r.width,height:r.height,topRadius:parseFloat(s.borderTopLeftRadius),radius:parseFloat(s.borderBottomLeftRadius)};return !NotchGeometry.contains(region,r.x+1,r.y+1)&&NotchGeometry.contains(region,r.x+r.width/2,r.y+1)})()`), 'capsule click-through excludes the rounded top corners while accepting its middle');
    await js(`pointerLeft();setState('closed')`); await delay(70); emit('pointer',true); await delay(100); await js(`setState('open')`); await delay(70); await js(`setState('peek')`); await delay(700);
    await contour('rapid hover/open reversals settle to a capsule without leftover animation styles');
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await js(`setState('closed')`); await delay(80); await contour('reduced motion keeps the same circular resting geometry');
    await js(`hoverSuppressed=false;pointerEntered()`); await delay(180); await contour('reduced-motion music hover also retains the capsule');
    await js(`pointerInside=true;openNotch('send')`); emit('shelf', [{ id: 'demo', name: 'Notes.pdf', ext: 'pdf', size: 100 }]); await delay(100);
    check(await js(`els.closedCount.textContent==='1'&&!els.closedCount.querySelector('.ready-dot')`), 'actual parked files still retain their compact count');
    emit('shelf', []); await delay(80);
    check(await js(`els.closedCount.childElementCount===0&&els.closedCount.textContent===''`), 'clearing the shelf never recreates the decorative ready dot');
    assert.deepEqual(errors, []); assert.deepEqual(failures, []);
    console.log('Capsule hover: '+checks+' contour/pixel/interaction checks passed'); app.exit(0);
  } catch(error) { console.error(error); console.error(errors); app.exit(1); }
});
