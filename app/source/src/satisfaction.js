/* =====================================================================
   Customer satisfaction next to profit, for every way to settle a return.
   Satisfaction is an estimate on a 0–100 scale from five plain factors, each
   worked out from the option itself (no survey data in this prototype):

     Satisfaction = 30·Asked + 25·Fixes + 20·Flexible + 15·Speed + 10·Effort

     Asked     1 if it is what the customer asked for (an exchange counts for a
               fit, quality or damage problem), 0.8 for a refund they didn't ask
               for, 0.6 for credit, 0 for a decline
     Fixes     does it solve the problem: exchange = 1 − chance of a second
               return; refund 0.7; Smart Credit 0.7; store credit 0.6; decline 0
     Flexible  how freely they can use what they get: refund 1, exchange 0.8,
               Smart Credit 0.75, credit + bonus 0.7, credit 0.6, decline 0
     Speed     1 − days until settled ÷ 10 (credit 1 day, exchange its delivery
               days + 1, refund 5 days for the card)
     Effort    1 if free for them, 0.6 if they pay the mail label, 0.2 for a
               decline (they have to appeal)

   Profit is "ALDO keeps", from the same calculator as the value receipt.
   Balanced score = ½ × satisfaction + ½ × profit as a share of the best
   profit on offer (0–100), so neither goal wins by default.
   ===================================================================== */
const SAT_W = { asked: 30, fixes: 25, flexible: 20, speed: 15, effort: 10 };
const SAT_FLEX = { refund: 1, exchange: 0.8, smart_credit: 0.75, credit_bonus: 0.7, credit: 0.6, decline: 0 };
const SAT_FIX = { refund: 0.7, smart_credit: 0.7, credit_bonus: 0.6, credit: 0.6, decline: 0 };

/** Every way to settle this return, with profit to ALDO and the inputs for satisfaction. */
function settleOptions(caseId, review) {
  const cs = CASES[caseId] || {}, { line, k } = caseCtx(caseId), e = returnEconomics(caseId);
  const owner = cs.decision?.cost_owner || cs.costOwner || 'customer', fee = owner === 'customer' ? META.mail_fee : 0;
  const out = [];
  if (review && review.kind === 'counter') {
    const co = counterOptions(caseId);
    const T = { release_refund: 'refund', release_credit: 'credit', ship_exchange: 'exchange', convert_credit: 'credit', credit_no_bonus: 'credit', decline_return: 'decline' };
    for (const o of co.options) if (T[o.key] && o.value != null) out.push({ key: o.key, label: o.label, type: o.key === 'release_credit' && co.held && co.held.rec.bonus ? 'credit_bonus' : T[o.key], profit: o.value, days: T[o.key] === 'refund' ? 5 : T[o.key] === 'exchange' ? 3 : 1, fee: 0, second: 0.1, best: o.best });
    return out;
  }
  if (review && review.kind === 'policy') {
    const refund = scoreOptions(caseId, owner, ['refund']).options[0];
    out.push({ key: 'exception', label: 'Exception: refund', type: 'refund', profit: refund.value_to_aldo, days: 5, fee: 0 });
    out.push({ key: 'uphold', label: 'Uphold the final sale', type: 'decline', profit: e.margin, days: 0, fee: 0 });
    return out;
  }
  const ex = associateExchange(caseId), co = creditOptions(caseId);
  if (ex) out.push({ key: 'approve_exchange', label: `Exchange, ${skuShort(ex.sku, caseId)}`, type: 'exchange', profit: ex.value_to_aldo, days: (ex.arrives_in_days || 2) + 1, fee: 0, second: ex.breakdown?.second_return_chance ?? 0.1 });
  for (const c of co.options) out.push({ key: c.key, label: c.key === 'approve_credit' ? 'Store credit' : c.key === 'approve_credit_bonus' ? `Credit + ${moneyShort(c.bonus)} bonus` : 'Smart Credit', type: c.key === 'approve_credit' ? 'credit' : c.key === 'approve_credit_bonus' ? 'credit_bonus' : 'smart_credit', profit: c.value, days: 1, fee: 0 });
  out.push({ key: 'approve_refund', label: 'Refund', type: 'refund', profit: co.refund, days: 5, fee });
  out.push({ key: 'decline', label: 'Decline (§2.4)', type: 'decline', profit: e.margin, days: 0, fee: 0 });
  return out;
}
function satisfactionOf(caseId, o) {
  const cs = CASES[caseId] || {}, { k } = caseCtx(caseId);
  const words = String(cs.words || k.words || '').toLowerCase(), wantsRefund = /refund|money back/.test(words);
  const fixable = ['fit', 'quality', 'damage'].includes(cs.reasonCode || cs.decision?.reason_code);
  const asked = o.type === 'decline' ? 0 : o.type === 'refund' ? (wantsRefund || !fixable ? 1 : 0.8) : o.type === 'exchange' ? (wantsRefund ? 0.6 : 1) : 0.6;
  const fixes = o.type === 'exchange' ? 1 - (o.second ?? 0.1) : SAT_FIX[o.type] ?? 0.6;
  const flexible = SAT_FLEX[o.type] ?? 0.6;
  const speed = o.type === 'decline' ? 0 : 1 - Math.min(10, o.days || 0) / 10;
  const effort = o.type === 'decline' ? 0.2 : o.fee ? 0.6 : 1;
  const parts = { asked, fixes, flexible, speed, effort };
  const score = Object.keys(SAT_W).reduce((s, x) => s + SAT_W[x] * parts[x], 0);
  return { score: Math.round(score), parts };
}
function satRows(caseId, review) {
  const rows = settleOptions(caseId, review).map(o => Object.assign(o, { sat: satisfactionOf(caseId, o) }));
  if (!rows.length) return { rows, pick: null };
  const maxP = Math.max(1, ...rows.map(o => o.profit));
  rows.forEach(o => { o.profitScore = Math.max(0, Math.round(o.profit / maxP * 100)); o.balance = Math.round(0.5 * o.sat.score + 0.5 * o.profitScore); });
  const top = f => rows.reduce((a, b) => (f(b) > f(a) ? b : a));
  const pick = { sat: top(o => o.sat.score), profit: top(o => o.profit), balance: top(o => o.balance) };
  return { rows, pick };
}

/** Two charts: satisfaction by option, then satisfaction against profit. */
function satisfactionPanel(caseId, review) {
  if (!caseId || !IDX.kase[caseId]) return '';
  const { rows, pick } = satRows(caseId, review);
  if (!pick || rows.length < 2) return '';
  const tag = o => [o === pick.sat && 'Most satisfying', o === pick.profit && 'Most profit', o === pick.balance && 'Best balance'].filter(Boolean);
  const bars = `<div class="satg" role="img" aria-label="Customer satisfaction by option: ${rows.map(o => `${o.label} ${o.sat.score}`).join(', ')}">
    ${rows.map(o => `<div class="satg-row${o === pick.balance ? ' bal' : ''}" data-tip="${esc(`${o.label}: satisfaction ${o.sat.score}/100\nAsked for ${pct(o.sat.parts.asked)} · fixes ${pct(o.sat.parts.fixes)} · flexible ${pct(o.sat.parts.flexible)} · speed ${pct(o.sat.parts.speed)} · effort ${pct(o.sat.parts.effort)}`)}" tabindex="0">
      <div class="satg-name">${esc(o.label)}${tag(o).length ? `<span class="satg-tags">${tag(o).map(t => `<i>${esc(t)}</i>`).join('')}</span>` : ''}</div>
      <div class="satg-track">${Object.keys(SAT_W).map(x => `<span class="satg-seg s-${x}" style="width:${(SAT_W[x] * o.sat.parts[x]).toFixed(2)}%"></span>`).join('')}</div>
      <div class="satg-val">${o.sat.score}</div></div>`).join('')}
    <div class="satg-key">${Object.keys(SAT_W).map(x => `<span><i class="s-${x}"></i>${{ asked: 'Got what they asked for', fixes: 'Fixes the problem', flexible: 'Flexible to use', speed: 'Speed', effort: 'Little effort' }[x]} (${SAT_W[x]})</span>`).join('')}</div></div>`;
  // Scatter: profit across, satisfaction up. Every option labelled; the three picks ringed.
  const W = 560, H = 270, L = 52, R = 18, T = 18, B = 44;
  const ps = rows.map(o => o.profit), lo = Math.min(0, ...ps), hi = Math.max(...ps) * 1.08 || 1;
  const tx = niceTicks(lo, hi), X = v => L + (v - tx[0]) / ((tx[tx.length - 1] - tx[0]) || 1) * (W - L - R), Y = v => T + (100 - v) / 100 * (H - T - B);
  const lab = rows.map(o => ({ o, x: X(o.profit), y: Y(o.sat.score) }));
  lab.sort((a, b) => a.y - b.y); for (let i = 1; i < lab.length; i++) if (Math.abs(lab[i].y - lab[i - 1].y) < 14 && Math.abs(lab[i].x - lab[i - 1].x) < 120) lab[i].dy = (lab[i - 1].dy || 0) + 14;
  const scatter = `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Satisfaction against profit for each option">
    ${[0, 25, 50, 75, 100].map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--chart-grid)"/>${vzText(L - 8, Y(v) + 4, String(v), { a: 'end' })}`).join('')}
    ${tx.map(v => `<line x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="${T}" y2="${H - B}" stroke="${v === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'}"/>${vzText(X(v), H - B + 16, compactMoney(v))}`).join('')}
    <rect x="${X(Math.max(0, hi / 2)).toFixed(1)}" y="${T}" width="${(W - R - X(Math.max(0, hi / 2))).toFixed(1)}" height="${(Y(50) - T).toFixed(1)}" fill="var(--ok-soft)" opacity=".55"/>
    ${vzText(W - R - 6, Y(50) - 6, 'good for both', { a: 'end', fill: 'var(--ok)', font: 'var(--f-body)', w: 700, fs: 11 })}
    ${vzText((L + W - R) / 2, H - 6, 'ALDO keeps ($) →', { font: 'var(--f-body)', fill: 'var(--ink-2)' })}
    <text x="13" y="${(T + H - B) / 2}" transform="rotate(-90 13 ${(T + H - B) / 2})" text-anchor="middle" font-size="11" fill="var(--ink-2)" font-family="var(--f-body)">Customer satisfaction (0–100) →</text>
    ${lab.map(({ o, x, y, dy }) => { const right = x > W * 0.62, isB = o === pick.balance;
      return `<g class="mk" data-tip="${esc(`${o.label}\nALDO keeps ${money(o.profit)} · satisfaction ${o.sat.score}/100 · balance ${o.balance}`)}" tabindex="0">
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" fill="transparent"/>
        ${tag(o).length ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="none" stroke="${isB ? 'var(--kraft-deep)' : 'var(--ink-2)'}" stroke-width="2" ${isB ? '' : 'stroke-dasharray="3 2"'}/>` : ''}
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="${isB ? 'var(--kraft-deep)' : o.type === 'decline' ? 'var(--red)' : 'var(--ink-2)'}" stroke="var(--panel)" stroke-width="2"/></g>
        ${vzText(x + (right ? -14 : 14), y + 4 + (dy || 0), o.label, { a: right ? 'end' : 'start', fill: 'var(--ink)', font: 'var(--f-body)', w: isB ? 700 : 500, fs: 11.5 })}`; }).join('')}
  </svg></div><div class="satg-key"><span><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--kraft-deep)" stroke-width="2"/><circle cx="7" cy="7" r="3" fill="var(--kraft-deep)"/></svg> Best balance: ${esc(pick.balance.label)}</span><span><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--ink-2)" stroke-width="2" stroke-dasharray="3 2"/></svg> Most profit: ${esc(pick.profit.label)} · most satisfying: ${esc(pick.sat.label)}</span></div>`;
  const tbl = tableView(['Option', 'Satisfaction', 'ALDO keeps', 'Profit score', 'Balance'], rows.map(o => [o.label, String(o.sat.score), money(o.profit), String(o.profitScore), String(o.balance)]), [0, 1, 1, 1, 1]);
  return `<section class="sat-panel">${groupHead('ret', 'Customer satisfaction and profit, by option', 'Every way to settle this return: how happy the customer is likely to be, and what ALDO keeps')}
    <div class="sat-picks">
      <div><span class="small muted">Most satisfying</span><b>${esc(pick.sat.label)}</b><span class="small">${pick.sat.sat.score}/100 · keeps ${money(pick.sat.profit)}</span></div>
      <div><span class="small muted">Most profit</span><b>${esc(pick.profit.label)}</b><span class="small">${money(pick.profit.profit)} · ${pick.profit.sat.score}/100</span></div>
      <div class="bal"><span class="small muted">Best balance of both</span><b>${esc(pick.balance.label)}</b><span class="small">balance ${pick.balance.balance} · ${pick.balance.sat.score}/100 · ${money(pick.balance.profit)}</span></div></div>
    <div class="sat-two">
      <div class="sat-card"><h4>Customer satisfaction, by option</h4><p class="small muted">Estimated on a 0–100 scale; each bar is built from the five factors below.</p>${bars}
        <p class="sat-formula"><b>Satisfaction</b> = 30 × got what they asked for + 25 × fixes the problem + 20 × flexible to use + 15 × speed + 10 × little effort. Each factor runs 0 to 1: <i>asked</i> is 1 for what they asked for (an exchange counts for a fit, quality or damage problem), 0.8 for an unasked refund, 0.6 for credit; <i>fixes</i> is 1 − the chance of a second return for an exchange, 0.7 for a refund or Smart Credit, 0.6 for credit; <i>flexible</i> is 1 for cash, 0.8 exchange, 0.75 Smart Credit, 0.7 credit with bonus, 0.6 credit; <i>speed</i> is 1 − days to settle ÷ 10; <i>effort</i> is 1 if free, 0.6 if they pay the label. A decline scores near zero. An estimate from the option itself, not survey data.</p></div>
      <div class="sat-card"><h4>Satisfaction against profit</h4><p class="small muted">Up is a happier customer, right is more kept by ALDO. The shaded corner is good for both.</p>${scatter}
        <p class="sat-formula"><b>Best balance</b> = ½ × satisfaction + ½ × profit score, where profit score = ALDO keeps ÷ the best profit on offer × 100. <b>Most profit</b> is the highest "ALDO keeps"; <b>most satisfying</b> is the highest satisfaction. Profit comes from the value receipt calculator, after the pair's cost, label, shipping, processing, any bonus and second-return risk.</p>${tbl}</div></div>
  </section>`;
}
