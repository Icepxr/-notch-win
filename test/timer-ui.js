'use strict';
// Real renderer + real timer service on a controlled clock; isolated profile.
// No OS media, clipboard, network, system commands or actual timer notifications.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const Appearance = require('../src/renderer/notch-appearance'), Geometry = require('../src/renderer/notch-geometry');
const { NotchTimer } = require('../src/timer');
app.setPath('userData', path.join(__dirname, '..', '.tmp', 'timer-source-profile')); app.disableHardwareAcceleration();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  let now = 100, commands = 0, nativeSizes = 0, rejectCommand = false;
  const timer = new NotchTimer({ now: () => now });
  const win = new BrowserWindow({ ...Geometry.hostSize, show: false, frame: false, transparent: true,
    webPreferences: { offscreen: true, contextIsolation: true, backgroundThrottling: false, preload: path.join(__dirname, 'fixtures', 'notch-preload.js') } });
  ipcMain.handle('fixture:init', () => ({ shelf: [], devices: [], clipboard: [], note: '', timer: timer.snapshot(), preferences: { ...Appearance.defaults, glass: 'off' } }));
  ipcMain.handle('fixture:size', () => { nativeSizes++; });
  ipcMain.handle('fixture:timer', async (_event, { action, options }) => {
    commands++; await delay(50); if (rejectCommand) throw new Error('Synthetic timer failure'); return timer.command(action, options);
  });
  timer.on('change', state => win.webContents.send('fixture:timer', state));
  const js = code => win.webContents.executeJavaScript(code).catch(error => { throw new Error(error.message + '\n' + code); });
  const errors = []; let checks = 0;
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const check = (value, message) => { assert.ok(value, message); checks++; console.log('  ok  ' + message); };
  async function shot(name) {
    await delay(550); const rect = await js(`(()=>{const r=card.getBoundingClientRect();return{x:Math.floor(r.x-20),y:0,width:Math.ceil(r.width+40),height:Math.ceil(r.height+32)}})()`);
    fs.writeFileSync(path.join(__dirname, '..', 'docs', 'previews', name + '.png'), (await win.webContents.capturePage(rect)).toPNG());
  }
  const protocol = (name, args) => win.webContents.debugger.sendCommand(name, args);
  async function key(name, code) {
    await protocol('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: code });
    await protocol('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: code });
  }
  async function pointer(points) {
    await protocol('Input.dispatchMouseEvent', { type: 'mousePressed', x: points[0][0], y: points[0][1], button: 'left', buttons: 1, clickCount: 1 });
    for (const [x, y] of points.slice(1)) await protocol('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
    const [x, y] = points.at(-1); await protocol('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  }
  const setMinutes = value => js(`{const input=document.getElementById('timer-minutes');input.value='${value}';input.dispatchEvent(new Event('input',{bubbles:true}));}`);
  const click = selector => js(`document.querySelector(${JSON.stringify(selector)}).click()`);
  async function finish() { now += timer.snapshot().reading + 1; timer.finishIfDue(); timer.publish(); await delay(70); }
  try {
    await win.webContents.session.clearStorageData({ storages: ['localstorage'] });
    await win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html')); await delay(250);
    win.webContents.debugger.attach('1.3');
    await js(`openNotch('timer');pointerInside=true;activityQueue.clear()`); await delay(650);
    await setMinutes(25); await delay(180);
    check(await js(`(()=>{const ticks=document.querySelectorAll('.timer-ruler-tick'),r=document.querySelector('.timer-ruler').getBoundingClientRect(),t=ticks[24].getBoundingClientRect();return ticks.length===180&&Math.abs(t.x+t.width/2-r.x-r.width/2)<1&&document.getElementById('timer-clock').textContent==='25:00'})()`), 'selected minute sits at the center of the source ruler with a matching clock');
    const point = await js(`(()=>{const r=document.getElementById('timer-minutes').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await pointer([[point.x + 28, point.y]]);
    check(await js(`document.getElementById('timer-minutes').value==='27'`), 'a real pointer click selects the nearby minute instead of jumping across the full duration range');
    await pointer([[point.x, point.y], [point.x - 28, point.y]]);
    check(await js(`document.getElementById('timer-minutes').value==='29'&&!document.querySelector('.timer-ruler').classList.contains('is-adjusting')`), 'real pointer dragging moves the ruler relative to its current minute and releases capture');
    await setMinutes(179); await pointer([[point.x, point.y], [point.x - 28, point.y], [point.x - 14, point.y]]);
    check(await js(`document.getElementById('timer-minutes').value==='179'`), 'reversing at the duration boundary responds immediately without an overscroll dead zone');
    await setMinutes(30);
    await js(`{const input=document.getElementById('timer-minutes');for(let i=0;i<5;i++)input.dispatchEvent(new WheelEvent('wheel',{deltaY:3,bubbles:true,cancelable:true}));}`);
    check(await js(`document.getElementById('timer-minutes').value==='31'&&state==='open'&&activeTab==='timer'`), 'small trackpad deltas accumulate without changing the page or collapsing the notch');
    await js(`document.getElementById('timer-minutes').focus()`); await key('Home', 36); await key('ArrowRight', 39);
    check(await js(`document.getElementById('timer-minutes').value==='2'&&document.getElementById('timer-minutes').getAttribute('aria-valuetext')==='2 minutes'`), 'native keyboard Home and Arrow keys update the visual and spoken duration');
    await key('End', 35); await key('ArrowRight', 39);
    check(await js(`document.getElementById('timer-minutes').value==='180'`), 'native keyboard input keeps the maximum duration bounded');
    await setMinutes(42); await click('[data-mode="pomodoro"]'); await setMinutes(38);
    await js(`for(const [key,value] of Object.entries({shortBreak:7,longBreak:12,interval:2,sessions:3})){const select=document.querySelector('[data-timer-setting="'+key+'"]');select.value=value;select.dispatchEvent(new Event('change'));}`);
    await click('[data-mode="timer"]');
    check(await js(`document.getElementById('timer-minutes').value==='42'`), 'Timer and Focus remember independent durations');
    await click('[data-mode="pomodoro"]'); await delay(220);
    check(await js(`document.getElementById('timer-minutes').value==='38'&&document.querySelectorAll('.timer-cycle-settings option').length===168&&document.querySelector('[data-timer-setting="sessions"]').value==='3'`), 'all source break, interval and session values remain selectable');
    await shot('timer-focus-setup');
    await win.webContents.reload(); await delay(250); await js(`openNotch('timer');pointerInside=true;activityQueue.clear()`); await delay(600);
    check(await js(`document.querySelector('button[data-mode="pomodoro"]').getAttribute('aria-pressed')==='true'&&document.getElementById('timer-minutes').value==='38'&&document.querySelector('[data-timer-setting="longBreak"]').value==='12'`), 'the selected mode and complete Focus setup survive a renderer reload');
    const before = commands; await js(`document.getElementById('timer-action').focus();document.getElementById('timer-action').click();document.getElementById('timer-action').click()`); await delay(100);
    check(commands === before + 1 && timer.snapshot().duration === 2280 && timer.snapshot().configuration.interval === 2, 'Start sends one command and captures the exact configured cycle');
    check(await js(`document.activeElement.id==='timer-action'&&!document.activeElement.disabled`), 'keyboard focus returns to the available primary control after the command settles');
    check(await js(`document.querySelector('.timer-cycle-settings').hidden&&document.getElementById('timer-session-progress').textContent==='Session 1 of 3'&&document.getElementById('timer-action').getAttribute('aria-label')==='Pause'`), 'active mode replaces setup with phase progress and a named pause control');
    await win.webContents.reload(); await delay(250); await js(`openNotch('timer');pointerInside=true;activityQueue.clear()`); await delay(600);
    check(timer.snapshot().running && await js(`document.getElementById('timer-clock').textContent==='38:00'&&document.getElementById('timer-session-progress').textContent==='Session 1 of 3'`), 'reloading the renderer reconnects to the running cycle without starting over');
    await delay(550); const sizeCount = nativeSizes;
    now += 61; timer.publish(); await delay(40);
    check(await js(`document.getElementById('timer-clock').textContent==='36:59'&&[...document.querySelectorAll('.timer-digit')].some(n=>n.getAnimations().length>0)`), 'only changed clock digits animate while the open timer counts down');
    check(nativeSizes === sizeCount, 'timer ticks never resize the native host');
    await shot('timer-focus-running');
    await protocol('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    now += 1; timer.publish(); await delay(40);
    check(await js(`[...document.querySelectorAll('.timer-digit')].every(n=>n.getAnimations().length===0)&&getComputedStyle(document.querySelector('.timer-ruler-track')).transitionDuration==='0s'`), 'Reduce motion removes digit and ruler animation');
    await protocol('Emulation.setEmulatedMedia', { features: [] });
    await click('#timer-action'); await delay(90); const held = timer.snapshot().reading; now += 900; timer.publish(); await delay(40);
    check(timer.snapshot().reading === held && await js(`document.getElementById('timer-description').textContent==='Paused'`), 'pause holds the real session while its accessible control changes to Resume');
    await click('#timer-action'); await delay(90); await finish();
    check(await js(`document.getElementById('timer-action').getAttribute('aria-label')==='Start short break'&&document.getElementById('timer-description').textContent.includes('7 minute break')`), 'completion waits for an explicit action and names the configured next break');
    await click('#timer-action'); await delay(90); check(timer.snapshot().phase === 'shortBreak' && timer.snapshot().duration === 420 && await js(`activeNotice?.kind!=='timer'`), 'the next action starts the configured short break and retires its old completion notice');
    await finish(); await click('#timer-action'); await delay(90); await finish(); await click('#timer-action'); await delay(90);
    check(timer.snapshot().phase === 'longBreak' && timer.snapshot().duration === 720 && await js(`document.getElementById('timer-session-progress').textContent==='Session 2 of 3'`), 'the selected interval starts a long break after the second focus');
    await finish(); await click('#timer-action'); await delay(90); await finish();
    check(timer.snapshot().cycleFinished && await js(`document.getElementById('timer-session-phase').textContent==='Cycle complete'&&document.getElementById('timer-action').getAttribute('aria-label')==='Done'`), 'the last focus completes the whole cycle without inventing another break');
    await shot('timer-focus-complete');
    await click('#timer-action'); await delay(90);
    check(await js(`!document.querySelector('.timer-cycle-settings').hidden&&document.getElementById('timer-minutes').value==='38'`), 'Done restores the saved setup rather than resetting the chosen rhythm');
    await js(`applyPreferences({...preferences,expandedWidth:480})`); await delay(650);
    check(await js(`(()=>{const p=document.querySelector('[data-panel="timer"]');return p.scrollWidth<=p.clientWidth&&p.scrollHeight<=p.clientHeight+1&&[...document.querySelectorAll('.timer-cycle-settings select')].every(s=>s.getBoundingClientRect().right<=p.getBoundingClientRect().right)})()`), 'all cycle controls fit the smallest supported notch width');
    rejectCommand = true; await click('#timer-action'); await delay(100);
    check(await js(`document.getElementById('timer-status').textContent.includes('Could not update')&&!document.getElementById('timer-action').disabled`), 'a rejected command leaves a visible error and an operable retry');
    rejectCommand = false; await click('#timer-action'); await delay(90); await click('#timer-reset'); await delay(90);
    await js(`window.realStorageWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='timer-view')throw new Error('Synthetic storage failure');return window.realStorageWrite.call(this,key,value)};{const s=document.querySelector('[data-timer-setting="sessions"]');s.value='4';s.dispatchEvent(new Event('change'));}`); await delay(250);
    check(await js(`document.getElementById('timer-status').textContent.includes('Could not save setup')&&document.querySelector('[data-timer-setting="sessions"]').value==='4'`), 'failed setup persistence is visible while the in-memory draft stays usable');
    await js(`Storage.prototype.setItem=window.realStorageWrite;document.querySelector('[data-timer-setting="sessions"]').dispatchEvent(new Event('change'))`); await delay(250);
    check(await js(`document.getElementById('timer-status').hidden&&JSON.parse(localStorage.getItem('timer-view')).configuration.sessions===4`), 'a successful subsequent save clears the error and persists the draft');
    assert.deepEqual(errors, []); console.log('Timer source UI: ' + checks + ' input/state/layout checks passed'); app.exit(0);
  } catch (error) { console.error(error); console.error(errors); app.exit(1); }
});
