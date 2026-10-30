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
    rows[i] = { dn: d0 + day, b: R.banners[c.b[i]], c: R.channels[c.c[i]], g: R.groups[c.g[i]], n: c.n[i], amt: c.cents[i] / 100, ro: c.ro[i], ex: c.ex[i], fee: c.fee[i] / 100, fn: c.fn[i], fail: c.fail[i], failamt: c.failc[i] / 100, fs: c.fs[i], op: c.op[i] };
  }
  return Object.assign({}, R, { rows, d0, dEnd: dayNum(R.end), exStart: dayNum(R.ex_start) });
})();
const BANNER_WORD = { ALDO_US: 'ALDO US', ALDO_CA: 'ALDO Canada', SPERRY_US: 'Sperry US', SPERRY_CA: 'Sperry Canada', CIS_CA: 'Call It Spring Canada' };
const CHANNEL_WORD = { InStore: 'In store', Web: 'Online', CCC: 'Contact centre', HappyReturnMail: 'Happy Returns by mail', HappyReturnBar: 'Happy Returns drop-off' };
const GROUP_WORD = { fit: 'Fit', change_of_mind: 'Changed their mind', carrier: 'Carrier: lost, late, damaged', expectations: 'Not as expected', no_merch: 'Refund without the item', fulfilment: 'Wrong item sent', quality: 'Quality problem', other: 'Other' };
// Seven colours at most: wrong-item and other share the neutral grey.
const GROUP_STACK = [['fit', 'Fit', 'var(--cat-1)'], ['change_of_mind', 'Changed their mind', 'var(--cat-2)'], ['carrier', 'Carrier', 'var(--cat-3)'], ['expectations', 'Not as expected', 'var(--cat-4)'],
  ['quality', 'Quality', 'var(--cat-5)'], ['no_merch', 'Without the item', 'var(--cat-6)'], ['rest', 'Wrong item and other', 'var(--chart-2)']];
const stackGroup = g => (g === 'fulfilment' || g === 'other') ? 'rest' : g;
const CAT5 = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)', 'var(--cat-5)'];
const RD_RANGES = [['30d', '30 days', 30], ['90d', '90 days', 90], ['6m', '6 months', 183], ['12m', '12 months', 365], ['all', 'All 24 months', null]];
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
  const a = { n: 0, amt: 0, ro: 0, ex: 0, fee: 0, fn: 0, fail: 0, failamt: 0, fs: 0, op: 0, insRo: 0, byG: {}, byGamt: {}, byC: {}, byCamt: {}, byB: {}, byBamt: {}, byS: {} };
  for (const r of rows) {
    a.n += r.n; a.amt += r.amt; a.ro += r.ro; a.ex += r.ex; a.fee += r.fee; a.fn += r.fn; a.fail += r.fail; a.failamt += r.failamt; a.fs += r.fs; a.op += r.op;
    // In-store exchanges are only recorded from Feb 2025, so only returns from then on count toward the rate.
    if (r.c === 'InStore' && r.dn >= REAL.exStart) a.insRo += r.ro;
    a.byG[r.g] = (a.byG[r.g] || 0) + r.n; a.byGamt[r.g] = (a.byGamt[r.g] || 0) + r.amt;
    a.byC[r.c] = (a.byC[r.c] || 0) + r.n; a.byCamt[r.c] = (a.byCamt[r.c] || 0) + r.amt;
    a.byB[r.b] = (a.byB[r.b] || 0) + r.n; a.byBamt[r.b] = (a.byBamt[r.b] || 0) + r.amt;
    const s = stackGroup(r.g); a.byS[s] = (a.byS[s] || 0) + r.n;
  }
  return a;
}
const srcSwitch = cur => `<div class="seg dseg dsrc" role="group" aria-label="Data source"><button type="button" data-dsrc="real" aria-pressed="${cur === 'real'}">ALDO returns, Feb 2024 to Jan 2026</button><button type="button" data-dsrc="pilot" aria-pressed="${cur === 'pilot'}">Pilot simulation</button></div>`;

function renderRealDashboard(el) {
  const f = UI.rdash, { start, end, len } = realRange();
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
    ['Refund worth', whole(A.amt), delta(A.amt, P.amt, true), `${money(A.amt / (A.n || 1))} average per item`],
    ['Returned for fit', pct((A.byG.fit || 0) / (A.n || 1)), delta((A.byG.fit || 0) / (A.n || 1), (P.byG.fit || 0) / (P.n || 1), true), `${num(A.byG.fit || 0)} items · ${whole(A.byGamt.fit || 0)} refunded`],
    ['In-store returns exchanged', A.insRo ? pct(exRate, 1) : '—', delta(exRate, pExRate), A.insRo ? `${num(A.ex)} of ${num(A.insRo)} in-store return orders, since ${fmtY(REAL.ex_start)}` : `Exchange data starts ${fmtY(REAL.ex_start)}`],
    ['Restocking fees', whole(A.fee), delta(A.fee, P.fee), `${num(A.fn)} orders charged · ${pct(A.fn / (A.ro || 1))} of return orders`],
    ['Refunded without the item', whole(claimAmt), delta(claimAmt, P.byGamt ? (P.byGamt.no_merch || 0) + (P.byGamt.carrier || 0) : 0, true), `${num(claimN)} items: lost, late or never sent back`],
    ['Refunds that failed', num(A.fail), delta(A.fail, P.fail, true), `${whole(A.failamt)} stuck · still open: ${num(A.op)}`],
    ['Final-sale items refunded', num(A.fs), delta(A.fs, P.fs, true), 'Marked final sale at checkout (§2.3)'],
  ];
  const opt = (v, cur, word) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${esc(v === 'all' ? 'All' : word)}</option>`;
  const head = `<div class="section-head"><div><div class="eyebrow">Returns dashboard · real ALDO Group data</div><h2>Returns and money</h2><p>Every returned item in the extract from ${fmtY(REAL.start)} to ${fmtY(REAL.end)}: ${num(REAL.totals.items)} items, ${whole(REAL.totals.refund)} refunded, across five banners and five return channels. Only totals are in this page; no customer, order or return numbers.</p></div></div>
    ${dashSrcSwitch('real')}
    <div class="dash-controls">
      ${dateSel('rgran', 'Group by', [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']], f.gran)}
      ${dateSel('rrange', 'Period', RD_RANGES, f.range)}
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
  const c2 = vizCard('r:money', 'Refunds paid, in dollars', `Per ${gw}`, [
    { id: 'stack', render: () => stackSVG(labels, REAL.banners.map((b, j) => ({ name: BANNER_WORD[b], color: CAT5[j], values: per.map(p => r2(p.byBamt[b] || 0)) })).filter(s => s.values.some(Boolean)), { ...mk, fmt: whole, tick: compactMoney }) },
    { id: 'line', render: () => lineSVG(labels, [{ name: 'Refund worth', color: 'var(--cat-2)', values: per.map(p => r2(p.amt)) }, { name: 'Fit refunds', color: 'var(--cat-1)', values: per.map(p => r2(p.byGamt.fit || 0)) }], mk), note: 'Lines: all refunds and the part refunded for fit.' },
  ], `Money sent back to customers, split by the banner that sold the item.${partNote}`);
  const gRows = REAL.groups.map(g => ({ label: GROUP_WORD[g], value: A.byG[g] || 0, sub: whole(A.byGamt[g] || 0), tip: `${GROUP_WORD[g]}\n${num(A.byG[g] || 0)} items · ${pct((A.byG[g] || 0) / (A.n || 1), 1)}\n${whole(A.byGamt[g] || 0)} refunded` })).filter(r => r.value).sort((a, b) => b.value - a.value);
  const c3 = vizCard('r:reason', 'Why customers returned', `The ${f.range === 'custom' ? 'dates' : RD_RANGES.find(x => x[0] === f.range)[1].toLowerCase()} selected`, catForms(gRows, { fmt: num, barFmt: v => `${num(v)} (${pct(v / (A.n || 1))})`, tick: v => num(v), pie: true, center: num(A.n), centerSub: 'items', heatCol: 'Items' }),
    'The customer\'s own reason, folded into eight groups (Too big, Too small and Uncomfortable are all Fit). Fit is the one Perfect Pair turns into an exchange.', tableView(['Reason', 'Items', 'Share', 'Refunded'], gRows.map(r => [r.label, num(r.value), pct(r.value / (A.n || 1), 1), r.sub]), [0, 1, 1, 1]));
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
  const c6 = vizCard('r:exch', 'In-store returns that became an exchange', `Per ${gw}, from ${fmtY(REAL.ex_start)} when exchange data starts`, exIx.length ? [
    { id: 'line', render: () => lineSVG(exLab, [{ name: 'All in-store returns', color: 'var(--cat-3)', values: exIx.map(i => r2(per[i].insRo ? per[i].ex / per[i].insRo * 100 : 0)) }, { name: 'Fit returns', color: 'var(--cat-1)', values: exIx.map(i => { const fr = by[i].filter(r => r.g === 'fit' && r.c === 'InStore' && r.dn >= REAL.exStart); const ro = fr.reduce((s2, r) => s2 + r.ro, 0); return r2(ro ? fr.reduce((s2, r) => s2 + r.ex, 0) / ro * 100 : 0); }) }], { partial: exPart, w: chartW(), fmt: v => v.toFixed(1) + '%', tick: v => v + '%' }) },
    { id: 'group', render: () => groupSVG(exLab, [{ name: 'In-store return orders', color: 'var(--chart-2)', values: exIx.map(i => per[i].insRo) }, { name: 'With an exchange', color: 'var(--cat-3)', values: exIx.map(i => per[i].ex) }], { partial: exPart, w: chartW(), fmt: num, tick: v => num(v) }), note: 'Side by side: in-store return orders and the ones that also had an exchange rung up.' },
  ] : [{ id: 'line', render: () => '<p class="small muted">The exchange file starts in February 2025; pick dates after that.</p>' }], `A return order counts as exchanged when the store rang up an exchange against the same original order (the join in the data notes). About one in four in-store returns already ends as an exchange, more for fit. Online returns have no exchange recorded at all: that is the gap Perfect Pair goes after.`);
  const c7 = vizCard('r:fees', 'Restocking fees collected', `Per ${gw}`, [
    { id: 'line', render: () => lineSVG(labels, [{ name: 'Restocking fees', color: 'var(--cat-5)', values: per.map(p => r2(p.fee)) }], { ...mk, w: chartW() }) },
    { id: 'stack', render: () => stackSVG(labels, REAL.channels.map((c, j) => ({ name: CHANNEL_WORD[c], color: CAT5[j], values: by.map(b => r2(b.filter(r => r.c === c).reduce((s, r) => s + r.fee, 0))) })).filter(s => s.values.some(Boolean)), { ...mk, w: chartW(), fmt: money, tick: compactMoney }), note: 'By channel: never charged on an in-store return.' },
  ], `The fee started in May 2024 at $4.95 and rose to $5.95 in May 2025. It is never charged in store, which is one more reason to steer a customer to a store and an exchange. The extract has no fees for October 2025, likely a gap in the file.${partNote}`);
  el.innerHTML = head + `<div class="dash-grid">${c5}${realOpportunity(rows)}${c1}${c2}<div class="dash-two">${c3}${c4}</div><div class="dash-two">${c6}${c7}</div>${realRates()}${realProducts()}${realDrill()}<div class="dash-two">${realCustomers()}${realBracketing()}</div></div>`;
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
    return `<div class="skew-row" style="--i:${i}" data-tip="${esc(`${p.name} · ${BANNER_WORD[p.banner]}\n${num(p.n)} items returned · ${whole(p.refund)} refunded\nToo small ${pct(s, 1)} · Too big ${pct(b, 1)} · Uncomfortable ${pct(p.unc / p.n, 1)}`)}" tabindex="0"><span class="skew-name"><b>${esc(p.name)}</b><span class="small muted">${esc(BANNER_WORD[p.banner])}</span></span>
      <span class="skew-bar l"><i style="width:${(s / max * 100).toFixed(1)}%"></i><em>${pct(s)}</em></span><span class="skew-bar r"><i style="width:${(b / max * 100).toFixed(1)}%"></i><em>${pct(b)}</em></span>
      <span class="skew-n mono">${num(p.fit)}${lean ? ` <span class="pill ${lean === 'big' ? 'info' : 'warn'}">Runs ${lean}</span>` : ''}</span></div>`; }).join('')}</div>`;
  return vizCard('r:prod', 'Styles with the most fit returns', 'Whole period · share of each style\'s returns', [
    { id: 'skew', render: skew },
    { id: 'scatter', render: () => scatterSVG(ps.map(p => ({ x: p.small / p.n, y: p.big / p.n, fill: p.big > 2 * p.small ? 'var(--cat-1)' : p.small > 2 * p.big ? 'var(--cat-2)' : null, tip: `${p.name}\nToo small ${pct(p.small / p.n, 1)} · Too big ${pct(p.big / p.n, 1)}\n${num(p.fit)} fit returns` })), { x: { label: 'Returned as too small', fmt: v => pct(v), zero: true }, y: { label: 'Returned as too big', fmt: v => pct(v), zero: true } }), note: 'Scatter: top left runs big (blue), bottom right runs small (orange).' },
  ], 'When one direction dominates, the style is mis-sized, not the customer: the product page should say "size down" or "size up", and the Return agent should offer the exchange in that direction. Without the sales file these are shares of returns, not return rates.',
  tableView(['Style', 'Banner', 'Items returned', 'Fit returns', 'Too small', 'Too big', 'Refunded'], ps.map(p => [p.name, BANNER_WORD[p.banner], num(p.n), num(p.fit), pct(p.small / p.n, 1), pct(p.big / p.n, 1), whole(p.refund)]), [0, 0, 1, 1, 1, 1, 1]));
}
/** How returns spread across customers: whole period, all banners. */
function realCustomers() {
  const C = REAL.customers;
  const rows = C.dist.map(d => ({ label: `${d.label} item${d.label === '1' ? '' : 's'}`, value: d.customers, tip: `${d.label} returned item${d.label === '1' ? '' : 's'}\n${num(d.customers)} customers · ${num(d.items)} items\n${whole(d.refund)} refunded` }));
  return vizCard('r:cust', 'How many items each customer returned', `${num(C.known)} customers with a profile · whole period`, catForms(rows, { fmt: num, tick: v => num(v), heatCol: 'Customers' }).filter(x => x.id !== 'pie'),
    `Most customers return once. The top 1% (${num(C.top1_n)} customers) account for ${pct(C.top1_share, 1)} of refund dollars, and ${num(C.claim3_n)} customers made three or more lost-parcel or no-item claims, worth ${whole(C.claim3_refund)}: the pattern the Approvals tab shows a manager before they decide. ${num(C.items_unknown)} items had no customer profile (guest checkout).`);
}
/** What turning online fit returns into exchanges is worth, from the selected range. */
function realOpportunity(rows) {
  const f = UI.rdash;
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
  return `<section class="card card-pad dash-impact"><div class="eyebrow">Business impact · from the data above</div><h3>Online fit returns turned into exchanges</h3>
    <p class="small" style="margin:0 0 6px">In store, ${pct(store)} of fit returns already end as an exchange. Online, by mail and through the contact centre, none are recorded. Pick how many of those Perfect Pair converts:</p>
    <div class="seg dseg" role="group" aria-label="Exchange target" style="margin:8px 0">${targets.map(([t, l]) => `<button type="button" data-rtarget="${t}" aria-pressed="${Math.abs(f.target - t) < 1e-9}">${esc(l)}</button>`).join('')}</div>
    <div class="imp-grid">
      <div class="imp"><div class="small muted">Fit returns not made in store</div><div class="imp-row"><b class="mono">${num(onN)}</b></div></div>
      <div class="imp"><div class="small muted">Kept as an exchange instead</div><div class="imp-row"><b class="mono good">${num(extra)}</b></div></div>
      <div class="imp"><div class="small muted">Refunds not paid out</div><div class="imp-row"><b class="mono good">${whole(kept)}</b></div></div>
      <div class="imp"><div class="small muted">Average fit refund</div><div class="imp-row"><b class="mono">${money(avg)}</b></div></div>
    </div>
    <p class="small muted" style="margin:8px 0 0">Kept = fit returns outside stores × the share converted; dollars = that × the average fit refund. It counts sales kept, not margin: item costs are in the Product Master, which isn't in this extract. Follows every filter and date above.</p></section>`;
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
    return { range: `${from} to ${to}`, items: A.n, return_orders: A.ro, refund_worth: whole(A.amt), by_reason: share(A.byG), by_channel: share(A.byC), by_banner: share(A.byB),
      in_store_exchange_rate: A.insRo ? pct(A.ex / A.insRo, 1) : `no exchange data before ${REAL.ex_start}`, restocking_fees: whole(A.fee), failed_refunds: A.fail, final_sale_items_refunded: A.fs };
  },
});

/* ---------- Return rates, from the orders sample ----------
   The returns file alone gives counts, not rates. The orders file is a sample of
   about a million online order lines; matching its lines to their returns gives a
   fair estimate of how often each category, size and style comes back. */
const rateOf = x => x.shipped ? x.returned / x.shipped : 0;
function realRates() {
  const S = REAL.sample; if (!S) return '';
  const f = UI.rdash, all = rateOf(S);
  const cats = S.categories.map(c => ({ label: c.name, value: r2(rateOf(c) * 100) / 100, sub: `${num(c.shipped)} shipped`, tip: `${c.name}\n${pct(rateOf(c), 1)} returned · ${num(c.returned)} of ${num(c.shipped)} units\nFit: ${num(c.fit)} (too big ${num(c.big)}, too small ${num(c.small)})` }));
  const sizes = S.sizes.filter(z => z.shipped >= 2000);
  const bans = Object.entries(S.banners).filter(([, v]) => v.returned).map(([k, v]) => ({ label: BANNER_WORD[k] || k, value: rateOf(v), sub: `${num(v.shipped)} shipped`, tip: `${BANNER_WORD[k] || k}\n${pct(rateOf(v), 1)} returned · ${num(v.returned)} of ${num(v.shipped)}` }));
  const p100 = (n, z) => r2(n / (z.shipped || 1) * 100);
  return vizCard('r:rate', 'How often items come back', `Estimated from the orders sample: ${num(S.lines)} order lines, ${pct(all, 1)} of units returned · whole period, all filters off`, [
    { id: 'bar', render: () => hbars(cats, { fmt: v => pct(v, 1) }) },
    { id: 'size', render: () => groupSVG(sizes.map(z => z.size), [{ name: 'Returned as too small', color: 'var(--cat-2)', values: sizes.map(z => p100(z.small, z)) }, { name: 'Returned as too big', color: 'var(--cat-1)', values: sizes.map(z => p100(z.big, z)) }, { name: 'Every other reason', color: 'var(--chart-2)', values: sizes.map(z => p100(z.returned - z.small - z.big, z)) }], { fmt: v => v.toFixed(1) + ' per 100', tick: v => v + '' }), note: 'By size: returns per 100 pairs shipped. Fit returns are only about a third; at the ends of the run they lean one way: sizes 5 and 5.5 come back as too small more than too big, sizes 10 and 11 as too big. That is where a fit note or a size suggestion helps most.' },
    { id: 'ban', render: () => hbars(bans, { fmt: v => pct(v, 1) }), note: 'By banner: share of units shipped that came back.' },
  ], `A rate is returned units divided by shipped units, for the order lines in the sample. The sample covers about 30% of the orders that had a return, so counts are smaller than the Dashboard above but the rates are fair. Globo and G.H. Bass are left out: the returns file has none of their returns.`,
  tableView(['Category', 'Shipped', 'Returned', 'Rate', 'Too big', 'Too small'], S.categories.map(c => [c.name, num(c.shipped), num(c.returned), pct(rateOf(c), 1), num(c.big), num(c.small)]), [0, 1, 1, 1, 1, 1]));
}
/** One product's history: monthly returns, reasons, channels and, when the sample has it, its return rate. */
function realDrill() {
  const f = UI.rdash, list = REAL.products.filter(p => f.banner === 'all' || p.banner === f.banner).slice().sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) return '';
  if (!f.prod || !list.some(p => p.name === f.prod)) f.prod = list.slice().sort((a, b) => b.n - a.n)[0].name;
  const p = REAL.products.find(x => x.name === f.prod), S = REAL.sample;
  const st = S ? S.styles.filter(x => x.name === p.name) : [];
  const shp = st.reduce((s2, x) => s2 + x.shipped, 0), ret = st.reduce((s2, x) => s2 + x.returned, 0);
  const labels = REAL.months.map(m => new Date(dayNum(m + '-01') * 864e5).toLocaleDateString('en-CA', { month: 'short', year: '2-digit', timeZone: 'UTC' }));
  const rs = Object.entries(p.reasons).map(([k, v]) => ({ label: k, value: v, tip: `${k}\n${num(v)} items · ${pct(v / p.n, 1)}` }));
  const ch = Object.entries(p.channels).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: CHANNEL_WORD[k] || k, value: v, tip: `${CHANNEL_WORD[k] || k}\n${num(v)} items · ${pct(v / p.n, 1)}` }));
  const lean = p.big > 2 * p.small ? 'runs big: suggest a half size down' : p.small > 2 * p.big ? 'runs small: suggest a half size up' : 'no clear size lean';
  const head = `<div class="drill-pick"><label class="dsel">Product <select data-rfilter="prod">${list.map(x => `<option value="${esc(x.name)}" ${x.name === p.name ? 'selected' : ''}>${esc(x.name)} · ${num(x.n)} returned</option>`).join('')}</select></label>
    <div class="drill-facts small"><span><b>${esc(BANNER_WORD[p.banner] || p.banner)}</b></span><span><b>${num(p.n)}</b> items returned</span><span><b>${whole(p.refund)}</b> refunded</span><span>Fit <b>${pct(p.fit / p.n)}</b> (too big ${pct(p.big / p.n)}, too small ${pct(p.small / p.n)}): ${esc(lean)}</span>${shp ? `<span>Return rate <b>${pct(ret / shp, 1)}</b> in the sample (${num(ret)} of ${num(shp)})</span>` : '<span class="muted">Not in the orders sample, so no return rate</span>'}</div></div>`;
  return vizCard('r:drill', 'Look up a product', 'The 60 styles returned most · whole period', [
    { id: 'line', render: () => head + lineSVG(labels, [{ name: 'Items returned', color: 'var(--cat-1)', values: p.monthly }], { fmt: num, tick: v => num(v) }) },
    { id: 'bar', render: () => head + hbars(rs, { fmt: v => `${num(v)} (${pct(v / p.n)})` }), note: 'Reasons: the exact words customers picked.' },
    { id: 'chan', render: () => head + hbars(ch, { fmt: v => `${num(v)} (${pct(v / p.n)})` }), note: 'Channels: where this product came back.' },
  ], 'Pick any of the most-returned styles to see its own history. The Prevention agent starts from the same numbers when it drafts a fit note.');
}
/** Bracketing on the real data: one order returning the same style in two or more variants. */
function realBracketing() {
  const B = REAL.bracketing; if (!B) return '';
  return `<section class="card card-pad dash-impact"><div class="eyebrow">Bracketing · real data</div><h3>Ordering several sizes and sending the extras back</h3>
    <div class="imp-grid">
      <div class="imp"><div class="small muted">Orders that returned the same style in 2+ variants</div><div class="imp-row"><b class="mono">${num(B.orders)}</b></div></div>
      <div class="imp"><div class="small muted">Items returned on those orders</div><div class="imp-row"><b class="mono">${num(B.items)}</b></div></div>
      <div class="imp"><div class="small muted">Refunded on those orders</div><div class="imp-row"><b class="mono">${whole(B.refund)}</b></div></div>
      <div class="imp"><div class="small muted">Customers who did it more than once</div><div class="imp-row"><b class="mono">${num(B.repeat_customers)}</b> of ${num(B.customers)}</div></div>
    </div>
    <p class="small muted" style="margin:8px 0 0">${pct(B.fit_share)} of these returns give a fit reason: customers bracket because they aren't sure of their size. A variant is a different SKU of the same style (usually a size, sometimes a colour). The agent flags repeat bracketers for fit help (the ⇄ tag on Approvals); it never refuses a return for it.</p></section>`;
}

/* ---------- Prevention on real ALDO styles ----------
   The same F1 test as the demo agent, on the orders sample: a style is flagged
   when its return rate is at least 1.5× its category's, or when its fit returns
   lean clearly one way (too big or too small). The draft note waits for a
   merchandiser (R10). Nothing is published from here. */
STATE.realNotes = STATE.realNotes || {};
function realStyleFlags(includeAll = false) {
  if (typeof TXN !== 'undefined' && TXN) {
    return txnStyleFlags(includeAll).map(s => {
      const high = s.ratio >= 1.5 && s.ru >= 300;
      const note = s.leans ? (s.dir === 'big' ? 'Runs large. Most customers should order a half size down.' : 'Runs small. Most customers should order a half size up.') : 'Comes back far more than similar styles: review the photos and description against the reasons customers give.';
      return { ...s, shipped: s.su, returned: s.ru, banner: s.ca >= s.us ? 'ALDO_CA' : 'ALDO_US', high, note, status: high && s.leans ? 'flagged' : s.leans ? 'lean' : high ? 'high' : 'ok' };
    }).filter(s => includeAll || s.high || (s.leans && s.ratio >= 1.15));
  }
  const S = REAL && REAL.sample; if (!S) return [];
  const cat = Object.fromEntries(S.categories.map(c => [c.name, rateOf(c)])), all = rateOf(S);
  const out = [];
  for (const x of S.styles) {
    if (x.shipped < 1000 || !x.name) continue;
    const rate = rateOf(x), cr = cat[x.category] ?? all, ratio = rate / (cr || 1), sized = x.big + x.small, lean = sized ? (x.big - x.small) / sized : 0;
    const high = ratio >= 1.5 && x.returned >= 300, leans = Math.abs(lean) >= 0.4 && sized >= 150;
    if (!high && !leans) continue;
    const dir = lean > 0 ? 'big' : 'small';
    const note = leans ? (dir === 'big' ? 'Runs large. Most customers should order a half size down.' : 'Runs small. Most customers should order a half size up.') : 'Comes back far more than similar styles: review the photos and description against the reasons customers give.';
    out.push({ ...x, rate, cat_rate: cr, ratio, lean, dir, high, leans, excess: Math.max(0, (rate - cr) * x.shipped), note,
      status: high && leans ? 'flagged' : leans ? 'lean' : 'high' });
  }
  return out.sort((a, b) => (b.high && b.leans) - (a.high && a.leans) || b.excess - a.excess);
}
function realDiagnosisScripted(s) {
  const p = REAL.products.find(x => x.name === s.name);
  const bits = [`${s.name} comes back ${pct(s.rate, 1)} of the time, ${s.ratio.toFixed(1)}× the ${s.category} average of ${pct(s.cat_rate, 1)}.`];
  if (s.leans) bits.push(`Among fit returns, ${num(s.dir === 'big' ? s.big : s.small)} say too ${s.dir} and only ${num(s.dir === 'big' ? s.small : s.big)} too ${s.dir === 'big' ? 'small' : 'big'}: the size runs ${s.dir === 'big' ? 'large' : 'small'}, so a size note should cut those returns.`);
  else bits.push('Fit returns don\'t lean one way, so sizing advice alone won\'t fix it; the reasons point elsewhere.');
  if (p) { const top = Object.entries(p.reasons).slice(0, 3).map(([k, v]) => `${k} ${pct(v / p.n)}`).join(', '); bits.push(`Top reasons across all ${num(p.n)} returns: ${top}.`); }
  return bits.join(' ');
}
function renderPreventionReal(el) {
  const run = UI.prevRealRun || {status: 'idle', completed: 0};
  const products = realStyleFlags(true).sort((a,b)=>a.name.localeCompare(b.name));
  const controls = `<div class="section-head"><div><div class="eyebrow">Prevention agent · actual ALDO data</div><h2>Find opportunities to prevent returns</h2><p>Scan the supplied styles, then investigate the six highest-priority results. Recommendations remain drafts for a merchandiser.</p></div><button type="button" class="btn red" id="prev-real-run" ${run.status === 'running' || anyBusy() ? 'disabled' : ''}>${run.status === 'running' ? 'Analysing…' : run.status === 'done' ? 'Run analysis again' : 'Run analysis'}</button></div>${prevSwitch('real')}<div class="card card-pad" style="margin-bottom:16px;display:flex;gap:16px;flex-wrap:wrap"><label>Analysis scope <select id="prev-product" ${run.status === 'running' ? 'disabled' : ''}><option value="">All styles · investigate top six flags</option>${products.map(s=>`<option value="${esc(s.name)}" ${UI.prevProduct === s.name ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label><label>Mode <select id="prev-mode" ${run.status === 'running' ? 'disabled' : ''}><option value="live" ${(UI.prevMode || 'live') === 'live' ? 'selected' : ''}>Live AI · AWS</option><option value="scripted" ${UI.prevMode === 'scripted' ? 'selected' : ''}>Scripted rehearsal</option></select></label><span class="small muted">${STATE.live.available ? 'AWS available' : 'AWS not connected · use AWS connection below'}</span></div>`;
  if (run.status !== 'done') {
    el.innerHTML = controls + `<div class="card card-pad" role="status"><h3>${run.status === 'running' ? 'Investigating flagged styles' : run.status === 'error' ? 'Analysis could not finish' : 'Ready to analyse'}</h3><p>${run.status === 'running' ? `${run.completed} of ${run.total} styles investigated. Results will appear here when the run finishes.` : run.status === 'error' ? esc(run.error) : 'Press Run analysis to scan actual data and generate recommendations. No product changes are published automatically.'}</p><span class="pill neutral">${(UI.prevMode || 'live') === 'live' ? 'Live AI · AWS' : 'Scripted rehearsal'}</span></div>`;
    return;
  }
  const flags = run.flags, top = flags.slice(0, 12), S = REAL.sample, T = typeof TXN !== 'undefined' && TXN;
  const fl = { flagged: ['red', 'Flagged'], lean: ['warn', 'Size lean'], high: ['info', 'High return rate'], ok: ['neutral', 'Below flag threshold'] };
  el.innerHTML = controls + `<div class="section-head"><div><div class="eyebrow">Completed · ${esc(run.mode)} analysis</div><h2>${run.product ? esc(run.product) : 'Styles to investigate'}</h2><p>${flags.length} styles in this result. ${run.completed} investigated. Ratios compare recorded return and sale events; they do not establish the cause of returns.</p></div></div>
    <div class="card" style="margin-bottom:16px"><div class="tbl-wrap" style="border:0;border-radius:var(--r)"><table><thead><tr><th>Style</th><th>Category</th><th class="num">Shipped</th><th class="num">Returned</th><th class="num">Rate</th><th class="num">Category</th><th>Ratio</th>${T ? '<th class="num">Excess margin</th>' : ''}<th>Fit lean</th><th>Status</th></tr></thead><tbody>
    ${top.map(s => `<tr><td><b>${esc(s.name)}</b><br><span class="small muted">${esc(BANNER_WORD[s.banner] || s.banner)}</span></td><td>${esc(s.category)}</td><td class="num">${num(s.shipped)}</td><td class="num">${num(s.returned)}</td><td class="num">${pct(s.rate, 1)}</td><td class="num">${pct(s.cat_rate, 1)}</td>
      <td><div class="ratio"><span class="t"><span class="f" style="width:${clamp(s.ratio / 2.5, 0, 1) * 100}%"></span><span class="m" style="left:${1.5 / 2.5 * 100}%"></span></span><span class="mono small">${s.ratio.toFixed(2)}×</span></div></td>
      ${T ? `<td class="num">${whole(s.excess_margin || 0)}</td>` : ''}<td class="small">${s.big + s.small ? `${pct(s.big / (s.big + s.small))} too big` : '—'}</td><td><span class="pill ${fl[s.status][0]}">${fl[s.status][1]}</span></td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="stack">${top.slice(0, 6).map(s => {
      const st = {...(run.notes?.[s.name] || STATE.realNotes[s.name] || {}), status: run.decisions?.[s.name]};
      return `<article class="card find-card"><div class="row" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><h3>${esc(s.name)} <span class="small muted">${esc(BANNER_WORD[s.banner] || s.banner)} · ${esc(s.category)}</span></h3><span class="pill ${fl[s.status][0]}">${fl[s.status][1]}</span></div>
        <ul class="evi"><li>${pct(s.rate, 1)} of ${num(s.shipped)} units came back, against ${pct(s.cat_rate, 1)} for the category (${s.ratio.toFixed(2)}×).</li>${s.excess_margin ? `<li>${whole(s.excess_margin)} of margin given back above the category rate in 2025.</li>` : ''}<li>Fit returns: ${s.big + s.small ? `${num(s.big)} too big, ${num(s.small)} too small` : 'no fit reasons on record for this style'}.</li></ul>
        <div class="diag small">${st.diag ? `<b>${esc(st.diagBy)}:</b> ${esc(st.diag)}` : ''}</div>
        <div><span class="page-note">${esc(s.note)}</span> <span class="small muted">${st.status === 'approved' ? 'approved by the merchandiser: ready to publish on the product page' : st.status === 'rejected' ? 'rejected by the merchandiser' : 'draft, waiting for a merchandiser (R10)'}</span></div>
        <div class="ap-actions">${!st.diag ? `<button type="button" class="btn secondary sm" data-rdiag="${esc(s.name)}" ${st.busy ? 'disabled' : ''}>${st.busy ? 'Diagnosing…' : `${icon('think')}Diagnose${chatLive() ? ' with Claude' : ''}`}</button>` : ''}
          ${!st.status ? `<button type="button" class="btn sm" data-rnote="${esc(s.name)}" data-v="approved">Approve the note</button><button type="button" class="btn secondary sm" data-rnote="${esc(s.name)}" data-v="rejected">Reject</button><span class="small muted" style="align-self:center">You're the merchandiser (R10, §7.3)</span>` : ''}</div>
      ${st.status === 'approved' ? realProductPreview(s) : ''}
      </article>`; }).join('')}</div>
    <p class="small muted" style="margin-top:12px">Measuring whether an approved note worked needs the orders after it was published, which this extract doesn't have. The demo styles view shows how the agent measures it (difference-in-differences against similar styles).</p>`;
}
function realProductPreview(s) {
  return `<details class="pp-product-preview" open><summary>Preview the updated product page</summary>
    <div class="pp-shop"><div class="pp-shop-bar"><b>ALDO</b><span>Product page preview · not published</span></div>
    <div class="pp-shop-grid"><div class="pp-shop-image">${icon('bag')}<strong>${esc(s.name)}</strong><span>Product photography placeholder</span></div>
    <div class="pp-shop-info"><div class="eyebrow">${esc(s.category)}</div><h2>${esc(s.name)}</h2><p class="small muted">${esc(BANNER_WORD[s.banner] || s.banner)}</p>
    <div class="pp-fit-note"><span class="pill ok">New · approved guidance</span><h3>${s.leans ? 'Find your fit' : 'Before you choose'}</h3><p>${esc(s.note)}</p></div>
    <div class="small muted" style="margin:20px 0 8px">Select your size · illustrative controls</div><div class="pp-size-preview" aria-label="Illustrative sizes">${['6','6.5','7','7.5','8','8.5','9','9.5','10'].map(n=>`<span>${n}</span>`).join('')}</div>
    <button type="button" class="btn" disabled style="margin-top:16px;width:100%">Add to bag · preview only</button>
    <p class="small muted">This shows the approved wording in a sample shopping layout. Product images, sizes, price and availability are not connected to a live catalogue.</p></div></div></div></details>`;
}
async function runRealPrevention() {
  if (UI.prevRealRun?.status === 'running' || anyBusy()) return;
  const run = UI.prevRealRun = {status: 'running', completed: 0, total: 0, flags: [], decisions: {}, notes: {}, product: UI.prevProduct || '', mode: UI.prevMode || 'live'};
  renderPrevention();
  try {
    if (run.mode === 'live' && !STATE.live.available) throw new Error('AWS is not connected. Open AWS connection, then retry. No scripted result has been substituted.');
    STATE.mode = run.mode;
    if (typeof rememberAgentMode === 'function') rememberAgentMode(run.mode);
    renderMast();
    run.flags = run.product ? realStyleFlags(true).filter(s => s.name === run.product) : realStyleFlags();
    const styles = run.flags.slice(0, 6);
    run.total = styles.length;
    renderPrevention();
    for (const style of styles) {
      await diagnoseReal(style.name, run.mode);
      run.notes[style.name] = {...STATE.realNotes[style.name]};
      run.completed++;
      if (STATE.tab === 'prevention') renderPrevention();
    }
    run.status = 'done';
  } catch (error) { run.status = 'error'; run.error = error.message; }
  if (STATE.tab === 'prevention') renderPrevention();
}
async function diagnoseReal(name, mode = UI.prevMode || 'live') {
  const s = realStyleFlags(true).find(x => x.name === name); if (!s) return;
  const st = STATE.realNotes[name] = STATE.realNotes[name] || {};
  if (mode === 'scripted') { st.diag = realDiagnosisScripted(s); st.diagBy = 'Agent (scripted)'; return renderPrevention(); }
  if (!STATE.live.available) throw new Error('AWS is not connected. Reconnect and retry.');
  st.busy = true; renderPrevention();
  const p = REAL.products.find(x => x.name === name);
  const prompt = `You are the Prevention agent for a footwear retailer. Diagnose why one style is returned so often, from these real numbers only. Never invent numbers.
Style: ${s.name} (${BANNER_WORD[s.banner] || s.banner}, ${s.category})
Return rate: ${pct(s.rate, 1)} of ${s.shipped} units shipped; category average ${pct(s.cat_rate, 1)}.
Fit returns: ${s.big} too big, ${s.small} too small.
${p ? `All returns by reason: ${Object.entries(p.reasons).map(([k, v]) => `${k} ${v}`).join('; ')}.` : 'Reason breakdown not available for this style.'}
Draft note proposed: "${s.note}"
Answer in at most 3 short sentences: the most likely cause, whether the draft note fits, and one other thing a merchandiser should check. Plain English, no markdown.`;
  try { const res = await STATE.live.sample(prompt, { modelTier: 'quick', cache: false }); st.diag = String(res.text || '').trim(); st.diagBy = 'Claude'; }
  catch (e) { st.busy = false; throw new Error('Live analysis failed: ' + e.message); }
  st.busy = false; renderPrevention();
}
const prevSwitch = cur => REAL ? `<div class="seg dseg dsrc" role="group" aria-label="Which styles"><button type="button" data-prevsrc="real" aria-pressed="${cur === 'real'}">Real ALDO styles</button><button type="button" data-prevsrc="demo" aria-pressed="${cur === 'demo'}">Demo styles: full agent loop</button></div>` : '';

document.addEventListener('change', e => { if (e.target.id === 'prev-product' || e.target.id === 'prev-mode') { if (e.target.id === 'prev-product') UI.prevProduct = e.target.value; else UI.prevMode = e.target.value; UI.prevRealRun = null; renderPrevention(); } });

async function decideRealPreview(name, status) {
  const run = UI.prevRealRun;
  if (!run || run.status !== 'done' || anyBusy()) return;
  if (window.PP_SERVER_WORK) {
    const version = PPWORK.version;
    await ppCommand({kind:'real-note', name, status});
    if (PPWORK.version === version || PPWORK.snapshot?.job?.status !== 'completed') return;
  } else {
    const note = STATE.realNotes[name] = STATE.realNotes[name] || {};
    note.status = status;
  }
  if (UI.prevRealRun !== run) return;
  (run.decisions ||= {})[name] = status;
  renderPrevention();
}
