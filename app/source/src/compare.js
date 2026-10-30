/* =====================================================================
   For the judges: the same return through a plain rules engine and through
   the agent. The rules engine is what most returns portals run today: a
   drop-down reason, the 30-day window and the final-sale flag. Both sides are
   valued with the same calculator (returnEconomics / scoreOptions), so the
   difference is the decision, not the arithmetic.
   ===================================================================== */
const CMP = { all: null, running: false };

/** What the agent ended up doing on this return, and what it is worth to ALDO. */
function agentOutcome(id) {
  const cs = CASES[id], d = (cs && cs.decision) || {}, e = returnEconomics(id);
  const rec = (d.options || []).find(o => o.recommended);
  if (d.status === 'options_ready' && rec) return { label: optionTitle(id, rec), value: rec.value_to_aldo, type: rec.type, n: (d.options || []).filter(o => o.eligible !== false).length };
  if (d.status === 'human_review') {
    if (cs.flags && cs.flags.suspected_abuse) return { label: 'Holds the money: a store manager checks the photo first', value: e.margin, type: 'held', expected: true };
    const v = scoreOptions(id, d.cost_owner || 'customer', ['refund']).options[0];
    return { label: 'A store associate checks it, then refunds', value: v.value_to_aldo, type: 'review', expected: true };
  }
  if (d.status === 'not_eligible') return { label: 'Final sale stands; a person can review it', value: e.margin, type: 'refuse' };
  return { label: STATUS_WORD[d.status] || 'Not run yet', value: null, type: '' };
}
function rulesOutcome(id) {
  const b = rulesBaseline(id), e = returnEconomics(id);
  return Object.assign(b, { value: b.outcome === 'refund' ? b.ruleValue : e.margin });
}
/** Plain words for what the agent looked at on this run. */
function agentLooked(id) {
  const cs = CASES[id], seen = [];
  for (const ev of (cs.events || [])) if (ev.kind === 'call' && ev.tool && TOOLS[ev.tool] && !seen.includes(TOOLS[ev.tool].label)) seen.push(TOOLS[ev.tool].label);
  return seen;
}
const cmpSigned = v => `${v >= 0 ? '+' : '−'}${money(Math.abs(v))}`;

function compareOneHTML(id) {
  const cs = CASES[id], { k } = caseCtx(id), d = cs.decision;
  if (!d) return `<div class="cmp-wait"><b>Run ${esc(caseName(id))}'s return first.</b> Press <b>Find my options</b> on the customer's screen, and the two systems line up here side by side.</div>`;
  const r = rulesOutcome(id), a = agentOutcome(id), diff = r.value != null && a.value != null ? r2(a.value - r.value) : null;
  const looked = agentLooked(id);
  const row = (label, rule, agent) => `<div class="cmp-row"><div class="cmp-l">${label}</div><div class="cmp-c rule">${rule}</div><div class="cmp-c agent">${agent}</div></div>`;
  return `<div class="cmp-grid" role="table" aria-label="${esc(caseName(id))}'s return, rules engine and agent">
    <div class="cmp-row cmp-h" role="row"><div class="cmp-l"></div><div class="cmp-c rule"><span class="cmp-who">Rules engine</span><span class="small muted">what most portals run today</span></div><div class="cmp-c agent"><span class="cmp-who">Perfect Pair agent</span><span class="small muted">${cs.mode === 'live' ? 'live run' : 'scripted run'}</span></div></div>
    ${row('What it reads', `A drop-down reason (“${esc(r.pick)}”), days since delivery, the final-sale flag`, `${esc(QUOTE(cs.words || k.words))} and ${looked.length ? esc(looked.map(x => x.toLowerCase()).join(', ')) : 'nothing yet'}`)}
    ${row('What it decides', `<b>${esc(r.decision)}</b>`, `<b>${esc(a.label)}</b>${a.n > 1 ? `<div class="small muted">${a.n} options shown; this one recommended</div>` : ''}`)}
    ${row('Worth to ALDO', r.value != null ? `<span class="cmp-money">${money(r.value)}</span>` : '—', a.value != null ? `<span class="cmp-money">${money(a.value)}</span>${diff != null && Math.abs(diff) >= 0.01 ? ` <span class="cmp-diff ${diff > 0 ? 'up' : 'down'}">${cmpSigned(diff)}</span>` : ''}${a.expected ? '<div class="small muted">if the person follows the agent</div>' : ''}` : '—')}
    ${row('Safety', 'Nothing to check: it can only refund or refuse', `${Object.keys(RULES).length} rules in code check every money action before it runs${cs.stats.gates ? ` (${cs.stats.gates} checks so far)` : ''}; the model can't change the dollar limits`)}
    </div>
    <div class="cmp-miss"><div class="cmp-l">What the rules engine gets wrong here</div>${r.misses.length ? `<ul>${r.misses.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : `<p class="small muted">Nothing on this one: a simple return lands in the same place either way. The agent's value shows on the harder ones below.</p>`}</div>`;
}

/** Every test customer through both systems, in a sandbox that is thrown away. */
async function compareAll() {
  if (CMP.running) return; CMP.running = true; renderCompare();
  const rows = [];
  try {
    for (const k of demoCases().filter(x => !x.custom)) {
      const id = k.case_id, snapSys = JSON.stringify(SYS), snapCase = CASES[id];
      STATE.sandbox = true; CASES[id] = Object.assign(newCaseState(id), { words: k.words });
      try {
        await investigate(id, { mode: 'scripted', sink: [], throwOnError: true });
        const r = rulesOutcome(id), a = agentOutcome(id);
        rows.push({ id, name: caseName(id), tag: (DEMO_CASES[id] || [k.tag])[0], rule: r.decision, ruleValue: r.value, agent: a.label, agentValue: a.value, expected: a.expected, type: a.type, misses: r.misses, tools: CASES[id].stats.tools, gates: CASES[id].stats.gates });
      } catch (e) { rows.push({ id, name: caseName(id), tag: (DEMO_CASES[id] || [k.tag])[0], error: (e && e.message) || String(e), misses: [] }); }
      finally { Object.keys(SYS).forEach(x => delete SYS[x]); Object.assign(SYS, JSON.parse(snapSys)); CASES[id] = snapCase; STATE.sandbox = false; }
    }
  } finally { STATE.sandbox = false; CMP.running = false; }
  CMP.all = { rows, at: Date.now() };
  renderCompare();
}
function compareAllHTML() {
  if (CMP.running) return `<div class="cmp-wait"><b>Running every test return through both…</b> In a sandbox: no records change.</div>`;
  if (!CMP.all) return `<div class="cmp-all-cta"><button type="button" class="btn" data-cmpall="1">${icon('play')}Run all ${demoCases().filter(x => !x.custom).length} test returns through both</button><span class="small muted">Takes a few seconds. Uses the scripted agent so the result is the same every time, in a sandbox that changes nothing.</span></div>`;
  const rows = CMP.all.rows.filter(x => !x.error), sum = f => r2(rows.reduce((s, x) => s + (x[f] || 0), 0));
  const rT = sum('ruleValue'), aT = sum('agentValue'), wrong = rows.filter(x => x.misses.length), nMiss = rows.reduce((s, x) => s + x.misses.length, 0);
  const ex = rows.filter(x => x.type === 'exchange').length, kept = rows.filter(x => ['exchange', 'store_credit', 'smart_credit'].includes(x.type)).length, held = rows.filter(x => x.type === 'held').length;
  return `<div class="cmp-tiles">
      <div class="cmp-tile hero"><div class="l">Worth to ALDO across ${rows.length} returns</div><div class="v">${cmpSigned(r2(aT - rT))}</div><div class="s">Agent ${money(aT)} · rules engine ${money(rT)}</div></div>
      <div class="cmp-tile"><div class="l">Rules engine mistakes</div><div class="v">${nMiss}</div><div class="s">in ${wrong.length} of ${rows.length} returns</div></div>
      <div class="cmp-tile"><div class="l">Sales kept instead of refunded</div><div class="v">${kept}</div><div class="s">${ex} exchange${ex === 1 ? '' : 's'}, ${kept - ex} store credit · rules engine: 0</div></div>
      <div class="cmp-tile"><div class="l">Suspect claims held</div><div class="v">${held}</div><div class="s">before any money moved · rules engine: 0</div></div>
    </div>
    <div class="tbl-wrap"><table class="cmp-tbl"><thead><tr><th>Customer</th><th>Rules engine</th><th>Perfect Pair agent</th><th class="num">Rules</th><th class="num">Agent</th><th class="num">Difference</th></tr></thead><tbody>
    ${CMP.all.rows.map(x => x.error ? `<tr><td><b>${esc(x.name)}</b></td><td colspan="5" class="small muted">Couldn't run: ${esc(x.error)}</td></tr>` : `<tr>
      <td><b>${esc(x.name)}</b><div class="small muted">${esc(x.tag)}</div></td>
      <td class="small">${esc(x.rule)}${x.misses.length ? `<div class="cmp-why">${esc(x.misses[0])}${x.misses.length > 1 ? ` <span class="muted">+${x.misses.length - 1} more</span>` : ''}</div>` : ''}</td>
      <td class="small"><b>${esc(x.agent)}</b><div class="muted">${x.tools} tool calls</div></td>
      <td class="num mono">${x.ruleValue != null ? money(x.ruleValue) : '—'}</td><td class="num mono">${x.agentValue != null ? money(x.agentValue) + (x.expected ? '*' : '') : '—'}</td>
      <td class="num mono"><span class="cmp-diff ${x.agentValue - x.ruleValue > 0.005 ? 'up' : x.agentValue - x.ruleValue < -0.005 ? 'down' : 'same'}">${x.ruleValue != null && x.agentValue != null ? (Math.abs(x.agentValue - x.ruleValue) < 0.005 ? 'same' : cmpSigned(r2(x.agentValue - x.ruleValue))) : '—'}</span></td></tr>`).join('')}
    <tr class="tot"><td><b>Total</b></td><td></td><td></td><td class="num mono">${money(rT)}</td><td class="num mono">${money(aT)}</td><td class="num mono"><span class="cmp-diff ${aT - rT >= 0 ? 'up' : 'down'}">${cmpSigned(r2(aT - rT))}</span></td></tr>
    </tbody></table></div>
    <p class="small muted cmp-foot">Worth to ALDO = margin kept + what the returned pair resells for − label − shipping − processing − any bonus − the risk of a second return, from the same calculator for both sides. * The agent sent this one to a person; the value assumes the person follows its recommendation. The agent can be worth less on a single return when it stops charging a fee that ALDO caused (§3.3): that is the policy being followed, not money lost. Synthetic test returns; the dashboard has ALDO's real 2025 totals. <button type="button" class="linkish" data-cmpall="1">Run again</button></p>`;
}
function renderCompare() {
  const el = $('#cmp-area'); if (!el) return;
  const id = STATE.active; if (!CASES[id]) { el.innerHTML = ''; return; }
  el.innerHTML = `<section class="card cmp" aria-labelledby="cmp-h">
    <div class="cmp-head"><div><div class="eyebrow">For the judges</div><h2 id="cmp-h">Same return, two systems</h2>
      <p>A rules engine sees a drop-down reason, the 30-day window and the final-sale flag, then refunds or refuses. The agent reads the customer's words and photos, the reviews, the stock and the customer's history, and every action still passes the same safety checks in code.</p></div></div>
    <h3 class="cmp-sub">${esc(caseName(id))}'s return</h3>
    ${compareOneHTML(id)}
    <h3 class="cmp-sub">Every test return</h3>
    ${compareAllHTML()}
  </section>`;
}
const renderDecisionAreaBase = renderDecisionArea;
renderDecisionArea = function () { renderDecisionAreaBase(); renderCompare(); };
document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-cmpall]'); if (t) compareAll();
});
try { renderCompare(); } catch (e) { /* the Return view isn't on screen yet */ }
