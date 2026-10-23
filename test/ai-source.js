'use strict';
// Isolated renderer and synthetic account/history responses only.
const {app,BrowserWindow,ipcMain}=require('electron');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const Appearance=require('../src/renderer/notch-appearance'),Geometry=require('../src/renderer/notch-geometry');
app.setPath('userData',path.join(__dirname,'..','.tmp','ai-source-profile'));app.disableHardwareAcceleration();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
  const now=Date.now(),day=offset=>{const d=new Date(now);d.setDate(d.getDate()-offset);return[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
  let data={updatedAt:now,providers:['codex','claude'],accountStatus:'ready',claudeAccountStatus:'ready',resets:2,checking:{codex:false,claude:false},
    limits:{codex:{source:'account',observedAt:now,plan:'Demo plan',windows:[{id:'session',used:27,minutes:300,resetsAt:now+7200000},{id:'week',used:54,minutes:10080,resetsAt:now+3*86400000}]},claude:{source:'account',observedAt:now,plan:'Demo Claude',windows:[{id:'session',used:82,minutes:300,resetsAt:now+3600000},{id:'week',used:96,minutes:10080,scope:'Opus',resetsAt:now+86400000}]}},
    sessions:[{provider:'codex',sessionId:'one',name:'Design system',status:'busy',statusAt:now-90000,startedAt:now-90000,inferred:true},{provider:'claude',sessionId:'two',name:'Interface review',status:'idle',statusAt:now-30000,startedAt:now-120000,inferred:false}],
    buckets:Array.from({length:28},(_,i)=>['codex','claude'].map((provider,j)=>({provider,day:day(i),model:j?'Demo Claude':'Demo Codex',project:i%2?'Islet':'<Demo project>',total:(28-i)*(j?700:1300),input:1000,output:900,cached:500,write:0,responses:8}))).flat()};
  let refreshes=0,connects=0;
  ipcMain.handle('fixture:init',()=>({shelf:[],devices:[],preferences:{...Appearance.defaults,glass:'off'},note:'',timer:{hasSession:false},aiDashboard:data}));
  ipcMain.handle('fixture:size',()=>{});ipcMain.handle('fixture:ai-refresh',()=>{refreshes++;return data;});ipcMain.handle('fixture:claude-signin',()=>{connects++;return{ok:true};});
  const win=new BrowserWindow({...Geometry.hostSize,show:false,frame:false,transparent:true,webPreferences:{offscreen:true,backgroundThrottling:false,contextIsolation:true,preload:path.join(__dirname,'fixtures','notch-preload.js')}});
  const js=code=>win.webContents.executeJavaScript(code).catch(error=>{throw new Error(error.message+'\n'+code);});
  const emit=()=>win.webContents.send('fixture:ai-dashboard',data);
  let checks=0;const errors=[];win.webContents.on('console-message',e=>{if(e.level==='error')errors.push(e.message);});
  const check=(value,message)=>{assert.ok(value,message);checks++;console.log('  ok  '+message);};
  async function shot(name){await delay(700);const rect=await js(`(()=>{const r=card.getBoundingClientRect();return{x:Math.floor(r.x-20),y:0,width:Math.ceil(r.width+40),height:Math.ceil(r.height+32)}})()`);fs.writeFileSync(path.join(__dirname,'..','docs','previews',name+'.png'),(await win.webContents.capturePage(rect)).toPNG());}
  try{
    await win.webContents.session.clearStorageData({storages:['localstorage']});await win.loadFile(path.join(__dirname,'..','src','renderer','index.html'));await delay(300);
    await js(`openNotch('ai');activityQueue.clear();pointerInside=true`);await delay(700);
    check(await js(`(()=>{const a=document.querySelector('.ai-agent[data-agent="codex"]'),b=document.querySelector('.ai-agent[data-agent="claude"]');return a.parentElement.id==='ai-cards'&&a.getBoundingClientRect().top===b.getBoundingClientRect().top})()`),'provider cards occupy the grid directly without a nested account panel');
    check(await js(`document.querySelector('.ai-agent[data-agent="codex"]').textContent.includes('73%')&&document.querySelector('.ai-agent[data-agent="claude"] .is-critical').textContent.includes('4%')`),'real quota values and source 95% critical threshold render');
    check(await js(`document.querySelectorAll('.ai-pace').length===4`),'valid fresh account windows show their time-window markers');
    check(await js(`(()=>{const logos=[...document.querySelectorAll('#ai-dashboard .provider-logo')];return logos.length>=6&&logos.every(image=>image.complete&&image.naturalWidth>0&&image.alt===''&&image.getAttribute('aria-hidden')==='true')&&document.querySelector('.ai-agent[data-agent="codex"] .provider-logo').getAttribute('src').endsWith('openai.svg')&&document.querySelector('.ai-agent[data-agent="claude"] .provider-logo').getAttribute('src').endsWith('claude.svg')})()`),'original local provider logos load in filters, account cards and sessions as decorative images');
    check(await js(`document.querySelector('[data-card="projects"]').textContent.includes('<Demo project>')&&!document.querySelector('demo')`),'project names remain inert text');
    await shot('ai-agents-redesign');
    await js(`document.querySelector('.ai-customize summary').click();document.getElementById('ai-limit-display').value='used';document.getElementById('ai-limit-display').dispatchEvent(new Event('change'))`);
    check(await js(`document.querySelector('.ai-agent[data-agent="codex"] .ai-win-value').textContent==='27%'&&document.querySelector('.ai-win-bar').getAttribute('aria-label').includes('used')`),'Used mode changes the meter and its accessible meaning');
    check(await js(`JSON.parse(localStorage.getItem('ai-view')).limitDisplay==='used'`),'quota mode persists with the previous view preferences');
    await js(`document.getElementById('ai-limit-display').value='remaining';document.getElementById('ai-limit-display').dispatchEvent(new Event('change'));document.getElementById('ai-readout').value='quota';document.getElementById('ai-readout').dispatchEvent(new Event('change'));collapseNotch()`);await delay(700);
    check(await js(`els.closedAgent.dataset.readout==='quota'&&els.closedAgentTime.textContent==='46%'`),'resting agent shows its most-used live quota instead of the elapsed clock when selected');
    check(await js(`(()=>{const image=els.closedAgent.querySelector('.provider-logo');return image?.complete&&image.naturalWidth>0&&image.dataset.provider==='codex'&&image.getBoundingClientRect().width>0})()`),'the compact notch uses the same loaded OpenAI provider logo');
    await shot('ai-agent-compact');
    check(await js(`!document.querySelector('.ai-customize').open`),'collapsing the island closes its customization surface');
    await js(`openNotch('ai');document.querySelector('.ai-customize').open=true`);await delay(100);
    await js(`document.querySelector('[data-id="tokens"][data-ai-move="-1"]').focus();document.activeElement.click()`);
    check(await js(`document.querySelector('#ai-cards').firstElementChild.dataset.card==='tokens'&&document.activeElement.dataset.id==='tokens'&&!document.activeElement.disabled`),'keyboard reorder moves a card and keeps focus on an available row control');
    await js(`window.draggedBefore=JSON.parse(localStorage.getItem('ai-view')).order;{const grip=document.querySelector('[data-order-card="activity"] .ai-card-grip'),target=document.querySelector('[data-order-card="tokens"]'),transfer=new DataTransfer();grip.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer}));target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));}`);
    check(await js(`JSON.parse(localStorage.getItem('ai-view')).order[0]==='activity'`),'dragging reorders the actual selected cards');
    await js(`{const grip=document.querySelector('.ai-card-grip'),transfer=new DataTransfer();window.savedOrder=localStorage.getItem('ai-view');grip.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));grip.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:transfer}));}`);
    check(await js(`localStorage.getItem('ai-view')===window.savedOrder`),'cancelled card drag does not write a new order');
    await js(`document.getElementById('ai-reset-layout').click();document.querySelector('[data-ai-card="models"]').click()`);
    check(await js(`!document.querySelector('[data-card="models"]')`),'card visibility changes the displayed content');
    await shot('ai-agents-customize');
    await js(`document.querySelector('.ai-customize summary').focus();document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))`);
    check(await js(`!document.querySelector('.ai-customize').open&&state==='open'`),'Escape closes Customize before dismissing the notch');
    await js(`document.querySelector('.ai-scroll').scrollTop=220;window.scrollBefore=document.querySelector('.ai-scroll').scrollTop;window.connectNode=document.querySelector('[data-agent="claude"]');window.barNode=document.querySelector('.ai-trend [data-day]');window.focusedBar=document.querySelector('.ai-trend [data-day]');window.focusedBar.focus({preventScroll:true});`);
    data={...data,updatedAt:Date.now(),buckets:data.buckets.map(row=>({...row,total:row.total+100}))};emit();await delay(80);
    check(await js(`document.querySelector('[data-agent="claude"]')===window.connectNode&&document.querySelector('.ai-trend [data-day]')===window.barNode&&document.activeElement===window.focusedBar`),'polling updates preserve card identity, chart focus and interaction state');
    check(await js(`Math.abs(document.querySelector('.ai-scroll').scrollTop-window.scrollBefore)<=1`),'incoming data preserves the scroll position');
    check(await js(`document.querySelector('.ai-toolbar').getBoundingClientRect().bottom<=document.querySelector('.ai-scroll').getBoundingClientRect().top`),'provider controls stay outside the fading scroll region');
    await js(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));document.activeElement.dispatchEvent(new FocusEvent('focusin',{bubbles:true}))`);
    check(await js(`document.activeElement!==window.focusedBar&&document.getElementById('ai-trend-readout').textContent.includes(new Date(document.activeElement.dataset.day+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}))`),'keyboard arrows select and describe a different date in the trend');
    await js(`document.querySelector('.ai-trend [data-day]:last-child').click()`);
    check(await js(`document.getElementById('ai-trend-readout').textContent.includes('Codex')&&document.getElementById('ai-trend-readout').textContent.includes('Claude')`),'chart inspection names both providers and the actual daily reading');
    await shot('ai-agents-insights');
    await js(`document.getElementById('ai-period').value='30';document.getElementById('ai-period').dispatchEvent(new Event('change'))`);
    check(await js(`document.querySelectorAll('.ai-trend [data-day]').length===30`),'30-day view renders 30 keyboard-readable buckets');
    await js(`document.getElementById('ai-refresh').click();document.getElementById('ai-refresh').click()`);await delay(80);
    check(refreshes===1,'refresh cooldown prevents duplicate account checks');
    data={...data,claudeAccountStatus:'signin'};emit();await delay(80);
    check(await js(`document.querySelector('.ai-agent[data-agent="claude"]').textContent.includes('Not signed in')&&!document.querySelector('.ai-agent[data-agent="claude"] .ai-win-bar')`),'signed-out Claude cannot inherit a previous account quota');
    await js(`document.querySelector('[data-ai-connect]').focus();window.signInButton=document.activeElement`);emit();await delay(70);
    check(await js(`document.activeElement===window.signInButton`),'account refresh does not detach a focused Connect button');
    await js(`document.querySelector('[data-ai-connect]').click()`);await delay(70);
    check(connects===1&&await js(`document.getElementById('ai-meta').textContent.includes('Terminal')`),'Connect uses the existing explicit CLI sign-in action');
    data={...data,limits:{codex:{...data.limits.codex,windows:[{id:'old',used:27,minutes:300,resetsAt:now-1}]}},sessions:data.sessions.filter(s=>s.provider==='codex')};emit();await delay(70);
    check(await js(`document.querySelector('.ai-agent[data-agent="codex"] .ai-win-value').textContent==='—'&&!document.querySelector('.ai-agent[data-agent="codex"] .ai-win-bar').hasAttribute('aria-valuenow')`),'expired readings are unknown rather than a false zero');
    check(await js(`AiPanel.closedReading('codex')===null`),'resting readout falls back to elapsed time when no current quota is available');
    await js(`document.querySelector('.ai-customize').open=true;document.querySelectorAll('[data-ai-card]').forEach(input=>{if(input.checked)input.click()});document.querySelector('.ai-customize').open=false`);await delay(700);
    check(await js(`document.querySelector('[data-ai-show-all]')&&Math.round(card.getBoundingClientRect().height)===280`),'all-hidden layout offers direct recovery in a shorter island');
    await js(`document.querySelector('[data-ai-show-all]').click()`);await delay(80);
    check(await js(`document.querySelectorAll('#ai-cards > .ai-card').length>0`),'Show all restores a usable layout');
    await js(`applyPreferences({...preferences,expandedWidth:480})`);await delay(700);
    check(await js(`document.querySelector('.ai-scroll').scrollWidth<=document.querySelector('.ai-scroll').clientWidth`),'independent cards fit the minimum supported width');
    data={updatedAt:Date.now(),providers:[],buckets:[],sessions:[],limits:{},accountStatus:'missing',claudeAccountStatus:'missing'};emit();await js(`document.querySelector('[data-ai-provider="all"]').click()`);await delay(700);
    check(await js(`!document.querySelector('.ai-agent')&&document.querySelector('.ai-empty-state').textContent.includes('No local activity')`),'unseen providers produce one useful empty state instead of a wall of blank cards');
    await shot('ai-agents-empty');
    await win.webContents.reload();await delay(500);
    check(await js(`document.getElementById('ai-readout').value==='quota'`),'view settings survive a renderer reload');
    assert.deepEqual(errors,[]);console.log('AI source redesign: '+checks+' interaction/state/layout checks passed');app.exit(0);
  }catch(error){console.error(error);console.error(errors);app.exit(1);}
});
