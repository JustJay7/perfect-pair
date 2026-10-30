/* =====================================================================
   Save and replay a run (from Jay's build). A finished run of the Resolution
   agent, live or scripted, can be saved with the page and played back later,
   read-only: the same events in the same order and roughly the same timing.
   Nothing is re-run and no record changes, so a saved live run is a safe
   pitch backup. A checksum shows the saved run hasn't been altered.
   Stored in the artifact's database (collection "runs"); without it, saved
   runs last until the tab closes.
   ===================================================================== */
const RUNS = { db: null, saved: {}, local: {}, play: null };

/** FNV-1a over the saved content: any edit to the events changes it. */
function stableJSON(v) {
  if (Array.isArray(v)) return `[${v.map(stableJSON).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stableJSON(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
function runChecksum(obj) {
  const s = stableJSON(obj); let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
/** Events without raw tool results or images: what the trace shows, small enough to store. */
function sanitizeEvents(events) {
  return events.map(e => {
    const o = { id: e.id, kind: e.kind, at: e.at };
    for (const f of ['text', 'tool', 'why', 'decision', 'tier', 'phase']) if (e[f] != null) o[f] = typeof e[f] === 'string' ? e[f].slice(0, 2000) : e[f];
    if (e.args) o.args = JSON.parse(JSON.stringify(e.args, (k, v) => typeof v === 'string' && v.length > 300 ? v.slice(0, 297) + '…' : v));
    if (e.rules) o.rules = e.rules.map(r => ({ rule: r.rule, note: String(r.note || '').slice(0, 300) }));
    if (e.sources) o.sources = e.sources.slice(0, 6);
    return o;
  });
}
async function initRuns() {
  const use = window.claude && typeof window.claude.use === 'function' ? n => window.claude.use(n) : () => Promise.resolve(null);
  try {
    const db = await use('db').catch(() => null); RUNS.db = db; if (!db) return;
    db.collection('runs').onSnapshot(snap => {
      const next = {}; for (const d of snap.docs) { const v = d.data(); if (v && Array.isArray(v.events)) next[d.id] = v; }
      RUNS.saved = next; renderRunTools(); if (RUNS.play && RUNS.play.listing) renderReplayList();
    }, () => {});
  } catch (e) { /* saved runs stay in this tab */ }
}
const allRuns = () => Object.values(Object.assign({}, RUNS.local, RUNS.saved)).sort((a, b) => b.saved_at < a.saved_at ? -1 : 1);

async function saveRun(caseId) {
  const cs = CASES[caseId]; if (!cs || !cs.events.length || busy(caseId)) return;
  const d = cs.decision || {}, rec = (d.options || []).find(o => o.recommended);
  const body = {
    case_id: caseId, who: caseName(caseId), headline: IDX.kase[caseId].headline, mode: cs.mode || STATE.mode, tier: cs.tierApplied || '',
    ms: cs.stats.ms || 0, stats: { tools: cs.stats.tools, gates: cs.stats.gates, replans: cs.stats.replans },
    outcome: { status: cs.status, recommended: rec ? `${rec.type.replace('_', ' ')}${rec.sku ? ' · ' + skuShort(rec.sku, caseId) : ''}` : '', message: cs.message || d.customer_message || '' },
    events: sanitizeEvents(cs.events),
  };
  const id = `RUN-${Date.now().toString(36).toUpperCase()}`;
  const doc = Object.assign({ id, saved_at: new Date().toISOString() }, body, { checksum: runChecksum(body) });
  if (JSON.stringify(doc).length > 240000) { body.events = body.events.map(({ args, sources, ...e }) => e); doc.events = body.events; doc.checksum = runChecksum(body); }
  if (RUNS.db) {
    try { await RUNS.db.collection('runs').doc(id).set(doc); toast(`Saved ${id} with the page`); }
    catch (e) { RUNS.local[id] = doc; toast(`Saved ${id} in this tab only`); }
  } else { RUNS.local[id] = doc; toast(`Saved ${id} in this tab (open the page in Claude to keep it)`); }
  renderRunTools();
}
async function deleteRun(id) {
  delete RUNS.local[id];
  if (RUNS.saved[id] && RUNS.db) { try { await RUNS.db.collection('runs').doc(id).delete(); } catch (e) { toast("Couldn't delete it"); } }
  delete RUNS.saved[id]; renderRunTools(); renderReplayList();
}
function renderRunTools() {
  const el = $('#run-tools'); if (!el) return;
  const cs = CASES[STATE.active], n = allRuns().length, can = cs && cs.events.length && !busy(STATE.active);
  setHTML(el, `<button type="button" class="btn secondary sm" data-runsave="1" ${can ? '' : 'disabled'} title="${can ? 'Save this run to replay later' : 'Finish a run first'}">${icon('download')}Save this run</button>
    <button type="button" class="btn secondary sm" data-runlist="1">${icon('play')}Replay a saved run${n ? ` (${n})` : ''}</button>
    <span class="small muted">A saved live run is the pitch backup: it replays exactly, read-only.</span>`);
}
/* ---------- the replay window ---------- */
function openReplayList() {
  stopReplay(); RUNS.play = { listing: true };
  let box = document.getElementById('replay');
  if (!box) { box = document.createElement('div'); box.id = 'replay'; box.className = 'replay'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Replay a saved run'); document.body.appendChild(box); }
  box.hidden = false; renderReplayList();
}
function renderReplayList() {
  const box = document.getElementById('replay'); if (!box || !RUNS.play || !RUNS.play.listing) return;
  const runs = allRuns();
  box.innerHTML = `<div class="rp-card"><div class="rp-head"><div><div class="eyebrow">Saved runs · read-only</div><h3>Replay a run</h3></div><button type="button" class="btn secondary sm" data-rp="close">Close</button></div>
    ${runs.length ? `<ul class="rp-list">${runs.map(r => `<li><button type="button" class="rp-item" data-rpopen="${esc(r.id)}"><b>${esc(r.who)} · ${esc(r.outcome.recommended || r.outcome.status.replace('_', ' '))}</b><span class="small muted">${esc(r.id)} · ${r.mode === 'live' ? `Live${r.tier ? ' · ' + esc(r.tier) : ''}` : 'Scripted'} · ${r.events.length} events · ${fmtElapsed(r.ms)} · saved ${esc(new Date(r.saved_at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }))}${RUNS.saved[r.id] ? '' : ' · this tab only'}</span></button><button type="button" class="btn secondary sm" data-rpdel="${esc(r.id)}" aria-label="Delete ${esc(r.id)}">Delete</button></li>`).join('')}</ul>`
      : `<p class="small muted">No saved runs yet. Finish a return on the Return tab, then press <b>Save this run</b>. Save a live run before the pitch: if the network fails, replay it.</p>`}</div>`;
}
function openReplay(id) {
  const r = allRuns().find(x => x.id === id); if (!r) return;
  const { id: _i, saved_at, checksum, ...body } = r;
  const intact = runChecksum(body) === checksum;
  RUNS.play = { run: r, i: 0, speed: RUNS.play && RUNS.play.speed || 2, timer: null, paused: false, intact };
  const box = document.getElementById('replay');
  box.innerHTML = `<div class="rp-card"><div class="rp-head"><div><div class="eyebrow">Replay · read-only · nothing is re-run</div><h3>${esc(r.who)}'s return · ${esc(r.outcome.recommended || r.outcome.status.replace('_', ' '))}</h3>
      <div class="small muted">${esc(r.id)} · ${r.mode === 'live' ? `Live run${r.tier ? ' · ' + esc(r.tier) : ''}` : 'Scripted run'} · ${r.stats.tools} tool calls · ${r.stats.gates} safety checks · ${r.stats.replans} re-plans · took ${fmtElapsed(r.ms)} · <span class="pill ${intact ? 'ok' : 'bad'}">${intact ? 'Unchanged since saved' : 'Changed since saved'}</span></div></div>
      <div class="rp-ctl"><div class="seg dseg" role="group" aria-label="Speed">${[1, 2, 4].map(s => `<button type="button" data-rpspeed="${s}" aria-pressed="${RUNS.play.speed === s}">${s}×</button>`).join('')}</div>
      <button type="button" class="btn secondary sm" data-rp="pause">Pause</button><button type="button" class="btn secondary sm" data-rp="restart">Restart</button><button type="button" class="btn secondary sm" data-rp="list">All runs</button><button type="button" class="btn sm" data-rp="close">Close</button></div></div>
    <ol class="trace rp-trace" aria-live="polite"></ol>
    <div class="rp-out" hidden><div class="eyebrow">What the customer was told</div><div class="msg agent">${esc(r.outcome.message || '—')}</div></div></div>`;
  stepReplay();
}
function stepReplay() {
  const P = RUNS.play; if (!P || !P.run) return;
  const r = P.run, list = document.querySelector('#replay .rp-trace'); if (!list) return;
  if (P.i >= r.events.length) { document.querySelector('#replay .rp-out').hidden = false; const b = document.querySelector('[data-rp="pause"]'); if (b) b.textContent = 'Done'; return; }
  const e = r.events[P.i], t0 = r.events[0].at;
  stickBottom(list, () => list.insertAdjacentHTML('beforeend', evHTML(e, t0)));
  P.i++;
  const next = r.events[P.i];
  // Same order and spacing as the original run; a long wait for the model is shortened to 3 seconds.
  const gap = next ? Math.min(3000, Math.max(80, next.at - e.at)) / P.speed : 0;
  if (!P.paused) P.timer = setTimeout(stepReplay, gap);
}
function stopReplay() { if (RUNS.play && RUNS.play.timer) clearTimeout(RUNS.play.timer); }
function closeReplay() { stopReplay(); RUNS.play = null; const box = document.getElementById('replay'); if (box) box.hidden = true; }
document.addEventListener('click', ev => {
  const t = ev.target.closest('button, #replay'); if (!t) return;
  if (t.id === 'replay' && ev.target === t) return closeReplay();
  if (t.dataset.runsave) return saveRun(STATE.active);
  if (t.dataset.runlist) return openReplayList();
  if (t.dataset.rpopen) return openReplay(t.dataset.rpopen);
  if (t.dataset.rpdel) return deleteRun(t.dataset.rpdel);
  if (t.dataset.rpspeed && RUNS.play) { RUNS.play.speed = +t.dataset.rpspeed; document.querySelectorAll('[data-rpspeed]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.rpspeed === RUNS.play.speed))); return; }
  const a = t.dataset.rp; if (!a) return;
  if (a === 'close') return closeReplay();
  if (a === 'list') return openReplayList();
  if (a === 'restart' && RUNS.play && RUNS.play.run) return openReplay(RUNS.play.run.id);
  if (a === 'pause' && RUNS.play && RUNS.play.run) { const P = RUNS.play; if (P.i >= P.run.events.length) return; P.paused = !P.paused; t.textContent = P.paused ? 'Play' : 'Pause'; if (P.paused) stopReplay(); else stepReplay(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && RUNS.play) closeReplay(); });
initRuns();
