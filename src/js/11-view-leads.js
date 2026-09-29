/* ================= Leads ================= */
const PAGE_SIZE = 50;
function lastTouch(l) { const v = Object.values(l.t || {}).filter(Boolean).sort(); return v[v.length - 1] || ''; }
function nextStep(l) {
  const d = leadDue(l); const c = P().cadence;
  if (d) return { welcome: 'Say hello', reconnect: 'Reconnect', fu1: 'Follow up now', fu2: 'Final follow-up now', nurture: 'Move to nurture', withdraw: 'Withdraw invite' }[d.kind];
  switch (l.stage) {
    case 'new': return 'Queue an invite';
    case 'queued': return 'Send invite';
    case 'invited': return `Waiting · ${fmtDays(daysSince(l.t.invited))}`;
    case 'messaged': return l.t.fu1 ? `Final note in ${fmtDays(c.fu2 - daysSince(l.t.fu1))}` : `Follow up in ${fmtDays(c.fu1 - daysSince(l.t.welcomed))}`;
    case 'replied': return 'Reply in inbox';
    case 'meeting': return l.meetingAt ? `Meeting ${fmtDate(l.meetingAt)}` : 'Meeting booked';
    default: return '—';
  }
}
function leadsFiltered() {
  const q = norm(ui.leadsQ);
  let list = S.leads().filter((l) => (ui.leadsStage === 'all' || l.stage === ui.leadsStage)
    && (ui.leadsIcp === 'all' || (l.icpId || icps()[0]?.id) === ui.leadsIcp)
    && (!q || norm([l.name, l.title, l.company, l.location, (l.tags || []).join(' ')].join(' ')).includes(q)));
  const by = ui.leadsSort;
  list.sort((a, b) => by === 'fit' ? (scoreLead(b).score ?? -1) - (scoreLead(a).score ?? -1) || String(b.t.added).localeCompare(String(a.t.added))
    : by === 'newest' ? String(b.t.added).localeCompare(String(a.t.added))
      : by === 'touch' ? lastTouch(b).localeCompare(lastTouch(a))
        : cleanName(a.name).localeCompare(cleanName(b.name)));
  return list;
}
VIEW_FN.leads = function () {
  if (!S.meta) return VIEW_FN.today();
  const all = S.leads();
  if (!all.length) {
    return `${pageHead('Leads', 'Your <em>pipeline</em>', 'Everyone you plan to reach, and where they stand.')}
    <div class="empty"><div class="empty-art">${artEnvelope()}</div><div class="min0"><h3>No leads yet</h3><p>Add the people you want to reach. Each one gets an ICP fit score, a drafted note and a place in your daily plan.</p>
      <div class="row">
        <button class="btn btn-send" data-act="add-leads" data-tab="one">${ic('plus')} Add one lead</button>
        <button class="btn" data-act="add-leads" data-tab="paste">${ic('paste')} Paste a list</button>
        <button class="btn" data-act="add-leads" data-tab="csv">${ic('upload')} Import a CSV</button>
        <button class="btn" data-act="open-import" data-kind="connections">${ic('users')} Find ICP matches in my connections</button>
      </div><div class="divider"></div><div class="card-h"><h3>Where to find them</h3></div>${recipeHtml(icps()[0])}</div></div>`;
  }
  const counts = {}; for (const l of all) counts[l.stage] = (counts[l.stage] || 0) + 1;
  const list = leadsFiltered();
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  ui.leadsPage = clamp(ui.leadsPage, 0, pages - 1);
  const page = list.slice(ui.leadsPage * PAGE_SIZE, (ui.leadsPage + 1) * PAGE_SIZE);
  for (const id of [...ui.picked]) if (!S.lead(id)) ui.picked.delete(id);
  const allOnPage = page.length && page.every((l) => ui.picked.has(l.id));
  const stageChips = `<button class="chip" data-act="leads-stage" data-stage="all" aria-pressed="${ui.leadsStage === 'all'}">All <span class="n">${all.length}</span></button>`
    + STAGES.filter((s) => counts[s.id]).map((s) => `<button class="chip" data-act="leads-stage" data-stage="${s.id}" aria-pressed="${ui.leadsStage === s.id}">${esc(s.label)} <span class="n">${counts[s.id]}</span></button>`).join('');
  const bulk = ui.picked.size ? `<div class="bulk" role="region" aria-label="Bulk actions"><b>${ui.picked.size} selected</b>
      <button class="btn btn-sm" data-act="bulk-queue">${ic('userplus')} Queue invites</button>
      <label class="sr-only" for="bulk-stage">Set stage</label><select class="select" id="bulk-stage" data-change="bulk-stage"><option value="">Set stage…</option>${STAGES.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select>
      ${icps().length > 1 ? `<label class="sr-only" for="bulk-icp">Set ICP</label><select class="select" id="bulk-icp" data-change="bulk-icp"><option value="">Set ICP…</option>${icps().map((i) => `<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select>` : ''}
      <button class="btn btn-sm" data-act="bulk-export">${ic('download')} Export</button>
      <button class="btn btn-sm" data-act="bulk-delete">${ic('trash')} Delete</button>
      <span class="spacer"></span><button class="btn btn-sm" data-act="bulk-clear">Clear</button></div>` : '';
  const rows = page.map((l) => `
    <tr class="click" data-act="open-lead" data-id="${l.id}">
      <td style="width:36px"><label class="sr-only" for="pick-${l.id}">Select ${esc(l.name)}</label><input type="checkbox" id="pick-${l.id}" data-change="pick" data-id="${l.id}" ${ui.picked.has(l.id) ? 'checked' : ''}></td>
      <td class="min0"><div class="who">${avHtml(l.name, 'sm')}<div class="min0"><div class="nm">${esc(cleanName(l.name) || l.name)}</div><div class="sub2">${esc(trunc(l.title || '', 60))}</div></div></div></td>
      <td><div>${esc(trunc(l.company || '', 40))}</div><div class="sub2">${esc([l.companySize && l.companySize + ' staff', l.location].filter(Boolean).join(' · '))}</div></td>
      <td>${stagePill(l.stage)}</td>
      <td>${fitHtml(l)}</td>
      <td class="nowrap sub2">${esc(fmtAgo(lastTouch(l)))}</td>
      <td class="nowrap">${esc(nextStep(l))}</td>
    </tr>`).join('');
  return `
  ${pageHead('Leads', 'Your <em>pipeline</em>', `${plural(all.length, 'lead')}. Click a row for details, drafts and history.`, `<button class="btn btn-ghost" data-act="open-import" data-kind="connections">${ic('users')} Mine my connections</button>
      <button class="btn btn-ghost" data-act="export-leads">${ic('download')} Export CSV</button>
      <button class="btn btn-send" data-act="add-leads">${ic('plus')} Add leads</button>`)}
  <div class="stagebar chips" role="toolbar" aria-label="Filter by stage">${stageChips}</div>
  <div class="filters">
    <label class="sr-only" for="leads-q">Search leads</label><input class="input grow" id="leads-q" type="search" data-input="leads-q" placeholder="Search name, title, company, tag" value="${esc(ui.leadsQ)}">
    ${icps().length > 1 ? `<label class="sr-only" for="leads-icp">ICP</label><select class="select" id="leads-icp" data-change="leads-icp"><option value="all">All ICPs</option>${icps().map((i) => `<option value="${i.id}" ${ui.leadsIcp === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</select>` : ''}
    <label class="sr-only" for="leads-sort">Sort</label><select class="select" id="leads-sort" data-change="leads-sort">${optionList({ fit: 'Best fit first', newest: 'Newest first', touch: 'Recently touched', name: 'Name A to Z' }, ui.leadsSort)}</select>
  </div>
  ${bulk}
  <div class="tbl-wrap"><table class="tbl">
    <thead><tr><th><label class="sr-only" for="pick-page">Select this page</label><input type="checkbox" id="pick-page" data-change="pick-page" ${allOnPage ? 'checked' : ''}></th><th>Name</th><th>Company</th><th>Stage</th><th>Fit</th><th>Last touch</th><th>Next step</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="7" class="muted" style="padding:20px">No leads match these filters.</td></tr>`}</tbody>
  </table></div>
  ${pages > 1 ? `<div class="pager"><span class="tnum">${ui.leadsPage * PAGE_SIZE + 1}–${Math.min(list.length, (ui.leadsPage + 1) * PAGE_SIZE)} of ${list.length}</span><span class="row"><button class="btn btn-sm" data-act="leads-page" data-d="-1" ${ui.leadsPage ? '' : 'disabled'}>${ic('chevL')} Previous</button><button class="btn btn-sm" data-act="leads-page" data-d="1" ${ui.leadsPage < pages - 1 ? '' : 'disabled'}>Next ${ic('chevR')}</button></span></div>` : ''}`;
};

function leadDrawerHtml(l) {
  const sc = scoreLead(l); const link = leadLink(l);
  const f = (field, label, attrs = '') => `<div class="field"><label for="lf-${field}">${label}</label><input class="input" id="lf-${field}" data-input="lead-field" data-field="${field}" data-id="${l.id}" value="${esc(l[field] || '')}" ${attrs}></div>`;
  const stageBtns = {
    new: `<button class="btn btn-primary btn-sm" data-act="lead-queue" data-id="${l.id}">${ic('userplus')} Queue invite</button>`,
    queued: `<button class="btn btn-primary btn-sm" data-act="lead-to-invite" data-id="${l.id}">Open in invites</button><button class="btn btn-sm" data-act="inv-remove" data-id="${l.id}">Remove from queue</button>`,
    invited: `<button class="btn btn-primary btn-sm" data-act="lead-accepted" data-id="${l.id}">${ic('check')} They accepted</button><button class="btn btn-sm" data-act="lead-withdrawn" data-id="${l.id}">Mark withdrawn</button>`,
    connected: `<button class="btn btn-primary btn-sm" data-act="go" data-view="followups">Say hello</button>`,
    messaged: `<button class="btn btn-primary btn-sm" data-act="lead-replied" data-id="${l.id}">They replied</button><button class="btn btn-sm" data-act="lead-stage" data-id="${l.id}" data-stage="lost">Not interested</button>`,
    replied: `<button class="btn btn-primary btn-sm" data-act="lead-stage" data-id="${l.id}" data-stage="meeting">${ic('calendar')} Meeting booked</button>${l.convoId && S.convo(l.convoId) ? `<button class="btn btn-sm" data-act="open-convo" data-id="${l.convoId}">Open conversation</button>` : ''}`,
    meeting: `<button class="btn btn-primary btn-sm" data-act="lead-stage" data-id="${l.id}" data-stage="won">${ic('star')} Won</button><button class="btn btn-sm" data-act="lead-stage" data-id="${l.id}" data-stage="lost">Not interested</button>`,
  }[l.stage] || `<button class="btn btn-sm" data-act="lead-stage" data-id="${l.id}" data-stage="new">Reopen</button>`;
  const tl = [['added', 'Added'], ['queued', 'Queued'], ['invited', 'Invited'], ['connected', 'Accepted'], ['welcomed', 'Welcomed'], ['fu1', 'Followed up'], ['fu2', 'Final follow-up'], ['replied', 'Replied'], ['meeting', 'Meeting'], ['withdrawn', 'Withdrawn'], ['nurtured', 'To nurture'], ['closed', 'Closed']]
    .filter(([k]) => l.t[k]).sort((a, b) => String(l.t[a[0]]).localeCompare(String(l.t[b[0]])));
  const kinds = ['invite', 'welcome', 'fu1', 'fu2', 'reconnect'].filter((k) => l.drafts[k]);
  return `
  <div class="drawer-h">
    ${avHtml(l.name, 'lg')}
    <div class="min0" style="flex:1">
      <h2>${esc(cleanName(l.name) || l.name || 'Unnamed lead')}</h2>
      <div class="sub" style="margin-top:3px">${esc([l.title, l.company].filter(Boolean).join(' · '))}</div>
      <div class="row" style="margin-top:9px">${stagePill(l.stage)}${fitHtml(l)}<a class="btn btn-sm" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer">${link.direct ? 'Open ' + esc(link.label) : 'Find on LinkedIn'} ${ic('ext')}</a></div>
    </div>
    <button class="btn btn-ghost btn-icon" data-act="drawer-close" aria-label="Close details">${ic('x')}</button>
  </div>
  <div class="drawer-b">
    <div class="row">${stageBtns}<span class="spacer"></span><label class="sr-only" for="lf-stage">Stage</label><select class="select" id="lf-stage" data-change="lead-stage-sel" data-id="${l.id}" style="width:auto">${STAGES.map((s) => `<option value="${s.id}" ${s.id === l.stage ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></div>
    ${sc.reasons.length ? `<div class="reasons" style="margin-top:0">${sc.reasons.map((r) => `<span class="pill plain">${esc(r)}</span>`).join('')}</div>` : ''}
    <div class="grid2">
      ${f('name', 'Name', 'required')}${f('first', 'Goes by', `placeholder="${esc(firstName(l.name))}"`)}
      ${f('title', 'Title')}${f('company', 'Company')}
      <div class="field"><label for="lf-companySize">Company size</label><input class="input" id="lf-companySize" list="size-bands" data-input="lead-field" data-field="companySize" data-id="${l.id}" value="${esc(l.companySize || '')}" placeholder="e.g. 11-50"><datalist id="size-bands">${SIZE_BANDS.map((s) => `<option value="${s}"></option>`).join('')}</datalist></div>
      ${f('industry', 'Industry')}${f('location', 'Location')}
      ${f('url', 'LinkedIn profile link', 'placeholder="https://www.linkedin.com/in/…"')}
      ${icps().length ? `<div class="field"><label for="lf-icp">ICP</label><select class="select" id="lf-icp" data-change="lead-icp" data-id="${l.id}">${icps().map((i) => `<option value="${i.id}" ${(l.icpId || icps()[0].id) === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</select></div>` : ''}
      ${f('email', 'Email', 'type="email"')}
    </div>
    <div class="field"><label for="lf-about">What you know about them</label><textarea class="textarea" id="lf-about" data-input="lead-field" data-field="about" data-id="${l.id}" placeholder="Paste their headline, a line from their About section, or a recent post.">${esc(l.about)}</textarea><span class="hint">Drafts use this for a personal detail. Nothing is invented beyond it.</span></div>
    <div class="field"><label for="lf-notes">Your notes</label><textarea class="textarea" id="lf-notes" data-input="lead-field" data-field="notes" data-id="${l.id}" style="min-height:70px">${esc(l.notes)}</textarea></div>
    <div class="field"><span class="lbl">Tags</span>${tagInput('lf-tags', l.tags, 'lead:' + l.id + ':tags', 'Add a tag, then Enter')}</div>
    ${kinds.length ? `<div class="stack" style="gap:8px"><span class="lbl">Messages</span>${kinds.map((k) => `<div class="callout" style="display:grid;gap:6px"><div class="row" style="justify-content:space-between"><span class="pc-label">${esc(MSG_KINDS[k])}</span><button class="btn btn-sm btn-ghost" data-act="copy" data-text="${esc(l.drafts[k])}">${ic('copy')} Copy</button></div><div style="white-space:pre-wrap">${esc(l.drafts[k])}</div></div>`).join('')}</div>` : ''}
    ${tl.length ? `<div><span class="lbl">History</span><div class="timeline" style="margin-top:6px">${tl.map(([k, lab]) => `<div><span>${esc(fmtDate(l.t[k], true))}</span><span>${esc(lab)}${k === 'invited' && l.inviteStyle ? ` · ${esc(NOTE_STYLES[l.inviteStyle]?.label || 'template')}` : ''}</span></div>`).join('')}</div></div>` : ''}
    <div class="row"><button class="btn btn-sm btn-danger" data-act="lead-delete" data-id="${l.id}">${ic('trash')} Delete lead</button><span class="hint">Source: ${esc(l.source || 'manual')}</span></div>
  </div>`;
}
