/* =====================================================================
   Switchable charts. A chart card can show the same data several ways
   (bars, columns, pie, scatter, histogram, heatmap): the card registers a
   renderer per form and the buttons in its header swap the body in place.
   Only forms that suit the data are offered: a pie only for parts of a
   whole, a scatter only where there are two numbers per item.
   ===================================================================== */
const VIZ = {};
const VIZ_PICK = {};          // remembered choice per card, so re-renders keep it
let VIZ_UID = 0;
const FORM_LABEL = { stack: 'Stacked', line: 'Lines', group: 'Side by side', bar: 'Bars', col: 'Columns', dot: 'Dots', pie: 'Pie', heat: 'Heatmap', scatter: 'Scatter', hist: 'Histogram', wf: 'Waterfall', time: 'Timeline', split: 'Stacked', chan: 'By channel', ban: 'By banner', skew: 'Fit lean', size: 'By size' };

/** forms: [{id, render: () => html, note}]; the first is the default. */
function vizCard(key, title, sub, forms, explain, table) {
  forms = forms.map(f => ({ title, sub, ...f }));
  VIZ[key] = forms;
  const cur = forms.find(f => f.id === VIZ_PICK[key]) || forms[0];
  const sw = forms.length > 1 ? `<div class="vz-switch" role="group" aria-label="${esc(`Chart type for ${title}`)}">${forms.map(f => `<button type="button" data-vz="${esc(key)}" data-form="${f.id}" aria-pressed="${f === cur}">${esc(FORM_LABEL[f.id] || f.id)}</button>`).join('')}</div>` : '';
  return `<section class="chart-card" data-vizkey="${esc(key)}"><div class="cc-head"><h4>${esc(cur.title)}</h4>${sw}</div>${sub ? `<p class="small muted vz-sub">${esc(cur.sub)}</p>` : ''}
    <div class="vz-body">${cur.render()}</div>${explain ? `<p class="chart-explain">${explain}<span class="vz-note">${cur.note ? ' ' + esc(cur.note) : ''}</span></p>` : ''}${table || ''}</section>`;
}
function switchViz(key, form) {
  const forms = VIZ[key]; if (!forms) return;
  const f = forms.find(x => x.id === form); if (!f) return;
  VIZ_PICK[key] = form;
  const card = [...document.querySelectorAll('[data-vizkey]')].find(c => c.dataset.vizkey === key); if (!card) return;
  card.querySelector('.vz-body').innerHTML = f.render();
  card.querySelector('.cc-head h4').textContent = f.title;
  const subtitle = card.querySelector('.vz-sub'); if (subtitle) subtitle.textContent = f.sub;
  const note = card.querySelector('.vz-note'); if (note) note.textContent = f.note ? ' ' + f.note : '';
  card.querySelectorAll('[data-vz]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.form === form)));
}
document.addEventListener('click', e => { const b = e.target.closest('[data-vz]'); if (b) switchViz(b.dataset.vz, b.dataset.form); });

/* ---------- scales ---------- */
function niceTicks(lo, hi, n = 4) {
  if (!(hi > lo)) { hi = lo + (Math.abs(lo) || 1); }
  const raw = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), err = raw / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const t = []; for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + step / 2; v += step) t.push(Math.abs(v) < step / 1e6 ? 0 : +v.toFixed(10));
  return t;
}
const intTicks = (t, vals) => vals.every(v => Number.isInteger(v)) ? t.filter(v => Number.isInteger(v)) : t;
const vzText = (x, y, s, o = {}) => `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" text-anchor="${o.a || 'middle'}" font-size="${o.fs || 11}" fill="${o.fill || 'var(--muted)'}" font-family="${o.font || 'var(--f-mono)'}"${o.w ? ` font-weight="${o.w}"` : ''}>${esc(s)}</text>`;
function wrapLabel(s, max) {
  const words = String(s).split(' '), lines = ['']; for (const w of words) { if ((lines[lines.length - 1] + ' ' + w).trim().length > max && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim(); }
  if (lines.length > 2) { lines.length = 2; lines[1] = lines[1].slice(0, max - 1) + '…'; }
  return lines;
}
const gradDefs = u => `<defs><linearGradient id="${u}-g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:var(--g1)"/><stop offset="1" style="stop-color:var(--g2)"/></linearGradient><linearGradient id="${u}-n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--gn1)"/><stop offset="1" style="stop-color:var(--gn2)"/></linearGradient></defs>`;

/** Vertical columns from a zero line. rows: [{label, value, tip, hl}] */
function colsSVG(rows, opts = {}) {
  const fmt = opts.fmt || money, n = rows.length, u = `vz${++VIZ_UID}`;
  const W = chartW(), H = 214, L = 50, R = 10, T = 22, B = 44;
  const vals = rows.map(r => r.value), mn0 = Math.min(0, ...vals), mx0 = Math.max(0, ...vals), t = intTicks(niceTicks(mn0 < 0 ? mn0 - (mx0 - mn0) * 0.12 : 0, mx0), vals);
  const lo = t[0], hi = t[t.length - 1], y = v => T + (hi - v) / ((hi - lo) || 1) * (H - T - B);
  const slot = (W - L - R) / n, bw = Math.min(58, slot * 0.62), emph = rows.some(r => r.hl);
  const maxCh = Math.max(6, Math.floor(slot / 6.4));
  return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || 'Column chart')}">${gradDefs(u)}
    ${t.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${v === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'}"/>${vzText(L - 8, y(v) + 4, (opts.tick || compactMoney)(v), { a: 'end' })}`).join('')}
    ${rows.map((r, i) => {
      const cx = L + slot * i + slot / 2, y0 = y(0), yv = y(r.value), top = Math.min(y0, yv), h = Math.max(1.5, Math.abs(yv - y0)), neg = r.value < 0;
      const dim = emph && !r.hl;
      return `<g class="vcol-g" style="--i:${i}"><rect class="vcol${neg ? ' neg' : ''}" x="${(cx - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${dim ? 'var(--chart-2)' : `url(#${u}-${neg ? 'n' : 'g'})`}" data-tip="${esc(r.tip || `${r.label}\n${fmt(r.value)}`)}" tabindex="0"/>
        ${vzText(cx, neg ? yv + 13 : yv - 6, fmt(r.value), { fill: dim ? 'var(--muted)' : 'var(--ink)', w: r.hl ? 700 : 400 })}
        ${wrapLabel(r.label, maxCh).map((ln, j) => vzText(cx, H - B + 16 + j * 13, ln, { fs: 11.5, font: 'var(--f-body)', fill: r.hl ? 'var(--ink)' : 'var(--ink-2)', w: r.hl ? 700 : 400 })).join('')}</g>`;
    }).join('')}</svg></div>`;
}
/** Donut for parts of a whole. rows: [{label, value, tip}] (values ≥ 0) */
function pieSVG(rows, opts = {}) {
  const fmt = opts.fmt || (v => String(v));
  const parts = rows.filter(r => r.value > 0), total = parts.reduce((s, r) => s + r.value, 0) || 1;
  let at = 0;
  const slices = parts.map((r, i) => {
    const p = r.value / total * 100, gap = parts.length > 1 ? 0.7 : 0;
    const s = `<circle class="slice" style="--i:${i}" cx="100" cy="100" r="68" fill="none" stroke="var(--cat-${(i % 6) + 1})" stroke-width="30" pathLength="100" stroke-dasharray="${Math.max(0.1, p - gap).toFixed(2)} ${(100 - p + gap).toFixed(2)}" stroke-dashoffset="${(-at).toFixed(2)}" transform="rotate(-90 100 100)" data-tip="${esc(r.tip || `${r.label}\n${fmt(r.value)} · ${pct(r.value / total)}`)}" tabindex="0"/>`;
    at += p; return s;
  });
  return `<div class="pie-wrap"><svg viewBox="0 0 200 200" class="pie" role="img" aria-label="${esc(opts.aria || 'Pie chart')}">${slices.join('')}
      ${vzText(100, 98, opts.center || fmt(total), { fs: 22, fill: 'var(--ink)', font: 'var(--f-display)', w: 600 })}${vzText(100, 118, opts.centerSub || 'total', { fs: 11, font: 'var(--f-body)' })}</svg>
    <ul class="pie-legend">${parts.map((r, i) => `<li style="--i:${i}" data-tip="${esc(r.tip || r.label)}" tabindex="0"><i style="background:var(--cat-${(i % 6) + 1})"></i><span>${esc(r.label)}</span><b>${esc(fmt(r.value))}</b><em>${pct(r.value / total)}</em></li>`).join('')}</ul></div>`;
}
/** Scatter: pts [{x, y, label, tip, hl, cls}] */
function scatterSVG(pts, o) {
  const W = chartW(), H = 236, L = 54, R = 16, T = 16, B = 42;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const pad = (a, b) => (b - a || Math.abs(b) || 1) * 0.08;
  const x0 = o.x.zero ? Math.min(0, ...xs) : Math.min(...xs) - pad(Math.min(...xs), Math.max(...xs)), x1 = Math.max(...xs) + pad(Math.min(...xs), Math.max(...xs));
  const y0 = o.y.zero === false ? Math.min(...ys) - pad(Math.min(...ys), Math.max(...ys)) : Math.min(0, ...ys), y1 = Math.max(...ys) + pad(Math.min(...ys), Math.max(...ys));
  const tx = niceTicks(x0, x1), ty = niceTicks(y0, y1);
  const X = v => L + (v - tx[0]) / ((tx[tx.length - 1] - tx[0]) || 1) * (W - L - R), Y = v => T + (ty[ty.length - 1] - v) / ((ty[ty.length - 1] - ty[0]) || 1) * (H - T - B);
  const order = [...pts].sort((a, b) => (a.hl ? 1 : 0) - (b.hl ? 1 : 0));
  return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || `${o.y.label} against ${o.x.label}`)}">
    ${ty.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${v === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'}"/>${vzText(L - 8, Y(v) + 4, o.y.fmt(v), { a: 'end' })}`).join('')}
    ${tx.map(v => `<line x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="${T}" y2="${H - B}" stroke="var(--chart-grid)"/>${vzText(X(v), H - B + 16, o.x.fmt(v))}`).join('')}
    ${vzText((L + W - R) / 2, H - 6, o.x.label, { font: 'var(--f-body)', fill: 'var(--ink-2)' })}
    <text x="12" y="${(T + H - B) / 2}" transform="rotate(-90 12 ${(T + H - B) / 2})" text-anchor="middle" font-size="11" fill="var(--ink-2)" font-family="var(--f-body)">${esc(o.y.label)}</text>
    ${order.map((p, i) => `<g class="mk" style="--i:${(i * Math.min(1, 18 / order.length)).toFixed(1)}" data-tip="${esc(p.tip || p.label)}" tabindex="0"><circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="12" fill="transparent"/><circle class="${p.cls || ''}" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${p.hl ? 7 : 5}" fill="${p.hl ? 'var(--chart-1)' : p.fill || 'var(--chart-2)'}" stroke="${p.hl ? 'var(--ink)' : p.stroke || 'var(--panel)'}" stroke-width="${p.hl ? 2.5 : p.stroke ? 2.4 : 1.6}" opacity="${p.hl || p.fill ? 1 : 0.75}"/></g>`).join('')}
    ${pts.filter(p => p.hl && p.label).map(p => { const x = X(p.x), y = Y(p.y), right = x > W * 0.66; return vzText(x + (right ? -12 : 12), y - 10, p.label, { a: right ? 'end' : 'start', fill: 'var(--ink)', font: 'var(--f-body)', w: 700, fs: 12 }); }).join('')}
  </svg></div>`;
}
/** Histogram of values, with one value marked. */
function histSVG(values, o = {}) {
  const fmt = o.fmt || money, u = `vz${++VIZ_UID}`;
  const lo0 = Math.min(...values, o.mark ?? Infinity), hi0 = Math.max(...values, o.mark ?? -Infinity);
  const edges = niceTicks(lo0, hi0, o.bins || 8);
  if (edges[edges.length - 1] <= hi0) edges.push(edges[edges.length - 1] + (edges[1] - edges[0]));
  const nb = edges.length - 1, counts = new Array(nb).fill(0);
  const binOf = v => clamp(Math.floor((v - edges[0]) / (edges[1] - edges[0])), 0, nb - 1);
  values.forEach(v => counts[binOf(v)]++);
  const mb = o.mark != null ? binOf(o.mark) : -1;
  const W = chartW(), H = 214, L = 40, R = 12, T = 26, B = 40;
  const ty = intTicks(niceTicks(0, Math.max(...counts), 3), counts), top = ty[ty.length - 1];
  const Y = v => T + (top - v) / top * (H - T - B), slot = (W - L - R) / nb;
  const step = Math.ceil(nb / Math.max(2, Math.floor((W - L - R) / 62)));
  return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Histogram')}">${gradDefs(u)}
    ${ty.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${v === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'}"/>${vzText(L - 8, Y(v) + 4, String(v), { a: 'end' })}`).join('')}
    ${counts.map((c, i) => { const x = L + i * slot + 1, h = Math.max(c ? 1.5 : 0, Y(0) - Y(c));
      return `<rect class="vcol" style="--i:${i}" x="${x.toFixed(1)}" y="${(Y(0) - h).toFixed(1)}" width="${(slot - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${i === mb ? `url(#${u}-g)` : 'var(--chart-2)'}" data-tip="${esc(`${c} ${o.unit || 'items'}\n${fmt(edges[i])} to ${fmt(edges[i + 1])}${i === mb ? `\n${o.markLabel || 'This one'} is here` : ''}`)}" tabindex="0"/>`; }).join('')}
    ${edges.map((v, i) => i % step ? '' : vzText(L + i * slot, H - B + 16, fmt(v))).join('')}
    ${vzText((L + W - R) / 2, H - 6, o.xLabel || '', { font: 'var(--f-body)', fill: 'var(--ink-2)' })}
    ${mb >= 0 ? (() => { const x = L + (o.mark - edges[0]) / (edges[nb] - edges[0]) * (W - L - R), right = x > W * 0.7; return `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${T - 8}" y2="${Y(0)}" stroke="var(--red)" stroke-width="1.6" stroke-dasharray="4 3"/>${vzText(x + (right ? -6 : 6), T - 12, `${o.markLabel || 'This one'}: ${fmt(o.mark)}`, { a: right ? 'end' : 'start', fill: 'var(--ink)', font: 'var(--f-body)', w: 700, fs: 12 })}`; })() : ''}
  </svg></div>`;
}
function heatColour(ratio, negative = false) {
  const stops = negative ? [[255,241,242],[251,113,133],[159,18,57]] : [[239,246,255],[96,165,250],[30,64,175]];
  const t = Math.max(0, Math.min(1, ratio)) * 2, a = stops[Math.min(1, Math.floor(t))], b = stops[Math.min(2, Math.floor(t) + 1)];
  const rgb = a.map((v, i) => Math.round(v + (b[i] - v) * (t >= 2 ? 1 : t % 1)));
  const lum = rgb.map(v => {v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;});
  const l = .2126 * lum[0] + .7152 * lum[1] + .0722 * lum[2];
  return {background: `rgb(${rgb.join(',')})`, text: l > .179 ? '#000000' : '#ffffff'};
}
/** Heatmap grid: pale blue = low, deep blue = high; rose = negative. */
function heatHTML(h) {
  const fmt = h.fmt || (v => String(v));
  const all = h.cells.flat().filter(c => c && c.v != null).map(c => c.v);
  const mx = Math.max(0, ...all), mn = Math.min(0, ...all);
  let i = 0;
  return `<div class="heat" style="--hc:${h.cols.length}">
    <div class="heat-row heat-head"><span class="heat-corner">${esc(h.corner || '')}</span>${h.cols.map(c => `<span class="heat-col">${esc(c)}</span>`).join('')}</div>
    ${h.rows.map((r, ri) => `<div class="heat-row"><span class="heat-lab">${esc(r)}</span>${h.cols.map((c, ci) => {
      const cell = h.cells[ri][ci];
      if (!cell || cell.v == null) return `<span class="hc empty" style="--i:${i++}" data-tip="${esc(cell && cell.tip || `${r} · ${c}\nNot possible`)}" tabindex="0">—</span>`;
      const neg = cell.v < 0, p = Math.round(Math.abs(cell.v) / ((neg ? -mn : mx) || 1) * 100);
      const colour = heatColour(p / 100, neg);
      return `<span class="hc" style="--i:${i++};background:${colour.background};color:${colour.text}" data-tip="${esc(cell.tip || `${r} · ${c}\n${fmt(cell.v)}`)}" tabindex="0">${esc(fmt(cell.v))}</span>`;
    }).join('')}</div>`).join('')}
    <div class="heat-key small"><span>${esc(fmt(0))}</span><i style="background:linear-gradient(90deg,#eff6ff,#60a5fa,#1e40af)"></i><span>${esc(fmt(mx))}</span><span>Low → high</span>${mn < 0 ? `<span>${esc(fmt(mn))}</span><i style="background:linear-gradient(90deg,#9f1239,#fb7185,#fff1f2)"></i><span>0 · negative values</span>` : ''}</div></div>`;
}
/** One row of numbers as a heat strip. */
const heatStrip = (rows, fmt, colTitle) => heatHTML({ rows: rows.map(r => r.label), cols: [colTitle || 'Value'], cells: rows.map(r => [{ v: r.value, tip: r.tip }]), fmt });

/* ---------- time series: stacked columns and lines ----------
   labels: one per period; series: [{name, values, color}]. Every period has a
   wide invisible hit area carrying the whole period's numbers, so hovering
   anywhere in a column reads all series at once. */
const wideW = () => clamp(Math.round(document.documentElement.clientWidth - 110), 300, 1180);
const legendHTML = series => `<div class="legend-row small viz-legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
function periodTicks(n, W) { const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(W / 74)))); return i => i % step === 0; }
function stackSVG(labels, series, o = {}) {
  const fmt = o.fmt || (v => String(v)), n = labels.length, W = o.w || wideW(), H = o.h || 250, L = 54, R = 12, T = 16, B = 40;
  const totals = labels.map((_, i) => series.reduce((s, x) => s + (x.values[i] || 0), 0));
  const t = niceTicks(0, Math.max(1, ...totals)), top = t[t.length - 1];
  const Y = v => T + (top - v) / top * (H - T - B), slot = (W - L - R) / n, bw = Math.max(1, Math.min(44, slot * 0.72));
  const show = periodTicks(n, W - L - R), cap = Math.min(1, 30 / n);
  return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Stacked columns')}">
    ${t.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${v === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'}"/>${vzText(L - 8, Y(v) + 4, (o.tick || fmt)(v), { a: 'end' })}`).join('')}
    ${labels.map((lab, i) => {
      let acc = 0; const cx = L + slot * i + slot / 2;
      const segs = series.map(s => { const v = s.values[i] || 0; if (!v) return ''; const y0 = Y(acc), y1 = Y(acc + v); acc += v; return `<rect x="${(cx - bw / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.5, y0 - y1 - (bw > 6 ? 1 : 0)).toFixed(1)}" fill="${s.color}" rx="${bw > 8 ? 1.5 : 0}"/>`; }).join('');
      const tip = [`${lab}${o.partial && o.partial[i] ? ` (partial: ${o.partial[i]})` : ''} · ${fmt(totals[i])} total`].concat(series.filter(s => s.values[i]).map(s => `${s.name}: ${fmt(s.values[i])} (${pct(s.values[i] / (totals[i] || 1))})`)).join('\n');
      return `<g class="vstack${o.partial && o.partial[i] ? ' partial' : ''}" style="--i:${(i * cap).toFixed(1)}">${segs}<rect class="hit" x="${(L + slot * i).toFixed(1)}" y="${T}" width="${slot.toFixed(1)}" height="${H - T - B}" fill="transparent" data-tip="${esc(tip)}" tabindex="${n <= 40 ? 0 : -1}"/></g>
        ${show(i) ? vzText(cx, H - B + 16, lab) : ''}`;
    }).join('')}
    ${o.marker != null && o.marker >= 0 && o.marker < n ? `<line x1="${(L + slot * o.marker).toFixed(1)}" x2="${(L + slot * o.marker).toFixed(1)}" y1="${T - 4}" y2="${H - B}" stroke="var(--red)" stroke-dasharray="4 3" stroke-width="1.5"/>${vzText(L + slot * o.marker + 6, T + 8, o.markerLabel || '', { a: 'start', fill: 'var(--red-ink)', font: 'var(--f-body)', w: 700 })}` : ''}
  </svg></div>${legendHTML(series)}`;
}
function lineSVG(labels, series, o = {}) {
  const fmt = o.fmt || money, n = labels.length, W = o.w || wideW(), H = o.h || 250, L = 58, R = 26, T = 16, B = 40;
  const all = series.flatMap(s => s.values), t = niceTicks(Math.min(0, ...all), Math.max(1, ...all));
  const lo = t[0], hi = t[t.length - 1], Y = v => T + (hi - v) / ((hi - lo) || 1) * (H - T - B);
  const X = i => n === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (n - 1), show = periodTicks(n, W - L - R);
  const slot = (W - L - R) / Math.max(1, n - 1);
  return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Line chart')}">
    ${t.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${v === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'}"/>${vzText(L - 8, Y(v) + 4, (o.tick || compactMoney)(v), { a: 'end' })}`).join('')}
    ${labels.map((lab, i) => show(i) ? vzText(X(i), H - B + 16, lab) : '').join('')}
    ${series.map((s, si) => `<path class="draw" pathLength="1" d="${s.values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('')}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" style="animation-delay:${si * 0.25}s"/>
      ${n <= 60 ? s.values.map((v, i) => `<circle class="lpt" cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.2" fill="${s.color}" stroke="var(--panel)" stroke-width="1.4" style="--i:${(i * Math.min(1, 24 / n)).toFixed(1)}"/>`).join('') : ''}`).join('')}
    ${labels.map((lab, i) => `<rect class="hit" x="${(X(i) - slot / 2).toFixed(1)}" y="${T}" width="${slot.toFixed(1)}" height="${H - T - B}" fill="transparent" data-tip="${esc([lab + (o.partial && o.partial[i] ? ` (partial: ${o.partial[i]})` : '')].concat(series.map(s => `${s.name}: ${fmt(s.values[i])}`)).join('\n'))}" tabindex="${n <= 40 ? 0 : -1}"/>`).join('')}
    ${o.marker != null && o.marker >= 0 && o.marker < n ? `<line x1="${X(o.marker).toFixed(1)}" x2="${X(o.marker).toFixed(1)}" y1="${T - 4}" y2="${H - B}" stroke="var(--red)" stroke-dasharray="4 3" stroke-width="1.5"/>${vzText(X(o.marker) + 6, T + 8, o.markerLabel || '', { a: 'start', fill: 'var(--red-ink)', font: 'var(--f-body)', w: 700 })}` : ''}
  </svg></div>${legendHTML(series)}`;
}
/** Side-by-side columns per period for two or three series. */
function groupSVG(labels, series, o = {}) {
  const fmt = o.fmt || money, n = labels.length, W = o.w || wideW(), H = o.h || 250, L = 58, R = 12, T = 16, B = 40;
  const all = series.flatMap(s => s.values), t = niceTicks(Math.min(0, ...all), Math.max(1, ...all));
  const lo = t[0], hi = t[t.length - 1], Y = v => T + (hi - v) / ((hi - lo) || 1) * (H - T - B);
  const slot = (W - L - R) / n, gw = Math.min(70, slot * 0.8), bw = Math.max(1, gw / series.length - 1), show = periodTicks(n, W - L - R), cap = Math.min(1, 30 / n);
  return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Grouped columns')}">
    ${t.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${v === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'}"/>${vzText(L - 8, Y(v) + 4, (o.tick || compactMoney)(v), { a: 'end' })}`).join('')}
    ${labels.map((lab, i) => { const x0 = L + slot * i + (slot - gw) / 2;
      return `<g class="vstack${o.partial && o.partial[i] ? ' partial' : ''}" style="--i:${(i * cap).toFixed(1)}">${series.map((s, si) => { const v = s.values[i] || 0, y0 = Y(0), yv = Y(v); return `<rect x="${(x0 + si * (bw + 1)).toFixed(1)}" y="${Math.min(y0, yv).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.5, Math.abs(yv - y0)).toFixed(1)}" fill="${s.color}" rx="${bw > 8 ? 1.5 : 0}"/>`; }).join('')}
        <rect class="hit" x="${(L + slot * i).toFixed(1)}" y="${T}" width="${slot.toFixed(1)}" height="${H - T - B}" fill="transparent" data-tip="${esc([lab + (o.partial && o.partial[i] ? ` (partial: ${o.partial[i]})` : '')].concat(series.map(s => `${s.name}: ${fmt(s.values[i] || 0)}`)).join('\n'))}" tabindex="${n <= 40 ? 0 : -1}"/></g>${show(i) ? vzText(L + slot * i + slot / 2, H - B + 16, lab) : ''}`; }).join('')}
  </svg></div>${legendHTML(series)}`;
}
