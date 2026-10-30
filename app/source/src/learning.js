/* =====================================================================
   Self-feedback loop: the agent learns where its photo grades go wrong.
   Every time a store grades a returned pair at the counter, the agent's grade
   from the customer's photo is compared with the store's grade and logged.
   From that log the agent keeps a calibration table: for each category and
   photo grade, how often the pair turned out worse (photo too generous) or
   better (too harsh). When a category's "too generous" rate reaches 15% over
   at least 8 checks, the agent changes what it does next time:
     · it lowers its confidence in that photo grade and says why,
     · the check_item_photo result carries the calibration, so a live model
       reads it too,
     · the store counter is told what to look at before grading.
   The log starts with a synthetic pilot history (labelled) and grows with
   every grade given at the counter in this demo.
   ===================================================================== */
const LEARN = { rows: null, threshold: 0.15, minN: 8 };
const GRADE_ORDER = { A: 0, B: 1, C: 2, D: 3 };
const CAT_LOOK = { Boots: 'the outsole and the heel tread (wear there rarely shows in a photo of the upper)', Sneakers: 'the outsole and the inside heel lining', Heels: 'the heel tips and the sole under the ball of the foot', Sandals: 'the footbed for foot marks', Flats: 'the insole and the sole edge', Accessories: 'the corners and the lining' };
/** Pilot history (synthetic): 12 weeks of photo grades against counter grades. Boots photos are the weak spot. */
function learnSeed() {
  const cats = { Boots: 0.21, Sneakers: 0.09, Heels: 0.06, Sandals: 0.05, Flats: 0.07, Accessories: 0.04 };
  const styles = {}; for (const s of DATA.catalogue) (styles[s.category] = styles[s.category] || []).push(s);
  const rows = []; let n = 0;
  for (let day = 84; day >= 1; day--) {
    for (const [cat, worseA] of Object.entries(cats)) {
      const h = hashN(cat + day);
      if (h % 100 > (cat === 'Boots' ? 55 : 30)) continue;     // boots are returned most
      const photo = h % 7 === 0 ? 'B' : 'A', r = (hashN('g' + cat + day) % 1000) / 1000;
      const worse = photo === 'A' ? worseA : 0.1, better = photo === 'B' ? 0.08 : 0;
      const store = r < worse ? (photo === 'A' ? (r < worse * 0.35 ? 'C' : 'B') : 'C') : r > 1 - better ? 'A' : photo;
      const st = (styles[cat] || [])[h % Math.max(1, (styles[cat] || []).length)];
      rows.push({ id: `G-${++n}`, at: Date.now() - day * 86400000, cat, style: st ? st.style_id : '', product: st ? styleName(st.style_id) : cat, photo, store, src: 'pilot' });
    }
  }
  return rows;
}
const learnRows = () => (LEARN.rows = LEARN.rows || learnSeed());
const verdictOf = r => GRADE_ORDER[r.store] > GRADE_ORDER[r.photo] ? 'worse' : GRADE_ORDER[r.store] < GRADE_ORDER[r.photo] ? 'better' : 'right';
/** Calibration for one category and photo grade, from the rows given (default: everything so far). */
function calib(cat, photo, rows) {
  const rs = (rows || learnRows()).filter(r => r.cat === cat && r.photo === photo);
  const n = rs.length, worse = rs.filter(r => verdictOf(r) === 'worse').length, better = rs.filter(r => verdictOf(r) === 'better').length;
  const rate = (worse + 0.5) / (n + 3);   // smoothed so a handful of checks can't swing it
  return { cat, photo, n, worse, better, right: n - worse - better, rate, flag: n >= LEARN.minN && rate >= LEARN.threshold };
}
function adviceFor(caseId) {
  const { line, k } = caseCtx(caseId), cat = IDX.style[line.style_id]?.category; if (!cat || !k.photo.grade) return null;
  const c = calib(cat, k.photo.grade);
  return Object.assign(c, { look: CAT_LOOK[cat] || 'the soles and the lining', confidence: c.flag ? 'medium' : c.n >= LEARN.minN ? 'high' : 'not enough checks yet' });
}
/** Called after every store check: log the agent's photo grade against the store's grade. */
function recordGrade(caseId, storeGrade) {
  const { line, k } = caseCtx(caseId), cat = IDX.style[line.style_id]?.category || 'Other';
  const before = calib(cat, k.photo.grade);
  const row = { id: `G-live-${learnRows().length + 1}`, at: Date.now(), cat, style: line.style_id, product: line.product, photo: k.photo.grade, store: storeGrade, src: 'live', case_id: caseId };
  learnRows().push(row);
  const after = calib(cat, k.photo.grade);
  LEARN.last = { row, before, after, changed: before.flag !== after.flag };
  return LEARN.last;
}
// The store check feeds the loop.
const gradeAtCounterBase = gradeAtCounter;
gradeAtCounter = function (caseId, storeId, grade) { const res = gradeAtCounterBase(caseId, storeId, grade); try { res.learned = recordGrade(caseId, grade); } catch (e) { /* the loop never blocks a return */ } return res; };
// The photo tool carries the calibration, so the scripted and the live agent both see it.
(() => {
  const T = TOOLS.check_item_photo; if (!T) return;
  const run = T.run, summary = T.summary;
  T.run = function (p, ctx) {
    const out = run.call(this, p, ctx);
    try { const k = caseByReturnId(p.return_id), a = adviceFor(k.case_id);
      if (a) out.calibration = { category: a.cat, photo_grade: a.photo, past_store_checks: a.n, came_back_worse: a.worse, came_back_worse_rate: Math.round(a.rate * 100) / 100, confidence: a.confidence,
        advice: a.flag ? `Photos of ${a.cat.toLowerCase()} graded ${a.photo} came back worse at the store ${pct(a.rate)} of the time. Treat the grade as provisional; the store should check ${a.look}.` : 'Photo grades for this category have held up at the store.' }; } catch (e) { /* no calibration */ }
    return out;
  };
  T.summary = r => summary(r) + (r.calibration && r.calibration.confidence === 'medium' ? ` Confidence medium: ${r.calibration.category.toLowerCase()} graded ${r.calibration.photo_grade} came back worse ${pct(r.calibration.came_back_worse_rate)} of the time.` : '');
})();

/** Replays the log in order: at each check, would the agent already have flagged that category? */
function learnReplay() {
  const rows = learnRows().slice().sort((a, b) => a.at - b.at), seen = [], weeks = {};
  let flaggedFirst = null;
  for (const r of rows) {
    const c = calib(r.cat, r.photo, seen), v = verdictOf(r), wk = Math.floor((Date.now() - r.at) / (7 * 86400000));
    const w = weeks[wk] = weeks[wk] || { wk, checks: 0, worse: 0, caught: 0, missed: 0 };
    w.checks++; if (v === 'worse') { w.worse++; if (c.flag) w.caught++; else w.missed++; }
    if (c.flag && !flaggedFirst) flaggedFirst = { at: r.at, cat: r.cat, photo: r.photo, caught: 0, missed: 0 };
    if (flaggedFirst && v === 'worse') flaggedFirst[c.flag ? 'caught' : 'missed']++;
    seen.push(r);
  }
  return { weeks: Object.values(weeks).sort((a, b) => b.wk - a.wk), flaggedFirst };
}
function learningPanel() {
  const rows = learnRows(), live = rows.filter(r => r.src === 'live');
  const right = rows.filter(r => verdictOf(r) === 'right').length, worse = rows.filter(r => verdictOf(r) === 'worse').length, better = rows.length - right - worse;
  const cats = [...new Set(rows.map(r => r.cat))];
  const table = cats.flatMap(cat => ['A', 'B'].map(g => calib(cat, g))).filter(c => c.n).sort((a, b) => b.rate - a.rate);
  const R = learnReplay(), wmax = Math.max(1, ...R.weeks.map(w => w.worse));
  const chart = `<div class="lrn-bars" role="img" aria-label="Pairs that came back worse than the photo, by week: flagged in advance or missed">${R.weeks.map(w => `<div class="lrn-col" data-tip="${esc(`${w.wk ? w.wk + ' weeks ago' : 'This week'}\n${w.checks} store checks · ${w.worse} worse than the photo\n${w.caught} flagged in advance · ${w.missed} missed`)}" tabindex="0">
      <div class="lrn-stack"><span class="lrn-miss" style="height:${(w.missed / wmax * 100).toFixed(1)}%"></span><span class="lrn-caught" style="height:${(w.caught / wmax * 100).toFixed(1)}%"></span></div><span class="lrn-x">${w.wk ? '−' + w.wk : 'now'}</span></div>`).join('')}</div>
    <div class="satg-key"><span><i style="background:var(--c-teal)"></i>Flagged before the store check</span><span><i style="background:var(--c-orange)"></i>Missed: the photo grade was trusted</span><span class="muted">weeks ago</span></div>`;
  const matrix = `<table class="lrn-mx"><thead><tr><th>Agent's photo grade ↓ · store found →</th>${['A', 'B', 'C', 'D'].map(g => `<th class="num">${g}</th>`).join('')}</tr></thead><tbody>
    ${['A', 'B'].map(p => `<tr><th>${p}</th>${['A', 'B', 'C', 'D'].map(s => { const n = rows.filter(r => r.photo === p && r.store === s).length; return `<td class="num ${s === p ? 'diag' : GRADE_ORDER[s] > GRADE_ORDER[p] ? 'off' : 'hi'}">${n || '·'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
  const last = LEARN.last;
  return `<section class="lrn">
    <div class="section-head" style="margin-top:36px"><div><div class="eyebrow">Self-feedback loop</div><h2>The agent learns from its grading mistakes</h2>
      <p>Every store check is compared with the grade the agent gave from the customer's photo. Where photos keep fooling it, the agent lowers its confidence, tells the store what to check, and passes the warning to the live model through the photo tool. Nothing about the policy changes; the agent just stops trusting a photo it has learned not to trust.</p></div></div>
    ${last ? `<div class="lrn-last ${verdictOf(last.row)}"><b>Just learned from ${esc(last.row.product)}:</b> photo said ${last.row.photo}, the store found ${last.row.store} (${verdictOf(last.row) === 'right' ? 'the photo grade held' : verdictOf(last.row) === 'worse' ? 'the photo was too generous' : 'the photo was too harsh'}). ${esc(last.row.cat)} graded ${last.row.photo}: came back worse ${pct(last.before.rate)} → ${pct(last.after.rate)} over ${last.after.n} checks.${last.changed ? ` <b>${last.after.flag ? 'New rule: this grade is now treated as provisional.' : 'Rule lifted: photo grades hold up again.'}</b>` : ''}</div>` : ''}
    <div class="stat-row ap-stats">
      <div class="stat"><div class="l">Store checks logged</div><div class="v">${rows.length}</div><div class="s">${live.length} from this demo · the rest a synthetic pilot</div></div>
      <div class="stat"><div class="l">Photo grade held</div><div class="v">${pct(right / rows.length)}</div><div class="s">${right} of ${rows.length}</div></div>
      <div class="stat alarm"><div class="l">Photo too generous</div><div class="v">${pct(worse / rows.length)}</div><div class="s">the pair came back worse</div></div>
      <div class="stat"><div class="l">Photo too harsh</div><div class="v">${pct(better / rows.length)}</div><div class="s">the pair came back better</div></div></div>
    <div class="sat-two">
      <div class="sat-card"><h4>What the agent believes now</h4><p class="small muted">Per category and photo grade: how often the store found the pair worse. At ${pct(LEARN.threshold)} or more over ${LEARN.minN}+ checks, the grade becomes provisional.</p>
        <div class="tbl-wrap"><table class="lrn-tbl"><thead><tr><th>Category</th><th>Photo grade</th><th class="num">Checks</th><th class="num">Came back worse</th><th>What the agent does</th></tr></thead><tbody>
        ${table.map(c => `<tr class="${c.flag ? 'flag' : ''}"><td><b>${esc(c.cat)}</b></td><td>${c.photo}</td><td class="num">${c.n}</td><td class="num"><b>${pct(c.rate)}</b> <span class="muted small">(${c.worse})</span></td><td class="small">${c.flag ? `<span class="pill orange">Provisional</span> Confidence medium; the store checks ${esc(CAT_LOOK[c.cat] || 'the soles')}.` : c.n >= LEARN.minN ? '<span class="pill ok">Trusted</span>' : '<span class="pill neutral">Learning</span> not enough checks'}</td></tr>`).join('')}</tbody></table></div>
        <p class="sat-formula"><b>Came back worse</b> = (worse at the store + ½) ÷ (checks + 3): smoothed so a few checks can't swing it. The rule switches on at ${pct(LEARN.threshold)} with at least ${LEARN.minN} checks and switches off again if photos start holding up.</p></div>
      <div class="sat-card"><h4>Was the miss flagged in advance?</h4><p class="small muted">The log replayed in order: for each pair that came back worse, had the agent already learned to distrust that kind of photo?</p>${chart}
        ${R.flaggedFirst ? `<p class="sat-formula">The first rule switched on ${esc(fmtWhen(R.flaggedFirst.at))} for ${esc(R.flaggedFirst.cat.toLowerCase())} graded ${R.flaggedFirst.photo}. Since then, ${R.flaggedFirst.caught} of the ${R.flaggedFirst.caught + R.flaggedFirst.missed} pairs that came back worse had been flagged before the store looked, so the store knew where to check. The rest were in categories where photos still mostly hold up.</p>` : ''}
        <h4 style="margin-top:6px">Photo grade against store grade</h4>${matrix}</div></div>
    <div class="lrn-log"><h4>Latest store checks</h4><div class="tbl-wrap"><table class="lrn-tbl"><thead><tr><th>When</th><th>Item</th><th>Photo</th><th>Store</th><th>Result</th><th>Source</th></tr></thead><tbody>
      ${rows.slice().sort((a, b) => b.at - a.at).slice(0, 8).map(r => `<tr><td class="small">${esc(fmtWhen(r.at))}</td><td>${esc(r.product)} <span class="muted small">${esc(r.cat)}</span></td><td>${r.photo}</td><td>${r.store}</td><td>${verdictOf(r) === 'right' ? '<span class="pill ok">Held</span>' : verdictOf(r) === 'worse' ? '<span class="pill orange">Too generous</span>' : '<span class="pill info">Too harsh</span>'}</td><td class="small muted">${r.src === 'live' ? 'This demo' : 'Pilot (synthetic)'}</td></tr>`).join('')}</tbody></table></div></div>
  </section>`;
}
const renderEvalsBase = renderEvals;
renderEvals = function () { renderEvalsBase(); const el = $('#tab-evals'); if (el) el.insertAdjacentHTML('beforeend', learningPanel()); };
