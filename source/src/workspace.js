/* Local HTTP mode uses durable server state. The standalone HTML stays an offline rehearsal. */
const WORK = { ready:false, loading:BEDROCK_LOCAL, busy:false, version:0, job:null, historyRuns:[], history:null, role:'customer', inbox:{q:'',status:'all',offset:0}, historyUI:{banner:'ALDO_CA',q:'',offset:0,product:null,record:null}, replay:null };
const workspaceBusyBase = anyBusy;
anyBusy = () => WORK.loading || WORK.busy || workspaceBusyBase();
async function workspaceGet(path) {
  const response=await fetch(path,{cache:'no-store'}), result=await response.json();
  if(!response.ok)throw Object.assign(new Error(result.error?.message || 'The saved workspace is unavailable.'),{code:result.error?.code});
  return result;
}
function applyWorkspace(s) {
  restoreCaseWorkspace(s.workspace); WORK.version=s.version; WORK.history=s.history; WORK.historyRuns=s.historyRuns; WORK.job=s.job;
  for(const k of Object.values(IDX.kase))if(k.photo?.imageData)k.photo.url=k.photo.imageData;
  WORK.ready=true;WORK.loading=false;WORK.busy=s.busy;
  $('#workspace-stop').hidden=!WORK.busy;
  if(STATE.active!=='__new'&&!CASES[STATE.active])STATE.active='maya';
  renderTabsBar();renderTab(STATE.tab);renderMast();
}
async function initWorkspace() {
  if(!BEDROCK_LOCAL)return;
  try {
    const status=await workspaceGet('/api/status');bedrockToken=status.csrfToken;
    applyWorkspace(await workspaceGet('/api/workspace'));
    if(WORK.busy)await followWorkspaceJob(WORK.job.id);
  }catch(e){WORK.loading=false;WORK.ready=false;toast(e.message);renderDataSource();}
}
async function followWorkspaceJob(id) {
  let snapshot;
  do {
    await sleep(250);snapshot=await workspaceGet('/api/workspace');applyWorkspace(snapshot);
    if(snapshot.job?.id!==id)throw new Error('Another workflow replaced the displayed run. The saved case remains available.');
  }while(snapshot.busy);
  if(snapshot.job.status==='error'||snapshot.job.status==='interrupted')throw Object.assign(new Error(snapshot.job.error),{code:snapshot.job.code});
  return snapshot.job.result;
}
async function workspaceCommand(command) {
  if(!WORK.ready)throw new Error('The saved workspace is not connected. Reload the app.');
  if(WORK.busy)throw new Error('Wait for the current workflow to finish.');
  WORK.busy=true; renderMast();
  try {
    const {job}=await bedrockPost('/api/workflow',{mode:STATE.mode,tier:STATE.tier,failureSwitch:STATE.failureSwitch,role:WORK.role,...command,version:WORK.version});
    WORK.job=job;return await followWorkspaceJob(job.id);
  }catch(e){WORK.busy=false;if(e.code?.startsWith('aws_')){STATE.live.available=false;STATE.live.reason=e.message;STATE.mode='scripted';}try{applyWorkspace(await workspaceGet('/api/workspace'));}catch{}toast(e.message);throw e;}
  finally{if(!WORK.job||WORK.job.status!=='running')WORK.busy=false;}
}
const localInvestigate=investigate,localAct=act,localReview=decideReview,localReceipt=gradeAtCounter,localPolicyReview=askPolicyReview,localPrevention=runPrevention,localReset=resetAll,localMeasure=measureNow,localStop=stopRun,localNew=startNewCustomer;
investigate=async function(id,opts={}){
  if(!BEDROCK_LOCAL||opts.sink)return localInvestigate(id,opts);
  try{await workspaceCommand({kind:'investigate',caseId:id,words:CASES[id].words,mode:opts.mode||STATE.mode});return CASES[id].decision;}catch(e){if(opts.throwOnError)throw e;return null;}
};
act=async function(id,opts={}){if(!BEDROCK_LOCAL)return localAct(id,opts);try{await workspaceCommand({kind:'act',caseId:id,choice:CASES[id].chosen,confirmed:true,mode:opts.mode||STATE.mode});}catch{}};
decideReview=async function(id,choice){if(!BEDROCK_LOCAL)return localReview(id,choice);try{await workspaceCommand({kind:'review',reviewId:id,choice,role:EXPERIENCE.role==='customer_service'?EXPERIENCE.approver:WORK.role});}catch{}};
gradeAtCounter=async function(id,store,grade){if(!BEDROCK_LOCAL)return localReceipt(id,store,grade);try{return await workspaceCommand({kind:'receipt',caseId:id,store,grade});}catch{}};
askPolicyReview=async function(id){if(!BEDROCK_LOCAL)return localPolicyReview(id);try{return await workspaceCommand({kind:'policy-review',caseId:id});}catch{}};
runPrevention=async function(opts={}){if(!BEDROCK_LOCAL)return localPrevention(opts);try{await workspaceCommand({kind:'prevention',caseId:IDX.kase[STATE.active]?.hybrid?STATE.active:null,mode:opts.mode||STATE.mode});}catch{}};
resetAll=async function(){if(!BEDROCK_LOCAL)return localReset();try{await workspaceCommand({kind:'reset',mode:'scripted'});}catch{}};
measureNow=async function(sid){if(!BEDROCK_LOCAL)return localMeasure(sid);try{await workspaceCommand({kind:'measure',styleId:sid,mode:'scripted'});}catch{}};
stopRun=function(){if(!BEDROCK_LOCAL)return localStop();bedrockPost('/api/workflow/stop',{}).catch(e=>toast(e.message));};
startNewCustomer=async function(){
  if(!BEDROCK_LOCAL)return localNew();if(anyBusy())return;
  const f=UI.nc;f.words=$('#nc-words')?.value||f.words;
  if(String(f.words).trim().length<3){f.error='Describe the problem first.';return renderNewForm();}
  try{
    const image=f.file?await bedrockImage(f.file):undefined;
    const result=await workspaceCommand({kind:'custom',spec:{sku:f.sku,name:f.name,region:f.region,days_since_delivery:f.days,words:f.words,grade:f.grade,matches:f.matches,photo_name:f.fileName},image});
    STATE.active=result.caseId;UI.sel={};showTab('return');
  }catch(e){f.error=e.message;renderNewForm();}
};
const localHandoff=handoffToTeam;
handoffToTeam=async function(caseId,summary){if(!BEDROCK_LOCAL)return localHandoff(caseId,summary);const s=custChat(caseId),r=await workspaceCommand({kind:'handoff',caseId,summary,messages:s.msgs.map(m=>`${m.role}: ${m.text}`),mode:'scripted'});s.handoff=r.reviewId;return r.reviewId;};
const baseBoot=boot;
boot=function(){baseBoot();initWorkspace();};

function workspaceStatusLabel(c){return c.received?'Inspection recorded':({new:'Not started',options:'Waiting for customer choice',review:'Human review needed',awaiting_approval:'Waiting for approval',done:'Awaiting inspection',acting:'Resolving',investigating:'Investigating',needs_person:'Stopped — review or resume',not_eligible:'Policy review available'})[c.status]||c.status;}
function renderInbox(){
  rememberDisclosures($('#tab-inbox'));
  const el=$('#tab-inbox');
  if(!BEDROCK_LOCAL||!WORK.ready){el.innerHTML=pageHeading('Saved cases','Reopen a return with its choices, approvals and inspection progress.')+'<div class="empty"><b>Saved cases need the local server.</b>Open Perfect Pair through its local server to save, resume and replay work.</div>';return;}
  const f=WORK.inbox,all=Object.values(CASES).filter(c=>IDX.kase[c.id]),q=f.q.toLowerCase();
  const rows=all.filter(c=>(f.status==='all'||c.status===f.status)&&[c.id,caseName(c.id),IDX.kase[c.id].order_id,IDX.kase[c.id].headline,c.words].join(' ').toLowerCase().includes(q));
  f.offset=Math.min(f.offset,Math.max(0,Math.floor((rows.length-1)/20)*20));
  el.innerHTML=`${pageHeading('Every case, in one place.','Search, reopen and continue. Customer choices and staff decisions are saved on this server.','Saved cases')}
    <div class="dataset-bar"><label>Search <input id="inbox-q" type="search" value="${esc(f.q)}" placeholder="Case, order, product or concern"></label><label>Status <select id="inbox-status"><option value="all">All statuses</option>${[...new Set(all.map(c=>c.status))].sort().map(s=>`<option value="${s}" ${f.status===s?'selected':''}>${esc(workspaceStatusLabel({status:s}))}</option>`).join('')}</select></label><button class="btn secondary sm" data-refresh-work>Refresh</button><span class="small muted">${rows.length} matching cases</span></div>
    <div class="tbl-wrap inbox-table"><table><thead><tr><th>Customer & order</th><th>Return</th><th>Status</th><th></th></tr></thead><tbody>${rows.slice(f.offset,f.offset+20).map(c=>`<tr><td><b>${esc(caseName(c.id))}</b><br><span class="small muted">${esc(IDX.kase[c.id].order_id)}</span></td><td><b>${esc(IDX.kase[c.id].headline)}</b><br><span class="small muted">${esc(c.id)} · ${IDX.kase[c.id].hybrid?'Actual context + synthetic assumptions':'Synthetic demo'}</span></td><td><span class="pill neutral">${esc(workspaceStatusLabel(c))}</span></td><td><button class="btn secondary sm" data-open-case="${esc(c.id)}">Open case</button></td></tr>`).join('')||'<tr><td colspan="4">No matching cases. Try another search or status.</td></tr>'}</tbody></table></div>
    <div class="dataset-bar"><button class="btn secondary sm" data-inbox-page="-1" ${f.offset?'':'disabled'}>Previous</button><span>${rows.length?f.offset+1:0}–${Math.min(rows.length,f.offset+20)}</span><button class="btn secondary sm" data-inbox-page="1" ${f.offset+20<rows.length?'':'disabled'}>Next</button></div>
    <details class="card disclosure" data-disclosure="replay-library"><summary>Recorded replays <span>Original evidence · no model calls or repeated actions</span></summary><div class="card-pad" id="replay-list">Loading…</div></details>`;
  restoreDisclosures(el);
  workspaceGet('/api/replays').then(r=>{const dest=$('#replay-list');if(dest)dest.innerHTML=r.replays.map(x=>`<p><button class="btn secondary sm" data-replay="${x.id}">${esc(x.label)}</button> <span class="small muted">${esc(x.mode)} · ${esc(x.at)}</span></p>`).join('')||'<p>No recorded replays saved yet.</p>';}).catch(e=>toast(e.message));
}
function evidenceDialog(title,html){let d=$('#evidence-dialog');if(d)d.remove();d=document.createElement('dialog');d.id='evidence-dialog';d.className='evidence-dialog';d.innerHTML=`<div class="card-head"><h2>${esc(title)}</h2><button class="btn secondary sm" data-close-evidence>Close</button></div>${html}`;document.body.appendChild(d);d.showModal();}
function sourceJSON(value){return `<pre class="evidence-json">${esc(JSON.stringify(value,null,2))}</pre>`;}
async function openReplay(id){try{const r=await workspaceGet('/api/replays/'+id);WORK.replay=r;const events=r.history?r.history.observations:(r.prevention||r.case).events;let at=0;
  const draw=()=>{const current=events[at];evidenceDialog(`Recorded replay · ${r.label}`,`<p><b>${esc(r.mode)} recording</b> · saved ${esc(r.captured_at)}. Read-only; no model or actions run. ${r.case?`Original status: ${esc(workspaceStatusLabel(r.case))}.`:''}</p><div class="dataset-bar"><button class="btn secondary" data-replay-step="-1" ${at?'':'disabled'}>Previous</button><b>Step ${at+1} / ${events.length}</b><button class="btn" data-replay-step="1" ${at+1<events.length?'':'disabled'}>Next</button></div>${sourceJSON(current)}<details><summary>Original source evidence and policy</summary>${sourceJSON(r.history?r.history.observations:{evidence:r.evidence,policy:r.policy,provenance:r.provenance})}</details>`);};
  WORK.replayStep=delta=>{at=clamp(at+delta,0,events.length-1);draw();};draw();
}catch(e){toast(e.message);}}
function caseProvenancePanel(id){const k=IDX.kase[id];if(!k?.hybrid)return '';const p=k.provenance,{line,ec}=caseCtx(id),r=k.evidence.record;
  return `<section class="card card-pad provenance-panel"><div class="eyebrow">Actual data + synthetic assumptions · simulated new case</div><h3>Where this case’s inputs come from</h3><div class="grid2"><div><b>Supplied history</b><p>SKU ${esc(r.sku)} · ${esc(r.banner)} · ${esc(r.reason)}<br>Recorded refund: ${r.refund==null?'Not supplied':(r.refund/100).toFixed(2)} (source currency unknown).</p><button class="btn secondary sm" data-evidence="${esc(k.evidence.citations[0])}">Open original source row</button></div><div><b>Simulation assumptions</b><p>New-case price ${money(line.selling_price)} · estimated cost ${money(ec.estimated_cost)} · processing ${money(ec.processing_cost)}. CAD is assumed.</p><p class="small muted">${esc(p.price_basis)}</p></div></div><details><summary>All supplied and assumed inputs</summary><p><b>Supplied:</b> ${esc(p.supplied.join('; '))}.</p><p><b>Synthetic:</b> ${esc(p.assumed.join('; '))}.</p><p>Financial options below are modelled estimates under these assumptions. They are not measured ALDO savings. The original historical return is unchanged.</p></details></section>`;
}

const originalShowSource=UI.showSource;
UI.showSource=ref=>ref.startsWith('history:')?workspaceGet('/api/history/evidence?ref='+encodeURIComponent(ref)).then(x=>evidenceDialog('Original supplied evidence',sourceJSON(x))).catch(e=>toast(e.message)):originalShowSource(ref);
document.addEventListener('click',async ev=>{const t=ev.target.closest('button');if(!t)return;
  if(t.id==='workspace-stop')stopRun();
  if(t.dataset.storeHandoff){UI.counter={caseId:t.dataset.storeHandoff,store:null,grade:null};showTab('store');}
  if(t.hasAttribute('data-close-evidence'))$('#evidence-dialog')?.close();
  if(t.dataset.replayStep)WORK.replayStep?.(+t.dataset.replayStep);
  if(t.dataset.replay)openReplay(t.dataset.replay);
  if(t.dataset.resumeCase)await act(t.dataset.resumeCase);
  if(t.dataset.openCase){STATE.active=t.dataset.openCase;UI.sel={};showTab('return');}
  if(t.dataset.inboxPage){WORK.inbox.offset=Math.max(0,WORK.inbox.offset+20*Number(t.dataset.inboxPage));renderInbox();}
  if(t.hasAttribute('data-refresh-work'))try{applyWorkspace(await workspaceGet('/api/workspace'));}catch(e){toast(e.message);}
  if(t.dataset.saveReplay||t.dataset.saveHistory)try{await bedrockPost('/api/replays',{caseId:t.dataset.saveReplay,historyId:t.dataset.saveHistory});toast('Recorded replay saved');if(STATE.tab==='inbox')renderInbox();}catch(e){toast(e.message);}
  if(t.dataset.evidence)try{evidenceDialog('Original supplied evidence',sourceJSON(await workspaceGet('/api/history/evidence?ref='+encodeURIComponent(t.dataset.evidence))));}catch(e){toast(e.message);}
});
document.addEventListener('change',ev=>{if(ev.target.id==='inbox-status'){WORK.inbox.status=ev.target.value;WORK.inbox.offset=0;renderInbox();}});
document.addEventListener('input',ev=>{if(ev.target.id==='inbox-q'){WORK.inbox.q=ev.target.value;WORK.inbox.offset=0;clearTimeout(WORK.qTimer);WORK.qTimer=setTimeout(()=>{renderInbox();const q=$('#inbox-q');q?.focus();q?.setSelectionRange(q.value.length,q.value.length);},180);}});
