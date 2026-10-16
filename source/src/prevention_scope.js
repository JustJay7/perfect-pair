function preventionPreferences(){try{return JSON.parse(localStorage.getItem('pp-prevention-v1')||'{}')||{};}catch{return {};}}
function savePreventionPreferences(key,value){try{localStorage.setItem('pp-prevention-v1',JSON.stringify({...preventionPreferences(),[key]:value}));}catch{}}
const PREVENT_VIEW={banner:(REAL?.banners||[]).includes(preventionPreferences().oms?.banner)?preventionPreferences().oms.banner:'ALDO_CA',evidence:preventionPreferences().evidence==='transactions'?'transactions':'returns',scope:preventionPreferences().oms?.scope==='single'?'single':'all',browserOpen:true,sku:null,product:null,styleId:null,q:'',offset:0,cache:new Map(),pending:new Set(),error:null};
const COMPANY_NAMES={ALDO:'ALDO',CIS:'Call It Spring',SPERRY:'Sperry',GLOBO:'Globo',GHBASS:'G.H. Bass'};
const marketName=b=>b.endsWith('_CA')?'Canada':b.endsWith('_US')?'United States':b.split('_').at(-1);
function preventionKey(){const v=PREVENT_VIEW;return [WORK.history?.dataset_id,v.banner,v.q,v.offset].join('|');}
function preventionControls(actual,overview) {
  const v=PREVENT_VIEW,banners=overview?.banners||REAL?.banners||['ALDO_CA','ALDO_US'],company=v.banner.split('_')[0],companies=[...new Set(banners.map(b=>b.split('_')[0]))],disabled=anyBusy()?'disabled':'';
  return `<section class="card prevention-scope"><div class="scope-fields">
    <label>Dataset<select id="prevention-source" ${disabled}><option value="transactions">Actual · store & online sales</option><option value="actual" ${actual?'selected':''}>Actual · OMS returns</option><option value="synthetic" ${!actual?'selected':''}>Synthetic demo</option></select></label>
    <label>Company<select id="prevention-company" ${!actual?'disabled':disabled}>${(actual?companies:['ALDO']).map(c=>`<option value="${esc(c)}" ${actual&&c===company?'selected':''}>${esc(COMPANY_NAMES[c]||c)}</option>`).join('')}</select></label>
    <label>Market<select id="prevention-market" ${!actual?'disabled':disabled}>${actual?banners.filter(b=>b.split('_')[0]===company).map(b=>`<option value="${esc(b)}" ${b===v.banner?'selected':''}>${esc(marketName(b))}</option>`).join(''):'<option>Canada · demo network</option>'}</select></label>
    <label>Analyze<select id="prevention-scope" ${disabled}><option value="all" ${v.scope==='all'?'selected':''}>All products</option><option value="single" ${v.scope==='single'?'selected':''}>One product</option></select></label>
    </div><p class="small muted">${actual?'This view uses the earlier OMS return files. Choose Actual store & online sales for individual locations, recorded sales and margins.':'Synthetic reviews, stock, customer histories and outcomes support the operational rehearsal. Company and market are fixed to the demo network.'}</p>
    ${!actual&&v.scope==='single'?`<label class="scope-product">Product<select id="prevention-style" ${disabled}><option value="">Choose a product…</option>${DATA.catalogue.filter(s=>s.category!=='Accessories').map(s=>`<option value="${esc(s.style_id)}" ${v.styleId===s.style_id?'selected':''}>${esc(s.name)} · ${esc(s.style_id)}${s.hybrid?' · actual context + synthetic assumptions':''}</option>`).join('')}</select></label>`:''}
    </section>`;
}
async function loadPreventionEvidence(key) {
  if(PREVENT_VIEW.pending.has(key))return;
  const v=PREVENT_VIEW,banner=v.banner,q=v.q,offset=v.offset;
  v.pending.add(key);
  try {
    const [overview,page]=await Promise.all([workspaceGet('/api/history/overview?'+new URLSearchParams({banner})),workspaceGet('/api/history/products?'+new URLSearchParams({banner,q,offset:String(offset)}))]);
    v.cache.set(key,{overview,page});v.error=null;
  } catch(e){if(key===preventionKey())v.error=e.message;}
  finally {v.pending.delete(key);if(STATE.tab==='prevention'&&UI.dataSource==='actual'&&key===preventionKey())renderPrevention();}
}
function preventionProblem(e,all) {
  const rows=all?e.totals.rows:e.rows,reasons=e.reasons.slice(0,8),label=all?(BANNER_WORD[e.banner]||e.banner):(e.name||e.sku);
  return `<section class="card card-pad prevention-problem"><div class="eyebrow">01 · See the problem · actual records</div><h2>What brings customers back?</h2><p>${num(rows)} return records ${all?'across '+num(e.products)+' products':'for '+esc(e.sku)}. Showing the ${Math.min(8,e.reasons.length)} most frequent recorded reasons.</p><div class="tbl-wrap">${heatHTML({corner:'Selected scope',rows:[label],cols:reasons.map(r=>r.reason||'Not supplied'),fmt:v=>pct(v,1),cells:[reasons.map(r=>({v:rows?r.rows/rows:0,tip:`${r.rows} of ${rows} return records`}))]})}</div><p class="small muted">Share of return records, including open or failed records; not a sales-based return rate or proof of cause.</p><button class="text-button" data-evidence="${esc(e.citations[0])}">View source evidence ${icon('call')}</button></section>`;
}
const renderOperationalPrevention=renderPrevention;
renderPrevention=function(){
  const el=$('#tab-prevention'),v=PREVENT_VIEW,actual=UI.dataSource==='actual';
  rememberDisclosures(el);
  if(!actual) {
    renderOperationalPrevention();
    el.insertAdjacentHTML('afterbegin',preventionControls(false));
    const run=$('#prev-run');run.textContent=v.scope==='single'?'Analyze selected product':'Analyze all demo products';run.disabled=anyBusy()||(v.scope==='single'&&!v.styleId);
    if(STATE.prevention.events.length)run.closest('.section-head').insertAdjacentHTML('afterend',`<p class="small muted">Saved operational run: ${STATE.prevention.styleId?esc(styleName(STATE.prevention.styleId)):'all demo products'}. The controls above set the next run.</p>`);
    return;
  }
  const data=v.cache.get(preventionKey());
  el.innerHTML=pageHeading('Prevention agent','Start with all products in the selected market, or choose a product for a closer look.','Actual OMS returns')+preventionControls(true,data?.overview);
  if(!BEDROCK_LOCAL||!WORK.ready||!WORK.history){el.insertAdjacentHTML('beforeend','<section class="card card-pad"><h2>Connect the supplied records</h2><p>Actual investigations need the local server with the source files imported. The synthetic demo and actual aggregate Insights are still available.</p></section>');return;}
  if(!data){el.insertAdjacentHTML('beforeend',`<p role="status">${esc(v.error||'Loading the selected market…')}</p>${v.error?'<button class="btn secondary" id="prevention-retry">Try again</button>':''}`);if(!v.error)loadPreventionEvidence(preventionKey());return;}
  const {overview,page}=data,selected=v.scope==='single'?v.product:overview,valid=!!selected;
  if(v.scope==='single')el.insertAdjacentHTML('beforeend',`<details class="card disclosure" ${v.browserOpen?'open':''} id="prevention-products"><summary>${v.product?'Change product · '+esc(v.product.name||v.product.sku):'Choose a product'} <span>Search the selected market’s ${num(overview.products)} products</span></summary><div class="card-pad"><label for="prevention-query">Product name or SKU</label><input id="prevention-query" type="search" value="${esc(v.q)}" placeholder="Search supplied products" ${anyBusy()?'disabled':''}><div class="tbl-wrap"><table><thead><tr><th>Product</th><th>Return records</th><th></th></tr></thead><tbody>${page.products.map(p=>`<tr><td>${esc(p.name||'Name not supplied')}<br><span class="small mono">${esc(p.sku)}</span></td><td>${num(p.rows)}</td><td><button class="btn secondary sm" data-prevention-product="${esc(p.sku)}" ${anyBusy()?'disabled':''}>Select product</button></td></tr>`).join('')||'<tr><td colspan="3">No matching products.</td></tr>'}</tbody></table></div><div class="dataset-bar"><button class="btn secondary sm" data-prevention-page="-1" ${anyBusy()||!v.offset?'disabled':''}>Previous</button><span>${page.total?v.offset+1:0}–${Math.min(v.offset+25,page.total)} of ${num(page.total)}</span><button class="btn secondary sm" data-prevention-page="1" ${anyBusy()||v.offset+25>=page.total?'disabled':''}>Next</button></div></div></details>`);
  if(selected)el.insertAdjacentHTML('beforeend',preventionProblem(selected,v.scope==='all'));
  const scopeLabel=v.scope==='all'?`${BANNER_WORD[v.banner]||v.banner} · all products`:v.product?`${BANNER_WORD[v.banner]||v.banner} · ${v.product.name||v.sku} (${v.sku})`:'Select a product above';
  el.insertAdjacentHTML('beforeend',`<section class="card card-pad prevention-launch"><div><div class="eyebrow">Selected for analysis</div><h2>${esc(scopeLabel)}</h2><p class="small muted">${STATE.mode==='live'?'Live agent':'Scripted demonstration'} · findings link back to the original source. Findings stay attached to this exact selection.</p>${v.runError?`<p role="alert">${esc(v.runError)}</p>`:''}</div><button class="btn" id="prevention-investigate" ${!valid||anyBusy()?'disabled':''}>${v.running?'Analyzing…':v.scope==='all'?'Analyze all products':'Analyze this product'} ${v.running?'':icon('play')}</button></section>`);
  const runs=WORK.historyRuns.filter(r=>r.source!=='transactions'&&r.agent==='prevention'&&r.dataset_id===WORK.history.dataset_id&&r.banner===v.banner&&(r.sku||null)===(v.scope==='single'?v.sku:null));
  el.insertAdjacentHTML('beforeend',`<section class="stack prevention-results" aria-live="polite">${historyRunList(runs)}</section>`);
  const launch=el.querySelector('.prevention-launch'),results=el.querySelector('.prevention-results');
  el.querySelector('.prevention-scope').after(launch);launch.after(results);
  const problem=el.querySelector('.prevention-problem');
  if(problem){const details=document.createElement('details');details.className='card disclosure';details.open=!runs.length;details.innerHTML='<summary>Recorded return reasons <span>Source counts for this selection</span></summary>';problem.replaceWith(details);details.append(problem);}
  restoreDisclosures(el);
};
function resetPreventionScope(){const v=PREVENT_VIEW;v.sku=null;v.product=null;v.q='';v.offset=0;v.error=null;v.runError=null;v.browserOpen=true;}
document.addEventListener('change',ev=>{
  const t=ev.target,v=PREVENT_VIEW;if(!t.id.startsWith('prevention-')||anyBusy())return;
  if(t.id==='prevention-source'){v.evidence=t.value==='transactions'?'transactions':'returns';savePreventionPreferences('evidence',v.evidence);resetPreventionScope();if(typeof TX!=='undefined'&&TX.views.prevention){TX.views.prevention.product=null;TX.views.prevention.data=null;}setDataSource(t.value==='transactions'?'actual':t.value,false);v.error=null;v.runError=null;renderPrevention();}
  if(t.id==='prevention-company'){v.banner=(REAL?.banners||[]).find(b=>b.split('_')[0]===t.value)||'ALDO_CA';resetPreventionScope();renderPrevention();}
  if(t.id==='prevention-market'){v.banner=t.value;resetPreventionScope();renderPrevention();}
  if(t.id==='prevention-scope'){v.runError=null;v.scope=t.value;renderPrevention();}
  if(t.id==='prevention-style'){v.styleId=t.value||null;renderPrevention();}
  if(['prevention-company','prevention-market','prevention-scope'].includes(t.id))savePreventionPreferences('oms',{banner:v.banner,scope:v.scope});
});
document.addEventListener('click',async ev=>{
  const t=ev.target.closest('button');if(!t)return;const v=PREVENT_VIEW;
  if(t.id==='prev-run'){
    ev.stopImmediatePropagation();if(anyBusy()||(v.scope==='single'&&!v.styleId))return;
    return runPrevention({styleId:v.scope==='single'?v.styleId:null});
  }
  try {
    if(t.id==='prevention-retry'){v.error=null;renderPrevention();}
    if(t.dataset.preventionProduct){const banner=v.banner,sku=t.dataset.preventionProduct;const product=await workspaceGet('/api/history/product?'+new URLSearchParams({banner,sku}));if(v.banner!==banner||STATE.tab!=='prevention'||UI.dataSource!=='actual')return;v.sku=sku;v.product=product;v.browserOpen=false;renderPrevention();}
    if(t.dataset.preventionPage){v.offset=Math.max(0,v.offset+Number(t.dataset.preventionPage)*25);v.error=null;renderPrevention();}
    if(t.id==='prevention-investigate'){if(anyBusy()||(v.scope==='single'&&!v.product))return;const command={kind:'history',agent:'prevention',banner:v.banner,sku:v.scope==='single'?v.sku:null,dataset_id:WORK.history.dataset_id};v.running=true;v.runError=null;const pending=workspaceCommand(command);renderPrevention();try{await pending;}catch(e){v.runError=e.message;}finally{v.running=false;if(STATE.tab==='prevention'){renderPrevention();$('#tab-prevention .analysis-result')?.scrollIntoView({block:'start',behavior:'smooth'});}}}
  }catch(e){toast(e.message);}
},true);
document.addEventListener('input',ev=>{
  if(ev.target.id!=='prevention-query')return;
  PREVENT_VIEW.q=ev.target.value;PREVENT_VIEW.offset=0;PREVENT_VIEW.error=null;clearTimeout(PREVENT_VIEW.timer);
  PREVENT_VIEW.timer=setTimeout(async()=>{const key=preventionKey();await loadPreventionEvidence(key);if(key!==preventionKey())return;const input=$('#prevention-query');input?.focus();input?.setSelectionRange(input.value.length,input.value.length);},250);
});

document.addEventListener('toggle',ev=>{if(ev.target.id==='prevention-products'&&ev.target.isConnected)PREVENT_VIEW.browserOpen=ev.target.open;},true);
