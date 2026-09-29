/* ================= Invites ================= */
function queueSorted() {
  return S.leads().filter((l) => l.stage === 'queued')
    .sort((a, b) => (scoreLead(b).score ?? -1) - (scoreLead(a).score ?? -1) || String(a.t.queued).localeCompare(String(b.t.queued)));
}
function recipeHtml(icp, compact) {
  if (!icp) return `<p class="hint">Create an ICP to get a ready-made Sales Navigator search.</p>`;
  const r = icpRecipe(icp);
  return `<div class="recipe">
    <ol>
      <li>Open Sales Navigator → <b>Lead filters</b>.</li>
      ${icp.industries?.length ? `<li><b>Industry:</b> ${esc(icp.industries.slice(0, 4).join(', '))}${icp.industries.length > 4 ? '…' : ''}</li>` : ''}
      ${icp.sizes?.length ? `<li><b>Company headcount:</b> ${esc(icp.sizes.join(', '))}</li>` : ''}
      <li><b>Seniority level:</b> Owner / Partner, CXO${icp.titles?.some((t) => /\b(director|vp|vice president|head)\b/i.test(t) && !/managing director/i.test(t)) ? ', Director, VP' : ''}</li>
      ${icp.locations?.length ? `<li><b>Geography:</b> ${esc(icp.locations.join(', '))}</li>` : ''}
      <li><b>Spotlights:</b> “Posted on LinkedIn in past 30 days”. Active people accept more often.</li>
      ${!compact && r.bool ? `<li><b>Current job title</b>, paste this:</li>` : ''}
    </ol>
    ${!compact && r.bool ? `<div class="code">${esc(r.bool)}</div><div class="row"><button class="btn btn-sm" data-act="copy" data-text="${esc(r.bool)}">${ic('copy')} Copy title search</button></div>` : ''}
  </div>`;
}
VIEW_FN.invites = function () {
  if (!S.meta) return VIEW_FN.today();
  const p = P(); const b = budget(); const limit = noteLimit(); const tz = p.limits.tz || guessTz(); const today = tzKey(Date.now(), tz);
  const all = S.leads();
  const queue = queueSorted();
  const now = new Date();
  const ready = queue.filter((l) => !l.skipUntil || new Date(l.skipUntil) <= now);
  const later = queue.filter((l) => l.skipUntil && new Date(l.skipUntil) > now);
  const sentToday = all.filter((l) => l.t.invited && tzKey(l.t.invited, tz) === today).sort((a, x) => String(x.t.invited).localeCompare(String(a.t.invited)));
  const pending = all.filter((l) => l.stage === 'invited');
  const fresh = all.filter((l) => l.stage === 'new' && !scoreLead(l).excluded);
  let cur = ui.invCur && S.lead(ui.invCur);
  if (!cur || cur.stage !== 'queued') cur = ready[0] || null;
  if (cur) ui.invCur = cur.id;
  const noDraft = queue.filter((l) => !String(l.drafts.invite || '').trim());
  const style = S.meta.ai.style || 'peer';

  const toolbar = `
    <div class="row" style="margin-bottom:16px">
      ${noDraft.length ? (AI.on ? `<button class="btn btn-send" data-act="ai-invite-batch" ${ui.busy ? 'disabled' : ''}>${ic('sparkle')} Draft ${noDraft.length} ${noDraft.length === 1 ? 'note' : 'notes'}</button>` : '') + `<button class="btn" data-act="tpl-invite-batch">${ic('file')} Fill ${noDraft.length} from templates</button>` : ''}
      ${AI.on ? `<label class="sr-only" for="inv-style">Note style</label><select class="select" id="inv-style" data-change="ai-style" style="width:auto">${optionList(Object.fromEntries(Object.entries(NOTE_STYLES).map(([k, v]) => [k, 'Style: ' + v.label])), style)}</select>
      <label class="toggle" for="inv-ab"><input type="checkbox" id="inv-ab" data-change="ai-ab" ${S.meta.ai.ab ? 'checked' : ''}> Test styles against each other</label>` : ''}
      <span class="spacer"></span>
      ${fresh.length && b.left ? `<button class="btn" data-act="queue-best" data-n="${Math.min(fresh.length, b.left)}">${ic('plus')} Queue ${Math.min(fresh.length, b.left)} best-fit</button>` : ''}
      <button class="btn" data-act="start-session" data-step="find">${ic('search')} Find people</button>
    </div>`;

  let focus = '';
  if (cur) {
    const note = cur.drafts.invite || '';
    const sc = scoreLead(cur); const link = leadLink(cur);
    const pendingSend = ui.invPending === cur.id;
    const over = note.length > limit;
    const pos = ready.findIndex((l) => l.id === cur.id) + 1;
    const rewrite = note && AI.on ? Object.entries({ shorter: 'Shorter', warmer: 'Warmer', specific: 'More specific' })
      .map(([k, v]) => `<button class="btn btn-sm btn-ghost" data-act="ai-rewrite-note" data-id="${cur.id}" data-how="${k}" ${ui.busy ? 'disabled' : ''}>${v}</button>`).join('') : '';
    focus = `
    <section class="postcard" aria-label="Invite in hand">
      <div class="postcard-in">
        <div class="pc-grid">
          <div class="pc-note">
            <div class="row" style="justify-content:space-between"><span class="pc-label">Your note${cur.style ? ` · ${esc(NOTE_STYLES[cur.style]?.label || cur.style)}` : ''}</span>${pos ? `<span class="hint">${pos} of ${ready.length} in the queue</span>` : ''}</div>
            ${busyHtml('invite-' + cur.id)}
            <label class="sr-only" for="note-${cur.id}">Connection note for ${esc(cur.name)}</label>
            <textarea class="textarea lined" id="note-${cur.id}" data-input="lead-draft" data-kind="invite" data-id="${cur.id}" data-over="${over ? '1' : '0'}" placeholder="A short, personal note. Or leave it empty to send without one.">${esc(note)}</textarea>
            <div class="pc-bar">
              ${aiBtn('ai-invite-one', cur.id, note ? 'Redraft' : 'Draft with AI')}
              <button class="btn btn-sm" data-act="tpl-invite-one" data-id="${cur.id}">${note ? 'Other template' : 'Template'}</button>
              ${rewrite}
              ${countHtml('note-' + cur.id, note.length, limit)}
            </div>
            ${over ? `<p class="hint" style="color:var(--bad)">${ic('alert')} Over LinkedIn's ${limit}-character limit for your plan. Shorten it before sending.</p>` : ''}
          </div>
          <div class="pc-to">
            ${stampSvg(sc.score)}
            <span class="pc-label">To</span>
            <h2>${esc(cleanName(cur.name) || cur.name)}</h2>
            <div class="pc-addr">
              <span>${esc(cur.title || 'No title yet')}</span>
              <span>${esc([cur.company, cur.companySize && cur.companySize + ' staff'].filter(Boolean).join(' · ') || 'No company yet')}</span>
              <span>${esc(cur.location || 'Location unknown')}</span>
            </div>
            ${sc.reasons.length ? `<div class="reasons">${sc.reasons.slice(0, 3).map((r) => `<span class="pill plain">${esc(r)}</span>`).join('')}</div>` : ''}
            <div class="row" style="margin-top:6px"><button class="btn btn-sm btn-ghost" data-act="open-lead" data-id="${cur.id}">${ic('users')} Details</button></div>
            ${cur.about ? `<details class="more"><summary>${ic('chevR')} What you know about them</summary><p class="hint" style="margin-top:6px;white-space:pre-wrap">${esc(trunc(cur.about, 900))}</p></details>` : `<p class="hint">Tip: paste a line from their profile into Details so notes can mention something specific.</p>`}
          </div>
        </div>
        <div class="pc-foot">
          ${pendingSend ? `<div class="confirm"><b>${ui.invBare ? 'Sent it without a note?' : 'Sent it on LinkedIn?'}</b>
              <button class="btn btn-primary btn-sm" data-act="inv-sent" data-id="${cur.id}">Yes, next person <span class="kbd">Enter</span></button>
              <button class="btn btn-sm" data-act="inv-unsent">Not sent</button>
              <a class="btn btn-sm btn-ghost" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer" data-act="${ui.invBare ? 'send-invite-bare' : 'send-invite'}" data-id="${cur.id}">${ui.invBare ? '' : ic('copy') + ' Copy & '}${ui.invBare ? 'Open' : 'open'} again ${ic('ext')}</a></div>`
            : `<div class="inv-choice">
                ${note.trim()
                  ? sendLink(link.href, 'send-invite', cur.id, 'Invite with this note', b.left <= 0 || over)
                  : AI.on ? `<button class="btn btn-send btn-lg" data-act="ai-invite-one" data-id="${cur.id}" ${ui.busy || b.left <= 0 ? 'disabled' : ''}>${ic('sparkle')} Write an AI note first</button>` : `<button class="btn btn-send btn-lg" data-act="tpl-invite-one" data-id="${cur.id}">${ic('file')} Fill a note from a template</button>`}
                ${b.left <= 0 ? '' : `<a class="btn btn-lg btn-bare" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer" data-act="send-invite-bare" data-id="${cur.id}">Invite without a note ${ic('ext')}</a>`}
              </div>
              <span class="spacer"></span>
              <button class="btn btn-ghost" data-act="inv-skip" data-id="${cur.id}">Skip today</button>
              <button class="btn btn-ghost" data-act="inv-remove" data-id="${cur.id}">Remove</button>`}
          <p class="hint" style="flex-basis:100%">${b.left <= 0 ? `${ic('alert')} You reached today's limit (${b.perDay} a day, ${b.perWeek} a week). The rest wait for tomorrow.` : pendingSend ? `Back already? Press <span class="kbd">Enter</span> and the next person is ready.` : `${note.trim() ? `Both buttons open their ${esc(link.label)}; the first also copies the note.` : `The AI writes the note here first, or skip it and open their ${esc(link.label)}.`} ${/\/sales\//.test(link.href) ? 'In Sales Navigator: <b>⋯</b> → <b>Connect</b>' : 'On LinkedIn: <b>Connect</b>'}${note.trim() ? ' → <b>Add a note</b> → paste → <b>Send</b>' : ' → <b>Send</b>'}. Then come back here.${link.direct ? '' : ' No profile link is saved, so this opens a LinkedIn search for them.'}`}</p>
        </div>
      </div>
    </section>`;
  }

  const qRows = ready.map((l) => {
    const n = l.drafts.invite || '';
    return `<button class="q-row" data-act="inv-pick" data-id="${l.id}" aria-current="${cur && l.id === cur.id}">
      ${avHtml(l.name)}
      <span class="min0"><span class="nm">${esc(cleanName(l.name) || l.name)}</span> <span class="muted" style="font-size:12.5px">${esc(l.company || '')}</span>
        <span class="pv">${n ? esc(n) : '<i>No note yet</i>'}</span></span>
      <span class="row" style="gap:10px">${n.length > limit ? `<span class="pill bad">Too long</span>` : ''}${fitHtml(l)}</span>
    </button>`;
  }).join('');

  return `
  ${pageHead('Invites', 'Connection <em>requests</em>', `Personal notes, sent by you. Your ${esc((ACCOUNT[p.accountType] || ACCOUNT.premium).label)} plan allows ${limit} characters a note.`, budgetHtml())}
  ${toolbar}
  ${busyHtml('invites')}
  ${cur ? focus : (fresh.length
    ? emptyHtml('Nothing queued yet', `${plural(fresh.length, 'lead is', 'leads are')} ready. Queue the best-fit ones for today, then draft their notes.`,
      b.left ? `<button class="btn btn-send" data-act="queue-best" data-n="${Math.min(fresh.length, b.left)}">Queue ${Math.min(fresh.length, b.left)} best-fit leads</button>` : '<span class="muted">Today\'s limit is used up.</span>')
    : `<div class="empty"><div class="empty-art">${artEnvelope()}</div><div class="min0"><h3>No invites queued</h3><p>Start a session: open your search, copy the results page, paste it here. The desk picks the people who match your ICP, drafts each note, and keeps you under LinkedIn's limits.</p>
        <div class="row"><button class="btn btn-send" data-act="start-session" data-step="find">${ic('search')} Find people for my ICP</button><button class="btn" data-act="add-leads">${ic('userplus')} Add leads by hand</button></div></div></div>`)}
  ${ready.length > 1 || (ready.length && !cur) ? `<div class="sec"><div class="sec-h"><h2>Queue<span class="n">${ready.length}</span></h2><p class="hint">Best fit first. Click one to work on it.</p></div><div class="panel q-list">${qRows}</div></div>` : ''}
  ${later.length ? `<div class="sec"><div class="sec-h"><h2>Skipped for today<span class="n">${later.length}</span></h2></div><div class="panel q-list">${later.map((l) => `<div class="q-row" style="cursor:default">${avHtml(l.name)}<span class="min0"><span class="nm">${esc(cleanName(l.name))}</span> <span class="muted">${esc(l.company || '')}</span></span><button class="btn btn-sm" data-act="inv-unskip" data-id="${l.id}">Back to queue</button></div>`).join('')}</div></div>` : ''}
  ${sentToday.length ? `<div class="sec"><div class="sec-h"><h2>Sent today<span class="n">${sentToday.length}</span></h2></div><div class="panel q-list">${sentToday.map((l) => `<div class="q-row" style="cursor:default">${avHtml(l.name)}<span class="min0"><span class="nm">${esc(cleanName(l.name))}</span> <span class="muted" style="font-size:12.5px">${esc(new Date(l.t.invited).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }))}</span><span class="pv">${esc(l.inviteNote || 'No note')}</span></span><button class="btn btn-sm btn-ghost" data-act="inv-undo" data-id="${l.id}">Undo</button></div>`).join('')}</div></div>` : ''}
  <div class="sec"><div class="sec-h"><h2>Waiting for an answer<span class="n">${pending.length}</span></h2>
    <div class="row">${pending.length ? `<button class="btn btn-sm" data-act="check-accepts">${ic('check')} Check who accepted</button>` : ''}<a class="btn btn-sm btn-ghost" href="${LI.sent}" target="_blank" rel="noopener noreferrer">Sent invitations ${ic('ext')}</a></div></div>
    <p class="hint">${pending.length ? `Oldest sent ${esc(fmtAgo(pending.reduce((m, l) => (!m || l.t.invited < m ? l.t.invited : m), '')))}. Invites older than ${p.cadence.withdraw} days show up in Follow-ups to withdraw.` : 'Invites you send show up here until they are accepted.'}</p>
  </div>`;
};
