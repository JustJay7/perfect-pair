/* Keep the existing screens; the local server owns operational state. */
const PPWORK={version:null,snapshot:null,pending:false,token:null};
async function ppFetch(path,body){
  if(body!==undefined&&!PPWORK.token)PPWORK.token=(await (await fetch('/api/status')).json()).csrfToken;
  const r=await fetch(path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-PP-Token':PPWORK.token},body:JSON.stringify(body)});
  const x=await r.json();if(!r.ok)throw new Error(x.error?.message||'Could not load saved state.');return x;
}
function ppRole(){return ({associate:'store_associate',store:'store_associate',approvals:'store_manager',prevention:'merchandiser'})[STATE.tab]||'customer';}
function ppPaint(){
  const stamp=JSON.stringify([STATE.tab,STATE.active,PPWORK.snapshot,window.PP_WORK_BUSY]);
  if(PPWORK.paintStamp===stamp)return;
  PPWORK.paintStamp=stamp;
  renderTabsBar();
  const pane=$('#tab-return');
  if(STATE.tab==='return' && pane?.dataset.caseId===STATE.active && $('#console-head')){
    renderScenarioBar();renderPhone();renderConsoleHead();
    const cs=CASES[STATE.active],list=$('#trace-return'),key=STATE.active+':'+cs.runId;
    if(list.dataset.run!==key){list.innerHTML='';list.dataset.run=key;}
    const ids=new Set(cs.events.map(e=>String(e.id)));
    stickBottom(list,()=>{
      for(const node of [...list.children])if(!ids.has(node.dataset.ev))node.remove();
      for(const e of cs.events){
        const signature=JSON.stringify(e),node=list.querySelector(`[data-ev="${e.id}"]`);
        if(node?.ppSignature===signature)continue;
        if(node)node.outerHTML=evHTML(e,cs.stats.t0);else list.insertAdjacentHTML('beforeend',evHTML(e,cs.stats.t0));
        const fresh=list.querySelector(`[data-ev="${e.id}"]`);if(fresh)fresh.ppSignature=signature;
      }
    });
    if(!cs.events.length)renderTrace();
    const decision=JSON.stringify([cs.status,cs.decision,cs.chosen,cs.received]);
    if(PPWORK.decisionStamp!==decision){PPWORK.decisionStamp=decision;renderDecisionArea();}
  }else{renderTab(STATE.tab);PPWORK.decisionStamp=null;}
  renderRunTools();
}
function ppApply(s){PPWORK.version=s.version;PPWORK.snapshot=s;restoreCaseWorkspace(s.workspace);window.PP_WORK_BUSY=s.busy||PPWORK.pending;}
async function ppCommand(command){
  if(!window.PP_SERVER_WORK)return;
  if(PPWORK.pending){toast('Wait for the current action to finish.');return;}
  if(PPWORK.version==null){toast('Loading saved progress. Please try again shortly.');return;}
  PPWORK.pending=true;window.PP_WORK_BUSY=true;
  try{
    const started=await ppFetch('/api/workflow',{version:PPWORK.version,mode:STATE.mode,tier:STATE.tier,failureSwitch:STATE.failureSwitch,role:ppRole(),...command});
    while(true){const s=await ppFetch('/api/workspace');ppApply(s);ppPaint();if(!s.busy){if(s.job?.id===started.job.id&&s.job.status==='error')throw new Error(s.job.error);return s.job?.result;}await new Promise(r=>setTimeout(r,350));}
  }catch(e){toast(e.message);try{ppApply(await ppFetch('/api/workspace'));}catch{}return null;}
  finally{PPWORK.pending=false;window.PP_WORK_BUSY=false;ppPaint();}
}
async function ppLoadRuns(){
  const list=await ppFetch('/api/replays');const saved={};
  for(const item of list.replays){const r=await ppFetch('/api/replays/'+item.id);if(!r.case)continue;const c=r.case,rec=c.decision?.options?.find(x=>x.recommended);
    const body={case_id:r.definition.case_id,who:r.label||r.definition.case_id,headline:r.definition.headline,mode:r.mode,tier:c.tierApplied||'',ms:c.stats?.ms||0,stats:c.stats||{},outcome:{status:c.status,recommended:rec?.type||'',message:c.message||c.decision?.customer_message||''},events:c.events,originalEvidence:r.evidence,policy:r.policy};
    saved[r.id]={id:r.id,saved_at:r.captured_at,...body,checksum:runChecksum(body)};
  }RUNS.saved=saved;renderRunTools();
}
if(typeof BEDROCK_LOCAL!=='undefined'&&BEDROCK_LOCAL){
  window.PP_SERVER_WORK=true;window.PP_WORK_BUSY=true;
  const originalInvestigate=investigate;
  investigate=(id,opts={})=>opts.sink?originalInvestigate(id,opts):ppCommand({kind:'investigate',caseId:id,words:CASES[id].words});
  act=(id)=>ppCommand({kind:'act',caseId:id,confirmed:true,choice:CASES[id].chosen});
  decideReview=(id,choice)=>ppCommand({kind:'review',reviewId:id,choice,consent:SYS.reviews[id]?.consent||null});
  gradeAtCounter=(id,store,grade)=>ppCommand({kind:'receipt',caseId:id,store,grade});
  askPolicyReview=id=>ppCommand({kind:'policy-review',caseId:id});
  runPrevention=(opts={})=>ppCommand({kind:'prevention',styleId:opts.styleId});
  measureNow=id=>ppCommand({kind:'measure',styleId:id});
  resetAll=()=>ppCommand({kind:'reset'});
  stopRun=()=>ppFetch('/api/workflow/stop',{});
  handoffToTeam=(id,summary)=>{ppCommand({kind:'handoff',caseId:id,summary,messages:custChat(id).msgs.slice(-8).map(m=>m.text)}).catch(()=>{});return 'Saved staff handoff';};
  saveRun=async id=>{try{await ppFetch('/api/replays',{caseId:id});await ppLoadRuns();toast('Replay saved on this Mac, with original evidence.');}catch(e){toast(e.message);}};
  deleteRun=async id=>{try{await ppFetch('/api/replays/delete',{id});await ppLoadRuns();renderReplayList();}catch(e){toast(e.message);}};
  startNewCustomer=async()=>{
    const f=UI.nc,ta=$('#nc-words');if(ta)f.words=ta.value;if(anyBusy())return;
    if(String(f.words).trim().length<3){f.error='Describe the problem in a few words.';return renderNewForm();}
    let image;if(f.file){const data=await new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(rd.result);rd.onerror=reject;rd.readAsDataURL(f.file);});image={format:f.file.type.split('/')[1].replace('jpg','jpeg'),base64:data.split(',')[1]};}
    try{const result=await ppCommand({kind:'custom',spec:{sku:f.sku,name:f.name,region:f.region,days_since_delivery:f.days,words:f.words,grade:f.grade,matches:f.matches,photo_name:f.fileName},image});if(result?.caseId){STATE.active=result.caseId;UI.sel={};ppPaint();}}catch{}
  };
  (async()=>{try{ppApply(await ppFetch('/api/workspace'));await ppLoadRuns();window.PP_WORK_BUSY=PPWORK.snapshot.busy;ppPaint();while(PPWORK.snapshot.busy){await new Promise(r=>setTimeout(r,500));ppApply(await ppFetch('/api/workspace'));ppPaint();}}catch(e){toast('Saved workspace unavailable: '+e.message);}})();
}

/* Source investigations sit inside the existing Data view. */
const PPHIST={banner:'ALDO_CA',product:null,products:[],error:''};
const ppOriginalData=renderData;
renderData=function(){ppOriginalData();if(!window.PP_SERVER_WORK)return;const host=document.createElement('section');host.className='card card-pad';host.id='pp-history';$('#tab-data').prepend(host);ppHistoryPaint();};
function ppHistoryPaint(){const el=$('#pp-history');if(!el)return;const runs=PPWORK.snapshot?.historyRuns||[];
  el.innerHTML=`<h3>Original-record investigations</h3><p>Review supplied product history or a past return. Findings link to local source records; this does not issue a new refund.</p><label>Brand and market <select id="pp-banner">${(PPHIST.banners||['ALDO_CA','ALDO_US']).map(b=>`<option ${b===PPHIST.banner?'selected':''}>${esc(b)}</option>`).join('')}</select></label> <input id="pp-query" placeholder="Search SKU or product name" aria-label="Search source products"> <button class="btn secondary" id="pp-search">Search</button> <button class="btn" id="pp-all">Investigate all products in this market</button><p role="status">${esc(PPHIST.error)}</p>
  <div>${PPHIST.products.map((p,i)=>`<button class="btn secondary sm" data-hproduct="${i}">${esc(p.name||p.sku)} (${esc(p.sku)}) · ${Number(p.rows).toLocaleString()} return rows</button>`).join(' ')}</div>
  ${PPHIST.product?`<h4>${esc(PPHIST.product.name||PPHIST.product.sku)}</h4><button class="btn" id="pp-product-run">Investigate this product</button><details><summary>Select a past return</summary>${PPHIST.product.records.map(r=>`<p>${esc(r.date)} · ${esc(r.reason)} · ${r.qty} units <button class="btn secondary sm" data-hreturn="${r.row}">Review source row ${r.row}</button></p>`).join('')}</details>`:''}
  ${runs.slice(0,5).map(r=>`<details ${r===runs[0]?'open':''}><summary>${esc(r.agent)} · ${esc(r.banner)} · ${esc(r.sku||'all products')} · ${esc(r.status)}</summary><p>${esc(r.summary||r.error||'Investigating…')}</p>${r.findings.map(f=>`<p>${esc(f.observation)}</p><p class="small muted">${esc(f.uncertainty)}</p>${f.citations.map(ref=>`<button class="btn secondary sm" data-hevidence="${esc(ref)}">Source evidence</button>`).join('')}`).join('')}<ul>${(r.next_steps||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${r.status==='completed'?`<button class="btn secondary" data-hsave="${r.id}">Save evidence replay</button>`:''}</details>`).join('')}<details><summary>Saved historical replays</summary><div id="pp-history-replays"><button class="btn secondary" id="pp-history-list">Load saved investigations</button></div></details><div id="pp-evidence"></div>`;
}
async function ppHistorySearch(){PPHIST.banner=$('#pp-banner').value;const q=$('#pp-query').value;PPHIST.product=null;const [o,p]=await Promise.all([ppFetch('/api/history/overview?banner='+encodeURIComponent(PPHIST.banner)),ppFetch('/api/history/products?banner='+encodeURIComponent(PPHIST.banner)+'&q='+encodeURIComponent(q))]);PPHIST.banners=o.banners;PPHIST.products=p.products;PPHIST.error=p.total+' matching products';ppHistoryPaint();}
document.addEventListener('click',async ev=>{const t=ev.target.closest('button');if(!t)return;try{
  if(t.id==='pp-search')await ppHistorySearch();
  if(t.dataset.hproduct!==undefined){const p=PPHIST.products[+t.dataset.hproduct];PPHIST.product=await ppFetch('/api/history/product?banner='+encodeURIComponent(PPHIST.banner)+'&sku='+encodeURIComponent(p.sku));ppHistoryPaint();}
  if(t.id==='pp-all'||t.id==='pp-product-run'||t.dataset.hreturn){const banner=$('#pp-banner').value;await ppCommand({kind:'history',agent:t.dataset.hreturn?'resolution':'prevention',banner,sku:t.id==='pp-all'?null:PPHIST.product.sku,row:t.dataset.hreturn?+t.dataset.hreturn:undefined,dataset_id:PPWORK.snapshot.history?.dataset_id});}
  if(t.dataset.hevidence){const x=await ppFetch('/api/history/evidence?ref='+encodeURIComponent(t.dataset.hevidence));$('#pp-evidence').innerHTML='<h4>Original source evidence</h4><pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(JSON.stringify(x,null,2))+'</pre>';}
  if(t.dataset.hsave){await ppFetch('/api/replays',{historyId:t.dataset.hsave});toast('Original evidence saved.');}
  if(t.id==='pp-history-list'){const list=await ppFetch('/api/replays');$('#pp-history-replays').innerHTML=list.replays.map(r=>`<button class="btn secondary sm" data-hreplay="${r.id}">${esc(r.label)} · ${esc(r.at)}</button>`).join('')||'No saved investigations yet.';}
  if(t.dataset.hreplay){const x=await ppFetch('/api/replays/'+t.dataset.hreplay);$('#pp-evidence').innerHTML='<h4>Saved replay · read-only · no actions repeated</h4><pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(JSON.stringify(x.history||x,null,2))+'</pre>';}
}catch(e){PPHIST.error=e.message;ppHistoryPaint();}});

document.addEventListener('change',e=>{if(e.target.id==='pp-banner'){PPHIST.banner=e.target.value;PPHIST.product=null;PPHIST.products=[];PPHIST.error='';ppHistoryPaint();}});
