/* =====================================================================
   UI
   ===================================================================== */
const ICONS = {
  call: '<path d="M5 12h12"/><path d="M13 6l6 6-6 6"/>',
  observe: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  think: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M6.3 17.7l2.4-2.4M15.3 8.7l2.4-2.4"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  shieldx: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/>',
  hourglass: '<path d="M7 3h10M7 21h10"/><path d="M8 3c0 5 8 6 8 9s-8 4-8 9M16 3c0 5-8 6-8 9s8 4 8 9"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
  replan: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  funnel: '<path d="M4 4h16l-6 8v6l-4 2v-8z"/>',
  send: '<path d="M4 12 20 4l-6 16-3-7z"/>',
  dots: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
  error: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  store: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9h16v11H4z"/><path d="M9 20v-6h6v6"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  download: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  forward: '<path d="M5 6l7 6-7 6zM13 6l7 6-7 6z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
};
const icon = (n, cls = 'icon') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const UI = {
  sel: { option: null, method: null }, counter: { caseId: null, store: null, grade: null }, auditSel: null,
  data: { ds: 'orders', q: '' }, fair: { metric: 'human_review' }, evalOpen: {}, timer: null, downloads: null,
};
const fmtElapsed = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function toast(text) {
  const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = text;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
}
const TOOL_LABEL = n => TOOLS[n]?.label || ({ read_photo: 'Read the photo (Claude vision)' })[n] || n;
const caseName = id => IDX.cust[IDX.kase[id].customer_id].display_name;
const busy = id => ['investigating', 'acting'].includes(CASES[id].status);
let anyBusy = () => !!STATE.running || DATA.cases.some(k => busy(k.case_id)) || STATE.prevention.status === 'running' || STATE.evalRunning;

/* ---------- masthead and tabs ---------- */
function renderBarcode() {
  const el = $('#barcode'); if (!el) return;
  const word = 'PERFECTPAIR2026';
  let h = '';
  for (let i = 0; i < word.length; i++) { const c = word.charCodeAt(i); [c % 3 + 1, (c >> 2) % 3 + 1, (c >> 4) % 2 + 1].forEach((w, j) => { h += `<i style="width:${w}px;margin-right:${j % 2 ? 2 : 1}px"></i>`; }); }
  el.innerHTML = h;
}
function renderMast() {
  const live = STATE.live;
  const liveModel = STATE.tier === 'default' && live.thoroughModelId ? live.thoroughModelId : live.modelId;
  $('#mode-live').setAttribute('aria-pressed', STATE.mode === 'live');
  $('#mode-scripted').setAttribute('aria-pressed', STATE.mode === 'scripted');
  $('#mode-live').disabled = !live.available;
  $('#tier').value = STATE.tier; $('#tier').disabled = STATE.mode !== 'live' || (live.provider === 'bedrock' && !live.thoroughModelId);
  $('#aws-connect').hidden = !BEDROCK_LOCAL;
  $('#failsw').checked = STATE.failureSwitch;
  $('#livenote').innerHTML = live.available
    ? (STATE.mode === 'live' ? (live.provider === 'bedrock' ? `<b>Live agent · Amazon Bedrock:</b> ${esc(liveModel)}. Each run uses your workshop AWS allowance. Simulated actions and safety rules run on the local server and are saved between visits.` : '<b>Live agent:</b> Claude decides which tools to call and writes the reasoning you see. Safety checks still run in code. Each run uses your Claude usage.') : '<b>Scripted backup:</b> the same tools and safety checks in a fixed order. Use it to rehearse, or if the network fails during the pitch.')
    : `<b>Scripted backup.</b> ${esc(live.reason)}`;
}
const TABS = [['return', 'Resolution agent'], ['history', 'Actual investigations'], ['inbox', 'Saved cases'], ['store', 'Store counter'], ['approvals', 'Approvals'], ['dashboard', 'Dashboard'], ['prevention', 'Prevention agent'], ['evals', 'Evaluations'], ['audit', 'Audit and fairness'], ['data', 'Data'], ['how', 'How it works']];
function pendingReviews() { return Object.values(SYS.reviews).filter(r => r.status === 'pending'); }
function renderTabsBar() {
  const n = pendingReviews().length;
  $('#tabs').innerHTML = TABS.map(([id, label]) => `<button class="tab-btn" role="tab" id="tabbtn-${id}" aria-controls="tab-${id}" aria-selected="${STATE.tab === id}" data-tab="${id}">${label}${id === 'approvals' ? ` <span class="count" data-zero="${n === 0}">${n}</span>` : ''}</button>`).join('') + '<span class="tab-ink" aria-hidden="true"></span>';
  moveInk(false);
}
let INK_X = null;
function moveInk(animate = true) {
  const bar = $('#tabs'), ink = bar && bar.querySelector('.tab-ink'), btn = bar && bar.querySelector('[aria-selected="true"]');
  if (!ink || !btn) return;
  const x = btn.offsetLeft, w = btn.offsetWidth;
  if (INK_X != null && animate !== false) { ink.style.transition = 'none'; ink.style.transform = `translateX(${INK_X.x}px)`; ink.style.width = INK_X.w + 'px'; ink.getBoundingClientRect(); ink.style.transition = ''; }
  ink.style.transform = `translateX(${x}px)`; ink.style.width = w + 'px';
  INK_X = { x, w };
}
function showTab(id) {
  STATE.tab = id;
  if(id==='history'&&REAL)setDataSource('actual',false);
  for (const [t] of TABS) $('#tab-' + t).hidden = t !== id;
  renderTabsBar(); moveInk(true);
  renderTab(id);
  countUp($('#tab-' + id));
  window.scrollTo({ top: 0, behavior: 'auto' });
  renderApprChat();
}
/* numbers count up when a screen appears */
const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
function countUp(root) {
  if (!root || REDUCED) return;
  root.querySelectorAll('.stat .v').forEach(el => {
    const m = el.textContent.trim().match(/^(−?)(\$?)([\d,]+(?:\.\d+)?)(%?)$/);
    if (!m) return;
    const target = Number(m[3].replace(/,/g, '')), dec = (m[3].split('.')[1] || '').length, t0 = performance.now(), dur = 900;
    const fmt = v => m[1] + m[2] + (m[2] || m[3].includes(',') ? v.toLocaleString('en-CA', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec)) + m[4];
    const tick = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(target * e); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}
/* Charts hold their grow-in animation until they scroll into view (or a closed section opens). */
(() => {
  if (REDUCED || typeof IntersectionObserver === 'undefined' || typeof MutationObserver === 'undefined') return;
  const SEL = '.chart-card,.econ,.reco';
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.remove('viz-wait'); io.unobserve(e.target); } }), { threshold: 0.15 });
  const scan = root => root.querySelectorAll(SEL).forEach(el => { if (el.dataset.viz) return; el.dataset.viz = '1'; el.classList.add('viz-wait'); io.observe(el); });
  const main = document.querySelector('main');
  if (!main) return;
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches(SEL)) scan(n.parentNode); else scan(n); } }).observe(main, { childList: true, subtree: true });
})();
function renderTab(id) {
  ({ history: renderHistory, inbox: renderInbox, return: renderReturn, store: renderStore, approvals: renderApprovals, dashboard: renderDashboard, prevention: renderPrevention, evals: renderEvals, audit: renderAudit, data: renderData, how: renderHow })[id]();
  renderDataSource();
}

/* ---------- trace items ---------- */
function fmtArg(v) {
  if (Array.isArray(v)) {
    if (v.length && typeof v[0] === 'object') return '[' + v.map(o => o.type ? o.type + (o.sku ? ' ' + o.sku : '') : JSON.stringify(o).slice(0, 30)).join(', ') + ']';
    const s = JSON.stringify(v); return s.length > 70 ? s.slice(0, 67) + '…]' : s;
  }
  if (typeof v === 'string') { const s = JSON.stringify(v); return s.length > 60 ? s.slice(0, 57) + '…"' : s; }
  return JSON.stringify(v);
}
const callSig = (tool, args) => `${tool}(${Object.entries(args || {}).map(([k, v]) => `${k}: ${fmtArg(v)}`).join(', ')})`;
function sourcesHTML(srcs) {
  if (!srcs || !srcs.length) return '';
  return `<div class="chips srcs">${srcs.slice(0, 6).map(s => `<button type="button" class="src" data-src="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
}
function evHTML(e, t0) {
  const t = t0 ? '+' + fmtElapsed(e.at - t0) : '';
  const wrap = (cls, ic, kind, body) => `<li class="ev ev-${cls}" data-ev="${e.id}"><div class="ev-ic">${icon(ic)}</div><div><div class="ev-k"><span>${kind}</span><span class="t">${t}</span></div>${body}</div></li>`;
  switch (e.kind) {
    case 'input': return wrap('input', 'funnel', 'Input check · guardrails', `<div class="ev-txt">${esc(e.text)}</div>`);
    case 'think': return wrap('think', 'think', 'Reflect', `<div class="ev-txt">${esc(e.text)}</div>`);
    case 'call': return wrap('call', 'call', `Plan → tool call · ${esc(TOOL_LABEL(e.tool))}`, `<div class="ev-why">${esc(e.why || '')}</div><code>${esc(callSig(e.tool, e.args))}</code>${e.image ? `<img class="ev-img" src="${esc(e.image)}" alt="The uploaded photo">` : ''}`);
    case 'observe': {
      const res = e.result ? JSON.stringify(e.result, null, 1) : '';
      return wrap('observe', 'observe', `Observe · ${esc(TOOL_LABEL(e.tool))}`, `<div class="ev-txt">${esc(e.text)}</div>${sourcesHTML(e.sources)}${res ? `<details><summary>Show the raw result</summary><pre>${esc(res.length > 7000 ? res.slice(0, 7000) + '\n…' : res)}</pre></details>` : ''}`);
    }
    case 'gate': {
      const cls = e.decision === 'ALLOW' ? 'gate' : e.decision === 'DENY' ? 'gate deny' : 'gate approval';
      const kind = e.decision === 'ALLOW' ? 'Safety check · passed' : e.decision === 'DENY' ? 'Safety check · blocked' : `Safety check · needs a person${e.tier ? ` (tier ${e.tier})` : ''}`;
      const pc = e.decision === 'ALLOW' ? 'ok' : e.decision === 'DENY' ? 'bad' : 'warn';
      return wrap(cls, e.decision === 'ALLOW' ? 'shield' : e.decision === 'DENY' ? 'shieldx' : 'hourglass', kind,
        (e.rules || []).map(r => `<div class="gate-line"><span class="pill ${pc}">${esc(r.rule)}</span><span>${esc(RULES[r.rule] ? RULES[r.rule].name + ': ' : '')}${esc(r.note)}</span></div>`).join(''));
    }
    case 'fail': return wrap('fail', 'alert', `Action failed · ${esc(TOOL_LABEL(e.tool))}`, `<div class="ev-txt">${esc(e.text)}</div>`);
    case 'replan': return wrap('replan', 'replan', 'Re-plan', `<div class="ev-txt">${esc(e.text)}</div>`);
    case 'human': return wrap('human', 'user', 'A person decided', `<div class="ev-txt">${esc(e.text)}</div>`);
    case 'customer': return wrap('input', 'user', 'Customer', `<div class="ev-txt">${esc(e.text)}</div>`);
    case 'decision': return wrap('decision', 'flag', 'Next action', `<div class="ev-txt">${esc(e.text)}</div>`);
    case 'output': return wrap('output', 'send', 'Output check · guardrails', `<div class="ev-txt">${esc(e.text)}</div>`);
    case 'error': return wrap('error', 'error', 'Problem', `<div class="ev-txt">${esc(e.text)}</div>`);
    default: return wrap('status', 'dots', 'Working', `<div class="ev-txt">${esc(e.text)}</div>`);
  }
}
function traceTarget(scope) {
  if (scope.prevention) return STATE.tab === 'prevention' ? $('#trace-prevent') : null;
  return STATE.tab === 'return' && scope.caseId === STATE.active ? $('#trace-return') : null;
}
function scopeT0(scope) { return scope.prevention ? STATE.prevention.stats.t0 : CASES[scope.caseId].stats.t0; }
function stickBottom(el, fn) {
  const near = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  fn();
  if (near) el.scrollTop = el.scrollHeight;
}
UI.onEvent = (scope, e) => {
  const list = traceTarget(scope);
  if (list) {
    list.querySelector('.trace-empty')?.remove();
    stickBottom(list, () => list.insertAdjacentHTML('beforeend', evHTML(e, scopeT0(scope))));
  }
  if (!scope.prevention && scope.caseId === STATE.active && STATE.tab === 'return') { renderConsoleHead(); if (['call', 'observe', 'input', 'think'].includes(e.kind)) renderPhone(); }
  if (scope.prevention && STATE.tab === 'prevention') renderPrevHead();
};
UI.onEventUpdate = (scope, e) => {
  const list = traceTarget(scope); if (!list) return;
  const node = list.querySelector(`[data-ev="${e.id}"]`);
  if (node) stickBottom(list, () => { node.outerHTML = evHTML(e, scopeT0(scope)); });
};
UI.onEventRemove = (scope, e) => { const list = traceTarget(scope); list?.querySelector(`[data-ev="${e.id}"]`)?.remove(); };
UI.onCaseChanged = id => {
  if (STATE.sandbox) return;
  if (STATE.tab === 'return') { renderScenarioBar(); if (id === STATE.active) { renderPhone(); renderConsoleHead(); renderDecisionArea(); } }
  if (STATE.tab === 'store') renderStore();
  renderTabsBar();
  tickTimer();
};
UI.onApprovalsChanged = () => {
  if (STATE.sandbox) return;
  renderTabsBar();
  if (STATE.tab === 'dashboard') renderDashboard();
  if (STATE.tab === 'approvals') renderApprovals();
  if (STATE.tab === 'prevention') renderPrevention();
  if (STATE.tab === 'store') renderStore();
};
UI.onAuditChanged = () => { if (STATE.tab === 'audit') renderAudit(); };
UI.onRunning = () => {
  if (STATE.tab === 'return') { renderConsoleHead(); renderPhone(); }
  if (STATE.tab === 'prevention') renderPrevHead();
  if (STATE.tab === 'evals') renderEvals();
  tickTimer();
};
UI.onLiveChanged = () => { renderMast(); if (STATE.tab === 'evals') renderEvals(); };
UI.renderPrevention = () => { if (STATE.tab === 'prevention') renderPrevention(); };
function tickTimer() {
  const on = anyBusy();
  if (on && !UI.timer) UI.timer = setInterval(() => { if (STATE.tab === 'return') renderConsoleHead(); if (STATE.tab === 'prevention') renderPrevHead(); if (!anyBusy()) { clearInterval(UI.timer); UI.timer = null; } }, 500);
}

/* ---------- Return tab ---------- */
function renderReturn() {
  const el = $('#tab-return');
  if (STATE.active === '__new' || !CASES[STATE.active]) { if (STATE.active !== '__new') STATE.active = 'maya'; else return renderNewCustomer(); }
  el.innerHTML = `
  <div class="scenario-bar" id="scenario-bar"></div>
  <div class="workbench">
    <div class="device-wrap">
      <div class="view-tag cust-view">${icon('user')}What the customer sees</div>
      <section class="phone device" aria-label="Customer's returns page (what the customer sees)">
        <div class="dev-status" aria-hidden="true"><span class="dev-time">${new Date().toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[ap]\.?m\.?/i, '')}</span><span class="dev-island"></span><span class="dev-icons"><i class="sig"><b></b><b></b><b></b><b></b></i><i class="wifi"></i><i class="bat"><b></b></i></span></div>
        <div class="phone-top"><span class="app-mark" aria-hidden="true">PP</span><div><b>Returns</b><span class="small">Easy returns, made for you</span></div><span class="app-lock" aria-hidden="true">${icon('shield')}</span></div>
        <div class="phone-body" id="phone"></div>
        <div class="dev-home" aria-hidden="true"></div>
        ${custChatShell(STATE.active)}
      </section>
      <p class="device-note small">Only this screen reaches the customer: no costs, margins or safety checks.</p>
    </div>
    <section class="card console staff-panel" aria-label="Resolution agent (staff and judges only)">
      <div class="view-tag staff-view">${icon('flag')}Staff and judges only · not shown to the customer</div>
      <div class="console-head" id="console-head"></div>
      <div class="stages" id="stages"></div>
      <ol class="trace" id="trace-return" aria-live="polite"></ol>
      <div class="console-foot"><div class="legend-row"><span><i style="background:var(--ink)"></i>Tool call</span><span><i style="background:var(--kraft)"></i>Reflect</span><span><i style="background:var(--ok)"></i>Safety check</span><span><i style="background:var(--warn)"></i>Re-plan or a person</span><span><i style="background:var(--red)"></i>Next action</span></div><span>Plan → tool call → observe → reflect → next action</span></div>
    </section>
  </div>
  <div class="decision-area" id="decision-area"></div>`;
  renderScenarioBar(); renderPhone(); renderConsoleHead(); renderTrace(); renderDecisionArea(); renderCustChat(STATE.active);
}
function caseDot(id) {
  const s = CASES[id].status;
  return ['done', 'received'].includes(s) ? 'done' : ['investigating', 'acting', 'options'].includes(s) ? 'busy' : ['review', 'awaiting_approval', 'not_eligible', 'declined', 'more_info', 'needs_person'].includes(s) ? 'review' : '';
}
function renderScenarioBar() {
  const el = $('#scenario-bar'); if (!el) return;
  el.innerHTML = `<span class="eyebrow">Test customers</span>` + DATA.cases.map(k => `<button type="button" class="sc-chip${k.custom ? ' custom' : ''}" data-case="${k.case_id}" aria-pressed="${STATE.active === k.case_id}" title="${esc(k.headline)}"><span class="tg">${esc(k.tag)}</span>${esc(k.label)}<span class="st" data-s="${caseDot(k.case_id)}"></span></button>`).join('')
    + `<button type="button" class="sc-chip add" data-newcase="1" aria-pressed="${STATE.active === '__new'}">${icon('camera')}New customer</button>`;
}
function setHTML(el, html) { if (el && el.__html !== html) { el.innerHTML = html; el.__html = html; } }
function headSlots(el) {
  if (!el.querySelector('.h-title')) { el.innerHTML = '<div class="h-title"></div><div class="h-right"><div class="stats h-stats"></div><span class="h-stop"></span></div>'; }
  return { title: el.querySelector('.h-title'), stats: el.querySelector('.h-stats'), stop: el.querySelector('.h-stop') };
}
const STOP_BTN = `<button type="button" class="btn secondary sm" id="stop-btn">${icon('stop')}Stop</button>`;
function renderConsoleHead() {
  const el = $('#console-head'); if (!el) return;
  const cs = CASES[STATE.active];
  const run = busy(STATE.active);
  const pill = { new: ['neutral', 'Idle'], investigating: ['warn', 'Investigating'], options: ['info', 'Waiting for the customer'], review: ['red', 'Waiting for a person'], not_eligible: ['neutral', 'Not eligible'], acting: ['warn', 'Acting'], awaiting_approval: ['red', 'Waiting for approval'], done: ['ok', 'Done'], received: ['ok', 'Received in store'], declined: ['neutral', 'Declined by a person'], more_info: ['info', 'More photos requested'], needs_person: ['bad', 'Needs a person'], error: ['bad', 'Stopped'] }[cs.status] || ['neutral', cs.status];
  const ms = run ? Date.now() - cs.stats.t0 : cs.stats.ms;
  const mode = cs.mode ? (cs.mode === 'live' ? `Live · ${cs.tierApplied || STATE.tier}` : 'Scripted') : (STATE.mode === 'live' ? 'Live' : 'Scripted');
  const slots = headSlots(el);
  setHTML(slots.title, `<div class="eyebrow">Resolution agent · every return, in seconds</div><h2>${esc(caseName(STATE.active))}'s return <span class="pill ${pill[0]}" style="vertical-align:3px">${pill[1]}</span></h2>`);
  setHTML(slots.stats, `<span>Time <b>${fmtElapsed(ms || 0)}</b></span><span>Tool calls <b>${cs.stats.tools}</b></span><span>Safety checks <b>${cs.stats.gates}</b></span><span>Re-plans <b>${cs.stats.replans}</b></span><span>Mode <b>${esc(mode)}</b></span>`);
  setHTML(slots.stop, STATE.running && run ? STOP_BTN : '');
  renderStages();
}
function stageOf(e) {
  if (e.phase === 'act' || e.phase === 'counter' || e.phase === 'review') return 3;
  if (e.kind === 'input' || (e.kind === 'call' && ['check_item_photo', 'read_photo'].includes(e.tool))) return 0;
  if (e.kind === 'decision' || e.kind === 'output' || (e.kind === 'call' && ['score_options', 'request_human_review'].includes(e.tool))) return 2;
  if (e.kind === 'call' || e.kind === 'observe') return 1;
  return -1;
}
function renderStages() {
  const el = $('#stages'); if (!el) return;
  const cs = CASES[STATE.active];
  let cur = -1; for (const e of cs.events) { const s = stageOf(e); if (s > cur) cur = s; }
  const run = busy(STATE.active);
  const done = ['done', 'received'].includes(cs.status);
  el.innerHTML = ['Listen', 'Investigate', 'Decide', 'Act and check'].map((n, i) => `<div class="stage ${done || i < cur || (i === cur && !run) ? 'on' : ''} ${run && i === cur ? 'now' : ''}"><span class="n">${i + 1}</span><span class="l">${n}</span></div>`).join('');
}
function renderTrace() {
  const el = $('#trace-return'); if (!el) return;
  const cs = CASES[STATE.active];
  if (!cs.events.length) {
    const k = IDX.kase[STATE.active];
    el.innerHTML = `<li class="trace-empty"><b>${esc(k.headline)}.</b><br>Press <b>Find my options</b> on the customer's screen. The agent's plan, each tool call, what it observed, its safety checks and its next action appear here as they happen.</li>`;
    return;
  }
  el.innerHTML = cs.events.map(e => evHTML(e, cs.stats.t0)).join('');
  el.scrollTop = el.scrollHeight;
}
const PROG_INV = [
  ['Reading your message', e => e.kind === 'input' || e.kind === 'think'],
  ['Checking your order', e => e.kind === 'call' && e.tool === 'look_up_order_and_customer'],
  ['Looking at your photo', e => e.kind === 'call' && ['check_item_photo', 'read_photo'].includes(e.tool)],
  ['Checking reviews and the return policy', e => e.kind === 'call' && ['read_reviews_and_fit_votes', 'search_return_policy'].includes(e.tool)],
  ['Finding what fixes it', e => e.kind === 'call' && ['find_exchange_options', 'find_smart_credit_picks', 'score_options', 'request_human_review'].includes(e.tool)],
];
const PROG_ACT = {
  exchange: [['Reserving your new pair', ['reserve_pair', 'check_stock_nearby']], ['Creating your exchange', ['create_exchange']], ['Setting up your return', ['create_return_label', 'route_returned_item', 'file_claim']], ['Double-checking everything', ['verify_actions']]],
  smart_credit: [['Adding your credit', ['issue_store_credit']], ['Holding your picks', ['reserve_pair']], ['Setting up your return', ['create_return_label', 'route_returned_item']], ['Double-checking everything', ['verify_actions']]],
  store_credit: [['Adding your credit', ['issue_store_credit']], ['Setting up your return', ['create_return_label', 'route_returned_item']], ['Double-checking everything', ['verify_actions']]],
  refund: [['Setting up your return', ['create_return_label', 'route_returned_item', 'file_claim']], ['Scheduling your refund', ['issue_refund']], ['Double-checking everything', ['verify_actions']]],
  keep_it: [['Issuing your refund', ['issue_refund']], ['Double-checking everything', ['verify_actions']]],
};
function progressHTML(items, events, matcher) {
  let last = -1;
  events.forEach(e => items.forEach((it, i) => { if (matcher(it, e)) last = Math.max(last, i); }));
  return `<ul class="progress-list">${items.map((it, i) => `<li class="${i < last ? 'on' : i === last ? 'on now' : ''}"><span class="b">${i < last ? icon('check', 'icon') : ''}</span>${esc(it[0])}</li>`).join('')}</ul>`;
}
function itemTag(caseId) {
  const { k, o, line } = caseCtx(caseId);
  const size = line.size === 'OS' ? 'one size' : `size ${line.size}${line.width === 'W' ? ' wide' : line.width === 'M' ? ' regular' : ''}`;
  const tag = `<div class="tag"><div class="t1">${esc(line.product)}</div><div class="t2">${esc(line.colour)} · ${esc(size)}${line.final_sale ? ' · final sale' : ''}</div><div class="t3"><span>${esc(o.order_id)} · delivered ${fmtDate(o.delivery_date)}</span><span>${money(line.selling_price)}</span></div></div>`;
  return k.custom && k.photo.url ? `<div class="tag-wrap">${tag}<img class="up-thumb" src="${esc(k.photo.url)}" alt="The photo the customer uploaded"></div>` : tag;
}
/* The phone keeps one size; its screen scrolls. A new step in the return starts at the top. */
function renderPhone() {
  const el = $('#phone'); if (!el) return;
  const key = `${STATE.active}|${CASES[STATE.active]?.status}`, top = el.scrollTop;
  renderPhoneInner();
  el.scrollTop = UI.phoneKey === key ? top : 0;
  UI.phoneKey = key;
}
function renderPhoneInner() {
  const el = $('#phone'); if (!el) return;
  const id = STATE.active, cs = CASES[id], k = IDX.kase[id];
  const name = caseName(id);
  const who = `<div class="who"><div class="avatar" aria-hidden="true">${esc(name[0])}</div><div><b>Hi ${esc(name)}</b><div class="small muted">Return for order ${esc(k.order_id)}</div></div></div>`;
  const disabledStart = anyBusy();
  if (['new', 'error'].includes(cs.status)) {
    el.innerHTML = `${who}${itemTag(id)}
      <div class="field"><label for="words">What's wrong with them?</label><textarea id="words" ${disabledStart ? 'disabled' : ''}>${esc(cs.words)}</textarea></div>
      <div class="attach">${icon('camera')}<span>${k.custom && !k.photo.url ? 'No photo attached' : `${casePhotos(id).length} photo${casePhotos(id).length > 1 ? 's' : ''} attached`}</span></div>${photoStrip(id, { small: true })}
      ${cs.error ? `<div class="msg" role="alert"><b>${esc(cs.error.copy)}</b></div>` : ''}
      <button type="button" class="btn full" id="start-btn" ${disabledStart ? 'disabled' : ''}>Find my options</button>
      <p class="note">The agent sees a customer ID, never a name, email or phone number. ${STATE.mode === 'live' ? 'Edit the message to test the live agent.' : 'Switch to the live agent to try your own wording.'}</p>`;
    return;
  }
  if (cs.status === 'investigating') {
    el.innerHTML = `${who}${itemTag(id)}<div class="msg">${esc(cs.words)}</div><h3>Looking into it</h3>${progressHTML(PROG_INV, cs.events, (it, e) => it[1](e))}`;
    return;
  }
  const d = cs.decision;
  if (cs.status === 'options') {
    const sel = UI.sel.caseId === id ? UI.sel : {};
    const best = bestDropOffStore(id);
    const optHTML = d.options.map(o => {
      const pays = o.customer_pays || { by_mail: 0, in_store: 0 };
      const payTxt = o.type === 'keep_it' ? 'No return needed' : pays.by_mail > 0 ? `${money(pays.by_mail)} by mail · free in store` : 'Free';
      return `<div class="opt ${o.recommended ? 'rec' : ''}"><div class="opt-head"><div class="opt-title">${esc(o.title)}</div>${o.recommended ? '<span class="best-tag">Best fit</span>' : ''}</div>
        <div class="opt-detail">${esc(o.detail)}</div>${o.reason ? `<div class="opt-why">Why: ${esc(o.reason)}</div>` : ''}
        <div class="opt-foot"><span class="pays ${pays.by_mail > 0 ? '' : 'free'}">${payTxt}</span><button type="button" class="btn ${sel.option === o.type ? 'red' : 'secondary'} sm" data-choose="${o.type}" ${anyBusy() ? 'disabled' : ''}>${sel.option === o.type ? 'Selected' : 'Choose'}</button></div></div>`;
    }).join('');
    let method = '';
    if (sel.option && sel.option !== 'keep_it') {
      const opt = d.options.find(o => o.type === sel.option);
      const fee = labelFee(id, { option: sel.option, method: 'carrier' });
      method = `<div class="method" role="radiogroup" aria-label="How will you send the old pair back?"><b>How will you send the old pair back?</b>
        ${best ? `<label class="radio"><input type="radio" name="method" id="m-store" value="store_dropoff" ${sel.method !== 'carrier' ? 'checked' : ''}><span><b>Drop off at ${esc(best.name)}</b>, free<br><span class="small muted">${best.p_sell_4w > 0.5 ? `They're out of your size, so your pair goes straight back on their shelf.` : 'Any store works.'}</span></span></label>` : ''}
        <label class="radio"><input type="radio" name="method" id="m-carrier" value="carrier" ${sel.method === 'carrier' || !best ? 'checked' : ''}><span><b>Send it with a prepaid label</b>, ${fee ? money(fee) : 'free'}</span></label>
        <button type="button" class="btn red full" id="confirm-btn" ${anyBusy() ? 'disabled' : ''}>Confirm ${esc(opt ? opt.title.charAt(0).toLowerCase() + opt.title.slice(1) : '')}</button></div>`;
    } else if (sel.option === 'keep_it') {
      method = `<button type="button" class="btn red full" id="confirm-btn" ${anyBusy() ? 'disabled' : ''}>Confirm: keep them and get the refund</button>`;
    }
    el.innerHTML = `${who}${itemTag(id)}<div class="msg agent">${esc(d.customer_message)}</div>${optHTML}${method}`;
    return;
  }
  if (cs.status === 'acting') {
    const evs = cs.events.filter(e => e.phase === 'act');
    const items = PROG_ACT[cs.chosen.option] || PROG_ACT.refund;
    const failed = evs.some(e => e.kind === 'fail' || e.kind === 'replan');
    el.innerHTML = `${who}${itemTag(id)}<h3>Setting it up</h3>${progressHTML(items, evs, (it, e) => e.kind === 'call' && it[1].includes(e.tool))}${failed ? '<p class="note">One store sold its pair while we were reserving it. We picked another one.</p>' : ''}`;
    return;
  }
  if (['done', 'received'].includes(cs.status)) {
    const basis = waiverBasis(id)[0];
    const rc = cs.received;
    el.innerHTML = `${who}<div style="display:flex;gap:12px;align-items:center"><div class="done-mark">${icon('check')}</div><div><h3>All set</h3><div class="small muted">${cs.verified ? 'Every step was checked in our systems.' : 'Your return is set up.'}</div></div></div>
      <div class="msg agent">${esc(cs.message)}</div>
      <ol class="timeline">${(cs.timeline || []).map(t => `<li><span><b>${esc(t.when)}</b><br>${esc(t.what)}</span></li>`).join('')}</ol>
      ${basis ? `<p class="note">Why it's free: ${esc(basis.customer.charAt(0).toUpperCase() + basis.customer.slice(1))}.</p>` : ''}
      ${rc ? `<div class="msg"><b>Received at ${esc(IDX.loc[rc.store].name)}.</b> ${rc.released ? 'The store checked the pair, so your return is complete.' : rc.held ? 'A manager is taking a quick look at the store check before we complete it.' : ''}</div>` : ''}
      <button type="button" class="btn secondary full" data-restart="1">Run this return again</button>`;
    return;
  }
  const waitMsg = {
    review: cs.decision?.status === 'not_eligible' ? 'Thanks. A member of our team will review your request within 1 business day.' : (cs.decision?.customer_message || 'A member of our team will review your return within 1 business day.'),
    awaiting_approval: cs.message || 'A member of our team needs to approve one step. We\'ll message you within 1 business day.',
    not_eligible: d?.customer_message, declined: cs.message, more_info: cs.message, needs_person: cs.message || 'A member of our team will contact you within 1 business day.',
  }[cs.status] || '';
  el.innerHTML = `${who}${itemTag(id)}<div class="msg agent">${esc(waitMsg)}</div>
    ${cs.status === 'not_eligible' ? `<button type="button" class="btn secondary full" id="policy-review-btn">Ask a person to review</button>` : ''}
    ${['review', 'awaiting_approval'].includes(cs.status) ? `<p class="note">For the demo, decide as the ${esc((pendingReviews().find(r => r.case_id === id) || {}).approver || 'approver')} on the <a href="#approvals" data-go="approvals">Approvals</a> tab.</p>` : ''}
    <button type="button" class="btn secondary full" data-restart="1">Start this return again</button>`;
}
function renderDecisionArea() {
  const el = $('#decision-area'); if (!el) return;
  const id = STATE.active, cs = CASES[id], d = cs.decision;
  el.innerHTML = `<div>${receiptHTML(id)}</div><div class="card card-pad">${whyHTML(id)}</div><div class="card card-pad">${routeHTML(id)}</div>`;
}
const SHORT_LOC = { 'Montreal distribution centre': 'Montreal DC', 'Liquidation or donation partner': 'Liquidation partner', 'Quarantine (supplier claim)': 'Supplier quarantine' };
const shortLoc = n => SHORT_LOC[n] || n;
function skuShort(sku, caseId) {
  const s = IDX.sku[sku]; if (!s) return sku;
  const old = IDX.sku[caseCtx(caseId).line.sku];
  const colour = old && s.colour !== old.colour ? s.colour.toLowerCase() + ', ' : '';
  return `${colour}size ${s.size}${s.width === 'W' ? ' wide' : ''}`;
}
function receiptEcon(id) {
  const e = returnEconomics(id);
  return `<div class="rc-row"><span>PRICE PAID</span><span>${money(e.price)}</span></div>
    <div class="rc-row"><span>OUR COST (WHAT WE PAID)</span><span>−${e.cost.toFixed(2)}</span></div>
    <div class="rc-row total"><span>GROSS MARGIN · ${pct(e.margin_pct)}</span><span>${money(e.margin)}</span></div><div class="rc-rule"></div>`;
}
function receiptHTML(id) {
  const cs = CASES[id], d = cs.decision, { k } = caseCtx(id);
  const opts = d && d.options ? d.options.filter(o => o.breakdown) : [];
  if (!opts.length) {
    return `<div class="receipt"><h3>PERFECT PAIR · VALUE RECEIPT</h3><div class="rc-sub">${esc(k.return_id)}</div><div class="rc-rule"></div>${receiptEcon(id)}<p style="font-family:var(--f-body);font-size:13.5px;color:var(--muted);margin:0">${d && d.status !== 'options_ready' ? 'No options were scored: a person decides this one, or the policy rules it out. The Approvals tab shows what each choice is worth.' : 'The options appear when the agent scores them. Every number comes from the value calculator in code, never from the model.'}</p></div>`;
  }
  const rows = opts.map(o => {
    const b = o.breakdown;
    const sub = [
      ['margin kept', b.margin_kept], ['returned pair resold', b.returned_pair_resold], ['return label', -b.label], ['shipping out', -b.outbound_shipping],
      ['processing', -b.processing], ['incentive', -b.incentive_cost], [`second-return risk${b.second_return_chance != null ? ` (${pct(b.second_return_chance)})` : ''}`, -b.second_return_risk],
    ].filter(([, v]) => Math.abs(v) > 0.004);
    return `<div class="rc-row opt-row"><span>${o.recommended ? '<span class="rc-star">★ </span>' : ''}${esc(o.type.replace('_', ' '))}${o.sku ? ` · ${esc(skuShort(o.sku, id))}` : ''}</span><span>${money(o.value_to_aldo)}</span></div>` +
      sub.map(([l, v]) => `<div class="rc-row sub"><span>${esc(l)}</span><span>${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}</span></div>`).join('');
  }).join('');
  return `<div class="receipt" aria-label="Value receipt"><h3>PERFECT PAIR · VALUE RECEIPT</h3><div class="rc-sub">${esc(k.return_id)} · value to ALDO, per option</div><div class="rc-rule"></div>
    ${receiptEcon(id)}
    <div class="rc-row" style="color:var(--muted)"><span>OPTION</span><span>VALUE</span></div>${rows}<div class="rc-rule"></div>
    <div class="rc-foot">value = margin kept + returned pair resold − label − shipping − processing − incentive − second-return risk. Calculated in code by score_options. ★ shown first to the customer.</div></div>`;
}
const STATUS_WORD = { options_ready: 'Options shown to the customer', human_review: 'Sent to a person', not_eligible: 'Not eligible' };
const REVIEW_WORD = { approve_refund: 'approved the refund', approve_credit: 'offered store credit instead', approve_credit_bonus: 'offered store credit with a bonus', approve_smart_credit: 'offered Smart Credit', decline: 'declined it (§2.4)', more_info: 'asked for more photos', uphold: 'upheld the policy', exception: 'made an exception: refund', approve: 'approved', reject: 'rejected', resolve: 'resolved it with the customer', release_refund: 'released the refund', convert_credit: 'gave store credit instead', decline_return: 'declined it and sent the pair back (§2.4)', ask_customer: 'asked the customer first', accept: 'accepted the pair as it is', auto_release: 'released the refund (inspection rule)', auto_accept: 'accepted it (inspection rule)' };
function personRow(id) {
  const rs = Object.values(SYS.reviews).filter(r => r.case_id === id && r.status !== 'superseded').sort((a, b) => b.requested_at - a.requested_at);
  if (!rs.length) return '';
  const r = rs[0];
  const what = r.status === 'pending' ? `Waiting for the ${r.approver.toLowerCase()}` : `${r.approver} ${REVIEW_WORD[r.decision] || String(r.decision || 'decided').replace(/_/g, ' ')}`;
  return `<dt>Person</dt><dd>${esc(what)} <span class="small muted mono">${esc(r.id)}</span></dd>`;
}
function whyHTML(id) {
  const cs = CASES[id], d = cs.decision, { line, st } = caseCtx(id);
  if (!d) return `<div class="eyebrow">Why this outcome</div><p class="muted small">After the agent decides, this card shows the policy clause, who caused the return, and the evidence it used.</p>`;
  const basis = waiverBasis(id);
  const owner = { carrier: 'The carrier', supplier: 'The supplier', aldo_product: "ALDO's product information", aldo_warehouse: "ALDO's warehouse", customer: 'The customer (preference)' }[d.cost_owner] || d.cost_owner || '—';
  let vs = '';
  const ex = d.options && d.options.find(o => o.type === 'exchange');
  if (ex && IDX.sku[ex.sku] && IDX.sku[ex.sku].width === 'W' && line.width === 'M') {
    const rule = candidateEvidence('size_up_for_narrow', line.style_id), agent = candidateEvidence('wide_same_size', line.style_id);
    vs = `<div class="eyebrow" style="margin:14px 0 8px">A fixed rule vs the agent</div><div class="vs"><div class="rule"><b>Rule: "too tight" → size up</b><div class="big">Size ${fmtSize(Number(line.size) + 0.5)}</div><div class="small">${esc(rule.evidence)}</div><div class="small" style="margin-top:4px">Second return: <b>${pct(rule.risk)}</b></div></div><div class="agent"><b>Agent: reads words + reviews</b><div class="big">Size ${esc(line.size)} wide</div><div class="small">${esc(agent.evidence)}</div><div class="small" style="margin-top:4px">Second return: <b>${pct(agent.risk)}</b></div></div></div>`;
  }
  return `<div class="eyebrow" style="margin-bottom:10px">Why this outcome</div><dl class="kv">
    <dt>Status</dt><dd>${esc(STATUS_WORD[d.status] || d.status.replace('_', ' '))}</dd>
    ${personRow(id)}
    <dt>Policy</dt><dd>${esc(d.eligibility.clause || '')} ${esc(d.eligibility.note || '')}</dd>
    <dt>Reason</dt><dd>${esc((d.reason_code || '').replace(/_/g, ' '))}${d.sub_reason ? ' · ' + esc(d.sub_reason.replace(/_/g, ' ')) : ''}</dd>
    <dt>Who caused it</dt><dd>${esc(owner)}${d.cost_owner_evidence ? `<br><span class="small muted">${esc(d.cost_owner_evidence)}</span>` : ''}</dd>
    ${basis.length ? `<dt>Fee</dt><dd>Waived (§3.3): ${esc(basis[0].why)}</dd>` : ''}
    ${d.guards && d.guards.length ? `<dt>Page checks</dt><dd>${d.guards.map(esc).join('<br>')}</dd>` : ''}
    ${d.notes ? `<dt>Notes</dt><dd>${esc(d.notes)}</dd>` : ''}
  </dl>${vs}${d.citations && d.citations.length ? `<div class="eyebrow" style="margin:14px 0 6px">Sources cited</div>${sourcesHTML(d.citations)}` : ''}`;
}
function routeHTML(id) {
  const { k } = caseCtx(id);
  const cs = CASES[id];
  const head = '<div class="eyebrow">Where the returned pair goes</div>';
  if (cs.chosen && cs.chosen.option === 'keep_it' && ['done', 'received'].includes(cs.status)) return head + '<p class="small muted" style="margin:6px 0 0">Nothing to route: the customer keeps the pair, because sending it back would cost more than it is worth.</p>';
  if (['not_eligible', 'declined'].includes(cs.status)) return head + '<p class="small muted" style="margin:6px 0 0">Nothing to route: the pair stays with the customer.</p>';
  const plan = SYS.routes[id];
  const conf = plan && plan.confirmed;
  const grade = conf ? conf.grade : k.photo.grade;
  const scores = (conf ? routeScores(id, conf.grade, conf.at) : plan ? plan.scores : routeScores(id, k.photo.grade, 'DC-MTL')).slice(0, 5);
  const max = Math.max(1, ...scores.map(s => s.score));
  const lead = conf ? `Confirmed at the ${esc(IDX.loc[conf.at].name)} counter, graded ${esc(conf.grade)} in hand.` : plan ? `Planned by the agent from the photo (grade ${esc(k.photo.grade)}); the store counter confirms it.` : `Preview from the photo (grade ${esc(k.photo.grade)}). The agent plans this when the customer confirms.`;
  return `${head}
    <p class="small muted" style="margin:4px 0 12px">${lead} Score = (price − cost) × chance it sells in 4 weeks − transfer cost.</p>
    <div class="bars">${scores.map((s, i) => `<div class="bar-row ${i === 0 ? 'win' : ''}" style="--i:${i}" title="${esc(s.name)}: ${esc(s.why)}"><span class="lab">${esc(shortLoc(s.name))}</span><span class="bar-track"><span class="bar-fill" style="width:${clamp(s.score / max, 0, 1) * 100}%"></span></span><span class="val">${money(s.score)}</span></div>`).join('')}</div>
    <p class="small" style="margin:12px 0 0"><b>${esc(scores[0].name)}</b>: ${esc(scores[0].why.charAt(0).toLowerCase() + scores[0].why.slice(1))}.${grade !== 'A' && scores.length === 1 ? ` Grade ${esc(grade)} pairs have one destination.` : ''}</p>`;
}
function startInvestigate() {
  const id = STATE.active;
  if (anyBusy()) return;
  const ta = $('#words'); if (ta) CASES[id].words = ta.value;
  UI.sel = {};
  if (STATE.mode === 'live' && !STATE.live.available) STATE.mode = 'scripted';
  investigate(id);
}
function confirmChoice() {
  const id = STATE.active, cs = CASES[id];
  if (!UI.sel.option || anyBusy()) return;
  const method = UI.sel.option === 'keep_it' ? 'none' : (UI.sel.method || ($('#m-store')?.checked ? 'store_dropoff' : 'carrier'));
  const best = bestDropOffStore(id);
  cs.chosen = { option: UI.sel.option, method, dropStore: method === 'store_dropoff' && best ? best.location_id : null };
  UI.sel = {};
  act(id);
}

/* ---------- New customer: any photo, any words ----------
   Builds a real return (customer, order, case) from the form, then runs the same
   agent. In live mode Claude reads the photo first; the scripted backup can't,
   so the presenter grades it. The photo stays in this tab and is only sent to
   Claude when the return starts. */
UI.nc = { name: 'Alex', region: 'Greater Montreal', style: 'ST-2041', colour: 'Black', sku: '', days: 6, words: '', file: null, fileName: '', preview: '', grade: 'A', matches: true, error: '' };
const NC_REGIONS = ['Greater Montreal', 'Ottawa', 'Toronto', 'Quebec City'];
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
function canReadPhotos() { return STATE.mode === 'live' && STATE.live.available && !!STATE.live.images; }
function renderNewCustomer() {
  const el = $('#tab-return');
  el.innerHTML = `
  <div class="scenario-bar" id="scenario-bar"></div>
  <div class="workbench">
    <section class="phone" aria-label="New customer's returns page"><div class="phone-top"><b>Returns</b><span class="small muted">Perfect Pair prototype</span></div><div class="phone-body" id="phone-new"></div></section>
    <section class="card card-pad nc-explain">
      <div class="eyebrow">Try it live</div>
      <h2>A brand-new customer</h2>
      <p>Pick what they bought, attach any photo of the item and describe the problem in your own words. The agent has never seen this case.</p>
      <ol class="nc-steps">
        <li><b>Claude reads the photo.</b> What it shows, its condition from A (unworn) to D (defective), and whether it matches the order and the description.</li>
        <li><b>The Resolution agent takes over</b> with the same tools, rules and safety checks as the test customers, and cites what it used.</li>
        <li><b>A person steps in</b> when the photo doesn't show the ordered item, or doesn't support the claim on anything over $75. Nobody is accused: the customer gets a neutral message.</li>
      </ol>
      <div class="nc-modes small"><div><span class="pill ${canReadPhotos() ? 'ok' : 'neutral'}">Live agent</span> Claude reads the photo. Each run uses your Claude usage.</div><div><span class="pill neutral">Scripted backup</span> Claude can't read photos here, so you choose the condition grade yourself.</div></div>
      <p class="note">Good photos to try: a shoe with a broken heel, a scuffed box, a worn sole, an unworn pair in its box, or something that isn't a shoe at all. The photo stays in this tab; it goes to Claude only when you start the return, and it isn't stored.</p>
    </section>
  </div>`;
  renderScenarioBar(); renderNewForm();
}
function renderNewForm() {
  const el = $('#phone-new'); if (!el) return;
  const f = UI.nc;
  if (!IDX.style[f.style]) f.style = 'ST-2041';
  const st = IDX.style[f.style];
  if (!st.colours.includes(f.colour)) f.colour = st.colours[0];
  const skus = DATA.skus.filter(x => x.style_id === f.style && x.colour === f.colour);
  if (!skus.some(x => x.sku === f.sku)) f.sku = (skus.find(x => x.size === '8' && x.width === 'M') || skus[0] || {}).sku || '';
  const live = canReadPhotos();
  const groups = groupBy(DATA.catalogue, 'category');
  const sizeWord = x => x.size === 'OS' ? 'One size' : `${x.size}${x.width === 'W' ? ' wide' : ''}`;
  el.innerHTML = `
    <div class="who"><div class="avatar" aria-hidden="true">+</div><div><b>New customer</b><div class="small muted">Any photo, any words</div></div></div>
    <div class="nc-grid">
      <div class="field"><label for="nc-name">First name</label><input id="nc-name" class="inp" value="${esc(f.name)}" maxlength="24" autocomplete="off"></div>
      <div class="field"><label for="nc-region">Region</label><select id="nc-region" class="inp">${NC_REGIONS.map(r => `<option ${r === f.region ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></div>
    </div>
    <p class="hint">The name shows on this screen only. The agent never sees it.</p>
    <div class="field"><label for="nc-style">What did they buy?</label><select id="nc-style" class="inp">${Object.entries(groups).map(([cat, list]) => `<optgroup label="${esc(cat)}">${list.map(x => `<option value="${x.style_id}" ${x.style_id === f.style ? 'selected' : ''}>${esc(styleName(x.style_id))} · ${moneyShort(x.price)}</option>`).join('')}</optgroup>`).join('')}</select></div>
    <div class="nc-grid">
      <div class="field"><label for="nc-colour">Colour</label><select id="nc-colour" class="inp">${st.colours.map(c => `<option ${c === f.colour ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label for="nc-sku">Size</label><select id="nc-sku" class="inp">${skus.map(x => `<option value="${x.sku}" ${x.sku === f.sku ? 'selected' : ''}>${esc(sizeWord(x))}</option>`).join('')}</select></div>
    </div>
    <div class="nc-grid">
      <div class="field"><label>Price paid</label><div class="nc-price">${money(st.price)}</div></div>
      <div class="field"><label for="nc-days">Delivered how many days ago?</label><input id="nc-days" class="inp" type="number" inputmode="numeric" min="0" max="120" value="${esc(f.days)}"></div>
    </div>
    <div class="field"><label for="nc-file">Photo of the item</label>
      <input id="nc-file" type="file" accept="${IMG_TYPES.join(',')}" class="sr-only">
      <label class="drop" id="nc-drop" for="nc-file">${f.preview ? `<img src="${esc(f.preview)}" alt="The photo you chose">` : `${icon('camera')}<span><b>Choose a photo</b> or drop one here<br><span class="small muted">JPEG, PNG, WebP or GIF</span></span>`}</label>
      ${f.fileName ? `<div class="small muted nc-file">${esc(f.fileName)} · <button type="button" class="linkbtn" id="nc-clear">Remove</button></div>` : ''}
    </div>
    <div class="field"><label for="nc-words">Describe the problem</label><textarea id="nc-words" placeholder="For example: the heel came off the second time I wore them.">${esc(f.words)}</textarea></div>
    ${live ? '' : `<div class="field nc-manual"><label for="nc-grade">Photo condition <span class="muted">(${STATE.mode === 'live' ? "this view can't send photos to Claude" : "the scripted backup can't read photos"})</span></label>
      <select id="nc-grade" class="inp">${['A', 'B', 'C', 'D'].map(g => `<option value="${g}" ${f.grade === g ? 'selected' : ''}>${g}: ${esc(GRADE[g])}</option>`).join('')}</select>
      <label class="check"><input type="checkbox" id="nc-matches" ${f.matches ? 'checked' : ''}> The photo shows the item they ordered</label></div>`}
    ${f.error ? `<div class="msg" role="alert"><b>${esc(f.error)}</b></div>` : ''}
    <button type="button" class="btn full" id="nc-start" ${anyBusy() ? 'disabled' : ''}>Start the return</button>
    <p class="note">${live ? 'Claude reads the photo first, then the Resolution agent takes over.' : 'Switch to the live agent for Claude to read the photo.'}</p>`;
}
async function previewURL(file) {
  let img;
  if (window.createImageBitmap) img = await createImageBitmap(file);
  else img = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = fr.result; }; fr.onerror = rej; fr.readAsDataURL(file); });
  const scale = Math.min(1, 520 / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(img.width * scale)); cv.height = Math.max(1, Math.round(img.height * scale));
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.82);
}
async function takeFile(file) {
  const f = UI.nc;
  const lim = STATE.live.limits && STATE.live.limits.images;
  const types = (lim && lim.mediaTypes && lim.mediaTypes.length ? lim.mediaTypes : IMG_TYPES);
  const max = (lim && lim.maxInputBytes) || 20 * 1024 * 1024;
  f.error = '';
  if (!types.includes(file.type)) { f.error = 'That file type is not supported. Use a JPEG, PNG, WebP or GIF photo.'; return renderNewForm(); }
  if (file.size > max) { f.error = `That photo is ${(file.size / 1048576).toFixed(1)} MB. The limit is ${Math.round(max / 1048576)} MB.`; return renderNewForm(); }
  try {
    f.preview = await previewURL(file);
    f.file = file; f.fileName = file.name || 'photo';
  } catch (e) { f.file = null; f.fileName = ''; f.preview = ''; f.error = "Couldn't open that image. Try another photo."; }
  renderNewForm();
}
function startNewCustomer() {
  if (anyBusy()) return;
  const f = UI.nc;
  const ta = $('#nc-words'); if (ta) f.words = ta.value;
  if (STATE.mode === 'live' && !STATE.live.available) STATE.mode = 'scripted';
  if (canReadPhotos() && !f.file) { f.error = 'Add a photo of the item first.'; return renderNewForm(); }
  if (String(f.words).trim().length < 3) { f.error = 'Describe the problem in a few words.'; return renderNewForm(); }
  f.error = '';
  let k;
  try {
    k = createCustomCase({ sku: f.sku, name: f.name, region: f.region, days_since_delivery: f.days, words: f.words, grade: f.grade, matches: f.matches,
      photo_name: f.fileName || 'no photo', photo: f.file ? { blob: f.file, url: f.preview } : {} });
  } catch (e) { f.error = e.message; return renderNewForm(); }
  CASES[k.case_id] = newCaseState(k.case_id);
  STATE.active = k.case_id; UI.sel = {};
  renderTabsBar(); renderReturn();
  investigate(k.case_id);
}

/* ---------- Store counter ---------- */
function renderStore() {
  const el = $('#tab-store');
  const expected = DATA.cases.filter(k => Object.values(SYS.labels).some(l => l.case_id === k.case_id));
  if (UI.counter.caseId && !expected.some(k => k.case_id === UI.counter.caseId)) UI.counter = { caseId: null };
  if (!UI.counter.caseId && expected.length) UI.counter = { caseId: expected[0].case_id, store: null, grade: null };
  const sel = UI.counter.caseId;
  const head = `<div class="section-head"><div><div class="eyebrow">Store associate · counter screen</div><h2>Drop-offs and grading</h2><p>When a customer drops off a pair, grade it here. The agent confirms where it goes: back on this shelf, another store, the outlet or the supplier.</p></div></div>`;
  if (!expected.length) { el.innerHTML = head + `<div class="empty"><b>No drop-offs expected yet.</b>Finish a return on the Return tab (Maya's is a good start) and it will appear here.</div>`; return; }
  const cs = CASES[sel], { k } = caseCtx(sel);
  const label = Object.values(SYS.labels).find(l => l.case_id === sel);
  const plan = SYS.routes[sel];
  const stores = DATA.locations.filter(l => l.type === 'store');
  const storeId = UI.counter.store || label.store || (cs.chosen && cs.chosen.dropStore) || stores[0].location_id;
  const g = UI.counter.grade;
  const rc = cs.received;
  el.innerHTML = head + `<div class="grid2 g-side">
    <div class="card card-pad"><div class="eyebrow" style="margin-bottom:10px">Expected</div><div class="dropoff">${expected.map(x => { const lc = caseCtx(x.case_id).line; return `<button type="button" data-counter="${x.case_id}" aria-pressed="${x.case_id === sel}"><b>${esc(x.return_id)}</b> · ${esc(lc.product)}, size ${esc(lc.size)}<br><span class="small muted">${CASES[x.case_id].received ? 'Received' : 'Waiting for drop-off'}</span></button>`; }).join('')}</div></div>
    <div class="card card-pad stack">
      ${itemTag(sel)}
      <div class="grid2"><div><div class="eyebrow">Photo suggested</div><b>Grade ${esc(k.photo.grade)}</b> · <span class="small">${esc(GRADE[k.photo.grade])}</span></div><div><div class="eyebrow">Agent's plan</div>${plan ? `<b>${esc(IDX.loc[plan.plan]?.name || plan.scores[0].name)}</b>` : '<span class="muted">No plan yet</span>'}</div></div>
      <div class="store-pick"><label class="small" for="counter-store"><b>This counter is at</b></label> <select id="counter-store">${stores.map(s => `<option value="${s.location_id}" ${s.location_id === storeId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div><div class="eyebrow" style="margin-bottom:8px">Grade the pair in hand</div><div class="grade-btns">${['A', 'B', 'C', 'D'].map(x => `<button type="button" data-grade="${x}" aria-pressed="${g === x}"><b>${x}</b><span>${esc(GRADE[x].split(':')[0])}</span></button>`).join('')}</div></div>
      <button type="button" class="btn red" id="counter-confirm" ${g ? '' : 'disabled'}>${rc ? 'Update the grade' : 'Confirm grade and route'}</button>
      ${rc ? counterResultHTML(sel, rc) : ''}
    </div></div>`;
}
function counterResultHTML(id, rc) {
  const dest = rc.destination;
  const here = rc.keepHere;
  const rule = rc.rule;
  const rv = rc.review && SYS.reviews[rc.review];
  return `<div class="msg"><b>${here ? `Keep it here at ${esc(IDX.loc[rc.store].name)}` : `Send it to ${esc(dest.name)}`}.</b> ${esc(dest.why)}.${here ? ' Put it back on the shelf.' : ` Transfer cost ${money(dest.transfer_cost)}, ${dest.carbon_kg} kg CO₂e.`}</div>
    ${rule ? `<div class="inspect-res ${rule.auto ? 'auto' : 'held'}"><span class="pill ${rule.auto ? 'ok' : 'warn'}">R13 ${esc(rule.id)} · ${rule.auto ? 'Decided automatically' : 'Sent to the store manager'}</span><div class="small">${esc(rule.text)}</div>
      ${(rc.releasedList || []).length ? `<div class="small"><b>Released after the check:</b> ${esc(rc.releasedList.join('; '))}.</div>` : ''}${rc.held ? `<div class="small"><b>On hold</b> (${esc(rc.held)}): nothing is paid or shipped until the manager decides${rv ? ` (${esc(rv.id)} in Approvals)` : ''}.</div>` : ''}${rc.claim ? `<div class="small"><b>Supplier claim ${esc(rc.claim)}</b> opened for the defect.</div>` : ''}</div>` : ''}
    ${rv && rv.status === 'pending' ? (() => { const co = counterOptions(id); return `<div class="reco"><div class="eyebrow">${icon('check')}Recommended for the store manager</div><div class="reco-main"><b>★ ${esc(co.best.label)}</b>${co.best.value != null ? `<span>ALDO keeps <b>${money(co.best.value)}</b> on this return.</span>` : ''}</div><p class="small" style="margin:0">${esc(co.why)}</p>
      <div class="ap-actions">${co.options.map(o => `<button type="button" class="btn ${o.best ? '' : 'secondary '}sm" data-review="${rv.id}" data-choice="${o.key}">${o.best ? '★ ' : ''}${esc(o.label)}</button>`).join('')}</div><p class="small muted" style="margin:0">Or decide later from Approvals, with the packing, customer and store photos side by side.</p></div>`; })() : rv && rv.decision && !rv.auto ? `<div class="small"><span class="pill ok">Decided</span> ${esc(rv.decided_by)} ${esc(REVIEW_WORD[rv.decision] || rv.decision)}.</div>` : ''}
    <div class="staff-photos"><div class="eyebrow">Store photos of the pair</div><p class="small muted" style="margin:2px 0 8px">Add photos of the pair as it arrived. They go with the return to Approvals, next to the photos from packing and from the customer.</p>
      <div class="staff-slots">${casePhotos(id, 'store').map((p, i) => `<div class="staff-slot"><button type="button" class="ph" data-photo="${esc(id)}" data-pset="store" data-pi="${i}" aria-label="${esc(p.title)}"><span class="ph-img">${p.img ? `<img src="${esc(p.img)}" alt="">` : p.svg}${p.real ? '<span class="ph-real">Photo</span>' : ''}</span></button>
        <label class="btn secondary sm"><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" data-realphoto="${esc(photoKey(id, 'store', i))}" hidden>${p.real ? 'Replace' : 'Add photo'}</label></div>`).join('')}</div></div>`;
}

/* ---------- small charts ----------
   Plain SVG and HTML in the page's own palette: ink for the data that matters,
   gray for context, red for money going out. Every mark carries data-tip for hover
   and keyboard focus, and every chart has a table view, so no number is hover-only. */
const whole = n => (n < 0 ? '−' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-CA');
const signed = n => Math.abs(n) < 0.005 ? '$0.00' : (n > 0 ? '+' : '−') + money(Math.abs(n));
const compactMoney = n => (n < 0 ? '−' : '') + '$' + (Math.abs(n) >= 1000 ? (Math.abs(n) / 1000).toFixed(1) + 'K' : Math.round(Math.abs(n)));
function tableView(head, rows, nums = []) {
  return `<details class="tv"><summary>Show as a table</summary><div class="tbl-wrap"><table><thead><tr>${head.map((h, i) => `<th class="${nums[i] ? 'num' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((v, i) => `<td class="${nums[i] ? 'num' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
}
// Charts are drawn for the space they get, so text stays readable on a phone.
const chartW = () => clamp(Math.round(document.documentElement.clientWidth - 92), 300, 560);
function chartCard(title, body, table, sub, explain) {
  return `<section class="chart-card"><h4>${esc(title)}</h4>${sub ? `<p class="small muted">${esc(sub)}</p>` : ''}${body}${explain ? `<p class="chart-explain">${explain}</p>` : ''}${table || ''}</section>`;
}
/** A labelled group inside an approval: whose data the charts below describe. */
function groupHead(kind, title, sub) {
  const tag = { ret: 'This return', prod: 'This product', cust: 'This customer' }[kind];
  return `<div class="grp-head grp-${kind}"><span class="grp-tag">${esc(tag)}</span><h3>${esc(title)}</h3>${sub ? `<p class="small muted">${esc(sub)}</p>` : ''}</div>`;
}
/** Horizontal bars from a zero line (negatives go left). rows: [{label, value, tip, hl, sub}] */
function hbars(rows, opts = {}) {
  const vals = rows.map(r => r.value);
  const min = Math.min(0, ...vals), max = Math.max(0, ...vals), span = (max - min) || 1;
  const zero = (-min / span) * 100;
  const emph = rows.some(r => r.hl);
  return `<div class="hb${emph ? ' emph' : ''}${opts.cls ? ' ' + opts.cls : ''}">${rows.map(r => {
    const w = Math.abs(r.value) / span * 100;
    const left = r.value >= 0 ? zero : zero - w;
    return `<div class="hb-row${r.hl ? ' hl' : ''}" style="--i:${rows.indexOf(r)}"><span class="hb-lab">${esc(r.label)}${r.sub ? `<span class="hb-sub">${esc(r.sub)}</span>` : ''}</span><span class="hb-track" data-tip="${esc(r.tip)}" tabindex="0">${min < 0 ? `<i class="hb-zero" style="left:${zero}%"></i>` : ''}<i class="hb-bar${r.value < 0 ? ' neg' : ''}" style="left:${left}%;width:${Math.max(w, 0.8)}%"></i></span><span class="hb-val">${esc(opts.fmt ? opts.fmt(r.value) : money(r.value))}</span></div>`;
  }).join('')}</div>`;
}
/** A profit bridge: steps add or take away from a running total, the last step is the total. */
function bridge(steps) {
  let run = 0;
  const segs = steps.map(s => {
    if (s.kind === 'total') return { ...s, from: 0, to: s.value };
    const seg = { ...s, from: run, to: run + s.value }; run += s.value; return seg;
  });
  const lo = Math.min(0, ...segs.flatMap(s => [s.from, s.to])), hi = Math.max(0, ...segs.flatMap(s => [s.from, s.to]));
  const span = (hi - lo) || 1, X = v => (v - lo) / span * 100;
  return `<div class="hb wf">${segs.map(s => {
    const a = Math.min(s.from, s.to), b = Math.max(s.from, s.to);
    const neg = s.kind === 'total' ? s.value < 0 : s.value < 0;
    const bar = Math.abs(s.value) < 0.005 ? '' : `<i class="hb-bar${neg ? ' neg' : ''}" style="left:${X(a)}%;width:${Math.max(0.8, X(b) - X(a))}%"></i>`;
    return `<div class="hb-row ${s.kind}" style="--i:${segs.indexOf(s)}"><span class="hb-lab">${esc(s.label)}</span><span class="hb-track" data-tip="${esc(s.tip)}" tabindex="0"><i class="hb-zero" style="left:${X(0)}%"></i>${bar}</span><span class="hb-val">${s.kind === 'total' ? money(s.value) : signed(s.value)}</span></div>`;
  }).join('')}</div>`;
}
/** Every past order on a time axis: kept orders on the top lane, returns below. */
function timelineSVG(p) {
  const rows = p.rows;
  const W = chartW(), H = 128, L = 74, R = 18, T = 18, B = 24;
  const start = dayNum(rows[0].order_date) - 25, end = dayNum(META.today) + 8;
  const x = iso => L + (dayNum(iso) - start) / (end - start) * (W - L - R);
  const laneY = { kept: T + 16, ret: T + 58 };
  const spanDays = end - start;
  const step = spanDays > 1100 ? 12 : spanDays > 500 ? 6 : spanDays > 200 ? 3 : 1;
  const ticks = [];
  const d = new Date(start * 864e5); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
  while (d.getTime() / 864e5 < end) { if (d.getUTCMonth() % step === 0) ticks.push(d.toISOString().slice(0, 10)); d.setUTCMonth(d.getUTCMonth() + 1); }
  while (ticks.length > 1 && (W - L - R) / ticks.length < 56) { for (let i = ticks.length - 1; i > 0; i -= 2) ticks.splice(i, 1); }
  const tickLabel = iso => new Date(dayNum(iso) * 864e5).toLocaleDateString('en-CA', step >= 12 ? { year: 'numeric', timeZone: 'UTC' } : { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const marks = rows.map(r => {
    const cx = x(r.order_date).toFixed(1);
    const cur = r.outcome === 'return in progress', ret = RETURNED.includes(r.outcome);
    const cy = cur || ret ? laneY.ret : laneY.kept;
    const miss = r.inspection === 'did not match';
    const tip = [`${r.product} · ${money(r.price_paid)}`, `${fmtDate(r.order_date)} · ${cur ? 'the return being decided now' : ret ? `${r.outcome.replace('_', ' ')}, ${r.return_reason.replace(/_/g, ' ')}${r.damage_claim ? ' (damage claim)' : ''}` : 'kept'}`]
      .concat(ret ? [`Inspection ${r.inspection}, grade ${r.grade_found}`] : []).concat(cur ? [] : [`Net profit ${money(r.net_profit)}`]).join('\n');
    let shape;
    if (cur) shape = `<circle cx="${cx}" cy="${cy}" r="7" fill="var(--panel)" stroke="var(--red)" stroke-width="2.5"/>`;
    else if (r.damage_claim) shape = `<rect x="${cx - 5}" y="${cy - 5}" width="10" height="10" transform="rotate(45 ${cx} ${cy})" fill="${miss ? 'var(--panel)' : 'var(--chart-1)'}" stroke="var(--chart-1)" stroke-width="2"/>`;
    else if (ret) shape = `<circle cx="${cx}" cy="${cy}" r="5" fill="${miss ? 'var(--panel)' : 'var(--chart-1)'}" stroke="var(--chart-1)" stroke-width="2"/>`;
    else shape = `<circle cx="${cx}" cy="${cy}" r="5" fill="var(--chart-2)" stroke="var(--panel)" stroke-width="2"/>`;
    return `<g class="mk" style="--i:${rows.indexOf(r)}" data-tip="${esc(tip)}" tabindex="0"><circle cx="${cx}" cy="${cy}" r="12" fill="transparent"/>${shape}</g>`;
  });
  const cur = rows.find(r => r.outcome === 'return in progress');
  const curX = cur ? x(cur.order_date) : 0;
  return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${p.past.length} past orders, ${p.returns} returned, ${p.claims_all} damage claims`)}">
    ${ticks.map(t => `<line x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="${T}" y2="${H - B}" stroke="var(--chart-grid)" stroke-width="1"/><text x="${x(t).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="var(--f-mono)">${esc(tickLabel(t))}</text>`).join('')}
    <line x1="${L}" x2="${W - R}" y1="${laneY.kept}" y2="${laneY.kept}" stroke="var(--chart-axis)" stroke-width="1"/>
    <line x1="${L}" x2="${W - R}" y1="${laneY.ret}" y2="${laneY.ret}" stroke="var(--chart-axis)" stroke-width="1"/>
    <text x="${L - 10}" y="${laneY.kept + 4}" text-anchor="end" font-size="12" fill="var(--ink-2)" font-family="var(--f-body)">Kept</text>
    <text x="${L - 10}" y="${laneY.ret + 4}" text-anchor="end" font-size="12" fill="var(--ink-2)" font-family="var(--f-body)">Returned</text>
    ${marks.join('')}
    ${cur ? `<text x="${Math.min(curX, W - R - 2).toFixed(1)}" y="${laneY.ret + 24}" text-anchor="end" font-size="11" font-weight="700" fill="var(--red-ink)" font-family="var(--f-body)">This return</text>` : ''}
  </svg></div>
  <div class="legend-row small viz-legend"><span><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="var(--chart-2)"/></svg>Kept</span><span><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="var(--chart-1)"/></svg>Returned</span><span><svg width="13" height="13" aria-hidden="true"><rect x="2.5" y="2.5" width="8" height="8" transform="rotate(45 6.5 6.5)" fill="var(--chart-1)"/></svg>Damage claim</span><span><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="none" stroke="var(--chart-1)" stroke-width="1.6"/></svg>Inspection didn't match</span><span><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="var(--red)" stroke-width="2"/></svg>This return</span></div>`;
}
/** All customers ranked by lifetime net profit, this one in ink. */
function rankSVG(p) {
  const all = valueRanking(), n = all.length;
  const W = chartW(), H = 156, L = 48, R = 12, T = 30, B = 14;
  const vals = all.map(a => a.net);
  const hi = Math.max(0, ...vals), lo = Math.min(0, ...vals);
  const y = v => T + (hi - v) / ((hi - lo) || 1) * (H - T - B);
  const slot = (W - L - R) / n, bw = Math.max(1, slot - 2);
  const me = all.findIndex(a => a.cid === p.c.customer_id);
  const ticks = [0, Math.floor(hi / 500) * 500].filter((v, i, a) => a.indexOf(v) === i);
  if (lo < 0 && y(lo) - y(0) >= 16) ticks.push(Math.ceil(lo / 50) * 50);
  const cols = all.map((a, i) => {
    const y0 = y(0), yv = y(a.net), top = Math.min(y0, yv), h = Math.max(1, Math.abs(yv - y0));
    const mine = i === me;
    return `<rect class="rank-col${a.net < 0 ? ' neg' : ''}" style="--i:${i}" x="${(L + i * slot + 1).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${mine ? 'var(--chart-1)' : 'var(--chart-2)'}" opacity="${mine ? 1 : 0.55}" data-tip="${esc(`${money(a.net)} net profit\nRank ${i + 1} of ${n} · ${a.cid}${mine ? ' (this customer)' : ''}`)}"${mine ? ' tabindex="0"' : ''}/>`;
  });
  const mx = L + me * slot + slot / 2, my = y(all[me] ? Math.max(0, all[me].net) : 0);
  const anchor = mx > W * 0.72 ? 'end' : mx < W * 0.28 ? 'start' : 'middle';
  return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Rank ${me + 1} of ${n} customers by lifetime net profit`)}">
    ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${v === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'}" stroke-width="1"/><text x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--f-mono)">${esc(compactMoney(v))}</text>`).join('')}
    ${cols.join('')}
    ${me >= 0 ? `<line x1="${mx.toFixed(1)}" x2="${mx.toFixed(1)}" y1="${T - 6}" y2="${(my - 6).toFixed(1)}" stroke="var(--ink)" stroke-width="1"/><circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="4" fill="var(--chart-1)" stroke="var(--panel)" stroke-width="2"/><text x="${mx.toFixed(1)}" y="${T - 10}" text-anchor="${anchor}" font-size="12" font-weight="700" fill="var(--ink)" font-family="var(--f-body)">Rank ${me + 1} of ${n} · ${esc(money(all[me].net))}</text>` : ''}
  </svg></div>`;
}
function priceSplit(e) {
  const costPct = clamp(e.cost / (e.price || 1) * 100, 0, 100);
  return `<div class="split" role="img" aria-label="${esc(`Price paid ${money(e.price)}: our cost ${money(e.cost)} and margin ${money(e.margin)}`)}"><span class="sp-cost" style="width:${costPct}%" data-tip="${esc(`${money(e.cost)} our cost\nWhat ALDO paid for this pair`)}" tabindex="0"></span><span class="sp-margin" style="width:${100 - costPct}%" data-tip="${esc(`${money(e.margin)} gross margin\n${pct(e.margin_pct)} of the price paid`)}" tabindex="0"></span></div>
    <div class="legend-row small viz-legend"><span><i style="background:var(--chart-2)"></i>Our cost ${money(e.cost)}</span><span><i style="background:var(--chart-1)"></i>Margin ${money(e.margin)} (${pct(e.margin_pct)})</span></div>`;
}

/* ---------- Approvals ---------- */
const BREAK_WORD = { margin_kept: 'Margin kept', returned_pair_resold: 'Returned pair resold', label: 'Return label', processing: 'Processing', outbound_shipping: 'Shipping out', incentive_cost: 'Incentive', second_return_risk: 'Second-return risk' };
const BREAK_COST = ['label', 'processing', 'outbound_shipping', 'incentive_cost', 'second_return_risk'];
const breakLines = b => Object.entries(b || {}).filter(([k, v]) => BREAK_WORD[k] && Math.abs(v) > 0.004).map(([k, v]) => `${BREAK_WORD[k]} ${BREAK_COST.includes(k) ? '−' : '+'}$${Math.abs(v).toFixed(2)}`);
/* ---------- approval queue: one card per request, click to open everything ---------- */
const KIND_LABEL = { chat: 'Customer chat', case: 'Return review', action: 'Action approval', policy: 'Policy appeal', page_fix: 'Product page fix', counter: 'Store check mismatch' };
UI.apFocus = UI.apFocus || null; UI.apSeen = UI.apSeen || new Set(); UI.apFilter = UI.apFilter || 'all';
function slaInfo(r) {
  const tier = r.tier || 1, total = SLA_MIN[tier] * 60000, due = r.requested_at + total;
  const end = r.decided_at || Date.now(), left = due - end;
  return { tier, total, due, left, used: clamp((end - r.requested_at) / total, 0, 1), escalated: left <= 0, to: ESCALATES_TO[tier] };
}
const fmtLeft = ms => { const t = Math.max(0, Math.round(Math.abs(ms) / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s2 = t % 60; return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s2).padStart(2, '0')}s`; };
const fmtWhen = ts => new Date(ts).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
function slaHTML(r) {
  const x = slaInfo(r);
  if (r.status !== 'pending') return { cls: x.escalated ? 'late' : 'ok', big: fmtLeft(r.decided_at - r.requested_at), small: x.escalated ? `Actioned after it escalated to the ${x.to.toLowerCase()}` : 'Actioned before it escalated' };
  if (x.escalated) return { cls: 'late', lab: 'Overdue by', big: fmtLeft(x.left), small: `Escalated to the ${x.to.toLowerCase()}` };
  return { cls: x.left < 30 * 60000 ? 'soon' : x.left < 90 * 60000 ? 'mid' : 'ok', lab: 'Time to action', big: fmtLeft(x.left), small: `left before it escalates to the ${x.to.toLowerCase()}` };
}
let AOV_P75 = null;
/** Labels that tell the approver who this customer is to ALDO. */
function custTags(cid) {
  const p = customerProfile(cid); if (!p) return [];
  if (AOV_P75 == null) { const a = DATA.customers.filter(c => !c.custom).map(c => c.average_order_value).sort((x, y) => x - y); AOV_P75 = a[Math.floor(a.length * 0.75)]; }
  const t = [], c = p.c;
  if (['Gold', 'Silver'].includes(c.loyalty_status) && c.customer_tenure_months >= 24) t.push({ k: 'loyal', label: `Loyal · ${c.loyalty_status}, ${tenureWords(c.customer_tenure_months)}`, tip: `${c.loyalty_status} member for ${tenureWords(c.customer_tenure_months)}\n${p.orders} orders` });
  else if (c.loyalty_status === 'Gold') t.push({ k: 'loyal', label: 'Gold member', tip: `Gold member for ${tenureWords(c.customer_tenure_months)}` });
  if (p.rank && p.rank <= Math.ceil(p.of * 0.25)) t.push({ k: 'profit', label: `Profitable · top ${Math.max(1, Math.ceil(p.rank / p.of * 100))}%`, tip: `${money(p.net)} lifetime net profit\nRank ${p.rank} of ${p.of}` });
  if (p.past.length && p.aov >= AOV_P75) t.push({ k: 'premium', label: `Premium · ${whole(p.aov)} avg order`, tip: `Average order ${money(p.aov)}\nTop 25% of customers by order value` });
  if (!p.past.length || (c.customer_tenure_months < 6 && p.orders <= 3)) t.push({ k: 'new', label: p.past.length ? `New · ${tenureWords(c.customer_tenure_months)}` : 'First order', tip: 'Under 6 months with us. Tenure never decides a refusal (fairness monitor).' });
  if (p.past.length && p.net < 0) t.push({ k: 'watch', label: 'Costs ALDO money', tip: `${money(p.net)} lifetime net profit\nRank ${p.rank} of ${p.of}` });
  return t;
}
const tagHTML = t => `<span class="ctag ctag-${t.k}" data-tip="${esc(t.tip)}">${t.k === 'loyal' ? '★ ' : t.k === 'profit' ? '▲ ' : t.k === 'premium' ? '◆ ' : t.k === 'watch' ? '! ' : ''}${esc(t.label)}</span>`;
const AP_FILTERS = [['all', 'All'], ['pending', 'Waiting'], ['escalated', 'Escalated'], ['soon', 'Due within 1 hour'], ['loyal', '★ Loyal'], ['profit', '▲ Profitable'], ['premium', '◆ Premium'], ['done', 'Decided']];
/** The ids an approver searches by: request, customer, order, return and the product. */
function apKeys(r) { const k = r.case_id && IDX.kase[r.case_id]; const line = k ? caseCtx(r.case_id).line : null; return [r.id, k && k.customer_id, k && k.order_id, k && k.return_id, line && line.product, line && line.sku].filter(Boolean).join(' ').toLowerCase(); }
const apFound = r => !UI.apQuery || UI.apQuery.trim().toLowerCase().split(/\s+/).every(w => apKeys(r).includes(w));
function apMatches(r, f) {
  if (f === 'all') return true;
  if (f === 'pending') return r.status === 'pending';
  if (f === 'done') return r.status !== 'pending';
  const x = slaInfo(r);
  if (f === 'escalated') return r.status === 'pending' && x.escalated;
  if (f === 'soon') return r.status === 'pending' && !x.escalated && x.left < 3600000;
  const k = r.case_id && IDX.kase[r.case_id]; if (!k) return false;
  return custTags(k.customer_id).some(t => t.k === f);
}
function renderApprovals() {
  const el = $('#tab-approvals');
  const all = Object.values(SYS.reviews).filter(r => r.status !== 'superseded');
  for (const r of all) if (!UI.apSeen.has(r.id)) { UI.apSeen.add(r.id); if (!r.queue && r.status === 'pending') UI.apFocus = r.id; }
  const urgency = r => r.status === 'pending' ? slaInfo(r).left : Infinity;
  all.sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || urgency(a) - urgency(b) || b.requested_at - a.requested_at);
  const pend = all.filter(r => r.status === 'pending'), esc8 = pend.filter(r => slaInfo(r).escalated), soon = pend.filter(r => !slaInfo(r).escalated && slaInfo(r).left < 3600000);
  const done = all.filter(r => r.status !== 'pending');
  const human = done.filter(r => !r.auto);
  const avg = human.length ? human.reduce((s2, r) => s2 + (r.decided_at - r.requested_at), 0) / human.length : null;
  const head = `<div class="section-head"><div><div class="eyebrow">People in the loop</div><h2>Approvals</h2><p>Every request the agents couldn't settle alone: over a money limit, suspected abuse, policy appeals and product page changes. Each card shows who asked, when, and how long is left before it escalates. Open a card to see the return, the photos, the product and the customer.</p></div></div>
    <div class="stat-row ap-stats">
      <div class="stat"><div class="l">Waiting</div><div class="v">${pend.length}</div><div class="s">${all.length} requests in total</div></div>
      <div class="stat${esc8.length ? ' alarm' : ''}"><div class="l">Escalated</div><div class="v">${esc8.length}</div><div class="s">Past the time limit</div></div>
      <div class="stat"><div class="l">Due within 1 hour</div><div class="v">${soon.length}</div><div class="s">Tier 1: 4 hours · Tier 2: 2 hours</div></div>
      <div class="stat"><div class="l">Decided</div><div class="v">${done.length}</div><div class="s">${avg != null ? `People took ${fmtLeft(avg)} on average` : done.length ? `${done.length - human.length} settled by the inspection rules` : 'None yet'}</div></div>
    </div>
    <div class="ap-toolbar"><label class="ap-search">${icon('search')}<input type="search" id="ap-q" placeholder="Find by customer ID, order number, return or request" value="${esc(UI.apQuery || '')}" aria-label="Find a request by customer ID, order number, return or request number" autocomplete="off"></label>
    <div class="ap-filters" role="group" aria-label="Filter requests">${AP_FILTERS.map(([k2, l]) => `<button type="button" class="ap-filter" data-apfilter="${k2}" aria-pressed="${UI.apFilter === k2}">${esc(l)} <span>${all.filter(r => apMatches(r, k2) && apFound(r)).length}</span></button>`).join('')}</div></div>`;
  if (UI.apFocus && !all.some(r => r.id === UI.apFocus)) UI.apFocus = null;
  if (UI.apFocus) {
    // One request at a time: only this product's return, photos, product data and customer.
    const order = all.filter(r => apMatches(r, UI.apFilter)), list2 = order.some(r => r.id === UI.apFocus) ? order : all;
    const at = list2.findIndex(r => r.id === UI.apFocus), r = list2[at];
    const prev = list2[(at - 1 + list2.length) % list2.length], next = list2[(at + 1) % list2.length];
    el.innerHTML = `<div class="ap-focusbar"><button type="button" class="btn secondary sm" data-apback="1">← All requests (${all.length})</button>
      <span class="small muted">Request ${at + 1} of ${list2.length}${UI.apFilter !== 'all' ? ` · filter: ${esc(AP_FILTERS.find(f => f[0] === UI.apFilter)[1])}` : ''}</span>
      ${list2.length > 1 ? `<span class="ap-nav"><button type="button" class="btn secondary sm" data-apfocus="${prev.id}" title="${esc(prev.id)}">← Previous</button><button type="button" class="btn secondary sm" data-apfocus="${next.id}" title="${esc(next.id)}">Next →</button></span>` : ''}</div>
      <div class="stack ap-list">${approvalCard(r)}</div>`;
    countUp(el);
    if (CHAT.appr.open) renderApprChat();
    return;
  }
  const shown = all.filter(r => apMatches(r, UI.apFilter) && apFound(r));
  const list = shown.length ? `<div class="stack ap-list">${shown.map(approvalCard).join('')}</div>` : `<div class="empty"><b>Nothing here.</b>${UI.apQuery ? `No request matches "${esc(UI.apQuery)}". Customer IDs look like C-10482, orders like O-58213.` : all.length ? 'Try another filter.' : "Run Jordan's return on the Return tab, or run the Prevention agent to get page fixes."}</div>`;
  el.innerHTML = head + list;
  countUp(el);
  if (CHAT.appr.open) renderApprChat();
}
// The escalation clocks tick in place, without redrawing the page.
setInterval(() => {
  if (STATE.tab !== 'approvals') return;
  document.querySelectorAll('[data-sla]').forEach(n => {
    const r = SYS.reviews[n.dataset.sla]; if (!r || r.status !== 'pending') return;
    const h = slaHTML(r), x = slaInfo(r);
    n.className = `ap-sla ${h.cls}`;
    n.querySelector('.big').textContent = h.big; n.querySelector('.lab').textContent = h.lab; n.querySelector('.small').textContent = h.small;
    n.querySelector('.sla-bar i').style.width = `${(x.used * 100).toFixed(1)}%`;
  });
}, 1000);
function approvalSummary(r, isOpen) {
  const k = r.case_id && IDX.kase[r.case_id];
  const line = k ? caseCtx(r.case_id).line : null;
  const what = line ? `${line.product} · ${money(line.selling_price)}` : r.draft_id ? `${styleName(SYS.drafts[r.draft_id].style_id)} · page note` : r.reason;
  const h = slaHTML(r), x = slaInfo(r);
  const statusPill = r.status === 'pending' ? (x.escalated ? '<span class="pill red">Escalated</span>' : '<span class="pill warn">Waiting</span>') : r.status === 'approved' ? (r.auto ? '<span class="pill ok">Decided automatically</span>' : '<span class="pill ok">Approved</span>') : r.status === 'more_info' ? '<span class="pill info">More info asked</span>' : r.status === 'rejected' ? '<span class="pill neutral">Declined</span>' : '<span class="pill neutral">Closed</span>';
  const thumb = k ? casePhotos(r.case_id)[0] : null;
  const tags = k ? custTags(k.customer_id) : [];
  return `<button type="button" class="ap-sum" data-apopen="${r.id}" aria-expanded="${isOpen}" aria-controls="apd-${r.id}">
    <span class="ap-thumb">${thumb ? (thumb.img ? `<img src="${esc(thumb.img)}" alt="">` : thumb.svg) : `<span class="ap-thumb-ic">${icon(r.kind === 'page_fix' ? 'flag' : 'alert')}</span>`}</span>
    <span class="ap-sum-main">
      <span class="ap-sum-top"><span class="ap-kind">${esc(KIND_LABEL[r.kind] || 'Review')}</span>${statusPill}<span class="pill ${r.tier === 2 ? 'red' : 'neutral'}">Tier ${r.tier || 1} · ${esc(r.approver)}</span></span>
      <span class="ap-what">${esc(what)}</span>
      <span class="ap-meta">
        <span><em>Customer ID</em><b class="mono">${esc(k ? k.customer_id : '—')}</b></span>
        <span><em>Order number</em><b class="mono">${esc(k ? k.order_id : '—')}</b></span>
        <span><em>Requested</em><b>${esc(fmtWhen(r.requested_at))}</b></span>
        <span><em>Request</em><b class="mono">${esc(r.id)}</b></span>
      </span>
      ${tags.length ? `<span class="ap-tags">${tags.map(tagHTML).join('')}</span>` : ''}
      ${r.kind === 'counter' && k && CASES[r.case_id]?.received ? gradeJourney(r.case_id, true) : ''}
      <span class="ap-reason">${esc(r.reason)}</span>
    </span>
    <span class="ap-sla ${h.cls}" ${r.status === 'pending' ? `data-sla="${r.id}"` : ''}><span class="lab">${esc(h.lab || 'Time taken')}</span><span class="big">${esc(h.big)}</span><span class="sla-bar"><i style="width:${(x.used * 100).toFixed(1)}%"></i></span><span class="small">${esc(h.small)}</span></span>
    <span class="ap-chev" aria-hidden="true"></span>
  </button>`;
}
function approvalCard(r) {
  const isOpen = UI.apFocus === r.id;
  const x = slaInfo(r);
  return `<article class="card ap-card${isOpen ? ' open' : ''}${r.status === 'pending' && x.escalated ? ' escalated' : ''}${r.status !== 'pending' ? ' decided' : ''}" id="ap-${r.id}">${approvalSummary(r, isOpen)}
    ${isOpen ? `<div class="ap-detail" id="apd-${r.id}">${approvalDetail(r)}</div>` : ''}</article>`;
}
/** The numbers an approver needs to act in other systems, each with a copy button, then the order itself. */
function apIds(r) {
  const { k, line } = caseCtx(r.case_id), o = IDX.order[k.order_id];
  const ids = [['Customer ID', k.customer_id], ['Order number', k.order_id], ['Return', k.return_id], ['Request', r.id]];
  const late = o && o.delivery_date && o.estimated_delivery_date && o.delivery_date > o.estimated_delivery_date;
  const facts = o ? [
    ['Ordered', `${fmtDate(o.order_date)} · ${o.channel}${o.store_or_ecom ? ' · ' + o.store_or_ecom : ''}`],
    ['Delivered', o.delivery_date ? `${fmtDate(o.delivery_date)}${late ? ` · ${dayNum(o.delivery_date) - dayNum(o.estimated_delivery_date)} days late` : ' · on time'}` : 'Not yet'],
    ['Item', `${line.product} · ${line.colour} · size ${line.size}${line.width === 'W' ? ' wide' : ''} · ${line.sku}`],
    ['Paid', `${money(line.selling_price)}${line.discount ? ` after ${money(line.discount)} off` : ''}${line.promotion ? ` · ${line.promotion}` : ''}${line.final_sale ? ' · final sale' : ''}`],
    ['Shipping', `${o.shipping_method || 'Standard'}${o.shipping_cost ? ` · ${money(o.shipping_cost)}` : ' · free'}${o.fulfilment_location ? ` · from ${o.fulfilment_location}` : ''}`],
  ] : [];
  return `<div class="ap-ids">${ids.map(([l, v]) => `<div class="ap-id"><em>${esc(l)}</em><span><b class="mono">${esc(v)}</b><button type="button" class="ap-copy" data-copy="${esc(v)}" aria-label="Copy ${esc(l.toLowerCase())} ${esc(v)}" title="Copy">${icon('copy')}</button></span></div>`).join('')}</div>
    ${facts.length ? `<details class="ap-order"><summary><span class="eyebrow">Order ${esc(k.order_id)}</span><span class="small muted">${esc(facts[0][1])} · ${esc(facts[3][1])}</span></summary><dl class="kv">${facts.map(([l, v]) => `<dt>${esc(l)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details>` : ''}`;
}
/** Packed → customer's photo → store check, as three grade chips. */
function gradeJourney(caseId, compact) {
  const k = IDX.kase[caseId], rc = CASES[caseId].received;
  const steps = [['Packed', 'A'], ["Customer's photo", k.photo.grade], ['Store check', rc.grade]];
  return `<span class="gj${compact ? ' compact' : ''}">${steps.map(([l, g], i) => `<span class="gj-step"><em>${esc(l)}</em><b class="gr gr-${g}">${g}</b></span>${i < 2 ? `<span class="gj-arrow${steps[i + 1][1] > g ? ' worse' : ''}">→</span>` : ''}`).join('')}</span>`;
}
/** The three photo sets side by side, each with its grade. */
function photoCompare(caseId) {
  const k = IDX.kase[caseId], rc = CASES[caseId].received;
  const col = (set, grade, who, sub) => `<div class="pc-col"><div class="pc-head"><span class="eyebrow">${esc(PHOTO_SETS[set])}</span><b class="gr gr-${grade}">${grade}</b></div><div class="small muted">${esc(who)}</div>${photoStrip(caseId, { set, small: true })}<div class="small">${esc(sub)}</div></div>`;
  return `<section class="ap-photos">${groupHead('ret', 'Photos: packing, customer and store', 'The same pair three times. Click any photo to look closer; the grade is in the corner of each column.')}
    <div class="pc-grid">${col('packing', 'A', 'Distribution centre quality check, before shipping', 'Unworn, sole bond and stitching checked.')}${col('customer', k.photo.grade, `Sent by the customer with the return (${k.photo.file})`, (k.photo.findings || []).join('; '))}${col('store', rc.grade, `Taken by store staff at ${IDX.loc[rc.store]?.name || 'the store'}`, GRADE[rc.grade])}</div>
    <div class="pc-verdict">${gradeJourney(caseId)}<span class="small">${rc.grade > k.photo.grade ? `The pair got worse between the customer's photo and the store check: grade ${k.photo.grade} → ${rc.grade}.` : 'The store check matches the photo.'}</span></div></section>`;
}
/** What the approver can do after a store-check mismatch, valued, with the best one recommended. */
function inspectionPanel(r) {
  const co = counterOptions(r.case_id), id = r.case_id;
  const valued = co.options.filter(o => o.value != null);
  const rows = valued.map(o => ({ label: o.label, value: o.value, hl: o.best, tip: [`${money(o.value)} to ALDO`, o.label].concat(breakLines(o.breakdown)).join('\n') }));
  const pending = r.status === 'pending';
  return `<div class="econ">${groupHead('ret', 'Updated decision after the store check', `Valued at the grade the store found (${co.found}), not the photo grade`)}
    <div class="reco"><div class="eyebrow">${icon('check')}Recommended</div><div class="reco-main"><b>★ ${esc(co.best.label)}</b><span>${co.best.value != null ? `ALDO keeps <b>${money(co.best.value)}</b> on this return.` : ''}</span></div>
      <p class="small" style="margin:0">${esc(co.why)}</p>${pending ? `<button type="button" class="btn sm" data-review="${r.id}" data-choice="${co.best.key}">${esc(co.best.label)}</button>` : ''}</div>
    ${rows.length > 1 ? vizCard(`ins:${id}`, 'Profit to ALDO, by option', '', catForms(rows, { heatCol: 'Profit to ALDO' }), 'Each option valued at the grade the store found. Taking the pair back at grade C brings little back from liquidation; declining keeps the sale but costs a shipment back.') : ''}
    <div class="eyebrow" style="margin-top:12px">${pending ? 'Pick an option: every one is allowed by the rule shown' : 'The options and the rule that allows each'}</div>
    <ul class="opt-rules">${co.options.map(o => { const inner = `<span class="or-top"><b>${o.best ? '★ ' : ''}${esc(o.label)}</b>${o.value != null ? ` <span class="mono small">${money(o.value)}</span>` : ''}${pending ? `<span class="or-go">${o.best ? 'Choose the recommended option' : 'Choose'} →</span>` : ''}</span><span class="small">${esc(o.note)}</span><span class="small muted">${esc(o.rule)}</span>`;
      return `<li>${pending ? `<button type="button" class="or-btn${o.best ? ' best' : ''}" data-review="${r.id}" data-choice="${o.key}">${inner}</button>` : `<div class="or-btn static${r.decision === o.key ? ' chosen' : ''}">${inner}${r.decision === o.key ? '<span class="pill ok">Chosen</span>' : ''}</div>`}</li>`; }).join('')}</ul>
    ${co.held ? `<p class="small" style="margin:8px 0 0"><span class="pill warn">On hold: ${esc(co.held.what)}</span> Nothing is paid or shipped until someone decides (R11, R13).</p>` : ''}
  </div>`;
}
function approvalDetail(r) {
  const ctxLine = r.case_id ? (() => { const { k, line } = caseCtx(r.case_id); return `${k.return_id} · ${line.product} · ${line.colour} · size ${line.size} · ${money(line.selling_price)}${line.final_sale ? ' · final sale' : ''} · customer ${k.customer_id}`; })() : (r.draft_id ? `${styleName(SYS.drafts[r.draft_id].style_id)} · ${SYS.drafts[r.draft_id].sizes}` : '');
  let actions = '';
  if (r.status === 'pending') {
    if (r.kind === 'case') {
      const co = r.case_id && IDX.kase[r.case_id] ? creditOptions(r.case_id).options : [{ key: 'approve_credit', label: 'Store credit' }];
      actions = `<button type="button" class="btn sm" data-review="${r.id}" data-choice="approve_refund">Approve refund ${money(r.amount)}</button>${co.map(o => `<button type="button" class="btn secondary sm${o.best ? ' best' : ''}" data-review="${r.id}" data-choice="${o.key}">${o.best ? '★ ' : ''}Offer ${esc(o.label.replace(/^Store credit/, 'store credit'))}</button>`).join('')}<button type="button" class="btn secondary sm" data-review="${r.id}" data-choice="decline">Decline: item is worn (§2.4)</button><button type="button" class="btn secondary sm" data-review="${r.id}" data-choice="more_info">Ask for more photos</button>`;
    }
    else if (r.kind === 'action') actions = `<button type="button" class="btn sm" data-review="${r.id}" data-choice="approve">Approve</button><button type="button" class="btn secondary sm" data-review="${r.id}" data-choice="reject">Reject</button>`;
    else if (r.kind === 'policy') actions = `<button type="button" class="btn sm" data-review="${r.id}" data-choice="uphold">Uphold the policy</button><button type="button" class="btn secondary sm" data-review="${r.id}" data-choice="exception">Make an exception: refund</button>`;
    else if (r.kind === 'page_fix') actions = `<button type="button" class="btn sm" data-review="${r.id}" data-choice="approve">Approve and publish</button><button type="button" class="btn secondary sm" data-review="${r.id}" data-choice="reject">Reject</button>`;
    else if (r.kind === 'chat') actions = `<button type="button" class="btn sm" data-review="${r.id}" data-choice="resolve">Mark as answered</button>`;
    else if (r.kind === 'counter') actions = counterOptions(r.case_id).options.map(o => `<button type="button" class="btn ${o.best ? '' : 'secondary '}sm" data-review="${r.id}" data-choice="${o.key}">${o.best ? '★ ' : ''}${esc(o.label)}</button>`).join('');
  }
  const k0 = r.case_id && IDX.kase[r.case_id];
  const decisionCol = `<div class="stack ap-main">
      ${r.case_id && IDX.kase[r.case_id] ? apIds(r) : ctxLine ? `<div class="small mono muted">${esc(ctxLine)}</div>` : ''}
      ${k0 && k0.words ? `<div><div class="eyebrow">The customer said</div><blockquote class="ap-words">${esc(k0.words)}</blockquote></div>` : ''}
      <div><div class="eyebrow">Why it's here</div><div>${esc(r.reason)}</div></div>
      <div><div class="eyebrow">${esc(r.requested_by || 'Agent')} recommends</div><div>${esc(r.recommendation)}</div></div>
      ${r.evidence && r.evidence.length ? `<div><div class="eyebrow">Evidence</div><ul class="evi">${r.evidence.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${r.kind === 'page_fix' && r.draft_id ? `<div><span class="page-note">${esc(SYS.drafts[r.draft_id].note)}</span></div>` : ''}
      ${r.decision ? `<div class="small"><b>Decision:</b> ${esc(r.decided_by || r.approver)} ${esc(REVIEW_WORD[r.decision] || String(r.decision).replace(/_/g, ' '))}</div>` : ''}
      ${actions ? `<div class="ap-actions">${actions}</div>` : ''}</div>`;
  if (!k0) return decisionCol;
  const { k } = caseCtx(r.case_id);
  const prof = customerProfile(k.customer_id);
  const sum = prof.past.length ? `${prof.c.loyalty_status} · ${prof.orders} orders · net ${money(prof.net)} · rank ${prof.rank} of ${prof.of}` : `${prof.c.loyalty_status} · first order`;
  const credit = r.kind === 'case' ? creditPanel(r) : '';
  if (r.kind === 'counter') return `<div class="ap-grid">${decisionCol}${inspectionPanel(r)}</div>
    ${photoCompare(r.case_id)}
    <details class="ap-sec" open><summary>${groupHead('prod', `${caseCtx(r.case_id).line.product}, across all customers`, 'Why people send this style back, and how often compared with similar styles')}</summary>${productPanel(r.case_id)}</details>
    <details class="ap-sec ap-cust" open><summary>${groupHead('cust', `Customer ${k.customer_id}`, sum)}</summary>${customerPanel(k.customer_id)}</details>`;
  return `<div class="ap-grid">${decisionCol}${econPanel(r)}</div>
    <section class="ap-photos">${groupHead('ret', 'Photos the customer sent', k.photo.grade ? `Photo check: grade ${k.photo.grade}${k.photo.consistent === false ? ", and the photos don't match what the customer said" : ''}. Click a photo to look closer.` : 'Click a photo to look closer.')}${photoStrip(r.case_id, { empty: 'No photo was attached to this return.' })}</section>
    <div class="ap-pair${credit ? '' : ' one'}">${credit}${resalePanel(r.case_id)}</div>
    <details class="ap-sec" open><summary>${groupHead('prod', `${caseCtx(r.case_id).line.product}, across all customers`, 'Why people send this style back, and how often compared with similar styles')}</summary>${productPanel(r.case_id)}</details>
    <details class="ap-sec ap-cust" open><summary>${groupHead('cust', `Customer ${k.customer_id}`, sum)}</summary>${customerPanel(k.customer_id)}</details>`;
}
const REASON_WORD = { fit: 'Fit', change_of_mind: 'Changed their mind', quality: 'Quality problem', expectations: 'Not as expected', damage: 'Arrived damaged', late: 'Arrived late' };
const reasonWord = k => REASON_WORD[k] || String(k).replace(/_/g, ' ');
/** Store credit variants, valued, with the best one recommended. */
function creditPanel(r) {
  const id = r.case_id, co = creditOptions(id), best = co.best;
  const rows = co.options.map(o => ({ label: o.label, value: o.value, hl: o.best, sub: `${pct(o.use)} likely spent${o.best ? ' · best' : ''}`,
    tip: [`${money(o.value)} to ALDO`, o.label, `${signed(o.vs_refund)} vs a refund`].concat(breakLines(o.breakdown)).join('\n') }))
    .concat([{ label: 'Refund, for comparison', value: co.refund, sub: 'money back to the card', tip: `${money(co.refund)} to ALDO\nA full refund of ${money(returnEconomics(id).price)}` }]);
  const pending = r.status === 'pending';
  const reco = `<div class="reco"><div class="eyebrow">${icon('check')}Recommended if you offer credit</div>
    <div class="reco-main"><b>★ ${esc(best.label)}</b><span>ALDO expects to make <b>${money(best.value)}</b> on this return, <b class="${best.vs_refund >= 0 ? 'up' : 'down'}">${signed(best.vs_refund)}</b> compared with a refund.</span></div>
    <p class="small" style="margin:0">${esc(best.note)}</p>
    ${pending ? `<button type="button" class="btn sm" data-review="${r.id}" data-choice="${best.key}">Offer ${esc(best.label.replace(/^Store credit/, 'store credit'))}</button>` : ''}</div>`;
  return `<section class="ap-col">${groupHead('ret', 'Store credit options', 'Instead of a refund: what each kind of credit is likely to earn ALDO')}
    ${vizCard(`cr:${id}`, 'Expected profit to ALDO, by credit option', '', catForms(rows, { heatCol: 'Profit to ALDO' }).filter(f => f.id !== 'heat').concat([
      { id: 'scatter', render: () => scatterSVG(co.options.map(o => ({ x: o.use, y: o.value, label: o.label, hl: o.best, tip: `${o.label}\n${pct(o.use)} likely spent · ${money(o.value)} to ALDO` })), { x: { label: 'Share of the credit likely to be spent', fmt: v => pct(v), zero: false }, y: { label: 'Profit to ALDO', fmt: compactMoney } }), note: 'Scatter: further right means more of the credit gets spent; higher means more profit. A bonus moves a point right but costs money.' },
      { id: 'heat', render: () => { const cols = [['margin_kept', 'Margin kept', 1], ['returned_pair_resold', 'Pair resold', 1], ['label', 'Label', -1], ['processing', 'Processing', -1], ['incentive_cost', 'Bonus cost', -1]];
          return heatHTML({ corner: 'Option', rows: co.options.map(o => o.label), cols: cols.map(c => c[1]).concat(['Total']), fmt: v => signed(v), cells: co.options.map(o => cols.map(([k2, , sg]) => ({ v: r2(sg * (o.breakdown[k2] || 0)), tip: `${o.label}\n${cols.find(c => c[0] === k2)[1]}: ${signed(sg * (o.breakdown[k2] || 0))}` })).concat([{ v: o.value, tip: `${o.label}\nTotal ${money(o.value)}` }])) }); },
        note: 'Heatmap: each option broken into what it earns and what it costs. Deeper colour is a bigger amount; red cells are costs.' }]),
      `Each mark is the profit ALDO expects to keep: the margin on credit that gets spent, plus what the returned pair resells for, minus the label, processing and any bonus. The highlighted option is the recommendation; the refund shows what the customer asked for.`, tableView(['Option', 'Profit to ALDO', 'vs refund', 'Likely spent', 'Bonus'], co.options.map(o => [o.label, money(o.value), signed(o.vs_refund), pct(o.use), o.bonus ? money(o.bonus) : '—']).concat([['Refund', money(co.refund), '—', '—', '—']]), [0, 1, 1, 1, 1]))}
    ${reco}
    <ul class="econ-notes small">${co.options.map(o => `<li><b>${esc(o.label)}.</b> ${esc(o.note)}</li>`).join('')}</ul>
  </section>`;
}
/** Where the returned pair can be resold, by the condition it arrives in. */
function resalePanel(id) {
  const ro = resaleOptions(id);
  const rows = ro.rows.map(x => ({ label: x.name, sub: `Grade ${x.grade}${x.expected ? ' · expected' : ''}${x.grade === 'A' ? ` · ${pct(x.p)} sells in 4 wks` : ''}`, value: x.value, hl: x.expected,
    tip: [`${money(x.value)} expected back`, `${x.name} · grade ${x.grade}`, x.why, x.cost ? `Transfer ${money(x.cost)}` : 'No transfer cost', x.p != null ? `${pct(x.p)} chance it sells within 4 weeks` : ''].filter(Boolean).join('\n') }));
  return `<section class="ap-col">${groupHead('ret', 'Where to resell this pair', `The photo says grade ${ro.grade}: ${GRADE[ro.grade]}`)}
    ${vizCard(`rs:${id}`, 'Expected resale value, by destination', '', catForms(rows, { heatCol: 'Expected back' }).filter(f => f.id !== 'heat').concat([
      { id: 'scatter', render: () => scatterSVG(ro.rows.map(x => ({ x: x.p ?? 0, y: x.value, label: x.name, hl: x.expected, fill: x.grade === 'A' ? null : 'var(--cat-3)', tip: `${x.name} · grade ${x.grade}\n${pct(x.p ?? 0)} sells in 4 weeks · ${money(x.value)} back` })), { x: { label: 'Chance it sells within 4 weeks', fmt: v => pct(v), zero: true }, y: { label: 'Expected back', fmt: compactMoney } }), note: 'Scatter: grey points are like-new destinations, coloured points are for worse grades. Up and to the right is best.' },
      { id: 'heat', render: () => { const lists = Object.fromEntries(['A', 'B', 'C', 'D'].map(g => [g, routeScores(id, g, ro.origin)])); const names = [...new Set(ro.rows.map(x => x.name))];
          return heatHTML({ corner: 'Destination', rows: names, cols: ['Grade A', 'Grade B', 'Grade C', 'Grade D'], fmt: v => money(v), cells: names.map(n => ['A', 'B', 'C', 'D'].map(g => { const s2 = lists[g].find(x => x.name === n); return s2 ? { v: s2.score, tip: `${n} · grade ${g}\n${money(s2.score)} expected back\n${s2.why}` } : { v: null, tip: `${n} · grade ${g}\nDoesn't take a pair in this condition` }; })) }); },
        note: 'Heatmap: every destination against every condition the counter could find. A dash means that destination does not take a pair in that condition.' }]),
      `Like-new pairs go to the store most likely to sell them at full price within four weeks, minus the transfer cost. Worse grades have one place each. The highlighted destination is where it goes if the counter confirms grade ${esc(ro.grade)}.`, tableView(['Destination', 'Grade', 'Expected back', 'Sells in 4 wks', 'Transfer'], ro.rows.map(x => [x.name, x.grade, money(x.value), x.p != null ? pct(x.p) : '—', x.cost ? money(x.cost) : '$0.00']), [0, 0, 1, 1, 1]))}
  </section>`;
}
/** This style across all customers: return reasons and return rate against its category. */
function productPanel(id) {
  const { line } = caseCtx(id), sid = line.style_id, st = IDX.style[sid];
  const recent = IDX.retByStyle[sid] || [];
  const earlier = HIST_ROWS.filter(h => h.style_id === sid && RETURNED.includes(h.outcome));
  const by = {};
  for (const x of recent) { const g = by[x.return_reason] = by[x.return_reason] || { recent: 0, earlier: 0, subs: {} }; g.recent++; if (x.return_sub_reason && x.return_sub_reason !== x.return_reason) g.subs[x.return_sub_reason] = (g.subs[x.return_sub_reason] || 0) + 1; }
  for (const h of earlier) { const g = by[h.return_reason] = by[h.return_reason] || { recent: 0, earlier: 0, subs: {} }; g.earlier++; }
  const reasons = Object.entries(by).map(([k, g]) => ({ k, ...g, n: g.recent + g.earlier })).sort((a, b) => b.n - a.n);
  const total = reasons.reduce((s, x) => s + x.n, 0);
  const subWords = g => Object.entries(g.subs).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s, n]) => `${s.replace(/_/g, ' ')} ${n}`).join(' · ');
  const reasonRows = reasons.map(x => ({ label: reasonWord(x.k), sub: subWords(x) || (x.k === 'damage' ? 'damage claims' : ''), value: x.n, hl: reasons[0] === x,
    tip: [`${x.n} return${x.n > 1 ? 's' : ''} · ${pct(x.n / total)} of this style's returns`, reasonWord(x.k), `${x.recent} in the last 28 days, ${x.earlier} earlier`].concat(subWords(x) ? [subWords(x)] : []).join('\n') }));
  const reasonForms = total ? catForms(reasonRows, { fmt: v => String(v), barFmt: v => `${v} (${pct(v / total)})`, tick: v => String(v), pie: true, center: String(total), centerSub: 'returns', heat: false }).concat([
    { id: 'heat', render: () => heatHTML({ corner: 'Reason', rows: reasons.map(x => reasonWord(x.k)), cols: ['Last 28 days', 'Earlier', 'All'], fmt: v => String(v), cells: reasons.map(x => [{ v: x.recent }, { v: x.earlier }, { v: x.n }]) }), note: 'Heatmap: reasons against when the return happened. A reason that is dark in the last 28 days is getting worse.' }])
    : [{ id: 'bar', render: () => '<p class="small muted" style="margin:6px 0 0">No returns of this style yet.</p>' }];
  const units = IDX.units28[sid] || 0;
  const peers = DATA.catalogue.filter(s => s.category === st.category && s.style_id !== sid);
  const pUnits = peers.reduce((s, p) => s + (IDX.units28[p.style_id] || 0), 0);
  const pAll = peers.reduce((s, p) => s + (IDX.retByStyle[p.style_id] || []).length, 0);
  const pFit = peers.reduce((s, p) => s + (IDX.retByStyle[p.style_id] || []).filter(x => x.return_reason === 'fit').length, 0);
  const fit = recent.filter(x => x.return_reason === 'fit').length;
  const rate = units ? recent.length / units : 0, fitRate = units ? fit / units : 0, cAll = pUnits ? pAll / pUnits : 0, cFit = pUnits ? pFit / pUnits : 0;
  const rateRows = [
    { label: 'This style, any reason', value: rate, hl: true, tip: `${pct(rate, 1)} returned\n${recent.length} of ${units} sold in 28 days` },
    { label: `Other ${st.category.toLowerCase()}, any reason`, value: cAll, tip: `${pct(cAll, 1)} returned\n${pAll} of ${pUnits} sold across ${peers.length} similar styles` },
    { label: 'This style, fit only', value: fitRate, hl: true, tip: `${pct(fitRate, 1)} returned for fit\n${fit} of ${units} sold` },
    { label: `Other ${st.category.toLowerCase()}, fit only`, value: cFit, tip: `${pct(cFit, 1)} returned for fit\n${pFit} of ${pUnits} sold` },
  ];
  const words = recent.filter(x => x.customer_words).slice(0, 3).map(x => x.customer_words);
  return `<div class="cust-charts prod-charts">
    ${vizCard(`pd:${id}`, 'Returns of this style, by reason', `${total} returns from every customer, not just this one`, reasonForms,
      `Counts every return of the ${esc(line.product)}: the last 28 days of returns plus earlier returns in customers' order histories. The small text under a reason names the most common detail. A reason that dominates points at the product, not the customer.`, total ? tableView(['Reason', 'Last 28 days', 'Earlier', 'Total', 'Share'], reasons.map(x => [reasonWord(x.k), String(x.recent), String(x.earlier), String(x.n), pct(x.n / total)]), [0, 1, 1, 1, 1]) : '')}
    ${(() => { const styles = DATA.catalogue.filter(s2 => s2.category !== 'Accessories' && IDX.units28[s2.style_id]).map(s2 => ({ s: s2, u: IDX.units28[s2.style_id], r: (IDX.retByStyle[s2.style_id] || []).length / IDX.units28[s2.style_id] }));
      return vizCard(`pr2:${id}`, 'Return rate against similar styles', `Last 28 days · ${units} sold`, catForms(rateRows, { fmt: v => pct(v, 1), tick: v => pct(v), heat: false }).concat([
        { id: 'scatter', render: () => scatterSVG(styles.map(x => ({ x: x.u, y: x.r, label: x.s.style_id === sid ? line.product : '', hl: x.s.style_id === sid, fill: x.s.category === st.category && x.s.style_id !== sid ? 'var(--cat-1)' : null, tip: `${styleName(x.s.style_id)} · ${x.s.category}\n${x.u} sold · ${pct(x.r, 1)} returned` })), { x: { label: 'Units sold, last 28 days', fmt: v => String(Math.round(v)), zero: true }, y: { label: 'Return rate', fmt: v => pct(v) } }), note: `Scatter: every style we sell. Coloured points are other ${st.category.toLowerCase()}; the labelled point is this one. High and to the right is a popular style that comes back a lot.` },
        { id: 'hist', render: () => histSVG(styles.map(x => x.r), { fmt: v => pct(v), mark: rate, markLabel: 'This style', unit: 'styles', xLabel: 'Return rate, any reason', bins: 7 }), note: 'Histogram: how many styles fall in each return-rate band. The dashed line is this style.' },
        { id: 'heat', render: () => heatHTML({ corner: '', rows: ['This style', `Other ${st.category.toLowerCase()}`], cols: ['Any reason', 'Fit only'], fmt: v => pct(v, 1), cells: [[{ v: rate }, { v: fitRate }], [{ v: cAll }, { v: cFit }]] }), note: 'Heatmap: the four rates in a grid. Compare the rows.' }]),
        `How often this style comes back compared with the other ${esc(st.category.toLowerCase())} we sell. A highlighted value well past its muted partner means the style itself has a problem, which the Prevention agent looks into.`, tableView(['Measure', 'Rate'], rateRows.map(x => [x.label, pct(x.value, 1)]), [0, 1])); })()}
    ${words.length ? `<div class="said small"><div class="eyebrow">What customers said</div>${words.map(w => `<q>${esc(w)}</q>`).join('')}</div>` : ''}
  </div>`;
}
/** The forms that suit one list of labelled numbers. */
function catForms(rows, o = {}) {
  const fmt = o.fmt || money;
  const f = [{ id: 'bar', render: () => hbars(rows, { fmt: o.barFmt || fmt }) },
    { id: 'col', render: () => colsSVG(rows, { fmt, tick: o.tick }), note: 'Columns: the same numbers standing up, with the value on top.' }];
  if (o.pie && rows.every(r => r.value >= 0) && rows.filter(r => r.value > 0).length > 1) f.push({ id: 'pie', render: () => pieSVG(rows, { fmt, center: o.center, centerSub: o.centerSub }), note: 'Pie: each slice is its share of the total.' });
  f.push({ id: 'dot', render: () => hbars(rows, { fmt: o.barFmt || fmt, cls: 'lolli' }), note: 'Dots: the dot marks the value.' });
  if (o.heat !== false) f.push({ id: 'heat', render: () => heatStrip(rows, fmt, o.heatCol), note: 'Heatmap: deeper colour is a bigger number; red is money lost.' });
  return f;
}
const monthKey = iso => iso.slice(0, 7);
/** The customer's order history: timeline, scatter by price, price histogram, and a period × outcome heatmap. */
function timelineForms(p) {
  const rows = p.rows, cur = rows.find(r => r.outcome === 'return in progress');
  const kind = r => r.outcome === 'return in progress' ? 'This return' : RETURNED.includes(r.outcome) ? (r.damage_claim ? 'Damage claim' : 'Returned') : 'Kept';
  const fillOf = { Kept: null, Returned: 'var(--cat-1)', 'Damage claim': 'var(--cat-3)', 'This return': 'var(--panel)' };
  const dfmt = v => new Date(v * 864e5).toLocaleDateString('en-CA', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const span = dayNum(rows[rows.length - 1].order_date) - dayNum(rows[0].order_date);
  const per = span > 540 ? (iso => `${iso.slice(0, 4)} Q${Math.floor((+iso.slice(5, 7) - 1) / 3) + 1}`) : (iso => dfmt(dayNum(iso.slice(0, 7) + '-01')));
  const periods = [...new Set(rows.map(r => per(r.order_date)))];
  const kinds = ['Kept', 'Returned', 'Damage claim', 'This return'].filter(k2 => rows.some(r => kind(r) === k2));
  const legend = `<div class="legend-row small viz-legend">${kinds.map(k2 => `<span><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="${fillOf[k2] || 'var(--chart-2)'}" stroke="${k2 === 'This return' ? 'var(--red)' : 'none'}" stroke-width="2"/></svg>${esc(k2)}</span>`).join('')}</div>`;
  return [
    { id: 'time', render: () => timelineSVG(p), note: 'Timeline: top row kept, bottom row sent back. Diamonds are damage claims; hollow marks are claims inspection did not confirm; the red ring is the return waiting for you.' },
    { id: 'scatter', render: () => scatterSVG(rows.map(r => ({ x: dayNum(r.order_date), y: r.price_paid, fill: fillOf[kind(r)], stroke: kind(r) === 'This return' ? 'var(--red)' : (r.inspection === 'did not match' ? 'var(--red)' : null), hl: false,
        tip: `${r.product} · ${money(r.price_paid)}\n${fmtDate(r.order_date)} · ${kind(r).toLowerCase()}${r.inspection === 'did not match' ? '\nInspection did not match the claim' : ''}` })), { x: { label: 'Order date', fmt: dfmt, zero: false }, y: { label: 'Price paid', fmt: compactMoney } }) + legend,
      note: 'Scatter: each order by date and price. A red outline means inspection did not find what the customer described. Watch for returns clustered at the expensive end.' },
    { id: 'hist', render: () => histSVG(rows.map(r => r.price_paid), { fmt: compactMoney, mark: cur ? cur.price_paid : null, markLabel: 'This return', unit: 'orders', xLabel: 'Price paid per order', bins: 6 }), note: 'Histogram: how many orders fall in each price band. The dashed line is the item being returned now.' },
    { id: 'heat', render: () => heatHTML({ corner: span > 540 ? 'Quarter' : 'Month', rows: periods, cols: kinds, fmt: v => String(v), cells: periods.map(pp => kinds.map(k2 => { const n = rows.filter(r => per(r.order_date) === pp && kind(r) === k2).length; return { v: n || null, tip: `${pp} · ${k2}\n${n} order${n === 1 ? '' : 's'}` }; })) }), note: 'Heatmap: orders per period by what happened to them. A column that darkens over time is a habit forming.' },
  ];
}
function econPanel(r) {
  const id = r.case_id, e = returnEconomics(id), d = CASES[id] && CASES[id].decision;
  const choices = choiceValues(r);
  return `<div class="econ">
    ${groupHead('ret', 'What this pair is worth', `${caseCtx(id).line.product} · the item waiting for approval`)}
    <div class="stat-row econ-tiles">
      <div class="stat"><div class="l">Price paid</div><div class="v">${money(e.price)}</div>${e.price < e.list - 0.004 ? `<div class="s">List price ${money(e.list)}</div>` : '<div class="s">Full price</div>'}</div>
      <div class="stat"><div class="l">Our cost</div><div class="v">${money(e.cost)}</div><div class="s">What ALDO paid for the pair</div></div>
      <div class="stat"><div class="l">Gross margin</div><div class="v">${money(e.margin)}</div><div class="s">${pct(e.margin_pct)} of the price paid</div></div>
    </div>
    ${(() => { const parts = [{ label: 'Our cost', value: e.cost, tip: `${money(e.cost)} our cost\nWhat ALDO paid for this pair` }, { label: 'Gross margin', value: e.margin, tip: `${money(e.margin)} gross margin\n${pct(e.margin_pct)} of the price paid` }];
      return vizCard(`pr:${id}`, 'Price paid, split into our cost and margin', '', [
        { id: 'split', render: () => priceSplit(e) },
        { id: 'pie', render: () => pieSVG(parts, { fmt: money, center: money(e.price), centerSub: 'price paid' }), note: 'Pie: the whole circle is the price paid.' },
        { id: 'col', render: () => colsSVG(parts, { fmt: money }), note: 'Columns: cost and margin side by side.' }],
        'The whole is what the customer paid. One part is what ALDO paid the supplier; the other is the margin ALDO loses if the money goes back.'); })()}
    ${choices.length ? `${(() => { const rows = choices.map(c => ({ label: c.label, value: c.value, tip: [`${money(c.value)} to ALDO`, c.label].concat(breakLines(c.breakdown)).join('\n') }));
      return vizCard(`ch:${r.id}`, 'Profit to ALDO, by decision', '', catForms(rows, { heatCol: 'Profit to ALDO' }),
        'Each mark is what ALDO ends up with on this return for that decision, after resale, shipping and processing. Below zero means the decision costs money.'); })()}
      <ul class="econ-notes small">${choices.map(c => `<li><b>${esc(c.label)}.</b> ${esc(c.note || '')}</li>`).join('')}</ul>
      <p class="small" style="margin:8px 0 0"><b>The evidence decides, not the value.</b> These numbers show the cost of each choice; they never make it.</p>
      ${tableView(['Choice', 'Value to ALDO', 'Margin kept', 'Pair resold', 'Label', 'Processing'], choices.map(c => { const b = c.breakdown || {}; return [c.label, money(c.value), money(b.margin_kept || 0), money(b.returned_pair_resold || 0), b.label ? '−' + money(b.label) : '$0.00', b.processing ? '−' + money(b.processing) : '$0.00']; }), [0, 1, 1, 1, 1, 1])}` : ''}
    <dl class="kv econ-kv">
      <dt>Photo</dt><dd>Grade ${esc(e.grade)}: ${esc(GRADE[e.grade])}</dd>
      <dt>Returned pair</dt><dd>${esc(e.route.name)}, worth ${money(e.recovery)} back</dd>
      ${d && d.eligibility && d.eligibility.clause ? `<dt>Policy</dt><dd>${esc(d.eligibility.clause)} ${esc(d.eligibility.note || '')}</dd>` : ''}
      ${d && d.reason_code ? `<dt>Reason</dt><dd>${esc(d.reason_code.replace(/_/g, ' '))}${d.sub_reason ? ' · ' + esc(d.sub_reason.replace(/_/g, ' ')) : ''}</dd>` : ''}
    </dl>
    <p class="small muted" style="margin:6px 0 0">Value = margin kept + returned pair resold − label − shipping − processing − incentive − second-return risk, from the same calculator as the Return tab.</p>
  </div>`;
}
const tenureWords = m => m <= 0 ? 'new this month' : m < 12 ? `${m} month${m > 1 ? 's' : ''}` : `${Math.floor(m / 12)} yr${m >= 24 ? 's' : ''}${m % 12 ? ` ${m % 12} mo` : ''}`;
function customerSignals(p) {
  const watch = [], favour = [];
  if (p.claims_90d >= 2) watch.push(`${p.claims_90d} damage claims in the last 90 days`);
  if (p.inspected && p.genuine_share < 0.75) watch.push(`${p.inspected - p.matched} of ${p.inspected} inspections didn't match what they said`);
  if (p.return_rate > 2 * p.avg_return_rate && p.returns >= 2) watch.push(`returns ${(p.return_rate / p.avg_return_rate).toFixed(1)}× the average rate`);
  if (p.past.length && p.net < 0) watch.push('costs ALDO money overall');
  if (['Gold', 'Silver'].includes(p.c.loyalty_status) && p.tenure >= 12) favour.push(`${p.c.loyalty_status} member for ${tenureWords(p.tenure)}`);
  if (p.inspected && p.genuine_share === 1) favour.push(`every inspected return matched what they said`);
  if (p.rank && p.rank <= Math.ceil(p.of * 0.25)) favour.push(`in the top 25% of customers by value`);
  if (p.past.length >= 5 && p.returns === 0) favour.push('never returned anything');
  return { watch, favour };
}
function customerPanel(cid) {
  const p = customerProfile(cid); if (!p) return '';
  const c = p.c, isNew = !p.past.length;
  const rankWord = p.rank ? (p.rank <= p.of * 0.5 ? `top ${Math.max(1, Math.ceil(p.rank / p.of * 100))}%` : `bottom ${Math.max(1, Math.ceil((p.of - p.rank + 1) / p.of * 100))}%`) : 'no history yet';
  const tiles = [
    ['Loyalty', c.loyalty_status, `${tenureWords(c.customer_tenure_months)} · ${c.region}`],
    ['Orders', String(p.orders), `${whole(p.spend)} spent · ${whole(p.aov)} average`],
    ['Returns', `${p.returns} (${pct(p.return_rate, 1)})`, `All customers: ${pct(p.avg_return_rate, 1)}`],
    ['Damage claims, 90 days', String(p.claims_90d), p.claims_all ? `${p.claims_all} in total · ${p.claims_matched} confirmed` : 'None, ever'],
    ['Genuine returns', p.genuine_share == null ? '—' : pct(p.genuine_share), p.inspected ? `${p.matched} of ${p.inspected} inspections matched` : 'Nothing inspected yet'],
    ['Net profit', isNew ? '—' : money(p.net), isNew ? 'First order' : `Margin ${whole(p.margin)} − returns ${whole(p.handling + p.lost)}`],
    ['Value rank', p.rank ? `${p.rank} of ${p.of}` : '—', rankWord],
    ['Store credit', c.credit_issued ? `${c.credit_issued} issued` : 'None', c.credit_issued ? `${c.credit_used} used${c.credit_returned ? ` · ${c.credit_returned} purchase came back` : ''}` : 'Never had store credit'],
  ];
  const sig = customerSignals(p);
  const tilesHTML = `<div class="cust-tiles">${tiles.map(t => `<div class="stat"><div class="l">${esc(t[0])}</div><div class="v">${esc(t[1])}</div><div class="s">${esc(t[2])}</div></div>`).join('')}</div>`;
  const sigHTML = (sig.watch.length || sig.favour.length) ? `<div class="signals small">${sig.watch.length ? `<div><span class="pill warn">${icon('alert')}Worth a look</span> ${esc(sig.watch.join('; '))}</div>` : ''}${sig.favour.length ? `<div><span class="pill ok">${icon('check')}In their favour</span> ${esc(sig.favour.join('; '))}</div>` : ''}</div>` : '';
  const note = `<p class="note" style="margin:0">Context for the person approving. History can speed an approval up; it never refuses a return on its own (§7.2). Protected traits are never stored, and the fairness monitor checks tenure for bias.</p>`;
  if (isNew) return `<div class="cust">${tilesHTML}<p class="note" style="margin:0"><b>New customer:</b> this is their first order, so there's no history yet. The same policy applies to everyone, and tenure never decides a refusal.</p></div>`;
  const reasons = Object.entries(p.reasons).sort((a, b) => b[1] - a[1]);
  const steps = [
    { label: 'Margin on what they kept', value: p.margin, kind: 'add', tip: `${signed(p.margin)} gross margin\nPrice paid minus our cost, on ${p.past.length - p.returns + p.exchanges} kept items` },
    { label: 'Return shipping and handling', value: -p.handling, kind: 'sub', tip: `${signed(-p.handling)} handling\nLabels, processing and replacement shipping on ${p.returns} returns` },
    { label: 'Value lost on returns', value: -p.lost, kind: 'sub', tip: `${signed(-p.lost)} value lost\nWorn items sold for 8% of list in liquidation` },
    { label: 'Net profit', value: p.net, kind: 'total', tip: `${money(p.net)} net profit\nLifetime, before this return` },
  ];
  const charts = `<div class="cust-charts">
    ${vizCard(`ct:${cid}`, "This customer's orders, returns and claims", '', timelineForms(p), 'Every order this customer placed, kept or sent back, with damage claims and whether inspection agreed.', tableView(['Date', 'Order', 'Item', 'Paid', 'Outcome', 'Reason', 'Inspection', 'Net profit'], p.rows.map(r => [r.order_date, r.order_id || '', r.product, money(r.price_paid), r.outcome.replace('_', ' '), r.return_reason.replace(/_/g, ' ') + (r.damage_claim ? ' (claim)' : ''), r.inspection ? `${r.inspection} · ${r.grade_found}` : '', r.outcome === 'return in progress' ? '' : money(r.net_profit)]), [0, 0, 0, 1, 0, 0, 0, 1]))}
    ${vizCard(`cr2:${cid}`, 'Why this customer returned things', '', reasons.length ? catForms(reasons.map(([k2, n]) => ({ label: reasonWord(k2), value: n, tip: `${n} return${n > 1 ? 's' : ''}\n${pct(n / p.returns)} of their returns: ${reasonWord(k2)}` })), { fmt: v => String(v), barFmt: v => `${v} (${pct(v / p.returns)})`, tick: v => String(v), pie: true, center: String(p.returns), centerSub: 'returns', heatCol: 'Returns' }) : [{ id: 'bar', render: () => '<p class="small muted" style="margin:6px 0 0">No returns before this one.</p>' }],
      'This customer\'s own past returns, grouped by the reason they gave. Compare with the product chart above: many damage claims on many different items is a pattern; many fit returns on one style usually is not.', reasons.length ? tableView(['Reason', 'Returns', 'Share'], reasons.map(([k2, n]) => [reasonWord(k2), String(n), pct(n / p.returns)]), [0, 1, 1]) : '')}
    ${vizCard(`cp:${cid}`, 'Lifetime profit from this customer', 'Lifetime, before this return', [{ id: 'wf', render: () => bridge(steps) }].concat(catForms(steps.map(s2 => ({ label: s2.label, value: s2.value, tip: s2.tip, hl: s2.kind === 'total' })), { heatCol: 'Amount' }).filter(f => f.id !== 'bar')),
      'Starts with the margin on everything they kept, then takes away what their returns cost to ship, process and write off. The last step is what this customer has earned ALDO overall.', tableView(['Step', 'Amount'], steps.map(s2 => [s2.label, money(s2.value)]), [0, 1]))}
    ${vizCard(`ck:${cid}`, `Where this customer ranks among ${p.of}`, 'Every customer by lifetime net profit', [
      { id: 'col', render: () => rankSVG(p), note: 'Columns: one per customer, most profitable on the left.' },
      { id: 'hist', render: () => histSVG(valueRanking().map(a => a.net), { fmt: compactMoney, mark: p.net, markLabel: 'This customer', unit: 'customers', xLabel: 'Lifetime net profit', bins: 8 }), note: 'Histogram: how many customers fall in each profit band. The dashed line is this customer.' },
      { id: 'scatter', render: () => scatterSVG(valueRanking().map(a => { const rows2 = (IDX.histByCust[a.cid] || []).filter(x => x.outcome !== 'return in progress'); const ret = rows2.filter(x => RETURNED.includes(x.outcome)).length; return { x: rows2.length, y: a.net, hl: a.cid === cid, label: a.cid === cid ? 'This customer' : '', fill: rows2.length && ret / rows2.length > 0.3 ? 'var(--cat-3)' : null, tip: `${a.cid}${a.cid === cid ? ' (this customer)' : ''}\n${rows2.length} orders · ${ret} returned · ${money(a.net)} net` }; }), { x: { label: 'Orders placed', fmt: v => String(Math.round(v)), zero: true }, y: { label: 'Lifetime net profit', fmt: compactMoney, zero: false } }), note: 'Scatter: every customer by orders placed and profit. Coloured points return more than 30% of what they buy. Low and to the right means many orders that cost money.' }],
      'Value never refuses a return; it helps decide how much benefit of the doubt to give.', tableView(['Rank', 'Customer', 'Net profit'], valueRanking().map((a, i) => [String(i + 1), a.cid + (a.cid === cid ? ' (this customer)' : ''), money(a.net)]), [1, 0, 1]))}
  </div>`;
  return `<div class="cust">${tilesHTML}${sigHTML}${charts}${note}</div>`;
}
function profilesSection() {
  const cases = DATA.cases;
  if (!UI.profile || !IDX.kase[UI.profile]) UI.profile = cases[0].case_id;
  const k = IDX.kase[UI.profile];
  return `<div id="profiles"><div class="section-head" style="margin-top:36px"><div><div class="eyebrow">Customer view</div><h2>Customer profiles</h2><p>Every test customer's history, the way an approver sees it. Compare a loyal customer with one whose claims keep failing inspection.</p></div></div>
    <div class="scenario-bar">${cases.map(x => `<button type="button" class="sc-chip" data-profile="${x.case_id}" aria-pressed="${x.case_id === UI.profile}"><span class="tg">${esc(x.tag)}</span>${esc(x.label)}</button>`).join('')}</div>
    <div class="card card-pad"><div class="card-head"><div><h3>${esc(k.label)} · ${esc(k.customer_id)}</h3><div class="small muted">${esc(IDX.cust[k.customer_id].loyalty_status === 'Member' ? 'Member' : IDX.cust[k.customer_id].loyalty_status + ' member')} · ${esc(IDX.cust[k.customer_id].region)} · the agent sees the customer ID, never the name</div></div></div>${customerPanel(k.customer_id)}</div></div>`;
}

/* ---------- Dashboard: returns and money, by day, week, month or year ---------- */
UI.dash = UI.dash || { src: 'pilot', gran: 'month', range: '12m', channel: 'all', category: 'all' };
const OUTCOMES = [
  ['refund', 'Refund', 'var(--cat-2)'], ['keep_it', 'Keep-it refund', 'var(--cat-6)'], ['exchange', 'Exchange', 'var(--cat-3)'],
  ['store_credit', 'Store credit', 'var(--cat-1)'], ['store_credit_bonus', 'Credit + bonus', 'var(--cat-4)'], ['smart_credit', 'Smart Credit', 'var(--cat-5)'], ['declined', 'Declined', 'var(--chart-2)'],
];
const OUT_WORD = Object.fromEntries(OUTCOMES.map(o => [o[0], o[1]]));
const CREDIT_KINDS = ['store_credit', 'store_credit_bonus', 'smart_credit'];
/** Returns settled in this demo session, as ledger rows dated today. */
function demoLedgerRows() {
  const out = [], today = dayNum(META.today);
  for (const [id, cs] of Object.entries(CASES)) {
    if (!IDX.kase[id]) continue;
    const { line, ec } = caseCtx(id), margin = r2(line.selling_price - ec.estimated_cost);
    const base = { dn: today, date: META.today, channel: 'Online', region: caseCtx(id).c.region, style_id: line.style_id, category: IDX.style[line.style_id].category, reason: cs.reasonCode || 'fit', price: line.selling_price, cost: ec.estimated_cost, margin, refund: 0, credit: 0, bonus: 0, saved: 0, decided_by: Object.values(SYS.reviews).some(r => r.case_id === id && r.decided_by && !r.auto) ? 'person' : 'agent', pilot: true, demo: true };
    const push = o => out.push(Object.assign({}, base, o, { id: `DEMO-${id}-${out.length}` }));
    for (const r of Object.values(SYS.refunds)) if (r.case_id === id && r.status === 'issued') push({ outcome: r.keep_item ? 'keep_it' : 'refund', price: r.amount, refund: r.amount });
    for (const c of Object.values(SYS.credits)) if (c.case_id === id && c.status === 'issued') { const smart = cs.chosen && cs.chosen.option === 'smart_credit'; const bonus = Number(c.bonus || 0); const kind = smart ? 'smart_credit' : bonus ? 'store_credit_bonus' : 'store_credit'; push({ outcome: kind, price: c.amount, credit: c.amount, bonus, saved: r2((kind === 'store_credit' ? 0.7 : kind === 'smart_credit' ? 0.85 : 0.82) * (margin - bonus)) }); }
    for (const x of Object.values(SYS.exchanges)) if (x.case_id === id && x.status === 'shipped') push({ outcome: 'exchange', saved: margin });
    if (cs.status === 'declined') push({ outcome: 'declined', saved: margin });
  }
  return out;
}
function periodKey(dn, gran) {
  const d = new Date(dn * 864e5);
  if (gran === 'day') return dn;
  if (gran === 'week') return dn - ((d.getUTCDay() + 6) % 7);
  if (gran === 'month') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 864e5;
  return Date.UTC(d.getUTCFullYear(), 0, 1) / 864e5;
}
function periodLabel(k, gran) {
  const d = new Date(k * 864e5), o = { timeZone: 'UTC' };
  if (gran === 'year') return String(d.getUTCFullYear());
  if (gran === 'month') return d.toLocaleDateString('en-CA', { ...o, month: 'short', year: '2-digit' });
  return d.toLocaleDateString('en-CA', { ...o, month: 'short', day: 'numeric' });
}
function nextPeriod(k, gran) {
  const d = new Date(k * 864e5);
  if (gran === 'day') return k + 1; if (gran === 'week') return k + 7;
  if (gran === 'month') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 864e5;
  return Date.UTC(d.getUTCFullYear() + 1, 0, 1) / 864e5;
}
const DASH_RANGES = [['7d', '7 days', 7], ['30d', '30 days', 30], ['90d', '90 days', 90], ['12m', '12 months', 365], ['ytd', 'This year', null], ['all', 'All (2 years)', null]];
function dashRange() {
  const end0 = dayNum(META.today), r = UI.dash.range, R = DASH_RANGES.find(x => x[0] === r);
  if (r === 'custom' && UI.dash.from && UI.dash.to) { const a = dayNum(UI.dash.from), b = dayNum(UI.dash.to); const start = Math.min(a, b), end = Math.max(a, b); return { start, end, len: end - start + 1 }; }
  const end = end0;
  const start = r === 'all' ? (LEDGER[0] ? LEDGER[0].dn : end - 730) : r === 'ytd' ? Date.UTC(+META.today.slice(0, 4), 0, 1) / 864e5 : end - R[2] + 1;
  return { start, end, len: end - start + 1 };
}
function agg(rows) {
  const a = { n: rows.length, refundN: 0, refund: 0, creditN: 0, credit: 0, bonusN: 0, bonus: 0, smartN: 0, plainN: 0, declineN: 0, exchangeN: 0, keepN: 0, margin: 0, saved: 0, byOutcome: {} };
  for (const r of rows) {
    a.byOutcome[r.outcome] = (a.byOutcome[r.outcome] || 0) + 1; a.margin += r.margin; a.saved += r.saved;
    if (r.outcome === 'refund' || r.outcome === 'keep_it') { a.refundN++; a.refund += r.refund; if (r.outcome === 'keep_it') a.keepN++; }
    if (CREDIT_KINDS.includes(r.outcome)) { a.creditN++; a.credit += r.credit; a.bonus += r.bonus; if (r.outcome === 'store_credit') a.plainN++; else if (r.outcome === 'smart_credit') a.smartN++; else a.bonusN++; }
    if (r.outcome === 'declined') a.declineN++; if (r.outcome === 'exchange') a.exchangeN++;
  }
  return a;
}
function dashFilter(rows) { const f = UI.dash; return rows.filter(r => (f.channel === 'all' || r.channel === f.channel) && (f.category === 'all' || r.category === f.category)); }
const gwPlural = g => ({ day: 'days', week: 'weeks', month: 'months', year: 'years' })[g];
function renderDashboard() {
  const el = $('#tab-dashboard'); if (!el) return;
  if (typeof REAL !== 'undefined' && REAL && UI.dash.src !== 'pilot') return renderRealDashboard(el);
  const f = UI.dash, { start, end, len } = dashRange();
  const demo = demoLedgerRows();
  const pool = dashFilter(LEDGER.concat(demo));
  const rows = pool.filter(r => r.dn >= start && r.dn <= end), prev = pool.filter(r => r.dn >= start - len && r.dn < start);
  const A = agg(rows), P = agg(prev), hasPrev = prev.length > 0 && start - len >= (LEDGER[0] ? LEDGER[0].dn : 0);
  // periods
  const keys = []; for (let k = periodKey(start, f.gran); k <= end; k = nextPeriod(k, f.gran)) keys.push(k);
  const idx = new Map(keys.map((k, i) => [k, i])), labels = keys.map(k => periodLabel(k, f.gran));
  // A period cut by the chosen dates is partial: its columns are faded and its tip says how many days count.
  const partial = keys.map(k => { const full = nextPeriod(k, f.gran) - k, inside = Math.min(nextPeriod(k, f.gran), end + 1) - Math.max(k, start); return inside < full ? `${inside} of ${full} days in range` : ''; });
  const by = keys.map(() => []); for (const r of rows) { const i = idx.get(periodKey(r.dn, f.gran)); if (i != null) by[i].push(r); }
  const per = by.map(agg);
  const pilotAt = keys.findIndex((k, i) => k <= PILOT_DAY && (i === keys.length - 1 || keys[i + 1] > PILOT_DAY));
  const marker = PILOT_DAY > start && PILOT_DAY <= end ? pilotAt : null;
  const delta = (cur, old, money_) => { if (!hasPrev || !old) return ''; const d = (cur - old) / Math.abs(old); return `<span class="dl ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${pct(Math.abs(d))}</span>`; };
  const rangeWord = f.range === 'custom' ? 'dates' : DASH_RANGES.find(x => x[0] === f.range)[1].toLowerCase();
  const tiles = [
    ['Total returns', A.n.toLocaleString('en-CA'), delta(A.n, P.n), `${(A.n / Math.max(1, len)).toFixed(1)} a day`],
    ['Refund worth', whole(A.refund), delta(A.refund, P.refund), `${A.refundN.toLocaleString('en-CA')} refunds · ${pct(A.refundN / (A.n || 1))} of returns`],
    ['Store credits issued', A.creditN.toLocaleString('en-CA'), delta(A.creditN, P.creditN), `${pct(A.creditN / (A.n || 1))} of returns`],
    ['Store credit worth', whole(A.credit), delta(A.credit, P.credit), `${whole(A.credit / (A.creditN || 1))} average credit`],
    ['Store credit + bonus', (A.bonusN + A.smartN).toLocaleString('en-CA'), delta(A.bonusN + A.smartN, P.bonusN + P.smartN), `${whole(A.bonus)} in bonuses · ${A.smartN} Smart Credit`],
    ['Declines', A.declineN.toLocaleString('en-CA'), delta(A.declineN, P.declineN), `${pct(A.declineN / (A.n || 1), 1)} of returns · always a person`],
    ['Original margin', whole(A.margin), delta(A.margin, P.margin), 'Margin on every returned item'],
    ['Margin saved', whole(A.saved), delta(A.saved, P.saved), `${pct(A.saved / (A.margin || 1))} of the original margin kept`],
  ];
  const head = `<div class="section-head"><div><div class="eyebrow">Returns dashboard · pilot simulation, synthetic data</div><h2>Returns and money</h2><p>What the real data can't show yet: the effect of Perfect Pair itself. Every return over two years: how many came back, what went out as refunds and store credit, and how much margin ALDO kept. Perfect Pair starts as a pilot on ${fmtDate(DATA.returns_ledger.pilot)}. Returns completed in this demo session (after the store check) are added for today${demo.length ? ` (${demo.length} so far)` : ''}.</p></div></div>
    ${typeof REAL !== 'undefined' && REAL ? srcSwitch('pilot') : ''}
    <div class="dash-controls">
      <div class="seg dseg" role="group" aria-label="Group by">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']].map(([k, l]) => `<button type="button" data-dgran="${k}" aria-pressed="${f.gran === k}">${l}</button>`).join('')}</div>
      <div class="seg dseg" role="group" aria-label="Time range">${DASH_RANGES.map(([k, l]) => `<button type="button" data-drange="${k}" aria-pressed="${f.range === k}">${l}</button>`).join('')}</div>
      <div class="dates" role="group" aria-label="Pick dates"><label class="dsel">From <input type="date" data-ddate="from" min="${esc(DATA.returns_ledger.start)}" max="${esc(META.today)}" value="${esc(new Date(start * 864e5).toISOString().slice(0, 10))}"></label><label class="dsel">To <input type="date" data-ddate="to" min="${esc(DATA.returns_ledger.start)}" max="${esc(META.today)}" value="${esc(new Date(end * 864e5).toISOString().slice(0, 10))}"></label>${f.range === 'custom' ? '<span class="pill info">Custom dates</span><button type="button" class="btn secondary sm" data-dclear="1">Clear dates</button>' : ''}</div>
      <label class="dsel">Channel <select data-dfilter="channel">${['all', 'Online', 'Store'].map(v => `<option value="${v}" ${f.channel === v ? 'selected' : ''}>${v === 'all' ? 'All' : v}</option>`).join('')}</select></label>
      <label class="dsel">Category <select data-dfilter="category">${['all', ...new Set(DATA.catalogue.map(c => c.category))].map(v => `<option value="${v}" ${f.category === v ? 'selected' : ''}>${v === 'all' ? 'All' : v}</option>`).join('')}</select></label>
      <span class="small muted">${fmtDate(new Date(start * 864e5).toISOString().slice(0, 10))} to ${fmtDate(new Date(end * 864e5).toISOString().slice(0, 10))}${hasPrev ? ` · arrows compare with the ${len} days before` : ''}</span>
    </div>
    <div class="dash-tiles">${tiles.map(t => `<div class="stat"><div class="l">${esc(t[0])}</div><div class="v">${esc(t[1])}</div><div class="s">${t[2]} ${esc(t[3])}</div></div>`).join('')}</div>`;
  const gw = { day: 'day', week: 'week', month: 'month', year: 'year' }[f.gran];
  const outSeries = OUTCOMES.map(([k, l, c]) => ({ name: l, color: c, values: per.map(p => p.byOutcome[k] || 0) })).filter(s => s.values.some(v => v));
  const tbl = tableView([gw[0].toUpperCase() + gw.slice(1), 'Returns', 'Refunds', 'Refund worth', 'Credits', 'Credit worth', 'Bonus', 'Declines', 'Original margin', 'Margin saved'], per.map((p, i) => [labels[i], String(p.n), String(p.refundN), money(p.refund), String(p.creditN), money(p.credit), money(p.bonus), String(p.declineN), money(p.margin), money(p.saved)]), [0, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  const mk = { marker, markerLabel: 'Perfect Pair pilot', partial };
  const partNote = partial.some(Boolean) ? ` Faded ${gwPlural(f.gran)} at the edges are only partly inside the dates you picked.` : '';
  const c1 = vizCard('d:count', `Returns per ${gw}`, 'Coloured by what happened to each return', [
    { id: 'stack', render: () => stackSVG(labels, outSeries, { ...mk, aria: `Returns per ${gw}` }) },
    { id: 'line', render: () => lineSVG(labels, [{ name: 'All returns', color: 'var(--chart-1)', values: per.map(p => p.n) }, { name: 'Refunds', color: 'var(--cat-2)', values: per.map(p => p.refundN) }, { name: 'Store credits', color: 'var(--cat-1)', values: per.map(p => p.creditN) }, { name: 'Exchanges', color: 'var(--cat-3)', values: per.map(p => p.exchangeN) }], { ...mk, fmt: v => String(v), tick: v => String(v) }), note: 'Lines: the total and the three main outcomes.' },
    ...(keys.length <= 31 ? [{ id: 'heat', render: () => heatHTML({ corner: 'Outcome', rows: outSeries.map(s => s.name), cols: labels, fmt: v => String(v), cells: outSeries.map(s => s.values.map((v, i) => ({ v: v || null, tip: `${labels[i]} · ${s.name}\n${v} returns` }))) }), note: 'Heatmap: outcome against period; darker is more.' }] : []),
  ], `Each column is one ${gw}. The dashed line marks the start of the Perfect Pair pilot: after it, more returns end as exchanges and store credit instead of refunds.${partNote}`, tbl);
  const c2 = vizCard('d:money', 'Refunds and store credit, in dollars', `Per ${gw}`, [
    { id: 'line', render: () => lineSVG(labels, [{ name: 'Refund worth', color: 'var(--cat-2)', values: per.map(p => r2(p.refund)) }, { name: 'Store credit worth', color: 'var(--cat-1)', values: per.map(p => r2(p.credit)) }, { name: 'Bonuses paid', color: 'var(--cat-4)', values: per.map(p => r2(p.bonus)) }], mk) },
    { id: 'group', render: () => groupSVG(labels, [{ name: 'Refund worth', color: 'var(--cat-2)', values: per.map(p => r2(p.refund)) }, { name: 'Store credit worth', color: 'var(--cat-1)', values: per.map(p => r2(p.credit)) }], { partial }), note: 'Side by side: refund and credit dollars for each period.' },
    { id: 'stack', render: () => stackSVG(labels, [{ name: 'Refund worth', color: 'var(--cat-2)', values: per.map(p => r2(p.refund)) }, { name: 'Store credit worth', color: 'var(--cat-1)', values: per.map(p => r2(p.credit)) }], { ...mk, fmt: whole, tick: compactMoney }), note: 'Stacked: all the money handed back, split by how.' },
  ], `Refund worth is money returned to customers' cards. Store credit worth stays with ALDO until it is spent; bonuses are the extra in-store credit offered with some of it.${partNote}`);
  const c3 = vizCard('d:margin', 'Original margin and margin saved', `Per ${gw}`, [
    { id: 'group', render: () => groupSVG(labels, [{ name: 'Original margin', color: 'var(--chart-2)', values: per.map(p => r2(p.margin)) }, { name: 'Margin saved', color: 'var(--cat-3)', values: per.map(p => r2(p.saved)) }], { partial }) },
    { id: 'line', render: () => lineSVG(labels, [{ name: 'Original margin', color: 'var(--chart-2)', values: per.map(p => r2(p.margin)) }, { name: 'Margin saved', color: 'var(--cat-3)', values: per.map(p => r2(p.saved)) }], mk), note: 'Lines: watch the gap close after the pilot starts.' },
    { id: 'col', render: () => colsSVG(per.map((p, i) => ({ label: labels[i], value: p.margin ? r2(p.saved / p.margin) : 0, tip: `${labels[i]}\n${pct(p.margin ? p.saved / p.margin : 0)} of margin kept\n${money(p.saved)} of ${money(p.margin)}` })), { fmt: v => pct(v), tick: v => pct(v) }), note: 'Columns: the share of the original margin kept in each period.' },
  ], `Original margin is what ALDO would have earned on every returned item if it had been kept. Margin saved is what was kept anyway: the whole margin on an exchange or a decline, and the margin on the part of store credit that gets spent, minus any bonus.${partNote}`);
  const mixRows = OUTCOMES.map(([k, l]) => ({ label: l, value: A.byOutcome[k] || 0, tip: `${l}\n${A.byOutcome[k] || 0} returns · ${pct((A.byOutcome[k] || 0) / (A.n || 1))}` })).filter(r => r.value);
  const c4 = vizCard('d:mix', 'What happened to the returns', `The ${rangeWord} selected`, catForms(mixRows, { fmt: v => v.toLocaleString('en-CA'), barFmt: v => `${v.toLocaleString('en-CA')} (${pct(v / (A.n || 1))})`, tick: v => String(v), pie: true, center: A.n.toLocaleString('en-CA'), centerSub: 'returns', heatCol: 'Returns' }), 'Each outcome\'s share of all returns in the range.');
  const credRows = [['store_credit', 'Store credit', A.plainN], ['store_credit_bonus', 'Credit + bonus', A.bonusN], ['smart_credit', 'Smart Credit', A.smartN]].map(([k, l, n2]) => { const rs = rows.filter(r => r.outcome === k); const w = rs.reduce((s2, r) => s2 + r.credit, 0), b = rs.reduce((s2, r) => s2 + r.bonus, 0); return { label: l, value: r2(w), tip: `${l}\n${n2} issued · ${money(w)} credit${b ? ` · ${money(b)} bonus` : ''}`, sub: `${n2} issued${b ? ` · ${whole(b)} bonus` : ''}` }; }).filter(r => r.value);
  const c5 = vizCard('d:credit', 'Store credit issued, by kind', 'Worth in dollars', credRows.length ? catForms(credRows, { pie: true, center: whole(A.credit), centerSub: 'credit issued', heatCol: 'Worth' }) : [{ id: 'bar', render: () => '<p class="small muted">No store credit in this range.</p>' }], 'Plain store credit, credit with an in-store bonus, and Smart Credit (credit, a bonus and picks held for the customer). Credit + bonus and Smart Credit start with the pilot.');
  const decl = rows.filter(r => r.outcome === 'declined'), dr = {}; decl.forEach(r => { dr[r.reason] = (dr[r.reason] || 0) + 1; });
  const declRows = Object.entries(dr).sort((a, b) => b[1] - a[1]).map(([k2, n2]) => ({ label: reasonWord(k2), value: n2, tip: `${n2} declined · ${reasonWord(k2)}` }));
  const c6 = vizCard('d:decl', 'Declines, by the reason the customer gave', `${A.declineN} declined · ${pct(A.declineN / (A.n || 1), 1)} of returns`, declRows.length ? catForms(declRows, { fmt: v => String(v), tick: v => String(v), pie: true, center: String(A.declineN), centerSub: 'declined' }) : [{ id: 'bar', render: () => '<p class="small muted">No declines in this range.</p>' }], 'Only a person can decline a return (§2.4, §7.2), usually because the pair came back worn. Damage, quality and late-delivery returns are never declined.');
  const reasons = ['fit', 'change_of_mind', 'quality', 'damage', 'late', 'expectations'];
  const heatKeys = keys.length <= 24 ? keys : null;
  const c7 = heatKeys ? vizCard('d:reason', `Why customers returned, by ${gw}`, '', [{ id: 'heat', render: () => heatHTML({ corner: 'Reason', rows: reasons.map(reasonWord), cols: labels, fmt: v => String(v), cells: reasons.map(rs => per.map((p, i) => { const n2 = by[i].filter(r => r.reason === rs).length; return { v: n2 || null, tip: `${labels[i]} · ${reasonWord(rs)}\n${n2} returns` }; })) }) },
    { id: 'stack', render: () => stackSVG(labels, reasons.map((rs, j) => ({ name: reasonWord(rs), color: `var(--cat-${j + 1})`, values: by.map(b => b.filter(r => r.reason === rs).length) })), {}), note: 'Stacked: the same counts as columns.' }],
    'Fit dominates all year; change of mind peaks after the holidays.') : '';
  // pilot impact
  const pre = agg(pool.filter(r => !r.pilot && r.dn > PILOT_DAY - 92)), post = agg(pool.filter(r => r.pilot));
  const imp = [['Returns refunded', pct(pre.refundN / (pre.n || 1)), pct(post.refundN / (post.n || 1)), post.refundN / (post.n || 1) < pre.refundN / (pre.n || 1)],
    ['Returns kept as an exchange', pct(pre.exchangeN / (pre.n || 1)), pct(post.exchangeN / (post.n || 1)), post.exchangeN / (post.n || 1) > pre.exchangeN / (pre.n || 1)],
    ['Returns kept as store credit', pct(pre.creditN / (pre.n || 1)), pct(post.creditN / (post.n || 1)), post.creditN / (post.n || 1) > pre.creditN / (pre.n || 1)],
    ['Margin saved per return', money(pre.saved / (pre.n || 1)), money(post.saved / (post.n || 1)), post.saved / (post.n || 1) > pre.saved / (pre.n || 1)],
    ['Share of margin kept', pct(pre.saved / (pre.margin || 1)), pct(post.saved / (post.margin || 1)), post.saved > pre.saved]];
  const impact = `<section class="card card-pad dash-impact"><div class="eyebrow">Before and after the pilot</div><h3>The 3 months before Perfect Pair, against the pilot since ${fmtDate(DATA.returns_ledger.pilot)}</h3>
    <div class="imp-grid">${imp.map(([l, a, b, good]) => `<div class="imp"><div class="small muted">${esc(l)}</div><div class="imp-row"><span class="mono">${esc(a)}</span><span class="imp-arrow">→</span><b class="mono ${good ? 'good' : ''}">${esc(b)}</b></div></div>`).join('')}</div>
    <p class="small muted" style="margin:8px 0 0">Synthetic data generated for the demo, with the pilot's effect built in. In a real pilot, a comparison with suitable control stores would help estimate the effect, subject to its assumptions.</p></section>`;
  el.innerHTML = head + `<div class="dash-grid">${c1}${c2}${c3}<div class="dash-two">${c4}${c5}</div><div class="dash-two">${c6}${impact}</div>${c7}</div>`;
  countUp(el);
}

/* ---------- Prevention agent ---------- */
function renderPrevention() {
  const el = $('#tab-prevention');
  const P = STATE.prevention;
  const hybrid=Object.values(IDX.kase).find(k=>k.hybrid && caseCtx(k.case_id).line.style_id===P.styleId);
  const rows = returnRateReport().filter(r=>P.styleId?r.style_id===P.styleId:!IDX.style[r.style_id]?.hybrid);
  const fl = { flagged: ['red', 'Flagged'], watch: ['warn', 'Watching'], testing: ['info', 'Testing a fix'], fixed: ['ok', 'Fix kept'], ok: ['neutral', 'OK'] };
  el.innerHTML = `<div class="section-head"><div><div class="eyebrow">Prevention agent · simulated analysis</div><h2>Investigate a cause, propose a fix, test its effect</h2><p>The agent compares every style's fit-return rate with similar styles over 28 days, reads why customers sent them back, drafts a fix for a merchandiser to approve, then measures whether returns really dropped.</p></div><button type="button" class="btn red" id="prev-run" ${anyBusy() ? 'disabled' : ''}>${icon('play')}Run tonight's analysis</button></div>
  <div class="card" style="margin-bottom:16px"><div class="card-pad" style="padding-bottom:8px"><div class="eyebrow">F1 · Spot · last 28 days</div><p class="small muted" style="margin:4px 0 0">Flag when a style's fit-return rate is at least 1.5× its category and it has at least 15 fit returns. The red mark is 1.5×.</p></div>
  <div class="tbl-wrap" style="border:0;border-top:1px solid var(--line);border-radius:0 0 var(--r) var(--r)"><table><thead><tr><th>Style</th><th>Category</th><th class="num">Units</th><th class="num">Fit returns</th><th class="num">Rate</th><th class="num">Category</th><th>Ratio</th><th>Status</th></tr></thead><tbody>
  ${rows.slice(0, 9).map(r => `<tr><td><b>${esc(r.product)}</b><br><span class="small muted mono">${esc(r.style_id)}</span></td><td>${esc(r.category)}</td><td class="num">${r.units_sold_28d}</td><td class="num">${r.fit_returns}</td><td class="num">${pct(r.fit_return_rate, 1)}</td><td class="num">${pct(r.category_rate, 1)}</td><td><div class="ratio"><span class="t"><span class="f" style="width:${clamp(r.ratio / 2.5, 0, 1) * 100}%"></span><span class="m" style="left:${1.5 / 2.5 * 100}%"></span></span><span class="mono small">${r.ratio.toFixed(2)}×</span></div></td><td><span class="pill ${fl[r.flag][0]}">${fl[r.flag][1]}</span>${r.quality_spike ? ' <span class="pill bad">Quality spike</span>' : ''}</td></tr>`).join('')}
  </tbody></table></div></div>
  <div class="workbench w-even">
    <section class="card console" aria-label="Prevention agent run"><div class="console-head" id="prev-head"></div><div class="stages" id="prev-stages"></div><ol class="trace" id="trace-prevent" aria-live="polite"></ol></section>
    <section class="stack" id="prev-findings"></section>
  </div>
  <div id="prev-f4" style="margin-top:20px"></div>`;
  if(hybrid)el.insertAdjacentHTML('afterbegin',caseProvenancePanel(hybrid.case_id));
  el.insertAdjacentHTML('afterbegin','<p class="small muted">Operational Prevention uses synthetic reviews, inventory and test outcomes. Use Actual investigations for conclusions based only on supplied history.</p>');
  renderPrevHead();
  const list = $('#trace-prevent');
  list.innerHTML = P.events.length ? P.events.map(e => evHTML(e, P.stats.t0)).join('') : `<li class="trace-empty"><b>Not run yet tonight.</b><br>Press <b>Run tonight's analysis</b>. The agent reads the report, investigates each flagged style and drafts fixes.</li>`;
  list.scrollTop = list.scrollHeight;
  renderFindings(); renderF4();
}
function renderPrevHead() {
  const el = $('#prev-head'); if (!el) return;
  const P = STATE.prevention;
  const ms = P.status === 'running' ? Date.now() - P.stats.t0 : P.stats.ms;
  const pill = { idle: ['neutral', 'Idle'], running: ['warn', 'Running'], done: ['ok', 'Done'], error: ['bad', 'Stopped'] }[P.status];
  const slots = headSlots(el);
  setHTML(slots.title, `<div class="eyebrow">Tonight's run</div><h2>Prevention agent <span class="pill ${pill[0]}" style="vertical-align:3px">${pill[1]}</span></h2>`);
  setHTML(slots.stats, `<span>Time <b>${fmtElapsed(ms || 0)}</b></span><span>Tool calls <b>${P.stats.tools}</b></span><span>Mode <b>${P.mode ? (P.mode === 'live' ? 'Live' : 'Scripted') : (STATE.mode === 'live' ? 'Live' : 'Scripted')}</b></span>`);
  setHTML(slots.stop, STATE.running && P.status === 'running' ? STOP_BTN : '');
  const st = $('#prev-stages');
  if (st) {
    let cur = -1;
    for (const e of P.events) { if (e.kind !== 'call') continue; const s = e.tool === 'get_return_rate_report' ? 0 : ['draft_product_page_fix', 'open_quality_ticket'].includes(e.tool) ? 2 : 1; cur = Math.max(cur, s); }
    if (Object.keys(STATE.prevention.measured).length) cur = 3;
    st.innerHTML = ['Spot', 'Diagnose', 'Fix', 'Measure'].map((n, i) => `<div class="stage ${i <= cur ? 'on' : ''} ${P.status === 'running' && i === cur ? 'now' : ''}"><span class="n">F${i + 1}</span><span class="l">${n}</span></div>`).join('');
  }
}
function renderFindings() {
  const el = $('#prev-findings'); if (!el) return;
  const F = STATE.prevention.findings;
  if (!F) { el.innerHTML = `<div class="empty"><b>Findings appear here.</b>Each one shows the cause, the evidence and the fix: a product page note for a merchandiser to approve, or a ticket for the quality team.</div>`; return; }
  const causePill = { width: ['red', 'Width'], sizing: ['warn', 'Sizing'], defect: ['bad', 'Defect'], description: ['info', 'Description'], unclear: ['neutral', 'Unclear'] };
  el.innerHTML = (F.summary ? `<div class="card card-pad"><div class="eyebrow">Summary</div><div>${esc(F.summary)}</div>${F.watching.length ? `<div class="small muted" style="margin-top:6px">Watching: ${F.watching.map(esc).join('; ')}</div>` : ''}</div>` : '') +
    F.list.map(f => {
      const dr = f.draft_id && SYS.drafts[f.draft_id];
      const rv = dr && Object.values(SYS.reviews).find(r => r.draft_id === dr.id);
      const cp = causePill[f.cause] || causePill.unclear;
      return `<article class="card find-card"><div class="row" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><h3>${esc(f.product)}</h3><span><span class="pill ${cp[0]}">${cp[1]}</span> <span class="pill neutral">${esc(f.confidence)} confidence</span></span></div>
        ${f.evidence.length ? `<ul class="evi">${f.evidence.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${dr ? `<div><span class="page-note">${esc(dr.note)}</span> <span class="small muted">${esc(dr.status)}</span></div>${rv && rv.status === 'pending' ? `<div class="ap-actions"><button type="button" class="btn sm" data-review="${rv.id}" data-choice="approve">Approve and publish</button><button type="button" class="btn secondary sm" data-review="${rv.id}" data-choice="reject">Reject</button><span class="small muted" style="align-self:center">You're the merchandiser (R10, §7.3)</span></div>` : ''}` : ''}
        ${f.ticket_id ? `<div class="small"><span class="pill bad">${esc(f.ticket_id)}</span> Sent to the quality team and the supplier. The product page doesn't change for a defect.</div>` : ''}
      </article>`;
    }).join('');
}
function renderF4() {
  const el = $('#prev-f4'); if (!el) return;
  const live = Object.entries(SYS.measuring).filter(([sid]) => DATA.f4_series[sid]);
  if (!live.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="section-head"><div><div class="eyebrow">F4 · Measure</div><h2>Did the fix work?</h2><p>We compare the fixed style with similar styles over the same weeks, so the season or a promotion doesn't get the credit (difference-in-differences). The fix stays only if we're 90% sure returns dropped. Post-fix weeks are simulated for the demo.</p></div></div>
  <div class="stack">${live.map(([sid]) => {
    const m = STATE.prevention.measured[sid];
    if (!m) return `<div class="card card-pad" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><b>${esc(styleName(sid))}</b> · <span class="page-note">${esc(SYS.pageNotes[sid] || DATA.f4_series[sid].fix_note)}</span><div class="small muted" style="margin-top:6px">Published ${fmtDate(SYS.measuring[sid].since)}. Needs at least 4 weeks or 200 orders.</div></div><button type="button" class="btn" data-f4="${sid}">${icon('forward')}Fast-forward 6 weeks</button></div>`;
    return f4Card(sid, m);
  }).join('')}</div>`;
  for (const [sid] of live) if (STATE.prevention.measured[sid]) drawDiD(sid);
  countUp(el);
}
function f4Card(sid, m) {
  const verdict = m.keep ? `<span class="pill ok">${icon('check')}Keep the fix</span>` : `<span class="pill warn">${icon('replan')}Roll back and test the next cause</span>`;
  return `<article class="card card-pad"><div class="card-head"><div><h3>${esc(m.style)}</h3><div class="small muted">Note: "${esc(m.note)}" · compared with ${esc(m.comparison.join(', '))}</div></div>${verdict}</div>
    <div class="grid2 g-wide">
      <div class="chart-box" id="did-${sid}"></div>
      <div class="stack"><div class="stat-row"><div class="stat"><div class="l">${esc(m.style.split(' ')[0])}</div><div class="v">${pct(m.before, 1)} → ${pct(m.after, 1)}</div></div><div class="stat"><div class="l">Similar styles</div><div class="v">${pct(m.compBefore, 1)} → ${pct(m.compAfter, 1)}</div></div></div>
      <div class="stat"><div class="l">Effect of the fix (difference-in-differences)</div><div class="v">${(m.did * 100).toFixed(1)} pts</div><div class="small muted">90% range ${(m.lo * 100).toFixed(1)} to ${(m.hi * 100).toFixed(1)} pts · ${m.ordersAfter} orders over ${m.weeksAfter} weeks</div></div>
      <p class="small" style="margin:0">${m.keep ? `The whole 90% range is below zero, so this simulated test supports keeping the note. The note stays and the Resolution agent now recommends the right fit for this style.` : `The 90% range crosses zero, so we can't tell the note helped. It's rolled back; next the agent tests another explanation (heel cup depth in small sizes) and flags the product team.`}</p></div>
    </div></article>`;
}
function measureNow(sid) {
  const m = measureFix(sid);
  STATE.prevention.measured[sid] = m;
  if (!m.keep) { delete SYS.pageNotes[sid]; const d = SYS.drafts[SYS.measuring[sid].draft]; if (d) d.status = 'rolled back after measuring'; }
  else { const d = SYS.drafts[SYS.measuring[sid].draft]; if (d) d.status = 'kept: supported by simulated test'; }
  renderPrevention();
}
function drawDiD(sid) {
  const box = $('#did-' + sid); if (!box) return;
  const m = STATE.prevention.measured[sid], s = m.series;
  const pre = s.flagged.length, weeks = pre + s.flagged_post.length;
  const a = s.flagged.concat(s.flagged_post).map(([o, f]) => f / o), b = s.comp.concat(s.comp_post).map(([o, f]) => f / o);
  const W = 560, H = 250, L = 46, R = 112, T = 16, B = 34;
  const ymax = Math.ceil(Math.max(...a, ...b) * 100 / 4) * 4 / 100 + 0.02;
  const x = i => L + (i + 0.5) * ((W - L - R) / weeks), y = v => T + (1 - v / ymax) * (H - T - B);
  const ticks = []; for (let v = 0; v <= ymax + 1e-9; v += 0.04) ticks.push(v);
  const path = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const fixX = (x(pre - 1) + x(pre)) / 2;
  const nameA = m.style.split(' ')[0];
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly fit-return rate for ${esc(nameA)} and similar styles, ${pre} weeks before and ${weeks - pre} weeks after the fix">
    ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--chart-grid)" stroke-width="1"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--f-mono)">${Math.round(v * 100)}%</text>`).join('')}
    <line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--chart-axis)" stroke-width="1"/>
    <line x1="${fixX}" x2="${fixX}" y1="${T}" y2="${H - B}" stroke="var(--red)" stroke-width="1.5"/>
    <text x="${fixX + 6}" y="${T + 10}" font-size="11" fill="var(--red-ink)" font-family="var(--f-body)" font-weight="700">Note published</text>
    <text x="${x(0)}" y="${H - 12}" font-size="11" fill="var(--muted)" font-family="var(--f-body)">${pre} weeks before</text>
    <text x="${x(weeks - 1)}" y="${H - 12}" font-size="11" fill="var(--muted)" font-family="var(--f-body)" text-anchor="end">${weeks - pre} weeks after</text>
    <path class="draw" pathLength="1" d="${path(b)}" fill="none" stroke="var(--chart-2)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <path class="draw" pathLength="1" d="${path(a)}" fill="none" stroke="var(--chart-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(weeks - 1)}" cy="${y(a[weeks - 1])}" r="4" fill="var(--chart-1)" stroke="var(--panel)" stroke-width="2"/>
    <circle cx="${x(weeks - 1)}" cy="${y(b[weeks - 1])}" r="4" fill="var(--chart-2)" stroke="var(--panel)" stroke-width="2"/>
    <text x="${x(weeks - 1) + 10}" y="${y(a[weeks - 1]) + 4}" font-size="12" fill="var(--ink)" font-family="var(--f-body)" font-weight="700">${esc(nameA)}</text>
    <text x="${x(weeks - 1) + 10}" y="${y(b[weeks - 1]) + 4}" font-size="12" fill="var(--muted)" font-family="var(--f-body)">Similar styles</text>
    <line class="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--line-strong)" stroke-width="1" visibility="hidden"/>
    <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" class="hit"/>
  </svg><div class="legend-row small" style="margin-top:6px"><span><i style="background:var(--chart-1);height:2px;width:14px;border-radius:0"></i>${esc(m.style)}</span><span><i style="background:var(--chart-2);height:2px;width:14px;border-radius:0"></i>Similar styles</span></div><div class="chart-tip" hidden></div>`;
  const svg = box.querySelector('svg'), tip = box.querySelector('.chart-tip'), xh = box.querySelector('.xh');
  const move = ev => {
    const r = svg.getBoundingClientRect(); const px = (ev.clientX - r.left) * W / r.width;
    const i = clamp(Math.round((px - L) / ((W - L - R) / weeks) - 0.5), 0, weeks - 1);
    xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.innerHTML = `<div class="small muted">Week ${i < pre ? `${i - pre} (before)` : `+${i - pre + 1} (after)`}</div><div><span class="k" style="background:var(--chart-1)"></span><b>${pct(a[i], 1)}</b> ${esc(nameA)}</div><div><span class="k" style="background:var(--chart-2)"></span><b>${pct(b[i], 1)}</b> similar styles</div>`;
    const bx = box.getBoundingClientRect();
    tip.style.left = Math.min(bx.width - 170, Math.max(0, ev.clientX - bx.left + 12)) + 'px'; tip.style.top = '8px';
  };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerleave', () => { tip.hidden = true; xh.setAttribute('visibility', 'hidden'); });
}

/* ---------- Evaluations ---------- */
function renderEvals() {
  const el = $('#tab-evals');
  const liveOk = STATE.live.available;
  const results = DATA.cases.filter(k => k.expect).map(k => STATE.evals[k.case_id]);
  const passed = results.filter(r => r && r.checks.every(c => c.pass)).length, ran = results.filter(Boolean).length;
  el.innerHTML = `<div class="section-head"><div><div class="eyebrow">AgentCore Evaluations, in miniature</div><h2>Scenario tests</h2><p>Each test runs the agent's decision step on one scenario in a sandbox, then checks the outcome and the safety rules: the refund stays visible, fees follow §3.2 and §3.3, no money moves while deciding, nothing personal leaks into the message. Run them in live mode to test the real agent; in scripted mode they check the backup.</p></div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="small muted">${ran ? `${passed} of ${ran} passed` : 'Not run yet'} · mode: <b>${STATE.mode === 'live' ? 'live' : 'scripted'}</b></span><button type="button" class="btn red" id="eval-all" ${anyBusy() ? 'disabled' : ''}>${icon('play')}Run all ${DATA.cases.filter(k => k.expect).length}</button></div></div>
  ${!liveOk ? `<p class="note" style="margin-top:-6px">Live mode isn't available here, so tests run on the scripted backup.</p>` : ''}
  <div class="tbl-wrap"><table><thead><tr><th>Scenario</th><th>What should happen</th><th>Checks</th><th class="num">Time</th><th class="num">Tools</th><th></th></tr></thead><tbody>
  ${DATA.cases.filter(k => k.expect).map(k => {
    const r = STATE.evals[k.case_id];
    const ok = r && r.checks.every(c => c.pass);
    return `<tr><td><b>${esc(k.label)}</b> <span class="pill neutral">${esc(k.tag)}</span><div class="small muted">${esc(k.headline)}</div></td><td class="small">${esc(expectText(k.expect))}</td>
      <td>${r ? `<span class="pill ${ok ? 'ok' : 'bad'}">${r.checks.filter(c => c.pass).length}/${r.checks.length}</span> <span class="small muted">${r.mode}</span><div style="margin-top:4px">${r.checks.map(c => `<span class="check ${c.pass ? 'p' : 'f'}" title="${esc(c.detail)}">${icon(c.pass ? 'check' : 'x')}${esc(c.name)}</span>`).join('')}</div>${r.error ? `<div class="small" style="color:var(--bad)">${esc(r.error)}</div>` : ''}${r.events.length ? `<details style="margin-top:6px"><summary>Show the agent's trace (${r.events.length} steps)</summary><ol class="trace" style="max-height:360px">${r.events.map(e => evHTML(e, r.at - r.ms)).join('')}</ol></details>` : ''}` : (STATE.evalRunning === k.case_id ? '<span class="pill warn">Running…</span>' : '<span class="small muted">Not run</span>')}</td>
      <td class="num">${r ? (r.ms < 1000 ? '&lt;1s' : fmtElapsed(r.ms)) : ''}</td><td class="num">${r ? r.tools : ''}</td>
      <td><button type="button" class="btn secondary sm" data-eval="${k.case_id}" ${anyBusy() ? 'disabled' : ''}>Run</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function expectText(e) {
  const b = [];
  if (e.status === 'human_review') b.push('Sends it to a person; moves no money');
  if (e.status === 'not_eligible') b.push(`Explains ${e.clause} and offers a review`);
  if (e.recommended) b.push(`Recommends ${e.recommended.replace('_', ' ')}`);
  if (e.exchange_width) b.push(`exchange to size ${e.exchange_size} wide`);
  if (e.cost_owner) b.push(`cost owner: ${e.cost_owner.replace('_', ' ')}`);
  if (e.fee === 0) b.push('free for the customer');
  if (e.refund_fee) b.push('$5.95 by mail for a refund');
  if ('smart_credit' in e) b.push(e.smart_credit ? 'Smart Credit offered' : 'no Smart Credit');
  if (e.keep_it) b.push('keep-it offered');
  if (e.max_refund) b.push(`ignores the injected $900 request`);
  if (e.refund_shown) b.push('refund visible');
  return b.join('; ') + '.';
}
async function runEvalsSeq(ids) {
  if (anyBusy()) return;
  const mode = STATE.mode === 'live' && STATE.live.available ? 'live' : 'scripted';
  for (const id of ids) {
    STATE.evalRunning = id; renderEvals();
    await runEval(id, mode);
    STATE.evalRunning = false; renderEvals();
    if (mode === 'live' && !STATE.live.available) break;
  }
  STATE.evalRunning = false; renderEvals(); renderTabsBar();
}

/* ---------- Audit and fairness ---------- */
function renderAudit() {
  const el = $('#tab-audit');
  const recs = STATE.audit;
  if (UI.auditSel && !recs.some(r => r.id === UI.auditSel)) UI.auditSel = null;
  const sel = recs.find(r => r.id === UI.auditSel) || recs[0];
  el.innerHTML = `<div class="section-head"><div><div class="eyebrow">Explainability</div><h2>Audit trail</h2><p>Every decision is logged with the tools called, what they returned, the sources cited, each safety check, any person who approved, and the model that answered.</p></div></div>
  ${recs.length ? `<div class="grid2 g-side g-side-sm"><div class="card card-pad"><div class="dropoff">${recs.map(r => `<button type="button" data-audit="${r.id}" aria-pressed="${sel && sel.id === r.id}"><b>${esc(r.id)}</b> · ${esc(caseName(r.case_id))}<br><span class="small muted">${esc(r.return_id)} · ${esc(Object.keys(r.phases).join(', '))}</span></button>`).join('')}</div></div>
    <div class="card card-pad stack">${auditDetail(sel)}</div></div>` : `<div class="empty"><b>No decisions yet.</b>Run a return on the Return tab and its full record appears here.</div>`}
  <div class="section-head" style="margin-top:36px"><div><div class="eyebrow">Responsible AI</div><h2>Fairness monitor</h2><p>Last 30 days of synthetic decisions. A group is flagged when it differs from everyone by at least 5 points and the gap is too large to be chance (3 standard errors). Loyalty tier, region and tenure are the only groupings: protected traits are never stored or used.</p></div>
    <label class="small" for="fair-metric"><b>Measure</b> <select id="fair-metric" style="border:1px solid var(--line-strong);border-radius:999px;padding:7px 12px;background:var(--panel)">${FAIR_METRICS.map(([k, l]) => `<option value="${k}" ${UI.fair.metric === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
  ${fairnessHTML(UI.fair.metric)}`;
}
function auditDetail(r) {
  if (!r) return '';
  const p = r.phases;
  const lines = [];
  for (const [ph, v] of Object.entries(p)) {
    const label = { investigate: 'Decide', act: 'Act and check', review: 'Person', counter: 'Store counter' }[ph] || ph;
    lines.push(`<div><div class="eyebrow">${esc(label)} · ${esc(v.mode || '')}${v.mode === 'live' && v.model_tier ? ' · model ' + esc(v.model_tier) : ''}</div>
      ${v.tool_calls ? `<div class="small">${v.tool_calls.length} tool calls, ${v.safety_checks.length} safety checks${v.failures.length ? `, ${v.failures.length} failure${v.failures.length > 1 ? 's' : ''}` : ''}</div>` : ''}
      ${v.decision ? `<div class="small"><b>${esc(v.decision.status)}</b> · ${esc(v.decision.reason)} · cost owner ${esc(v.decision.cost_owner)}</div>` : ''}
      ${v.outcome ? `<div class="small"><b>${esc(v.outcome.status)}</b> · ${esc(v.outcome.chosen?.option || '')} · verified ${v.outcome.verified ? 'yes' : 'no'}${v.outcome.replanned ? ' · ' + esc(v.outcome.replanned) : ''}</div>` : ''}
      ${v.counter ? `<div class="small">Graded ${esc(v.counter.grade)} at ${esc(v.counter.store)} → ${esc(v.counter.destination)}</div>` : ''}
      ${v.review ? `<div class="small">Decision: ${esc(v.review.decision)}${v.review.by ? ' by ' + esc(v.review.by) : ''}</div>` : ''}</div>`);
  }
  const cites = [...new Set(Object.values(p).flatMap(v => (v.observations || []).flatMap(o => o.sources || [])).concat(p.investigate?.decision?.citations || []))];
  return `<div class="card-head"><div><h3>${esc(r.id)} · ${esc(r.return_id)}</h3><div class="small muted">Customer ${esc(r.customer_id)} · opened ${esc(new Date(r.opened).toLocaleString('en-CA'))}</div></div>${UI.downloads ? `<button type="button" class="btn secondary sm" data-dl="${r.id}">${icon('download')}Download JSON</button>` : ''}</div>
    ${lines.join('')}${cites.length ? `<div><div class="eyebrow">Sources</div>${sourcesHTML(cites.slice(0, 12))}</div>` : ''}
    <details><summary>Full record (JSON)</summary><pre>${esc(JSON.stringify(r, null, 1).slice(0, 20000))}</pre></details>`;
}
const FAIR_METRICS = [['human_review', 'Sent to a person'], ['fee_waived', 'Fee waived'], ['offered_exchange', 'Offered an exchange'], ['offered_smart_credit', 'Offered Smart Credit']];
const FAIR_DIMS = [['loyalty_status', 'Loyalty tier'], ['region', 'Region'], ['tenure_band', 'Tenure']];
function fairnessStats(metric) {
  const rows = DATA.decisions_log;
  const overall = rows.filter(r => r[metric]).length / rows.length;
  const out = [];
  for (const [dim, dl] of FAIR_DIMS) {
    const groups = groupBy(rows, dim);
    for (const [g, arr] of Object.entries(groups)) {
      const rate = arr.filter(r => r[metric]).length / arr.length;
      const se = Math.sqrt(Math.max(overall * (1 - overall), 1e-6) / arr.length);
      const gap = rate - overall;
      out.push({ dim, dl, group: g, n: arr.length, rate, gap, z: gap / se, flag: Math.abs(gap) >= 0.05 && Math.abs(gap / se) >= 3 && arr.length >= 30 });
    }
  }
  return { overall, rows: out };
}
function fairnessHTML(metric) {
  const s = fairnessStats(metric);
  const max = Math.ceil(Math.max(0.05, ...s.rows.map(r => r.rate), s.overall) * 1.2 * 20) / 20;
  const flagged = FAIR_METRICS.flatMap(([m, l]) => fairnessStats(m).rows.filter(r => r.flag).map(r => ({ ...r, m, l })));
  const X = v => (v / max * 100).toFixed(2) + '%';
  return `<div class="grid2 g-wide"><div class="card card-pad">
    <div class="small muted" style="margin-bottom:10px">Each dot is one group's rate. The red line is everyone: ${pct(s.overall, 1)}. A flagged group's dot is amber.</div>
    ${FAIR_DIMS.map(([dim, dl]) => `<div class="eyebrow" style="margin:12px 0 6px">${dl}</div>${s.rows.filter(r => r.dim === dim).sort((a, b) => a.group.localeCompare(b.group)).map(r => `<div class="bar-row fair-row" title="${esc(r.group)}: ${pct(r.rate, 1)} of ${r.n} decisions"><span class="lab">${esc(r.group)}</span><span class="bar-track" style="background:transparent;border-bottom:1px solid var(--line);border-radius:0;height:14px"><span style="position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--red);left:${X(s.overall)}"></span><span style="position:absolute;top:2px;width:10px;height:10px;border-radius:50%;background:${r.flag ? 'var(--warn)' : 'var(--chart-1)'};border:2px solid var(--panel);left:calc(${X(r.rate)} - 5px)"></span></span><span class="val">${pct(r.rate, 1)} · n ${r.n}</span></div>`).join('')}`).join('')}
    <div class="bar-row fair-row" style="margin-top:6px" aria-hidden="true"><span></span><span style="display:flex;justify-content:space-between;font-family:var(--f-mono);font-size:11px;color:var(--muted)"><span>0%</span><span>${pct(max / 2, Math.round(max * 500) % 10 ? 1 : 0)}</span><span>${pct(max)}</span></span><span></span></div>
  </div><div class="card card-pad"><div class="eyebrow" style="margin-bottom:8px">Flags across all four measures</div>
    ${flagged.length ? flagged.map(f => `<div style="margin-bottom:12px"><span class="pill warn">${icon('alert')}Review</span> <b>${esc(f.l)}</b>: ${esc(f.dl.toLowerCase())} "${esc(f.group)}" is ${pct(f.rate, 1)} vs ${pct(fairnessStats(f.m).overall, 1)} overall (n ${f.n}).<div class="small muted" style="margin-top:4px">${f.m === 'human_review' && f.dim === 'tenure_band' ? 'Tenure is context only and must never decide a denial. Check whether reviewers or the agent over-escalate new customers, then retest.' : 'Check the cases behind this gap before changing anything.'}</div></div>`).join('') : '<p class="small muted">No group crosses the threshold.</p>'}
  </div></div>`;
}

/* ---------- Data ---------- */
const DATASETS = [
  ['orders', 'Orders', () => DATA.orders.flatMap(o => o.lines.map(l => ({ order_id: o.order_id, customer_id: o.customer_id, order_date: o.order_date, channel: o.channel, sku: l.sku, product: l.product, size: l.size, width: l.width, selling_price: l.selling_price, discount: l.discount, promotion: l.promotion, final_sale: l.final_sale, estimated_delivery_date: o.estimated_delivery_date, delivery_date: o.delivery_date, fulfilment_location: o.fulfilment_location })))],
  ['returns', 'Returns history (28 days)', () => DATA.returns_history],
  ['cases', 'Demo returns', () => DATA.cases.map(k => ({ return_id: k.return_id, order_id: k.order_id, customer_id: k.customer_id, customer_words: k.words, photo: k.photo.file, photo_grade: k.photo.grade, photo_findings: k.photo.findings.join('; ') }))],
  ['customers', 'Customers (no names)', () => DATA.customers.map(({ display_name, custom, ...c }) => ({ ...c, previous_categories: c.previous_categories.join(', ') }))],
  ['history', 'Customer order history', () => HIST_ROWS],
  ['catalogue', 'Product catalogue', () => DATA.catalogue.map(s => ({ ...s, colours: s.colours.join(', '), widths: s.widths.join(', '), sizes: s.sizes.join(' '), similar_styles: s.similar_styles.join(', '), page_note: SYS.pageNotes[s.style_id] || '' }))],
  ['reviews', 'Product reviews', () => DATA.reviews],
  ['inventory', 'Inventory', () => DATA.inventory],
  ['economics', 'Product economics', () => DATA.economics],
  ['stores', 'Stores', () => DATA.locations],
  ['logistics', 'Logistics', () => DATA.logistics.concat(DATA.transfers)],
  ['tracking', 'Carrier tracking', () => DATA.tracking.flatMap(t => t.events.map(e => ({ order_id: t.order_id, date: e[0], event: e[1], location: e[2], exception: e[3] })))],
  ['tryons', 'In-store try-on scans', () => DATA.tryon_scans],
  ['policy', 'Return policy', () => DATA.policy],
  ['decisions', 'Decision log (fairness)', () => DATA.decisions_log],
];
function renderData() {
  if (UI.dataSource === 'actual') return renderActualData();
  const el = $('#tab-data');
  const [id, label, get] = DATASETS.find(d => d[0] === UI.data.ds) || DATASETS[0];
  const all = get();
  const q = UI.data.q.trim().toLowerCase();
  const rows = q ? all.filter(r => JSON.stringify(r).toLowerCase().includes(q)) : all;
  const cols = all.length ? Object.keys(all[0]) : [];
  el.innerHTML = `<div class="section-head"><div><div class="eyebrow">Synthetic data · ALDO's field list</div><h2>The data the agents use</h2><p>${esc(META.note)} Click any source chip in a trace to jump to the rows it cites.</p></div></div>
  <div class="dataset-bar"><label class="sr-only" for="ds">Dataset</label><select id="ds">${DATASETS.map(d => `<option value="${d[0]}" ${d[0] === id ? 'selected' : ''}>${d[1]}</option>`).join('')}</select>
  <label class="sr-only" for="dsq">Filter rows</label><input id="dsq" type="search" placeholder="Filter, e.g. ST-2041" value="${esc(UI.data.q)}"><span class="small muted">${rows.length} of ${all.length} rows${rows.length > 200 ? ' (showing 200)' : ''}</span></div>
  <div class="tbl-wrap data-scroll"><table><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 200).map(r => `<tr>${cols.map(c => { const v = r[c]; return `<td class="${typeof v === 'number' ? 'num' : ''}">${esc(Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v !== null ? JSON.stringify(v) : v)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
}
UI.showSource = src => {
  if (UI.dataSource === 'actual' && !setDataSource('synthetic', false)) return;
  const s = String(src);
  const map = [[/^orders\//, 'orders'], [/^customers\//, 'customers'], [/^carrier_tracking\//, 'tracking'], [/^product_reviews\//, 'reviews'], [/^product_catalogue\//, 'catalogue'], [/^inventory\//, 'inventory'], [/^product_economics\//, 'economics'], [/^returns_history_28d/, 'returns'], [/^returns\//, 'cases'], [/^tryon_scans\//, 'tryons'], [/^logistics/, 'logistics'], [/^(return_policy\/)?§/, 'policy'], [/^units_sold/, 'returns']];
  const hit = map.find(([re]) => re.test(s));
  UI.data.ds = hit ? hit[1] : 'orders';
  const idm = s.match(/(O-\d+|C-\d+|R-\d+|ST-\d+[A-Z0-9.-]*|AC-\d+[A-Z0-9.-]*|§\d+\.\d+)/);
  UI.data.q = idm ? idm[1].replace(/[.,]$/, '') : '';
  if (hit && hit[1] === 'inventory' && idm) UI.data.q = idm[1].split(',')[0];
  showTab('data');
};

/* ---------- How it works ---------- */
const CEDAR = `// Perfect Pair · Resolution agent policy for AgentCore Policy (ENFORCE mode).
// Gateway target "ReturnsTools". Money is passed in integer cents, because
// Cedar compares whole numbers. Anything not permitted is denied, and a
// forbid always wins. Read-only tools get a plain permit (not shown).

// R1 · Money limit (§7.1): the agent alone refunds up to $250.
permit (
  principal,
  action == AgentCore::Action::"ReturnsTools___issue_refund",
  resource == AgentCore::Gateway::"<gateway-arn>"
) when { context.input.amount_cents <= 25000 };

// R1 · Above $250, only a session resumed by an approver (Step Functions).
// Assumes the Gateway passes the caller's role as a principal tag:
// confirm this with the AWS mentors.
permit (
  principal,
  action == AgentCore::Action::"ReturnsTools___issue_refund",
  resource == AgentCore::Gateway::"<gateway-arn>"
) when {
  principal.hasTag("role") && principal.getTag("role") == "approver" &&
  context.input.amount_cents <= 50000
};

// R2 · Smart Credit (§5.1): credit up to $250, bonus at most $25 for 30 days.
permit (
  principal,
  action == AgentCore::Action::"ReturnsTools___issue_store_credit",
  resource == AgentCore::Gateway::"<gateway-arn>"
) when {
  context.input.amount_cents <= 25000 &&
  context.input.bonus_cents <= 2500 &&
  context.input.bonus_valid_days <= 30
};

// R3 · An exchange needs a held pair (§4.2); the Lambda checks the hold.
permit (
  principal,
  action == AgentCore::Action::"ReturnsTools___create_exchange",
  resource == AgentCore::Gateway::"<gateway-arn>"
) when {
  context.input has hold_id &&
  context.input.price_difference_cents <= 5000
};

// R4 · Fees only go down (§3.2): never above $5.95.
permit (
  principal,
  action == AgentCore::Action::"ReturnsTools___create_return_label",
  resource == AgentCore::Gateway::"<gateway-arn>"
) when { context.input.customer_fee_cents <= 595 };

// R7 · Keep-it refunds only under $40 (§6.1); the Lambda checks the rest.
forbid (
  principal,
  action == AgentCore::Action::"ReturnsTools___issue_refund",
  resource == AgentCore::Gateway::"<gateway-arn>"
) when {
  context.input has keep_item && context.input.keep_item &&
  context.input.amount_cents >= 4000
};

// R10 · The agent drafts product page notes; only a merchandiser publishes (§7.3).
permit (
  principal,
  action == AgentCore::Action::"ReturnsTools___update_product_info",
  resource == AgentCore::Gateway::"<gateway-arn>"
) when { principal.hasTag("role") && principal.getTag("role") == "merchandiser" };`;
function renderHow() {
  const el = $('#tab-how');
  const layers = [
    ['Agent brain', 'Live: Claude through Amazon Bedrock on the local server. Scripted: the same tools in a fixed order.', 'Claude on Amazon Bedrock, run by the Strands Agents SDK on AgentCore Runtime; Nova for the fast path.'],
    ['Reading photos', "New customers: Claude looks at the uploaded photo before the agent starts. Scripted: a person grades it.", 'Claude on Bedrock reads the photo inside the check_item_photo Lambda.'],
    ['Customer history', 'An order history for every customer, with margin, return costs and inspection results.', 'S3 and Athena; the profile is a Lambda the approval screen calls.'],
    ['Tools', 'Server-side JavaScript tools and SQLite state in local HTTP mode. Standalone HTML uses browser simulations.', 'AWS Lambda functions behind AgentCore Gateway (MCP), with the same names and schemas.'],
    ['Safety checks', 'A policy engine in code (R1 to R12) runs before every action.', 'Cedar policies in AgentCore Policy on the Gateway, plus the same data checks inside each Lambda.'],
    ['Input and output checks', 'Personal details masked; instructions aimed at the agent flagged; amounts in messages checked.', 'Bedrock Guardrails: sensitive-information filters, prompt-attack filter, grounding check.'],
    ['Data', 'Supplied history in read-only SQLite; synthetic and hybrid operational inputs are labelled separately.', 'DynamoDB for live lookups, S3 and Athena for history, a Bedrock Knowledge Base for the policy.'],
    ['People', 'Approvals and Store counter tabs.', 'Step Functions task tokens pause the workflow until someone approves; screens on AWS Amplify.'],
    ['Trace, audit, tests', 'The reasoning panel, the Audit tab and the Evaluations tab.', 'AgentCore Observability traces; AgentCore Evaluations replays the scenarios.'],
    ['Nightly run', 'The button on the Prevention agent tab.', 'EventBridge Scheduler starts the Prevention agent every night.'],
  ];
  const tools = Object.values(TOOLS);
  el.innerHTML = `<div class="section-head"><div><div class="eyebrow">For the team and the judges</div><h2>How the demo works</h2><p>The agent is given a goal, a set of tools and the rules. It decides which tools to call, reads what comes back and adapts. Every action passes a safety check in code first, so the model can't spend money it isn't allowed to.</p></div></div>
  <div class="card card-pad" style="margin-bottom:16px"><div class="loop">${['Plan', 'Tool call', 'Observe', 'Reflect', 'Next action'].map((s, i) => `${i ? '<span class="arr">→</span>' : ''}<span class="st">${s}</span>`).join('')}<span class="arr">↺</span></div><p class="small muted" style="margin:10px 0 0">Between the agent and every action sits the policy engine. Between the customer and the agent sit the input and output checks.</p></div>
  <h3 style="margin:22px 0 10px">Implemented now, and optional AWS deployment</h3>
  <div class="tbl-wrap"><table><thead><tr><th>Piece</th><th>In this demo</th><th>Future option (not deployed)</th></tr></thead><tbody>${layers.map(l => `<tr><td><b>${esc(l[0])}</b></td><td>${esc(l[1])}</td><td>${esc(l[2])}</td></tr>`).join('')}</tbody></table></div>
  <h3 style="margin:26px 0 10px">Safety rules</h3>
  <div class="tbl-wrap"><table><thead><tr><th>Rule</th><th>What it does</th><th>Policy</th><th>Enforced by</th></tr></thead><tbody>${Object.entries(RULES).map(([id, r]) => `<tr><td><span class="pill ok">${id}</span> <b>${esc(r.name)}</b></td><td>${esc(r.text)}</td><td>${esc(r.clause)}</td><td>${esc(r.where)}</td></tr>`).join('')}</tbody></table></div>
  <details style="margin-top:12px"><summary>The Cedar policies we'll load in AgentCore Policy</summary><pre>${esc(CEDAR)}</pre></details>
  <h3 style="margin:26px 0 10px">Tools</h3>
  <div class="tbl-wrap"><table><thead><tr><th>Tool</th><th>Agent</th><th>What it returns or does</th></tr></thead><tbody>${tools.map(t => `<tr><td><code>${esc(t.name)}</code>${t.gated ? ' <span class="pill ok">checked</span>' : ''}</td><td class="small">${t.group === 'prevent' ? 'Prevention' : 'Resolution'}</td><td class="small">${esc(t.description)}</td></tr>`).join('')}</tbody></table></div>
  <h3 style="margin:26px 0 10px">The exact prompts</h3>
  <p class="small muted" style="margin:0 0 8px">These are sent to Claude in live mode, shown here with Maya's case filled in. Each call is stateless: the page passes the case, the rules and the output format every time.</p>
  <details><summary>Resolution agent · decide</summary><pre>${esc(buildInvestigatePrompt('maya'))}</pre></details>
  <details style="margin-top:8px"><summary>Resolution agent · act and check</summary><pre>${esc(buildActPromptPreview())}</pre></details>
  <details style="margin-top:8px"><summary>Photo check · new customers (sent with the photo)</summary><pre>${esc(buildPhotoPrompt(DATA.cases.find(k => k.custom)?.case_id || 'maya'))}</pre></details>
  <details style="margin-top:8px"><summary>Prevention agent · nightly</summary><pre>${esc(buildPreventionPrompt())}</pre></details>`;
}
function buildActPromptPreview() {
  const cs = CASES.maya;
  if (cs.decision && cs.chosen) return buildActPrompt('maya');
  const saved = { decision: cs.decision, chosen: cs.chosen };
  cs.decision = { options: [{ type: 'exchange', sku: 'ST-2041-BLK-8-W' }], cost_owner: 'aldo_product', cost_owner_evidence: '12 of 40 reviews (30%) report "narrow" and the product page doesn\'t warn.' };
  cs.chosen = { option: 'exchange', method: 'store_dropoff', dropStore: 'S112' };
  const p = buildActPrompt('maya');
  Object.assign(cs, saved);
  return p;
}

/* ---------- events wiring ---------- */
function wire() {
  document.addEventListener('click', async ev => {
    const t = ev.target.closest('button, a');
    if (!t) return;
    if (t.dataset.source) return setDataSource(t.dataset.source);
    if (t.dataset.tab) return showTab(t.dataset.tab);
    if (t.dataset.go) { ev.preventDefault(); return showTab(t.dataset.go); }
    if (t.dataset.case) { STATE.active = t.dataset.case; UI.sel = {}; return renderReturn(); }
    if (t.dataset.newcase) { STATE.active = '__new'; UI.sel = {}; return renderReturn(); }
    if (t.id === 'nc-start') return startNewCustomer();
    if (t.id === 'nc-clear') { Object.assign(UI.nc, { file: null, fileName: '', preview: '', error: '' }); return renderNewForm(); }
    if (t.dataset.profile) { UI.profile = t.dataset.profile; const box = $('#profiles'); if (box) box.outerHTML = profilesSection(); return; }
    if (t.dataset.src) return UI.showSource(t.dataset.src);
    if (t.id === 'start-btn') return startInvestigate();
    if (t.id === 'stop-btn') return stopRun();
    if (t.dataset.choose) { UI.sel = { caseId: STATE.active, option: t.dataset.choose, method: UI.sel.caseId === STATE.active ? UI.sel.method : undefined }; return renderPhone(); }
    if (t.id === 'confirm-btn') return confirmChoice();
    if (t.dataset.restart && BEDROCK_LOCAL) return toast('Open the saved case to continue. Reset demo starts a fresh rehearsal and retains recorded replays.');
    if (t.dataset.restart) { const id = STATE.active; if (IDX.kase[id].custom) IDX.kase[id].photo.analyzed = false; clearCaseRecords(id); CASES[id] = Object.assign(newCaseState(id), { words: CASES[id].words, runId: CASES[id].runId }); UI.sel = {}; renderTabsBar(); return renderReturn(); }
    if (t.id === 'policy-review-btn') return askPolicyReview(STATE.active);
    if (t.dataset.apopen || t.dataset.apfocus || t.dataset.apback) { const id = t.dataset.apfocus || t.dataset.apopen; UI.apFocus = t.dataset.apback || UI.apFocus === id ? null : id; renderApprovals(); const tp = $('#tab-approvals'); if (tp) window.scrollTo({ top: Math.max(0, tp.getBoundingClientRect().top + window.scrollY - 70) }); return; }
    if (t.dataset.dsrc) return setDataSource(t.dataset.dsrc === 'real' ? 'actual' : 'synthetic');
    if (t.dataset.rgran) { UI.rdash.gran = t.dataset.rgran; return renderDashboard(); }
    if (t.dataset.rrange) { UI.rdash.range = t.dataset.rrange; UI.rdash.from = UI.rdash.to = null; return renderDashboard(); }
    if (t.dataset.rclear) { UI.rdash.range = 'all'; UI.rdash.from = UI.rdash.to = null; return renderDashboard(); }
    if (t.dataset.rtarget) { UI.rdash.target = +t.dataset.rtarget; return renderDashboard(); }
    if (t.dataset.dgran) { UI.dash.gran = t.dataset.dgran; return renderDashboard(); }
    if (t.dataset.drange) { UI.dash.range = t.dataset.drange; return renderDashboard(); }
    if (t.dataset.dclear) { UI.dash.range = '12m'; UI.dash.from = UI.dash.to = null; return renderDashboard(); }
    if (t.dataset.copy) { const v = t.dataset.copy; try { navigator.clipboard.writeText(v).then(() => toast(`Copied ${v}`), () => toast(`Copying is blocked here: ${v}`)); } catch (e) { toast(`Copying is blocked here: ${v}`); } return; }
    if (t.dataset.apfilter) { UI.apFilter = t.dataset.apfilter; return renderApprovals(); }
    if (t.dataset.review) { await decideReview(t.dataset.review, t.dataset.choice); renderTabsBar(); if (STATE.tab === 'approvals') renderApprovals(); if (STATE.tab === 'prevention') renderPrevention(); if (STATE.tab === 'store') renderStore(); return; }
    if (t.dataset.counter) { UI.counter = { caseId: t.dataset.counter, store: null, grade: null }; return renderStore(); }
    if (t.dataset.grade) { UI.counter.grade = t.dataset.grade; return renderStore(); }
    if (t.id === 'counter-confirm') { const store = $('#counter-store').value; UI.counter.store = store; await gradeAtCounter(UI.counter.caseId, store, UI.counter.grade); return renderStore(); }
    if (t.id === 'prev-run') return runPrevention();
    if (t.dataset.f4) return measureNow(t.dataset.f4);
    if (t.id === 'eval-all') return runEvalsSeq(DATA.cases.filter(k => k.expect).map(k => k.case_id));
    if (t.dataset.eval) return runEvalsSeq([t.dataset.eval]);
    if (t.dataset.audit) { UI.auditSel = t.dataset.audit; return renderAudit(); }
    if (t.dataset.dl) return downloadAudit(t.dataset.dl);
    if (t.id === 'mode-live' && STATE.live.available) { STATE.mode = 'live'; renderMast(); return renderTab(STATE.tab); }
    if (t.id === 'mode-scripted') { STATE.mode = 'scripted'; renderMast(); return renderTab(STATE.tab); }
    if (t.id === 'theme-btn') return setTheme(isDark() ? 'light' : 'dark', true);
    if (t.id === 'reset-btn') { if (anyBusy()) return toast('Wait for the current run to finish'); await resetAll(); if (STATE.active !== '__new' && !CASES[STATE.active]) STATE.active = 'maya'; UI.sel = {}; UI.counter = { caseId: null }; renderTabsBar(); renderTab(STATE.tab); return toast('Demo reset'); }
  });
  document.addEventListener('change', ev => {
    if (ev.target.dataset && ev.target.dataset.ddate) {
      const v = ev.target.value; if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
      const cur = dashRange(), clampD = d => d < DATA.returns_ledger.start ? DATA.returns_ledger.start : d > META.today ? META.today : d;
      UI.dash.from = new Date(cur.start * 864e5).toISOString().slice(0, 10); UI.dash.to = new Date(cur.end * 864e5).toISOString().slice(0, 10);
      UI.dash[ev.target.dataset.ddate] = clampD(v); UI.dash.range = 'custom';

      return renderDashboard();
    }
    if (ev.target.dataset && ev.target.dataset.rdate) {
      const v = ev.target.value; if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
      const cur = realRange(), clampD = d => d < REAL.start ? REAL.start : d > REAL.end ? REAL.end : d;
      UI.rdash.from = isoOf(cur.start); UI.rdash.to = isoOf(cur.end); UI.rdash[ev.target.dataset.rdate] = clampD(v); UI.rdash.range = 'custom';
      return renderDashboard();
    }
    if (ev.target.dataset && ev.target.dataset.rfilter) { UI.rdash[ev.target.dataset.rfilter] = ev.target.value; return renderDashboard(); }
    if (ev.target.dataset && ev.target.dataset.dfilter) { UI.dash[ev.target.dataset.dfilter] = ev.target.value; return renderDashboard(); }
    const t = ev.target;
    if (t.id === 'tier') { STATE.tier = t.value; return; }
    if (t.id === 'failsw') { STATE.failureSwitch = t.checked; return toast(t.checked ? 'The first pair reserved will sell mid-reservation' : 'Reservations will go through first time'); }
    if (t.id === 'ds') { UI.data = { ds: t.value, q: '' }; return renderData(); }
    if (t.id === 'counter-store') { UI.counter.store = t.value; return; }
    if (t.name === 'method') { UI.sel.method = t.value === 'carrier' ? 'carrier' : 'store_dropoff'; return; }
    if (t.id === 'fair-metric') { UI.fair.metric = t.value; return renderAudit(); }
    if (t.id === 'nc-region') { UI.nc.region = t.value; return; }
    if (t.id === 'nc-style') { UI.nc.style = t.value; UI.nc.sku = ''; return renderNewForm(); }
    if (t.id === 'nc-colour') { UI.nc.colour = t.value; UI.nc.sku = ''; return renderNewForm(); }
    if (t.id === 'nc-sku') { UI.nc.sku = t.value; return; }
    if (t.id === 'nc-grade') { UI.nc.grade = t.value; return; }
    if (t.id === 'nc-matches') { UI.nc.matches = t.checked; return; }
    if (t.id === 'nc-file' && t.files && t.files[0]) return takeFile(t.files[0]);
  });
  document.addEventListener('input', ev => {
    const t = ev.target;
    if (t.id === 'words') CASES[STATE.active].words = t.value;
    if (t.id === 'nc-name') UI.nc.name = t.value;
    if (t.id === 'nc-days') UI.nc.days = t.value;
    if (t.id === 'nc-words') UI.nc.words = t.value;
    if (t.id === 'ap-q') { UI.apQuery = t.value; clearTimeout(UI._apq); UI._apq = setTimeout(() => { const pos = t.selectionStart; UI.apFocus = null; renderApprovals(); const n = $('#ap-q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* not supported */ } } }, 160); }
    if (t.id === 'dsq') { UI.data.q = t.value; clearTimeout(UI._q); UI._q = setTimeout(() => { const pos = t.selectionStart; renderData(); const n = $('#dsq'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* not supported */ } }, 160); }
  });
  // drop a photo on the new-customer form
  document.addEventListener('dragover', ev => { const z = ev.target.closest && ev.target.closest('#nc-drop'); if (z) { ev.preventDefault(); z.classList.add('over'); } });
  document.addEventListener('dragleave', ev => { const z = ev.target.closest && ev.target.closest('#nc-drop'); if (z) z.classList.remove('over'); });
  document.addEventListener('drop', ev => { const z = ev.target.closest && ev.target.closest('#nc-drop'); if (!z) return; ev.preventDefault(); const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]; if (f) takeFile(f); });
  // one tooltip for every chart mark (hover or keyboard focus)
  const tip = document.createElement('div'); tip.className = 'viz-tip'; tip.hidden = true; document.body.appendChild(tip);
  const show = (target, x, y) => {
    tip.replaceChildren(...String(target.getAttribute('data-tip') || '').split('\n').map((line, i) => { const d = document.createElement('div'); if (i === 0) d.className = 'v'; d.textContent = line; return d; }));
    tip.hidden = false;
    const r = tip.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    tip.style.left = Math.max(8, Math.min(vw - r.width - 8, x + 14)) + 'px';
    tip.style.top = (y - r.height - 12 < 8 ? y + 18 : y - r.height - 12) + 'px';
  };
  document.addEventListener('pointermove', ev => { const t = ev.target.closest && ev.target.closest('[data-tip]'); if (t) show(t, ev.clientX, ev.clientY); else if (!tip.hidden && !(document.activeElement && document.activeElement.matches && document.activeElement.matches('[data-tip]'))) tip.hidden = true; });
  document.addEventListener('focusin', ev => { const t = ev.target.closest && ev.target.closest('[data-tip]'); if (t) { const r = t.getBoundingClientRect(); show(t, r.left + r.width / 2, r.top); } });
  document.addEventListener('focusout', () => { tip.hidden = true; });
  window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
  window.addEventListener('resize', () => moveInk(false));
}
async function downloadAudit(id) {
  const r = STATE.audit.find(a => a.id === id); if (!r || !UI.downloads) return;
  try { await UI.downloads.save({ filename: `${r.id}-${r.return_id}.json`, data: JSON.stringify(r, null, 2) }); toast('Saved'); }
  catch (e) { if (e && e.code !== 'declined') toast('This view can\'t save files'); }
}

/* ---------- light and dark mode ---------- */
function isDark() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t) return t === 'dark';
  try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; }
}
function renderThemeBtn() {
  const b = $('#theme-btn'); if (!b) return;
  const dark = isDark();
  b.innerHTML = `${icon(dark ? 'sun' : 'moon')}<span>${dark ? 'Light' : 'Dark'}</span>`;
  b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}
function setTheme(mode, animate) {
  const root = document.documentElement;
  if (animate && !REDUCED) { root.classList.add('theme-anim'); setTimeout(() => root.classList.remove('theme-anim'), 500); }
  root.setAttribute('data-theme', mode);
  try { localStorage.setItem('pp-theme', mode); } catch (e) { /* storage unavailable */ }
  renderThemeBtn();
  if (STATE.tab === 'prevention') renderPrevention();
}

/* ---------- boot ---------- */
function boot() {
  try { const t = localStorage.getItem('pp-theme'); if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t); } catch (e) { /* storage unavailable */ }
  renderBarcode(); wire(); renderThemeBtn();
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderThemeBtn); } catch (e) { /* old browser */ }
  // Every load starts fresh on the Return tab; a link ending in #prevention (or any tab id) opens that tab.
  const hash = (location.hash || '').replace('#', '');
  const tab = TABS.some(t => t[0] === hash) ? hash : 'return';
  renderMast(); showTab(tab);
  const use = window.claude && typeof window.claude.use === 'function' ? n => window.claude.use(n) : () => Promise.resolve(null);
  getLiveSample().then(async s => {
    STATE.live.checked = true;
    if (!s) { if (!BEDROCK_LOCAL) STATE.live.reason = 'For Amazon Bedrock, start the local Perfect Pair server and use Connect AWS. Claude-hosted pages can also use the live agent. The scripted backup is ready.'; renderMast(); return; }
    let lim = null; try { lim = await s.limits(); } catch (e) { lim = null; }
    if (lim && !lim.tools) { STATE.live.reason = "This viewer can't run the agent's tools, so the live agent is off. Using the scripted backup."; renderMast(); return; }
    const need = Math.max(INVESTIGATE_TOOLS.length, PREVENT_TOOLS.length, ...Object.values(ACT_TOOLS).map(a => a.length));
    if (lim && lim.tools && lim.tools.maxCount && lim.tools.maxCount < need) { STATE.live.reason = `This viewer allows ${lim.tools.maxCount} tools per call and the agent needs ${need}. Using the scripted backup.`; renderMast(); return; }
    STATE.live.sample = s; STATE.live.available = true; STATE.live.limits = lim; STATE.live.images = !!(lim && lim.images);
    if (!anyBusy() && !BEDROCK_LOCAL) STATE.mode = 'live';
    renderMast(); if (STATE.tab === 'return' || STATE.tab === 'evals') renderTab(STATE.tab);
  }).catch(() => { STATE.live.reason = 'Could not reach Claude from this page. Using the scripted backup.'; renderMast(); });
  use('downloads').then(d => { UI.downloads = d || null; if (STATE.tab === 'audit') renderAudit(); }).catch(() => {});
  initPhotoStore();
}
UI.onPhotosChanged = () => { if (['approvals', 'store', 'return'].includes(STATE.tab) && !STATE.running) renderTab(STATE.tab); };
