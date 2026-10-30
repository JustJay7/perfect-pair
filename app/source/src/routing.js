/* =====================================================================
   Where the return goes: the customer's drop-off first, then the pair.
   1. Drop-off: the customer returns it at the store nearest home (the most
      convenient for them: no label, money back at the counter).
   2. The pair: from that store, every route is valued the same way:
        expected margin = (sale price − cost of the pair − route cost) × chance it sells in 4 weeks
      Routes: keep it on that store's shelf; keep it there and fill e-com
      orders from the store (ship-from-store); both at once; transfer to
      another store; send it back to the distribution centre for e-com; the
      outlet at 30% off.
   3. The agent keeps the nearest drop-off whenever a full-price route from it
      earns at least as much as sending the pair anywhere else, so the customer
      gets the easiest return and ALDO keeps the original margin per sale.
   Chance it sells = 1 − e^(−weekly sales × 4 ÷ (units on hand + 1)), from the
   last 8 weeks of sales of this exact SKU at that location (the distribution
   centre's sales are e-com orders). Distances from home are approximate (demo).
   ===================================================================== */
const hashN = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
/** Stores in the customer's region with an approximate distance from home, nearest first. */
function dropOffs(caseId) {
  const { c } = caseCtx(caseId);
  return DATA.locations.filter(l => l.type === 'store' && l.region === c.region)
    .map(l => ({ loc: l, km: Math.round(20 + hashN(c.customer_id + l.location_id) % 150) / 10 }))
    .sort((a, b) => a.km - b.km);
}
function sellStats(sku, loc) {
  const r = invRow(sku, loc), sold = r ? r.units_sold_8w : 0;
  const onh = r ? Math.max(0, r.on_hand_quantity - ((SYS.sold || {})[sku + '|' + loc] || 0)) : 0, wk = sold / 8;
  return { sold, onh, wk, p: 1 - Math.exp(-wk * 4 / (onh + 1)), days: wk ? Math.round(7 * (onh + 1) / wk) : null };
}
/** What share of ALDO's real 2025 units in this category sold online, and how many online orders a store filled. */
function onlineShare(category) {
  const T = DATA.txn; if (!T || !T.cube) return null;
  const re = { Boots: /Boots/, Sneakers: /Perf Shoes|Cas Shoes/, Sandals: /Sandals/, Heels: /Dress Shoes/, Flats: /Cas Shoes/, Accessories: /Handbags|Wallets|Acc Items/ }[category];
  if (!re) return null;
  let all = 0, web = 0, inst = 0;
  const C = T.cube;
  for (let i = 0; i < C.su.length; i++) {
    if (!re.test(T.cats[C.k[i]])) continue;
    const ch = T.channels[C.c[i]], u = C.su[i]; all += u;
    if (ch === 'WEB' || ch === 'WCC' || ch === 'INSTORE') web += u;
    if (ch === 'INSTORE') inst += u;
  }
  return all ? { online: web / all, fromStore: web ? inst / web : 0, units: all } : null;
}
function routePlan(caseId) {
  const { line, ec, st, c, k } = caseCtx(caseId);
  const price = st.price, cost = ec.estimated_cost, margin = r2(price - cost);
  const grade = (CASES[caseId] && CASES[caseId].received && CASES[caseId].received.grade) || k.photo.grade;
  const drops = dropOffs(caseId); if (!drops.length) return null;
  const near = drops[0];
  const plan = (from, fromName) => {
  const xfer = (a, b) => a === b ? 0 : (IDX.xfer[a + '|' + b]?.estimated_shipping_cost ?? 6);
  // Shipping an e-com order from this store: the average over the regions it ships to. Any online sale pays this.
  const ships = DATA.logistics.filter(x => x.origin === from), ship = ships.length ? r2(ships.reduce((s, x) => s + x.estimated_shipping_cost, 0) / ships.length) : 10;
  const S = sellStats(line.sku, from), E = sellStats(line.sku, 'DC-MTL');
  const routes = [];
  const add = (o) => { o.perSale = r2(o.price - cost - o.cost); o.gm = r2(o.price - cost); o.exp = r2(o.perSale * o.p); o.keeps = o.perSale >= margin - 0.005; routes.push(o); };
  if (grade === 'A') {
    add({ key: 'shelf', kind: 'store', name: `Keep on the shelf at ${fromName}`, at: fromName, price, cost: 0, p: S.p, wk: S.wk, onh: S.onh, note: 'Back on the shelf the same day. No transfer.' });
    add({ key: 'ecom', kind: 'ecom', name: `Hold at ${fromName} for e-com orders`, at: 'E-com (ship from store)', price, cost: ship, p: E.p, wk: E.wk, onh: E.onh, note: `Ships to the online buyer from the store: ${money(ship)}, the same as any online order.` });
    const ls = -Math.log(1 - Math.min(S.p, 0.999)), le = -Math.log(1 - Math.min(E.p, 0.999));
    if (ls + le > 0) add({ key: 'both', kind: 'both', name: `${fromName}: shelf and e-com together`, at: `${fromName} + e-com`, price, cost: r2(ship * le / (ls + le)), p: 1 - Math.exp(-(ls + le)), wk: S.wk + E.wk, onh: S.onh + E.onh,
      note: 'Listed in the store and online at once; whichever sells it first. Shipping only when an online buyer takes it.' });
    for (const L of DATA.locations.filter(l => l.type === 'store' && l.location_id !== from)) {
      const X = sellStats(line.sku, L.location_id);
      add({ key: 'to:' + L.location_id, kind: 'transfer', name: `Transfer to ${L.name}`, at: L.name, price, cost: xfer(from, L.location_id), p: X.p, wk: X.wk, onh: X.onh, note: `Store transfer ${money(xfer(from, L.location_id))}.` });
    }
    add({ key: 'dc', kind: 'dc', name: 'Send back to the distribution centre for e-com', at: 'E-com (from the DC)', price, cost: r2(xfer(from, 'DC-MTL') + ship), p: E.p, wk: E.wk, onh: E.onh, note: 'Transfer to the DC, then shipping to the online buyer.' });
    add({ key: 'outlet', kind: 'outlet', name: 'Mirabel outlet at 30% off', at: 'Mirabel outlet', price: r2(price * 0.7), cost: xfer(from, 'OUT1'), p: 0.8, wk: null, onh: null, note: 'Sells faster, but at 30% off.' });
  } else {
    const pr = r2(price * (grade === 'B' ? 0.6 : 0.08));
    add({ key: 'outlet', kind: 'outlet', name: grade === 'B' ? 'Mirabel outlet at 40% off' : 'Liquidation or donation', at: grade === 'B' ? 'Mirabel outlet' : 'Liquidation', price: pr, cost: xfer(from, 'OUT1'), p: grade === 'B' ? 0.8 : 1, wk: null, onh: null, note: `Grade ${grade}: it can't be sold as new.` });
  }
  routes.sort((a, b) => b.exp - a.exp);
  const local = routes.filter(r => ['shelf', 'ecom', 'both'].includes(r.key));
  const bestLocal = local.length ? local.reduce((a, b) => (b.exp > a.exp ? b : a)) : null, bestAny = routes[0];
  const pick = bestLocal && bestLocal.exp >= bestAny.exp - 0.5 ? bestLocal : bestAny;
  return { from, ship, S, E, routes, pick, bestAny, bestLocal };
  };
  const P0 = plan(near.loc.location_id, near.loc.name);
  // Every drop-off the customer could use, with the best route from there.
  const perDrop = drops.map(d => Object.assign({ d }, plan(d.loc.location_id, d.loc.name)));
  const bestDrop = perDrop.reduce((a, b) => (b.pick.exp > a.pick.exp ? b : a));
  return Object.assign({ price, cost, margin, grade, near, drops, perDrop, bestDrop, share: onlineShare(st.category || IDX.style[line.style_id]?.category) }, P0);
}
const ROUTE_C = { store: 'var(--ink-2)', ecom: 'var(--c-blue)', both: 'var(--kraft-deep)', transfer: 'var(--c-teal)', dc: 'var(--chart-2)', outlet: 'var(--c-orange)' };
function routingPanel(caseId) {
  if (!caseId || !IDX.kase[caseId]) return '';
  const P = routePlan(caseId); if (!P) return '';
  const { line } = caseCtx(caseId), cs = CASES[caseId] || {};
  const pk = P.pick, top = P.routes.slice(0, 8);
  const feasible = P.grade === 'A' && P.bestLocal && P.pick === P.bestLocal;
  const max = Math.max(1, ...top.map(r => r.exp));
  const bars = `<div class="rtg">${top.map(r => `<div class="rtg-row${r === pk ? ' pick' : ''}" data-tip="${esc(`${r.name}\nSale ${money(r.price)} − cost ${money(P.cost)} − route ${money(r.cost)} = ${money(r.perSale)} per sale\n× ${pct(r.p)} chance it sells in 4 weeks = ${money(r.exp)}`)}" tabindex="0">
      <div class="rtg-name">${r === pk ? '<span class="rc-star">★</span> ' : ''}${esc(r.name)}${r.keeps ? '' : ' <span class="rtg-md">below original margin</span>'}</div>
      <div class="rtg-track"><span style="width:${(r.exp / max * 100).toFixed(1)}%;background:${ROUTE_C[r.kind]}"></span></div>
      <div class="rtg-val">${money(r.exp)}</div></div>`).join('')}
    <div class="satg-key">${[['store', 'Nearest store shelf'], ['ecom', 'E-com from the store'], ['both', 'Shelf + e-com'], ['transfer', 'Transfer to another store'], ['dc', 'Back to the DC'], ['outlet', 'Outlet']].filter(([k2]) => top.some(r => r.kind === k2)).map(([k2, l]) => `<span><i style="background:${ROUTE_C[k2]}"></i>${l}</span>`).join('')}</div></div>`;
  // Selling rate of this exact SKU: e-com against each store.
  const rateRows = [{ name: 'E-com (all online orders)', wk: P.E.wk, onh: P.E.onh, p: P.E.p, kind: 'ecom' }].concat(DATA.locations.filter(l => l.type === 'store').map(L => { const X = sellStats(line.sku, L.location_id); return { name: L.name + (L.location_id === P.from ? ' (nearest)' : ''), wk: X.wk, onh: X.onh, p: X.p, kind: L.location_id === P.from ? 'store' : 'transfer' }; }));
  const wmax = Math.max(0.01, ...rateRows.map(r => r.wk));
  const rates = `<div class="rtg">${rateRows.map(r => `<div class="rtg-row" data-tip="${esc(`${r.name}\n${r.wk.toFixed(2)} sold a week (last 8 weeks) · ${r.onh} on hand\n${pct(r.p)} chance one more sells in 4 weeks`)}" tabindex="0"><div class="rtg-name">${esc(r.name)}</div>
      <div class="rtg-track"><span style="width:${(r.wk / wmax * 100).toFixed(1)}%;background:${ROUTE_C[r.kind]}"></span></div><div class="rtg-val">${r.wk.toFixed(1)}/wk</div></div>`).join('')}</div>`;
  const table = `<div class="tbl-wrap"><table class="rt-tbl"><thead><tr><th>Route</th><th class="num">Sale price</th><th class="num">Cost of the pair</th><th class="num">Margin per sale</th><th class="num">Route cost</th><th class="num">Net per sale</th><th class="num">Sold a week</th><th class="num">Sells in 4 wks</th><th class="num">Expected margin</th><th>Keeps the ${money(P.margin)} margin?</th></tr></thead><tbody>
    ${P.routes.map(r => `<tr class="${r === pk ? 'pick' : ''}"><td><b>${r === pk ? '★ ' : ''}${esc(r.name)}</b><div class="small muted">${esc(r.note)}</div></td><td class="num">${money(r.price)}</td><td class="num">−${money(P.cost)}</td><td class="num">${money(r.gm)}</td><td class="num">${r.cost ? '−' + money(r.cost) : '$0.00'}</td><td class="num"><b>${money(r.perSale)}</b></td><td class="num">${r.wk == null ? '—' : r.wk.toFixed(2)}</td><td class="num">${pct(r.p)}</td><td class="num"><b>${money(r.exp)}</b></td><td>${r.keeps ? '<span class="pill ok">Yes, after route costs</span>' : '<span class="pill orange">No, after route costs</span>'}</td></tr>`).join('')}</tbody></table></div>`;
  const dropRows = P.perDrop.map((x, i) => `<li class="${i ? '' : 'near'}${x === P.bestDrop ? ' best' : ''}"><b>${esc(x.d.loc.name)}</b><span>${x.d.km} km from home${i ? ` · ${(x.d.km - P.near.km).toFixed(1)} km further` : ' · nearest'}</span>
      <span class="small">Then: ${esc(x.pick.name.replace(x.d.loc.name + ': ', '').replace(' at ' + x.d.loc.name, ' here').replace('Hold at ' + x.d.loc.name, 'Hold here'))}</span><span class="small"><b>Expected ${money(x.pick.exp)}</b>${x.pick.exp > P.pick.exp + 0.005 ? ` <span class="ok-t">(+${money(x.pick.exp - P.pick.exp)})</span>` : ''}</span>
      ${x === P.bestDrop ? '<span class="rt-badge">Most profitable drop-off</span>' : ''}${i === 0 ? '<span class="rt-badge near">Easiest for the customer</span>' : ''}</li>`).join('') + `<li><b>Mail it back</b><span>no trip</span><span class="small muted">Label${cs.decision?.cost_owner && cs.decision.cost_owner !== 'customer' ? ' free' : ` ${money(META.mail_fee)} unless ALDO caused the return`}; money back after it arrives (3–5 days)</span></li>`;
  const sh = P.share;
  return `<section class="rt-panel">${groupHead('ret', 'Where the return goes: drop-off and resale', 'The agent picks the customer\'s easiest drop-off, then the most profitable place to sell the pair, keeping the full margin when it can')}
    <div class="rt-plan">
      <div class="rt-step"><span class="rt-n">1</span><div><span class="small muted">The customer drops it off at</span><b>${esc(P.near.loc.name)}</b><span class="small">${P.near.km} km from home · free · money back at the counter</span></div></div>
      <div class="rt-arrow" aria-hidden="true">→</div>
      <div class="rt-step pick"><span class="rt-n">2</span><div><span class="small muted">The pair then</span><b>${esc(pk.name)}</b><span class="small">expected ${money(pk.exp)} · ${pct(pk.p)} chance it sells in 4 weeks</span></div></div>
      <div class="rt-arrow" aria-hidden="true">→</div>
      <div class="rt-step"><span class="rt-n">3</span><div><span class="small muted">Margin per sale</span><b>${money(pk.perSale)}${pk.keeps ? ' · original margin preserved' : ' · below original margin'}</b><span class="small">${pk.cost ? `${money(pk.perSale)} after the ${money(pk.cost)} ${pk.kind === 'transfer' ? 'transfer' : 'shipping'}. ` : 'No route cost. '}Original: ${money(P.margin)} (${money(P.price)} − ${money(P.cost)} cost)</span></div></div>
    </div>
    <p class="rt-verdict ${feasible ? 'ok' : ''}">${P.grade !== 'A' ? `Graded ${P.grade}: the pair can't be sold as new, so it goes to ${esc(pk.at)}. The customer still drops it at the nearest store.`
      : feasible ? `<b>Feasible.</b> Keeping the pair at ${esc(P.near.loc.name)} ${pk.key === 'shelf' ? 'on the shelf' : pk.key === 'ecom' ? 'for e-com orders' : 'on the shelf and online'} earns ${money(pk.exp)}, ${P.bestAny === pk ? 'the most of any route' : `within 50¢ of the best route`}. The customer gets the closest drop-off, nothing is transferred, with ${money(pk.perSale)} net per sale after route costs versus ${money(P.margin)} originally. ${pk.keeps ? 'Original unit margin is preserved.' : 'Original unit margin is reduced.'}`
      : `<b>A transfer pays more here.</b> ${esc(P.bestAny.name)} earns ${money(P.bestAny.exp)} against ${money(P.bestLocal ? P.bestLocal.exp : 0)} for keeping it at ${esc(P.near.loc.name)}. The customer still drops it at the nearest store; the pair moves afterwards and sells at full price. After ${money(P.bestAny.cost)} in route costs, net margin is ${money(P.bestAny.perSale)} versus ${money(P.margin)} originally: a ${money(P.margin-P.bestAny.perSale)} reduction per sale.`}</p>
    ${P.grade === 'A' && P.bestDrop !== P.perDrop[0] && P.bestDrop.pick.exp > P.pick.exp + 0.5 ? `<p class="rt-verdict alt"><b>Most profitable drop-off: ${esc(P.bestDrop.d.loc.name)}</b>, ${(P.bestDrop.d.km - P.near.km).toFixed(1)} km further from home. From there the pair ${esc(P.bestDrop.pick.key === 'shelf' ? 'goes straight back on the shelf' : P.bestDrop.pick.name.toLowerCase())}: expected ${money(P.bestDrop.pick.exp)}, ${money(P.bestDrop.pick.exp - P.pick.exp)} more than dropping it at ${esc(P.near.loc.name)}, and no transfer. The agent offers both: ${esc(P.near.loc.name)} as the easiest, ${esc(P.bestDrop.d.loc.name)} if it suits the customer just as well.</p>` : ''}
    <div class="rt-two">
      <div class="sat-card"><h4>Expected margin by route</h4><p class="small muted">From the nearest drop-off. The longest bar is what ALDO can expect to make from the pair in the next 4 weeks.</p>${bars}
        <p class="sat-formula"><b>Expected margin</b> = (sale price − cost of the pair − route cost) × chance it sells in 4 weeks. <b>Chance it sells</b> = 1 − e^(−weekly sales × 4 ÷ (units on hand + 1)), from the last 8 weeks of this exact size at each location. The distribution centre's sales are e-com orders. E-com shipping (${money(P.ship)} on average from ${esc(P.near.loc.name)}) is what any online sale costs.</p></div>
      <div class="sat-card"><h4>Selling rate: e-com against the stores</h4><p class="small muted">${esc(line.product)}, ${esc(line.colour.toLowerCase())}, size ${esc(line.size)}: units sold a week, last 8 weeks.</p>${rates}
        ${sh ? `<p class="sat-formula"><b>ALDO's real 2025 data:</b> ${pct(sh.online)} of ${esc((IDX.style[line.style_id]?.category || '').toLowerCase())} units sold online, and stores filled ${pct(sh.fromStore)} of those online orders (the "online orders filled by a store" channel). Shipping e-com orders from stores is something ALDO already does.</p>` : ''}</div>
    </div>
    <div class="rt-drops"><h4>Where the customer can drop it off</h4><ul>${dropRows}</ul></div>
    <h4 class="rt-h">The breakdown, every route</h4>${table}
  </section>`;
}

function renderRouteArea() { const el = $('#route-area'); if (!el) return; const id = STATE.active; el.innerHTML = id && IDX.kase[id] ? `<div class="card card-pad">${routingPanel(id)}</div>` : ''; }
const renderDecisionAreaR = renderDecisionArea;
renderDecisionArea = function () { renderDecisionAreaR(); renderRouteArea(); };
try { renderRouteArea(); } catch (e) { /* the Return view isn't on screen yet */ }
