/* ================= Insights ================= */
ui.tables = ui.tables || {};
const _charts = {};
AFTER.insights = () => { for (const el of $$('[data-colchart]')) { const d = _charts[el.dataset.colchart]; if (d) el.innerHTML = columnChart(d.data, d.unit, Math.max(260, Math.round(el.clientWidth || 600))); } };
window.addEventListener('resize', debounce(() => { if (ui.view === 'insights') AFTER.insights(); }, 150));
function niceScale(maxV) {
  let mag = 1;
  for (;;) {
    for (const s of [1, 2, 5]) { const st = s * mag; if (Math.ceil(maxV / st) <= 5) return { max: Math.max(st, Math.ceil(maxV / st) * st), step: st }; }
    mag *= 10;
  }
}
function chartCard(id, title, sub, chart, table) {
  const showTable = !!ui.tables[id];
  return `<section class="panel chart-card" aria-labelledby="ch-${id}">
    <div class="chart-foot"><h3 id="ch-${id}">${title}</h3><button class="btn btn-sm btn-ghost" data-act="chart-table" data-id="${id}" aria-pressed="${showTable}">${showTable ? 'Chart' : 'Table'}</button></div>
    ${sub ? `<p class="cs">${sub}</p>` : ''}
    ${showTable ? table : chart}
  </section>`;
}
function tableHtml(head, rows) {
  return `<div class="tbl-wrap" style="border-radius:8px"><table class="tbl"><thead><tr>${head.map((h, i) => `<th class="${i ? 'num' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function columnChart(data, unit, W = 600) {
  const H = 230, ml = 34, mr = 10, mt = 18, mb = 30;
  const pw = W - ml - mr, ph = H - mt - mb;
  const maxV = Math.max(0, ...data.map((d) => d.v));
  const { max, step } = niceScale(maxV);
  const n = data.length; const band = pw / n; const bw = Math.min(24, band * 0.62);
  const every = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(pw / 62))));
  const iMax = data.reduce((bi, d, i) => (d.v > data[bi].v ? i : bi), 0);
  let grid = '';
  for (let v = 0; v <= max; v += step) { const y = mt + ph - (v / max) * ph; grid += `<line x1="${ml}" x2="${W - mr}" y1="${y}" y2="${y}"/><text x="${ml - 8}" y="${y + 4}" text-anchor="end">${v}</text>`; }
  const bars = data.map((d, i) => {
    const h = (d.v / max) * ph; const x = ml + i * band + (band - bw) / 2; const y = mt + ph - h; const r = Math.min(4, h, bw / 2);
    const path = h > 0 ? `M${x},${mt + ph}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${mt + ph}Z` : '';
    const lbl = ((i % every === 0 && n - 1 - i >= every * 0.7) || i === n - 1) ? `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(d.label)}</text>` : '';
    const val = d.v && (i === iMax || i === n - 1) ? `<text class="val" x="${x + bw / 2}" y="${y - 6}" text-anchor="middle">${d.v}</text>` : '';
    return `<g><rect class="hit" x="${ml + i * band}" y="${mt}" width="${band}" height="${ph}" tabindex="0" data-tip="${esc(d.label)}" data-val="${d.v} ${esc(unit)}" data-x="${((x + bw / 2) / W) * 100}" data-y="${(Math.min(y, mt + ph - 2) / H) * 100}"/>${path ? `<path class="bar" d="${path}"/>` : ''}${val}${lbl}</g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Column chart of invites sent">
    <g class="grid">${grid}</g><line x1="${ml}" x2="${W - mr}" y1="${mt + ph}" y2="${mt + ph}" style="stroke:var(--line-2)"/>${bars}</svg>`;
}
function hbarChart(rows, fmt) {
  if (!rows.length) return '';
  const max = Math.max(1, ...rows.map((r) => r.v));
  return `<div class="stack" style="gap:10px">${rows.map((r) => `
    <div style="display:grid;grid-template-columns:minmax(90px,34%) minmax(0,1fr);gap:10px;align-items:center">
      <span style="font-size:12.5px;color:var(--ink-2)">${esc(r.label)}</span>
      <div style="display:flex;align-items:center;gap:8px;min-width:0" data-tip="${esc(r.label)}" data-val="${esc(r.tip || fmt(r.v))}" tabindex="0">
        <span style="display:block;height:14px;border-radius:0 4px 4px 0;background:var(--series);width:${Math.max(r.v ? 2 : 0, (r.v / max) * 82)}%"></span>
        <span class="mono tnum" style="font-size:12px;color:var(--ink-2);white-space:nowrap">${esc(fmt(r.v))}${r.note ? ` <span class="muted">${esc(r.note)}</span>` : ''}</span>
      </div>
    </div>`).join('')}</div>`;
}
VIEW_FN.insights = function () {
  if (!S.meta) return VIEW_FN.today();
  const days = ui.days;
  const s = statsFor(days);
  const periods = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [0, 'All time']];
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '–');
  const series = seriesInvites(days);
  const funnel = [
    { label: 'Leads added', v: s.added }, { label: 'Invited', v: s.invited }, { label: 'Accepted', v: s.accepted, note: s.invited ? pct(s.accepted, s.invited) + ' of invited' : '' },
    { label: 'Messaged', v: s.welcomed }, { label: 'Replied', v: s.replied, note: s.welcomed ? pct(s.repliedLeads, s.welcomed) + ' of messaged' : '' }, { label: 'Meetings', v: s.meetings },
  ];
  const styles = Object.entries(s.byStyle).map(([k, v]) => ({ label: NOTE_STYLES[k]?.label || (k === 'template' ? 'Template or manual' : k), v: v.n ? Math.round((v.acc / v.n) * 100) : 0, note: `${v.n} sent`, tip: `${v.acc} of ${v.n} accepted` })).sort((a, b) => b.v - a.v);
  const open = S.convos().filter((c) => c.status === 'open');
  const byCat = Object.entries(open.reduce((m, c) => { m[c.category] = (m[c.category] || 0) + 1; return m; }, {})).map(([k, v]) => ({ label: CATS[k]?.label || k, v })).sort((a, b) => b.v - a.v).slice(0, 8);
  const periodLabel = periods.find((x) => x[0] === days)?.[1].toLowerCase() || '';
  return `${pageHead('Insights', 'What\'s <em>working</em>', 'Numbers come from what you mark as sent, accepted and replied.')}
  <div class="chips" style="margin-bottom:16px" role="toolbar" aria-label="Time range">${periods.map(([d, l]) => `<button class="chip" data-act="days" data-d="${d}" aria-pressed="${days === d}">${l}</button>`).join('')}</div>
  <div class="kpis" style="margin-bottom:16px">
    <div class="kpi"><span class="kpi-l">Invites sent</span><span class="kpi-v">${s.invited}</span><span class="kpi-d">${periodLabel}</span></div>
    <div class="kpi"><span class="kpi-l">Acceptance rate</span><span class="kpi-v">${pct(s.accepted, s.invited)}</span><span class="kpi-d">${s.accepted} accepted</span></div>
    <div class="kpi"><span class="kpi-l">Reply rate</span><span class="kpi-v">${pct(s.repliedLeads, s.welcomed)}</span><span class="kpi-d">${s.welcomed} messaged after accepting</span></div>
    <div class="kpi"><span class="kpi-l">Replies you sent</span><span class="kpi-v">${s.repliesSent}</span><span class="kpi-d">from the inbox</span></div>
    <div class="kpi"><span class="kpi-l">Meetings</span><span class="kpi-v">${s.meetings}</span><span class="kpi-d">${s.won} won</span></div>
  </div>
  <div class="charts">
    ${chartCard('inv', 'Invites sent', series.some((d) => d.week) ? 'Per week' : 'Per day', series.some((d) => d.v) ? ((_charts.inv = { data: series, unit: 'invites' }), '<div class="chart" data-colchart="inv"></div>') : `<p class="muted">No invites in this period yet.</p>`, tableHtml([series.some((d) => d.week) ? 'Week of' : 'Day', 'Invites'], series.map((d) => [d.label, d.v])))}
    ${chartCard('fun', 'Funnel', 'How far people get', funnel.some((f) => f.v) ? hbarChart(funnel, (v) => String(v)) : `<p class="muted">Add leads and send invites to fill the funnel.</p>`, tableHtml(['Stage', 'People'], funnel.map((f) => [f.label, f.v])))}
    ${chartCard('sty', 'Acceptance by note style', 'Turn on “Test styles against each other” in Invites to compare', styles.length ? hbarChart(styles, (v) => v + '%') : `<p class="muted">No invites sent in this period.</p>`, tableHtml(['Style', 'Accepted', 'Sent'], Object.entries(s.byStyle).map(([k, v]) => [NOTE_STYLES[k]?.label || 'Template or manual', v.acc, v.n])))}
    ${chartCard('cat', 'Open conversations', 'By type, right now', byCat.length ? hbarChart(byCat, (v) => String(v)) : `<p class="muted">No open conversations.</p>`, tableHtml(['Type', 'Open'], byCat.map((b) => [b.label, b.v])))}
  </div>`;
};
