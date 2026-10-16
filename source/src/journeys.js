function selectDemoCustomer(id) {
  if(anyBusy()||!CASES[id])return;
  EXPERIENCE.customerCase=id; STATE.active=id; UI.sel={};
  try{localStorage.setItem('pp-customer-case',id);}catch{}
  showTab('return');
}
function renderDemoScenarios() {
  const cases=Object.values(IDX.kase).filter(k=>CASES[k.case_id]), featured=DATA.cases.filter(k=>!k.custom&&!k.queue&&!k.hybrid&&['maya','priya','leo','ana','jordan','sam','kai','bianca'].includes(k.case_id));
  $('#tab-scenarios').innerHTML=pageHeading('Every journey, in one place.','Choose a use case to walk through the customer experience. Progress stays saved when you switch.','Demo use cases')+
    `<p class="small muted">These are simulated customers for the presentation. Customer Service keeps the shared staff inbox, agent evidence and approvals.</p>
    <div class="scenario-gallery">${featured.map(k=>`<article class="card scenario-card"><div class="eyebrow">${esc(k.tag)}</div><h2>${esc(caseName(k.case_id))}</h2><p>${esc(k.headline)}</p><span class="pill neutral">${esc(workspaceStatusLabel(CASES[k.case_id]))}</span><button class="btn secondary" data-demo-case="${esc(k.case_id)}" ${anyBusy()?'disabled':''}>Open this journey ${icon('call')}</button></article>`).join('')}</div>
    <section class="card card-pad saved-demo"><h2>More saved customers</h2><p class="small muted">Open any saved demonstration, including new customers and cases created from actual product evidence.</p><label for="demo-case-picker">Choose a customer / case</label><select id="demo-case-picker" ${anyBusy()?'disabled':''}><option value="">Select a saved case…</option>${cases.map(k=>`<option value="${esc(k.case_id)}">${esc(caseName(k.case_id))} · ${esc(k.tag||k.headline||k.case_id)} · ${esc(k.case_id)}</option>`).join('')}</select></section>`;
}
function customerAssessment(id) {
  const cs=CASES[id], reviews=Object.values(SYS.reviews).filter(r=>r.case_id===id&&r.status!=='superseded');
  const pending=reviews.filter(r=>['pending','more_info'].includes(r.status)), flag=!!cs.flags?.suspected_abuse;
  if(flag)return {tone:pending.length?'bad':'warn',label:pending.length?'Flagged for review':'Flag reviewed',detail:'The agent escalated an evidence concern. This is a case review flag, not a finding of fraud.',review:reviews.find(r=>['case','action'].includes(r.kind))};
  if(pending.length)return {tone:'warn',label:'Team review needed',detail:'This case needs a person’s decision. A review request does not necessarily mean suspected abuse.',review:pending[0]};
  if(cs.error||['error','needs_person'].includes(cs.status))return {tone:'warn',label:'Assessment incomplete',detail:'The run needs attention. Do not interpret an incomplete investigation as a clear assessment.'};
  if(['investigating','acting'].includes(cs.status))return {tone:'info',label:'Assessment in progress',detail:'Wait for the agent’s completed findings.'};
  if(!cs.decision)return {tone:'neutral',label:'Not assessed',detail:'The agent has not completed this case. History alone has not flagged the customer.'};
  return {tone:'ok',label:'No review flag raised',detail:'The completed investigation raised no customer evidence flag. Eligibility and item checks still apply.'};
}
function managerCustomerCard(id) {
  if(!id||!CASES[id]||EXPERIENCE.role==='customer')return '';
  const {c,k}=caseCtx(id),cs=CASES[id],assessment=customerAssessment(id),isNew=c.lifetime_orders<=1;
  const history=IDX.histByCust[c.customer_id]||[], prior=history.filter(r=>r.outcome!=='return in progress');
  const trusted=trustedForEarlyRefund(c), d=cs.decision;
  const rows=prior.slice().sort((a,b)=>b.order_date.localeCompare(a.order_date)).slice(0,5);
  return `<section class="card customer-first" data-customer-profile="${esc(id)}">
    <div class="customer-first-head"><div><div class="eyebrow">Customer overview · ${k.hybrid?'synthetic profile, actual product context':'synthetic demo history'}</div><h2>${esc(caseName(id))}</h2><span class="small muted">${esc(c.customer_id)} · ${esc(c.region)}</span></div><div class="customer-badges"><span class="pill ${isNew?'info':'neutral'}">${isNew?'New customer':'Returning customer'}</span><span class="pill ${assessment.tone}" data-assessment>${esc(assessment.label)}</span><span class="pill neutral">${esc(workspaceStatusLabel(cs))}</span></div></div>
    <div class="customer-key-facts">
      ${customerFact('Membership status', c.loyalty_status || 'Not recorded', 'Loyalty tier · demo profile', membershipTone(c.loyalty_status))}
      ${customerFact('Lifetime orders', num(c.lifetime_orders), 'Recorded in the customer profile')}
      ${customerFact('Profile return rate', isNew ? 'No history yet' : pct(c.return_rate,1), isNew ? 'First order · no prior return history' : 'Share of lifetime orders returned')}
      ${customerFact('Recorded past returns', num(c.number_of_returns), 'Previous returns in the profile')}
      ${customerFact('Customer since', tenureWords(c.customer_tenure_months), 'Time with the brand')}
      ${customerFact('Damage claims · 90 days', num(c.damage_claims_90d), 'Claim count · not an abuse finding')}
    </div>
    <div class="agent-treatment"><div class="eyebrow">How the agent handles this case ${cs.mode?'· '+esc(cs.mode):''}</div><p>${esc(assessment.detail)}</p>${assessment.review?`<p><b>Reason:</b> ${esc(assessment.review.reason)}<br><b>Next step:</b> ${esc(assessment.review.recommendation)}</p>`:d?`<p><b>Current decision:</b> ${esc(d.summary)}${d.recommended?`<br><b>Recommended option:</b> ${esc(d.recommended.replaceAll('_',' '))}`:''}</p>`:''}
    ${cs.chosen?`<p><b>Customer chose:</b> ${esc(cs.chosen.option.replaceAll('_',' '))}</p>`:''}<p class="small muted">${isNew?'No prior history: assess the order, item condition and policy; newness is not grounds for refusal.':'Return history provides context; the return rate alone never refuses a return.'} ${trusted?'This profile meets the demo’s early-refund rule (Gold/Silver and return rate ≤20%): an eligible refund can be released after the store checks the pair at drop-off.':'This profile does not meet the demo’s early-refund rule: an eligible standard refund waits for receipt and inspection.'} ${assessment.label.startsWith('Flag')?'A supervisor must review flagged financial actions (R8). ':''}Item evidence, eligibility and approval controls still determine the final output (§3.1, §7.2, R11/R13).</p></div>
    <details class="inline-disclosure" data-disclosure="customer-history-${esc(id)}"><summary>Recent customer history & agent evidence</summary>${rows.length?tableView(['Date','Product','Outcome','Reason'],rows.map(r=>[r.order_date,r.product,r.outcome.replaceAll('_',' '),r.return_reason?.replaceAll('_',' ')||'—'])).replace('<details','<details open'):'<p>No earlier completed orders in the demo history.</p>'}<p class="small muted">Showing up to five completed orders. The profile return rate uses the saved lifetime profile; the table is a recent-history view.</p>${assessment.review?.evidence?.length?`<ul>${assessment.review.evidence.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</details>
  </section>`;
}
document.addEventListener('click',ev=>{const t=ev.target.closest('[data-demo-case]');if(t)selectDemoCustomer(t.dataset.demoCase);});
document.addEventListener('change',ev=>{if(ev.target.id==='demo-case-picker'&&ev.target.value)selectDemoCustomer(ev.target.value);});

function managerQueueRow(id,action,label) {
  const {c,line}=caseCtx(id),a=customerAssessment(id),isNew=c.lifetime_orders<=1;
  return `<div class="customer-queue-row"><div><b>${esc(caseName(id))}</b><p>${isNew?'New customer':num(c.lifetime_orders)+' orders · '+pct(c.return_rate,1)+' return rate'} · ${esc(line.product)}</p><span class="pill ${a.tone}">${esc(a.label)}</span>${CASES[id].serviceConcern?.status==='pending'?'<span class="pill warn">Service follow-up</span>':''}</div><button class="btn secondary sm" ${action}>${esc(label)} ${icon('call')}</button></div>`;
}

function membershipTone(status) {
  const tier=String(status||'').trim().toLowerCase();
  return ['gold','platinum','silver','bronze'].includes(tier)?tier:'member';
}
function customerFact(label,value,note,tier) {
  return `<div class="customer-fact${tier?' membership-fact':''}"${tier?` data-membership="${tier}"`:''}><small>${tier?icon('shield'):''}${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(note)}</span></div>`;
}
