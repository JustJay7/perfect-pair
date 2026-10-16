'use strict';
/* =====================================================================
   Perfect Pair demo · core
   Data indexes, simulated ALDO systems, the policy engine (rules in code,
   outside the model) and the tools both agents call.
   ===================================================================== */

/* ---------- data and indexes ---------- */
const DATA = JSON.parse(document.getElementById('pp-data').textContent);
const META = DATA.meta;
const byKey = (arr, k) => Object.fromEntries(arr.map(r => [r[k], r]));
const groupBy = (arr, k) => arr.reduce((m, r) => ((m[r[k]] = m[r[k]] || []).push(r), m), {});
const IDX = {
  loc: byKey(DATA.locations, 'location_id'),
  style: byKey(DATA.catalogue, 'style_id'),
  econ: byKey(DATA.economics, 'style_id'),
  sku: byKey(DATA.skus, 'sku'),
  cust: byKey(DATA.customers, 'customer_id'),
  order: byKey(DATA.orders, 'order_id'),
  track: byKey(DATA.tracking, 'order_id'),
  clause: byKey(DATA.policy, 'clause_id'),
  kase: byKey(DATA.cases, 'case_id'),
  kaseByReturn: byKey(DATA.cases, 'return_id'),
  invBySku: groupBy(DATA.inventory, 'sku'),
  revByStyle: groupBy(DATA.reviews, 'style_id'),
  retByStyle: groupBy(DATA.returns_history, 'style_id'),
  tryByStyle: groupBy(DATA.tryon_scans, 'style_id'),
  units28: Object.fromEntries(DATA.sales_28d.map(r => [r.style_id, r.units_sold_28d])),
  ship: Object.fromEntries(DATA.logistics.map(r => [r.origin + '|' + r.destination_region, r])),
  xfer: Object.fromEntries(DATA.transfers.map(r => [r.origin + '|' + r.destination, r])),
};

/* ---------- small utilities ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r2 = n => Math.round(n * 100) / 100;
const r3 = n => Math.round(n * 1000) / 1000;
const money = n => (n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyShort = n => (n < 0 ? '−' : '') + '$' + (Math.abs(n) % 1 ? Math.abs(n).toFixed(2) : Math.abs(n).toFixed(0));
const pct = (x, d = 0) => (x * 100).toFixed(d) + '%';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const dayNum = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const daysBetween = (a, b) => dayNum(b) - dayNum(a);
const addDays = (iso, n) => new Date((dayNum(iso) + n) * 864e5).toISOString().slice(0, 10);
const fmtDate = iso => new Date(dayNum(iso) * 864e5).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
function addBusinessDays(iso, n) {
  let d = iso, left = n;
  while (left > 0) { d = addDays(d, 1); const wd = new Date(dayNum(d) * 864e5).getUTCDay(); if (wd !== 0 && wd !== 6) left--; }
  return d;
}
const singular = s => (s || '').endsWith('s') ? s.slice(0, -1) : s;
const styleName = id => { const s = IDX.style[id]; return s ? `${s.name} ${singular(s.subcategory).toLowerCase()}` : id; };
const isAccessory = styleId => IDX.style[styleId]?.category === 'Accessories';
const widthWord = w => w === 'W' ? 'wide' : (w === 'M' ? 'regular' : '');
function skuLabel(sku) {
  const s = IDX.sku[sku]; if (!s) return sku;
  const base = styleName(s.style_id);
  if (s.size === 'OS') return `${base}, ${s.colour.toLowerCase()}`;
  return `${base}, size ${s.size}${s.width === 'W' ? ' wide' : ''}, ${s.colour.toLowerCase()}`;
}
const fmtSize = x => { const n = Number(x); return Number.isInteger(n) ? String(n) : String(n); };
function normSize(x) { const n = Number(String(x).replace(/[^0-9.]/g, '')); return Number.isFinite(n) && n > 0 ? fmtSize(n) : String(x); }
function normWidth(x) { const s = String(x || '').toLowerCase(); return s.startsWith('w') ? 'W' : (s === '' ? '' : 'M'); }
function makeSku(styleId, colour, size, width) {
  const code = Object.entries({ BLK: 'Black', COG: 'Cognac', WHT: 'White', TAN: 'Tan', GLD: 'Gold', NUD: 'Nude' }).find(([, v]) => v === colour)?.[0] || colour;
  return isAccessory(styleId) ? `${styleId}-${code}-OS` : `${styleId}-${code}-${fmtSize(size)}-${width}`;
}

/* ---------- simulated ALDO systems (reset per demo) ---------- */
const SYS = {};
function resetSystems() {
  Object.assign(SYS, {
    seq: 4100, holds: {}, exchanges: {}, credits: {}, refunds: {}, labels: {}, claims: {}, routes: {},
    reviews: {}, drafts: {}, tickets: {}, pageNotes: {}, sold: {}, soldBy: {}, measuring: {}, log: [],
  });
}
resetSystems();
const nextId = p => `${p}-${++SYS.seq}`;
function clearCaseRecords(caseId) {
  for (const m of ['holds', 'exchanges', 'credits', 'refunds', 'labels', 'claims']) for (const [id, r] of Object.entries(SYS[m])) if (r.case_id === caseId) delete SYS[m][id];
  for (const [id, r] of Object.entries(SYS.reviews)) if (r.case_id === caseId) delete SYS.reviews[id];
  delete SYS.routes[caseId];
  for (const key of (SYS.soldBy[caseId] || [])) SYS.sold[key] = Math.max(0, (SYS.sold[key] || 0) - 1);
  delete SYS.soldBy[caseId];
}
function pairPhrase(sku) {
  const s = IDX.sku[sku]; if (!s) return sku;
  const st = IDX.style[s.style_id];
  const noun = singular(st.subcategory).toLowerCase();
  if (s.size === 'OS') return `${st.name} ${noun}`;
  return `${st.name} ${noun}s in size ${s.size}${s.width === 'W' ? ' wide' : ''}`;
}
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][((n % 100) - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
function invRow(sku, loc) { return (IDX.invBySku[sku] || []).find(r => r.location_id === loc); }
function atp(sku, loc) {
  const r = invRow(sku, loc); if (!r) return 0;
  const held = Object.values(SYS.holds).filter(h => h.sku === sku && h.location_id === loc && (h.status === 'allocated' || (h.status === 'held' && Date.now() - h.created < META.hold_hours * 3600000))).length;
  return Math.max(0, r.available_to_promise - held - (SYS.sold[sku + '|' + loc] || 0));
}
function weeksOfSupply(sku, loc) {
  const r = invRow(sku, loc); if (!r) return 0;
  const rate = r.units_sold_8w / 8;
  return rate > 0 ? Math.min(52, r.on_hand_quantity / rate) : 52;
}
function styleWOS(styleId) {
  let on = 0, sold = 0;
  for (const s of DATA.skus) if (s.style_id === styleId) for (const r of (IDX.invBySku[s.sku] || [])) { on += r.on_hand_quantity; sold += r.units_sold_8w / 8; }
  return sold > 0 ? Math.min(52, on / sold) : 52;
}

/* ---------- case helpers ---------- */
function caseCtx(caseId) {
  const k = IDX.kase[caseId];
  const o = IDX.order[k.order_id];
  const line = o.lines.find(l => l.line_id === k.line_id) || o.lines[0];
  return { k, o, line, c: IDX.cust[k.customer_id], st: IDX.style[line.style_id], ec: IDX.econ[line.style_id] };
}
function caseByReturnId(returnId) {
  const k = IDX.kaseByReturn[String(returnId || '').trim()];
  if (!k) throw new Error(`No return found with id ${returnId}. Use the return_id from the case.`);
  return k;
}
/* ---------- a new customer, added live from the Return tab ----------
   Builds the same records a real return has (customer, order, tracking, case)
   so every tool and rule works unchanged. Removed again by Reset demo. */
let CUSTOM_SEQ = 0;
function createCustomCase(spec) {
  const n = ++CUSTOM_SEQ;
  const s = IDX.sku[spec.sku]; if (!s) throw new Error('Pick a product, colour and size.');
  const st = IDX.style[s.style_id];
  const days = clamp(Math.round(Number(spec.days_since_delivery) || 0), 0, 120);
  const delivered = addDays(META.today, -days);
  const cid = `C-9${String(9000 + n)}`, oid = `O-6${String(1000 + n)}`, rid = `R-9${String(1000 + n)}`, caseId = `new${n}`;
  const name = String(spec.name || '').trim().slice(0, 24) || 'Alex';
  const price = st.price;
  const c = { customer_id: cid, display_name: name, country: 'CA', region: spec.region || 'Greater Montreal', loyalty_status: 'Member', customer_tenure_months: 0,
    lifetime_orders: 1, lifetime_spend: price, number_of_returns: 0, return_rate: 0, average_order_value: price, preferred_channel: 'Online',
    previous_categories: [], credit_issued: 0, credit_used: 0, credit_returned: 0, keepit_last_12m: 0, damage_claims_90d: 0, custom: true };
  const o = { order_id: oid, customer_id: cid, order_date: addDays(delivered, -4), channel: 'Online', country: 'CA', store_or_ecom: 'E-commerce',
    lines: [{ line_id: 'L1', sku: s.sku, style_id: s.style_id, product: styleName(s.style_id), colour: s.colour, size: s.size, width: s.width, quantity: 1, selling_price: price, discount: 0, promotion: '', final_sale: false }],
    shipping_method: 'Standard', shipping_cost: 0, fulfilment_location: 'DC-MTL', estimated_delivery_date: delivered, delivery_date: delivered, custom: true };
  const t = { order_id: oid, events: [[addDays(delivered, -3), 'Picked up', 'Montreal', ''], [addDays(delivered, -1), 'In transit', 'Montreal sort centre', ''], [delivered, 'Delivered', spec.region || 'Greater Montreal', '']], custom: true };
  const words = String(spec.words || '').trim();
  const k = { case_id: caseId, label: name, tag: 'New customer', headline: `${styleName(s.style_id)}, ${words.split(/[.!?]/)[0].slice(0, 48) || 'a new return'}`,
    customer_id: cid, order_id: oid, line_id: 'L1', return_id: rid, words, custom: true, expect: null,
    photo: Object.assign({ file: spec.photo_name || 'photo.jpg', grade: spec.grade || 'A', consistent: spec.matches !== false, matches_order: spec.matches === false ? false : null, findings: [], analyzed: false }, spec.photo || {}) };
  DATA.customers.push(c); DATA.orders.push(o); DATA.tracking.push(t); DATA.cases.push(k);
  IDX.cust[cid] = c; IDX.order[oid] = o; IDX.track[oid] = t; IDX.kase[caseId] = k; IDX.kaseByReturn[rid] = k;
  return k;
}
function removeCustomCases() {
  for (const k of DATA.cases.filter(x => x.custom)) {
    clearCaseRecords(k.case_id);
    delete IDX.cust[k.customer_id]; delete IDX.order[k.order_id]; delete IDX.track[k.order_id]; delete IDX.kase[k.case_id]; delete IDX.kaseByReturn[k.return_id];
    if (typeof CASES !== 'undefined') delete CASES[k.case_id];
  }
  for (const key of ['cases', 'customers', 'orders', 'tracking']) { const keep = DATA[key].filter(x => !x.custom); DATA[key].length = 0; DATA[key].push(...keep); }
  if (typeof STATE !== 'undefined') STATE.audit = STATE.audit.filter(a => IDX.kase[a.case_id]);
}
const GRADE = {
  A: 'Unworn: resell at full price',
  B: 'Tried on indoors or cosmetic marks: outlet',
  C: 'Worn: liquidation or donation',
  D: 'Defective: quarantine and supplier claim',
};

/* ---------- facts the policy engine reads (from data, never from the model) ---------- */
function fitFacts(styleId) {
  const revs = IDX.revByStyle[styleId] || [];
  const st = IDX.style[styleId];
  const page = ((st?.fit_guidance || '') + ' ' + (SYS.pageNotes[styleId] || '')).toLowerCase();
  const warns = { narrow: /narrow|wide fit/.test(page), runs_large: /large|size down/.test(page), runs_small: /small|size up/.test(page) };
  const issues = ['narrow', 'runs_small', 'runs_large'].map(t => {
    const count = revs.filter(r => r.fit_feedback === t).length;
    const share = revs.length ? count / revs.length : 0;
    return { issue: t, count, share: r3(share), page_warns: warns[t], meets_rule: share >= META.fit_rule.min_share && count >= META.fit_rule.min_points && !warns[t] };
  });
  return { n: revs.length, issues };
}
const SUB_TO_ISSUE = { too_narrow: 'narrow', too_tight: 'narrow', too_big: 'runs_large', heel_slips: 'runs_large', too_small: 'runs_small', too_short: 'runs_small' };
function waiverBasis(caseId) {
  const { k, o, line } = caseCtx(caseId);
  const cs = CASES[caseId] || {};
  const basis = [];
  const t = IDX.track[o.order_id];
  if (t && t.events.some(e => /damaged/i.test(e[3] || ''))) basis.push({ owner: 'carrier', why: 'Tracking shows the parcel was damaged in transit', customer: 'the parcel was damaged on its way to you', source: `carrier_tracking/${o.order_id}` });
  const late = daysBetween(o.estimated_delivery_date, o.delivery_date);
  if (late >= 1) basis.push({ owner: 'carrier', why: `Delivered ${late} day${late > 1 ? 's' : ''} after the estimated date`, customer: 'your order arrived late', source: `orders/${o.order_id}.delivery_date` });
  if (k.photo.damage_type === 'shipping' && k.photo.consistent !== false && !basis.some(b => b.owner === 'carrier')) basis.push({ owner: 'carrier', why: 'The photo shows the item was damaged in shipping', customer: 'it was damaged on its way to you', source: `returns/${k.return_id}/photo` });
  if (k.photo.grade === 'D') basis.push({ owner: 'supplier', why: 'The photo shows a manufacturing defect', customer: 'the item has a defect', source: `returns/${k.return_id}/photo` });
  if (cs.reasonCode === 'fit' || cs.reasonCode === 'comfort') {
    const want = SUB_TO_ISSUE[cs.subReason];
    const hit = fitFacts(line.style_id).issues.find(i => i.meets_rule && (!want || i.issue === want));
    if (hit) basis.push({ owner: 'aldo_product', why: `${hit.count} of ${fitFacts(line.style_id).n} reviews (${pct(hit.share)}) report "${hit.issue.replace('_', ' ')}" and the product page doesn't warn`, customer: `our product page didn't mention that this style ${hit.issue === 'narrow' ? 'runs narrow' : hit.issue.replace('_', ' ')}`, source: `product_reviews/${line.style_id}` });
  }
  return basis;
}
function trustedForEarlyRefund(c) { return (c.loyalty_status === 'Gold' || c.loyalty_status === 'Silver') && c.return_rate <= 0.20; }

/* ---------- routing of the returned pair ---------- */
function routeScores(caseId, grade, origin) {
  const { line, ec, st } = caseCtx(caseId);
  const price = st.price, cost = ec.estimated_cost;
  const out = [];
  const tr = (a, b) => a === b ? { cost: 0, carbon: 0, days: 0 } : { cost: IDX.xfer[a + '|' + b]?.estimated_shipping_cost ?? 6, carbon: IDX.xfer[a + '|' + b]?.carbon_kg ?? 0.8, days: IDX.xfer[a + '|' + b]?.typical_transit_days ?? 2 };
  if (grade === 'A') {
    for (const L of DATA.locations) {
      const t = tr(origin, L.location_id);
      if (L.type === 'outlet') {
        const p = 0.8; out.push({ location_id: L.location_id, name: L.name, type: L.type, p_sell_4w: p, transfer_cost: t.cost, carbon_kg: t.carbon, score: r2((price * 0.7 - cost) * p - t.cost), why: 'Sells at 30% off' });
        continue;
      }
      const r = invRow(line.sku, L.location_id);
      const sold = r ? r.units_sold_8w : 0, onh = Math.max(0, (r ? r.on_hand_quantity : 0) - (SYS.sold[line.sku + '|' + L.location_id] || 0));
      const p = 1 - Math.exp(-(sold / 8) * 4 / (onh + 1));
      const why = sold === 0 ? 'No recent sales of this size' : (onh === 0 ? `Sold out of size ${line.size}; sold ${sold} in 8 weeks` : `${onh} in stock; sold ${sold} in 8 weeks`);
      out.push({ location_id: L.location_id, name: L.name, type: L.type, p_sell_4w: r2(p), transfer_cost: t.cost, carbon_kg: t.carbon, score: r2((price - cost) * p - t.cost), why });
    }
  } else if (grade === 'B') {
    const t = tr(origin, 'OUT1');
    out.push({ location_id: 'OUT1', name: IDX.loc.OUT1.name, type: 'outlet', p_sell_4w: 0.8, transfer_cost: t.cost, carbon_kg: t.carbon, score: r2((price * 0.6 - cost) * 0.8 - t.cost), why: 'Cosmetic marks: sells at 40% off' });
  } else if (grade === 'C') {
    out.push({ location_id: 'LIQ', name: 'Liquidation or donation partner', type: 'partner', p_sell_4w: 1, transfer_cost: 4, carbon_kg: 0.6, score: r2(price * 0.08 - 4), why: 'Worn: not resellable as new' });
  } else {
    out.push({ location_id: 'QTN', name: 'Quarantine (supplier claim)', type: 'quarantine', p_sell_4w: 0, transfer_cost: 0, carbon_kg: 0, score: 0, why: 'Defective: held for the supplier claim' });
  }
  return out.sort((a, b) => b.score - a.score);
}
function bestDropOffStore(caseId) {
  const { k, c } = caseCtx(caseId);
  if (k.photo.grade !== 'A') return null;
  const stores = DATA.locations.filter(l => l.type === 'store' && l.region === c.region);
  let best = null;
  for (const s of stores) {
    const sc = routeScores(caseId, 'A', s.location_id)[0];
    if (sc.location_id === s.location_id && (!best || sc.score > best.score)) best = { ...sc, store: s };
  }
  if (!best && stores.length) best = { location_id: stores[0].location_id, name: stores[0].name, store: stores[0], score: 0, why: 'Nearest store' };
  return best;
}

/* ---------- stock rows used by several tools ---------- */
function stockRows(sku, region, limit = 5) {
  const rows = [];
  for (const L of DATA.locations) {
    if (L.type === 'outlet') continue;
    const a = atp(sku, L.location_id);
    if (a <= 0) continue;
    const sh = IDX.ship[L.location_id + '|' + region] || { estimated_shipping_cost: 14, typical_transit_days: 5, carbon_kg: 2 };
    const wos = weeksOfSupply(sku, L.location_id);
    rows.push({
      location_id: L.location_id, name: L.name, type: L.type, available: a, ships_in_days: sh.typical_transit_days,
      ship_cost: sh.estimated_shipping_cost, carbon_kg: sh.carbon_kg, meets_promise: sh.typical_transit_days <= META.delivery_promise_days,
      weeks_of_supply: Math.round(wos * 10) / 10, sells_slowly: wos >= 12,
    });
  }
  rows.sort((a, b) => (b.meets_promise - a.meets_promise) || (b.sells_slowly - a.sells_slowly) || (a.ship_cost - b.ship_cost) || (a.ships_in_days - b.ships_in_days));
  const dc = invRow(sku, 'DC-MTL');
  const incoming = dc && dc.incoming_inventory > 0 ? { location_id: 'DC-MTL', units: dc.incoming_inventory, arrives_in_days: dc.incoming_eta_days, meets_promise: dc.incoming_eta_days + 2 <= META.delivery_promise_days } : null;
  return { rows: rows.slice(0, limit), incoming };
}

/* ---------- review evidence for a candidate fit ---------- */
function reviewOutcomes(styleId) {
  const revs = IDX.revByStyle[styleId] || [];
  const sizedUp = revs.filter(r => (r.fit_outcome || '').startsWith('sized_up'));
  const wide = revs.filter(r => r.fit_outcome === 'switched_wide_fits' || (r.width_purchased === 'W' && r.fit_feedback === 'true_to_size'));
  return {
    sizedUp: { n: sizedUp.length, tooLong: sizedUp.filter(r => r.fit_outcome === 'sized_up_too_long').length },
    wide: { n: wide.length, fits: wide.length },
    runsLarge: revs.filter(r => r.fit_feedback === 'runs_large').length,
    runsSmall: revs.filter(r => r.fit_feedback === 'runs_small').length,
  };
}
const laplace = (fail, n) => r2((fail + 1) / (n + 2));
function candidateEvidence(kind, styleId) {
  const o = reviewOutcomes(styleId);
  const st = IDX.style[styleId];
  switch (kind) {
    case 'wide_same_size':
      return o.wide.n >= 3 ? { risk: laplace(o.wide.n - o.wide.fits, o.wide.n), evidence: `${o.wide.fits} of ${o.wide.n} reviewers in the wide fit, in their usual size, say it fits` }
        : { risk: 0.15, evidence: 'Wide fit in the same size; few reviews yet' };
    case 'size_up_for_narrow':
      return o.sizedUp.n >= 3 ? { risk: laplace(o.sizedUp.tooLong, o.sizedUp.n), evidence: `${o.sizedUp.tooLong} of ${o.sizedUp.n} reviewers who sized up for a narrow fit say it was too long` }
        : { risk: 0.35, evidence: 'Sizing up adds length, not width' };
    case 'similar_roomy':
      return { risk: 0.15, evidence: `Different style; product page says "${st.fit_guidance}"` };
    case 'size_down':
      return { risk: 0.12, evidence: o.runsLarge ? `${o.runsLarge} reviews say this style runs large; half a size down is the usual fix` : 'Half a size down' };
    case 'size_up':
      return { risk: 0.12, evidence: o.runsSmall ? `${o.runsSmall} reviews say this style runs small; half a size up is the usual fix` : 'Half a size up' };
    case 'colour':
      return { risk: 0.08, evidence: 'Same fit as before, in another colour' };
    default:
      return { risk: 0.05, evidence: 'Same size and style the customer chose' };
  }
}

/* ---------- Smart Credit picks (the three tests) ---------- */
function smartCreditPicks(customerId, returnedSku, afterFitProblem) {
  const c = IDX.cust[customerId];
  const s = IDX.sku[returnedSku];
  if (!c || !s) throw new Error('Unknown customer or SKU.');
  const k = DATA.cases.find(x => x.customer_id === customerId);
  const pricePaid = k ? caseCtx(k.case_id).line.selling_price : IDX.style[s.style_id].price;
  const band = [Math.round(c.average_order_value * 0.3), Math.round(c.average_order_value * 1.6)];
  const prev = c.previous_categories.map(x => x.toLowerCase());
  const picks = [], rejected = [];
  for (const st of DATA.catalogue) {
    if (st.style_id === s.style_id) continue;
    const acc = st.category === 'Accessories';
    const colour = st.colours.includes(s.colour) ? s.colour : st.colours[0];
    const sku = acc ? makeSku(st.style_id, colour) : makeSku(st.style_id, colour, s.size, 'M');
    if (!IDX.sku[sku]) continue;
    const want = (prev.includes(st.subcategory.toLowerCase()) || prev.includes(st.category.toLowerCase()) || (acc && st.colours.includes(s.colour))) && st.price >= band[0] && st.price <= band[1];
    const ec = IDX.econ[st.style_id];
    const wos = styleWOS(st.style_id);
    const move = wos > 12 || ec.markdown_level > 0;
    const ff = acc ? null : fitFacts(st.style_id);
    const fitRisk = ff ? ff.issues.some(i => i.share >= 0.15) : false;
    const quality = (IDX.revByStyle[st.style_id] || []).some(r => r.quality_rating <= 1);
    const stay = acc || (!afterFitProblem && !fitRisk && !quality);
    const inStock = DATA.locations.some(L => atp(sku, L.location_id) > 0);
    const fails = [!want && 'may not want it', !move && 'not a slow seller', !stay && (afterFitProblem && !acc ? 'shoes after a fit problem' : 'fit or quality risk'), !inStock && 'out of stock'].filter(Boolean);
    if (fails.length) { if (rejected.length < 4 && (want || move)) rejected.push({ item: styleName(st.style_id), reason: fails.join(', ') }); continue; }
    let disc = ec.markdown_level > 0 ? Math.min(0.25, ec.markdown_level) : 0.10;
    if (st.price * (1 - disc) < ec.estimated_recovery_value) disc = Math.max(0, 1 - ec.estimated_recovery_value / st.price);
    picks.push({
      sku, item: styleName(st.style_id), colour, price: st.price, discount: r2(disc), sale_price: r2(st.price * (1 - disc)),
      would_want_it: prev.includes(st.subcategory.toLowerCase()) ? `Bought ${st.subcategory.toLowerCase()} before` : `Matches the ${s.colour.toLowerCase()} item they chose`,
      aldo_needs_to_move_it: ec.markdown_level > 0 ? `${pct(ec.markdown_level)} markdown planned; ${Math.round(wos)} weeks of stock` : `${Math.round(wos)} weeks of stock`,
      wont_come_back: acc ? 'Accessory: no fit risk' : 'No fit complaints', weeks_of_supply: Math.round(wos),
    });
  }
  picks.sort((a, b) => b.weeks_of_supply - a.weeks_of_supply);
  const top = picks.slice(0, 3);
  const stores = DATA.locations.filter(l => l.type === 'store' && l.region === c.region);
  let hold = null, bestN = 0;
  for (const L of stores) { const n = top.filter(p => atp(p.sku, L.location_id) > 0).length; if (n > bestN) { bestN = n; hold = L; } }
  const pUsed = r2((c.credit_used + 0.7 * 2) / (c.credit_issued + 2));
  return {
    picks: top, rejected,
    credit_amount: pricePaid,
    in_store_bonus: { amount: r2(Math.min(META.bonus_pct * pricePaid, META.bonus_cap)), valid_days: META.bonus_days, rule: '10% up to $25 (§5.1)' },
    hold: hold ? { location_id: hold.location_id, name: hold.name, picks_in_stock: bestN, hours: META.hold_hours } : null,
    chance_credit_is_used: pUsed,
    earlier_credit_purchases_returned: c.credit_returned > 0,
  };
}

/* ---------- value calculator (code, not the model) ---------- */
function scoreOptions(caseId, costOwner, options) {
  const { k, line, c, st, ec } = caseCtx(caseId);
  const price = line.selling_price, cost = ec.estimated_cost, margin = r2(price - cost);
  const basis = waiverBasis(caseId);
  const fault = (costOwner && costOwner !== 'customer') || basis.length > 0;
  const grade = k.photo.grade;
  const route = routeScores(caseId, grade, 'DC-MTL')[0];
  const recovery = r2(Math.max(0, route.score));
  const label = META.label_cost, proc = ec.processing_cost;
  const returnCost = r2(label + proc + 0.2 * price);
  const out = [];
  for (const raw of options) {
    const o = typeof raw === 'string' ? { type: raw } : { ...raw };
    const type = String(o.type || '').toLowerCase().replace(/[\s-]/g, '_');
    if (type === 'exchange') {
      const sku = o.sku || o.new_sku;
      if (!IDX.sku[sku]) { out.push({ type, sku, eligible: false, note: `Unknown SKU ${sku}` }); continue; }
      const ns = IDX.sku[sku], nst = IDX.style[ns.style_id], nec = IDX.econ[ns.style_id];
      const stock = stockRows(sku, c.region, 5);
      const src = (o.source_location && stock.rows.find(r => r.location_id === o.source_location)) || stock.rows.find(r => r.meets_promise);
      if (!src) { out.push({ type, sku, eligible: false, note: 'Not in stock anywhere that meets the 5-day promise' }); continue; }
      const kind = ns.style_id !== line.style_id ? 'similar_roomy' : (ns.width === 'W' && line.width === 'M' ? 'wide_same_size' : (Number(ns.size) > Number(line.size) ? (SUB_TO_ISSUE[CASES[caseId]?.subReason] === 'narrow' ? 'size_up_for_narrow' : 'size_up') : (Number(ns.size) < Number(line.size) ? 'size_down' : (ns.colour !== IDX.sku[line.sku].colour ? 'colour' : 'like'))));
      const ev = candidateEvidence(kind, ns.style_id);
      const priceDiff = r2(nst.price - st.price);
      const marginKept = r2(price - cost + (priceDiff > 0 ? priceDiff : 0) - Math.max(0, nec.estimated_cost - cost));
      const costs = r2(label + src.ship_cost + proc);
      const risk = r2(ev.risk * returnCost);
      out.push({
        type, sku, item: skuLabel(sku), source_location: src.location_id, source_name: src.name, eligible: true,
        value_to_aldo: r2(marginKept + recovery - costs - risk),
        breakdown: { margin_kept: marginKept, returned_pair_resold: recovery, label: label, outbound_shipping: src.ship_cost, processing: proc, incentive_cost: 0, second_return_risk: risk, second_return_chance: ev.risk },
        customer_pays: { by_mail: 0, in_store: 0, price_difference: priceDiff }, arrives_in_days: src.ships_in_days, evidence: ev.evidence,
      });
    } else if (type === 'smart_credit') {
      const sc = smartCreditPicks(k.customer_id, line.sku, CASES[caseId]?.reasonCode === 'fit');
      if (sc.picks.length < 2) { out.push({ type, eligible: false, note: `Only ${sc.picks.length} pick passes all three tests (needs 2)` }); continue; }
      const marginKept = r2(sc.chance_credit_is_used * margin);
      const incentive = r2(sc.in_store_bonus.amount * sc.chance_credit_is_used);
      const costs = r2(label + proc);
      const risk = r2(0.03 * returnCost);
      out.push({
        type, eligible: true, credit: price, bonus: sc.in_store_bonus.amount, picks: sc.picks.map(p => `${p.item} ${pct(p.discount)} off`),
        value_to_aldo: r2(marginKept + recovery - costs - incentive - risk),
        breakdown: { margin_kept: marginKept, returned_pair_resold: recovery, label, outbound_shipping: 0, processing: proc, incentive_cost: incentive, second_return_risk: risk, chance_credit_used: sc.chance_credit_is_used },
        customer_pays: { by_mail: 0, in_store: 0 },
      });
    } else if (type === 'refund') {
      const fee = fault ? 0 : META.mail_fee;
      const costs = r2(label - fee + proc);
      out.push({
        type, eligible: true, amount: price,
        value_to_aldo: r2(recovery - costs),
        breakdown: { margin_kept: 0, returned_pair_resold: recovery, label: r2(label - fee), outbound_shipping: 0, processing: proc, incentive_cost: 0, second_return_risk: 0 },
        customer_pays: { by_mail: fee, in_store: 0 },
      });
    } else if (type === 'keep_it') {
      const tests = keepItTests(caseId);
      if (!tests.ok) { out.push({ type, eligible: false, note: 'Keep-it tests fail: ' + tests.failed.join('; ') }); continue; }
      out.push({
        type, eligible: true, amount: price, value_to_aldo: 0,
        breakdown: { margin_kept: 0, returned_pair_resold: 0, label: 0, outbound_shipping: 0, processing: 0, incentive_cost: 0, second_return_risk: 0 },
        customer_pays: { by_mail: 0, in_store: 0 }, note: 'Nothing ships back; the customer keeps or donates the item',
      });
    } else {
      out.push({ type: type || String(raw), eligible: false, note: 'Unknown option type. Use exchange, smart_credit, refund or keep_it.' });
    }
  }
  return { options: out, fault, basis, recovery_route: route };
}
function keepItTests(caseId) {
  const { line, c, st, ec } = caseCtx(caseId);
  const catRate = META.category_return_rate[st.category] ?? 0.1;
  const checks = [
    [line.selling_price < META.keepit_price_limit, `price ${money(line.selling_price)} is under $40`, `price ${money(line.selling_price)} is not under $40`],
    [META.label_cost + ec.processing_cost >= ec.estimated_recovery_value, `label and processing (${money(META.label_cost + ec.processing_cost)}) cost more than the recovery value (${money(ec.estimated_recovery_value)})`, `the item is worth ${money(ec.estimated_recovery_value)} back, more than label and processing`],
    [c.return_rate <= catRate, `return rate ${pct(c.return_rate)} is at or below the ${st.category.toLowerCase()} average of ${pct(catRate)}`, `return rate ${pct(c.return_rate)} is above the ${st.category.toLowerCase()} average of ${pct(catRate)}`],
    [c.keepit_last_12m === 0, 'no keep-it refund in the past 12 months', 'had a keep-it refund in the past 12 months'],
  ];
  return { ok: checks.every(x => x[0]), passed: checks.filter(x => x[0]).map(x => x[1]), failed: checks.filter(x => !x[0]).map(x => x[2]) };
}

/* ---------- customer profile and return economics (Approvals screen) ----------
   Shown to the person approving, as context. History can speed an approval up;
   it never refuses a return on its own (§7.2). Computed in code from the history table. */
/* ---------- returns ledger: two years of returns for the Dashboard ----------
   Stored packed (codes and a day offset); unpacked once here with the same money
   rules the generator documents. */
const LEDGER = (() => {
  const L = DATA.returns_ledger; if (!L) return [];
  const C = L.codes, d0 = dayNum(L.start), pilot = dayNum(L.pilot);
  return L.rows.map(([day, ch, rg, st, rs, oc, price, by], i) => {
    const sid = C.style[st], cost = IDX.econ[sid].estimated_cost, margin = r2(price - cost), outcome = C.outcome[oc];
    let refund = 0, credit = 0, bonus = 0, saved = 0;
    if (outcome === 'refund' || outcome === 'keep_it') refund = price;
    else if (outcome === 'exchange' || outcome === 'declined') saved = margin;
    else if (outcome === 'store_credit') { credit = price; saved = r2(margin * 0.70); }
    else if (outcome === 'store_credit_bonus') { credit = price; bonus = r2(Math.min(0.10 * price, 25)); saved = r2(0.82 * (margin - bonus)); }
    else if (outcome === 'smart_credit') { credit = price; bonus = r2(Math.min(0.10 * price, 25)); saved = r2(0.85 * (margin - bonus)); }
    const dn = d0 + day;
    return { id: `RL-${100001 + i}`, dn, date: new Date(dn * 864e5).toISOString().slice(0, 10), channel: C.channel[ch], region: C.region[rg], style_id: sid, category: IDX.style[sid].category,
      reason: C.reason[rs], outcome, price, cost, margin, refund, credit, bonus, saved, decided_by: C.decided_by[by], pilot: dn >= pilot };
  });
})();
const PILOT_DAY = DATA.returns_ledger ? dayNum(DATA.returns_ledger.pilot) : 0;
const HIST_ROWS = DATA.customer_history.rows.map(r => Object.fromEntries(DATA.customer_history.fields.map((f, i) => [f, r[i]])));
IDX.histByCust = groupBy(HIST_ROWS, 'customer_id');
const RETURNED = ['refund', 'exchange', 'store_credit'];
let VALUE_RANK = null;
function valueRanking() {
  if (!VALUE_RANK) {
    VALUE_RANK = Object.entries(IDX.histByCust)
      .map(([cid, rows]) => ({ cid, net: r2(rows.filter(r => r.outcome !== 'return in progress').reduce((s, r) => s + r.net_profit, 0)) }))
      .sort((a, b) => b.net - a.net);
  }
  return VALUE_RANK;
}
function customerProfile(cid) {
  const c = IDX.cust[cid]; if (!c) return null;
  const rows = (IDX.histByCust[cid] || []).slice().sort((a, b) => (a.order_date < b.order_date ? -1 : 1));
  const past = rows.filter(r => r.outcome !== 'return in progress');
  const returned = past.filter(r => RETURNED.includes(r.outcome));
  const claims = past.filter(r => r.damage_claim);
  const inspected = returned.filter(r => r.inspection);
  const matched = inspected.filter(r => r.inspection === 'matched');
  const total = f => r2(past.reduce((s, r) => s + (Number(r[f]) || 0), 0));
  const reasons = {};
  for (const r of returned) reasons[r.return_reason] = (reasons[r.return_reason] || 0) + 1;
  const ranking = valueRanking();
  const at = ranking.findIndex(x => x.cid === cid);
  const allRates = DATA.customers.filter(x => x.lifetime_orders > 0).map(x => x.return_rate);
  return {
    c, rows, past, returned, claims, reasons,
    orders: c.lifetime_orders, spend: c.lifetime_spend, aov: c.average_order_value, tenure: c.customer_tenure_months,
    returns: returned.length, return_rate: c.return_rate, avg_return_rate: r3(allRates.reduce((s, x) => s + x, 0) / allRates.length),
    exchanges: returned.filter(r => r.outcome === 'exchange').length, refunds: returned.filter(r => r.outcome === 'refund').length,
    credits: returned.filter(r => r.outcome === 'store_credit').length,
    claims_all: claims.length, claims_90d: c.damage_claims_90d, claims_matched: claims.filter(r => r.inspection === 'matched').length,
    inspected: inspected.length, matched: matched.length, genuine_share: inspected.length ? matched.length / inspected.length : null,
    margin: total('gross_margin'), handling: total('return_handling'), lost: total('value_lost'), net: total('net_profit'),
    rank: at >= 0 && past.length ? at + 1 : null, of: ranking.length,
    first_order: rows.length ? rows[0].order_date : null,
  };
}
function returnEconomics(caseId) {
  const { k, line, ec, st, c } = caseCtx(caseId);
  const price = line.selling_price, cost = ec.estimated_cost;
  const route = routeScores(caseId, k.photo.grade, 'DC-MTL')[0];
  return {
    price, list: st.price, cost, margin: r2(price - cost), margin_pct: price ? (price - cost) / price : 0,
    grade: k.photo.grade, route, recovery: r2(Math.max(0, route.score)), processing: ec.processing_cost, label: META.label_cost,
    credit_use: r2((c.credit_used + 0.7 * 2) / (c.credit_issued + 2)),
  };
}
/** Store credit variants an approver can offer, valued with the same calculator. */
function creditOptions(caseId) {
  const e = returnEconomics(caseId), { k, line } = caseCtx(caseId);
  const owner = CASES[caseId]?.decision?.cost_owner || 'customer';
  const refund = scoreOptions(caseId, owner, ['refund']).options[0];
  const base = e.recovery - e.label - e.processing;
  const use = e.credit_use, bonus = r2(Math.min(META.bonus_pct * e.price, META.bonus_cap)), use2 = r2(Math.min(0.95, use + 0.12));
  const out = [
    { key: 'approve_credit', label: 'Store credit', bonus: 0, use, value: r2(use * e.margin + base),
      breakdown: { margin_kept: r2(use * e.margin), returned_pair_resold: e.recovery, label: e.label, processing: e.processing },
      note: `${money(e.price)} credit that never expires. ${pct(use)} of credit like this gets spent.` },
    { key: 'approve_credit_bonus', label: `Store credit + ${moneyShort(bonus)} bonus`, bonus, use: use2, value: r2(use2 * e.margin + base - bonus * use2),
      breakdown: { margin_kept: r2(use2 * e.margin), returned_pair_resold: e.recovery, label: e.label, processing: e.processing, incentive_cost: r2(bonus * use2) },
      note: `Adds a ${money(bonus)} in-store bonus for 30 days (§5.1). More of it gets spent: about ${pct(use2)}.` },
  ];
  const sc = scoreOptions(caseId, owner, [{ type: 'smart_credit' }]).options[0];
  if (sc && sc.eligible) out.push({ key: 'approve_smart_credit', label: 'Smart Credit', bonus: sc.bonus, use: sc.breakdown.chance_credit_used, value: sc.value_to_aldo, breakdown: sc.breakdown,
    note: `Credit + bonus + picks held for them: ${sc.picks.join(', ')}.` });
  const best = out.reduce((a, b) => (b.value > a.value ? b : a));
  out.forEach(o => { o.best = o === best; o.vs_refund = r2(o.value - refund.value_to_aldo); });
  return { options: out, refund: refund.value_to_aldo, best };
}
/** Where the returned pair could be resold, for each condition the counter might find. */
function resaleOptions(caseId) {
  const { k, c } = caseCtx(caseId);
  const cs = CASES[caseId];
  const origin = (cs && cs.chosen && cs.chosen.dropStore) || (DATA.locations.find(l => l.type === 'store' && l.region === c.region) || {}).location_id || 'DC-MTL';
  const rows = [];
  for (const s of routeScores(caseId, 'A', origin).slice(0, 4)) rows.push({ grade: 'A', name: s.name, value: s.score, why: s.why, p: s.p_sell_4w, cost: s.transfer_cost });
  for (const g of ['B', 'C', 'D']) { const s = routeScores(caseId, g, origin)[0]; rows.push({ grade: g, name: s.name, value: s.score, why: s.why, p: s.p_sell_4w, cost: s.transfer_cost }); }
  const bestForGrade = rows.find(r => r.grade === k.photo.grade);
  rows.forEach(r => { r.expected = r === bestForGrade; });
  return { rows, origin, grade: k.photo.grade };
}
/** What each choice in front of an approver is worth to ALDO, from the same calculator as score_options. */
function choiceValues(review) {
  const id = review.case_id; if (!id) return [];
  const e = returnEconomics(id);
  const owner = CASES[id]?.decision?.cost_owner || 'customer';
  const refund = scoreOptions(id, owner, ['refund']).options[0];
  const credit = {
    value: r2(e.credit_use * e.margin + e.recovery - e.label - e.processing),
    breakdown: { margin_kept: r2(e.credit_use * e.margin), returned_pair_resold: e.recovery, label: e.label, processing: e.processing },
  };
  const keep = { value: e.margin, breakdown: { margin_kept: e.margin } };
  const R = (key, label, v, note) => ({ key, label, value: v.value_to_aldo ?? v.value, breakdown: v.breakdown, note });
  if (review.kind === 'case') { const best = creditOptions(id).best; return [
    R('approve_refund', 'Approve the refund', refund, `We lose the ${money(e.margin)} margin; the pair is graded ${e.grade}, so it brings back ${money(e.recovery)}.`),
    { key: best.key, label: `Best credit: ${best.label}`, value: best.value, breakdown: best.breakdown, note: 'The best of the store credit options below.' },
    R('decline', 'Decline (§2.4)', keep, 'The sale stands, but only if the item really is worn. The customer can dispute it.'),
  ]; }
  if (review.kind === 'policy') return [
    R('uphold', 'Uphold the policy', keep, 'Final sale: the sale stands.'),
    R('exception', 'Exception: refund', refund, `We lose the ${money(e.margin)} margin.`),
  ];
  if (review.kind === 'counter') {
    const store = CASES[id]?.received?.store || 'DC-MTL';
    const found = CASES[id]?.received?.grade || e.grade;
    const exp = routeScores(id, e.grade, store)[0], got = routeScores(id, found, store)[0];
    return [
      { key: 'expected', label: `As the photo suggested (grade ${e.grade})`, value: r2(Math.max(0, exp.score)), breakdown: { returned_pair_resold: r2(Math.max(0, exp.score)) }, note: exp.name },
      { key: 'found', label: `As graded at the counter (grade ${found})`, value: r2(Math.max(0, got.score)), breakdown: { returned_pair_resold: r2(Math.max(0, got.score)) }, note: got.name },
    ];
  }
  if (review.kind === 'action') return [R('approve', 'Approve the action', refund, 'Carries on with the option the customer chose.')];
  return [];
}

/* =====================================================================
   Policy engine. Rules run in code, outside the model, before every
   action. At the event the same rules are Cedar policies in AgentCore
   Policy on the Gateway (money is integer cents there).
   ===================================================================== */
const RULES = {
  R1: { name: 'Money limit', clause: '§7.1', where: 'Cedar', text: 'The agent approves refunds, credits and exchanges up to $250 per return. Above that, a person approves first.' },
  R2: { name: 'Bonus cap', clause: '§5.1', where: 'Cedar', text: 'An in-store bonus is at most 10% of the credit, capped at $25, valid at most 30 days.' },
  R3: { name: 'Exchange needs a held pair', clause: '§4.2', where: 'Cedar and tool', text: 'An exchange is created only against a pair held for this return. A price difference over $50 needs a person.' },
  R4: { name: 'Fees only go down', clause: '§3.2', where: 'Cedar', text: 'The return label fee is never above $5.95.' },
  R5: { name: 'No fee when we caused it', clause: '§3.3', where: 'Tool (checks the data)', text: 'No fee when ALDO, the carrier or a defect caused the return, for exchanges and Smart Credit, or for store drop-offs.' },
  R6: { name: 'Waivers need a reason', clause: '§3.2, §3.3', where: 'Tool (checks the data)', text: 'A change-of-mind refund by mail pays $5.95 unless a §3.3 reason applies.' },
  R7: { name: 'Keep-it tests', clause: '§6.1', where: 'Cedar and tool', text: 'A refund without the return only when every keep-it test passes.' },
  R8: { name: 'Suspected abuse', clause: '§7.1, §7.2', where: 'Tool (case record)', text: 'Any money action on a case flagged for possible abuse waits for a supervisor.' },
  R9: { name: 'Claims need evidence', clause: '§3.3', where: 'Tool (checks the data)', text: 'A carrier or supplier claim needs tracking or defect evidence.' },
  R10: { name: 'Merchandiser approves page changes', clause: '§7.3', where: 'Cedar', text: 'A product page change waits for a merchandiser.' },
  R11: { name: 'Settle after the check', clause: '§3.1', where: 'Tool (customer record)', text: 'Nothing is paid or shipped until the returned pair passes the quality check: refunds, store credit (with any bonus) and exchange pairs all wait. The check happens at the store counter on drop-off, or at the distribution centre for mailed returns. Keep-it refunds are the only exception: nothing comes back to check.' },
  R13: { name: 'Release after inspection', clause: '§2.4, §7.2', where: 'Tool (counter grade)', text: 'The quality check decides what was held. Same or better grade than the customer\'s photo, indoor try-on marks (B) or a defect (D): the refund, credit or exchange is released automatically. A worn pair (C) that contradicts the photo: everything stays on hold for the store manager, with a recommendation.' },
  R12: { name: 'Stock holds', clause: '§4.2', where: 'Tool', text: 'A hold needs a pair available to promise at that location.' },
};
class GateError extends Error {
  constructor(decision, rule, reason, tier) {
    super(`${decision === 'APPROVAL' ? 'APPROVAL_REQUIRED' : 'POLICY_DENY'} (${rule} ${RULES[rule]?.name}, ${RULES[rule]?.clause}): ${reason}`);
    this.decision = decision; this.rule = rule; this.reason = reason; this.tier = tier;
  }
}
function approvalCovers(caseId, action, amount) {
  return Object.values(SYS.reviews).some(a => a.case_id === caseId && a.status === 'approved' && (a.covers || []).includes(action) && (a.max_amount == null || amount <= a.max_amount + 0.001));
}
/** Every action tool calls gate() first. Returns the list of checks that passed; throws GateError otherwise. */
function gate(action, caseId, p, ctx) {
  const cs = CASES[caseId] || {};
  const { line, c } = caseCtx(caseId);
  const passed = [];
  const ok = (rule, note) => passed.push({ rule, note });
  const deny = (rule, reason) => { throw new GateError('DENY', rule, reason); };
  const needs = (rule, reason, tier) => { throw new GateError('APPROVAL', rule, reason, tier); };
  const money1 = ['issue_refund', 'issue_store_credit', 'create_exchange'].includes(action);
  if (money1 && cs.flags?.suspected_abuse && !approvalCovers(caseId, action, p.amount ?? line.selling_price)) needs('R8', 'This case is flagged for possible abuse. A supervisor decides.', 2);
  if (money1) {
    const amt = Number(p.amount ?? line.selling_price);
    if (!Number.isFinite(amt) || amt < 0) deny('R1', 'A financial amount must be a finite, nonnegative number.');
    if (amt > META.agent_limit && !approvalCovers(caseId, action, amt)) needs('R1', `${money(amt)} is over the agent's $250 limit.`, amt > META.tier1_limit ? 2 : 1);
    ok('R1', amt > META.agent_limit ? `${money(amt)} approved by a person` : `${money(amt)} is within the $250 limit`);
  }
  switch (action) {
    case 'reserve_pair': {
      if (!IDX.sku[p.sku]) deny('R12', `Unknown SKU ${p.sku}.`);
      if (!IDX.loc[p.location_id]) deny('R12', `Unknown location ${p.location_id}.`);
      ok('R12', 'Pair available to promise');
      break;
    }
    case 'create_exchange': {
      const h = SYS.holds[p.hold_id];
      if (!h || h.status !== 'held') deny('R3', `No active hold ${p.hold_id || ''}. Reserve the pair first with reserve_pair, then pass its hold_id.`);
      if (h.case_id !== caseId) deny('R3', 'This reservation belongs to a different case.');
      if (Date.now() - h.created > META.hold_hours * 3600000) deny('R3', 'This reservation has expired.');
      if (h.sku !== p.new_sku) deny('R3', `Hold ${h.hold_id} is for ${h.sku}, not ${p.new_sku}.`);
      const diff = IDX.style[IDX.sku[p.new_sku].style_id].price - line.selling_price;
      if (diff > 50 && !approvalCovers(caseId, 'create_exchange', IDX.style[IDX.sku[p.new_sku].style_id].price)) needs('R3', `Price difference of ${money(diff)} is over $50.`, 1);
      ok('R3', `Pair held (${h.hold_id})`);
      break;
    }
    case 'issue_store_credit': {
      const amt = Number(p.amount), bonus = Number(p.in_store_bonus || 0), days = Number(p.bonus_valid_days || 0);
      if (!Number.isFinite(bonus) || bonus < 0 || !Number.isFinite(days) || days < 0 || (bonus > 0 && days === 0)) deny('R2', 'Bonus and duration must be valid nonnegative values, with a positive duration for a bonus.');
      if (amt > line.selling_price + 0.001) deny('R1', `Credit of ${money(amt)} is more than the ${money(line.selling_price)} paid.`);
      const cap = Math.min(META.bonus_pct * amt, META.bonus_cap);
      if (bonus > cap + 0.001) deny('R2', `Bonus ${money(bonus)} is over the cap of ${money(cap)}.`);
      if (bonus > 0 && days > META.bonus_days) deny('R2', `Bonus valid ${days} days; the limit is 30.`);
      ok('R2', bonus ? `Bonus ${money(bonus)} within ${money(cap)} cap` : 'No bonus');
      break;
    }
    case 'issue_refund': {
      const amt = Number(p.amount);
      if (amt > line.selling_price + 0.001) deny('R1', `Refund of ${money(amt)} is more than the ${money(line.selling_price)} paid.`);
      if (p.keep_item) {
        const t = keepItTests(caseId);
        if (!t.ok) deny('R7', 'Keep-it tests fail: ' + t.failed.join('; ') + '.');
        ok('R7', 'All keep-it tests pass');
      } else {
        if (p.timing === 'now') deny('R11', 'An immediate refund is only for keep-it refunds. Use at_dropoff or on_receipt.');
        if (p.timing === 'at_dropoff' && !trustedForEarlyRefund(c)) deny('R11', `Early refunds are for Gold and Silver members with a return rate of 20% or less (this customer: ${c.loyalty_status}, ${pct(c.return_rate)}). Use on_receipt.`);
        ok('R11', p.timing === 'at_dropoff' ? 'Trusted customer: refund released after the counter quality check' : 'Refund released after the quality check on arrival');
      }
      break;
    }
    case 'create_return_label': {
      const fee = Number(p.customer_fee || 0);
      if (fee > META.mail_fee + 0.001) deny('R4', `Fee ${money(fee)} is above the $5.95 policy fee.`);
      ok('R4', `Fee ${money(fee)} is not above $5.95`);
      const basis = waiverBasis(caseId);
      const opt = cs.chosen?.option;
      const freeBecause = basis.length ? basis[0].why : (opt === 'exchange' || opt === 'smart_credit') ? 'Exchanges and Smart Credit return free' : (p.method === 'store_dropoff' ? 'Store drop-offs are free' : '');
      if (freeBecause && fee > 0) deny('R5', `No fee is allowed here: ${freeBecause} (§3.3).`);
      if (!freeBecause && opt === 'refund' && p.method !== 'store_dropoff' && fee < META.mail_fee - 0.001) deny('R6', 'A change-of-mind refund by mail pays $5.95 unless a §3.3 reason applies. Charge $5.95, or offer a free store drop-off.');
      ok(freeBecause ? 'R5' : 'R6', freeBecause ? `Free: ${freeBecause}` : 'Standard $5.95 fee applies');
      break;
    }
    case 'file_claim': {
      const basis = waiverBasis(caseId);
      const who = p.against === 'supplier' ? 'supplier' : 'carrier';
      if (!basis.some(b => b.owner === who)) deny('R9', `No ${who} evidence in the data for this return.`);
      if (Number(p.amount) > line.selling_price + META.label_cost + 0.001) deny('R9', 'Claim is larger than the item plus the label.');
      ok('R9', basis.find(b => b.owner === who).why);
      break;
    }
    case 'update_product_page': {
      needs('R10', 'A merchandiser approves product page changes.', 1);
      break;
    }
    default: break;
  }
  return passed;
}

/* =====================================================================
   Tools. Each has a JSON schema for Claude, a plain-words label for the
   trace, and a run() over the data and the simulated systems.
   ===================================================================== */
const WHY = { type: 'string', description: 'One short sentence, shown to the user live: what you are checking or doing, and why.' };
const TOOLS = {};
function defTool(name, d) {
  const props = Object.assign({ why: WHY }, d.props || {});
  TOOLS[name] = { name, ...d, inputSchema: { type: 'object', properties: props, required: ['why'].concat(d.required || []) } };
}

/* ----- Resolution agent: investigate and decide ----- */
defTool('look_up_order_and_customer', {
  group: 'investigate', stage: 'investigate', label: 'Look up order and customer',
  description: 'Returns the order (lines, price paid, final-sale flag, delivery vs estimated date), the customer profile without personal details (loyalty, tenure, return rate, past categories, credit history, damage claims) and carrier tracking events.',
  props: { order_id: { type: 'string' } }, required: ['order_id'],
  run({ order_id }) {
    const o = IDX.order[String(order_id || '').trim()];
    if (!o) throw new Error(`No order found with id ${order_id}.`);
    const c = IDX.cust[o.customer_id];
    const t = IDX.track[o.order_id];
    const st = IDX.style[o.lines[0].style_id];
    return {
      order: {
        order_id: o.order_id, order_date: o.order_date, channel: o.channel, shipping_method: o.shipping_method,
        estimated_delivery_date: o.estimated_delivery_date, delivery_date: o.delivery_date,
        delivered_late_by_days: Math.max(0, daysBetween(o.estimated_delivery_date, o.delivery_date)),
        days_since_delivery: daysBetween(o.delivery_date, META.today),
        lines: o.lines.map(l => ({ line_id: l.line_id, sku: l.sku, style_id: l.style_id, product: l.product, colour: l.colour, size: l.size, width: widthWord(l.width), price_paid: l.selling_price, discount: l.discount, promotion: l.promotion || 'none', final_sale: l.final_sale })),
      },
      customer: {
        customer_id: c.customer_id, region: c.region, loyalty_status: c.loyalty_status, tenure_months: c.customer_tenure_months,
        lifetime_orders: c.lifetime_orders, number_of_returns: c.number_of_returns, return_rate: c.return_rate,
        category_average_return_rate: META.category_return_rate[st.category], average_order_value: c.average_order_value,
        previous_categories: c.previous_categories, damage_claims_last_90_days: c.damage_claims_90d,
        store_credit_history: { issued: c.credit_issued, used: c.credit_used, purchases_returned: c.credit_returned },
        keep_it_refunds_last_12_months: c.keepit_last_12m, personal_details: 'withheld (§8.2)',
      },
      carrier_tracking: t ? t.events.map(([date, event, location, exception]) => exception ? { date, event, location, exception } : { date, event, location }) : [],
      sources: [`orders/${o.order_id}`, `customers/${c.customer_id}`, `carrier_tracking/${o.order_id}`],
    };
  },
  summary: r => {
    const l = r.order.lines[0];
    const late = r.order.delivered_late_by_days ? `${r.order.delivered_late_by_days} days late` : 'on time';
    return `${l.product}, size ${l.size}${l.width === 'wide' ? ' wide' : ''}, ${money(l.price_paid)}${l.final_sale ? ', final sale' : ''}. Delivered ${fmtDate(r.order.delivery_date)} (${late}), ${r.order.days_since_delivery} days ago. ${r.customer.loyalty_status} member, return rate ${pct(r.customer.return_rate)}${r.customer.damage_claims_last_90_days ? `, ${r.customer.damage_claims_last_90_days} damage claims in 90 days` : ''}.`;
  },
});

defTool('check_item_photo', {
  group: 'investigate', stage: 'listen', label: 'Check the photo',
  description: "Reads the customer's photo of the item and returns a condition grade (A unworn, B tried on or cosmetic, C worn, D defective), findings, and whether the photo is consistent with what the customer said.",
  props: { return_id: { type: 'string' } }, required: ['return_id'],
  run({ return_id }) {
    const k = caseByReturnId(return_id);
    const p = k.photo;
    return {
      return_id: k.return_id, photo: p.file, condition_grade: p.grade, grade_meaning: GRADE[p.grade],
      findings: p.findings, consistent_with_customer_claim: p.consistent,
      ...(p.shows ? { photo_shows: p.shows } : {}),
      ...(p.matches_order != null ? { matches_the_order: p.matches_order, match_note: p.match_note || '' } : {}),
      ...(p.damage_type ? { damage_type: p.damage_type } : {}),
      ...(p.confidence ? { confidence: p.confidence } : {}),
      ...(p.unread ? { photo_unreadable: true } : {}),
      method: p.unread ? 'The photo could not be read automatically; treat it as unverified.' : p.vision ? 'Claude read the uploaded photo before this step.' : p.manual ? 'Graded by a person: the scripted backup cannot read photos.' : 'Simulated vision check in this prototype; at the event Claude on Bedrock reads the real photo.',
      sources: [`returns/${k.return_id}/photo`],
    };
  },
  summary: r => `Grade ${r.condition_grade} (${r.grade_meaning.split(':')[0].toLowerCase()}).${r.findings.length ? ' ' + r.findings.join('; ') + '.' : ''}${r.matches_the_order === false ? ' The photo does not show the item on the order.' : r.consistent_with_customer_claim ? '' : ' Does not match what the customer said.'}`,
});

defTool('read_reviews_and_fit_votes', {
  group: 'investigate', stage: 'investigate', label: 'Read reviews and fit votes',
  description: 'Returns review counts and fit votes for a style, the product page fit guidance, policy §3.4 checks (does at least 20% and at least 10 reviews report the same fit issue without a page warning), outcomes of sizing up or switching to wide, colour and quality mentions, and a few quotes.',
  props: { style_id: { type: 'string' } }, required: ['style_id'],
  run({ style_id }) {
    const st = IDX.style[String(style_id || '').trim()];
    if (!st) throw new Error(`Unknown style ${style_id}.`);
    const revs = IDX.revByStyle[st.style_id] || [];
    const ff = fitFacts(st.style_id), o = reviewOutcomes(st.style_id);
    const votes = {}; for (const r of revs) if (r.fit_feedback) votes[r.fit_feedback] = (votes[r.fit_feedback] || 0) + 1;
    const colour = revs.filter(r => /colou?r|orange|brighter|shade/i.test(r.review_text));
    const quality = revs.filter(r => /sole|glue|unglued|separat|stitch|peel/i.test(r.review_text));
    const quotes = [];
    const push = r => { if (r && quotes.length < 4 && !quotes.includes(r)) quotes.push(r); };
    const hit = ff.issues.find(i => i.count >= 3);
    if (hit) revs.filter(r => r.fit_feedback === hit.issue && !r.fit_outcome).slice(0, 1).forEach(push);
    push(revs.find(r => r.fit_outcome === 'sized_up_too_long'));
    push(revs.find(r => r.fit_outcome === 'switched_wide_fits'));
    colour.slice(0, 1).forEach(push); quality.slice(0, 1).forEach(push);
    if (!quotes.length) revs.slice(0, 2).forEach(push);
    const avg = revs.length ? revs.reduce((s, r) => s + r.rating, 0) / revs.length : 0;
    const out = {
      style_id: st.style_id, product: styleName(st.style_id), review_count: revs.length, average_rating: Math.round(avg * 10) / 10,
      fit_votes: votes,
      product_page: { fit_guidance: st.fit_guidance, page_note: SYS.pageNotes[st.style_id] || '', widths_available: st.widths.map(widthWord) },
      policy_3_4_checks: ff.issues.filter(i => i.count > 0).map(i => ({ issue: i.issue.replace('_', ' '), reviews_reporting: i.count, share: i.share, page_warns: i.page_warns, meets_rule: i.meets_rule })),
      outcomes: {},
      quotes: quotes.map(r => ({ review_id: r.review_id, size: r.size_purchased + (r.width_purchased === 'W' ? ' wide' : ''), text: r.review_text })),
      sources: [`product_reviews/${st.style_id} (${revs.length} rows)`, `product_catalogue/${st.style_id}.fit_guidance`],
    };
    if (o.sizedUp.n) out.outcomes.sized_up_half_size = { reviewers: o.sizedUp.n, said_too_long: o.sizedUp.tooLong };
    if (o.wide.n) out.outcomes.wide_fit_in_usual_size = { reviewers: o.wide.n, said_it_fits: o.wide.fits };
    if (colour.length) out.outcomes.colour_mentions = { reviews: colour.length, share: r3(colour.length / revs.length) };
    if (quality.length) out.outcomes.quality_complaints = { reviews: quality.length, most_recent: quality.map(r => r.review_date).sort().pop() };
    return out;
  },
  summary: r => {
    const met = r.policy_3_4_checks.find(i => i.meets_rule);
    const top = r.policy_3_4_checks.slice().sort((a, b) => b.reviews_reporting - a.reviews_reporting)[0];
    const bits = [];
    if (met) bits.push(`${met.reviews_reporting} of ${r.review_count} reviews (${pct(met.share)}) say it ${met.issue === 'narrow' ? 'runs narrow' : met.issue}; the page says "${r.product_page.fit_guidance}"`);
    else if (top) bits.push(`${top.reviews_reporting} of ${r.review_count} reviews say "${top.issue}"${top.page_warns ? ' and the page already warns' : ''}`);
    else bits.push(`${r.review_count} reviews, average ${r.average_rating}`);
    if (r.outcomes.sized_up_half_size) bits.push(`${r.outcomes.sized_up_half_size.said_too_long} of ${r.outcomes.sized_up_half_size.reviewers} who sized up say too long`);
    if (r.outcomes.wide_fit_in_usual_size) bits.push(`${r.outcomes.wide_fit_in_usual_size.said_it_fits} of ${r.outcomes.wide_fit_in_usual_size.reviewers} in the wide fit say it fits`);
    if (r.outcomes.colour_mentions) bits.push(`${r.outcomes.colour_mentions.reviews} mention the colour (${pct(r.outcomes.colour_mentions.share)})`);
    if (r.outcomes.quality_complaints) bits.push(`${r.outcomes.quality_complaints.reviews} quality complaints`);
    return bits.join('. ') + '.';
  },
});

defTool('search_return_policy', {
  group: 'investigate', stage: 'investigate', label: 'Search the return policy',
  description: 'Searches the return policy and returns the most relevant clauses with their clause numbers (for example §2.1) so you can cite them.',
  props: { query: { type: 'string', description: 'Plain words, e.g. "final sale window fee waiver exchange"' } }, required: ['query'],
  run({ query }) {
    const q = String(query || '').toLowerCase();
    const words = q.split(/[^a-z0-9§.]+/).filter(w => w.length > 2 || w.startsWith('§'));
    const scored = DATA.policy.map(p => {
      const hay = (p.clause_id + ' ' + p.title + ' ' + p.text).toLowerCase();
      let s = 0; for (const w of words) if (hay.includes(w)) s += w.startsWith('§') ? 5 : 1;
      if (q.includes(p.clause_id)) s += 10;
      return { p, s };
    }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 5);
    return { clauses: scored.map(x => ({ clause: x.p.clause_id, title: x.p.title, text: x.p.text })), sources: scored.map(x => `return_policy/${x.p.clause_id}`) };
  },
  summary: r => r.clauses.length ? `Found ${r.clauses.map(c => `${c.clause} ${c.title.toLowerCase()}`).join(', ')}.` : 'No matching clause.',
});

defTool('find_exchange_options', {
  group: 'investigate', stage: 'investigate', label: 'Find a better fit',
  description: 'Given the returned style, size, width and the fit issue, returns replacement candidates (other width, half size, similar style, other colour, or same item) with review evidence, the chance of a second return, and stock by location: units available, days to reach the customer region, shipping cost, whether it meets the 5-day promise and weeks of supply (slow sellers first).',
  props: {
    style_id: { type: 'string' }, size: { type: 'string' }, width: { type: 'string', description: 'regular or wide' },
    colour: { type: 'string' },
    issue: { type: 'string', enum: ['too_narrow', 'too_wide', 'too_small', 'too_big', 'heel_slips', 'colour', 'like_for_like'] },
    customer_region: { type: 'string' },
  }, required: ['style_id', 'size', 'issue', 'customer_region'],
  run(p) {
    const st = IDX.style[String(p.style_id || '').trim()];
    if (!st) throw new Error(`Unknown style ${p.style_id}.`);
    const size = Number(normSize(p.size)), width = normWidth(p.width || 'regular') || 'M';
    const colour = st.colours.find(c => c.toLowerCase() === String(p.colour || '').toLowerCase()) || st.colours[0];
    const region = DATA.locations.some(l => l.region === p.customer_region) ? p.customer_region : 'Greater Montreal';
    const cands = [];
    const add = (sku, change, kind, styleId) => { if (IDX.sku[sku] && !cands.some(c => c.sku === sku)) cands.push({ sku, change, kind, styleId: styleId || st.style_id }); };
    switch (p.issue) {
      case 'too_narrow':
        if (st.widths.includes('W') && width === 'M') add(makeSku(st.style_id, colour, size, 'W'), 'Same size, wide fit', 'wide_same_size');
        add(makeSku(st.style_id, colour, size + 0.5, width), 'Half a size up', 'size_up_for_narrow');
        for (const sid of st.similar_styles) { const s2 = IDX.style[sid]; if (/roomy/i.test(s2.fit_guidance)) add(makeSku(sid, s2.colours.includes(colour) ? colour : s2.colours[0], size, 'M'), `Similar style with a roomy toe box (${s2.name})`, 'similar_roomy', sid); }
        break;
      case 'too_wide':
        if (width === 'W') add(makeSku(st.style_id, colour, size, 'M'), 'Same size, regular width', 'like');
        add(makeSku(st.style_id, colour, size - 0.5, width), 'Half a size down', 'size_down');
        break;
      case 'too_small': add(makeSku(st.style_id, colour, size + 0.5, width), 'Half a size up', 'size_up'); break;
      case 'too_big': case 'heel_slips': add(makeSku(st.style_id, colour, size - 0.5, width), 'Half a size down', 'size_down'); break;
      case 'colour': for (const c2 of st.colours) if (c2 !== colour) add(makeSku(st.style_id, c2, size, width), `Same size in ${c2.toLowerCase()}`, 'colour'); break;
      default: add(makeSku(st.style_id, colour, size, width), 'Same item, new pair', 'like');
    }
    return {
      candidates: cands.map(c => {
        const ev = candidateEvidence(c.kind, c.styleId);
        const s = stockRows(c.sku, region, 4);
        return { sku: c.sku, item: skuLabel(c.sku), change: c.change, evidence: ev.evidence, chance_of_second_return: ev.risk, stock: s.rows, incoming: s.incoming || undefined, best_source: s.rows.find(r => r.meets_promise)?.location_id || null };
      }),
      delivery_promise_days: META.delivery_promise_days,
      sources: [`inventory/${cands.map(c => c.sku).join(', ')}`, `logistics/to ${region}`, `product_reviews/${st.style_id}`],
    };
  },
  summary: r => r.candidates.map(c => `${c.change}: ${c.stock.length ? `${c.stock.reduce((s, x) => s + x.available, 0)} in stock` : 'none in stock'}${c.best_source ? `, best source ${IDX.loc[c.best_source].name}` : ''}, second-return chance ${pct(c.chance_of_second_return)}`).join('. ') + '.',
});

defTool('find_smart_credit_picks', {
  group: 'investigate', stage: 'investigate', label: 'Find Smart Credit picks',
  description: 'Returns up to 3 items that pass all three Smart Credit tests (the customer would want it, ALDO needs to move it, it will not come back) with discounts capped at the planned markdown, the in-store bonus, a store in their region to hold them, the chance the credit is used, and whether earlier credit purchases came back.',
  props: { customer_id: { type: 'string' }, returned_sku: { type: 'string' }, after_fit_problem: { type: 'boolean' } }, required: ['customer_id', 'returned_sku'],
  run(p) {
    const r = smartCreditPicks(String(p.customer_id || '').trim(), String(p.returned_sku || '').trim(), !!p.after_fit_problem);
    return { ...r, sources: [`customers/${p.customer_id}.previous_categories`, 'inventory/weeks of supply', 'product_economics/markdown_level'] };
  },
  summary: r => r.picks.length >= 2 ? `${r.picks.length} picks pass all three tests: ${r.picks.map(p => `${p.item} at ${pct(p.discount)} off`).join(', ')}.${r.hold ? ` Hold at ${r.hold.name} for 48 h.` : ''}` : `Only ${r.picks.length} pick passes all three tests, so Smart Credit can't be offered.`,
});

defTool('score_options', {
  group: 'investigate', stage: 'decide', label: 'Score the options',
  description: 'The value calculator (code, not the model). For each option returns value to ALDO = margin kept + resale value of the returned pair − label, shipping and processing − incentive cost − chance of a second return × its cost, plus what the customer pays by mail and in store, and keep-it eligibility.',
  props: {
    return_id: { type: 'string' },
    cost_owner: { type: 'string', enum: ['carrier', 'supplier', 'aldo_product', 'aldo_warehouse', 'customer'] },
    options: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', enum: ['exchange', 'smart_credit', 'refund', 'keep_it'] }, sku: { type: 'string' }, source_location: { type: 'string' } }, required: ['type'] } },
  }, required: ['return_id', 'cost_owner', 'options'],
  run(p) {
    const k = caseByReturnId(p.return_id);
    const opts = Array.isArray(p.options) ? p.options : [];
    if (!opts.length) throw new Error('Pass at least one option.');
    const r = scoreOptions(k.case_id, p.cost_owner, opts);
    return {
      options: r.options, fee_waived_because: r.basis.map(b => b.why), returned_pair_best_home: `${r.recovery_route.name} (${r.recovery_route.why})`,
      formula: 'value = margin kept + returned pair resold − label − outbound shipping − processing − incentive − chance of second return × cost of a return',
      sources: [`product_economics/${caseCtx(k.case_id).line.style_id}`, 'logistics', `inventory/${caseCtx(k.case_id).line.sku}`],
    };
  },
  summary: r => r.options.map(o => o.eligible ? `${o.type.replace('_', ' ')} ${money(o.value_to_aldo)}` : `${o.type.replace('_', ' ')} not eligible`).join(' · ') + (r.fee_waived_because.length ? `. Free return: ${r.fee_waived_because[0].toLowerCase()}.` : '.'),
});

defTool('request_human_review', {
  group: 'investigate', stage: 'decide', label: 'Ask a person',
  description: 'Sends the case to a person with your recommendation and the evidence. Use when a person must decide (unclear and over $250, photo contradicts the claim, suspected abuse, or a safety check says APPROVAL_REQUIRED). Returns the review id, the approver and what to tell the customer.',
  props: {
    return_id: { type: 'string' }, reason: { type: 'string' }, recommendation: { type: 'string' },
    evidence: { type: 'array', items: { type: 'string' } }, suspected_abuse: { type: 'boolean' },
  }, required: ['return_id', 'reason', 'recommendation'],
  run(p, ctx) {
    const k = caseByReturnId(p.return_id);
    const { line } = caseCtx(k.case_id);
    const abuse = !!p.suspected_abuse || /abuse|pattern|contradict|inconsistent|worn/i.test(p.reason || '');
    const tier = abuse || line.selling_price > META.tier1_limit ? 2 : 1;
    const cs = CASES[k.case_id];
    if (abuse) cs.flags.suspected_abuse = true;
    const existing = Object.values(SYS.reviews).find(a => a.case_id === k.case_id && a.status === 'pending' && a.kind === (ctx?.phase === 'act' ? 'action' : 'case'));
    const id = existing ? existing.id : nextId('HR');
    SYS.reviews[id] = Object.assign(existing || {}, {
      id, case_id: k.case_id, kind: ctx?.phase === 'act' ? 'action' : 'case', tier, approver: tier === 2 ? 'Supervisor' : 'Customer-service lead',
      reason: String(p.reason || ''), recommendation: String(p.recommendation || ''), evidence: (p.evidence || []).map(String).slice(0, 8),
      amount: line.selling_price, status: 'pending', requested_at: Date.now(), requested_by: ctx?.mode === 'live' ? 'Resolution agent (live)' : 'Resolution agent (scripted)',
      action: ctx?.pendingAction || null,
    });
    UI.onApprovalsChanged?.();
    return { review_id: id, tier, approver: SYS.reviews[id].approver, expected_response: 'within 1 business day', tell_the_customer: 'A member of our team will review your return within 1 business day. You do not need to do anything else.' };
  },
  summary: r => `Sent to the ${r.approver.toLowerCase()} (tier ${r.tier}) as ${r.review_id}.`,
});

/* ----- Resolution agent: act and check ----- */
defTool('check_stock_nearby', {
  group: 'act', stage: 'act', label: 'Check stock nearby',
  description: 'Returns current stock for one SKU by location (after holds and sales), with days and cost to reach the customer region and whether it meets the 5-day promise. Use it to re-plan after a reservation fails.',
  props: { sku: { type: 'string' }, customer_region: { type: 'string' } }, required: ['sku', 'customer_region'],
  run(p) {
    if (!IDX.sku[p.sku]) throw new Error(`Unknown SKU ${p.sku}.`);
    const s = stockRows(p.sku, p.customer_region, 6);
    return { sku: p.sku, item: skuLabel(p.sku), stock: s.rows, incoming: s.incoming || undefined, sources: [`inventory/${p.sku}`, `logistics/to ${p.customer_region}`] };
  },
  summary: r => r.stock.length ? r.stock.map(s => `${s.name} ${s.available}`).join(', ') + '.' : 'Not in stock anywhere.',
});

defTool('reserve_pair', {
  group: 'act', stage: 'act', label: 'Reserve a pair', gated: true,
  description: 'Places a 48-hour hold on one unit of a SKU at a location. Returns a hold_id. Fails if the unit is no longer available (it may have just sold).',
  props: { return_id: { type: 'string' }, sku: { type: 'string' }, location_id: { type: 'string' } }, required: ['return_id', 'sku', 'location_id'],
  run(p, ctx) {
    const k = caseByReturnId(p.return_id);
    ctx.gate('reserve_pair', k.case_id, p);
    const sku = String(p.sku), loc = String(p.location_id);
    if (atp(sku, loc) < 1) throw new Error(`Reservation failed: no ${skuLabel(sku)} available at ${IDX.loc[loc]?.name || loc}.`);
    if (STATE.failureSwitch && ctx.run && !ctx.run.failedOnce && CASES[k.case_id]?.chosen?.option === 'exchange' && !isAccessory(IDX.sku[sku].style_id)) {
      ctx.run.failedOnce = true;
      SYS.sold[sku + '|' + loc] = (SYS.sold[sku + '|' + loc] || 0) + 1;
      (SYS.soldBy[k.case_id] = SYS.soldBy[k.case_id] || []).push(sku + '|' + loc);
      ctx.markFailure?.();
      throw new Error(`Reservation failed at ${IDX.loc[loc].name}: that pair was sold at the store counter ${30 + Math.floor(Math.random() * 25)} seconds ago. ${atp(sku, loc)} left there. Pick another location.`);
    }
    const id = nextId('HLD');
    SYS.holds[id] = { hold_id: id, case_id: k.case_id, sku, location_id: loc, status: 'held', created: Date.now(), expires_hours: META.hold_hours };
    return { hold_id: id, sku, item: skuLabel(sku), location: IDX.loc[loc].name, status: 'held', expires_in_hours: META.hold_hours };
  },
  summary: r => `Held ${r.item} at ${r.location} (${r.hold_id}, 48 h).`,
});

defTool('create_exchange', {
  group: 'act', stage: 'act', label: 'Create the exchange', gated: true,
  description: 'Creates the exchange order for the held pair. The new pair stays reserved and ships only after the returned pair passes the quality check (R11, R13). Needs the hold_id from reserve_pair. Returns the exchange order id and how many business days delivery takes once it ships.',
  props: { return_id: { type: 'string' }, new_sku: { type: 'string' }, hold_id: { type: 'string' } }, required: ['return_id', 'new_sku', 'hold_id'],
  run(p, ctx) {
    const k = caseByReturnId(p.return_id);
    const { c } = caseCtx(k.case_id);
    ctx.gate('create_exchange', k.case_id, { ...p, amount: IDX.style[IDX.sku[p.new_sku]?.style_id]?.price });
    const h = SYS.holds[p.hold_id];
    const sh = IDX.ship[h.location_id + '|' + c.region];
    const id = nextId('EXO');
    h.status = 'allocated';
    SYS.exchanges[id] = { id, case_id: k.case_id, sku: p.new_sku, hold_id: h.hold_id, ships_from: h.location_id, ship_cost: sh.estimated_shipping_cost, transit_days: sh.typical_transit_days, eta: null, status: 'reserved', held_for: 'quality check' };
    return { exchange_order_id: id, item: skuLabel(p.new_sku), reserved_at: IDX.loc[h.location_id].name, status: 'reserved: ships as soon as the returned pair passes the quality check', arrives_business_days_after_shipping: sh.typical_transit_days, shipping_cost_to_aldo: sh.estimated_shipping_cost, customer_pays: 0 };
  },
  summary: r => `Exchange ${r.exchange_order_id}: ${r.item} reserved at ${r.reserved_at}; ships after the quality check, ${r.arrives_business_days_after_shipping} business days to arrive.`,
});

defTool('issue_store_credit', {
  group: 'act', stage: 'act', label: 'Issue Smart Credit', gated: true,
  description: 'Sets up store credit for the full value (never expires) and an optional in-store bonus (max 10% up to $25, valid up to 30 days). It is added to the account only after the returned pair passes the quality check (R11, R13).',
  props: { return_id: { type: 'string' }, amount: { type: 'number' }, in_store_bonus: { type: 'number' }, bonus_valid_days: { type: 'number' } }, required: ['return_id', 'amount'],
  run(p, ctx) {
    const k = caseByReturnId(p.return_id);
    ctx.gate('issue_store_credit', k.case_id, p);
    const id = nextId('SC');
    SYS.credits[id] = { id, case_id: k.case_id, amount: Number(p.amount), bonus: Number(p.in_store_bonus || 0), bonus_days: Number(p.bonus_valid_days || 0), status: 'held', held_for: 'quality check' };
    return { credit_id: id, amount: Number(p.amount), status: 'held: added as soon as the returned pair passes the quality check', never_expires: true, in_store_bonus: Number(p.in_store_bonus || 0), bonus_valid_days: Number(p.bonus_valid_days || 0) };
  },
  summary: r => `Credit ${r.credit_id}: ${money(r.amount)} (never expires)${r.in_store_bonus ? ` + ${money(r.in_store_bonus)} in-store bonus for ${r.bonus_valid_days} days` : ''}, held until the quality check.`,
});

defTool('issue_refund', {
  group: 'act', stage: 'act', label: 'Issue the refund', gated: true,
  description: "Schedules a refund to the original payment method. It is held until the returned pair passes the quality check (R11, R13). timing: on_receipt (default: checked at the distribution centre), at_dropoff (trusted Gold and Silver members: checked at the store counter) or now (keep-it refunds only, with keep_item true, since nothing comes back).",
  props: { return_id: { type: 'string' }, amount: { type: 'number' }, timing: { type: 'string', enum: ['on_receipt', 'at_dropoff', 'now'] }, keep_item: { type: 'boolean' } }, required: ['return_id', 'amount', 'timing'],
  run(p, ctx) {
    const k = caseByReturnId(p.return_id);
    ctx.gate('issue_refund', k.case_id, p);
    const id = nextId('RF');
    SYS.refunds[id] = { id, case_id: k.case_id, amount: Number(p.amount), timing: p.timing, keep_item: !!p.keep_item, status: p.timing === 'now' ? 'issued' : 'scheduled', held_for: p.timing === 'now' ? null : 'quality check' };
    return { refund_id: id, amount: Number(p.amount), timing: p.timing, status: SYS.refunds[id].status };
  },
  summary: r => `Refund ${r.refund_id}: ${money(r.amount)}, ${r.status === 'issued' ? 'issued now' : r.timing === 'at_dropoff' ? 'held until the counter quality check at drop-off' : 'held until the quality check on arrival'}.`,
});

defTool('create_return_label', {
  group: 'act', stage: 'act', label: 'Create the return label', gated: true,
  description: 'Creates the return for the original pair: store_dropoff (free, any store) or carrier (QR label). customer_fee is what the customer pays (0 or the $5.95 policy fee). Returns the label id, drop-by date and the best store to drop it at.',
  props: { return_id: { type: 'string' }, method: { type: 'string', enum: ['store_dropoff', 'carrier'] }, customer_fee: { type: 'number' } }, required: ['return_id', 'method', 'customer_fee'],
  run(p, ctx) {
    const k = caseByReturnId(p.return_id);
    ctx.gate('create_return_label', k.case_id, p);
    const best = bestDropOffStore(k.case_id);
    const id = nextId('LBL');
    SYS.labels[id] = { id, case_id: k.case_id, method: p.method, fee: Number(p.customer_fee || 0), drop_by: addDays(META.today, 14), store: best?.location_id || null, status: 'created' };
    return { label_id: id, method: p.method, customer_fee: Number(p.customer_fee || 0), drop_by: fmtDate(addDays(META.today, 14)), best_store_to_drop_at: best ? `${best.name} (${best.why})` : undefined };
  },
  summary: r => `Label ${r.label_id}: ${r.method === 'store_dropoff' ? 'drop off at any store' : 'carrier QR label'}, customer pays ${money(r.customer_fee)}, drop by ${r.drop_by}.`,
});

defTool('route_returned_item', {
  group: 'act', stage: 'act', label: 'Plan where the returned pair goes',
  description: "Scores every destination for the customer's returned pair by its expected condition grade: (price − cost) × chance it sells there within 4 weeks − transfer cost. Returns the planned destination and the scores. Confirmed when the pair is graded at drop-off.",
  props: { return_id: { type: 'string' } }, required: ['return_id'],
  run(p) {
    const k = caseByReturnId(p.return_id);
    const cs = CASES[k.case_id];
    const origin = cs.chosen?.method === 'store_dropoff' && cs.chosen?.dropStore ? cs.chosen.dropStore : 'DC-MTL';
    const scores = routeScores(k.case_id, k.photo.grade, origin);
    SYS.routes[k.case_id] = { case_id: k.case_id, plan: scores[0].location_id, grade: k.photo.grade, origin, scores };
    return { planned_destination: scores[0].name, why: scores[0].why, expected_grade: k.photo.grade, comes_back_to: IDX.loc[origin]?.name || origin, scores: scores.slice(0, 5).map(s => ({ location: s.name, score: s.score, chance_sells_in_4_weeks: s.p_sell_4w, transfer_cost: s.transfer_cost })), note: 'Confirmed when the pair is graded at drop-off or arrival.' };
  },
  summary: r => `Plan: ${r.planned_destination} (${r.why.toLowerCase()}), score ${r.scores[0].score}.`,
});

defTool('file_claim', {
  group: 'act', stage: 'act', label: 'File a claim', gated: true,
  description: 'Files a cost-recovery claim against the carrier (late or damaged in transit) or the supplier (defect), with evidence.',
  props: { return_id: { type: 'string' }, against: { type: 'string', enum: ['carrier', 'supplier'] }, amount: { type: 'number' }, evidence: { type: 'string' } }, required: ['return_id', 'against', 'amount'],
  run(p, ctx) {
    const k = caseByReturnId(p.return_id);
    ctx.gate('file_claim', k.case_id, p);
    const id = nextId('CLM');
    SYS.claims[id] = { id, case_id: k.case_id, against: p.against, amount: Number(p.amount), evidence: String(p.evidence || ''), status: 'filed' };
    return { claim_id: id, against: p.against, amount: Number(p.amount), status: 'filed' };
  },
  summary: r => `Claim ${r.claim_id} against the ${r.against} for ${money(r.amount)}.`,
});

defTool('verify_actions', {
  group: 'act', stage: 'act', label: 'Check it worked',
  description: 'Re-reads the systems for each id you created (holds, exchange orders, credits, refunds, labels, claims) and reports whether it really exists and its status. Do not trust a success message without this.',
  props: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'],
  run(p) {
    const maps = { HLD: ['hold', SYS.holds], EXO: ['exchange order', SYS.exchanges], SC: ['store credit', SYS.credits], RF: ['refund', SYS.refunds], LBL: ['return label', SYS.labels], CLM: ['claim', SYS.claims], HR: ['human review', SYS.reviews] };
    const ids = (Array.isArray(p.ids) ? p.ids : [p.ids]).map(String).filter(Boolean);
    if (!ids.length) throw new Error('Pass the ids you created.');
    return {
      checks: ids.map(id => {
        const m = maps[id.split('-')[0]];
        const rec = m && m[1][id];
        return rec ? { id, type: m[0], exists: true, status: rec.status } : { id, exists: false, status: 'not found' };
      }),
    };
  },
  summary: r => r.checks.every(c => c.exists) ? (r.checks.length === 1 ? 'The record is confirmed in the systems.' : `All ${r.checks.length} records confirmed in the systems.`) : `${r.checks.filter(c => !c.exists).length} not found: ${r.checks.filter(c => !c.exists).map(c => c.id).join(', ')}.`,
});

/* ----- Prevention agent ----- */
function returnRateReport() {
  const cat = {};
  const styles = DATA.catalogue.filter(s => s.category !== 'Accessories');
  const fit = sid => (IDX.retByStyle[sid] || []).filter(r => r.return_reason === 'fit').length;
  const qual = sid => (IDX.retByStyle[sid] || []).filter(r => r.return_reason === 'quality').length;
  for (const s of styles) { (cat[s.category] = cat[s.category] || { fit: 0, units: 0 }); cat[s.category].fit += fit(s.style_id); cat[s.category].units += IDX.units28[s.style_id] || 0; }
  const rows = styles.map(s => {
    const units = IDX.units28[s.style_id] || 0, f = fit(s.style_id), rate = units ? f / units : 0;
    const crate = cat[s.category].units ? cat[s.category].fit / cat[s.category].units : 0;
    const ratio = crate ? rate / crate : 0;
    const q = qual(s.style_id), qrate = units ? q / units : 0;
    let flag = 'ok';
    const measured = SYS.measuring[s.style_id] && typeof STATE !== 'undefined' ? STATE.prevention?.measured?.[s.style_id] : null;
    if (SYS.measuring[s.style_id] && measured && measured.keep) flag = 'fixed';
    else if (SYS.measuring[s.style_id] && !measured) flag = 'testing';
    else if (ratio >= META.f1.ratio && f >= META.f1.min_fit_returns) flag = 'flagged';
    else if (ratio >= META.f1.ratio) flag = 'watch';
    const quality = q >= META.quality_spike.min_returns && qrate / META.quality_spike.baseline_rate >= META.quality_spike.ratio;
    return { style_id: s.style_id, product: styleName(s.style_id), category: s.category, units_sold_28d: units, fit_returns: f, fit_return_rate: r3(rate), category_rate: r3(crate), ratio: r2(ratio), flag, quality_returns: q, quality_spike: quality };
  });
  return rows.sort((a, b) => b.ratio - a.ratio);
}
defTool('get_return_rate_report', {
  group: 'prevent', stage: 'prevent', label: 'Fit-return report (F1)',
  description: 'Last 28 days, per footwear style: units sold, fit returns, fit-return rate, category rate, ratio, and a flag (flagged = at least 1.5× the category and at least 15 fit returns; watch = high ratio but too few returns; testing = a fix is being measured; fixed = a fix was measured and kept). Also flags quality spikes (at least 8 quality returns and 3× the baseline).',
  props: {}, required: [],
  run(p, ctx) {
    const rows = returnRateReport().filter(r => ctx?.scope.styleId ? r.style_id === ctx.scope.styleId : !IDX.style[r.style_id]?.hybrid);
    return { window_days: 28, thresholds: { ratio: META.f1.ratio, min_fit_returns: META.f1.min_fit_returns }, rows: rows.filter(r => r.flag !== 'ok' || r.quality_spike).concat(rows.filter(r => r.flag === 'ok' && !r.quality_spike).slice(0, 3)), sources: ['returns_history_28d', 'units_sold_28d'] };
  },
  summary: r => {
    const f = r.rows.filter(x => x.flag === 'flagged'), q = r.rows.filter(x => x.quality_spike), w = r.rows.filter(x => x.flag === 'watch');
    return [f.length && `Flagged: ${f.map(x => `${x.product} (${pct(x.fit_return_rate, 1)} vs ${pct(x.category_rate, 1)}, ${x.fit_returns} fit returns)`).join(', ')}`,
      q.length && `Quality spike: ${q.map(x => `${x.product} (${x.quality_returns} returns)`).join(', ')}`,
      w.length && `Watching: ${w.map(x => `${x.product} (only ${x.fit_returns} fit returns)`).join(', ')}`].filter(Boolean).join('. ') + '.';
  },
});
defTool('read_return_comments', {
  group: 'prevent', stage: 'prevent', label: 'Read return reasons',
  description: "Returns the last 28 days of returns for one style: sub-reasons, customers' words (most common phrases), which sizes are affected, first and last dates, and production batches mentioned.",
  props: { style_id: { type: 'string' } }, required: ['style_id'],
  run({ style_id }) {
    const rows = IDX.retByStyle[style_id] || [];
    if (!rows.length) throw new Error(`No returns for ${style_id}.`);
    const count = (arr, f) => arr.reduce((m, r) => (m[f(r)] = (m[f(r)] || 0) + 1, m), {});
    const fitRows = rows.filter(r => r.return_reason === 'fit' || r.return_reason === 'quality');
    const sizes = count(fitRows, r => r.size);
    return {
      style_id, product: styleName(style_id), returns: rows.length,
      sub_reasons: count(rows, r => r.return_sub_reason),
      top_phrases: Object.entries(count(fitRows, r => r.customer_words)).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([phrase, n]) => ({ phrase, n })),
      sizes_affected: Object.fromEntries(Object.entries(sizes).sort((a, b) => Number(a[0]) - Number(b[0]))),
      first_date: rows.map(r => r.return_date).sort()[0], last_date: rows.map(r => r.return_date).sort().pop(),
      batches: [...new Set(rows.map(r => r.batch).filter(Boolean))],
      sources: [`returns_history_28d/${style_id} (${rows.length} rows)`],
    };
  },
  summary: r => `${r.returns} returns. Top words: ${r.top_phrases.slice(0, 2).map(x => `"${x.phrase}" (${x.n})`).join(', ')}. Sizes affected: ${Object.keys(r.sizes_affected).join(', ')}.${r.batches.length ? ` Batch ${r.batches.join(', ')}.` : ''}`,
});
defTool('get_tryon_scans', {
  group: 'prevent', stage: 'prevent', label: 'Read in-store try-on scans',
  description: 'Returns in-store try-on scans for a style over 28 days: tries, bought, swapped to another width, sized up and sized down, by width and size band.',
  props: { style_id: { type: 'string' } }, required: ['style_id'],
  run({ style_id }) {
    const rows = IDX.tryByStyle[style_id] || [];
    return {
      style_id, rows: rows.map(r => ({ size_band: r.size_band, width_tried: widthWord(r.width_tried), tries: r.tries, bought_rate: r2(r.bought / r.tries), swapped_width_rate: r2(r.swapped_width / r.tries), sized_up_rate: r2(r.sized_up / r.tries), sized_down_rate: r2(r.sized_down / r.tries) })),
      sources: [`tryon_scans/${style_id}`],
    };
  },
  summary: r => r.rows.length ? r.rows.map(x => `${x.width_tried} ${x.size_band}: ${pct(x.bought_rate)} bought, ${pct(x.swapped_width_rate)} swapped width, ${pct(x.sized_down_rate)} sized down`).join('; ') + '.' : 'No try-on scans.',
});
defTool('draft_product_page_fix', {
  group: 'prevent', stage: 'prevent', label: 'Draft a product page fix', gated: true,
  description: 'Drafts a short fit note for a product page (for example "Runs narrow: consider the wide fit"). It is not published: a merchandiser approves it first. Returns the draft id.',
  props: { style_id: { type: 'string' }, note: { type: 'string' }, applies_to_sizes: { type: 'string' }, cause: { type: 'string', enum: ['width', 'sizing', 'description'] }, evidence: { type: 'array', items: { type: 'string' } } }, required: ['style_id', 'note', 'cause'],
  run(p) {
    if (!IDX.style[p.style_id]) throw new Error(`Unknown style ${p.style_id}.`);
    const id = nextId('PDF');
    SYS.drafts[id] = { id, style_id: p.style_id, note: String(p.note).slice(0, 90), sizes: p.applies_to_sizes || 'all sizes', cause: p.cause, evidence: (p.evidence || []).map(String).slice(0, 6), status: 'awaiting merchandiser approval', created: Date.now() };
    const rid = nextId('HR');
    SYS.reviews[rid] = { id: rid, kind: 'page_fix', draft_id: id, case_id: null, tier: 1, approver: 'Merchandiser', reason: `Fit note for ${styleName(p.style_id)}`, recommendation: `Publish "${SYS.drafts[id].note}"`, evidence: SYS.drafts[id].evidence, status: 'pending', requested_at: Date.now(), requested_by: 'Prevention agent' };
    UI.onApprovalsChanged?.();
    return { draft_id: id, status: 'awaiting merchandiser approval', policy: 'R10 · §7.3' };
  },
  summary: r => `Draft ${r.draft_id} waiting for a merchandiser (R10).`,
});
defTool('open_quality_ticket', {
  group: 'prevent', stage: 'prevent', label: 'Open a quality ticket',
  description: 'Opens a ticket for the quality team and the supplier when returns point to a defect. No customer-facing change.',
  props: { style_id: { type: 'string' }, batch: { type: 'string' }, evidence: { type: 'array', items: { type: 'string' } } }, required: ['style_id'],
  run(p) {
    const id = nextId('QT');
    SYS.tickets[id] = { id, style_id: p.style_id, batch: p.batch || '', evidence: (p.evidence || []).map(String), status: 'open', routed_to: 'Quality team and supplier' };
    return { ticket_id: id, routed_to: 'Quality team and supplier', status: 'open' };
  },
  summary: r => `Ticket ${r.ticket_id} sent to the quality team and supplier.`,
});

/* ---------- F4: did the fix work? (difference-in-differences, code) ---------- */
function measureFix(styleId) {
  const s = DATA.f4_series[styleId];
  if (!s) return null;
  const sum = arr => arr.reduce((a, [o, f]) => [a[0] + o, a[1] + f], [0, 0]);
  const [o1, f1] = sum(s.flagged), [o2, f2] = sum(s.flagged_post), [o3, f3] = sum(s.comp), [o4, f4] = sum(s.comp_post);
  const p1 = f1 / o1, p2 = f2 / o2, p3 = f3 / o3, p4 = f4 / o4;
  const did = (p2 - p1) - (p4 - p3);
  const se = Math.sqrt(p1 * (1 - p1) / o1 + p2 * (1 - p2) / o2 + p3 * (1 - p3) / o3 + p4 * (1 - p4) / o4);
  const z = 1.645;
  const lo = did - z * se, hi = did + z * se;
  const enough = s.post_weeks >= META.f4.min_weeks || o2 >= META.f4.min_orders;
  const keep = enough && hi < 0;
  return { style: styleName(styleId), note: s.fix_note, comparison: s.comparison.map(styleName), before: p1, after: p2, compBefore: p3, compAfter: p4, ordersAfter: o2, weeksAfter: s.post_weeks, did, lo, hi, keep, enough, series: s };
}
