/* ================= Inbox ================= */
const REWRITES = {
  shorter: 'Make it shorter and simpler.',
  warmer: 'Make it warmer and more personal.',
  formal: 'Make it more formal and polished.',
  call: 'Steer toward a short call, politely.',
  decline: 'Turn it into a polite, friendly no-thanks.',
};
function messagesHtml(c) {
  if (c.messages?.length) {
    return c.messages.slice(-12).map((m) => `<div class="msg ${m.me ? 'me' : ''}">${m.at ? `<span class="when">${m.me ? 'You' : esc(firstName(c.name) || 'Them')} · ${esc(fmtDate(m.at, true))}</span>` : ''}${esc(m.text)}</div>`).join('');
  }
  return `<div class="msg preview"><span class="when">${esc(firstName(c.name) || 'Them')} · ${esc(fmtDate(c.lastAt, true))}${c.msgCount > 1 ? ` · ${c.msgCount} messages` : ''} · preview only</span>${esc(c.preview || '(no preview saved)')}</div>`;
}
function convoDetailHtml(c) {
  const rec = recommend(c); const link = convoLink(c);
  const draft = c.draft || '';
  const pending = ui.replyPending === c.id;
  const age = daysSince(c.lastAt);
  const rewrite = draft && AI.on ? Object.entries({ shorter: 'Shorter', warmer: 'Warmer', formal: 'More formal', call: 'Ask for a call', decline: 'Polite no' })
    .map(([k, v]) => `<button class="btn btn-sm btn-ghost" data-act="ai-rewrite-reply" data-id="${c.id}" data-how="${k}" ${ui.busy ? 'disabled' : ''}>${v}</button>`).join('') : '';
  const sendLabel = !draft.trim() ? 'Write a reply first' : link.direct ? `Copy reply & open ${link.label}` : 'Copy reply & open Messaging';
  return `
  <div class="ib-head">
    <button class="btn btn-ghost btn-icon only-mobile" data-act="inbox-back" aria-label="Back to the list">${ic('chevL')}</button>
    ${avHtml(c.name, 'lg')}
    <div class="min0" style="flex:1">
      <h2>${esc(cleanName(c.name) || c.name)}</h2>
      ${c.company || c.headline ? `<div class="sub" style="margin-top:4px">${esc([c.headline, c.company].filter(Boolean).join(' · '))}</div>` : ''}
      <div class="meta-row">
        <label class="sr-only" for="cat-${c.id}">Category</label>
        <select class="select mini-select" id="cat-${c.id}" data-change="convo-cat" data-id="${c.id}">${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${k === c.category ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select>
        ${c.inmail ? '<span class="pill plain tone-lilac">InMail</span>' : ''}
        <span>Last message ${esc(fmtDate(c.lastAt, true))}${isFinite(age) ? ` · ${esc(fmtAgo(c.lastAt))}` : ''}</span>
        ${c.status !== 'open' ? `<span class="pill ${c.status === 'waiting' ? 'info' : 'good'}">${c.status === 'waiting' ? 'Waiting on them' : 'Done'}</span>` : ''}
      </div>
    </div>
  </div>
  <div class="rec ${rec.hot ? 'hot' : ''}"><span class="rec-ic">${ic(rec.hot ? 'flag' : 'sparkle')}</span><span><b>Suggested next step:</b> ${esc(rec.label)}</span></div>
  <div class="thread">${messagesHtml(c)}</div>
  ${c.partial && !c.messages?.length ? `
    <details class="more" style="margin-bottom:16px" ${c.category === 'review' ? 'open' : ''}><summary>${ic('chevR')} Paste the full conversation for a better draft</summary>
      <div class="stack" style="margin-top:12px">
        <p class="hint">Open the chat on LinkedIn, select the messages, copy, and paste them here. Opening a chat on LinkedIn marks it as read there.</p>
        <label class="sr-only" for="thread-${c.id}">Full conversation</label>
        <textarea class="textarea" id="thread-${c.id}" placeholder="Paste the conversation here"></textarea>
        <div class="row"><button class="btn btn-sm" data-act="save-thread" data-id="${c.id}">${ic('paste')} Save conversation</button></div>
      </div>
    </details>` : ''}
  ${busyHtml('reply-' + c.id)}
  <div class="composer">
    <label class="sr-only" for="reply-${c.id}">Your reply to ${esc(c.name)}</label>
    <textarea id="reply-${c.id}" data-input="convo-draft" data-id="${c.id}" placeholder="Write your reply, or let AI or a template draft it.">${esc(draft)}</textarea>
    <div class="composer-bar">
      ${aiBtn('ai-reply', c.id, draft ? 'Redraft' : 'Draft with AI')}
      <button class="btn btn-sm" data-act="tpl-reply" data-id="${c.id}">${draft ? 'Other template' : 'Use a template'}</button>
      ${rewrite}
      ${countHtml('reply-' + c.id, draft.length, 8000)}
    </div>
  </div>
  ${c.draftNote ? `<p class="hint" style="margin-top:8px">${esc(c.draftNote)}</p>` : ''}
  <div class="send-row">
    ${pending ? `<div class="confirm"><b>Sent it on LinkedIn?</b>
        <button class="btn btn-primary btn-sm" data-act="reply-sent" data-id="${c.id}">Yes, mark as sent</button>
        <button class="btn btn-sm" data-act="reply-unsent">Not yet</button>
        <a class="btn btn-sm btn-ghost" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer" data-act="send-reply" data-id="${c.id}">${ic('copy')} Copy again ${ic('ext')}</a></div>`
      : `${sendLink(link.href, 'send-reply', c.id, sendLabel, !draft.trim())}
        ${c.status === 'open' ? `<button class="btn" data-act="convo-done" data-id="${c.id}">${ic('check')} No reply needed</button>
        <button class="btn btn-ghost" data-act="convo-snooze" data-id="${c.id}">${ic('clock')} Snooze 3 days</button>`
        : `<button class="btn" data-act="convo-reopen" data-id="${c.id}">${ic('refresh')} Reopen</button>`}`}
  </div>
  ${!link.direct ? `<p class="hint" style="margin-top:10px">No chat link saved yet. In LinkedIn Messaging, search “${esc(cleanName(c.name))}”, open the chat and paste. Importing your LinkedIn messages adds direct links.</p>` : ''}
  <details class="more" style="margin-top:18px"><summary>${ic('chevR')} Notes and details</summary>
    <div class="stack" style="margin-top:12px">
      <div class="field"><label for="cnotes-${c.id}">Private notes (the AI reads these)</label><textarea class="textarea" id="cnotes-${c.id}" data-input="convo-field" data-field="notes" data-id="${c.id}" placeholder="Context for your reply, for example: met at the Karachi expo">${esc(c.notes)}</textarea></div>
      <div class="grid2">
        <div class="field"><label for="cco-${c.id}">Company</label><input class="input" id="cco-${c.id}" data-input="convo-field" data-field="company" data-id="${c.id}" value="${esc(c.company)}"></div>
        <div class="field"><label for="curl-${c.id}">Profile or chat link</label><input class="input" id="curl-${c.id}" data-input="convo-field" data-field="url" data-id="${c.id}" value="${esc(c.url)}" placeholder="https://www.linkedin.com/in/…"></div>
      </div>
      <div class="row">
        ${c.leadId && S.lead(c.leadId) ? `<button class="btn btn-sm" data-act="open-lead" data-id="${c.leadId}">${ic('users')} Open lead</button>` : `<button class="btn btn-sm" data-act="convo-to-lead" data-id="${c.id}">${ic('plus')} Save as lead</button>`}
        <button class="btn btn-sm btn-danger" data-act="convo-delete" data-id="${c.id}">${ic('trash')} Delete from desk</button>
      </div>
    </div>
  </details>`;
}

VIEW_FN.inbox = function () {
  if (!S.meta) return VIEW_FN.today();
  const counts = inboxCounts();
  const list = inboxList(ui.inboxF, ui.inboxQ);
  let sel = ui.sel && S.convo(ui.sel);
  if (!sel || !inboxMatches(sel, ui.inboxF)) sel = sel && ui.showDetail ? sel : list[0] || null;
  if (sel) ui.sel = sel.id;
  const partial = S.convos().filter((c) => c.partial && c.source === 'snapshot').length;
  const draftables = list.filter((c) => ['reply', 'optional'].includes(recommend(c).act) && !c.draft && c.status === 'open');
  const clear = noReplyCandidates();
  const chips = INBOX_FILTERS.map((f) => `<button class="chip" data-act="inbox-filter" data-f="${f.id}" aria-pressed="${ui.inboxF === f.id}">${esc(f.label)} <span class="n">${counts[f.id] || 0}</span></button>`).join('');
  const items = list.map((c) => `
    <button class="ib-item ${c.status !== 'open' ? 'is-done' : ''}" data-act="sel-convo" data-id="${c.id}" aria-current="${sel && c.id === sel.id}">
      ${avHtml(c.name)}
      <span class="min0"><span class="nm">${esc(cleanName(c.name) || c.name)}</span>
        <span class="ib-meta">${catChip(c)}${c.draft ? '<span class="draft-tag">Draft ready</span>' : ''}</span>
        <span class="pv">${esc(c.company ? c.company + ' · ' : '')}${esc(trunc(c.preview || c.messages?.[c.messages.length - 1]?.text || '', 140))}</span></span>
      <span class="dt">${esc(fmtShort(c.lastAt))}</span>
    </button>`).join('');
  const actions = `${draftables.length ? (AI.on ? `<button class="btn btn-send" data-act="ai-reply-batch" ${ui.busy ? 'disabled' : ''}>${ic('sparkle')} Draft ${draftables.length} replies</button>` : `<button class="btn btn-send" data-act="tpl-reply-batch">${ic('file')} Fill ${draftables.length} from templates</button>`) : ''}
      ${clear.length ? `<button class="btn" data-act="clear-noreply">${ic('archive')} Clear ${clear.length} that need no reply</button>` : ''}
      <button class="btn btn-ghost" data-act="open-import" data-kind="messages">${ic('upload')} Import</button>
      <button class="btn btn-ghost" data-act="add-convo">${ic('plus')} Add</button>`;
  return `
  <div class="ib-top ${ui.showDetail && sel ? 'has-sel' : ''}">
    ${pageHead('Inbox', 'Your <em>conversations</em>', partial ? `${partial} of these came from your Sep 29 inbox snapshot, so only previews are saved. Import your LinkedIn messages to add full threads and chat links.` : 'Replies are drafted here and sent by you on LinkedIn.', actions)}
    ${busyHtml('inbox')}
    <div class="chips" style="margin-bottom:16px" role="toolbar" aria-label="Filter conversations">${chips}</div>
  </div>
  <div class="ib ${ui.showDetail && sel ? 'has-sel' : ''}">
    <div class="ib-list">
      <div class="ib-search"><label class="sr-only" for="inbox-q">Search conversations</label><input class="input" id="inbox-q" type="search" data-input="inbox-q" placeholder="Search names, companies, messages" value="${esc(ui.inboxQ)}"></div>
      <div class="ib-scroll">${items || `<div class="pad"><p class="muted">${ui.inboxQ ? 'No conversations match that search.' : ui.inboxF === 'reply' ? 'Nothing needs a reply right now.' : 'Nothing here.'}</p></div>`}</div>
    </div>
    <div class="ib-detail-wrap min0">${sel ? `<div class="panel ib-detail">${convoDetailHtml(sel)}</div>` : emptyHtml('Pick a conversation', 'Choose one on the left to read it and draft a reply.')}</div>
  </div>`;
};
