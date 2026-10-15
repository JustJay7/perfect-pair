/* Actual source selection affects analytics; the agent demo keeps its fixtures. */
UI.dataSource = 'synthetic';
UI.dataViews = {};

function renderDataSource() {
  const actual = UI.dataSource === 'actual';
  document.querySelectorAll('[data-source]').forEach(button => {
    button.setAttribute('aria-pressed', button.dataset.source === UI.dataSource);
    button.disabled = button.dataset.source === 'actual' && !REAL;
  });
  const note = $('#data-source-note');
  if (!note) return;
  const analytics = ['dashboard', 'data'].includes(STATE.tab);
  note.textContent = actual
    ? (analytics ? 'Actual ALDO data · Dashboard and Data use the supplied files. Agent scenarios remain synthetic.' : 'This screen uses the synthetic agent demo. Actual data is available in Dashboard and Data.')
    : (REAL ? 'Synthetic data · switch to Actual for the supplied ALDO data in Dashboard and Data.' : 'Synthetic data · actual dataset has not been imported.');
}

function setDataSource(source, navigate = true) {
  if (!['synthetic', 'actual'].includes(source)) return false;
  if (source === 'actual' && !REAL) { toast('Actual dataset has not been imported'); return false; }
  if (anyBusy()) { toast('Wait for the current run to finish before switching datasets'); return false; }
  UI.dataViews[UI.dataSource] = UI.data;
  UI.dataSource = source;
  UI.dash.src = source === 'actual' ? 'real' : 'pilot';
  UI.data = UI.dataViews[source] || { ds: source === 'actual' ? 'actual-returns' : 'orders', q: '' };
  renderDataSource();
  if (navigate) showTab(source === 'actual' && !['dashboard', 'data'].includes(STATE.tab) ? 'dashboard' : STATE.tab);
  return true;
}

let ACTUAL_DATASETS = null;
function actualDatasets() {
  if (ACTUAL_DATASETS) return ACTUAL_DATASETS;
  if (!REAL) return [];
  const returns = {
    label: 'Returns (daily totals)',
    description: 'Every return line contributes to totals by day, banner, channel and reason. Fees and return-order counts are assigned once per transaction, to its first source line. Under a reason filter these are attributed transaction counts.',
    columns: ['date', 'banner', 'channel', 'reason', 'quantity', 'refund_amount', 'return_orders', 'linked_exchange_orders', 'restocking_fees', 'final_sale_qty', 'unknown_final_sale_qty'],
    rows: REAL.rows.map(r => [isoOf(r.dn), r.b, r.c, r.g, r.n, r.amt, r.ro, r.ex, r.fee, r.fs, r.unknown_fs || 0]),
  };
  const sources = {
    label: 'Source files', description: 'All five CSVs were processed in full. Notes.docx supplies the join definitions. The raw files remain local; only aggregates are embedded in this demo.',
    columns: ['file', 'dataset', 'source_rows', 'note', 'sha256'],
    rows: (REAL.sources || []).map(s => [s.file, s.dataset, s.rows, s.note || '', s.sha256]),
  };
  ACTUAL_DATASETS = [['actual-returns', returns], ...Object.entries(REAL.tables || {}).map(([id, value]) => ['actual-' + id, value]), ['actual-sources', sources]];
  return ACTUAL_DATASETS;
}

function actualCoverage() {
  const q = REAL.quality;
  if (!q) return '';
  return `<p class="small muted">Original-order matches: ${num(q.matched_order_lines)} of ${num(q.return_lines)} return lines (${pct(q.matched_order_lines / q.return_lines, 1)}). Final-sale flag matches: ${num(q.matched_flag_lines)} (${pct(q.matched_flag_lines / q.return_lines, 1)}). Missing flags stay unknown; ${num(q.zero_quantity_lines)} zero-quantity lines remain zero. ${num(q.missing_fee_orders)} return orders have no fee record. ${esc(q.currency)}</p>`;
}

function renderActualData() {
  const el = $('#tab-data'), datasets = actualDatasets();
  if (!datasets.length) { el.textContent = 'Actual dataset has not been imported.'; return; }
  const [id, ds] = datasets.find(([key]) => key === UI.data.ds) || datasets[0];
  const query = UI.data.q.trim().toLowerCase();
  const rows = query ? ds.rows.filter(row => row.some(value => String(value ?? '').toLowerCase().includes(query))) : ds.rows;
  el.innerHTML = `<div class="section-head"><div><div class="eyebrow">Actual ALDO data · aggregates from all supplied CSV rows</div><h2>The actual dataset</h2><p>${esc(ds.description)}</p>${actualCoverage()}</div></div>
    <div class="dataset-bar"><label class="sr-only" for="ds">Dataset</label><select id="ds">${datasets.map(([key, value]) => `<option value="${esc(key)}" ${key === id ? 'selected' : ''}>${esc(value.label)}</option>`).join('')}</select>
    <label class="sr-only" for="dsq">Filter rows</label><input id="dsq" type="search" placeholder="Filter by date, banner or product" value="${esc(UI.data.q)}"><span class="small muted">${num(rows.length)} of ${num(ds.rows.length)} aggregate rows${rows.length > 200 ? ' (showing 200)' : ''}</span></div>
    <div class="tbl-wrap data-scroll"><table><thead><tr>${ds.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 200).map(row => `<tr>${row.map(value => `<td class="${typeof value === 'number' ? 'num' : ''}">${value == null ? '—' : esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
