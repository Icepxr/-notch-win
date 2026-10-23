'use strict';
// Exercise the existing services through the actual source-derived module UI.
// All data/profile are synthetic; no OS clipboard, account or LAN is accessed.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Appearance = require('../src/renderer/notch-appearance');
const Geometry = require('../src/renderer/notch-geometry');
const { NotchTimer } = require('../src/timer');
app.setPath('userData', path.join(__dirname, '..', '.tmp', 'module-source-profile'));
app.disableHardwareAcceleration();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  const timer = new NotchTimer();
  let saved = '', rejectNote = false, copyReply = true, clipEntries = [];
  ipcMain.handle('fixture:init', () => ({ shelf: [], devices: [], clipboard: [],
    preferences: { ...Appearance.defaults, glass: 'off' }, note: '', timer: timer.snapshot() }));
  ipcMain.handle('fixture:size', () => {});
  ipcMain.handle('fixture:timer', (_event, { action, options }) => timer.command(action, options));
  ipcMain.handle('fixture:note', (_event, value) => { if (rejectNote) return false; saved = value; return true; });
  const win = new BrowserWindow({ ...Geometry.hostSize, show: false, frame: false, transparent: true,
    webPreferences: { offscreen: true, contextIsolation: true, backgroundThrottling: false,
      preload: path.join(__dirname, 'fixtures', 'notch-preload.js') } });
  const js = code => win.webContents.executeJavaScript(code).catch(error => {
    throw new Error(error.message + '\nRenderer code: ' + code);
  });
  const emit = (name, value) => win.webContents.send('fixture:' + name, value);
  ipcMain.handle('fixture:clip-pick', async (_event, id) => {
    if (!copyReply) return false;
    const entry = clipEntries.find(item => item.id === id);
    if (!entry) return false;
    // The real watcher emits the reordered history before its IPC reply.
    clipEntries = [{ ...entry, at: Date.now() }, ...clipEntries.filter(item => item.id !== id)];
    emit('clipboard', clipEntries);
    await delay(10);
    return true;
  });
  const errors = []; let checks = 0;
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const check = (result, message) => { assert.ok(result, message); checks++; };
  async function snapshot(name) {
    await delay(700);
    const rect = await js(`(() => { const r=card.getBoundingClientRect(); return {x:Math.floor(r.x-20),y:0,width:Math.ceil(r.width+40),height:Math.ceil(r.height+32)} })()`);
    const out = path.join(__dirname, '..', 'docs', 'previews'); fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'source-' + name + '.png'), (await win.webContents.capturePage(rect)).toPNG());
  }
  try {
    await win.webContents.session.clearStorageData({ storages: ['localstorage'] });
    await win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html')); await delay(300);
    await js(`openNotch('clipboard'); activityQueue.clear(); pointerInside = true`); await delay(650);
    clipEntries = [{ id: 'first', kind: 'url', preview: 'https://example.com', chars: 19, at: Date.now() },
      { id: 'image', kind: 'image', preview: 'Image preview', at: Date.now() },
      { id: 'last', kind: 'text', preview: 'A thought to keep', chars: 17, at: Date.now() }];
    emit('clipboard', clipEntries); await delay(60);
    check(await js(`document.querySelector('[data-panel="clipboard"] .clip-search').hidden`), 'clipboard search starts folded');
    check(await js(`!!document.querySelector('.clip-kind svg')`), 'clipboard kinds use vector marks');
    await js(`document.querySelector('.clip-row').focus(); document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}))`);
    check(await js(`document.activeElement.dataset.id === 'last'`), 'keyboard selection skips image previews that cannot be copied');
    await js(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))`); await delay(70);
    check(await js(`document.querySelector('.clip-row').dataset.id === 'last' && document.querySelector('[data-id="last"]').classList.contains('is-copied') && document.querySelector('[data-id="last"] .clip-meta').textContent.includes('Ready to paste')`), 'copy feedback survives a history reorder before the IPC reply');
    check(await js(`document.activeElement.dataset.id === 'last'`), 'a clipboard poll preserves keyboard focus on the copied item');
    await js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'f',ctrlKey:true,bubbles:true,cancelable:true}))`);
    check(await js(`!document.querySelector('[data-panel="clipboard"] .clip-search').hidden && document.activeElement === document.querySelector('[data-panel="clipboard"] .clip-search')`), 'Ctrl+F reveals and focuses search');
    await js(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))`);
    check(await js(`document.querySelector('[data-panel="clipboard"] .clip-search').hidden && state === 'open'`), 'Escape folds an empty search before closing the island');
    await snapshot('clipboard');
    copyReply = false;
    await js(`document.querySelector('[data-id="first"]').click()`); await delay(70);
    check(await js(`!document.querySelector('[data-id="first"]').classList.contains('is-copied') && document.querySelector('[data-id="first"] .clip-meta').textContent.includes('Could not copy')`), 'a failed copy reports failure inside its row');
    const sample = { host: 'Demo Windows PC', uptime: 7200,
      cpu: { overall: .24, count: 8, model: 'Demo processor', history: [.1,.3,.24] },
      memory: { ratio: .48, used: 8000000000, total: 16000000000, history: [.4,.48] },
      disks: [{ mount: 'C:', ratio: .35, free: 300000000000 }] };
    emit('system', sample); await js(`setTab('system')`); await delay(150);
    check(await js(`document.querySelectorAll('.system-summary').length === 3 && [...document.querySelectorAll('.system-summary')].every(e => e.offsetHeight === 72)`), 'system overview uses source-sized 72px cards');
    check(await js(`document.querySelector('[data-metric="cpu"]').textContent.includes('24%') && document.querySelector('[data-metric="storage"]').textContent.includes('279')`), 'system cards display real fixture readings');
    await snapshot('system');
    check(await js(`Math.round(card.getBoundingClientRect().height) === 180`), 'the system overview leaves no empty full-height panel');
    await js(`document.querySelector('[data-metric="cpu"]').click()`);
    check(await js(`!document.querySelector('.system-detail').hidden && document.querySelector('.system-overview').hidden && document.querySelector('.spark-line').getAttribute('points').length > 0`), 'CPU opens its existing history chart');
    emit('system', { ...sample, cpu: { ...sample.cpu, overall: .87 } }); await delay(60);
    check(await js(`document.querySelector('[data-metric="cpu"]').classList.contains('is-warm') && !document.querySelector('.system-detail').hidden`), 'sensor updates preserve the selected detail and pressure warning');
    await js(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))`);
    check(await js(`!document.querySelector('.system-overview').hidden && document.activeElement.dataset.metric === 'cpu' && state === 'open'`), 'Escape returns to the overview and restores focus');
    await js(`setTab('timer'); document.querySelector('[data-mode="pomodoro"]').click()`); await delay(100);
    check(await js(`document.getElementById('timer-minutes').value === '25' && document.querySelector('.timer-ruler').offsetHeight === 82 && getComputedStyle(document.getElementById('timer-clock')).fontSize === '26px'`), 'Focus setup uses the source ruler and smaller setup clock');
    await js(`{ document.querySelector('[data-mode="timer"]').click(); const r=document.getElementById('timer-minutes'); r.value='42'; r.dispatchEvent(new Event('input')); }`);
    check(await js(`document.getElementById('timer-clock').textContent === '42:00' && document.getElementById('timer-minutes').getAttribute('aria-valuetext') === '42 minutes'`), 'duration changes update both the clock and spoken reading');
    await snapshot('timer');
    await js(`document.getElementById('timer-action').click()`); await delay(70);
    check(timer.snapshot().running && timer.snapshot().reading > 2518, 'Start launches the selected real timer duration');
    check(await js(`document.querySelector('.timer-duration').hidden && getComputedStyle(document.getElementById('timer-clock')).fontSize === '62px'`), 'active timer replaces setup with the large clock');
    await snapshot('timer-running');
    check(await js(`Math.round(card.getBoundingClientRect().height) === 230 && document.querySelector('[data-panel="timer"]').scrollHeight <= document.querySelector('[data-panel="timer"]').clientHeight + 1`), 'the active clock fits its shorter island');
    await js(`document.getElementById('timer-action').click()`); await delay(40);
    check(timer.snapshot().paused, 'active timer pauses');
    await js(`document.getElementById('timer-reset').click()`); await delay(40);
    await js(`document.querySelector('[data-mode="stopwatch"]').click(); document.getElementById('timer-action').click()`); await delay(40);
    check(timer.snapshot().mode === 'stopwatch' && timer.snapshot().running, 'stopwatch uses the same real service');
    await js(`{ document.getElementById('timer-reset').click(); setTab('notes'); const n=document.getElementById('scratchpad'); n.value='A private thought\\nบันทึก'; n.dispatchEvent(new Event('input')); }`); await delay(330);
    check(saved.includes('บันทึก') && await js(`document.getElementById('note-status').textContent === 'Saved locally'`), 'notes still acknowledge the save result');
    await snapshot('notes');
    rejectNote = true;
    await js(`{ const n=document.getElementById('scratchpad'); n.value+=' again'; n.dispatchEvent(new Event('input')); }`); await delay(330);
    check(await js(`document.getElementById('note-status').textContent.includes('Cannot save')`), 'notes report a failed save');
    // Source-inspired paired cards keep actual account/no-account semantics.
    const now = Date.now();
    emit('ai-dashboard', { updatedAt: now, sessions: [], buckets: [], accountStatus: 'ready', claudeAccountStatus: 'signin',
      limits: { codex: { source: 'account', observedAt: now, plan: 'Demo plan', windows: [{ used: 27, minutes: 300, resetsAt: now + 7200000 }, { used: 54, minutes: 10080, resetsAt: now + 86400000 }] } } });
    await js(`setTab('ai')`); await delay(250);
    check(await js(`(() => { const cards=[...document.querySelectorAll('.ai-grid > .ai-agent')]; return cards.length === 2 && cards[0].getBoundingClientRect().top === cards[1].getBoundingClientRect().top && document.querySelector('[data-agent="claude"]').textContent.includes('Not signed in'); })()`), 'AI providers are paired while Claude keeps its real sign-in state');
    await snapshot('ai');
    for (const module of ['send','clipboard','system','timer','notes','ai']) {
      await js(`applyPreferences({...preferences, expandedWidth:480}); setTab('${module}')`); await delay(160);
      check(await js(`(() => { const p=document.querySelector('.panel.is-active'); return p.scrollWidth <= p.clientWidth + 1; })()`), module + ' fits the narrowest supported shell');
    }
    assert.deepEqual(errors, []);
    console.log('Source modules: ' + checks + ' interaction/layout checks passed, no renderer errors');
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
