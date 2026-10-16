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

const realMoney = n => Number(n).toLocaleString('en-CA', {minimumFractionDigits:2,maximumFractionDigits:2});
function realFinancialOverview(rows, total) {
  const brands = REAL.banners.map(b => ({b, rows:rows.filter(r=>r.b===b)})).filter(x=>x.rows.length).map(x=>({...x, a:realAgg(x.rows)}));
  return `<section class="card insights-money-overview" aria-labelledby="recorded-money-title"><div class="insights-money-heading"><div><h3 id="recorded-money-title">Recorded amounts by brand</h3><p>All brands, shown separately. Currency is not supplied; no conversion or combined total.</p></div></div>
    ${brands.length ? `<div class="tbl-wrap"><table class="insights-money-table"><thead><tr><th scope="col">Brand / market</th><th scope="col" class="num">Recorded refunds</th><th scope="col" class="num">Restocking fees</th><th scope="col" class="num">Carrier / no-item</th><th scope="col" class="num">Failed refunds</th></tr></thead><tbody>${brands.map(({b,a})=>`<tr data-money-banner="${esc(b)}"><th scope="row">${esc(BANNER_WORD[b]||b)}</th><td class="num" data-label="Recorded refunds"><strong data-amount="refund">${realMoney(a.amt)}</strong><small>${a.n ? realMoney(a.amt/a.n)+' average / item' : 'No returned items'}</small></td><td class="num" data-label="Restocking fees" data-amount="fee">${realMoney(a.fee)}</td><td class="num" data-label="Carrier / no-item" data-amount="claims">${realMoney((a.byGamt.carrier||0)+(a.byGamt.no_merch||0))}</td><td class="num" data-label="Failed refunds" data-amount="failed">${realMoney(a.failamt)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted">No recorded amounts match these filters.</p>'}
    <div class="insights-money-notes"><span><b>${num(total.fn)}</b> orders charged a fee</span><span><b>${num(total.fs)}</b> final-sale returned items</span><span><b>${num(total.unknown_fs)}</b> items with no final-sale flag</span></div><p class="insights-money-definition">Recorded refunds include open and failed records. Carrier / no-item and failed amounts are subsets, not extra amounts to add.</p></section>`;
}

function renderRealDashboard(el) {
  const f = UI.rdash, { start, end, len } = realRange();
  const monetary = f.banner !== 'all';
  const money = realMoney;
  const whole = n => Number(n).toLocaleString('en-CA',{maximumFractionDigits:0});
  const pool = realFilter(REAL.rows);
  const rows = pool.filter(r => r.dn >= start && r.dn <= end), prev = pool.filter(r => r.dn >= start - len && r.dn < start);
  const A = realAgg(rows), P = realAgg(prev), hasPrev = start - len >= REAL.d0;
  // Reason percentages keep an all-reasons denominator in the same brand/channel/date scope.
  const reasonPool = realFilter(REAL.rows, 'group');
  const reasonRows = reasonPool.filter(r => r.dn >= start && r.dn <= end);
  const reasonBase = realAgg(reasonRows), priorReasonBase = realAgg(reasonPool.filter(r => r.dn >= start - len && r.dn < start));
  const shareGroup = f.group === 'all' ? 'fit' : f.group;
  const reasonShare = reasonBase.n ? (A.byG[shareGroup] || 0) / reasonBase.n : null;
  const priorReasonShare = priorReasonBase.n ? (P.byG[shareGroup] || 0) / priorReasonBase.n : null;
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
    ['Recorded refunds', whole(A.amt), monetary ? delta(A.amt, P.amt, true) : '', `${money(A.amt / (A.n || 1))} average per item`],
    [`${GROUP_WORD[shareGroup]} · share of returns`, reasonShare === null ? '—' : pct(reasonShare, 1), reasonShare === null || priorReasonShare === null ? '' : delta(reasonShare, priorReasonShare, true), `${num(A.byG[shareGroup] || 0)} of ${num(reasonBase.n)} returned items across all reasons · same brand, channel and dates`],
    ['In-store returns linked to exchanges', A.insRo ? pct(exRate, 1) : '—', delta(exRate, pExRate), A.insRo ? `${num(A.ex)} of ${num(A.insRo)} in-store return orders, since ${fmtY(REAL.ex_start)}` : `Exchange data starts ${fmtY(REAL.ex_start)}`],
    ['Restocking fees', whole(A.fee), monetary ? delta(A.fee, P.fee) : '', `${num(A.fn)} orders charged · ${pct(A.fn / (A.ro || 1))} of return orders`],
    ['Carrier / no-item refund amounts', whole(claimAmt), monetary ? delta(claimAmt, P.byGamt ? (P.byGamt.no_merch || 0) + (P.byGamt.carrier || 0) : 0, true) : '', `${num(claimN)} items with carrier or no-merchandise reasons`],
    ['Refunds that failed', num(A.fail), delta(A.fail, P.fail, true), monetary ? `${money(A.failamt)} recorded failed amount · ${num(A.op)} records still open` : `${num(A.op)} records still open · amounts below`],
    ['Final-sale return quantity', num(A.fs), delta(A.fs, P.fs, true), `${num(A.unknown_fs)} items have no matching final-sale flag`],
  ];
  const tileKeys = ['returned','refunds','reason','exchanges','fees','claims','failed','final-sale'];
  const shownTiles = monetary ? tiles.map((_,i)=>i) : [0,2,3,6];
  const opt = (v, cur, word) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${esc(v === 'all' ? 'All' : word)}</option>`;
  const head = `<div class="section-head"><div><div class="eyebrow">Returns dashboard · actual ALDO Group data</div><h2>Returns and money</h2><p>Explore return volumes, reasons and recorded amounts. Filters are optional.</p></div></div>
    ${srcSwitch('real')}
    <details class="insights-coverage"><summary>Source coverage & amount definitions</summary><p class="small muted">${num(REAL.totals.items)} returned items across ${REAL.banners.length} banners from ${fmtY(REAL.start)} to ${fmtY(REAL.end)}. Currency is not supplied; amounts are recorded values, including open and failed records. All-brand amounts are shown separately by brand and market, with no currency conversion or combined total.</p>${actualCoverage()}
    ${REAL.orders ? `<p class="small muted">Orders file: ${num(REAL.orders.lines)} lines and ${num(REAL.orders.shipped_qty)} shipped units across the full source period. See Data for daily totals and join coverage.</p>` : ''}</details>
    <div class="dash-controls">
      <div class="seg dseg" role="group" aria-label="Group by">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']].map(([k, l]) => `<button type="button" data-rgran="${k}" aria-pressed="${f.gran === k}">${l}</button>`).join('')}</div>
      <div class="seg dseg" role="group" aria-label="Time range">${RD_RANGES.map(([k, l]) => `<button type="button" data-rrange="${k}" aria-pressed="${f.range === k}">${l}</button>`).join('')}</div>
      <div class="dates" role="group" aria-label="Pick dates"><label class="dsel">From <input type="date" data-rdate="from" min="${REAL.start}" max="${REAL.end}" value="${isoOf(start)}"></label><label class="dsel">To <input type="date" data-rdate="to" min="${REAL.start}" max="${REAL.end}" value="${isoOf(end)}"></label>${f.range === 'custom' ? '<span class="pill info">Custom dates</span><button type="button" class="btn secondary sm" data-rclear="1">Clear dates</button>' : ''}</div>
      <label class="dsel">Brand / market <select data-rfilter="banner">${['all', ...REAL.banners].map(v => opt(v, f.banner, BANNER_WORD[v])).join('')}</select></label>
      <label class="dsel">Channel <select data-rfilter="channel">${['all', ...REAL.channels].map(v => opt(v, f.channel, CHANNEL_WORD[v])).join('')}</select></label>
      <label class="dsel">Reason <select data-rfilter="group">${['all', ...REAL.groups].map(v => opt(v, f.group, GROUP_WORD[v])).join('')}</select></label>
      <button class="btn secondary sm" data-rreset>Reset filters</button><span class="small muted">${fmtY(isoOf(start))} to ${fmtY(isoOf(end))}${hasPrev ? ` · arrows compare with the ${len} days before; green is better for ALDO` : ''}</span>
    </div>
    <div class="dash-tiles">${shownTiles.map(i => { const t=tiles[i]; return `<div class="stat" data-insight-stat="${tileKeys[i]}"><div class="l">${esc(t[0])}</div><div class="v">${esc(t[1])}</div><div class="s">${t[2]} ${esc(t[3])}</div></div>`; }).join('')}</div>${monetary ? '<p class="small muted insights-amount-note">Amounts are recorded values; currency is not supplied. Recorded refunds include open and failed records.</p>' : realFinancialOverview(rows, A)}`;

  const mk = { partial };
  const reasonSeries = GROUP_STACK.map(([k, l, c]) => ({ name: l, color: c, values: by.map(b => b.reduce((s, r) => s + (stackGroup(r.g) === k ? r.n : 0), 0)) })).filter(s => s.values.some(Boolean));
  const chanSeries = REAL.channels.map((c, j) => ({ name: CHANNEL_WORD[c], color: CAT5[j], values: per.map(p => p.byC[c] || 0) })).filter(s => s.values.some(Boolean));
  const banSeries = REAL.banners.map((b, j) => ({ name: BANNER_WORD[b], color: CAT5[j], values: per.map(p => p.byB[b] || 0) })).filter(s => s.values.some(Boolean));
  const tbl = tableView([gw[0].toUpperCase() + gw.slice(1), 'Items', 'Return orders', ...(monetary ? ['Recorded refunds'] : []), 'Fit', 'Exchanged in store', ...(monetary ? ['Restocking fees'] : []), 'Failed refunds'], per.map((p, i) => [labels[i], num(p.n), num(p.ro), ...(monetary ? [money(p.amt)] : []), num(p.byG.fit || 0), num(p.ex), ...(monetary ? [money(p.fee)] : []), num(p.fail)]), [0, 1, 1, 1, 1, 1, 1, 1]);
  const c1 = vizCard('r:count', `Items returned per ${gw}`, 'Coloured by the reason the customer gave', [
    { id: 'stack', render: () => stackSVG(labels, reasonSeries, { ...mk, fmt: num, aria: `Items returned per ${gw}, by reason` }) },
    { id: 'chan', render: () => stackSVG(labels, chanSeries, { ...mk, fmt: num }), note: 'By channel: where the item came back.' },
    { id: 'ban', render: () => stackSVG(labels, banSeries, { ...mk, fmt: num }), note: 'By banner: which brand sold it.' },
    { id: 'line', render: () => lineSVG(labels, [{ name: 'All items', color: 'var(--chart-1)', values: per.map(p => p.n) }, { name: 'Fit', color: 'var(--cat-1)', values: per.map(p => p.byG.fit || 0) }, { name: 'Changed their mind', color: 'var(--cat-2)', values: per.map(p => p.byG.change_of_mind || 0) }], { ...mk, fmt: num, tick: v => num(v) }), note: 'Lines: the selected total, fit and change-of-mind counts.' },
  ], `Each column is one ${gw} within the selected filters. Recorded reasons describe returns; they do not establish a cause.${partNote}`, tbl);
  const c2 = vizCard('r:money', 'Recorded refund amounts · currency unknown', `Per ${gw}`, [
    { id: 'stack', render: () => stackSVG(labels, REAL.banners.map((b, j) => ({ name: BANNER_WORD[b], color: CAT5[j], values: per.map(p => r2(p.byBamt[b] || 0)) })).filter(s => s.values.some(Boolean)), { ...mk, fmt: whole, tick: num }) },
    { id: 'line', render: () => lineSVG(labels, [{ name: 'Refund worth', color: 'var(--cat-2)', values: per.map(p => r2(p.amt)) }, { name: 'Fit refunds', color: 'var(--cat-1)', values: per.map(p => r2(p.byGamt.fit || 0)) }], {...mk,fmt:num,tick:num}), note: 'Lines: all refunds and the part refunded for fit.' },
  ], `Recorded refund amounts, including pending and failed records, split by banner.${partNote}`);
  const gRows = REAL.groups.map(g => ({ label: GROUP_WORD[g], value: A.byG[g] || 0, sub: monetary ? whole(A.byGamt[g] || 0) : '', tip: `${GROUP_WORD[g]}\n${num(A.byG[g] || 0)} items · ${pct((A.byG[g] || 0) / (reasonBase.n || 1), 1)}${monetary ? `\n${money(A.byGamt[g] || 0)} recorded amount` : ''}` })).filter(r => r.value).sort((a, b) => b.value - a.value);
  const c3 = vizCard('r:reason', 'Why customers returned', `The ${f.range === 'custom' ? 'dates' : RD_RANGES.find(x => x[0] === f.range)[1].toLowerCase()} selected`, catForms(gRows, { fmt: num, barFmt: v => `${num(v)} (${pct(v / (reasonBase.n || 1), 1)})`, tick: v => num(v), pie: f.group === 'all', center: num(A.n), centerSub: 'items', heatCol: 'Items' }),
    'The customer\'s own reason, folded into eight groups (Too big, Too small and Uncomfortable are all Fit). Shares use all returned items for the selected brand, channel and dates, before the reason filter.', tableView(['Reason', 'Items', 'Share', ...(monetary ? ['Recorded amount'] : [])], gRows.map(r => [r.label, num(r.value), pct(r.value / (reasonBase.n || 1), 1), ...(monetary ? [r.sub] : [])]), [0, 1, 1, 1]));
  const cRows = REAL.channels.map(c => ({ label: CHANNEL_WORD[c], value: A.byC[c] || 0, sub: monetary ? whole(A.byCamt[c] || 0) : '', tip: `${CHANNEL_WORD[c]}\n${num(A.byC[c] || 0)} items · ${pct((A.byC[c] || 0) / (A.n || 1), 1)}${monetary ? `\n${money(A.byCamt[c] || 0)} recorded amount` : ''}` })).filter(r => r.value).sort((a, b) => b.value - a.value);
  const c4 = vizCard('r:chan', 'Where items came back', 'Items by return channel', catForms(cRows, { fmt: num, barFmt: v => `${num(v)} (${pct(v / (A.n || 1))})`, tick: v => num(v), pie: true, center: num(A.n), centerSub: 'items', heatCol: 'Items' }),
    'Recorded return channels within the current filters. Percentages are shares of the selected returned items.');
  const hb = {}; for (const r of reasonRows) { const k = r.b; hb[k] = hb[k] || { n: 0 }; hb[k].n += r.n; hb[k][r.g] = (hb[k][r.g] || 0) + r.n; }
  const hBan = REAL.banners.filter(b => hb[b]?.n > 0), hGroups = f.group === 'all' ? REAL.groups : [f.group];
  const heatNote = 'Each percentage is reason quantity ÷ all returned items for that same brand, channel and date range. Selecting a reason narrows the columns without changing the denominator. A zero means no items for that reason; no matching records are shown separately. These are shares of returns, not sales-based return rates.';
  const c5 = vizCard('r:heat', 'Reasons by banner', `${f.banner === 'all' ? 'All banners' : BANNER_WORD[f.banner]} · ${f.channel === 'all' ? 'All channels' : CHANNEL_WORD[f.channel]} · ${fmtY(isoOf(start))} to ${fmtY(isoOf(end))}`,
    [{ id: 'heat', render: () => hBan.length ? heatHTML({ max: 1, corner: 'Banner', rows: hBan.map(b => BANNER_WORD[b]), cols: hGroups.map(g => GROUP_WORD[g]), fmt: v => pct(v, 1), cells: hBan.map(b => hGroups.map(g => { const count = hb[b][g] || 0, v = count / hb[b].n; return { v, tip: `${BANNER_WORD[b]} · ${GROUP_WORD[g]}\n${num(count)} of ${num(hb[b].n)} returned items across all reasons\n${pct(v, 1)}` }; })) }) : `<div class="insights-empty" ${rows.length ? '' : 'id="insights-no-matches"'} role="status"><h3>${rows.length ? 'No returned items in this scope' : 'No records match these filters'}</h3><p>Choose another brand, channel or date range. No percentages can be calculated without returned items.</p><button class="btn secondary sm" data-rreset>Reset filters</button></div>` }], hBan.length ? heatNote : '',
    hBan.length ? tableView(['Banner', 'All-reason items', ...hGroups.map(g => GROUP_WORD[g])], hBan.map(b => [BANNER_WORD[b], num(hb[b].n), ...hGroups.map(g => pct((hb[b][g] || 0) / hb[b].n, 1))]), [0, 1, ...hGroups.map(()=>1)]) : '');
  const exIx = keys.map((k, i) => i).filter(i => nextPeriod(keys[i], gw) > REAL.exStart);
  const exLab = exIx.map(i => labels[i]), exPart = exIx.map(i => partial[i] || (keys[i] < REAL.exStart ? 'exchange data starts mid-period' : ''));
  const c6 = vizCard('r:exch', 'In-store returns linked to an exchange', `Per ${gw}, from ${fmtY(REAL.ex_start)} when exchange data starts`, exIx.length ? [
    { id: 'line', render: () => lineSVG(exLab, [{ name: 'All in-store returns', color: 'var(--cat-3)', values: exIx.map(i => r2(per[i].insRo ? per[i].ex / per[i].insRo * 100 : 0)) }, { name: 'Fit returns', color: 'var(--cat-1)', values: exIx.map(i => { const fr = by[i].filter(r => r.g === 'fit' && r.c === 'InStore' && r.dn >= REAL.exStart); const ro = fr.reduce((s2, r) => s2 + r.ro, 0); return r2(ro ? fr.reduce((s2, r) => s2 + r.ex, 0) / ro * 100 : 0); }) }], { partial: exPart, w: chartW(), fmt: v => v.toFixed(1) + '%', tick: v => v + '%' }) },
    { id: 'group', render: () => groupSVG(exLab, [{ name: 'In-store return orders', color: 'var(--chart-2)', values: exIx.map(i => per[i].insRo) }, { name: 'With an exchange', color: 'var(--cat-3)', values: exIx.map(i => per[i].ex) }], { partial: exPart, w: chartW(), fmt: num, tick: v => num(v) }), note: 'Side by side: in-store return orders and the ones that also had an exchange rung up.' },
  ] : [{ id: 'line', render: () => '<p class="small muted">The exchange file starts in February 2025; pick dates after that.</p>' }], `Return transactions are linked by original order number, as specified in the notes. This is an association, not a one-to-one return or item match. The source contains CONFIRMED and ASSUMED exchange records; these are separated in Data. Returns before exchange coverage starts are excluded from this rate.`);
  const c7 = vizCard('r:fees', 'Recorded restocking fees · currency unknown', `Per ${gw}`, [
    { id: 'line', render: () => lineSVG(labels, [{ name: 'Restocking fees', color: 'var(--cat-5)', values: per.map(p => r2(p.fee)) }], { ...mk, w: chartW(), fmt:num, tick:num }) },
    { id: 'stack', render: () => stackSVG(labels, REAL.channels.map((c, j) => ({ name: CHANNEL_WORD[c], color: CAT5[j], values: by.map(b => r2(b.filter(r => r.c === c).reduce((s, r) => s + r.fee, 0))) })).filter(s => s.values.some(Boolean)), { ...mk, w: chartW(), fmt: money, tick: num }), note: 'Recorded fees by return channel within the selected filters.' },
  ], `Fees are recorded at transaction level and attributed once in these aggregates. Currency and the reason for missing fees are not supplied.${partNote}`);
  const noMatches = !rows.length && hBan.length ? '<section class="insights-empty card card-pad" id="insights-no-matches" role="status"><h3>No records match these filters</h3><p>Try another combination, or reset the filters.</p><button class="btn secondary sm" data-rreset>Reset filters</button></section>' : '';
  el.innerHTML = head + c5 + noMatches + (rows.length ? `<div class="dash-grid">${c1}${monetary?c2:''}<div class="dash-two">${c3}${c4}</div><div class="dash-two">${c6}${monetary?c7:""}</div>${realOpportunity(rows)}<details class="card disclosure insights-context"><summary>Full-period context <span>Product rankings and customer history have separate coverage</span></summary><div class="card-pad">${realProducts()}${realCustomers()}</div></details></div>` : '');
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
  return vizCard('r:prod', 'Styles with the most fit returns', 'Selected banner · full source period; date, channel and reason filters do not apply', [
    { id: 'skew', render: skew },
    { id: 'scatter', render: () => scatterSVG(ps.map(p => ({ x: p.small / p.n, y: p.big / p.n, fill: p.big > 2 * p.small ? 'var(--cat-1)' : p.small > 2 * p.big ? 'var(--cat-2)' : null, tip: `${p.name}\nToo small ${pct(p.small / p.n, 1)} · Too big ${pct(p.big / p.n, 1)}\n${num(p.fit)} fit returns` })), { x: { label: 'Returned as too small', fmt: v => pct(v), zero: true }, y: { label: 'Returned as too big', fmt: v => pct(v), zero: true } }), note: 'Scatter: top left has more too-big reports (blue), bottom right more too-small reports (orange).' },
  ], 'A dominant reason is a hypothesis to investigate with product measurements and reviews. It does not establish a sizing defect or justify changing fit guidance on its own. These are shares of returns, not population return rates: the supplied orders file matches only part of the returns extract. Daily shipped quantities and join coverage are available in Data.',
  tableView(['Style', 'Banner', 'Items returned', 'Fit returns', 'Too small', 'Too big', 'Recorded amount'], ps.map(p => [p.name, BANNER_WORD[p.banner], num(p.n), num(p.fit), pct(p.small / p.n, 1), pct(p.big / p.n, 1), num(p.refund)]), [0, 0, 1, 1, 1, 1, 1]));
}
/** How returns spread across customers: whole period, all banners. */
function realCustomers() {
  const C = REAL.customers;
  const rows = C.dist.map(d => ({ label: `${d.label} item${d.label === '1' ? '' : 's'}`, value: d.customers, tip: `${d.label} returned item${d.label === '1' ? '' : 's'}\n${num(d.customers)} customers · ${num(d.items)} items` }));
  return vizCard('r:cust', 'How many items each customer returned', `${num(C.known)} customers · all banners, channels and reasons · full source period; dashboard filters do not apply`, catForms(rows, { fmt: num, tick: v => num(v), heatCol: 'Customers' }).filter(x => x.id !== 'pie'),
    `Counts describe the supplied history only. ${num(C.claim3_n)} customer identifiers have at least three carrier or no-item claims; counts alone do not establish abuse. ${num(C.items_unknown)} items have no customer identifier. The operational Approvals examples use synthetic profiles.`);
}
/** What turning online fit returns into exchanges is worth, from the selected range. */
function realOpportunity(rows) {
  const f = UI.rdash;
  const totals = rs => {
    const fit = rs.filter(r=>r.g==='fit'), fitN=fit.reduce((s,r)=>s+r.n,0), fitAmt=fit.reduce((s,r)=>s+r.amt,0);
    const onN=fit.filter(r=>r.c!=='InStore').reduce((s,r)=>s+r.n,0), storeRows=fit.filter(r=>r.c==='InStore'&&r.dn>=REAL.exStart);
    return {fitN,avg:fitN?fitAmt/fitN:null,onN,insRo:storeRows.reduce((s,r)=>s+r.ro,0),insEx:storeRows.reduce((s,r)=>s+r.ex,0)};
  };
  const all=totals(rows),store=all.insRo?all.insEx/all.insRo:0;
  const targets=[[0.1,'10%'],[0.2,'20%'],...(all.insRo?[[Math.round(store*100)/100,`Match stores (${pct(store)})`]]:[])];
  if(!targets.some(t=>Math.abs(t[0]-f.target)<1e-9))f.target=0.2;
  const brands=REAL.banners.filter(b=>rows.some(r=>r.b===b)).map(b=>({b,...totals(rows.filter(r=>r.b===b))}));
  return `<details class="card disclosure dash-impact" data-rscenario ${f.scenarioOpen?'open':''}><summary>Explore an exchange scenario <span>Optional what-if estimate · not measured savings</span></summary><div class="card-pad">
    <h3>Online fit returns turned into exchanges</h3><p class="small">${all.insRo?`In store, ${pct(store)} of fit-return transactions in the covered period link to an exchange record.`:'No in-store comparison is available for these filters.'} Choose an assumed conversion share:</p>
    <div class="seg dseg" role="group" aria-label="Exchange target">${targets.map(([t,l])=>`<button type="button" data-rtarget="${t}" aria-pressed="${Math.abs(f.target-t)<1e-9}">${esc(l)}</button>`).join('')}</div>
    <div class="tbl-wrap"><table class="insights-money-table"><thead><tr><th scope="col">Brand / market</th><th scope="col" class="num">Fit returns outside stores</th><th scope="col" class="num">Assumed conversions</th><th scope="col" class="num">Average fit refund</th><th scope="col" class="num">Illustrative amount retained</th></tr></thead><tbody>${brands.map(x=>`<tr><th scope="row">${esc(BANNER_WORD[x.b]||x.b)}</th><td class="num">${num(x.onN)}</td><td class="num">${num(x.onN*f.target)}</td><td class="num">${x.avg===null?'—':realMoney(x.avg)}</td><td class="num">${x.avg===null?'—':realMoney(x.onN*f.target*x.avg)}</td></tr>`).join('')}</tbody></table></div>
    <p class="small muted">For each brand: fit returns outside stores × assumed conversion share × that brand's average fit refund. Currency is not supplied. Amounts are kept separate; no cross-brand total is calculated. Counts are rounded for display.</p>
    <p class="small muted">This estimates gross value retained, not profit or verified savings. Replacement cost, reverse logistics, recovery, cannibalization and customer acceptance are missing. Follows the filters and dates above.</p></div></details>`;
}

/* The policy assistant can answer questions about the real data too (totals only). */
if (REAL && typeof APPR_TOOLS !== 'undefined') APPR_TOOLS.push({
  name: 'real_returns_stats',
  description: `Totals from the real ALDO Group returns extract (${REAL.start} to ${REAL.end}) between two dates (YYYY-MM-DD, inclusive), optionally for one banner (${REAL.banners.join(', ')}), channel (${REAL.channels.join(', ')}) or reason group (${REAL.groups.join(', ')}): items, return orders, refund worth, reasons, channels, in-store exchange rate, restocking fees, failed refunds. Aggregates only.`,
  inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, banner: { type: 'string' }, channel: { type: 'string' }, reason: { type: 'string' } }, required: ['from', 'to'] },
  execute: ({ from, to, banner, channel, reason }) => {
    const a = dayNum(from), b = dayNum(to); if (!(a <= b)) throw new Error('Dates must be YYYY-MM-DD with from before to.');
    const rows = REAL.rows.filter(r => r.dn >= a && r.dn <= b && (!banner || r.b === banner) && (!channel || r.c === channel) && (!reason || r.g === reason));
    const A = realAgg(rows);
    const amountsByBanner = REAL.banners.filter(b=>rows.some(r=>r.b===b)).map(b=>{const t=realAgg(rows.filter(r=>r.b===b));return {banner:b,recorded_refunds:r2(t.amt),restocking_fees:r2(t.fee),failed_refund_amount:r2(t.failamt)};});
    const share = o => Object.fromEntries(Object.entries(o).sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, `${num(v)} (${pct(v / (A.n || 1), 1)})`]));
    return { range: `${from} to ${to}`, items: A.n, return_orders: A.ro, refund_worth: banner ? A.amt : null, currency: 'Not supplied', limitation: 'Amounts are recorded values, not settled payments or savings. Monetary amounts are separated by banner without currency conversion.', amounts_by_banner:amountsByBanner, by_reason: share(A.byG), by_channel: share(A.byC), by_banner: share(A.byB),
      in_store_exchange_rate: A.insRo ? pct(A.ex / A.insRo, 1) : `no exchange data before ${REAL.ex_start}`, restocking_fees: banner ? A.fee : null, failed_refunds: A.fail, final_sale_items_refunded: A.fs };
  },
});

document.addEventListener('click',ev=>{if(ev.target.closest('[data-rreset]')){Object.assign(UI.rdash,{banner:'all',channel:'all',group:'all',range:'all',from:null,to:null});renderDashboard();}});

document.addEventListener('toggle',ev=>{if(ev.target.matches?.('[data-rscenario]')&&ev.target.isConnected)UI.rdash.scenarioOpen=ev.target.open;},true);
