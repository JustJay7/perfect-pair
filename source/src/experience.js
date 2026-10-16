/* Workspace navigation is a prototype view boundary, not authentication. */
const EXPERIENCE = { role: 'customer', customerCase: 'maya', approver: 'supervisor', disclosures: {}, historyFrom: 'dashboard' };
const WORKSPACES = {
  customer: { label:'Customer',role:'customer',pages:['return','scenarios'],nav:[['return','My return','replan'],['scenarios','Demo use cases','grid']] },
  store_manager: { label:'Store Manager',role:'store_manager',pages:['manager','store','routing','approvals'],nav:[['manager','Work queue','inbox'],['store','Process returns','store']] },
  customer_service: { label:'Customer Service',role:'supervisor',pages:TABS.map(t=>t[0]).filter(id=>id!=='home'),nav:[['inbox','Cases','inbox'],['prevention','Prevention','spark'],['dashboard','Insights','chart']] },
};
function workspaceLanding(){return EXPERIENCE.role==='customer'?'return':EXPERIENCE.role==='store_manager'?'manager':'inbox';}
Object.assign(ICONS, {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  inbox: '<path d="M4 4h16l2 12v4H2v-4zM2 16h6l2 3h4l2-3h6"/>',
  chart: '<path d="M4 3v18h17M8 16v-5M13 16V6M18 16v-8"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
});
try {
  const saved = localStorage.getItem('pp-workspace');
  if (Object.hasOwn(WORKSPACES,saved)) EXPERIENCE.role = saved;
  EXPERIENCE.customerCase = localStorage.getItem('pp-customer-case') || 'maya';
} catch {}
WORK.role = WORKSPACES[EXPERIENCE.role].role;
function workspaceCanAccess(id) { return WORKSPACES[EXPERIENCE.role].pages.includes(id); }
function workspaceReviews() { return Object.values(SYS.reviews).filter(r=>EXPERIENCE.role==='store_manager'?r.kind==='counter':EXPERIENCE.role==='customer_service'); }
function ensureCustomerCase() {
  if (!CASES[EXPERIENCE.customerCase] && !WORK.loading) EXPERIENCE.customerCase = 'maya';
  STATE.active = CASES[EXPERIENCE.customerCase] ? EXPERIENCE.customerCase : 'maya';
}
function changeWorkspace(role, destination='home') {
  if (!Object.hasOwn(WORKSPACES,role)) return;
  if (anyBusy()) { $('#workspace-role').value = EXPERIENCE.role; return toast('Finish or stop the current run before switching workspaces.'); }
  EXPERIENCE.role = role; WORK.role = WORKSPACES[role].role;
  if (destination==='home') MANAGER_UI.reviewId=null;
  UI.apFocus=null; UI.apFilter='all'; UI.apQuery=''; UI.sel={}; CHAT.appr.open=false;
  $('#evidence-dialog')?.remove(); $('#demo-settings').close(); $('#appr-chat')?.replaceChildren();
  document.querySelectorAll('.tab-panel').forEach(el=>el.replaceChildren());
  if (role==='customer') ensureCustomerCase();
  try { localStorage.setItem('pp-workspace',role); localStorage.setItem('pp-customer-case',EXPERIENCE.customerCase); } catch {}
  showTab(destination); renderMast();
}
function primaryPage() {
 if(EXPERIENCE.role==='customer')return STATE.tab;
 if(EXPERIENCE.role==='store_manager')return ['store','routing'].includes(STATE.tab)?'store':'manager';
 if(['inbox','return','manager','store','routing','approvals'].includes(STATE.tab))return 'inbox';
 if(['prevention','history'].includes(STATE.tab))return 'prevention';
 return 'dashboard';
}
function renderWorkspaceNavigation() {
  const w=WORKSPACES[EXPERIENCE.role], current=primaryPage(), n=workspaceReviews().filter(r=>r.status==='pending').length;
  document.body.dataset.workspace=EXPERIENCE.role;
  $('#workspace-role').value=EXPERIENCE.role;
  $('#workspace-role').disabled=anyBusy();
  $('#workspace-label').textContent=w.label+' workspace';
  $('#nav-caption').textContent=EXPERIENCE.role==='customer'?'YOUR SPACE':'WORKSPACE';
  $('#settings-open').hidden=EXPERIENCE.role==='customer';
  $('#tabs').innerHTML=w.nav.map(([id,label,ic])=>`<button class="workspace-nav" role="tab" id="tabbtn-${id}" aria-controls="tab-${current===id?STATE.tab:id}" aria-selected="${current===id}" tabindex="${current===id?0:-1}" data-tab="${id}">${icon(ic)}<span>${label}</span>${id==='approvals'&&n?`<span class="nav-count">${n}</span>`:id==='manager'&&managerAttentionCases().length?`<span class="nav-count">${managerAttentionCases().length}</span>`:''}</button>`).join('');
  renderPageContext();
}
function pageHeading(title,subtitle,kicker) { return `<div class="page-heading"><div class="eyebrow">${esc(kicker||WORKSPACES[EXPERIENCE.role].label)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>`; }
function renderPageContext() {
 const el=$('#page-context');if(!el)return;const current=STATE.tab,primary=primaryPage();let links=[],extra='';
 if(EXPERIENCE.role==='store_manager'){
  if(primary==='store')links=[['store','1 · Receive & inspect'],['routing','2 · Item destination']];
  else if(current==='approvals')links=[['manager','← Work queue'],['approvals','Approval details & history']];
 }
 if(EXPERIENCE.role==='customer_service'){
  if(primary==='inbox'&&current!=='inbox')links=[['inbox','← Cases'],[current,({return:'Return assessment',manager:'Customer follow-up',store:'Receive & inspect',routing:'Item destination',approvals:'Approval requests'})[current]]];
  if(primary==='prevention')links=[['prevention','Product & store analysis'],['history','Investigate historical records']];
  if(primary==='dashboard'){
   links=[['dashboard','Analytics']];
   extra=`<label class="workspace-tools">Evidence & demo tools<select id="workspace-tool"><option value="">Choose a tool…</option>${[['data','Source data'],['audit','Audit & fairness'],['evals','Scenario tests'],['how','Architecture & setup']].map(([id,label])=>`<option value="${id}" ${id===current?'selected':''}>${label}</option>`).join('')}</select></label>`;
  }
 }
 el.innerHTML=links.length||extra?`<nav class="page-subnav" aria-label="Workspace sections">${links.map(([id,label])=>`<button id="section-${id}" class="subnav-btn" data-tab="${id}" aria-current="${id===current?'page':'false'}">${label}</button>`).join('')}${extra}</nav>`:'';
}
const experienceMast=renderMast;
renderMast=function(){experienceMast();const staff=EXPERIENCE.role!=='customer';$('#agent-status').hidden=!staff;$('#agent-status').textContent=STATE.mode==='live'&&STATE.live.available?'● Live agent':'● Scripted demo';$('#agent-status').dataset.live=String(STATE.mode==='live'&&STATE.live.available);$('#workspace-role').disabled=anyBusy();$('#workspace-stop').hidden=!anyBusy()||WORK.loading;};
function metric(label,value,note,tab) { return `<button class="home-metric" data-tab="${tab}"><span>${label}</span><strong>${value}</strong><small>${note} ${icon('call')}</small></button>`; }
function focusRow(title,sub,action,label='Open') { return `<div class="focus-row"><div><b>${esc(title)}</b><span>${esc(sub)}</span></div><button class="btn secondary sm" ${action}>${label} ${icon('call')}</button></div>`; }
// Legacy home links now open the role's working page; there is no separate dashboard.
function renderWorkspaceHome(){showTab(workspaceLanding());}
function productThumb(style) {
  const name=style?.name||'Your pair';
  // Use the existing product illustration, with no network request or new asset.
  const photos=casePhotos(STATE.active);
  return photos[0]?.img ? `<img src="${esc(photos[0].img)}" alt="${esc(name)}">` : (photos[0]?.svg || `<div class="pair-art" aria-hidden="true">${icon('replan')}</div>`);
}
function renderCustomerReturn() {
  ensureCustomerCase(); const id=STATE.active, el=$('#tab-return');
  el.innerHTML=`<div class="demo-context"><span>Demo customer: <b>${esc(caseName(id))}</b></span><button class="text-button" data-tab="scenarios">Change use case ${icon('call')}</button></div>`+pageHeading('Your return', 'Choose the option that works for you. We’ll guide you through the rest.','Customer care')+`<div class="customer-return-layout"><section class="card customer-surface"><div class="phone-body" id="phone"></div>${custChatShell(id)}</section><aside class="customer-reassurance"><div class="agent-symbol">${icon('replan')}</div><h2>Let’s find your perfect next step.</h2><p>Your return agent checks your order and available options. You choose what happens next.</p><div class="help-line">${icon('user')}A team member can help when you need one.</div><span class="pill neutral">${IDX.kase[id].hybrid?'Simulated case · actual product context':'Demo order · synthetic data'}</span></aside></div>`;
  renderPhone(); renderCustChat(id);
  el.querySelectorAll('[data-restart]').forEach(b=>b.remove());
}
function renderCaseSummary() {
  const el=$('#case-summary'); if(!el||!CASES[STATE.active])return;
  rememberDisclosures(el);
  const id=STATE.active,cs=CASES[id],k=IDX.kase[id];
  el.innerHTML=`<div class="eyebrow">Case ${esc(id)}</div><h2>${esc(workspaceStatusLabel(cs))}</h2><p class="small muted">${k.hybrid?'Actual context + synthetic assumptions':'Synthetic customer, policy and operations'} · ${cs.events.length?'Saved agent activity available':'Ready to investigate'}</p><div class="case-actions">${cs.status==='needs_person'&&cs.chosen?`<button class="btn sm" data-resume-case="${esc(id)}">Resume saved choice</button>`:''}${BEDROCK_LOCAL&&cs.events.length?`<button class="btn secondary sm" data-save-replay="${esc(id)}">Save recorded replay</button>`:''}${Object.values(SYS.labels).some(l=>l.case_id===id)?`<button class="btn secondary sm" data-store-handoff="${esc(id)}">Handoff to store inspection</button>`:''}${pendingReviews().some(r=>r.case_id===id)?'<button class="btn secondary sm" data-tab="approvals">Review approval</button>':''}</div>${k.hybrid?`<details class="inline-disclosure" data-disclosure="case-provenance"><summary>Source evidence & assumptions</summary>${caseProvenancePanel(id)}</details>`:''}`;
  restoreDisclosures(el);
}
function rememberDisclosures(el) { el?.querySelectorAll('[data-disclosure]').forEach(d=>{EXPERIENCE.disclosures[d.dataset.disclosure]=d.open;}); }
function restoreDisclosures(el) { el.querySelectorAll('[data-disclosure]').forEach(d=>{if(Object.hasOwn(EXPERIENCE.disclosures,d.dataset.disclosure))d.open=EXPERIENCE.disclosures[d.dataset.disclosure];}); }
const experienceApprovals=renderApprovals;
renderApprovals=function(){
  rememberDisclosures($('#tab-approvals')); experienceApprovals(); const el=$('#tab-approvals');
  const p=el.querySelector('.section-head p'); if(p)p.textContent=EXPERIENCE.role==='store_manager'?'Store inspection exceptions that need your decision.':'Review exceptions, customer handoffs and proposed product changes.';
  el.querySelectorAll('.ap-sec').forEach((d,i)=>{d.open=false;d.dataset.disclosure=`approval-${UI.apFocus}-${i}`;});
  if(EXPERIENCE.role==='customer_service')el.insertAdjacentHTML('afterbegin',`<div class="approval-role"><label for="approval-role">Approval authority</label><select id="approval-role"><option value="supervisor" ${EXPERIENCE.approver==='supervisor'?'selected':''}>Service supervisor</option><option value="service_lead" ${EXPERIENCE.approver==='service_lead'?'selected':''}>Service lead</option><option value="merchandiser" ${EXPERIENCE.approver==='merchandiser'?'selected':''}>Merchandiser · product changes</option></select><span class="small muted">Demo approval role</span></div>`);
  const role=EXPERIENCE.role==='customer_service'?EXPERIENCE.approver:WORK.role;
  el.querySelectorAll('[data-review]').forEach(b=>{const r=SYS.reviews[b.dataset.review];const allowed=r.kind==='page_fix'?['merchandiser']:r.kind==='counter'?['store_manager','supervisor']:r.tier===2?['supervisor']:['service_lead','supervisor'];if(!allowed.includes(role)){b.disabled=true;b.title='Requires '+allowed.join(' or ');}});
  const focused=SYS.reviews[UI.apFocus];
  if(focused?.status==='pending'&&el.querySelector('[data-review]:disabled'))el.querySelector('.ap-actions')?.insertAdjacentHTML('beforebegin',`<p class="approval-hint">${focused.kind==='page_fix'?'Select Merchandiser above to review this product change.':'Select Service supervisor above to decide this request.'}</p>`);
  restoreDisclosures(el);
};
const experiencePrevention=renderPrevention;
renderPrevention=function(){
  rememberDisclosures($('#tab-prevention')); experiencePrevention();const el=$('#tab-prevention');
  const head=el.querySelector('.section-head');head.querySelector('h2').textContent='Prevent the next return.';head.querySelector('p').textContent='Investigate patterns, propose a product fix and measure its effect. Choose the scope above, then review findings and proposed fixes.';
  el.querySelector(':scope > p.small')?.remove();
  const table=head.nextElementSibling;
  if(table?.classList.contains('card')) {const d=document.createElement('details');d.className='card disclosure';d.dataset.disclosure='prevention-patterns';d.innerHTML='<summary>Product signals <span>Synthetic fit-return rates · last 28 days</span></summary>';table.replaceWith(d);d.append(table);}
  const console=el.querySelector('.console');if(console){const d=document.createElement('details');d.className='card disclosure';d.dataset.disclosure='prevention-trace';d.innerHTML='<summary>Agent activity <span>Reasoning, tools and checks</span></summary>';console.replaceWith(d);d.append(console);}
  el.querySelector('.workbench')?.classList.add('prevention-workspace');
  const findings=$('#prev-findings');if(findings?.querySelector('.empty'))findings.innerHTML='<div class="card prevention-empty"><span class="agent-symbol prevention-symbol">'+icon('spark')+'</span><h2>Find the pattern. Improve the product.</h2><p>Run the analysis to see findings and suggested fixes here. A merchandiser reviews each change before it is applied.</p><span class="pill neutral">Simulated reviews and test outcomes</span></div>';
  if(BEDROCK_LOCAL&&STATE.prevention.events.length)head.insertAdjacentHTML('beforeend','<button class="btn secondary sm" data-save-replay="__prevention">Save Prevention replay</button>');
  restoreDisclosures(el);
};

// Settings and navigation stay separate from business actions and server permissions.
document.addEventListener('click',ev=>{
  const t=ev.target.closest('button,a');if(!t)return;
  if(t.dataset.tab==='routing'&&STATE.tab==='store'&&UI.counter?.caseId){MANAGER_UI.caseId=UI.counter.caseId;TX.routingSource='synthetic';}
  if(t.dataset.historyFrom)EXPERIENCE.historyFrom=t.dataset.historyFrom;
  else if(t.dataset.tab==='history'&&STATE.tab!=='history')EXPERIENCE.historyFrom='dashboard';
  if(t.id==='settings-open')$('#demo-settings').showModal();
  if(t.id==='settings-close')$('#demo-settings').close();
  if(t.dataset.previewCustomer){EXPERIENCE.customerCase=t.dataset.previewCustomer;changeWorkspace('customer','return');}
  if(t.dataset.homeReview){UI.apFocus=t.dataset.homeReview;showTab('approvals');}
  if(t.dataset.homeCounter){UI.counter={caseId:t.dataset.homeCounter,store:null,grade:null};showTab('store');}
},true);
document.addEventListener('change',ev=>{
  const t=ev.target;
  if(t.id==='workspace-role')changeWorkspace(t.value);
  if(t.id==='workspace-tool'&&t.value)showTab(t.value);
  if(t.id==='approval-role'){EXPERIENCE.approver=t.value;renderApprovals();}
  if(t.id==='case-picker'){STATE.active=t.value;UI.sel={};renderReturn();}
});
document.addEventListener('toggle',ev=>{const d=ev.target;if(d.dataset.disclosure&&d.isConnected)EXPERIENCE.disclosures[d.dataset.disclosure]=d.open;},true);
document.addEventListener('keydown',ev=>{
  if(!ev.target.matches('#tabs [role="tab"]'))return;
  const buttons=[...$('#tabs').querySelectorAll('[role="tab"]')];let at=buttons.indexOf(ev.target);
  if(['ArrowDown','ArrowRight'].includes(ev.key))at=(at+1)%buttons.length;
  else if(['ArrowUp','ArrowLeft'].includes(ev.key))at=(at+buttons.length-1)%buttons.length;
  else if(ev.key==='Home')at=0;else if(ev.key==='End')at=buttons.length-1;else return;
  ev.preventDefault();const id=buttons[at].dataset.tab;showTab(id);$('#tabbtn-'+id)?.focus();
});
