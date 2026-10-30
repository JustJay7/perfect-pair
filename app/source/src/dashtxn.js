/* ---------- Dashboard on ALDO's 2025 transaction detail ----------
   DATA.txn: totals from 8.7M sales and return lines (ALDO CA and US, fiscal 2025),
   aggregated on the laptop; the raw file never left it. Unlike the returns
   extract, this one has what was sold, at what cost, so return rates and the
   margin given back on returns are real, not estimated. Web cancellations
   (out of stock, fraud declines) are booked like returns in the file; they are
   counted separately here. */
const TXN = (() => {
  const T = DATA.txn; if (!T) return null;
  const C = T.cube, cube = new Array(C.su.length);
  for (let i = 0; i < cube.length; i++) cube[i] = { m: T.months[C.m[i]], b: T.banners[C.b[i]], c: T.channels[C.c[i]], k: T.cats[C.k[i]], p: T.prices[C.p[i]], su: C.su[i], sv: C.sv[i], sm: C.sm[i], ru: C.ru[i], rv: C.rv[i], rm: C.rm[i], cu: C.cu[i] };
  const D = T.day, d0 = dayNum(T.start), day = new Array(D.su.length);
  for (let i = 0; i < day.length; i++) day[i] = { dn: d0 + D.d[i], b: T.banners[D.b[i]], c: T.channels[D.c[i]], su: D.su[i], sv: D.sv[i], sm: D.sm[i], ru: D.ru[i], rv: D.rv[i], rm: D.rm[i], cu: D.cu[i] };
  const dEnd = Math.max(...day.map(r => r.dn));
  return Object.assign({}, T, { cube, day, d0, dEnd });
})();
const TCH_WORD = { STR: 'Stores', WEB: 'Online', INSTORE: 'Online orders filled by a store', WCC: 'Customer care' };
const PG_WORD = { Regular: 'Full price', Markdown: 'Marked down', 'Promo Regular': 'Promotion on full price', 'Promo Markdown': 'Promotion on markdown' };
UI.tdash = UI.tdash || { gran: 'month', range: 'all', banner: 'all', channel: 'all', cat: 'all', price: 'all', conv: 0.2 };
const tsum = rows => { const a = { su: 0, sv: 0, sm: 0, ru: 0, rv: 0, rm: 0, cu: 0 }; for (const r of rows) for (const k in a) a[k] += r[k] || 0; return a; };
const rrate = a => a.su ? a.ru / a.su : 0;

function txnRange() {
  const f = UI.tdash;
  if (f.range === 'custom' && f.from && f.to) { const a = dayNum(f.from), b = dayNum(f.to); return { start: Math.min(a, b), end: Math.max(a, b) }; }
  const R = { '30d': 30, '90d': 90, '6m': 183 }[f.range];
  return R ? { start: TXN.dEnd - R + 1, end: TXN.dEnd } : { start: TXN.d0, end: TXN.dEnd };
}
const monthIn = (m, s, e) => { const a = dayNum(m + '-01'), b = nextPeriod(a, 'month') - 1; return b >= s && a <= e; };

function renderTxnDashboard(el) {
  const f = UI.tdash, { start, end } = txnRange();
  const fc = r => (f.banner === 'all' || r.b === f.banner) && (f.channel === 'all' || r.c === f.channel);
  const cubeRows = TXN.cube.filter(r => fc(r) && (f.cat === 'all' || r.k === f.cat) && (f.price === 'all' || r.p === f.price) && monthIn(r.m, start, end));
  // Day and week need the daily table, which has no category or price split: with those filters on, periods are months.
  const needCube = f.cat !== 'all' || f.price !== 'all';
  const gran = needCube && ['day', 'week'].includes(f.gran) ? 'month' : f.gran;
  const dayRows = TXN.day.filter(r => fc(r) && r.dn >= start && r.dn <= end);
  const A = needCube ? tsum(cubeRows) : tsum(dayRows);
  const keys = []; for (let k = periodKey(start, gran); k <= end; k = nextPeriod(k, gran)) keys.push(k);
  const idx = new Map(keys.map((k, i) => [k, i])), labels = keys.map(k => periodLabel(k, gran));
  const by = keys.map(() => ({ su: 0, sv: 0, sm: 0, ru: 0, rv: 0, rm: 0, cu: 0 }));
  if (needCube || gran === 'month' || gran === 'year') { for (const r of cubeRows) { const i = idx.get(periodKey(dayNum(r.m + '-01'), gran)); if (i != null) for (const k in by[i]) by[i][k] += r[k]; } }
  else for (const r of dayRows) { const i = idx.get(periodKey(r.dn, gran)); if (i != null) for (const k in by[i]) by[i][k] += r[k]; }
  const web = tsum(TXN.day.filter(r => (f.banner === 'all' || r.b === f.banner) && r.c === 'WEB' && r.dn >= start && r.dn <= end));
  const tiles = [
    ['Net sales', whole(A.sv), `${num(A.su)} units sold`],
    ['Gross margin at sale', whole(A.sm), `${pct(A.sm / (A.sv || 1), 1)} of sales`],
    ['Units returned', num(A.ru), `${pct(rrate(A), 1)} of units sold`],
    ['Refunded on returns', whole(A.rv), `${pct(A.rv / (A.sv || 1), 1)} of sales value`],
    ['Margin given back', whole(A.rm), `${pct(A.rm / (A.sm || 1), 1)} of the margin earned`],
    ['Margin per returned unit', money(A.rm / (A.ru || 1)), 'what one avoided return keeps'],
    ['Online return rate', pct(rrate(web), 1), `${num(web.ru)} of ${num(web.su)} online units · many online orders come back in stores`],
    ['Cancellations, not returns', num(A.cu), 'out of stock or declined as fraud: counted apart'],
  ];
  const opt = (v, cur, word) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(v === 'all' ? 'All' : word)}</option>`;
  const head = `<div class="section-head"><div><div class="eyebrow">Returns dashboard · real ALDO Group data</div><h2>Sales, returns and margin, 2025</h2><p>Every sale and return line of ALDO Canada and ALDO US for fiscal 2025 (${fmtY(TXN.start)} to ${fmtY(isoOf(TXN.dEnd))}): ${num(TXN.rows)} lines, totalled on the team laptop so the file never left it. Because it has what was sold and what it cost, the return rates and the margin given back are exact. No customer, transaction or store numbers are in this page.</p></div></div>
    ${dashSrcSwitch('txn')}
    <div class="dash-controls">
      ${dateSel('tgran', 'Group by', [['day', 'Day'], ['week', 'Week'], ['month', 'Month']], gran)}
      ${dateSel('trange', 'Period', [['30d', 'Last 30 days'], ['90d', 'Last 90 days'], ['6m', 'Last 6 months'], ['all', 'Whole year']], f.range)}
      <div class="dates" role="group" aria-label="Pick dates"><label class="dsel">From <input type="date" data-tdate="from" min="${TXN.start}" max="${isoOf(TXN.dEnd)}" value="${isoOf(start)}"></label><label class="dsel">To <input type="date" data-tdate="to" min="${TXN.start}" max="${isoOf(TXN.dEnd)}" value="${isoOf(end)}"></label>${f.range === 'custom' ? '<span class="pill info">Custom dates</span><button type="button" class="btn secondary sm" data-tclear="1">Clear dates</button>' : ''}</div>
      <label class="dsel">Banner <select data-tfilter="banner">${['all', ...TXN.banners].map(v => opt(v, f.banner, BANNER_WORD[v] || v)).join('')}</select></label>
      <label class="dsel">Channel <select data-tfilter="channel">${['all', ...TXN.channels].map(v => opt(v, f.channel, TCH_WORD[v] || v)).join('')}</select></label>
      <label class="dsel">Category <select data-tfilter="cat">${['all', ...TXN.cats].map(v => opt(v, f.cat, v)).join('')}</select></label>
      <label class="dsel">Price <select data-tfilter="price">${['all', ...TXN.prices].map(v => opt(v, f.price, PG_WORD[v] || v)).join('')}</select></label>
      <span class="small muted">${fmtY(isoOf(start))} to ${fmtY(isoOf(end))}${needCube && ['day', 'week'].includes(f.gran) ? ' · category and price filters work by month' : ''}${needCube || ['month'].includes(gran) ? ' · months partly outside the dates count in full' : ''}</span>
    </div>
    <div class="dash-tiles">${tiles.map(t => `<div class="stat"><div class="l">${esc(t[0])}</div><div class="v">${esc(t[1])}</div><div class="s">${esc(t[2])}</div></div>`).join('')}</div>`;
  const gw = gran;
  const c1 = vizCard('t:trend', `Return rate per ${gw}`, 'Units returned as a share of units sold in the same period', [
    { id: 'line', render: () => lineSVG(labels, [{ name: 'Return rate', color: 'var(--cat-2)', values: by.map(p => r2(rrate(p) * 100)) }], { fmt: v => v.toFixed(1) + '%', tick: v => v + '%' }) },
    { id: 'group', title: `Sales and returns per ${gw}`, sub: 'Sales before returns compared with recorded return amounts', render: () => groupSVG(labels, [{ name: 'Sales before returns', color: 'var(--chart-2)', values: by.map(p => p.sv) }, { name: 'Refunded on returns', color: 'var(--cat-2)', values: by.map(p => p.rv) }], { fmt: whole, tick: compactMoney }), note: 'Side by side: sales and refunds in dollars.' },
    { id: 'stack', title: `Gross margin per ${gw}`, sub: 'Recorded gross margin split into retained and reversed amounts', render: () => stackSVG(labels, [{ name: 'Margin kept', color: 'var(--cat-3)', values: by.map(p => Math.max(0, p.sm - p.rm)) }, { name: 'Margin given back on returns', color: 'var(--cat-2)', values: by.map(p => p.rm) }], { fmt: whole, tick: compactMoney }), note: 'Stacked: the gross margin earned, split into what stayed and what returns gave back.' },
  ], `A return is dated when it comes back, so a period's rate compares that period's returns with its sales.`,
  tableView([gw[0].toUpperCase() + gw.slice(1), 'Units sold', 'Net sales', 'Units returned', 'Return rate', 'Refunded', 'Margin given back'], by.map((p, i) => [labels[i], num(p.su), whole(p.sv), num(p.ru), pct(rrate(p), 1), whole(p.rv), whole(p.rm)]), [0, 1, 1, 1, 1, 1, 1]));
  // Category view ignores the category filter so the comparison stays visible.
  const catAgg = {}; for (const r of TXN.cube) if (fc(r) && (f.price === 'all' || r.p === f.price) && monthIn(r.m, start, end)) { const a = catAgg[r.k] = catAgg[r.k] || { su: 0, sv: 0, sm: 0, ru: 0, rv: 0, rm: 0, cu: 0 }; for (const k in a) a[k] += r[k]; }
  const catRows = Object.entries(catAgg).filter(([, a]) => a.su >= 20000).sort((a, b) => b[1].rm - a[1].rm);
  const c2 = vizCard('t:cat', 'Which categories come back', 'Return rate and margin given back, by category', [
    { id: 'bar', render: () => hbars(catRows.map(([k, a]) => ({ label: k, value: rrate(a), sub: `${whole(a.rm)} margin given back`, hl: k === f.cat, tip: `${k}\n${pct(rrate(a), 1)} returned · ${num(a.ru)} of ${num(a.su)}\n${whole(a.rm)} margin given back` })).sort((a, b) => b.value - a.value), { fmt: v => pct(v, 1) }) },
    { id: 'col', render: () => colsSVG(catRows.slice(0, 12).map(([k, a]) => ({ label: k, value: a.rm, tip: `${k}\n${whole(a.rm)} margin given back` })), { fmt: whole, tick: compactMoney }), note: 'Columns: margin given back, the 12 categories that cost most.' },
    { id: 'scatter', render: () => scatterSVG(catRows.map(([k, a]) => ({ x: a.sv, y: rrate(a), label: k, hl: k === f.cat, tip: `${k}\n${whole(a.sv)} sales · ${pct(rrate(a), 1)} returned` })), { x: { label: 'Net sales', fmt: compactMoney, zero: true }, y: { label: 'Return rate', fmt: v => pct(v), zero: true } }), note: 'Scatter: big categories to the right, high return rates at the top. Top right is where the money is.' },
  ], 'Boots and dress shoes come back most; jewellery and care products almost never do. Fit and comfort drive footwear returns, which is where an exchange saves the sale.',
  tableView(['Category', 'Units sold', 'Return rate', 'Refunded', 'Margin given back'], catRows.map(([k, a]) => [k, num(a.su), pct(rrate(a), 1), whole(a.rv), whole(a.rm)]), [0, 1, 1, 1, 1]));
  const pg = {}; for (const r of cubeRows) { const a = pg[r.p] = pg[r.p] || { su: 0, sv: 0, sm: 0, ru: 0, rv: 0, rm: 0, cu: 0 }; for (const k in a) a[k] += r[k]; }
  const c3 = vizCard('t:price', 'Full price or discounted', 'Return rate by how the item was priced', [{ id: 'bar', render: () => hbars(TXN.prices.filter(p => pg[p]).map(p => ({ label: PG_WORD[p] || p, value: rrate(pg[p]), sub: `${num(pg[p].su)} sold`, tip: `${PG_WORD[p] || p}\n${pct(rrate(pg[p]), 1)} returned\n${num(pg[p].ru)} of ${num(pg[p].su)} units` })), { fmt: v => pct(v, 1) }) }],
    'Promotions stacked on markdowns come back far more than anything else: deep discounts invite buying "to try". Worth testing a final-sale or credit-only rule there.');
  const regs = TXN.region.filter(r => (f.banner === 'all' || r.banner === f.banner) && r.su >= 20000).map(r => ({ label: `${r.region_name.replace(/^ALDO (CA|US)-?/, (m0, b) => b + ' · ')}`, value: rrate(r), sub: `${num(r.su)} sold`, tip: `${r.region_name}\n${pct(rrate(r), 1)} returned · ${num(r.ru)} of ${num(r.su)}` })).sort((a, b) => b.value - a.value);
  const cl = TXN.cluster.filter(r => r.su >= 20000 && r.cluster_group_name !== '(blank)').map(r => ({ label: r.cluster_group_name, value: rrate(r), sub: `${num(r.su)} sold`, tip: `${r.cluster_group_name}\n${pct(rrate(r), 1)} returned` })).sort((a, b) => b.value - a.value);
  const c4 = vizCard('t:where', 'Where returns happen', 'Return rate by region and by store group · whole year', [
    { id: 'bar', render: () => hbars(regs, { fmt: v => pct(v, 1) }) },
    { id: 'ban', render: () => hbars(cl, { fmt: v => pct(v, 1) }), note: 'By store group: outlets see fewer returns than full-price stores.' },
  ], 'ALDO Canada returns about 10% of units, ALDO US about 7%. E-commerce regions look low because many online orders are returned in a store and booked there.');
  const mats = TXN.material.filter(r => r.main_material_description !== '(blank)').map(r => ({ label: r.main_material_description[0] + r.main_material_description.slice(1).toLowerCase(), value: rrate(r), sub: `${num(r.su)} sold`, tip: `${r.main_material_description}\n${pct(rrate(r), 1)} returned` }));
  const ors = TXN.origin.map(r => ({ label: r.country_of_origin, value: rrate(r), sub: `${num(r.su)} sold`, tip: `Made in ${r.country_of_origin}\n${pct(rrate(r), 1)} returned · ${num(r.ru)} of ${num(r.su)}` })).sort((a, b) => b.value - a.value);
  const c5 = vizCard('t:make', 'Material and where it was made', 'Return rate · whole year', [
    { id: 'bar', render: () => hbars(mats, { fmt: v => pct(v, 1) }) },
    { id: 'col', render: () => hbars(ors, { fmt: v => pct(v, 1) }), note: 'Country of origin (ISO codes). Mostly a proxy for product type: leather shoes are made in Vietnam, Brazil and Portugal, accessories in China.' },
  ], 'Leather comes back more than synthetic, mostly because leather means shoes and boots, where fit matters.');
  const zs = TXN.sizes;
  const c6 = vizCard('t:size', 'Return rate by shoe size', 'Footwear only · whole year', [{ id: 'col', render: () => colsSVG(zs.map(z => ({ label: z.size, value: r2(z.ru / z.su * 100), tip: `Size ${z.size}\n${pct(z.ru / z.su, 1)} returned · ${num(z.ru)} of ${num(z.su)}` })), { fmt: v => v.toFixed(1) + '%', tick: v => v + '%' }) }],
    'Size 5 comes back most (about 14%) and the largest sizes least; the middle of the run sits around 11 to 13%. The agent\'s size suggestion matters most at the small end.');
  const st = TXN.reasons.filter(r => r.src === 'store'), wb = TXN.reasons.filter(r => r.src === 'web');
  const c7 = vizCard('t:why', 'Why it came back', 'Store reason codes and online reasons · whole year', [
    { id: 'bar', render: () => hbars(wb.map(r => ({ label: r.reason, value: r.ru, sub: whole(r.rv), tip: `${r.reason}\n${num(r.ru)} units · ${whole(r.rv)} refunded` })), { fmt: num }), note: 'Online: the reason the customer picked.' },
    { id: 'col', render: () => hbars(st.map(r => ({ label: /^\d+$/.test(r.reason) ? `Code ${r.reason}` : r.reason, value: r.ru, sub: whole(r.rv), tip: `${r.reason}\n${num(r.ru)} units · ${whole(r.rv)} refunded` })), { fmt: num }), note: 'Stores: numeric codes. What each code means is not in the file; code 11 alone is 80% of store returns.' },
  ], 'Online, fit (too big, too small, uncomfortable) leads. In stores, reasons are numeric codes the file doesn\'t explain: ask ALDO for the code list, since one code covers most store returns and hides the real reason. Perfect Pair records the customer\'s own words for every return.');
  const canc = TXN.cancels, cTot = canc.reduce((s, c) => s + c.units, 0);
  const cancHTML = `<section class="card card-pad dash-impact"><div class="eyebrow">Not returns, but booked like them</div><h3>Online cancellations</h3>
    <div class="imp-grid">${canc.sort((a, b) => b.units - a.units).map(c => `<div class="imp"><div class="small muted">${esc({ CANCELLED_OUT_OF_STOCK: 'Cancelled: out of stock', 'RISKIFIED::DECLINED': 'Declined as possible fraud', 'ORDER CANCELLED': 'Order cancelled', MANUALLY_CANCELLED_PRE_PICK: 'Cancelled before picking' }[c.reason] || c.reason)}</div><div class="imp-row"><b class="mono">${num(c.units)}</b><span class="small muted">units · ${whole(c.value)}</span></div></div>`).join('')}</div>
    <p class="small muted" style="margin:8px 0 0">${num(cTot)} units the file marks as returns are really cancellations. Left in, they would push the online return rate from ${pct(rrate(tsum(TXN.day.filter(r => r.c === 'WEB'))), 1)} to about ${pct((tsum(TXN.day.filter(r => r.c === 'WEB')).ru + cTot) / (tsum(TXN.day.filter(r => r.c === 'WEB')).su || 1), 1)}. Out-of-stock cancellations are lost sales: the same stock search the Return agent uses for exchanges could save some of them.</p></section>`;
  el.innerHTML = head + `<div class="dash-grid">${txnImpact(A)}${c1}${c2}<div class="dash-two">${c3}${c4}</div><div class="dash-two">${c5}${c6}</div>${c7}${txnStyles()}${cancHTML}</div>`;
  countUp(el);
}
/** Styles that give back the most margin above what their category normally does. */
function txnStyleFlags(all = false) {
  const cat = {}; for (const r of TXN.cube) { const a = cat[r.k] = cat[r.k] || { su: 0, ru: 0 }; a.su += r.su; a.ru += r.ru; }
  // Fit lean (too big vs too small) comes from the returns extract, matched by style name.
  const oms = {}; if (REAL) { if (REAL.sample) for (const p of REAL.sample.styles) if (p.name) oms[p.name.toUpperCase()] = p; for (const p of REAL.products) oms[p.name.toUpperCase()] = p; }
  return TXN.styles.filter(s => all ? s.su > 0 : s.su >= 800 && s.ru >= 50).map(s => {
    const cr = rrate(cat[s.category] || s), rate = rrate(s), mpu = s.rm / (s.ru || 1), o = oms[s.name.toUpperCase()];
    const big = o ? o.big : 0, small = o ? o.small : 0, sized = big + small, lean = sized ? (big - small) / sized : 0;
    return { ...s, rate, cat_rate: cr, ratio: rate / (cr || 1), excess: Math.max(0, (rate - cr) * s.su), excess_margin: Math.max(0, (rate - cr) * s.su * mpu), big, small, lean, leans: Math.abs(lean) >= 0.4 && sized >= 100, dir: lean > 0 ? 'big' : 'small', oms: !!o };
  }).sort((a, b) => b.excess_margin - a.excess_margin);
}
function txnStyles() {
  const fl = txnStyleFlags().slice(0, 15);
  return vizCard('t:styles', 'Styles giving back the most margin', 'Margin given back above what the category normally returns · whole year', [
    { id: 'bar', render: () => hbars(fl.map(s => ({ label: s.name, value: s.excess_margin, sub: `${pct(s.rate, 1)} returned vs ${pct(s.cat_rate, 1)} · ${s.category}${s.leans ? ` · runs ${s.dir}` : ''}`, tip: `${s.name} · ${s.category}\n${pct(s.rate, 1)} returned (${num(s.ru)} of ${num(s.su)}), category ${pct(s.cat_rate, 1)}\n${whole(s.excess_margin)} margin given back above the category rate${s.oms ? `\nFit returns: ${num(s.big)} too big, ${num(s.small)} too small` : ''}` })), { fmt: whole }) },
    { id: 'scatter', render: () => scatterSVG(fl.map(s => ({ x: s.su, y: s.rate, label: s.name, fill: s.leans ? (s.dir === 'big' ? 'var(--cat-1)' : 'var(--cat-2)') : null, tip: `${s.name}\n${num(s.su)} sold · ${pct(s.rate, 1)} returned` })), { x: { label: 'Units sold', fmt: v => num(v), zero: true }, y: { label: 'Return rate', fmt: v => pct(v), zero: true } }), note: 'Scatter: blue runs big, orange runs small (from the fit reasons in the returns extract).' },
  ], 'Excess = (style rate − category rate) × units sold × margin per returned unit: the money a fix to this one style could keep. These are the Prevention agent\'s first candidates.',
  tableView(['Style', 'Category', 'Units sold', 'Return rate', 'Category rate', 'Excess margin given back', 'Fit lean'], fl.map(s => [s.name, s.category, num(s.su), pct(s.rate, 1), pct(s.cat_rate, 1), whole(s.excess_margin), s.leans ? `runs ${s.dir}` : s.oms ? 'no clear lean' : '—']), [0, 0, 1, 1, 1, 1, 0]));
}
/** The pitch number, from real margin: fit returns kept as exchanges. */
function txnImpact(A) {
  const f = UI.tdash, fit = REAL ? (() => { const g = REAL.rows.reduce((s2, r) => { s2.n += r.n; if (r.g === 'fit') s2.f += r.n; return s2; }, { n: 0, f: 0 }); return g.f / (g.n || 1); })() : 0.4;
  const mpu = A.rm / (A.ru || 1), kept = A.ru * fit * f.conv, margin = kept * mpu;
  return `<section class="card card-pad dash-impact"><div class="eyebrow">Business impact · real margin</div><h3>Fit returns kept as exchanges</h3>
    <div class="seg dseg" role="group" aria-label="Share converted" style="margin:8px 0">${[0.1, 0.2, 0.3].map(t => `<button type="button" data-tconv="${t}" aria-pressed="${Math.abs(f.conv - t) < 1e-9}">${pct(t)} converted</button>`).join('')}</div>
    <div class="imp-grid">
      <div class="imp"><div class="small muted">Units returned (selection)</div><div class="imp-row"><b class="mono">${num(A.ru)}</b></div></div>
      <div class="imp"><div class="small muted">Share returned for fit</div><div class="imp-row"><b class="mono">${pct(fit)}</b><span class="small muted">from the returns extract</span></div></div>
      <div class="imp"><div class="small muted">Returns kept as an exchange</div><div class="imp-row"><b class="mono good">${num(kept)}</b></div></div>
      <div class="imp"><div class="small muted">Margin kept, at ${money(mpu)} a unit</div><div class="imp-row"><b class="mono good">${whole(margin)}</b></div></div>
    </div>
    <p class="small muted" style="margin:8px 0 0">Margin kept = units returned × fit share × share converted × the real margin per returned unit in this selection. An exchange keeps the original sale; the cost of shipping the new pair (about $9) and the returned pair's resale are left out on both sides. Store reason codes aren't explained, so the fit share comes from the 2024–26 returns extract.</p></section>`;
}
const dashSrcSwitch = cur => `<div class="seg dseg dsrc" role="group" aria-label="Data source">${TXN ? `<button type="button" data-dsrc="txn" aria-pressed="${cur === 'txn'}">ALDO sales and margin, 2025</button>` : ''}${REAL ? `<button type="button" data-dsrc="real" aria-pressed="${cur === 'real'}">ALDO returns, Feb 2024 to Jan 2026</button>` : ''}<button type="button" data-dsrc="pilot" aria-pressed="${cur === 'pilot'}">Pilot simulation</button></div>`;
document.addEventListener('click', ev => {
  const t = ev.target.closest('button'); if (!t || !TXN) return;
  if (t.dataset.tgran) { UI.tdash.gran = t.dataset.tgran; return renderDashboard(); }
  if (t.dataset.trange) { UI.tdash.range = t.dataset.trange; UI.tdash.from = UI.tdash.to = null; return renderDashboard(); }
  if (t.dataset.tclear) { UI.tdash.range = 'all'; UI.tdash.from = UI.tdash.to = null; return renderDashboard(); }
  if (t.dataset.tconv) { UI.tdash.conv = +t.dataset.tconv; return renderDashboard(); }
});
document.addEventListener('change', ev => {
  const t = ev.target; if (!t.dataset || !TXN) return;
  if (t.dataset.tfilter) { UI.tdash[t.dataset.tfilter] = t.value; return renderDashboard(); }
  if (t.dataset.tdate && /^\d{4}-\d{2}-\d{2}$/.test(t.value)) {
    const cur = txnRange(), lo = TXN.start, hi = isoOf(TXN.dEnd), cl = d => d < lo ? lo : d > hi ? hi : d;
    UI.tdash.from = isoOf(cur.start); UI.tdash.to = isoOf(cur.end); UI.tdash[t.dataset.tdate] = cl(t.value); UI.tdash.range = 'custom';
    return renderDashboard();
  }
});
