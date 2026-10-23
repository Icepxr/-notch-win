'use strict';
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Vorssaint
// NotchAgentsView, NotchAgentComponents and NotchAgentSupport for Windows.
window.AiPanel = (() => {
  const root=document.getElementById('ai-dashboard'),panel=root.closest('.panel');
  const defaults={buckets:[],sessions:[],limits:{},providers:[],accountStatus:'loading',claudeAccountStatus:'loading'};
  let data={...defaults},receivedDashboard=false,view=AiView.normalize(),lastHeight=0;
  let hoverDay=null,selectedDay=null,hoverActivity=null,selectedActivity=null,message='',messageUntil=0,dragged=null,connecting=false;
  try{view=AiView.normalize(JSON.parse(localStorage.getItem('ai-view')||'{}'));}catch{}
  const labels={all:'All',codex:'Codex',claude:'Claude'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const count=n=>new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(AiView.number(n));
  const paths={refresh:'M16 7a6 6 0 1 0 0 6M16 3v4h-4',settings:'M3 5h14M3 10h14M3 15h14M7 3v4m6 1v4m-5 1v4',usage:'M3 17V9m5 8V3m5 14V7m4 10V5',live:'m2 11 4-1 2-6 4 12 2-6h4',trend:'M3 3v14h14M6 13l4-5 3 2 4-6',models:'M4 4h12v12H4zM7 1v3m6-3v3M7 16v3m6-3v3M1 7h3m-3 6h3m12-6h3m-3 6h3',projects:'M2 5h6l2 2h8v10H2z',activity:'M3 3h4v4H3zm10 0h4v4h-4zM3 13h4v4H3zm10 0h4v4h-4z'};
  const icon=name=>'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="'+paths[name]+'"/></svg>';
  function mark(id){return '<span class="ai-agent-mark" aria-hidden="true">'+ProviderMarks.markHtml(id)+'</span>';}
  function save(){try{localStorage.setItem('ai-view',JSON.stringify(view));}catch{}}
  root.innerHTML=`<div class="ai-toolbar"><div class="ai-providers" role="group" aria-label="AI provider">${Object.entries(labels).map(([id,label])=>`<button type="button" data-ai-provider="${id}" aria-pressed="false">${label}</button>`).join('')}</div><select id="ai-period" aria-label="Usage period"><option value="today">Today</option><option value="7">7 days</option><option value="30">30 days</option></select><button type="button" id="ai-refresh" class="ai-toolbar-icon" title="Refresh accounts and activity" aria-label="Refresh AI usage">${icon('refresh')}</button><details class="ai-customize"><summary aria-label="Customize AI cards" title="Customize cards">${icon('settings')}</summary><div class="ai-editor"><div class="ai-editor-head"><strong>Your cards</strong><button type="button" id="ai-reset-layout">Reset layout</button></div><label class="ai-setting">Quota display<select id="ai-limit-display"><option value="remaining">Remaining</option><option value="used">Used</option></select></label><label class="ai-setting">Resting notch<select id="ai-readout"><option value="elapsed">Elapsed time</option><option value="quota">Quota</option></select></label><p class="ai-editor-hint">Drag to arrange, or use the arrow buttons.</p><div id="ai-card-order"></div></div></details></div><div class="ai-readout"><span id="ai-meta" role="status"></span><span id="ai-live-summary"></span></div><div class="ai-scroll" tabindex="-1"><div class="ai-grid" id="ai-cards"></div><p class="ai-privacy">Local activity · Token counts are separate from plan limits.</p></div>`;
  const container=root.querySelector('#ai-cards'),meta=root.querySelector('#ai-meta'),custom=root.querySelector('.ai-customize'),orderList=root.querySelector('#ai-card-order'),scrollElement=root.querySelector('.ai-scroll');
  let currentTiles=[],emptyState=true,trendDays=[],activityDays=[];
  root.querySelectorAll('[data-ai-provider]').forEach(button=>{if(button.dataset.aiProvider!=='all')button.prepend(ProviderMarks.markElement(button.dataset.aiProvider,document));});
  function preferredHeight(){return window.ExpandedPages?.requestFor('ai')?.requested||(custom.open?510:AiView.height(currentTiles,emptyState));}
  function notifyLayout(){const height=preferredHeight();if(height!==lastHeight){lastHeight=height;panel.dispatchEvent(new CustomEvent('notch:layout',{bubbles:true}));}}
  function preferencesChanged(){save();paint();root.dispatchEvent(new CustomEvent('ai:view-change',{bubbles:true}));}
  function moveCard(id,to){const from=view.order.indexOf(id);if(from<0||to<0||to>=view.order.length)return;const order=[...view.order];order.splice(from,1);order.splice(to,0,id);view={...view,order};preferencesChanged();}
  function paintEditor(){
    const focused=orderList.contains(document.activeElement)?document.activeElement:null;
    AiDom.render(orderList,view.order.map((id,i)=>`<div class="ai-editor-row" data-ai-key="${id}" data-order-card="${id}"><span class="ai-card-grip" draggable="true" title="Drag ${AiView.cards[id]}">⠿</span><label><input type="checkbox" data-ai-card="${id}" ${view.hidden.includes(id)?'':'checked'}><span>${AiView.cards[id]}</span></label><button type="button" data-ai-move="-1" data-id="${id}" aria-label="Move ${AiView.cards[id]} up" ${i===0?'disabled':''}>↑</button><button type="button" data-ai-move="1" data-id="${id}" aria-label="Move ${AiView.cards[id]} down" ${i===view.order.length-1?'disabled':''}>↓</button></div>`).join(''));
    orderList.querySelectorAll('input').forEach(input=>{input.checked=!view.hidden.includes(input.dataset.aiCard);});
    if(focused?.isConnected&&focused.disabled)focused.closest('[data-order-card]')?.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
    root.querySelector('#ai-limit-display').value=view.limitDisplay;root.querySelector('#ai-readout').value=view.readout;
  }
  root.querySelectorAll('[data-ai-provider]').forEach(button=>button.addEventListener('click',()=>{view={...view,provider:button.dataset.aiProvider};hoverDay=selectedDay=null;preferencesChanged();}));
  root.querySelector('#ai-period').addEventListener('change',event=>{view={...view,period:event.target.value};hoverDay=selectedDay=null;preferencesChanged();});
  root.querySelector('#ai-limit-display').addEventListener('change',event=>{view={...view,limitDisplay:event.target.value};preferencesChanged();});
  root.querySelector('#ai-readout').addEventListener('change',event=>{view={...view,readout:event.target.value};preferencesChanged();});
  orderList.addEventListener('change',event=>{const id=event.target.dataset.aiCard;if(!id)return;view.hidden=event.target.checked?view.hidden.filter(x=>x!==id):[...view.hidden,id];preferencesChanged();});
  orderList.addEventListener('click',event=>{const b=event.target.closest('[data-ai-move]');if(b)moveCard(b.dataset.id,view.order.indexOf(b.dataset.id)+Number(b.dataset.aiMove));});
  function finishDrag(){dragged=null;orderList.querySelectorAll('.is-dragging,.is-drop-target').forEach(node=>node.classList.remove('is-dragging','is-drop-target'));}
  orderList.addEventListener('dragstart',event=>{const grip=event.target.closest('.ai-card-grip');if(!grip)return;dragged=grip.closest('[data-order-card]').dataset.orderCard;event.dataTransfer.setData('application/x-islet-ai-card',dragged);event.dataTransfer.effectAllowed='move';grip.parentElement.classList.add('is-dragging');});
  orderList.addEventListener('dragover',event=>{const row=event.target.closest('[data-order-card]');if(!dragged||!row||row.dataset.orderCard===dragged)return;event.preventDefault();orderList.querySelectorAll('.is-drop-target').forEach(node=>node.classList.remove('is-drop-target'));row.classList.add('is-drop-target');});
  orderList.addEventListener('drop',event=>{const target=event.target.closest('[data-order-card]')?.dataset.orderCard;if(!dragged||!target)return;event.preventDefault();const id=dragged;finishDrag();if(id===target)return;const order=view.order.filter(x=>x!==id);order.splice(order.indexOf(target),0,id);view={...view,order};preferencesChanged();});
  orderList.addEventListener('dragend',finishDrag);
  function resetLayout(){view={...view,order:AiView.normalize().order,hidden:[]};preferencesChanged();}
  root.querySelector('#ai-reset-layout').addEventListener('click',resetLayout);custom.addEventListener('toggle',notifyLayout);
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&custom.open){event.preventDefault();event.stopPropagation();custom.open=false;custom.querySelector('summary').focus();}
    const chart=event.target.closest('[data-ai-chart]'),button=event.target.closest('[data-day]');if(!chart||!button||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    event.preventDefault();const buttons=[...chart.querySelectorAll('[data-day]')],index=buttons.indexOf(button),delta=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:event.key==='ArrowUp'?-7:7;
    const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+delta+buttons.length)%buttons.length;buttons[next].focus({preventScroll:true});
  });
  function closeEditor(){custom.open=false;finishDrag();}
  document.addEventListener('pointerdown',event=>{if(custom.open&&!custom.contains(event.target))closeEditor();});
  const refresh=root.querySelector('#ai-refresh');
  function setMessage(text){message=text;messageUntil=Date.now()+7000;meta.textContent=text;}
  refresh.addEventListener('click',async()=>{refresh.disabled=true;refresh.classList.add('is-checking');root.setAttribute('aria-busy','true');setMessage('Checking accounts and activity…');let failed=false;try{const next=await notch.refreshAi();if(!next)throw new Error('Missing account reply');update(next);setMessage('Refresh requested');}catch{failed=true;setMessage('Could not refresh. Try again.');}finally{refresh.classList.remove('is-checking');root.setAttribute('aria-busy','false');if(failed)refresh.disabled=false;else setTimeout(()=>{refresh.disabled=false;},10000);}});
  root.addEventListener('click',async event=>{
    if(event.target.closest('[data-ai-show-all]')){resetLayout();return;}
    const connect=event.target.closest('[data-ai-connect]');if(connect){if(connecting)return;connecting=true;connect.disabled=true;try{const result=await notch.connectClaude();setMessage(result?.ok?'Complete Claude sign-in in Terminal, then Refresh.':'Could not open sign-in. Run Claude Code in Terminal.');}catch{setMessage('Could not open sign-in. Run Claude Code in Terminal.');}finally{connecting=false;if(connect.isConnected)connect.disabled=false;}return;}
    const day=event.target.closest('[data-day]');if(day){if(day.closest('[data-ai-chart="trend"]'))selectedDay=day.dataset.day;else selectedActivity=day.dataset.day;paintInspection();}
  });
  function inspect(event){const day=event.target.closest('[data-day]');if(!day)return;if(day.closest('[data-ai-chart="trend"]'))hoverDay=day.dataset.day;else hoverActivity=day.dataset.day;paintInspection();}
  root.addEventListener('pointerover',inspect);root.addEventListener('focusin',inspect);
  root.addEventListener('pointerout',event=>{const day=event.target.closest('[data-day]');if(!day||day.contains(event.relatedTarget))return;if(day.closest('[data-ai-chart="trend"]'))hoverDay=null;else hoverActivity=null;paintInspection();});
  function windowLabel(w){const m=w.minutes,label=m>=10080?'Weekly':m>=1440?Math.round(m/1440)+' days':m>=60?Math.round(m/60)+' hours':m?m+' min':'Window';return label+(w.scope?' · '+w.scope:'');}
  function resetText(w,now){if(!w.reset)return'Reset time unavailable';if(w.expired)return'Reset due · Awaiting update';const m=Math.max(1,Math.ceil((w.reset-now)/60000));return'Resets in '+(m>=1440?Math.floor(m/1440)+'d '+Math.floor(m%1440/60)+'h':m>=60?Math.floor(m/60)+'h '+m%60+' min':m+' min');}
  function windowCell(id,w,now){
    const value=w.value===null?'—':w.value+'<i>%</i>',label=windowLabel(w);
    return `<div class="ai-win ${w.stale||w.expired?'is-stale':''} ${w.level==='low'?'is-low':w.level==='critical'?'is-critical':''}" data-ai-key="window.${esc(w.key)}"><span class="ai-win-label">${esc(label)}</span><strong class="ai-win-value">${value}</strong><span class="ai-win-bar" role="progressbar" aria-label="${labels[id]} ${view.limitDisplay} · ${esc(label)}" aria-valuemin="0" aria-valuemax="100" ${w.value===null?'aria-valuetext="Reading unavailable"':`aria-valuenow="${w.value}" aria-valuetext="${w.value}% ${view.limitDisplay}"`}><i data-fill="${w.value??0}"></i>${w.pace===null?'':`<b class="ai-pace" data-pace="${w.pace}" title="${Math.round(w.pace)}% of this time window ${view.limitDisplay==='used'?'elapsed':'remaining'}"></b>`}</span><small title="${w.reset?esc(new Date(w.reset).toLocaleString('en-US')):''}">${esc(resetText(w,now))}</small></div>`;
  }
  function providerCard(id,now,rows,sessions){
    const windows=AiView.quota(data,id,view.limitDisplay,now),mine=rows.filter(row=>row.provider===id),total=AiView.totals(mine),status=id==='codex'?data.accountStatus:data.claudeAccountStatus;
    const working=sessions.some(s=>s.provider===id&&AiState.kindOf(s,now)==='working'),checking=Boolean(data.checking?.[id]),limits=data.limits[id];
    const reason=({loading:'Checking account…',missing:labels[id]+' CLI not found',signin:'Not signed in','no-limits':'No plan limits published',outdated:'Update Claude Code to check limits',unavailable:'Account limits unavailable'})[status]||'No account reading yet';
    const source=windows.length?(windows.some(w=>w.expired)?'Reset due':windows.every(w=>!w.stale)?'Live':'Snapshot'):null;
    const activity=`<div class="ai-agent-windows ai-local-stats"><div class="ai-win is-measured"><span class="ai-win-label">Local tokens</span><strong class="ai-win-value">${mine.length?count(total.total):'—'}</strong></div><div class="ai-win is-measured"><span class="ai-win-label">Responses</span><strong class="ai-win-value">${mine.length?count(total.responses):'—'}</strong></div></div><small class="ai-account-note">Not a plan allowance</small>`;
    const badge=checking?'<span class="ai-checking" role="status" aria-label="Checking account"></span>'
      :working?'<span class="ai-working-pill">Working</span>'
        :source?`<span class="ai-agent-source ${source!=='Live'?'is-stale':''}">${source}</span>`:'';
    const resets=id==='codex'&&data.resets!==null&&data.resets!==undefined
      ?`<span title="Resets reported by this Codex account">${AiView.number(data.resets)} resets</span>`:'';
    const body=windows.length
      ?`<div class="ai-agent-windows">${windows.map(w=>windowCell(id,w,now)).join('')}</div><div class="ai-account-footer"><span>${view.limitDisplay==='used'?'Used':'Remaining'}</span>${resets}</div>`
      :activity;
    const signIn=id==='claude'&&status==='signin'
      ?`<div class="ai-agent-foot"><button type="button" class="ai-connect" data-ai-connect ${connecting?'disabled':''}>Connect Claude <span aria-hidden="true">↗</span></button><small title="Run this in Terminal"><code>claude auth login</code></small></div>`
      :id==='codex'&&status==='signin'?'<small class="ai-account-note">In Terminal: <code>codex login</code></small>':'';
    return `<div class="ai-agent-head">${mark(id)}<span class="ai-agent-name">${labels[id]}</span>${badge}</div>
      <div class="ai-agent-plan ${windows.length?'':'is-reason'}">${esc(windows.length?limits?.plan:reason)}</div>${body}${signIn}`;
  }
  function heading(title,name,side=''){return `<div class="ai-card-head"><span>${icon(name)}${title}</span>${side}</div>`;}
  function usageCard(rows){const t=AiView.totals(rows),input=t.input+t.cached+t.write;return heading('Token usage','usage',`<span class="ai-soft">${view.period==='today'?'Today':view.period+'d'}</span>`)+`<div class="ai-total">${rows.length?count(t.total):'—'}<small>tokens</small></div><div class="ai-token-split"><span>In ${count(t.input)}</span><span>Out ${count(t.output)}</span></div><div class="ai-cache">${input?'Cache '+Math.round(t.cached/input*100)+'%':'Local history'}<span>${count(t.responses)} responses</span></div>`;}
  function elapsed(start,now){const s=Math.floor(Math.max(0,now-start)/1000);return(s>=3600?Math.floor(s/3600)+':':'')+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
  function liveCard(sessions,now){const working=sessions.filter(s=>AiState.kindOf(s,now)==='working').length;return heading('Sessions','live',`<span class="ai-live-count">${working} working</span>`)+`<div id="ai-list" class="ai-live-list">${sessions.length?sessions.slice(0,2).map((s,i)=>`<div class="ai-live-row" data-ai-key="session.${esc(s.provider+'.'+(s.sessionId||s.pid||i))}" title="${esc(s.inferred?'Inferred from recent logs; the process may have closed.':'Reported by a running process')}"><span class="ai-session-mark" aria-hidden="true">${ProviderMarks.markHtml(s.provider)}<i class="ai-dot is-${AiState.kindOf(s,now)}"></i></span><div><b>${esc(s.name||s.folder||labels[s.provider])}</b><small>${labels[s.provider]||'Agent'} · ${esc(AiState.describe(s,now))}${s.inferred?' · log':''}</small></div>${s.startedAt?`<time data-session-start="${s.startedAt}">${elapsed(s.startedAt,now)}</time>`:''}</div>`).join(''):'<p class="ai-empty">No recent sessions.</p>'}</div>`;}
  function ranking(rows,key,title){const groups=new Map();for(const row of rows){const name=row[key]||'Unknown';groups.set(name,(groups.get(name)||0)+AiView.number(row.total));}const list=[...groups].sort((a,b)=>b[1]-a[1]).slice(0,3),max=list[0]?.[1]||1;return heading(title,key==='model'?'models':'projects',`<span class="ai-soft">tokens</span>`)+(list.length?list.map(([name,value])=>`<div class="ai-ranking" data-ai-key="${esc(name)}"><div><span title="${esc(name)}">${esc(name)}</span><b>${count(value)}</b></div><progress max="${max}" value="${value}" aria-label="${esc(name)} ${value} tokens"></progress></div>`).join(''):'<p class="ai-empty">No activity in this period.</p>');}
  function trendCard(rows,now){trendDays=AiView.buckets(rows,view.period==='30'?30:7,now);const peak=Math.max(1,...trendDays.map(d=>d.total));return heading('Daily tokens','trend',`<span class="ai-soft">${trendDays.length} days</span>`)+`<div class="ai-trend" data-ai-chart="trend" role="group" aria-label="Daily token history">${trendDays.map(d=>`<button type="button" data-ai-key="${d.day}" data-day="${d.day}" aria-label="${d.day}: ${d.total.toLocaleString('en')} tokens" tabindex="${d.day===(selectedDay||AiView.dayKey(now))?0:-1}"><i data-height="${d.total?Math.max(3,d.total/peak*54):2}" class="${d.day===AiView.dayKey(now)?'is-today':''}">${AiView.providers.filter(id=>d[id]>0).map(id=>`<span data-provider="${id}" data-share="${d[id]/d.total*100}"></span>`).join('')}</i><small>${trendDays.length===7?new Date(d.date).getDate():''}</small></button>`).join('')}</div><div class="ai-chart-readout" id="ai-trend-readout" role="status"></div>`;}
  function activityCard(rows,now){activityDays=AiView.buckets(rows,28,now);const peak=Math.max(1,...activityDays.map(d=>d.total));return heading('Activity','activity','<span class="ai-soft">28 days</span>')+`<div class="ai-activity-body"><div class="ai-heatmap" data-ai-chart="activity" role="group" aria-label="Activity over 28 days">${activityDays.map(d=>`<button type="button" class="ai-level-${d.total?Math.max(1,Math.ceil(d.total/peak*4)):0}" data-ai-key="${d.day}" data-day="${d.day}" aria-label="${d.day}: ${d.total.toLocaleString('en')} tokens" tabindex="${d.day===(selectedActivity||AiView.dayKey(now))?0:-1}"></button>`).join('')}</div><div id="ai-activity-readout" class="ai-chart-readout" role="status"></div></div>`;}
  function paintInspection(){for(const [name,days,chosen] of [['trend',trendDays,hoverDay||selectedDay],['activity',activityDays,hoverActivity||selectedActivity]]){const target=root.querySelector('#ai-'+name+'-readout');if(!target)continue;const d=days.find(d=>d.day===chosen)||days.at(-1);if(!d)continue;const label=new Date(d.date).toLocaleDateString('en-US',{month:'short',day:'numeric'}),text=label+' · '+count(d.total)+' tokens · Codex '+count(d.codex)+' / Claude '+count(d.claude);if(target.textContent!==text)target.textContent=text;root.querySelector('[data-ai-chart="'+name+'"]')?.querySelectorAll('[data-day]').forEach(b=>{const active=b.dataset.day===d.day;b.classList.toggle('is-inspected',active);b.tabIndex=active?0:-1;});}}
  function paint(){
    const now=Date.now(),shown=AiView.shownProviders(data,view.provider),today=AiView.dayKey(now),start=AiView.days(view.period==='today'?1:Number(view.period),now)[0].day;
    const allRows=(data.buckets||[]).filter(r=>shown.includes(r.provider)),rows=allRows.filter(r=>r.day>=start&&r.day<=today),sessions=AiState.sortSessions((data.sessions||[]).filter(s=>shown.includes(s.provider)),now);
    root.querySelectorAll('[data-ai-provider]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.aiProvider===view.provider)));root.querySelector('#ai-period').value=view.period;
    meta.textContent=messageUntil>now?message:data.scanFailed?'History unavailable · Restart Islet to retry':data.scanning?'Reading local history…':data.updatedAt?'Updated '+new Date(data.updatedAt).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}):'Looking for local agents…';
    const working=sessions.filter(s=>AiState.kindOf(s,now)==='working').length,waiting=sessions.filter(s=>AiState.kindOf(s,now)==='waiting').length;root.querySelector('#ai-live-summary').textContent=working?working+' working'+(waiting?' · '+waiting+' waiting':''):waiting?waiting+' waiting':'Local only';
    const unavailable=allRows.length?[]:['tokens','trend','models','projects','activity',...(sessions.length?[]:['live'])];
    currentTiles=AiView.tiles({...view,hidden:[...view.hidden,...unavailable]},shown);emptyState=!shown.length||!currentTiles.length;let html;
    if(!shown.length)html=`<div class="ai-empty-state" data-ai-key="empty"><span>${icon('live')}</span><strong>${data.scanning||data.accountStatus==='loading'?'Looking for your agents':'No local activity yet'}</strong><p>Run Codex or Claude Code to see sessions and usage here.</p></div>`;
    else if(!currentTiles.length)html=`<div class="ai-empty-state" data-ai-key="empty"><strong>${view.hidden.length===Object.keys(AiView.cards).length?'Your cards are hidden':'No local history to show yet'}</strong><p>Choose the cards you want in Customize.</p><button type="button" data-ai-show-all>Show all cards</button></div>`;
    else html=currentTiles.map(tile=>{const content=tile.card==='limits'?providerCard(tile.provider,now,rows,sessions):tile.card==='tokens'?usageCard(rows):tile.card==='live'?liveCard(sessions,now):tile.card==='trend'?trendCard(allRows,now):tile.card==='models'||tile.card==='projects'?ranking(rows,tile.card==='models'?'model':'project',AiView.cards[tile.card]):activityCard(allRows,now);return `<article class="ai-card ${tile.wide?'ai-wide':''} ${tile.provider?'ai-agent':''}" data-ai-key="${tile.key}" data-card="${tile.card}" ${tile.provider?'data-agent="'+tile.provider+'"':''}>${content}</article>`;}).join('');
    const scrollTop=scrollElement.scrollTop;AiDom.render(container,html);container.dataset.agent=view.provider;root.dataset.agent=view.provider;
    container.querySelectorAll('[data-fill]').forEach(n=>{n.style.width=n.dataset.fill+'%';});container.querySelectorAll('[data-height]').forEach(n=>{n.style.height=n.dataset.height+'px';});container.querySelectorAll('[data-share]').forEach(n=>{n.style.height=n.dataset.share+'%';});container.querySelectorAll('[data-pace]').forEach(n=>{n.style.left=n.dataset.pace+'%';});
    scrollElement.scrollTop=scrollTop;paintEditor();paintInspection();notifyLayout();
  }
  function update(next){
    receivedDashboard=true;
    if(next?.claudeAccountStatus!==data.claudeAccountStatus&&next?.claudeAccountStatus!=='signin')messageUntil=0;
    data={...defaults,...next,limits:next?.limits||{}};paint();return data.sessions||[];
  }
  function updateSessions(list){if(!receivedDashboard){data.sessions=list.map(s=>({...s,provider:s.provider||'claude'}));paint();}}
  function closedReading(id,now=Date.now()){if(view.readout!=='quota')return null;const w=AiView.quota(data,id,view.limitDisplay,now).filter(w=>w.value!==null&&!w.stale).sort((a,b)=>b.used-a.used)[0];return w?{text:w.value+'%',label:windowLabel(w)+' · '+w.value+'% '+view.limitDisplay}:null;}
  let ticks=0;setInterval(()=>{if(!panel.classList.contains('is-active')||!document.body.classList.contains('state-open'))return;const now=Date.now();root.querySelectorAll('[data-session-start]').forEach(t=>{const text=elapsed(Number(t.dataset.sessionStart),now);if(t.textContent!==text)t.textContent=text;});if(++ticks%15===0)paint();},1000);
  paint();return{update,updateSessions,preferredHeight,closedReading,closeEditor};
})();
