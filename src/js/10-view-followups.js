/* ================= Follow-ups ================= */
const FU_SECTIONS = [
  { kind: 'welcome', title: 'Say hello', hint: 'They accepted your invite. A short thank-you and one easy question.' },
  { kind: 'reconnect', title: 'Reconnect with your network', hint: 'Existing connections who match your ICP.' },
  { kind: 'fu1', title: 'Follow up', hint: 'Welcome sent, no reply yet. Add something useful.' },
  { kind: 'fu2', title: 'Last follow-up', hint: 'One polite final note, then they move to nurture.' },
];
function fuContext(l, kind) {
  const t = l.t;
  if (kind === 'welcome') return `Accepted ${fmtAgo(t.connected)}${l.inviteNote ? ' · your note: “' + trunc(l.inviteNote, 70) + '”' : ''}`;
  if (kind === 'reconnect') return `Connected ${t.connected ? fmtDate(t.connected, true) : 'a while ago'}`;
  if (kind === 'fu1') return `Welcome sent ${fmtAgo(t.welcomed)} · no reply`;
  if (kind === 'fu2') return `Follow-up sent ${fmtAgo(t.fu1)} · no reply`;
  return '';
}
function fuItemHtml(l, kind) {
  const text = l.drafts[kind] || '';
  const key = l.id + ':' + kind;
  const link = leadLink(l);
  const pending = ui.fuPending === key;
  const sc = scoreLead(l);
  return `<article class="panel fu-card">
    <div class="fu-who">
      <div class="row" style="justify-content:space-between;align-items:flex-start">${avHtml(l.name, 'lg')}${sc.score != null ? fitHtml(l) : ''}</div>
      <h3>${esc(cleanName(l.name) || l.name)}</h3>
      <div class="hint" style="color:var(--ink-2)">${esc([l.title, l.company].filter(Boolean).join(' · '))}</div>
      <div class="hint">${esc(fuContext(l, kind))}</div>
      <div class="row" style="margin-top:4px"><button class="btn btn-sm btn-ghost" data-act="open-lead" data-id="${l.id}">${ic('users')} Details</button></div>
    </div>
    <div class="fu-body">
      <span class="pc-label">${esc(MSG_KINDS[kind])}</span>
      ${busyHtml('fu-' + key)}
      <div class="composer">
        <label class="sr-only" for="fu-${l.id}-${kind}">${esc(MSG_KINDS[kind])} for ${esc(l.name)}</label>
        <textarea id="fu-${l.id}-${kind}" data-input="lead-draft" data-kind="${kind}" data-id="${l.id}" style="min-height:96px" placeholder="Write the message, or let AI or a template draft it.">${esc(text)}</textarea>
        <div class="composer-bar">
          ${aiBtn('ai-fu-one', l.id, text ? 'Redraft' : 'Draft with AI', `data-kind="${kind}"`)}
          <button class="btn btn-sm" data-act="tpl-fu-one" data-id="${l.id}" data-kind="${kind}">Template</button>
          ${countHtml(`fu-${l.id}-${kind}`, text.length, 8000)}
        </div>
      </div>
      <div class="send-row" style="margin-top:0">
        ${pending ? `<div class="confirm"><b>Sent it on LinkedIn?</b>
            <button class="btn btn-primary btn-sm" data-act="fu-sent" data-id="${l.id}" data-kind="${kind}">Yes, mark as sent</button>
            <button class="btn btn-sm" data-act="fu-unsent">Not yet</button></div>`
          : `${sendLink(link.href, 'send-fu', l.id, `Copy & open ${link.label}`, !text.trim(), `data-kind="${kind}"`)}
            <button class="btn" data-act="lead-replied" data-id="${l.id}">They replied</button>
            <button class="btn btn-ghost" data-act="lead-stage" data-id="${l.id}" data-stage="lost">Not interested</button>
            <button class="btn btn-ghost" data-act="lead-snooze" data-id="${l.id}">Snooze 3 days</button>`}
      </div>
    </div>
  </article>`;
}
VIEW_FN.followups = function () {
  if (!S.meta) return VIEW_FN.today();
  const d = dueLists(); const p = P();
  const sendable = FU_SECTIONS.reduce((n, s) => n + d[s.kind].length, 0);
  const missing = FU_SECTIONS.flatMap((s) => d[s.kind].filter((l) => !String(l.drafts[s.kind] || '').trim()).map((l) => [l, s.kind]));
  const total = sendable + d.nudge.length + d.withdraw.length + d.nurture.length;
  const sections = FU_SECTIONS.filter((s) => d[s.kind].length).map((s) => `
    <div class="sec"><div class="sec-h"><h2>${s.title}<span class="n">${d[s.kind].length}</span></h2><p class="hint">${s.hint}</p></div>
      <div class="stack">${d[s.kind].map((l) => fuItemHtml(l, s.kind)).join('')}</div></div>`).join('');
  const nudges = d.nudge.length ? `<div class="sec"><div class="sec-h"><h2>Nudge a quiet conversation<span class="n">${d.nudge.length}</span></h2><p class="hint">You replied and they went quiet.</p></div>
    <div class="panel q-list">${d.nudge.map((c) => `<div class="q-row" style="cursor:default">${avHtml(c.name)}<span class="min0"><span class="nm">${esc(cleanName(c.name))}</span> ${catChip(c)}<span class="pv" style="display:block">You replied ${esc(fmtAgo((c.sent || [])[c.sent.length - 1] || c.updatedAt))}</span></span>
      <span class="row"><button class="btn btn-sm" data-act="nudge-open" data-id="${c.id}">Write a nudge</button><button class="btn btn-sm btn-ghost" data-act="convo-done" data-id="${c.id}">Close it</button></span></div>`).join('')}</div></div>` : '';
  const withdraw = d.withdraw.length ? `<div class="sec"><div class="sec-h"><h2>Withdraw old invites<span class="n">${d.withdraw.length}</span></h2>
      <a class="btn btn-sm" href="${LI.sent}" target="_blank" rel="noopener noreferrer">Open sent invitations ${ic('ext')}</a></div>
    <p class="hint" style="margin-bottom:10px">Unanswered invites older than ${p.cadence.withdraw} days count against you. Withdraw them on LinkedIn, then mark them here. LinkedIn blocks re-inviting the same person for about three weeks.</p>
    <div class="panel q-list">${d.withdraw.map((l) => `<div class="q-row" style="cursor:default">${avHtml(l.name)}<span class="min0"><span class="nm">${esc(cleanName(l.name))}</span> <span class="muted">${esc(l.company || '')}</span><span class="pv" style="display:block">Invited ${esc(fmtDate(l.t.invited, true))}</span></span>
      <span class="row"><button class="btn btn-sm" data-act="lead-withdrawn" data-id="${l.id}">Mark withdrawn</button><button class="btn btn-sm btn-ghost" data-act="lead-accepted" data-id="${l.id}">They accepted</button></span></div>`).join('')}</div></div>` : '';
  const nurture = d.nurture.length ? `<div class="sec"><div class="sec-h"><h2>Move to nurture<span class="n">${d.nurture.length}</span></h2><button class="btn btn-sm" data-act="nurture-all">Move all to nurture</button></div>
    <p class="hint" style="margin-bottom:10px">No reply after the final follow-up. Stop messaging; like or comment on their posts now and then instead.</p>
    <div class="panel q-list">${d.nurture.map((l) => `<div class="q-row" style="cursor:default">${avHtml(l.name)}<span class="min0"><span class="nm">${esc(cleanName(l.name))}</span> <span class="muted">${esc(l.company || '')}</span></span><button class="btn btn-sm" data-act="lead-stage" data-id="${l.id}" data-stage="nurture">Nurture</button></div>`).join('')}</div></div>` : '';
  return `
  ${pageHead('Follow-ups', 'Keep things <em>moving</em>', `Follow up ${p.cadence.fu1} days after the welcome, with a final note ${p.cadence.fu2} days later. Change the timing in Settings.`,
    missing.length ? (AI.on ? `<button class="btn btn-send" data-act="ai-fu-batch" ${ui.busy ? 'disabled' : ''}>${ic('sparkle')} Draft ${missing.length} messages</button>` : '') + `<button class="btn" data-act="tpl-fu-batch">${ic('file')} Fill ${missing.length} from templates</button>` : '')}
  ${busyHtml('followups')}
  ${total ? sections + nudges + withdraw + nurture : emptyHtml('Nothing due right now', 'When people accept your invites, welcome messages show up here, followed by timed follow-ups. Conversations you replied to come back here if they go quiet.', `<button class="btn" data-act="check-accepts">${ic('check')} Check who accepted</button><button class="btn" data-act="go" data-view="invites">Go to invites</button>`)}`;
};
