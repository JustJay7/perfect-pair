/* Supplied history is immutable context; the operational case is explicitly simulated. */
function createHybridCase(evidence, id) {
  const existing = IDX.kase[id]; if (existing) return existing;
  const clone = x => JSON.parse(JSON.stringify(x));
  const base = caseCtx('maya'), record = evidence.record, sid = `SIM-${id}`, skumap = {};
  const price = record.qty > 0 && record.refund > 0 ? r2(record.refund / record.qty / 100) : base.line.selling_price;
  const matched = evidence.order_matches.length === 1 ? evidence.order_matches[0] : null;
  const actualSize = matched && Number(matched.size) >= 3 && Number(matched.size) <= 16 ? normSize(matched.size) : null;
  const size = actualSize || base.line.size;
  const st = { ...clone(base.st), style_id: sid, name: record.name || record.sku, brand: record.banner, price,
    description: 'Synthetic demo attributes for a product observed in the supplied history.', hybrid: true, source_sku: record.sku };
  st.sizes = [...new Set([...st.sizes, size])].sort((a,b) => +a - +b);
  DATA.catalogue.push(st); IDX.style[sid] = st;
  const cost = r2(price * .45), ec = { ...clone(base.ec), style_id: sid, retail_price: price, estimated_cost: cost, gross_margin: r2(price - cost), estimated_recovery_value: r2(price * .7), hybrid: true };
  DATA.economics.push(ec); IDX.econ[sid] = ec;
  const sourceSkus = DATA.skus.filter(s => s.style_id === base.st.style_id);
  for (const source of sourceSkus) {
    const s = { ...clone(source), style_id: sid, sku: makeSku(sid, source.colour, source.size, source.width), hybrid: true };
    skumap[source.sku] = s.sku; DATA.skus.push(s); IDX.sku[s.sku] = s;
    const inventory = (IDX.invBySku[source.sku] || []).map(row => ({ ...clone(row), sku: s.sku, hybrid: true }));
    DATA.inventory.push(...inventory); IDX.invBySku[s.sku] = inventory;
  }
  let selected = DATA.skus.find(s => s.style_id === sid && s.size === size && s.width === 'M');
  if (!selected) {
    selected = { ...clone(IDX.sku[skumap[base.line.sku]]), sku: makeSku(sid, 'Black', size, 'M'), size, hybrid: true };
    DATA.skus.push(selected); IDX.sku[selected.sku] = selected;
    const inv = (IDX.invBySku[skumap[base.line.sku]] || []).map(x => ({ ...x, sku: selected.sku }));
    DATA.inventory.push(...inv); IDX.invBySku[selected.sku] = inv;
  }
  for (const table of ['reviews','returns_history','tryon_scans','sales_28d']) {
    const rows = DATA[table].filter(x => x.style_id === base.st.style_id).map(x => ({ ...clone(x), style_id: sid, hybrid: true, ...(x.sku ? { sku: skumap[x.sku] } : {}), ...(x.review_id ? { review_id: `${id}-${x.review_id}` } : {}), ...(x.return_id ? { return_id: `${id}-${x.return_id}` } : {}) }));
    DATA[table].push(...rows);
  }
  IDX.revByStyle[sid] = DATA.reviews.filter(x => x.style_id === sid); IDX.retByStyle[sid] = DATA.returns_history.filter(x => x.style_id === sid);
  IDX.tryByStyle[sid] = DATA.tryon_scans.filter(x => x.style_id === sid); IDX.units28[sid] = DATA.sales_28d.find(x => x.style_id === sid).units_sold_28d;
  const cid = `SIM-C-${id}`, oid = `SIM-O-${id}`, rid = `SIM-R-${id}`;
  const c = { ...clone(base.c), customer_id: cid, display_name: 'Demo customer', hybrid: true };
  const o = { ...clone(base.o), order_id: oid, customer_id: cid, hybrid: true,
    lines: [{ ...clone(base.line), sku: selected.sku, style_id: sid, product: st.name, size, selling_price: price, final_sale: evidence.final_sale === true }] };
  const tracking = { ...clone(IDX.track[base.o.order_id]), order_id: oid, hybrid: true };
  const k = { ...clone(base.k), case_id: id, label: st.name.slice(0, 24), tag: 'Actual + synthetic', headline: `${st.name}: historical reason ${record.reason}`,
    customer_id: cid, order_id: oid, return_id: rid, words: `In this simulated new return, the concern is: ${record.reason}. Please help me find an eligible resolution.`, hybrid: true, expect: null,
    evidence, provenance: { supplied: ['SKU', 'banner', 'recorded return reason', 'recorded refund amount', ...(actualSize ? ['matched order size'] : []), ...(evidence.final_sale !== null ? ['historical final-sale flag'] : [])],
      assumed: ['new case and customer profile', 'new purchase/delivery dates', 'new-case selling price', 'inventory and replacement variants', 'reviews and try-on data', 'photo condition', 'logistics and recovery costs', 'current demo policy', ...(!actualSize ? ['demo size'] : []), ...(evidence.final_sale===null?['current final-sale eligibility (unknown in supplied records)']:[])],
      price_basis: record.qty > 0 && record.refund > 0 ? 'Assumed new-case price derived from recorded refund / quantity; original selling price is not supplied.' : 'Synthetic price from the existing demo.',
      currency: 'CAD assumed for the simulation; the source currency is unknown.', source_refs: evidence.citations },
    photo: { ...clone(base.k.photo), findings: ['Synthetic condition: unworn, used only for this simulated new case.'] } };
  DATA.customers.push(c); DATA.orders.push(o); DATA.tracking.push(tracking); DATA.cases.push(k);
  IDX.cust[cid] = c; IDX.order[oid] = o; IDX.track[oid] = tracking; IDX.kase[id] = k; IDX.kaseByReturn[rid] = k;
  CASES[id] = newCaseState(id);
  return k;
}
