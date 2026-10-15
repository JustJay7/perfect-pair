/* =====================================================================
   The approvals queue. A real approver never sees one request at a time,
   so the demo starts with six waiting requests from other customers, each
   a complete return (order, tracking, photos, the customer's real history)
   that the same tools, rules and approval flow handle. They are rebuilt on
   Reset demo with fresh request times, so the escalation clocks are live.
   ===================================================================== */
const SLA_MIN = { 1: 240, 2: 120 };            // minutes before a request escalates
const ESCALATES_TO = { 1: 'Supervisor', 2: 'Regional manager' };
const QUEUE_SPECS = [
  { id: 'q1', pick: 'loyal_profitable', style: 'ST-2120', colour: 'Black', days: 9, ago: 190, tier: 1, grade: 'D', consistent: true, owner: 'supplier', reason_code: 'quality', sub: 'sole_separating',
    words: 'The sole is coming away from the toe after two wears.', shape: 'ankle', floor: 'wood', marks: ['sole_split'], close: 'toe',
    findings: ['Sole separating from the upper at the toe', 'Light wear consistent with two wears', 'No other damage'],
    shots: ['The pair on the floor', 'Close-up: the sole lifting at the toe', 'Outsole: light, even wear'],
    reason: 'Defect claim over $75: the photo shows the sole lifting, but the agent cannot rule out wear damage.', recommendation: 'Approve a refund or an exchange. A confirmed defect goes to the supplier claim, so it costs ALDO little.',
    evidence: ['Photo: sole separating at the toe', 'Two other customers reported the same on this style this season', 'Delivered 9 days ago, inside the 30-day window'] },
  { id: 'q2', pick: 'premium', style: 'ST-4410', colour: 'Black', days: 6, ago: 215, tier: 1, grade: 'A', consistent: true, owner: 'customer', reason_code: 'change_of_mind', sub: 'changed_mind',
    words: "They're lovely but they don't suit me. Unworn, still in the box.", shape: 'knee', floor: 'studio', box: 'open', close: 'toe',
    findings: ['Unworn, clean outsole', 'Original box and tissue paper', 'Tags attached'],
    shots: ['Both boots with the original box', 'Close-up: no creasing, tags on', 'Outsole: unworn'],
    reason: 'A $289 refund is over the agent\'s $250 limit (R1), so a customer-service lead signs it off (§7.1).', recommendation: 'Approve the refund. The pair is unworn and resells at full price.',
    evidence: ['Photo grade A: unworn, in the box', 'Delivered 6 days ago, inside the 30-day window', 'Return label paid by the customer unless store drop-off'] },
  { id: 'q3', pick: 'loyal', style: 'ST-6044', colour: 'Black', days: 3, ago: 300, tier: 1, grade: 'A', consistent: true, owner: 'aldo', reason_code: 'late', sub: 'arrived_late', late: 4,
    words: 'They arrived four days after the wedding I bought them for. I\'d like my money back and the express shipping I paid.', shape: 'pump', floor: 'wood', box: 'open', close: 'toe',
    findings: ['Unworn', 'Original box'], shots: ['The pair with the original box', 'Close-up: clean toe', 'Soles: unworn'],
    reason: 'Customer asks for the $15 express shipping back as well as the refund. The agent can refund the item and waive the label for a late carrier (§3.3), but it has no action that refunds shipping, so a person decides.', recommendation: 'Approve the refund and refund the express shipping: the carrier delivered 4 days late.',
    evidence: ['Carrier tracking: delivered 4 days after the promised date', 'Photo grade A: unworn', 'Express shipping paid: $15.00'] },
  { id: 'q4', pick: 'costly', style: 'ST-2187', colour: 'Tan', days: 12, ago: 40, tier: 2, grade: 'C', consistent: false, owner: 'customer', reason_code: 'damage', sub: 'damaged_in_transit', abuse: true,
    words: 'Arrived scuffed and damaged. Never worn.', shape: 'ankle', floor: 'tile', marks: ['dirt', 'vamp_crease'], close: 'vamp',
    findings: ['Creasing across the vamp', 'Dirt in the outsole tread', 'No scuff visible on the upper'],
    shots: ['The pair, side view', 'Close-up: creasing at the vamp', 'Outsole: dirt in the tread'],
    reason: 'Photo shows wear, which contradicts "never worn". Suspected abuse goes to a supervisor (R8).', recommendation: 'Decline under §2.4 or offer store credit. Ask for more photos if unsure.',
    evidence: ['Photo grade C: creasing and dirt in the tread', 'Tracking: delivered with no exceptions', 'No scuff visible where the customer says the damage is'] },
  { id: 'q5', pick: 'newest', style: 'ST-7105', colour: 'Tan', days: 4, ago: 25, tier: 1, grade: 'B', consistent: true, owner: 'customer', reason_code: 'fit', sub: 'too_small',
    words: 'Too small, they pinch at the back of the heel.', shape: 'flat', floor: 'carpet', marks: ['insole_marks'], close: 'insole',
    findings: ['Light marks on the insole', 'Photo too dark to grade the outsole'], shots: ['The pair on the floor', 'Inside: marks on the insole', 'Soles: hard to see'],
    reason: 'The photo is too dark to grade the outsole. Unclear cases go to a person (§7.2).', recommendation: 'Approve the exchange for a half size up; grade the pair at drop-off.',
    evidence: ['Photo grade B: insole marks, outsole unclear', 'Size 7.5 in stock at 3 stores', 'Delivered 4 days ago'] },
  { id: 'q6', pick: 'profitable', style: 'ST-3350', colour: 'Gold', days: 2, ago: 125, tier: 1, grade: 'D', consistent: true, owner: 'supplier', reason_code: 'quality', sub: 'strap_broke', kind: 'policy', finalSale: true,
    words: 'Bought on clearance. The strap snapped the first time I wore them.', shape: 'sandal_flat', floor: 'wood', marks: [], close: 'toe',
    findings: ['Toe strap detached at the sole', 'Otherwise unworn'], shots: ['The pair on the floor', 'Close-up: the detached strap', 'Soles: unworn'],
    reason: 'Final-sale item (§2.3), but the customer reports a defect. Final sale never covers defects.', recommendation: 'Make an exception and refund: a defect is covered even on final sale.',
    evidence: ['Order: final sale clearance, $45.00', 'Photo grade D: strap detached', 'Delivered 2 days ago'] },
];
/* Two returns already checked at a store counter: one where the grade got worse
   and a person has to decide, one the inspection rules settled on their own. */
const COUNTER_SPECS = [
  { id: 'q7', pick: 'mixed', style: 'ST-5188', colour: 'White', days: 8, ago: 70, found: 'C', shape: 'platform', floor: 'bed', marks: [], close: 'toe',
    words: "Changed my mind, they're chunkier than I expected. Never worn.", findings: ['Unworn, clean outsole', 'Original box'], shots: ['The pair on the bed', 'Close-up: clean toe', 'Soles: unworn'] },
  { id: 'q8', pick: 'steady', style: 'ST-5233', colour: 'White', days: 10, ago: 185, found: 'B', shape: 'sneaker', floor: 'wood', marks: [], close: 'toe',
    words: 'Too big, my heel slips out.', findings: ['Unworn', 'Tags attached'], shots: ['The pair on the floor', 'Close-up: clean toe', 'Soles: unworn'] },
];
let QUEUE_IDS = [];
function pickQueueCustomers() {
  const demo = new Set(DATA.cases.map(k => k.customer_id));
  const pool = DATA.customers.filter(c => !demo.has(c.customer_id) && !c.custom && (IDX.histByCust[c.customer_id] || []).length >= 3).map(c => ({ c, p: customerProfile(c.customer_id) }));
  const used = new Set(), take = (sorter, filt = () => true) => { const x = pool.filter(a => !used.has(a.c.customer_id) && filt(a)).sort(sorter)[0] || pool.find(a => !used.has(a.c.customer_id)); used.add(x.c.customer_id); return x.c.customer_id; };
  return {
    loyal_profitable: take((a, b) => b.p.net - a.p.net, a => a.c.loyalty_status === 'Gold'),
    premium: take((a, b) => b.p.aov - a.p.aov),
    loyal: take((a, b) => b.c.customer_tenure_months - a.c.customer_tenure_months, a => a.c.loyalty_status === 'Silver'),
    costly: take((a, b) => a.p.net - b.p.net),
    newest: take((a, b) => a.c.customer_tenure_months - b.c.customer_tenure_months, a => a.c.loyalty_status === 'Member'),
    profitable: take((a, b) => b.p.net - a.p.net),
    mixed: take((a, b) => (a.p.genuine_share ?? 1) - (b.p.genuine_share ?? 1), a => a.p.inspected >= 2),
    steady: take((a, b) => b.p.orders - a.p.orders),
  };
}
function removeQueue() {
  for (const id of QUEUE_IDS) {
    const k = IDX.kase[id]; if (!k) continue;
    clearCaseRecords(id);
    delete IDX.order[k.order_id]; delete IDX.track[k.order_id]; delete IDX.kase[id]; delete IDX.kaseByReturn[k.return_id];
    delete CASES[id];
  }
  QUEUE_IDS = [];
}
function seedQueue() {
  removeQueue();
  const who = pickQueueCustomers(), now = Date.now();
  QUEUE_SPECS.forEach((q, i) => {
    const st = IDX.style[q.style], cid = who[q.pick], c = IDX.cust[cid];
    const s = DATA.skus.find(x => x.style_id === q.style && x.colour === q.colour && x.width !== 'W' && Number(x.size) >= 7.5) || DATA.skus.find(x => x.style_id === q.style);
    const oid = `O-5${7300 + i}`, rid = `R-9030${i + 1}`;
    const delivered = addDays(META.today, -q.days), promised = addDays(delivered, -(q.late || 0));
    const price = q.finalSale ? r2(st.price * 0.6) : st.price;
    IDX.order[oid] = { order_id: oid, customer_id: cid, order_date: addDays(promised, -4), channel: 'Online', country: 'CA', store_or_ecom: 'E-commerce',
      lines: [{ line_id: 'L1', sku: s.sku, style_id: q.style, product: styleName(q.style), colour: s.colour, size: s.size, width: s.width, quantity: 1, selling_price: price, discount: q.finalSale ? r2(st.price - price) : 0, promotion: q.finalSale ? 'Final sale clearance' : '', final_sale: !!q.finalSale }],
      shipping_method: q.late ? 'Express' : 'Standard', shipping_cost: q.late ? 15 : 0, fulfilment_location: 'DC-MTL', estimated_delivery_date: promised, delivery_date: delivered, queue: true };
    IDX.track[oid] = { order_id: oid, events: [[addDays(promised, -3), 'Picked up', 'Montreal', ''], [addDays(promised, -1), 'In transit', 'Montreal sort centre', ''], ...(q.late ? [[promised, 'Delayed', 'Sort centre', 'Missed connection']] : []), [delivered, 'Delivered', c.region, '']], queue: true };
    const k = { case_id: q.id, label: c.display_name || 'Customer', tag: 'Queue', headline: `${styleName(q.style)}: ${q.words.split(/[.!?]/)[0]}`, customer_id: cid, order_id: oid, line_id: 'L1', return_id: rid, words: q.words, queue: true, expect: null,
      photo: { file: `IMG_${8100 + i * 37}.jpg`, grade: q.grade, consistent: q.consistent, findings: q.findings, plan: { shape: q.shape, floor: q.floor, box: q.box, marks: q.marks || [], close: q.close, third: 'sole', shots: q.shots } } };
    IDX.kase[q.id] = k; IDX.kaseByReturn[rid] = k; QUEUE_IDS.push(q.id);
    const cs = CASES[q.id] = newCaseState(q.id);
    cs.status = 'review'; cs.reasonCode = q.reason_code; cs.subReason = q.sub; cs.costOwner = q.owner;
    if (q.abuse) cs.flags.suspected_abuse = true;
    cs.decision = { status: 'human_review', recommended: null, cost_owner: q.owner, reason_code: q.reason_code, sub_reason: q.sub, options: [], guards: [], citations: [],
      eligibility: { clause: q.finalSale ? '§2.3' : '§2.1', note: q.finalSale ? 'Final sale clearance item.' : `Delivered ${q.days} days ago, inside the 30-day window.` },
      customer_message: 'Thanks for the details and the photos. A member of our team will review your return within 1 business day.' };
    const rvId = `HR-40${String(i + 1).padStart(2, '0')}`;
    SYS.reviews[rvId] = { id: rvId, case_id: q.id, kind: q.kind || 'case', tier: q.tier, approver: q.tier === 2 ? 'Supervisor' : 'Customer-service lead', reason: q.reason, recommendation: q.recommendation,
      evidence: q.evidence, amount: price, status: 'pending', requested_at: now - q.ago * 60000, requested_by: 'Resolution agent (scripted)', queue: true };
  });
  COUNTER_SPECS.forEach((q, j) => {
    const i = QUEUE_SPECS.length + j, st = IDX.style[q.style], cid = who[q.pick], c = IDX.cust[cid];
    const s = DATA.skus.find(x => x.style_id === q.style && x.colour === q.colour && x.width !== 'W' && Number(x.size) >= 7.5) || DATA.skus.find(x => x.style_id === q.style);
    const oid = `O-5${7300 + i}`, rid = `R-9030${i + 1}`, delivered = addDays(META.today, -q.days), price = st.price;
    IDX.order[oid] = { order_id: oid, customer_id: cid, order_date: addDays(delivered, -4), channel: 'Online', country: 'CA', store_or_ecom: 'E-commerce',
      lines: [{ line_id: 'L1', sku: s.sku, style_id: q.style, product: styleName(q.style), colour: s.colour, size: s.size, width: s.width, quantity: 1, selling_price: price, discount: 0, promotion: '', final_sale: false }],
      shipping_method: 'Standard', shipping_cost: 0, fulfilment_location: 'DC-MTL', estimated_delivery_date: delivered, delivery_date: delivered, queue: true };
    IDX.track[oid] = { order_id: oid, events: [[addDays(delivered, -3), 'Picked up', 'Montreal', ''], [delivered, 'Delivered', c.region, '']], queue: true };
    const k = { case_id: q.id, label: c.display_name || 'Customer', tag: 'Queue', headline: `${styleName(q.style)}: ${q.words.split(/[.!?]/)[0]}`, customer_id: cid, order_id: oid, line_id: 'L1', return_id: rid, words: q.words, queue: true, expect: null,
      photo: { file: `IMG_${8100 + i * 37}.jpg`, grade: 'A', consistent: true, findings: q.findings, plan: { shape: q.shape, floor: q.floor, marks: q.marks, close: q.close, third: 'sole', shots: q.shots } } };
    IDX.kase[q.id] = k; IDX.kaseByReturn[rid] = k; QUEUE_IDS.push(q.id);
    const store = (DATA.locations.find(l => l.type === 'store' && l.region === c.region) || DATA.locations.find(l => l.type === 'store')).location_id;
    const cs = CASES[q.id] = newCaseState(q.id);
    cs.status = 'received'; cs.reasonCode = q.found === 'C' ? 'change_of_mind' : 'fit'; cs.costOwner = 'customer';
    cs.decision = { status: 'options_ready', recommended: 'refund', cost_owner: 'customer', reason_code: cs.reasonCode, options: [], guards: [], citations: [], eligibility: { clause: '§2.1', note: `Delivered ${q.days} days ago, inside the 30-day window.` } };
    cs.chosen = { option: 'refund', method: 'store_dropoff', dropStore: store, by: 'customer' };
    cs.message = `We'll refund ${money(price)} as soon as the store checks them at drop-off.`;
    const rf = `RF-40${i + 1}`, lb = `LBL-40${i + 1}`;
    SYS.refunds[rf] = { id: rf, case_id: q.id, amount: price, timing: 'at_dropoff', keep_item: false, status: 'scheduled', held_for: 'quality check' };
    SYS.labels[lb] = { id: lb, case_id: q.id, method: 'store_dropoff', fee: 0, drop_by: addDays(META.today, 14), store, status: 'used' };
    const rule = inspectionRule(q.id, q.found), best = routeScores(q.id, q.found, store)[0], at = now - q.ago * 60000;
    if (rule.release) { SYS.refunds[rf].status = 'issued'; SYS.refunds[rf].released_after = `quality check ${rule.id}`; } else SYS.refunds[rf].status = 'on_hold';
    cs.received = { store, grade: q.found, expected: 'A', matches: false, destination: best, keepHere: best.location_id === store, at, rule, released: rule.release ? rf : undefined, held: rule.release ? undefined : rf };
    const rvId = `HR-40${String(i + 1).padStart(2, '0')}`;
    const base = { id: rvId, case_id: q.id, kind: 'counter', tier: 1, approver: 'Store manager', reason: `Graded ${q.found} at the counter; the customer's photo showed A.`, amount: price, requested_at: at, requested_by: 'Store counter', rule: rule.id, queue: true,
      evidence: ['Packed at the distribution centre as grade A', `Customer's photo ${k.photo.file}: grade A`, `Store check at ${IDX.loc[store].name}: grade ${q.found}`] };
    cs.received.review = rvId;
    if (rule.auto) Object.assign(base, { status: 'approved', recommendation: rule.text, decision: 'auto_release', decided_at: at + 1000, decided_by: `Automated (R13 ${rule.id})`, auto: true });
    else { const co = counterOptions(q.id); Object.assign(base, { status: 'pending', recommendation: `${co.best.label}. ${co.why}` }); }
    SYS.reviews[rvId] = base;
  });
}
// Rebuild the queue whenever the demo resets.
const resetAllBase = resetAll;
resetAll = function () { removeQueue(); resetAllBase(); seedQueue(); };
seedQueue();
