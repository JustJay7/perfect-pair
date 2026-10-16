/* ---------- Dashboard on the real ALDO returns extract ----------
   DATA.real holds aggregates only (gen_real.py): one row per day × banner ×
   channel × reason group, plus product reason shares and how returns spread
   across customers. No order, customer or return ids are in the page. */
const REAL = (() => {
  const R = DATA.real; if (!R) return null;
  const c = R.cube, d0 = dayNum(R.start), rows = new Array(c.n.length);
  let day = 0;
  for (let i = 0; i < rows.length; i++) {
    day += c.day[i];
    rows[i] = { dn: d0 + day, b: R.banners[c.b[i]], c: R.channels[c.c[i]], g: R.groups[c.g[i]], n: c.n[i], amt: c.cents[i] / 100, ro: c.ro[i], ex: c.ex[i], fee: c.fee[i] / 100, fn: c.fn[i], fail: c.fail[i], failamt: c.failc[i] / 100, fs: c.fs[i], op: c.op[i], unknown_fs: c.unknown_fs?.[i] || 0, exc: c.exc?.[i] || 0, exa: c.exa?.[i] || 0 };
  }
  return Object.assign({}, R, { rows, d0, dEnd: dayNum(R.end), exStart: dayNum(R.ex_start) });
})();
const BANNER_WORD = { ALDO_US: 'ALDO US', ALDO_CA: 'ALDO Canada', SPERRY_US: 'Sperry US', SPERRY_CA: 'Sperry Canada', CIS_CA: 'Call It Spring Canada', GLOBO_CA: 'Globo Canada', GHBASS_US: 'G.H. Bass US' };
const CHANNEL_WORD = { InStore: 'In store', Web: 'Online', CCC: 'Contact centre', HappyReturnMail: 'Happy Returns by mail', HappyReturnBar: 'Happy Returns drop-off' };
const GROUP_WORD = { fit: 'Fit', change_of_mind: 'Changed their mind', carrier: 'Carrier: lost, late, damaged', expectations: 'Not as expected', no_merch: 'Refund without the item', fulfilment: 'Wrong item sent', quality: 'Quality problem', other: 'Other' };
// Seven colours at most: wrong-item and other share the neutral grey.
const GROUP_STACK = [['fit', 'Fit', 'var(--cat-1)'], ['change_of_mind', 'Changed their mind', 'var(--cat-2)'], ['carrier', 'Carrier', 'var(--cat-3)'], ['expectations', 'Not as expected', 'var(--cat-4)'],
  ['quality', 'Quality', 'var(--cat-5)'], ['no_merch', 'Without the item', 'var(--cat-6)'], ['rest', 'Wrong item and other', 'var(--chart-2)']];
const stackGroup = g => (g === 'fulfilment' || g === 'other') ? 'rest' : g;
const CAT5 = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)', 'var(--cat-5)'];
const RD_RANGES = [['30d', '30 days', 30], ['90d', '90 days', 90], ['6m', '6 months', 183], ['12m', '12 months', 365], ['all', 'All dates', null]];
UI.rdash = UI.rdash || { gran: 'month', range: 'all', banner: 'all', channel: 'all', group: 'all', target: 0.25 };
const isoOf = dn => new Date(dn * 864e5).toISOString().slice(0, 10);
const num = v => Math.round(v).toLocaleString('en-CA');
const fmtY = iso => new Date(dayNum(iso) * 864e5).toLocaleDateString('en-CA', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });

function realRange() {
  const f = UI.rdash;
  if (f.range === 'custom' && f.from && f.to) { const a = dayNum(f.from), b = dayNum(f.to); return { start: Math.min(a, b), end: Math.max(a, b), len: Math.abs(b - a) + 1 }; }
  const R = RD_RANGES.find(x => x[0] === f.range) || RD_RANGES[4];
  const end = REAL.dEnd, start = R[2] ? end - R[2] + 1 : REAL.d0;
  return { start, end, len: end - start + 1 };
}
function realFilter(rows, skip) {
  const f = UI.rdash;
  return rows.filter(r => (skip === 'banner' || f.banner === 'all' || r.b === f.banner) && (skip === 'channel' || f.channel === 'all' || r.c === f.channel) && (skip === 'group' || f.group === 'all' || r.g === f.group));
}
function realAgg(rows) {
  const a = { n: 0, amt: 0, ro: 0, ex: 0, fee: 0, fn: 0, fail: 0, failamt: 0, fs: 0, op: 0, unknown_fs: 0, exc: 0, exa: 0, insRo: 0, byG: {}, byGamt: {}, byC: {}, byCamt: {}, byB: {}, byBamt: {}, byS: {} };
  for (const r of rows) {
    a.n += r.n; a.amt += r.amt; a.ro += r.ro; a.ex += r.ex; a.fee += r.fee; a.fn += r.fn; a.fail += r.fail; a.failamt += r.failamt; a.fs += r.fs; a.op += r.op; a.unknown_fs += r.unknown_fs || 0; a.exc += r.exc || 0; a.exa += r.exa || 0;
    // In-store exchanges are only recorded from Feb 2025, so only returns from then on count toward the rate.
    if (r.c === 'InStore' && r.dn >= REAL.exStart) a.insRo += r.ro;
    a.byG[r.g] = (a.byG[r.g] || 0) + r.n; a.byGamt[r.g] = (a.byGamt[r.g] || 0) + r.amt;
    a.byC[r.c] = (a.byC[r.c] || 0) + r.n; a.byCamt[r.c] = (a.byCamt[r.c] || 0) + r.amt;
    a.byB[r.b] = (a.byB[r.b] || 0) + r.n; a.byBamt[r.b] = (a.byBamt[r.b] || 0) + r.amt;
    const s = stackGroup(r.g); a.byS[s] = (a.byS[s] || 0) + r.n;
  }
  return a;
}
const srcSwitch = cur => `<div class="seg dseg dsrc" role="group" aria-label="Dashboard data source"><button type="button" data-dsrc="pilot" aria-pressed="${cur === 'pilot'}">Synthetic</button><button type="button" data-dsrc="real" aria-pressed="${cur === 'real'}">Actual</button></div>`;

function renderRealDashboard(el) {
  const f = UI.rdash, { start, end, len } = realRange();
  const monetary = f.banner !== 'all';
  const money = n => monetary ? Number(n).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2}) : 'Select a banner';
  const whole = n => monetary ? Number(n).toLocaleString('en-CA',{maximumFractionDigits:0}) : 'Select a banner';
  const pool = realFilter(REAL.rows);
  const rows = pool.filter(r => r.dn >= start && r.dn <= end), prev = pool.filter(r => r.dn >= start - len && r.dn < start);
  const A = realAgg(rows), P = realAgg(prev), hasPrev = start - len >= REAL.d0;
  const keys = []; for (let k = periodKey(start, f.gran); k <= end; k = nextPeriod(k, f.gran)) keys.push(k);
  const idx = new Map(keys.map((k, i) => [k, i])), labels = keys.map(k => periodLabel(k, f.gran));
  const partial = keys.map(k => { const full = nextPeriod(k, f.gran) - k, inside = Math.min(nextPeriod(k, f.gran), end + 1) - Math.max(k, start); return inside < full ? `${inside} of ${full} days in range` : ''; });
  const by = keys.map(() => []); for (const r of rows) { const i = idx.get(periodKey(r.dn, f.gran)); if (i != null) by[i].push(r); }
  const per = by.map(realAgg);
  const gw = f.gran, partNote = partial.some(Boolean) ? ` Faded ${gwPlural(gw)} at the edges are only partly inside the dates you picked.` : '';
  const delta = (cur, old, lowerIsGood) => { if (!hasPrev || !old) return ''; const d = (cur - old) / Math.abs(old), good = lowerIsGood ? d <= 0 : d >= 0; return `<span class="dl ${good ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${pct(Math.abs(d))}</span>`; };
  const claimN = (A.byG.no_merch || 0) + (A.byG.carrier || 0), claimAmt = (A.byGamt.no_merch || 0) + (A.byGamt.carrier || 0);
  const exRate = A.insRo ? A.ex / A.insRo : 0, pExRate = P.insRo ? P.ex / P.insRo : 0;
  const tiles = [
    ['Items returned', num(A.n), delta(A.n, P.n, true), `${num(A.ro)} return orders · ${num(A.n / Math.max(1, len))} a day`],
    ['Refund worth', whole(A.amt), monetary ? delta(A.amt, P.amt, true) : '', `${money(A.amt / (A.n || 1))} average per item`],
    ['Returned for fit', pct((A.byG.fit || 0) / (A.n || 1)), delta((A.byG.fit || 0) / (A.n || 1), (P.byG.fit || 0) / (P.n || 1), true), `${num(A.byG.fit || 0)} items · ${whole(A.byGamt.fit || 0)} refunded`],
    ['In-store returns linked to exchanges', A.insRo ? pct(exRate, 1) : '—', delta(exRate, pExRate), A.insRo ? `${num(A.ex)} of ${num(A.insRo)} in-store return orders, since ${fmtY(REAL.ex_start)}` : `Exchange data starts ${fmtY(REAL.ex_start)}`],
    ['Restocking fees', whole(A.fee), monetary ? delta(A.fee, P.fee) : '', `${num(A.fn)} orders charged · ${pct(A.fn / (A.ro || 1))} of return orders`],
    ['Carrier / no-item refund amounts', whole(claimAmt), monetary ? delta(claimAmt, P.byGamt ? (P.byGamt.no_merch || 0) + (P.byGamt.carrier || 0) : 0, true) : '', `${num(claimN)} items with carrier or no-merchandise reasons`],
    ['Refunds that failed', num(A.fail), delta(A.fail, P.fail, true), `${whole(A.failamt)} stuck · still open: ${num(A.op)}`],
    ['Final-sale return quantity', num(A.fs), delta(A.fs, P.fs, true), `${num(A.unknown_fs)} items have no matching final-sale flag`],
  ];
  const opt = (v, cur, word) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${esc(v === 'all' ? 'All' : word)}</option>`;
  const head = `<div class="section-head"><div><div class="eyebrow">Returns dashboard · actual ALDO Group data</div><h2>Returns and money</h2><p>Every returned item in the extract from ${fmtY(REAL.start)} to ${fmtY(REAL.end)}: ${num(REAL.totals.items)} items, across ${REAL.banners.length} banners and ${REAL.channels.length} return channels. Source currency is not supplied; select one banner to view its recorded amounts without a currency symbol. Cross-banner monetary totals are suppressed. Amounts include open and failed records and are not necessarily settled refunds. Only totals are in this page; no customer, order or return numbers.</p></div></div>
    ${srcSwitch('real')}
    ${actualCoverage()}
    ${REAL.orders ? `<p class="small muted">Orders file: ${num(REAL.orders.lines)} lines and ${num(REAL.orders.shipped_qty)} shipped units across the full source period. See Data for daily totals and join coverage.</p>` : ''}
    <div class="dash-controls">
      <div class="seg dseg" role="group" aria-label="Group by">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']].map(([k, l]) => `<button type="button" data-rgran="${k}" aria-pressed="${f.gran === k}">${l}</button>`).join('')}</div>
      <div class="seg dseg" role="group" aria-label="Time range">${RD_RANGES.map(([k, l]) => `<button type="button" data-rrange="${k}" aria-pressed="${f.range === k}">${l}</button>`).join('')}</div>
      <div class="dates" role="group" aria-label="Pick dates"><label class="dsel">From <input type="date" data-rdate="from" min="${REAL.start}" max="${REAL.end}" value="${isoOf(start)}"></label><label class="dsel">To <input type="date" data-rdate="to" min="${REAL.start}" max="${REAL.end}" value="${isoOf(end)}"></label>${f.range === 'custom' ? '<span class="pill info">Custom dates</span><button type="button" class="btn secondary sm" data-rclear="1">Clear dates</button>' : ''}</div>
      <label class="dsel">Banner <select data-rfilter="banner">${['all', ...REAL.banners].map(v => opt(v, f.banner, BANNER_WORD[v])).join('')}</select></label>
      <label class="dsel">Channel <select data-rfilter="channel">${['all', ...REAL.channels].map(v => opt(v, f.channel, CHANNEL_WORD[v])).join('')}</select></label>
      <label class="dsel">Reason <select data-rfilter="group">${['all', ...REAL.groups].map(v => opt(v, f.group, GROUP_WORD[v])).join('')}</select></label>
      <span class="small muted">${fmtY(isoOf(start))} to ${fmtY(isoOf(end))}${hasPrev ? ` · arrows compare with the ${len} days before; green is better for ALDO` : ''}</span>
    </div>
    <div class="dash-tiles">${tiles.map(t => `<div class="stat"><div class="l">${esc(t[0])}</div><div class="v">${esc(t[1])}</div><div class="s">${t[2]} ${esc(t[3])}</div></div>`).join('')}</div>`;

  const mk = { partial };
  const reasonSeries = GROUP_STACK.map(([k, l, c]) => ({ name: l, color: c, values: by.map(b => b.reduce((s, r) => s + (stackGroup(r.g) === k ? r.n : 0), 0)) })).filter(s => s.values.some(Boolean));
  const chanSeries = REAL.channels.map((c, j) => ({ name: CHANNEL_WORD[c], color: CAT5[j], values: per.map(p => p.byC[c] || 0) })).filter(s => s.values.some(Boolean));
  const banSeries = REAL.banners.map((b, j) => ({ name: BANNER_WORD[b], color: CAT5[j], values: per.map(p => p.byB[b] || 0) })).filter(s => s.values.some(Boolean));
  const tbl = tableView([gw[0].toUpperCase() + gw.slice(1), 'Items', 'Return orders', 'Refund worth', 'Fit', 'Exchanged in store', 'Restocking fees', 'Failed refunds'], per.map((p, i) => [labels[i], num(p.n), num(p.ro), money(p.amt), num(p.byG.fit || 0), num(p.ex), money(p.fee), num(p.fail)]), [0, 1, 1, 1, 1, 1, 1, 1]);
  const c1 = vizCard('r:count', `Items returned per ${gw}`, 'Coloured by the reason the customer gave', [
    { id: 'stack', render: () => stackSVG(labels, reasonSeries, { ...mk, fmt: num, aria: `Items returned per ${gw}, by reason` }) },
    { id: 'chan', render: () => stackSVG(labels, chanSeries, { ...mk, fmt: num }), note: 'By channel: where the item came back.' },
    { id: 'ban', render: () => stackSVG(labels, banSeries, { ...mk, fmt: num }), note: 'By banner: which brand sold it.' },
    { id: 'line', render: () => lineSVG(labels, [{ name: 'All items', color: 'var(--chart-1)', values: per.map(p => p.n) }, { name: 'Fit', color: 'var(--cat-1)', values: per.map(p => p.byG.fit || 0) }, { name: 'Changed their mind', color: 'var(--cat-2)', values: per.map(p => p.byG.change_of_mind || 0) }], { ...mk, fmt: num, tick: v => num(v) }), note: 'Lines: the total and the two reasons that make up three quarters of it.' },
  ], `Each column is one ${gw}. Fit and change of mind are about three quarters of everything; the December peak is holiday buying coming back in January.${partNote}`, tbl);
  const c2 = vizCard('r:money', 'Recorded refund amounts · currency unknown', `Per ${gw}`, [
    { id: 'stack', render: () => stackSVG(labels, REAL.banners.map((b, j) => ({ name: BANNER_WORD[b], color: CAT5[j], values: per.map(p => r2(p.byBamt[b] || 0)) })).filter(s => s.values.some(Boolean)), { ...mk, fmt: whole, tick: compactMoney }) },
    { id: 'line', render: () => lineSVG(labels, [{ name: 'Refund worth', color: 'var(--cat-2)', values: per.map(p => r2(p.amt)) }, { name: 'Fit refunds', color: 'var(--cat-1)', values: per.map(p => r2(p.byGamt.fit || 0)) }], {...mk,fmt:num,tick:num}), note: 'Lines: all refunds and the part refunded for fit.' },
  ], `Recorded refund amounts, including pending and failed records, split by banner.${partNote}`);
  const gRows = REAL.groups.map(g => ({ label: GROUP_WORD[g], value: A.byG[g] || 0, sub: whole(A.byGamt[g] || 0), tip: `${GROUP_WORD[g]}\n${num(A.byG[g] || 0)} items · ${pct((A.byG[g] || 0) / (A.n || 1), 1)}\n${whole(A.byGamt[g] || 0)} refunded` })).filter(r => r.value).sort((a, b) => b.value - a.value);
  const c3 = vizCard('r:reason', 'Why customers returned', `The ${f.range === 'custom' ? 'dates' : RD_RANGES.find(x => x[0] === f.range)[1].toLowerCase()} selected`, catForms(gRows, { fmt: num, barFmt: v => `${num(v)} (${pct(v / (A.n || 1))})`, tick: v => num(v), pie: true, center: num(A.n), centerSub: 'items', heatCol: 'Items' }),
    'The customer\'s own reason, folded into eight groups (Too big, Too small and Uncomfortable are all Fit). Fit is the one Perfect Pair turns into an exchange.', tableView(['Reason', 'Items', 'Share', 'Recorded amount'], gRows.map(r => [r.label, num(r.value), pct(r.value / (A.n || 1), 1), r.sub]), [0, 1, 1, 1]));
  const cRows = REAL.channels.map(c => ({ label: CHANNEL_WORD[c], value: A.byC[c] || 0, sub: whole(A.byCamt[c] || 0), tip: `${CHANNEL_WORD[c]}\n${num(A.byC[c] || 0)} items · ${pct((A.byC[c] || 0) / (A.n || 1), 1)}\n${whole(A.byCamt[c] || 0)} refunded` })).filter(r => r.value).sort((a, b) => b.value - a.value);
  const c4 = vizCard('r:chan', 'Where items came back', 'Items by return channel', catForms(cRows, { fmt: num, barFmt: v => `${num(v)} (${pct(v / (A.n || 1))})`, tick: v => num(v), pie: true, center: num(A.n), centerSub: 'items', heatCol: 'Items' }),
    'Half of all returns come back over a store counter, which is where an exchange is easiest to offer and where the quality check happens.');
  // Banner × reason, as a share of each banner's returns: ignores the banner and reason filters.
  const hPool = realFilter(REAL.rows, 'banner').filter(r => r.dn >= start && r.dn <= end );
  const hb = {}; for (const r of hPool) { const k = r.b; hb[k] = hb[k] || { n: 0 }; hb[k].n += r.n; hb[k][r.g] = (hb[k][r.g] || 0) + r.n; }
  const hBan = REAL.banners.filter(b => hb[b]);
  const c5 = vizCard('r:heat', 'Reasons by banner', 'Share of each banner\'s returned items', [{ id: 'heat', render: () => heatHTML({ corner: 'Banner', rows: hBan.map(b => BANNER_WORD[b]), cols: REAL.groups.map(g => GROUP_WORD[g]), fmt: v => pct(v), cells: hBan.map(b => REAL.groups.map(g => { const v = (hb[b][g] || 0) / hb[b].n; return { v: v || null, tip: `${BANNER_WORD[b]} · ${GROUP_WORD[g]}\n${pct(v, 1)} of the banner's returns\n${num(hb[b][g] || 0)} items` }; })) }) }],
    'Read across a row: each banner\'s returns split by reason. Sperry US stands out on fit; the contact-centre-heavy banners carry most of the refunds without the item.', tableView(['Banner', ...REAL.groups.map(g => GROUP_WORD[g])], hBan.map(b => [BANNER_WORD[b], ...REAL.groups.map(g => pct((hb[b][g] || 0) / hb[b].n, 1))]), [0, 1, 1, 1, 1, 1, 1, 1, 1]));
  const exIx = keys.map((k, i) => i).filter(i => nextPeriod(keys[i], gw) > REAL.exStart);
  const exLab = exIx.map(i => labels[i]), exPart = exIx.map(i => partial[i] || (keys[i] < REAL.exStart ? 'exchange data starts mid-period' : ''));
  const c6 = vizCard('r:exch', 'In-store returns linked to an exchange', `Per ${gw}, from ${fmtY(REAL.ex_start)} when exchange data starts`, exIx.length ? [
    { id: 'line', render: () => lineSVG(exLab, [{ name: 'All in-store returns', color: 'var(--cat-3)', values: exIx.map(i => r2(per[i].insRo ? per[i].ex / per[i].insRo * 100 : 0)) }, { name: 'Fit returns', color: 'var(--cat-1)', values: exIx.map(i => { const fr = by[i].filter(r => r.g === 'fit' && r.c === 'InStore' && r.dn >= REAL.exStart); const ro = fr.reduce((s2, r) => s2 + r.ro, 0); return r2(ro ? fr.reduce((s2, r) => s2 + r.ex, 0) / ro * 100 : 0); }) }], { partial: exPart, w: chartW(), fmt: v => v.toFixed(1) + '%', tick: v => v + '%' }) },
    { id: 'group', render: () => groupSVG(exLab, [{ name: 'In-store return orders', color: 'var(--chart-2)', values: exIx.map(i => per[i].insRo) }, { name: 'With an exchange', color: 'var(--cat-3)', values: exIx.map(i => per[i].ex) }], { partial: exPart, w: chartW(), fmt: num, tick: v => num(v) }), note: 'Side by side: in-store return orders and the ones that also had an exchange rung up.' },
  ] : [{ id: 'line', render: () => '<p class="small muted">The exchange file starts in February 2025; pick dates after that.</p>' }], `Return transactions are linked by original order number, as specified in the notes. This is an association, not a one-to-one return or item match. The source contains CONFIRMED and ASSUMED exchange records; these are separated in Data. Returns before exchange coverage starts are excluded from this rate.`);
  const c7 = vizCard('r:fees', 'Recorded restocking fees · currency unknown', `Per ${gw}`, [
    { id: 'line', render: () => lineSVG(labels, [{ name: 'Restocking fees', color: 'var(--cat-5)', values: per.map(p => r2(p.fee)) }], { ...mk, w: chartW(), fmt:num, tick:num }) },
    { id: 'stack', render: () => stackSVG(labels, REAL.channels.map((c, j) => ({ name: CHANNEL_WORD[c], color: CAT5[j], values: by.map(b => r2(b.filter(r => r.c === c).reduce((s, r) => s + r.fee, 0))) })).filter(s => s.values.some(Boolean)), { ...mk, w: chartW(), fmt: money, tick: compactMoney }), note: 'By channel: never charged on an in-store return.' },
  ], `The fee started in May 2024 at $4.95 and rose to $5.95 in May 2025. It is never charged in store, which is one more reason to steer a customer to a store and an exchange. The extract has no fees for October 2025, likely a gap in the file.${partNote}`);
  el.innerHTML = head.replace('<div class="dash-tiles">', c5 + '<div class="dash-tiles">') + `<div class="dash-grid">${c1}${monetary?c2:'<section class="card card-pad"><h3>Recorded amounts</h3><p>Select one brand / market to view money. The files do not identify currency or exchange rates, so cross-market totals are not shown.</p></section>'}<div class="dash-two">${c3}${c4}</div><div class="dash-two">${c6}${monetary?c7:""}</div>${realProducts()}<div class="dash-two">${realCustomers()}${realOpportunity(rows)}</div></div>`;
  countUp(el);
}

/** Styles with the most fit returns, and which way the fit is off: the Prevention agent's starting list. */
function realProducts() {
  const f = UI.rdash;
  const ps = REAL.products.filter(p => f.banner === 'all' || p.banner === f.banner).sort((a, b) => b.fit - a.fit).slice(0, 12);
  if (!ps.length) return '';
  const max = Math.max(...ps.map(p => Math.max(p.big, p.small) / p.n));
  const skew = () => `<div class="skew"><div class="skew-head small muted"><span>Style</span><span class="l">Too small</span><span class="r">Too big</span><span>Fit returns</span></div>${ps.map((p, i) => {
    const s = p.small / p.n, b = p.big / p.n, lean = b > 2 * s ? 'big' : s > 2 * b ? 'small' : '';
    return `<div class="skew-row" style="--i:${i}" data-tip="${esc(`${p.name} · ${BANNER_WORD[p.banner]}\n${num(p.n)} items returned · ${num(p.refund)} recorded amount (currency unknown)\nToo small ${pct(s, 1)} · Too big ${pct(b, 1)} · Uncomfortable ${pct(p.unc / p.n, 1)}`)}" tabindex="0"><span class="skew-name"><b>${esc(p.name)}</b><span class="small muted">${esc(BANNER_WORD[p.banner])}</span></span>
      <span class="skew-bar l"><i style="width:${(s / max * 100).toFixed(1)}%"></i><em>${pct(s)}</em></span><span class="skew-bar r"><i style="width:${(b / max * 100).toFixed(1)}%"></i><em>${pct(b)}</em></span>
      <span class="skew-n mono">${num(p.fit)}${lean ? ` <span class="pill ${lean === 'big' ? 'info' : 'warn'}">More reported ${lean}</span>` : ''}</span></div>`; }).join('')}</div>`;
  return vizCard('r:prod', 'Styles with the most fit returns', 'Whole period · share of each style\'s returns', [
    { id: 'skew', render: skew },
    { id: 'scatter', render: () => scatterSVG(ps.map(p => ({ x: p.small / p.n, y: p.big / p.n, fill: p.big > 2 * p.small ? 'var(--cat-1)' : p.small > 2 * p.big ? 'var(--cat-2)' : null, tip: `${p.name}\nToo small ${pct(p.small / p.n, 1)} · Too big ${pct(p.big / p.n, 1)}\n${num(p.fit)} fit returns` })), { x: { label: 'Returned as too small', fmt: v => pct(v), zero: true }, y: { label: 'Returned as too big', fmt: v => pct(v), zero: true } }), note: 'Scatter: top left has more too-big reports (blue), bottom right more too-small reports (orange).' },
  ], 'A dominant reason is a hypothesis to investigate with product measurements and reviews. It does not establish a sizing defect or justify changing fit guidance on its own. These are shares of returns, not population return rates: the supplied orders file matches only part of the returns extract. Daily shipped quantities and join coverage are available in Data.',
  tableView(['Style', 'Banner', 'Items returned', 'Fit returns', 'Too small', 'Too big', 'Recorded amount'], ps.map(p => [p.name, BANNER_WORD[p.banner], num(p.n), num(p.fit), pct(p.small / p.n, 1), pct(p.big / p.n, 1), num(p.refund)]), [0, 0, 1, 1, 1, 1, 1]));
}
/** How returns spread across customers: whole period, all banners. */
function realCustomers() {
  const C = REAL.customers;
  const rows = C.dist.map(d => ({ label: `${d.label} item${d.label === '1' ? '' : 's'}`, value: d.customers, tip: `${d.label} returned item${d.label === '1' ? '' : 's'}\n${num(d.customers)} customers · ${num(d.items)} items` }));
  return vizCard('r:cust', 'How many items each customer returned', `${num(C.known)} customers with a profile · whole period`, catForms(rows, { fmt: num, tick: v => num(v), heatCol: 'Customers' }).filter(x => x.id !== 'pie'),
    `Counts describe the supplied history only. ${num(C.claim3_n)} customer identifiers have at least three carrier or no-item claims; counts alone do not establish abuse. ${num(C.items_unknown)} items have no customer identifier. The operational Approvals examples use synthetic profiles.`);
}
/** What turning online fit returns into exchanges is worth, from the selected range. */
function realOpportunity(rows) {
  const f = UI.rdash;
  const amount = n => f.banner==='all'?'Select a banner':Number(n).toLocaleString('en-CA',{maximumFractionDigits:2})+' (currency unknown)';
  let fitN = 0, fitAmt = 0, onN = 0, insRo = 0, insEx = 0;
  for (const r of rows) {
    if (r.g !== 'fit') continue;
    fitN += r.n; fitAmt += r.amt;
    if (r.c === 'InStore') { if (r.dn >= REAL.exStart) { insRo += r.ro; insEx += r.ex; } } else onN += r.n;
  }
  const avg = fitAmt / (fitN || 1), store = insRo ? insEx / insRo : 0;
  const targets = [[0.1, '10%'], [0.2, '20%'], [Math.round(store * 100) / 100, `Match stores (${pct(store)})`]];
  if (!targets.some(t => Math.abs(t[0] - f.target) < 1e-9)) f.target = 0.2;
  const extra = f.target * onN, kept = extra * avg;
  return `<section class="card card-pad dash-impact"><div class="eyebrow">Hypothetical conversion scenario · not measured savings</div><h3>Online fit returns turned into exchanges</h3>
    <p class="small" style="margin:0 0 6px">In store, ${pct(store)} of eligible-window fit-return transactions link to an exchange record (confirmed or assumed). The exchange file does not establish online coverage. Choose an assumed conversion share for a what-if calculation:</p>
    <div class="seg dseg" role="group" aria-label="Exchange target" style="margin:8px 0">${targets.map(([t, l]) => `<button type="button" data-rtarget="${t}" aria-pressed="${Math.abs(f.target - t) < 1e-9}">${esc(l)}</button>`).join('')}</div>
    <div class="imp-grid">
      <div class="imp"><div class="small muted">Fit returns not made in store</div><div class="imp-row"><b class="mono">${num(onN)}</b></div></div>
      <div class="imp"><div class="small muted">Assumed converted quantity</div><div class="imp-row"><b class="mono good">${num(extra)}</b></div></div>
      <div class="imp"><div class="small muted">Illustrative amount retained</div><div class="imp-row"><b class="mono good">${amount(kept)}</b></div></div>
      <div class="imp"><div class="small muted">Average fit refund</div><div class="imp-row"><b class="mono">${amount(avg)}</b></div></div>
    </div>
    <p class="small muted" style="margin:8px 0 0">Kept = fit returns outside stores × the share converted; dollars = that × the average fit refund. This is an illustrative gross amount, not profit or verified savings. Replacement cost, reverse logistics, recovery, cannibalization and customer acceptance are missing. Follows every filter and date above.</p></section>`;
}

/* The policy assistant can answer questions about the real data too (totals only). */
if (REAL && typeof APPR_TOOLS !== 'undefined') APPR_TOOLS.push({
  name: 'real_returns_stats',
  description: `Totals from the real ALDO Group returns extract (${REAL.start} to ${REAL.end}) between two dates (YYYY-MM-DD, inclusive), optionally for one banner (${REAL.banners.join(', ')}), channel (${REAL.channels.join(', ')}) or reason group (${REAL.groups.join(', ')}): items, return orders, refund worth, reasons, channels, in-store exchange rate, restocking fees, failed refunds. Aggregates only.`,
  inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, banner: { type: 'string' }, channel: { type: 'string' }, reason: { type: 'string' } }, required: ['from', 'to'] },
  execute: ({ from, to, banner, channel, reason }) => {
    const a = dayNum(from), b = dayNum(to); if (!(a <= b)) throw new Error('Dates must be YYYY-MM-DD with from before to.');
    const A = realAgg(REAL.rows.filter(r => r.dn >= a && r.dn <= b && (!banner || r.b === banner) && (!channel || r.c === channel) && (!reason || r.g === reason)));
    const share = o => Object.fromEntries(Object.entries(o).sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, `${num(v)} (${pct(v / (A.n || 1), 1)})`]));
    return { range: `${from} to ${to}`, items: A.n, return_orders: A.ro, refund_worth: banner ? A.amt : null, currency: 'Not supplied', limitation: 'Amounts are recorded values, not settled payments or savings. Cross-banner monetary totals are suppressed.', by_reason: share(A.byG), by_channel: share(A.byC), by_banner: share(A.byB),
      in_store_exchange_rate: A.insRo ? pct(A.ex / A.insRo, 1) : `no exchange data before ${REAL.ex_start}`, restocking_fees: banner ? A.fee : null, failed_refunds: A.fail, final_sale_items_refunded: A.fs };
  },
});
