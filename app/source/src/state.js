/* The same snapshot shape is used by the trusted runtime and its browser view. */
function exportCaseWorkspace() {
  const extraCases = Object.values(IDX.kase).filter(k => k.custom || k.hybrid);
  const styles = new Set(extraCases.map(k => caseCtx(k.case_id).line.style_id));
  return JSON.parse(JSON.stringify({
    learning: typeof LEARN === "undefined" ? null : LEARN, realNotes: STATE.realNotes || {}, schema: 1, cases: CASES, systems: SYS, audit: STATE.audit, auditSeq: STATE.auditSeq,
    prevention: STATE.prevention, evseq: EVSEQ, customSeq: CUSTOM_SEQ,
    extra: { cases: extraCases, customers: extraCases.map(k => IDX.cust[k.customer_id]), orders: extraCases.map(k => IDX.order[k.order_id]), tracking: extraCases.map(k => IDX.track[k.order_id]),
      catalogue: DATA.catalogue.filter(x => styles.has(x.style_id)), economics: DATA.economics.filter(x => styles.has(x.style_id)),
      skus: DATA.skus.filter(x => styles.has(x.style_id)), inventory: DATA.inventory.filter(x => styles.has(IDX.sku[x.sku]?.style_id)),
      reviews: DATA.reviews.filter(x => styles.has(x.style_id)), returns_history: DATA.returns_history.filter(x => styles.has(x.style_id)),
      tryon_scans: DATA.tryon_scans.filter(x => styles.has(x.style_id)), sales_28d: DATA.sales_28d.filter(x => styles.has(x.style_id)) },
  }, (key, value) => key === 'blob' || key === 'url' ? undefined : value));
}
function restoreCaseWorkspace(s) {
  if (!s || s.schema !== 1) throw new Error('Unsupported saved workspace.');
  const specs = { cases: ['case_id', 'kase'], customers: ['customer_id', 'cust'], orders: ['order_id', 'order'], tracking: ['order_id', 'track'], catalogue: ['style_id', 'style'], economics: ['style_id', 'econ'], skus: ['sku', 'sku'] };
  for (const [table, [key, index]] of Object.entries(specs)) {
    const remove = DATA[table].filter(x => x.custom || x.hybrid);
    for (const r of remove) delete IDX[index][r[key]];
    DATA[table] = DATA[table].filter(x => !x.custom && !x.hybrid);
    for (const row of s.extra[table] || []) {
      const at = DATA[table].findIndex(x => x[key] === row[key]);
      if (at >= 0) DATA[table][at] = row; else DATA[table].push(row);
      IDX[index][row[key]] = row;
    }
  }
  for (const table of ['inventory', 'reviews', 'returns_history', 'tryon_scans', 'sales_28d']) {
    DATA[table] = DATA[table].filter(x => !x.hybrid);
    DATA[table].push(...(s.extra[table] || []).filter(x => x.hybrid));
  }
  IDX.kaseByReturn = byKey(Object.values(IDX.kase), 'return_id');
  IDX.invBySku = groupBy(DATA.inventory, 'sku'); IDX.revByStyle = groupBy(DATA.reviews, 'style_id');
  IDX.retByStyle = groupBy(DATA.returns_history, 'style_id'); IDX.tryByStyle = groupBy(DATA.tryon_scans, 'style_id');
  IDX.units28 = Object.fromEntries(DATA.sales_28d.map(x => [x.style_id, x.units_sold_28d]));
  function hydrate(target, source) {
    for (const key of Object.keys(target)) if (!(key in source)) delete target[key];
    for (const [key,value] of Object.entries(source)) {
      if (value && typeof value === 'object' && target[key] && typeof target[key] === 'object' && Array.isArray(value) === Array.isArray(target[key])) {
        hydrate(target[key],value); if(Array.isArray(value))target[key].length=value.length;
      } else target[key]=value;
    }
  }
  hydrate(CASES,s.cases); hydrate(SYS,s.systems);
  STATE.audit = s.audit; STATE.auditSeq = s.auditSeq || 0; hydrate(STATE.prevention,s.prevention);
  if (typeof LEARN !== "undefined" && s.learning) Object.assign(LEARN,s.learning); STATE.realNotes = s.realNotes || {};
  EVSEQ = s.evseq || 0; CUSTOM_SEQ = s.customSeq || 0;
}
