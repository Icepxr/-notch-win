'use strict';
// Shared by renderer-smoke and the standalone screenshot/state harness.
module.exports = async function expandedChecks({ win, emit, check, ipcMain, snapshot }) {
  const js = code => win.webContents.executeJavaScript(code);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const art = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><path fill="#4ba9bd" d="M0 0h96v96H0z"/></svg>').toString('base64');
  emit('timer', { hasSession: false });
  emit('now-playing', { type: 'state', session: true, title: 'Layout reference', artist: 'Fixture artist', album: 'Reference album', app: 'Spotify.exe', status: 'Playing', duration: 240, position: 31, thumb: art, canPlay: true, canPause: true, canSeek: true });
  await js(`applyPreferences({...preferences,expandedWidth:520,scale:100,hiddenModules:[],musicPreview:false});activityQueue.clear();pointerInside=true;setExploring(false)`);
  await wait(200);
  const reports = {};
  for (const id of ['send', 'media', 'clipboard', 'system', 'ai', 'timer', 'notes']) {
    await js(`openNotch('${id}');activityQueue.clear()`); await wait(600);
    const r = await js(`(()=>{
      const panel=document.querySelector('[data-panel="${id}"]'),head=panel.querySelector('.expanded-page-header'),body=panel.querySelector('.expanded-page-content');
      const h=head.getBoundingClientRect(),b=body.getBoundingClientRect(),l=document.querySelector('.layer-open').getBoundingClientRect(),s=getComputedStyle(document.querySelector('.layer-open'));
      const primary=head.querySelector('.expanded-primary'),a=primary.getBoundingClientRect(),title=head.querySelector('h2').getBoundingClientRect(),nav=document.querySelector('.notch-header').getBoundingClientRect();
      // Independent natural-demand measurement: actual child boxes, margins and
      // scrollable text, rather than reading the module's own needed value.
      const children=[...body.children].filter(n=>getComputedStyle(n).display!=='none'&&getComputedStyle(n).position!=='absolute');
      const natural=children.reduce((n,c)=>{const s=getComputedStyle(c);return n+c.getBoundingClientRect().height+parseFloat(s.marginTop)+parseFloat(s.marginBottom)},0)+Math.max(0,children.length-1)*10;
      const overflow=[...body.querySelectorAll('.clip-list,.ai-scroll,.scratchpad')].reduce((n,c)=>n+Math.max(0,c.scrollHeight-c.clientHeight),0);
      return {head:h.height,width:h.width,inset:h.left-l.left,top:h.top-l.top,padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft].map(parseFloat),gap:parseFloat(getComputedStyle(body).rowGap),bodyGap:b.top-h.bottom,
        primaryRight:h.right-a.right,primaryFits:a.left>=title.right+8&&a.right<=nav.left-8&&Math.abs(a.top-h.top)<1,
        demand:Math.ceil(70+natural+overflow),request:ExpandedPages.requestFor('${id}'),actual:card.getBoundingClientRect().height,
        words:body.innerText.trim().length,black:getComputedStyle(card).backgroundColor==='rgb(0, 0, 0)',wide:body.scrollWidth<=body.clientWidth+1};
    })()`);
    reports[id] = r;
    check(r.head === 28 && Math.abs(r.top - 16) <= 1 && Math.abs(r.width - 464) <= 1 && Math.abs(r.inset - 28) <= 1, id + ': header has shared height, width and origin');
    check(r.padding.join() === '16,28,16,28' && r.gap === 10 && Math.abs(r.bodyGap - 10) <= 1, id + ': insets and header/content rhythm match');
    check(r.primaryFits && Math.abs(r.primaryRight - 144) <= 1, id + ': real primary action occupies the shared slot without overlapping navigation');
    const expected = Math.min(r.request.max, Math.max(180, r.demand));
    check(Math.abs(r.request.requested - expected) <= 2, id + ': requested height is within 2px of independently measured bounded demand');
    check(r.words > 0 && r.wide && r.black, id + ': content is readable, fits horizontally and keeps the shell black');
    const contrastFailures = await js(`(()=>{
      const root=document.querySelector('[data-panel="${id}"]'),failures=[];
      const rgb=s=>s.match(/[\\d.]+/g)?.map(Number)||[0,0,0,0],blend=(f,b)=>f.slice(0,3).map((c,i)=>c*(f[3]??1)+b[i]*(1-(f[3]??1)));
      const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((n,c,i)=>n+c*[.2126,.7152,.0722][i],0);
      for(const n of root.querySelectorAll('*')){
        if(![...n.childNodes].some(c=>c.nodeType===3&&c.textContent.trim())||n.closest('[hidden],button:disabled')||!n.getBoundingClientRect().width||!n.getBoundingClientRect().height)continue;
        let bg=[0,0,0],opacity=1;const chain=[];for(let p=n;p&&p!==document.body;p=p.parentElement){chain.unshift(p);opacity*=Number(getComputedStyle(p).opacity);}
        if(opacity<.01)continue;
        const box=n.getBoundingClientRect(),x=box.x+box.width/2,y=box.y+box.height/2;
        for(const p of chain){const r=p.getBoundingClientRect();if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom){
          const s=getComputedStyle(p);bg=blend(rgb(s.backgroundColor),bg);
          const stops=s.backgroundImage.match(/rgba?\\([^)]+\\)/g);
          if(stops){const fg=lum(rgb(getComputedStyle(n).color));bg=stops.map(c=>blend(rgb(c),bg)).sort((a,b)=>{
            const ratio=c=>(Math.max(lum(c),fg)+.05)/(Math.min(lum(c),fg)+.05);return ratio(a)-ratio(b);
          })[0];}
        }}
        const fg=rgb(getComputedStyle(n).color);fg[3]=(fg[3]??1)*opacity;
        const a=lum(blend(fg,bg)),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        if(ratio<4.5)failures.push(n.id||n.className+': '+n.textContent.trim().slice(0,22)+' '+ratio.toFixed(2));
      }return failures;
    })()`);
    check(!contrastFailures.length, id + ': visible text reaches 4.5:1 against its composed surface' + (contrastFailures.length?' ('+contrastFailures.join(', ')+')':''));
    if (['ai','timer'].includes(id)) check(Math.abs(r.actual - r.request.requested) <= 1, id + ': existing renderer consumer applies the measured height');
  }
  const player = mode => js(`(()=>{
    const art=document.querySelector('${mode === 'peek' ? '#peek-art' : '#np-art'}'),origin=art.getBoundingClientRect();
    const rect=sel=>{const r=document.querySelector(sel).getBoundingClientRect();return [r.x-origin.x,r.y-origin.y,r.width,r.height]};
    const selectors=${JSON.stringify(mode === 'peek' ? ['.peek-bar','.peek-controls','#peek-time','#peek-remaining'] : ['.np-bar','.np-buttons','#np-time','.expanded-duration'])};
    return {art:[origin.width,origin.height],radius:getComputedStyle(art).borderRadius,fit:getComputedStyle(art.querySelector('img')).objectFit,
      bar:rect(selectors[0]),transport:rect(selectors[1]),times:selectors.slice(2).map(s=>({color:getComputedStyle(document.querySelector(s)).color,size:getComputedStyle(document.querySelector(s)).fontSize,text:document.querySelector(s).textContent})),
      buttons:[...document.querySelectorAll('${mode === 'peek' ? '.peek-controls button' : '.np-buttons button'}')].map(b=>b.getBoundingClientRect().width)};
  })()`);
  await js(`collapseNotch();hoverSuppressed=false;pointerInside=false`); emit('pointer', true); await wait(800);
  const peek = await player('peek');
  await js(`openNotch('media')`); await wait(700);
  const open = await player('open');
  console.log('      music geometry: ' + JSON.stringify({peek,open}));
  check(open.art.join() === '96,96' && open.art.join() === peek.art.join() && open.radius === peek.radius && open.fit === peek.fit, 'Music: expanded artwork keeps hover size, radius and image fit');
  check(Math.abs(open.bar[0] - peek.bar[0]) < 1 && Math.abs(open.bar[1] - peek.bar[1]) < 1 && Math.abs(open.bar[3] - peek.bar[3]) < 1, 'Music: timeline stays at the same position relative to the cover');
  check(Math.abs(open.transport[0] - peek.transport[0]) < 1 && Math.abs(open.transport[1] - peek.transport[1]) < 1 && open.buttons.every((w,i)=>w===44&&w===peek.buttons[i]), 'Music: transport stays in its hover row with 44px controls');
  check(open.times.every((t,i)=>t.color===peek.times[i].color&&t.size===peek.times[i].size) && open.times[1].text === peek.times[1].text, 'Music: both time labels keep hover colour, type size and duration convention');
  let finishLyrics;
  ipcMain.removeHandler('fixture:lyrics');
  ipcMain.handle('fixture:lyrics',(_event,enabled)=>enabled?new Promise(resolve=>{finishLyrics=resolve;}):{status:'off'});
  if(await js(`document.getElementById('peek-lyrics-toggle').getAttribute('aria-pressed')==='true'`)){await js(`document.querySelector('.expanded-lyrics-toggle').click()`);await wait(100);}
  await js(`document.querySelector('.expanded-lyrics-toggle').click()`); await wait(100);
  check(await js(`document.querySelector('[data-music-copy="lyrics-status"]').textContent===document.getElementById('peek-lyrics-status').textContent&&document.querySelector('[data-music-copy="lyrics-status"]').textContent.length>0`), 'Music: expanded lyrics use the existing provider loading state');
  finishLyrics({status:'synced',lines:[{at:0,text:'A quiet beginning'},{at:30,text:'Keep the same song close'},{at:120,text:'The next line'}]}); await wait(200);
  check(await js(`!document.querySelector('[data-music-copy="lyrics"]').hidden&&document.querySelector('[data-music-copy="lyric"]').textContent===document.getElementById('peek-lyric').textContent&&document.querySelector('[data-music-copy="lyric"]').textContent.includes('Keep the same')`), 'Music: the header action reaches the real lyrics adapter and mirrors synced lines');
  const lyricRect=await js(`(()=>{const r=document.querySelector('[data-music-copy="lyric"]').getBoundingClientRect();return{x:Math.floor(r.x),y:Math.floor(r.y),width:Math.ceil(r.width),height:Math.ceil(r.height)}})()`);
  const bitmap=(await win.webContents.capturePage(lyricRect)).toBitmap(),levels=[];
  const channel=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
  for(let i=0;i<bitmap.length;i+=4)levels.push(.2126*channel(bitmap[i+2])+.7152*channel(bitmap[i+1])+.0722*channel(bitmap[i]));
  levels.sort((a,b)=>a-b);
  const lyricContrast=(levels[Math.floor(levels.length*.97)]+.05)/(levels[Math.floor(levels.length*.03)]+.05);
  check(lyricContrast>=4.5,'Music: captured lyric pixels exceed 4.5:1 over their actual cover backdrop ('+lyricContrast.toFixed(2)+':1)');
  if(snapshot)await snapshot('music-lyrics');
  const outgoing=await js(`collapseNotch();new Promise(resolve=>setTimeout(()=>resolve({shrinking:document.body.classList.contains('is-shrinking'),art:document.getElementById('np-art').offsetWidth}),30))`);
  check(!outgoing.shrinking||outgoing.art===96,'Music: the outgoing expanded cover keeps its layout while the shell shrinks');
  await js(`openNotch('media')`); await wait(600);
  // Empty source snapshots must explain themselves, not just contain controls.
  emit('now-playing', { type: 'state', session: false }); emit('clipboard', []); emit('shelf', []); emit('devices', []); emit('system', null);
  await wait(180);
  for (const [id, selector, pattern] of [
    ['send','#shelf','Drop|Choose'], ['media','#np-empty','Nothing|playing|source'],
    ['clipboard','.clip-list','Copy|clipboard|history'], ['system','.section-meta','Reading sensors'],
    ['timer','#timer-description','duration|rhythm|Ready'], ['notes','#scratchpad','Start writing']
  ]) {
    await js(`openNotch('${id}')`); await wait(150);
    const text=await js(`(()=>{const p=document.querySelector('[data-panel="${id}"]'),n=p.querySelector('${selector}');return n?.placeholder||n?.innerText||''})()`);
    check(new RegExp(pattern, 'i').test(text) && text.length>4, id + ': empty or waiting state explains the next step');
  }
  emit('ai-dashboard',{sessions:[],buckets:[],limits:{},accountStatus:'unavailable',claudeAccountStatus:'signin'});
  await js(`openNotch('ai')`); await wait(200);
  check(await js(`document.querySelector('.ai-scroll').innerText.includes('Sign in')||document.querySelector('.ai-scroll').innerText.includes('claude auth login')`), 'AI: missing account data gives a real sign-in path');
  emit('clipboard',[{id:'layout',kind:'text',preview:'A saved clipboard item',at:Date.now(),length:22,canPin:true}]);
  await js(`openNotch('clipboard')`); await wait(250);
  check(await js(`(()=>{const group=document.querySelector('.clip-list'),s=getComputedStyle(group),icon=document.querySelector('.clip-kind').getBoundingClientRect(),text=document.querySelector('.clip-text').getBoundingClientRect();return s.borderRadius==='16px'&&s.padding==='16px'&&icon.width===26&&icon.height===26&&Math.abs(text.left-icon.right-12)<1})()`), 'Clipboard: group radius/padding and the 26px icon plus 12px text gap match the audit');
  if(snapshot)await snapshot('clipboard-item');
  const shortClipboard=await js(`ExpandedPages.requestFor('clipboard').requested`);
  emit('clipboard',Array.from({length:30},(_,i)=>({id:'row-'+i,kind:'text',preview:'Saved item '+i,at:Date.now(),length:12,canPin:true})));
  await wait(180);
  check(await js(`ExpandedPages.requestFor('clipboard').requested>${shortClipboard}&&ExpandedPages.requestFor('clipboard').requested===ExpandedPages.requestFor('clipboard').max&&document.querySelector('.clip-list').scrollHeight>document.querySelector('.clip-list').clientHeight`), 'Clipboard: populated history grows the request up to the ceiling and scrolls inside it');
  // Exercise real panel actions across IPC, with deliberately slow and failing
  // fixture services. Handlers are replaced only at the end of each suite.
  let finishNote, noteOK=false, saves=[];
  ipcMain.removeHandler('fixture:note');
  ipcMain.handle('fixture:note', (_event,text)=>{saves.push(text);return new Promise(resolve=>{finishNote=()=>resolve(noteOK);});});
  await js(`openNotch('notes');{const n=document.getElementById('scratchpad');n.value='Keep this unsaved note';n.dispatchEvent(new Event('input'));}`); await wait(320);
  check(await js(`document.getElementById('note-status').textContent==='Saving…'`), 'Notes: slow saves display their pending state');
  finishNote(); await wait(100);
  check(await js(`!document.getElementById('note-retry').hidden&&document.getElementById('note-status').textContent.includes('Cannot save')&&document.getElementById('scratchpad').value==='Keep this unsaved note'`), 'Notes: failed save preserves the draft and exposes a real retry');
  if(snapshot)await snapshot('notes-error');
  noteOK=true; await js(`document.getElementById('note-retry').click()`); await wait(80);
  check(await js(`document.getElementById('note-retry').disabled&&document.getElementById('note-status').textContent==='Saving…'`), 'Notes: retry cannot submit twice while pending');
  finishNote(); await wait(100);
  check(saves.length===2&&saves[0]===saves[1]&&await js(`document.getElementById('note-retry').hidden&&document.getElementById('note-status').textContent==='Saved locally'`), 'Notes: retry persists the same draft and clears the error');
  await js(`{const n=document.getElementById('scratchpad');n.value='A line of text\\n'.repeat(300);n.dispatchEvent(new Event('input'));}`); await wait(320);
  check(await js(`ExpandedPages.requestFor('notes').requested===ExpandedPages.requestFor('notes').max&&ExpandedPages.requestFor('notes').overflow`), 'Notes: long content requests the ceiling and remains scrollable');
  check(await js(`document.getElementById('scratchpad').clientHeight>128&&document.querySelector('.expanded-page.is-active .expanded-page-content').scrollHeight<=document.querySelector('.expanded-page.is-active .expanded-page-content').clientHeight+1`), 'Notes: a long draft uses available editor space without growing beyond the current native page');
  finishNote(); await wait(60);
  let finishTimer;
  ipcMain.removeHandler('fixture:timer'); ipcMain.handle('fixture:timer',()=>new Promise(resolve=>{finishTimer=()=>resolve(null);}));
  await js(`openNotch('timer');document.getElementById('timer-action').click()`); await wait(100);
  check(await js(`document.getElementById('timer-action').disabled&&document.getElementById('timer-status').textContent==='Updating timer…'`), 'Timer: pending command disables the action and explains the wait');
  finishTimer(); await wait(150);
  check(await js(`!document.getElementById('timer-action').disabled&&document.getElementById('timer-status').textContent.includes('Could not update')`), 'Timer: rejected command restores an operable retry');
  let finishAi;
  ipcMain.removeHandler('fixture:ai-refresh'); ipcMain.handle('fixture:ai-refresh',()=>new Promise(resolve=>{finishAi=()=>resolve(null);}));
  await js(`openNotch('ai');document.getElementById('ai-refresh').disabled=false;document.getElementById('ai-refresh').click()`); await wait(100);
  check(await js(`document.getElementById('ai-refresh').disabled&&document.getElementById('ai-meta').textContent.includes('Checking accounts')&&document.getElementById('ai-dashboard').getAttribute('aria-busy')==='true'`), 'AI: refresh exposes its real pending state');
  finishAi(); await wait(100);
  check(await js(`!document.getElementById('ai-refresh').disabled&&document.getElementById('ai-meta').textContent.includes('Could not refresh')`), 'AI: failed refresh is explained and immediately retryable');
  emit('system',{error:'Synthetic sensor failure'}); await js(`openNotch('system')`); await wait(150);
  check(await js(`document.querySelector('[data-panel="system"]').textContent.includes('Sensors unavailable')&&[...document.querySelectorAll('.system-summary')].every(b=>b.disabled)`), 'System: unavailable sensors have words and no misleading live controls');
  emit('system',{host:'Fixture PC',uptime:60,cpu:{overall:.2,count:8,history:[]},memory:{ratio:.5,used:8e9,total:16e9,history:[]},disks:[]}); await wait(100);
  check(await js(`[...document.querySelectorAll('.system-summary')].every(b=>!b.disabled)&&document.querySelector('[data-metric="cpu"]').textContent.includes('20%')`), 'System: the next valid sample recovers the live controls');
  return { pages: reports, music: { peek, open } };
};
