/* =====================================================================
   Who decides what, and the store associate's screen.
   Store associates handle most requests, high-value returns included (up to
   $1,000), and a pair the store check found worse than its photo. Only the
   trickiest go to a store manager: suspected abuse, policy exceptions and
   anything over $1,000. Product page changes go to HQ (merchandiser).
   The associate's screen shows the same customer section, value and
   satisfaction charts as the manager's, then the agent's tier for the
   customer, the customer's own words, the options and the product facts.
   ===================================================================== */
META.tier1_limit = 1000;   // a store associate approves up to $1,000
function reviewRole(r) {
  if (!r) return 'associate';
  // A threat to post in public is the store manager's: it can affect the whole region.
  if (r.kind === 'reputation' || (r.case_id && CASES[r.case_id] && CASES[r.case_id].flags && CASES[r.case_id].flags.reputation)) return 'manager';
  // A store-check mismatch goes to whoever's scope it falls in: set when the counter raises it.
  if (r.kind === 'counter') return r.scope || ((r.amount || 0) > META.tier1_limit ? 'manager' : 'associate');
  if (r.kind === 'page_fix' || r.kind === 'policy') return 'manager';
  const cs = r.case_id && CASES[r.case_id];
  if (r.tier === 2 || (cs && cs.flags && cs.flags.suspected_abuse)) return 'manager';
  if ((r.amount || 0) > META.tier1_limit) return 'manager';
  return 'associate';
}
function roleWord(r) { return r.kind === 'page_fix' ? 'Merchandiser (HQ)' : reviewRole(r) === 'manager' ? 'Store manager' : 'Store associate'; }
function whyManager(r) {
  if (r.kind === 'reputation' || (r.case_id && CASES[r.case_id]?.flags?.reputation)) return 'The customer threatens a public post: a reputation risk for the store and the region.';
  if (r.kind === 'counter') return r.scope_why || 'The store check found the pair in worse condition than the customer\'s photo, and the history has other mismatches.';
  if (r.kind === 'policy') return 'The customer is asking for an exception to the policy.';
  if (r.kind === 'page_fix') return 'A product page change: HQ approves it.';
  const cs = r.case_id && CASES[r.case_id];
  if (cs && cs.flags && cs.flags.suspected_abuse || r.tier === 2) return 'The photo or the history doesn\'t support the claim: possible abuse.';
  if ((r.amount || 0) > META.tier1_limit) return `Over the associate limit of ${money(META.tier1_limit)}.`;
  return '';
}

/* ---------- The agent's customer tier ----------
   Worked out in code from behaviour only (never region, age or loyalty programme):
   lifetime value rank, how often their returns matched what they said, how often
   they return against the average, and how long they've shopped with ALDO. The
   cut-offs come from the customer base itself: the top 5% are Diamond, the next
   10% Platinum, then Gold (20%), Silver (30%) and Bronze. Two overrides: too
   little history is New; returns that often don't match, or several recent
   damage claims, are Watch. A tier changes how much benefit of the doubt and
   which offer comes first. It never refuses a return (§7.2). */
const TIER_DEFS = {
  diamond: { name: 'Diamond', band: 'Top 5% of customers', handle: 'Approve without extra checks and lead with the exchange or credit with a bonus. Thank them.' },
  platinum: { name: 'Platinum', band: 'Next 10%', handle: 'Approve without extra checks; offer the exchange or a bonus first.' },
  gold: { name: 'Gold', band: 'Next 20%', handle: 'Approve on the evidence; offer the exchange or store credit before a refund.' },
  silver: { name: 'Silver', band: 'Next 30%', handle: 'Standard handling: approve on the evidence.' },
  bronze: { name: 'Bronze', band: 'The rest', handle: 'Standard handling. Check the pair at drop-off before anything is paid.' },
  new: { name: 'New', band: 'Fewer than 3 orders', handle: 'No history to judge by: the same policy as everyone, nothing extra.' },
  watch: { name: 'Watch', band: 'Returns that often don\'t match', handle: 'Inspect the pair in hand before approving. The tier alone never refuses a return.' },
};
const TIER_ORDER = ['diamond', 'platinum', 'gold', 'silver', 'bronze', 'new', 'watch'];
let TIER_CACHE = null;
function tierParts(p) {
  const valuePct = p.rank ? 1 - (p.rank - 1) / Math.max(1, p.of - 1) : 0;
  const genuine = p.genuine_share == null ? 0.85 : p.genuine_share;
  const rr = p.avg_return_rate ? p.return_rate / p.avg_return_rate : 1;
  const parts = { value: 45 * valuePct, genuine: 25 * genuine, returns: 20 * clamp((2 - rr) / 1.5, 0, 1), tenure: 10 * Math.min(1, (p.tenure || 0) / 60) };
  let score = parts.value + parts.genuine + parts.returns + parts.tenure;
  if (p.claims_90d >= 2) score -= 15;
  return { score: r2(score), parts, valuePct, genuine, rr };
}
function tierTable() {
  if (TIER_CACHE) return TIER_CACHE;
  const rows = [];
  for (const c of DATA.customers) { const p = customerProfile(c.customer_id); if (p && p.past.length >= 3) rows.push(tierParts(p).score); }
  rows.sort((a, b) => b - a);
  const at = q => rows[Math.min(rows.length - 1, Math.floor(rows.length * q))] ?? 0;
  TIER_CACHE = { n: rows.length, cut: { diamond: at(0.05), platinum: at(0.15), gold: at(0.35), silver: at(0.65) } };
  return TIER_CACHE;
}
function customerTier(cid, caseId) {
  const p = customerProfile(cid); if (!p) return null;
  const T = tierTable(), x = tierParts(p), reasons = [];
  let k;
  if (p.past.length < 3) k = 'new';
  else if ((p.inspected >= 2 && p.genuine_share < 0.75) || p.claims_90d >= 2) k = 'watch';
  else k = x.score >= T.cut.diamond ? 'diamond' : x.score >= T.cut.platinum ? 'platinum' : x.score >= T.cut.gold ? 'gold' : x.score >= T.cut.silver ? 'silver' : 'bronze';
  if (p.rank) reasons.push(x.valuePct >= 0.5 ? `In the top ${Math.max(1, Math.ceil((1 - x.valuePct) * 100))}% of customers by lifetime value` : `In the bottom ${Math.max(1, Math.ceil(x.valuePct * 100))}% by lifetime value`);
  if (p.inspected) reasons.push(`${p.matched} of ${p.inspected} inspected returns matched what they said`);
  else if (p.past.length >= 3) reasons.push('No returns inspected yet');
  if (p.past.length >= 3) reasons.push(x.rr <= 0.8 ? 'Returns less often than most customers' : x.rr >= 1.5 ? 'Returns more often than most customers' : 'Returns about as often as most customers');
  if (p.tenure >= 12) reasons.push(`Shopping with ALDO for ${tenureWords(p.tenure)}`);
  if (p.claims_90d >= 2) reasons.push(`${p.claims_90d} damage claims in the last 90 days`);
  const br = bracketingSignal(cid, caseId);
  if (br) reasons.push('Often buys two sizes and returns one: offer a size recommendation');
  return { k, ...TIER_DEFS[k], score: x.score, reasons, bracketing: !!br };
}
/* The tier as an emblem: a metal shield with the tier's mark. Same shapes in both themes. */
const EMBLEM = {
  diamond: ['#9CCBFF', '#1F5FB8', '#FFFFFF', '<path d="M22 30l5-7h10l5 7-10 15z" fill="G"/><path d="M22 30h20M27 23l5 7 5-7M32 30v15" stroke="S" stroke-width="1.4" fill="none" opacity=".55"/>'],
  platinum: ['#F1F3F7', '#7D8496', '#3B4150', '<path d="M32 21l3.2 9.8L45 34l-9.8 3.2L32 47l-3.2-9.8L19 34l9.8-3.2z" fill="G"/>'],
  gold: ['#FBE38E', '#B07D0B', '#FFFFFF', '<path d="M20 43l2-14 6.5 7L32 26l3.5 10 6.5-7 2 14z" fill="G"/><circle cx="22" cy="28" r="2" fill="G"/><circle cx="32" cy="24.5" r="2" fill="G"/><circle cx="42" cy="28" r="2" fill="G"/>'],
  silver: ['#F3F4F6', '#8C939E', '#3B4150', '<path d="M32 22l3.5 7.6 8.3.9-6.2 5.6 1.8 8.2L32 40.1l-7.4 4.2 1.8-8.2-6.2-5.6 8.3-.9z" fill="G"/>'],
  bronze: ['#EDB27E', '#87491A', '#FFFFFF', '<circle cx="32" cy="34" r="9" fill="none" stroke="G" stroke-width="2.6"/><circle cx="32" cy="34" r="3.6" fill="G"/>'],
  new: ['#B8EBC9', '#2F7D52', '#FFFFFF', '<path d="M32 46V32" stroke="G" stroke-width="2.6" stroke-linecap="round"/><path d="M32 34c0-7-5-11-12-11 0 7 5 11 12 11zM32 31c0-6 4-9 10-9 0 6-4 9-10 9z" fill="G"/>'],
  watch: ['#F8B4B4', '#B42318', '#FFFFFF', '<path d="M19 34c3.5-6 8-9 13-9s9.5 3 13 9c-3.5 6-8 9-13 9s-9.5-3-13-9z" fill="none" stroke="G" stroke-width="2.4"/><circle cx="32" cy="34" r="4.2" fill="G"/>'],
};
let EMB_N = 0;
function tierEmblem(t, size = 18) {
  if (!t || !EMBLEM[t.k]) return '';
  const [hi, lo, glyph, mark] = EMBLEM[t.k], id = `emb${++EMB_N}`;
  return `<svg class="emblem" width="${size}" height="${Math.round(size * 72 / 64)}" viewBox="0 0 64 72" role="img" aria-label="${esc(t.name)} emblem"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></linearGradient></defs>
    <path d="M32 3l26 9v22c0 18-12 29-26 35C18 63 6 52 6 34V12z" fill="url(#${id})" stroke="${lo}" stroke-width="2"/>
    <path d="M32 8.5l21 7.3V34c0 14.6-9.6 23.9-21 29-11.4-5.1-21-14.4-21-29V15.8z" fill="none" stroke="#FFFFFF" stroke-opacity=".45" stroke-width="1.6"/>
    ${mark.replace(/"G"/g, `"${glyph}"`).replace(/"S"/g, `"${lo}"`)}</svg>`;
}
const tierBadge = (t, big) => t ? `<span class="tier tier-${t.k}${big ? ' big' : ''}" data-tip="${esc(`${t.name} · ${t.band}\n${t.reasons.join('\n')}`)}">${tierEmblem(t, big ? 20 : 15)}${esc(t.name)}</span>` : '';
/** The large emblem with what it means, at the top of a customer section. */
function tierHeader(t) {
  if (!t) return '';
  return `<div class="tier-head tier-${t.k}"><div class="th-emb">${tierEmblem(t, 64)}</div><div class="th-main"><div class="th-name">${esc(t.name)} customer</div><div class="small">${esc(t.band)} · tier set by the agent</div><div class="small muted">${esc(t.handle)}</div></div>
    <ul class="th-why small">${t.reasons.map(z => `<li>${esc(z)}</li>`).join('')}</ul></div>`;
}
const freqWord = p => !p.past.length ? 'No orders yet' : p.return_rate <= p.avg_return_rate * 0.8 ? 'Low' : p.return_rate >= p.avg_return_rate * 1.5 ? 'High' : 'Average';

/* ---------- Exchange for an associate decision ---------- */
const AS_SUB_ISSUE = { too_narrow: 'too_narrow', too_tight: 'too_narrow', too_wide: 'too_wide', too_big: 'too_big', heel_slips: 'heel_slips', too_small: 'too_small', too_short: 'too_small' };
function associateExchange(caseId) {
  const { line, c } = caseCtx(caseId), cs = CASES[caseId] || {};
  // An exchange only when it fixes what went wrong: a better fit, or a new pair for a faulty or damaged one.
  if (!['fit', 'quality', 'damage'].includes(cs.reasonCode)) return null;
  const issue = cs.reasonCode === 'fit' ? (AS_SUB_ISSUE[cs.subReason] || 'too_big') : 'like_for_like';
  let cands = [];
  try { cands = TOOLS.find_exchange_options.run({ style_id: line.style_id, size: line.size, width: line.width === 'W' ? 'wide' : 'regular', colour: line.colour, issue, customer_region: c.region }).candidates; } catch (e) { cands = []; }
  for (const cand of cands) {
    const o = scoreOptions(caseId, cs.costOwner || cs.decision?.cost_owner || 'customer', [{ type: 'exchange', sku: cand.sku }]).options[0];
    if (o && o.eligible) return Object.assign(o, { change: cand.change });
  }
  return null;
}

/* ---------- The store associate's screen ---------- */
function associateReviews() { return Object.values(SYS.reviews).filter(r => r.status !== 'superseded' && reviewRole(r) === 'associate'); }
function renderAssociate() {
  const el = $('#tab-associate'); if (!el) return;
  UI.asSeen = UI.asSeen || new Set(); UI.asFilter = UI.asFilter || 'pending';
  for (const r of associateReviews()) if (!UI.asSeen.has(r.id)) { UI.asSeen.add(r.id); if (!r.queue && r.status === 'pending') UI.asFocus = r.id; }
  const all = associateReviews().sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || slaInfo(a).left - slaInfo(b).left);
  const pend = all.filter(r => r.status === 'pending'), mgr = Object.values(SYS.reviews).filter(r => r.status === 'pending' && reviewRole(r) === 'manager').length;
  if (UI.asFocus && !all.some(r => r.id === UI.asFocus)) UI.asFocus = null;
  if (UI.asFocus) {
    const list = all.filter(r => UI.asFilter === 'all' || (UI.asFilter === 'pending') === (r.status === 'pending')), L = list.some(r => r.id === UI.asFocus) ? list : all;
    const at = L.findIndex(r => r.id === UI.asFocus), prev = L[(at - 1 + L.length) % L.length], next = L[(at + 1) % L.length];
    el.innerHTML = `<div class="ap-focusbar"><button type="button" class="btn secondary sm" data-asback="1">← All requests (${all.length})</button><span class="small muted">Request ${at + 1} of ${L.length}</span>
      ${L.length > 1 ? `<span class="ap-nav"><button type="button" class="btn secondary sm" data-asopen="${prev.id}">← Previous</button><button type="button" class="btn secondary sm" data-asopen="${next.id}">Next →</button></span>` : ''}</div>${associateDetail(L[at])}`;
    applyConsentGates(el); countUp(el); return;
  }
  const shown = all.filter(r => UI.asFilter === 'all' || (UI.asFilter === 'pending') === (r.status === 'pending'));
  el.innerHTML = `<div class="section-head"><div><div class="eyebrow">Approvals · store associates</div><h2>Returns waiting for you</h2><p>The agent has already checked the order, the photos, the policy and the stock, and recommends one way to settle each return. You can approve up to ${money(META.tier1_limit)}. You also decide when the store check finds a pair worse than its photo. Only suspected abuse, policy exceptions and anything over ${money(META.tier1_limit)} go to a manager${mgr ? ` (${mgr} waiting with them now)` : ''}.</p></div></div>
    <div class="as-bar"><div class="seg dseg" role="group" aria-label="Show">${[['pending', `Waiting · ${pend.length}`], ['done', `Done · ${all.length - pend.length}`], ['all', 'All']].map(([k, l]) => `<button type="button" data-asfilter="${k}" aria-pressed="${UI.asFilter === k}">${l}</button>`).join('')}</div>
      <span class="small muted">Sorted by time left before it goes to the manager.</span></div>
    ${shown.length ? `<div class="as-list">${shown.map(associateRow).join('')}</div>` : `<div class="empty"><b>${Object.keys(SYS.reviews).length ? 'Nothing here.' : 'No returns yet.'}</b>${UI.asFilter === 'pending' ? "Returns land here when the agent needs a person to settle them. Switch to Customer, run Elena's $289 return or Noah's unclear photo, then come back here." : 'No requests yet.'}</div>`}`;
  countUp(el);
}
function associateRow(r) {
  const k = r.case_id && IDX.kase[r.case_id], line = k ? caseCtx(r.case_id).line : null, t = k ? customerTier(k.customer_id, r.case_id) : null, x = slaInfo(r), h = slaHTML(r);
  const thumb = k ? casePhotos(r.case_id)[0] : null;
  return `<button type="button" class="as-row${t ? ` trow-${t.k}` : ''}${r.status !== 'pending' ? ' done' : ''}${r.status === 'pending' && x.escalated ? ' late' : ''}" data-asopen="${r.id}">
    <span class="ap-thumb">${thumb ? (thumb.img ? `<img src="${esc(thumb.img)}" alt="">` : thumb.svg) : icon('user')}</span>
    <span class="as-main"><span class="as-what"><b>${esc(line ? line.product : KIND_LABEL[r.kind] || 'Request')}</b>${line ? `<span class="muted"> · size ${esc(line.size)}${line.width === 'W' ? ' wide' : ''}</span>` : ''}</span>
      <span class="as-ids small muted">Order <b class="mono">${esc(k ? k.order_id : '—')}</b> · Customer <b class="mono">${esc(k ? k.customer_id : '—')}</b> · ${esc(r.id)}</span>
      <span class="as-ask small">${esc(asAsk(r))}</span></span>
    <span class="as-side">${repFlag(r.case_id)}${tierBadge(t)}<b class="mono">${line ? money(line.selling_price) : ''}</b><span class="small ${r.status === 'pending' ? (x.escalated ? 'bad' : x.left < 3600000 ? 'warnc' : 'muted') : 'muted'}">${r.status === 'pending' ? esc(x.escalated ? `Overdue by ${h.big}` : `${h.big} left`) : esc(REVIEW_WORD[r.decision] || 'decided')}</span></span>
  </button>`;
}
/** One plain sentence: what's being asked, without internal codes. */
function asAsk(r) {
  const k = r.case_id && IDX.kase[r.case_id];
  if (r.kind === 'chat') return 'The customer asked for a person in the chat.';
  if (!k) return r.reason;
  const cs = CASES[r.case_id] || {}, reason = { fit: 'Doesn\'t fit', change_of_mind: 'Changed their mind', quality: 'Quality problem', damage: 'Arrived damaged', late: 'Arrived late', expectations: 'Not as expected' }[cs.reasonCode] || 'Return';
  return `${reason}: "${(k.words || '').split(/(?<=[.!?])\s/)[0]}"`;
}
function associateDetail(r) {
  const k = r.case_id && IDX.kase[r.case_id];
  if (!k) return `<article class="card card-pad as-detail"><h3>${esc(KIND_LABEL[r.kind] || 'Request')}</h3><p>${esc(r.reason)}</p>${r.status === 'pending' && r.kind === 'chat' ? `<button type="button" class="btn sm" data-review="${r.id}" data-choice="resolve">Mark as answered</button>` : ''}</article>`;
  const { line, o } = caseCtx(r.case_id), cs = CASES[r.case_id] || {}, p = customerProfile(k.customer_id), t = customerTier(k.customer_id, r.case_id);
  const pending = r.status === 'pending', x = slaInfo(r), h = slaHTML(r);
  if (r.kind === 'counter') return associateCounterDetail(r, k, line, o, p, t, pending, x, h);
  // Options, in the order the agent recommends, with what the customer gets (no costs or margins).
  const ex = associateExchange(r.case_id), co = creditOptions(r.case_id).options;
  const owner = cs.decision?.cost_owner || cs.costOwner || 'customer', fee = owner === 'customer' ? META.mail_fee : 0;
  const opts = [];
  if (ex) opts.push({ key: 'approve_exchange', title: `Exchange for ${skuShort(ex.sku, r.case_id)}`, sub: `${ex.change}. In stock at ${ex.source_name}; arrives in ${ex.arrives_in_days} business day${ex.arrives_in_days > 1 ? 's' : ''}. Free for the customer.`, v: ex.value_to_aldo, why: 'Keeps the sale and fixes the problem.' });
  for (const c of co) opts.push({ key: c.key, title: c.key === 'approve_credit' ? `Store credit ${money(line.selling_price)}` : c.key === 'approve_credit_bonus' ? `Store credit ${money(line.selling_price)} + ${money(c.bonus)} bonus` : `Smart Credit ${money(line.selling_price)} + ${money(c.bonus)} bonus`, sub: c.key === 'approve_credit' ? 'Never expires. Added after the pair is checked.' : c.key === 'approve_credit_bonus' ? 'Bonus valid 30 days in store (§5.1). Added after the pair is checked.' : 'Credit, a bonus and picks held for them in store.', v: c.value, why: 'Keeps the money with ALDO.' });
  opts.push({ key: 'approve_refund', title: `Refund ${money(line.selling_price)}`, sub: `To the original card after the pair is checked${fee ? `; ${money(fee)} label if mailed, free in store` : ', no fee'}.`, v: creditOptions(r.case_id).refund, why: '' });
  // The tier changes which offer leads: top tiers get the exchange or a bonus first; Watch leads with what keeps the pair in hand.
  const order = t && ['diamond', 'platinum'].includes(t.k) ? ['approve_exchange', 'approve_credit_bonus', 'approve_smart_credit', 'approve_credit', 'approve_refund'] : null;
  let best = opts.reduce((a, b) => (b.v > a.v ? b : a));
  if (order) best = order.map(key => opts.find(z => z.key === key)).find(Boolean) || best;
  const rest = opts.filter(z => z !== best);
  const authority = line.selling_price <= META.tier1_limit;
  if (pending) r.agent_rec = best.key;   // kept so the manager's audit can compare
  const recoText = `${best.why ? best.why + ' ' : ''}${t ? `${t.name} customer: ${t.handle.charAt(0).toLowerCase() + t.handle.slice(1)}` : ''}`;
  // Product facts that bear on the decision.
  const rr = returnRateReport().find(z => z.style_id === line.style_id), pr = productStats(line.style_id);
  const fitNote = SYS.pageNotes[line.style_id] || (IDX.style[line.style_id].fit_guidance || '');
  const stockN = ex ? stockRows(ex.sku, caseCtx(r.case_id).c.region, 5).rows.reduce((s2, z) => s2 + z.available, 0) : 0;
  const days = daysBetween(o.delivery_date, META.today), win = META.return_window_days + (caseCtx(r.case_id).c.loyalty_status === 'Gold' ? META.gold_extension_days : 0);
  return `<article class="card as-detail">
    <header class="as-head"><div class="as-head-main"><div class="eyebrow">${esc(r.id)} · ${esc(KIND_LABEL[r.kind] || 'Return review')}</div><h3>${esc(line.product)} <span class="muted">· ${esc(line.colour)}, size ${esc(line.size)}${line.width === 'W' ? ' wide' : ''}</span></h3>
      <div class="as-idrow small"><span>Order <b class="mono">${esc(o.order_id)}</b><button type="button" class="ap-copy" data-copy="${esc(o.order_id)}" aria-label="Copy order number">${icon('copy')}</button></span><span>Customer <b class="mono">${esc(k.customer_id)}</b><button type="button" class="ap-copy" data-copy="${esc(k.customer_id)}" aria-label="Copy customer ID">${icon('copy')}</button></span><span>Return <b class="mono">${esc(k.return_id)}</b></span><span>Paid <b>${money(line.selling_price)}</b>${line.final_sale ? ' · final sale' : ''}</span></div></div>
      <div class="as-clock ${pending ? (x.escalated ? 'bad' : x.left < 3600000 ? 'warnc' : '') : ''}">${pending ? `<b>${esc(h.big)}</b><span class="small">${esc(h.lab || '')}${h.small ? ` · ${esc(h.small)}` : ''}</span>` : `<span class="pill ok">${esc(REVIEW_WORD[r.decision] || 'Decided')}</span>`}</div></header>
    <div class="as-top">${apCustomerSection(r, true)}</div>
    <div class="as-grid">
      <section class="as-sec as-reco"><div class="as-label">${icon('check')}The agent recommends</div><div class="as-best">${esc(best.title)}</div><p class="small">${esc(best.sub)}</p><p class="small muted">${esc(recoText)}</p>
        ${pending ? `${consentHTML(r)}<div class="ap-actions"><button type="button" class="btn" data-review="${r.id}" data-choice="${best.key}" ${authority ? '' : 'disabled'}>${esc(best.key === 'approve_refund' ? 'Approve the refund' : best.key === 'approve_exchange' ? 'Approve the exchange' : 'Offer this')}</button></div>
        <div class="as-label" style="margin-top:12px">Other ways to settle it</div><ul class="as-opts">${rest.map(z => `<li><button type="button" class="as-opt" data-review="${r.id}" data-choice="${z.key}" ${authority ? '' : 'disabled'}><b>${esc(z.title)}</b><span class="small muted">${esc(z.sub)}</span></button></li>`).join('')}
          <li><button type="button" class="as-opt" data-review="${r.id}" data-choice="more_info"><b>Ask for more photos</b><span class="small muted">The customer gets a message; the request waits.</span></button></li>
          <li><button type="button" class="as-opt" data-review="${r.id}" data-choice="decline"><b>Decline: the pair is worn (§2.4)</b><span class="small muted">Only when the pair shows wear. The customer can ask a manager to look again.</span></button></li></ul>` : `<p class="small"><b>Decision:</b> ${esc(r.decided_by || '')} ${esc(REVIEW_WORD[r.decision] || r.decision || '')}.</p>`}
        ${!authority ? `<p class="small bad">Over your ${money(META.tier1_limit)} limit: a manager decides this one.</p>` : ''}</section>
      <div class="as-col"><section class="as-sec"><div class="as-label">${icon('user')}What the customer said</div><blockquote class="ap-words">${esc(k.words)}</blockquote>
        ${photoStrip(r.case_id, { small: true })}<p class="small muted">Photo check: grade ${esc(k.photo.grade)}, ${esc(GRADE[k.photo.grade].toLowerCase())}${k.photo.consistent === false ? '. <b>Doesn\'t match what they said.</b>' : '. Matches what they said.'}</p></section>

      <section class="as-sec"><div class="as-label">${icon('flag')}About this product</div>
        <dl class="as-kv">${rr ? `<dt>Fit returns</dt><dd>${pct(rr.fit_return_rate, 1)} <span class="muted">vs ${pct(rr.category_rate, 1)} for similar styles${rr.ratio >= 1.5 ? ' · high' : ''}</span></dd>` : ''}
          ${pr && pr.top ? `<dt>Main reason</dt><dd>${esc(pr.top)}</dd>` : ''}
          ${fitNote ? `<dt>Fit</dt><dd>${esc(fitNote)}</dd>` : ''}
          <dt>Exchange stock</dt><dd>${ex ? `${skuShort(ex.sku, r.case_id)}: ${stockN} nearby` : 'No better fit in stock nearby'}</dd>
          <dt>Return window</dt><dd>${days} of ${win} days used${days <= win ? '' : ' · <b>outside the window</b>'}</dd></dl></section></div>
    </div>
    <div class="as-top"><div class="as-econ">${econPanel(r)}</div>${satisfactionPanel(r.case_id, r)}${routingPanel(r.case_id)}</div>
  </article>`;
}
/** A short product summary: the top reason in reviews and returns. */
function productStats(styleId) {
  const rs = (DATA.returns_history || []).filter(x => x.style_id === styleId);
  if (!rs.length) return null;
  const c = {}; for (const x of rs) { const kk = (x.return_sub_reason || x.return_reason || '').replace(/_/g, ' '); if (kk) c[kk] = (c[kk] || 0) + 1; }
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return { n: rs.length, top: top ? `${top[0]} (${rs.length < 10 ? `${top[1]} of ${rs.length}` : pct(top[1] / rs.length)} returns)` : '' };
}

/* ---------- Manager: audit what the associates decided ----------
   Every associate decision lands here: in this session, plus the past two weeks
   (only returns run on the customer's screen in this demo). The audit flags
   decisions that went against the agent, refunds for Watch-tier customers, and
   anything a manager should look at twice. */
let AUDIT_SEED = null;
function auditSeed() {
  if (!sampleQueueOn()) return [];
  if (AUDIT_SEED) return AUDIT_SEED;
  const pool = DATA.customers.filter(c => (IDX.histByCust[c.customer_id] || []).length >= 3 && !DATA.cases.some(k => k.customer_id === c.customer_id));
  const styles = DATA.catalogue.filter(s => s.price >= 60).slice(0, 14);
  const plan = [['fit', 'approve_exchange', 'approve_exchange'], ['change_of_mind', 'approve_credit', 'approve_credit'], ['damage', 'approve_refund', 'approve_refund'], ['fit', 'approve_exchange', 'approve_refund'], ['late', 'approve_refund', 'approve_refund'],
    ['change_of_mind', 'approve_credit_bonus', 'approve_credit_bonus'], ['quality', 'approve_refund', 'approve_refund'], ['damage', 'decline', 'approve_refund'], ['fit', 'approve_exchange', 'approve_exchange'], ['change_of_mind', 'approve_credit', 'approve_credit_bonus'],
    ['expectations', 'approve_credit', 'approve_credit'], ['fit', 'approve_exchange', 'approve_exchange'], ['quality', 'approve_refund', 'decline'], ['change_of_mind', 'approve_credit', 'approve_credit']];
  const stores = DATA.locations.filter(l => l.type === 'store');
  // Pick customers so the audit shows each kind of flag: a refund for a Watch-tier customer (row 8) and a declined top-tier customer (row 13).
  const byTier = {}; for (const c of pool) { const t = customerTier(c.customer_id); (byTier[t.k] = byTier[t.k] || []).push(c); }
  const want = { 7: ['watch', 'bronze'], 12: ['diamond', 'platinum'] }, used = new Set();
  const pick = i => { for (const k of (want[i] || [])) { const c = (byTier[k] || []).find(x => !used.has(x.customer_id)); if (c) { used.add(c.customer_id); return c; } } const c = pool.find((x, j) => j >= (i * 3) % pool.length && !used.has(x.customer_id)) || pool[i % pool.length]; used.add(c.customer_id); return c; };
  AUDIT_SEED = plan.map(([reason, rec, did], i) => {
    const c = pick(i), st = styles[i % styles.length], t = customerTier(c.customer_id);
    const at = Date.now() - (i * 23 + 5) * 3600000, mins = 4 + ((i * 7) % 26);
    return { id: `HR-39${String(10 + i).padStart(2, '0')}`, seeded: true, decided_at: at, minutes: mins, store: stores[i % stores.length].name, associate: `Associate ${String.fromCharCode(65 + (i % 5))}.`,
      product: styleName(st.style_id), amount: st.price, customer_id: c.customer_id, tier: t, reason, rec, did };
  });
  return AUDIT_SEED;
}
function auditRows() {
  const live = Object.values(SYS.reviews).filter(r => r.status !== 'pending' && r.status !== 'superseded' && !r.auto && reviewRole(r) === 'associate' && r.case_id && IDX.kase[r.case_id]).map(r => {
    const { k, line } = caseCtx(r.case_id), t = customerTier(k.customer_id, r.case_id);
    return { id: r.id, live: true, decided_at: r.decided_at, minutes: Math.max(1, Math.round((r.decided_at - r.requested_at) / 60000)), store: 'This demo', associate: 'You', product: line.product, amount: line.selling_price, customer_id: k.customer_id, tier: t, reason: (CASES[r.case_id] || {}).reasonCode || '', rec: r.agent_rec || '', did: r.decision, consent: r.consent };
  });
  return live.concat(auditSeed()).map(a => {
    const flags = [];
    if (a.rec && a.did !== a.rec && !(a.rec === 'approve_exchange' && a.did === 'approve_credit')) flags.push('Went against the agent');
    if (a.tier && a.tier.k === 'watch' && a.did === 'approve_refund') flags.push('Refund for a Watch-tier customer');
    if (a.tier && ['diamond', 'platinum'].includes(a.tier.k) && ['decline', 'decline_return'].includes(a.did)) flags.push('Declined a top-tier customer');
    if (a.did === 'decline_return' && !flags.length) flags.push('Declined after the store check (spot check)');
    if (a.did === 'approve_credit_bonus' && a.rec === 'approve_credit') flags.push('Added a bonus the agent didn\'t suggest');
    if (a.amount > 250 && !flags.length && a.did === 'approve_refund') flags.push('High-value refund (spot check)');
    const st = (STATE.auditMarks || {})[a.id];
    return { ...a, flags, mark: st };
  }).sort((a, b) => b.decided_at - a.decided_at);
}
function managerAuditHTML() {
  const rows = auditRows(), flagged = rows.filter(a => a.flags.length), followed = rows.filter(a => a.rec && (a.did === a.rec)).length, withRec = rows.filter(a => a.rec).length;
  const f = UI.auditFilter || 'flagged', shown = f === 'flagged' ? flagged : rows;
  const tiers = {}; for (const c of DATA.customers) { const t = customerTier(c.customer_id); if (t) tiers[t.k] = (tiers[t.k] || 0) + 1; }
  const tTot = Object.values(tiers).reduce((s, v) => s + v, 0);
  const DO = { release_refund: 'Released the refund', release_credit: 'Added the credit', ship_exchange: 'Shipped the exchange', convert_credit: 'Store credit instead', decline_return: 'Declined (§2.4)', ask_customer: 'Asked the customer', accept: 'Accepted the pair', credit_no_bonus: 'Credit, no bonus', approve_exchange: 'Exchange', approve_credit: 'Store credit', approve_credit_bonus: 'Credit + bonus', approve_smart_credit: 'Smart Credit', approve_refund: 'Refund', decline: 'Declined', more_info: 'Asked for photos' };
  return `<div class="section-head" style="margin-top:36px"><div><div class="eyebrow">Manager · audit</div><h2>What the associates decided</h2><p>Every decision a store associate made, with the agent's recommendation next to it. The audit flags the ones worth a second look: going against the agent, refunds for Watch-tier customers, declines of top-tier customers, bonuses the agent didn't suggest, and a sample of high-value refunds.</p></div></div>
    <div class="stat-row ap-stats"><div class="stat"><div class="l">Decisions by associates</div><div class="v">${rows.length}</div><div class="s">from returns run in this demo</div></div>
      <div class="stat"><div class="l">Followed the agent</div><div class="v">${withRec ? pct(followed / withRec) : '—'}</div><div class="s">${followed} of ${withRec}</div></div>
      <div class="stat${flagged.length ? ' alarm' : ''}"><div class="l">Flagged for review</div><div class="v">${flagged.length}</div><div class="s">${flagged.filter(a => a.mark).length} reviewed</div></div>
      <div class="stat"><div class="l">Median time to decide</div><div class="v">${rows.length ? Math.round(rows.map(a => a.minutes).sort((a, b) => a - b)[Math.floor(rows.length / 2)]) + ' min' : '—'}</div><div class="s">from request to decision</div></div></div>
    <div class="seg dseg" role="group" aria-label="Show" style="margin:4px 0 10px">${[['flagged', `Flagged · ${flagged.length}`], ['all', `All · ${rows.length}`]].map(([k, l]) => `<button type="button" data-auditf="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div>
    <div class="tbl-wrap"><table class="audit-tbl"><thead><tr><th>Request</th><th>Item</th><th>Customer tier</th><th>Agent recommended</th><th>Associate did</th><th>Flags</th><th>Review</th></tr></thead><tbody>
    ${shown.map(a => `<tr><td><b class="mono">${esc(a.id)}</b><div class="small muted">${esc(a.associate)} · ${esc(a.store)}<br>${esc(fmtWhen(a.decided_at))} · ${a.minutes} min</div></td><td>${esc(a.product)}<div class="small muted">${money(a.amount)} · ${esc(reasonWord(a.reason))}</div></td>
      <td>${tierBadge(a.tier)}</td><td class="small">${esc(DO[a.rec] || '—')}</td><td class="small"><b>${esc(DO[a.did] || a.did || '')}</b>${a.consent ? `<div class="muted">customer agreed ${esc(a.consent.how)}</div>` : ''}</td>
      <td class="small">${a.flags.length ? a.flags.map(x => `<span class="pill ${AUDIT_PILL(x)}">${esc(x)}</span>`).join(' ') : '<span class="muted">—</span>'}</td>
      <td>${a.mark ? `<span class="pill ${a.mark === 'ok' ? 'ok' : 'bad'}">${a.mark === 'ok' ? 'Looks right' : 'Follow up'}</span>` : `<div class="audit-act"><button type="button" class="btn secondary sm" data-auditmark="${a.id}" data-v="ok">Looks right</button><button type="button" class="btn secondary sm" data-auditmark="${a.id}" data-v="follow">Follow up</button></div>`}</td></tr>`).join('') || `<tr><td colspan="7" class="small muted">${rows.length ? 'Nothing flagged.' : 'No associate decisions yet. Approve a return in the Store associate view and it is audited here.'}</td></tr>`}
    </tbody></table></div>
    <h3 style="margin:26px 0 8px">How the agent tiers customers</h3>
    <p class="small muted" style="margin:0 0 8px">Worked out from behaviour in the order history (lifetime value, whether past returns matched what was said, how often they return, how long they've shopped), with cut-offs set from the customer base itself. ${tierTable().n} customers have enough history to be ranked.</p>
    <div class="tier-mix">${TIER_ORDER.filter(kk => tiers[kk]).map(kk => `<div class="tm-row"><span class="tier tier-${kk}">${esc(TIER_DEFS[kk].name)}</span><span class="tm-bar"><i style="width:${(tiers[kk] / tTot * 100).toFixed(1)}%"></i></span><span class="mono small">${tiers[kk]}</span><span class="small muted">${esc(TIER_DEFS[kk].band)} · ${esc(TIER_DEFS[kk].handle)}</span></div>`).join('')}</div>`;
}
document.addEventListener('click', ev => {
  const t = ev.target.closest('button'); if (!t) return;
  if (t.dataset.asopen) { UI.asFocus = t.dataset.asopen; renderAssociate(); const p = $('#tab-associate'); if (p) window.scrollTo({ top: Math.max(0, p.getBoundingClientRect().top + window.scrollY - 70) }); return; }
  if (t.dataset.asback) { UI.asFocus = null; return renderAssociate(); }
  if (t.dataset.asfilter) { UI.asFilter = t.dataset.asfilter; return renderAssociate(); }
  if (t.dataset.auditf) { UI.auditFilter = t.dataset.auditf; return renderApprovals(); }
  if (t.dataset.auditmark) { STATE.auditMarks = STATE.auditMarks || {}; STATE.auditMarks[t.dataset.auditmark] = t.dataset.v; toast(t.dataset.v === 'ok' ? 'Marked as right' : 'Marked for a follow-up with the associate'); return renderApprovals(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && UI.viewMenu) { UI.viewMenu = false; renderTabsBar(); const b = document.getElementById('vm-btn'); if (b) b.focus(); } });

/* ---------- A store-check mismatch, settled by the associate ----------
   The counter only grades the pair; the decision comes here, with the agent's
   recommendation, the three grades and the photos side by side. */
function associateCounterDetail(r, k, line, o, p, t, pending, x, h) {
  const co = counterOptions(r.case_id), best = co.best, rest = co.options.filter(z => z !== best), g = co.grades;
  if (pending) r.agent_rec = best.key;
  const btn = z => `<li><button type="button" class="as-opt" data-review="${r.id}" data-choice="${z.key}"><b>${esc(z.label)}</b><span class="small muted">${esc(z.note || z.rule || '')}</span></button></li>`;
  return `<article class="card as-detail">
    <header class="as-head"><div class="as-head-main"><div class="eyebrow">${esc(r.id)} · Store check mismatch</div><h3>${esc(line.product)} <span class="muted">· ${esc(line.colour)}, size ${esc(line.size)}</span></h3>
      <div class="as-idrow small"><span>Order <b class="mono">${esc(o.order_id)}</b></span><span>Customer <b class="mono">${esc(k.customer_id)}</b></span><span>Paid <b>${money(line.selling_price)}</b></span><span>Checked at <b>${esc(IDX.loc[co.store] ? IDX.loc[co.store].name : co.store)}</b></span></div></div>
      <div class="as-clock ${pending ? (x.escalated ? 'bad' : x.left < 3600000 ? 'warnc' : '') : ''}">${pending ? `<b>${esc(h.big)}</b><span class="small">${esc(h.lab || '')}${h.small ? ` · ${esc(h.small)}` : ''}</span>` : `<span class="pill ok">${esc(DO_COUNTER[r.decision] || 'Decided')}</span>`}</div></header>
    <div class="as-top">${apCustomerSection(r, true)}</div>
    <div class="as-grid">
      <section class="as-sec as-reco"><div class="as-label">${icon('check')}The agent recommends</div><div class="as-best">${esc(best.label)}</div><p class="small">${esc(best.note || '')}</p><p class="small muted">${esc(co.why)}</p>
        ${pending ? `${consentHTML(r)}<div class="ap-actions"><button type="button" class="btn" data-review="${r.id}" data-choice="${best.key}">${esc(best.label)}</button></div>
          <div class="as-label" style="margin-top:12px">Other ways to settle it</div><ul class="as-opts">${rest.map(btn).join('')}</ul>` : `<p class="small"><b>Decision:</b> ${esc(r.decided_by || '')} · ${esc(DO_COUNTER[r.decision] || r.decision || '')}</p>`}</section>
      <div class="as-col"><div class="as-sec as-pc">${photoCompare(r.case_id)}</div>
      <section class="as-sec"><div class="as-label">${icon('user')}What the customer said</div><blockquote class="ap-words">${esc(k.words)}</blockquote></section>
</div>
    </div><div class="as-top"><div class="as-econ">${econPanel(r)}</div>${satisfactionPanel(r.case_id, r)}${routingPanel(r.case_id)}</div></article>`;
}
const DO_COUNTER = { release_refund: 'Released the refund', release_credit: 'Added the credit', ship_exchange: 'Shipped the exchange', convert_credit: 'Store credit instead', decline_return: 'Declined (§2.4)', ask_customer: 'Asked the customer', accept: 'Accepted the pair', credit_no_bonus: 'Credit, no bonus' };
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-goreview]'); if (!b) return;
  const rv = SYS.reviews[b.dataset.goreview]; if (!rv) return;
  if (reviewRole(rv) === 'associate') { UI.asFocus = rv.id; showTab('associate'); }
  else { UI.apFocus = rv.id; UI.apFilter = 'manager'; showTab('approvals'); }
  window.scrollTo({ top: 0 });
});

/** For the associate: what the pair is worth, then satisfaction against profit for each option. */
function asWorth(caseId, r) {
  const e = returnEconomics(caseId);
  return `<section class="as-sec as-worth"><div class="as-label">${icon('data')}What this pair is worth</div>
    <div class="stat-row econ-tiles"><div class="stat"><div class="l">Price paid</div><div class="v">${money(e.price)}</div></div><div class="stat"><div class="l">Our cost</div><div class="v">${money(e.cost)}</div></div><div class="stat"><div class="l">Gross margin</div><div class="v">${money(e.margin)}</div><div class="s">${pct(e.margin_pct)} of the price</div></div></div>
    ${satisfactionPanel(caseId, r)}</section>`;
}

/** Each audit flag in its own colour, so the kinds read at a glance. */
const AUDIT_PILL = x => /against the agent/.test(x) ? 'info' : /Watch-tier/.test(x) ? 'bad' : /top-tier/.test(x) ? 'violet' : /bonus/.test(x) ? 'warn' : /store check/.test(x) ? 'orange' : /High-value/.test(x) ? 'teal' : 'warn';
