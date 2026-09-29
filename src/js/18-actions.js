/* ================= Actions ================= */
const quietLead = (l) => { S.L.put(l); _derived = new Map(); scheduleFlush(); };
const quietConvo = (c) => { c.updatedAt = nowISO(); S.C.put(c); _derived = new Map(); scheduleFlush(); };
const quietMeta = () => { S.metaDirty = true; _derived = new Map(); scheduleFlush(); };
function setStage(l, stage) {
  l.stage = stage; const k = STAGE_TS[stage]; if (k && !l.t[k]) l.t[k] = nowISO();
  if (stage === 'new' || stage === 'queued') l.skipUntil = '';
  if (stage === 'queued' && !l.style) l.style = styleFor(0);
  S.putLead(l);
}
function nextInList(list, id) { const i = list.findIndex((c) => c.id === id); const rest = list.filter((c) => c.id !== id); return rest[Math.min(Math.max(i, 0), rest.length - 1)]?.id || null; }
function updateBusy() { const b = ui.busy; if (!b) return; const el = $('.busy b'); if (el) el.textContent = `${b.done} of ${b.total}`; }

/* ---------- AI batch runner ---------- */
async function runJobs(key, label, jobs, opts = {}) {
  if (ui.busy) return 0;
  if (!AI.on) { toast(aiErrorText({ code: 'off' }), { tone: 'bad' }); return 0; }
  const total = jobs.reduce((n, j) => n + j.items.length, 0);
  if (!total) return 0;
  const ctl = new AbortController();
  ui.busy = { key, label, done: 0, total: total > 1 ? total : 0, ctl };
  render();
  let ok = 0, base = 0;
  try {
    for (const job of jobs) {
      for (let i = 0; i < job.items.length; i += job.chunk) {
        if (ctl.signal.aborted) break;
        const chunk = job.items.slice(i, i + job.chunk);
        const start = base + i;
        const res = asArray(await AI.json(job.prompt(chunk), {
          signal: ctl.signal, fresh: opts.fresh,
          onText: ({ text }) => { const n = (text.match(/"id"\s*:/g) || []).length; const d = Math.min(total, start + Math.min(n, chunk.length)); if (ui.busy && d > ui.busy.done) { ui.busy.done = d; updateBusy(); } },
        }));
        ok += job.apply(chunk, res);
        if (ui.busy) ui.busy.done = Math.min(total, start + chunk.length);
        changed();
      }
      base += job.items.length;
    }
    if (opts.done) opts.done(ok);
  } catch (e) {
    const msg = aiErrorText(e); if (msg) toast(msg, { tone: 'bad' });
  } finally { ui.busy = null; render(); }
  return ok;
}
function applyInvites(limit) {
  return (chunk, res) => {
    let n = 0; const byId = new Map(res.map((r) => [String(r.id), r]));
    chunk.forEach(({ lead, style }, i) => {
      const r = byId.get(lead.id) || res[i]; const note = r && (r.note || r.text);
      if (!note) return;
      const l = S.lead(lead.id); if (!l) return;
      l.drafts.invite = fitNote(stripQuotes(note), limit); l.style = style; l.draftSrc = 'ai'; S.L.put(l); n++;
    });
    return n;
  };
}
function applyMsgs(kind) {
  return (chunk, res) => {
    let n = 0; const byId = new Map(res.map((r) => [String(r.id), r]));
    chunk.forEach((lead, i) => { const r = byId.get(lead.id) || res[i]; const t = r && (r.text || r.message || r.note); if (!t) return; const l = S.lead(lead.id); if (!l) return; l.drafts[kind] = stripQuotes(t); S.L.put(l); n++; });
    return n;
  };
}
function applyReplies(chunk, res) {
  let n = 0; const byId = new Map(res.map((r) => [String(r.id), r]));
  chunk.forEach((c0, i) => { const r = byId.get(c0.id) || res[i]; const t = r && (r.reply || r.text); if (!t) return; const c = S.convo(c0.id); if (!c) return; c.draft = stripQuotes(t); c.draftNote = r.note ? String(r.note) : ''; c.updatedAt = nowISO(); S.C.put(c); n++; });
  return n;
}
function applyClassify(chunk, res) {
  let n = 0;
  for (const r of res) { const c = S.convo(String(r.id)); if (!c) continue; if (CATS[r.category]) c.category = r.category; if ([1, 2, 3].includes(+r.priority)) c.priority = +r.priority; if (r.summary) c.summary = String(r.summary); c.needsSort = false; S.C.put(c); n++; }
  return n;
}

/* ---------- File helpers ---------- */
function pickFiles(accept, multiple = true) {
  return new Promise((resolve) => {
    const inp = $('#file-pick'); inp.value = ''; inp.accept = accept || ''; inp.multiple = multiple;
    inp.onchange = () => resolve([...(inp.files || [])]);
    inp.click();
  });
}
async function saveFile(filename, data) {
  const dl = await capUse('downloads');
  if (!dl) { toast('Saving files is not available in this view.', { tone: 'bad' }); return; }
  try { await dl.save({ filename, data }); toast('Saved ' + filename); }
  catch (e) { if (e?.code !== 'declined') toast(e?.code === 'rate_limited' ? 'A save prompt is already open.' : 'Could not save the file.', { tone: 'bad' }); }
}
async function handleCsvFile(file) {
  if (!file) return;
  const text = await file.text(); const rows = parseCSV(text);
  if (!rows.length) { toast('That file looks empty.', { tone: 'bad' }); return; }
  const kind = detectCsv(rows);
  if (kind !== 'generic') { await handleExportFiles([file]); return; }
  const headers = rows[0]; const body = rows.slice(1);
  const map = guessMapping(headers);
  if (map.url === undefined) {
    const col = headers.findIndex((_, i) => body.slice(0, 20).filter((r) => /linkedin\.com\//i.test(r[i] || '')).length >= Math.min(3, body.length));
    if (col >= 0) map.url = col;
  }
  ui.modal = Object.assign(ui.modal || { type: 'addLeads' }, { type: 'addLeads', tab: 'csv', csv: { fileName: file.name, headers, rows: body, map } });
  render();
}
async function handleExportFiles(files) {
  if (!files.length) return;
  if (!ui.modal || ui.modal.type !== 'importLi') ui.modal = { type: 'importLi' };
  ui.busy = { key: 'import', label: 'Reading your files…', done: 0, total: 0, ctl: new AbortController() };
  render();
  try {
    const data = await readExportFiles(files);
    ui.modal.data = Object.assign(ui.modal.data || {}, data);
    delete ui.modal.mined; delete ui.modal.minedPicked;
    if (!Object.keys(ui.modal.data).length) toast('No LinkedIn files found. Choose Connections.csv, messages.csv or Invitations.csv, or the export .zip.', { tone: 'bad' });
  } catch (e) {
    console.error(e);
    toast(/load failed/.test(String(e && e.message)) ? 'Could not open the .zip here. Unzip it and choose the CSV files instead.' : 'Could not read those files.', { tone: 'bad' });
  } finally { ui.busy = null; render(); }
}
async function handleBackupFile(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data?.app !== 'outreach-desk') throw new Error('not a backup');
    ui.modal = { type: 'restore', data }; render();
  } catch { toast('That is not an Outreach Desk backup file.', { tone: 'bad' }); }
}

/* ---------- Tags ---------- */
function tagTarget(bind) {
  const [kind, id, field] = String(bind).split(':');
  if (kind === 'icp') { const i = icpById(id); return i ? { obj: i, field, save: () => S.saveMeta() } : null; }
  if (kind === 'lead') { const l = S.lead(id); return l ? { obj: l, field, save: () => S.putLead(l) } : null; }
  return null;
}
function addTags(bind, text) {
  const t = tagTarget(bind); if (!t) return false;
  const cur = Array.isArray(t.obj[t.field]) ? t.obj[t.field] : [];
  const add = splitList(text).filter((v) => !cur.some((x) => x.toLowerCase() === v.toLowerCase()));
  if (!add.length) return false;
  t.obj[t.field] = [...cur, ...add]; t.save(); return true;
}

/* ---------- Export ---------- */
function leadsCsv(list) {
  const head = ['Name', 'Goes by', 'Title', 'Company', 'Company size', 'Industry', 'Location', 'Profile link', 'Email', 'Stage', 'ICP fit', 'ICP', 'Tags', 'Added', 'Invited', 'Accepted', 'Replied', 'Notes'];
  const rows = list.map((l) => [l.name, l.first, l.title, l.company, l.companySize, l.industry, l.location, l.url, l.email, STAGE[l.stage]?.label || l.stage, scoreLead(l).score ?? '', icpFor(l)?.name || '', (l.tags || []).join('; '), (l.t.added || '').slice(0, 10), (l.t.invited || '').slice(0, 10), (l.t.connected || '').slice(0, 10), (l.t.replied || '').slice(0, 10), l.notes]);
  return toCSV([head, ...rows]);
}

/* ---------- Action table ---------- */
const ACTIONS = {
  noop() {},
  go: (el) => { ui.drawer = null; go(el.dataset.view); },
  'go-close': (el) => { ui.modal = null; go(el.dataset.view); },
  'go-inbox': (el) => { ui.inboxF = el.dataset.f || 'reply'; ui.showDetail = false; go('inbox'); },
  'go-settings': (el) => { ui.modal = null; ui.settingsTab = el.dataset.tab || 'profile'; go('settings'); },
  more: () => openModal('more'),
  theme: () => setTheme(ui.theme === 'dark' ? 'light' : 'dark'),
  'howto-done': () => { ui.howtoDone = true; try { localStorage.setItem(HOWTO_KEY, '1'); } catch { /* remembered for this visit */ } render(); },
  'scroll-checks': () => { const el = document.getElementById('checks'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  rules: () => openModal('rules'),
  profiles: () => openModal('profiles'),
  'modal-close': () => closeModal(),
  'modal-tab': (el) => { ui.modal.tab = el.dataset.tab; render(); },
  'drawer-close': () => { ui.drawer = null; render(); },
  'confirm-ok': () => {
    const m = ui.modal;
    if (m.typed && String(m.typedVal || '').trim().toUpperCase() !== m.typed) { toast(`Type ${m.typed} to confirm.`, { tone: 'bad' }); return; }
    const fn = _confirmFn; _confirmFn = null; closeModal(); fn && fn();
  },
  'retry-save': () => { scheduleFlush.flush(); flush(); },
  copy: (el) => { copyText(el.dataset.text || '').then((ok) => toast(ok ? 'Copied' : 'Could not copy. Select the text and copy it yourself.', ok ? {} : { tone: 'bad' })); },
  'copy-field': (el) => { const src = document.getElementById(el.dataset.src); copyText(src ? src.value : '').then((ok) => toast(ok ? 'Copied' : 'Could not copy.', ok ? {} : { tone: 'bad' })); },
  'copy-open': (el) => { const src = document.getElementById(el.dataset.id); const v = src ? src.value : ''; if (v) copyText(v).then((ok) => toast(ok ? 'Copied. Paste it on LinkedIn.' : 'Could not copy. Select the text and copy it yourself.', ok ? {} : { tone: 'bad' })); },
  'busy-stop': () => { ui.busy?.ctl?.abort(); },
  'start-session': (el) => { ui.drawer = null; openModal('session', { step: el?.dataset?.step || 'icp', icpId: icps()[0]?.id || '' }); },

  /* Today */
  'queue-best': (el) => { const n = queueBest(+el.dataset.n || budget().left); toast(n ? `Queued ${plural(n, 'best-fit lead')}. Draft their notes next.` : 'No new leads to queue.'); if (n) go('invites'); },
  'add-leads': (el) => { ui.drawer = null; openModal('addLeads', { tab: el.dataset.tab || 'one' }); },
  'check-accepts': () => openModal('accepts', { tab: 'paste', picked: new Set() }),
  'open-convo': (el) => { const c = S.convo(el.dataset.id); if (!c) return; ui.modal = null; ui.drawer = null; ui.inboxF = inboxMatches(c, 'reply') ? 'reply' : 'all'; ui.sel = c.id; ui.showDetail = true; go('inbox'); },

  /* Inbox */
  'inbox-filter': (el) => { ui.inboxF = el.dataset.f; ui.showDetail = false; ui.replyPending = null; render(); },
  'sel-convo': (el) => { ui.sel = el.dataset.id; ui.showDetail = true; ui.replyPending = null; render(); if (matchMedia('(max-width: 880px)').matches) $('#main').scrollTop = 0; },
  'inbox-back': () => { ui.showDetail = false; render(); },
  'ai-reply': (el) => { const c = S.convo(el.dataset.id); if (!c) return; runJobs('reply-' + c.id, c.draft ? 'Redrafting' : 'Drafting a reply', [{ items: [c], chunk: 1, prompt: promptReplies, apply: applyReplies }], { fresh: !!c.draft }); },
  'tpl-reply': (el) => { const c = S.convo(el.dataset.id); if (!c) return; c._tpl = (c._tpl || 0) + 1; c.draft = tplReply(c, c.id + c._tpl); c.draftNote = ''; S.putConvo(c); },
  'ai-rewrite-reply': async (el) => {
    const c = S.convo(el.dataset.id); if (!c || !c.draft || ui.busy) return;
    const ctl = new AbortController(); ui.busy = { key: 'reply-' + c.id, label: 'Rewriting', done: 0, total: 0, ctl }; render();
    try { const t = await AI.text(promptRewrite(c.draft, REWRITES[el.dataset.how] || REWRITES.shorter, 'message reply', 8000, cleanName(c.name)), { fresh: true, tier: 'quick', signal: ctl.signal }); if (t) { c.draft = stripQuotes(t); S.putConvo(c); } }
    catch (e) { const m = aiErrorText(e); if (m) toast(m, { tone: 'bad' }); } finally { ui.busy = null; render(); }
  },
  'send-reply': (el) => {
    const c = S.convo(el.dataset.id); if (!c) return;
    const text = document.getElementById('reply-' + c.id)?.value ?? c.draft;
    copyText(text).then((ok) => toast(ok ? `Reply copied. ${convoLink(c).direct ? 'Paste it in the chat and send.' : 'Search for ' + cleanName(c.name) + ' in Messaging, paste and send.'}` : 'Could not copy. Select the reply and copy it yourself.', ok ? {} : { tone: 'bad' }));
    ui.replyPending = c.id; setTimeout(render, 80);
  },
  'reply-unsent': () => { ui.replyPending = null; render(); },
  'reply-sent': (el) => {
    const c = S.convo(el.dataset.id); if (!c) return;
    const before = clone(c); const list = inboxList(ui.inboxF, ui.inboxQ);
    const now = nowISO();
    c.messages = [...(c.messages || []), { me: true, at: now, text: c.draft }].slice(-30);
    c.sent = [...(c.sent || []), now].slice(-20); c.lastFrom = 'me'; c.lastAt = now; c.draft = ''; c.draftNote = ''; c.snoozeUntil = '';
    const follow = HOT_CATS.includes(c.category) || ['network', 'partner', 'personal', 'declined'].includes(c.category);
    c.status = follow ? 'waiting' : 'done'; c.followUpAt = follow ? new Date(Date.now() + P().cadence.waiting * DAY).toISOString() : '';
    const l = c.leadId && S.lead(c.leadId); if (l && l.stage === 'replied') { l.t.lastReply = now; S.L.put(l); }
    ui.replyPending = null; ui.sel = nextInList(list, c.id); S.putConvo(c);
    toast(follow ? `Marked as sent. If ${firstName(c.name)} goes quiet, it comes back in ${P().cadence.waiting} days.` : 'Marked as sent.', { action: 'Undo', onAction: () => { Object.assign(c, before); S.putConvo(c); ui.sel = c.id; } });
  },
  'convo-done': (el) => {
    const c = S.convo(el.dataset.id); if (!c) return; const prev = { status: c.status, snoozeUntil: c.snoozeUntil };
    const list = inboxList(ui.inboxF, ui.inboxQ); c.status = 'done'; ui.sel = nextInList(list, c.id); S.putConvo(c);
    toast(`${cleanName(c.name)} marked done.`, { action: 'Undo', onAction: () => { Object.assign(c, prev); S.putConvo(c); ui.sel = c.id; } });
  },
  'convo-snooze': (el) => {
    const c = S.convo(el.dataset.id); if (!c) return; const list = inboxList(ui.inboxF, ui.inboxQ);
    c.snoozeUntil = new Date(Date.now() + 3 * DAY).toISOString(); ui.sel = nextInList(list, c.id); S.putConvo(c);
    toast(`Snoozed until ${fmtDate(c.snoozeUntil)}.`, { action: 'Undo', onAction: () => { c.snoozeUntil = ''; S.putConvo(c); ui.sel = c.id; } });
  },
  'convo-reopen': (el) => { const c = S.convo(el.dataset.id); if (!c) return; c.status = 'open'; c.snoozeUntil = ''; c.followUpAt = ''; ui.inboxF = 'all'; ui.sel = c.id; S.putConvo(c); },
  'save-thread': (el) => {
    const c = S.convo(el.dataset.id); const ta = document.getElementById('thread-' + el.dataset.id); if (!c || !ta) return;
    const text = ta.value.trim(); if (!text) { toast('Paste the conversation first.', { tone: 'bad' }); return; }
    c.messages = [{ me: false, at: c.lastAt, text: trunc(text, 6000) }]; c.partial = false;
    if (c.category === 'review') { const g = guessCategory(text, 'them'); if (g !== 'review') c.category = g; }
    S.putConvo(c); toast('Conversation saved. Draft a reply when ready.');
  },
  'convo-to-lead': (el) => {
    const c = S.convo(el.dataset.id); if (!c) return;
    const r = addLeadsBatch([{ name: c.name, company: c.company, url: safeLi(c.url) ? c.url : '', notes: c.notes, title: c.headline }], { source: 'inbox' });
    const l = r.ids[0] && S.lead(r.ids[0]);
    if (!l) { toast('This person is already in your leads.'); return; }
    l.stage = HOT_CATS.includes(c.category) ? 'replied' : 'connected'; l.existing = !HOT_CATS.includes(c.category); l.t.connected = c.lastAt || nowISO(); if (l.stage === 'replied') l.t.replied = c.lastAt || nowISO();
    l.convoId = c.id; c.leadId = l.id; S.putLead(l); S.putConvo(c); toast('Saved as a lead.');
  },
  'convo-delete': (el) => {
    const c = S.convo(el.dataset.id); if (!c) return;
    confirmBox({ title: 'Delete conversation?', text: `Remove ${esc(cleanName(c.name))} from the desk. Nothing changes on LinkedIn.`, ok: 'Delete', danger: true }, () => { ui.sel = null; S.delConvo(c.id); toast('Deleted.'); });
  },
  'ai-reply-batch': () => {
    const items = inboxList(ui.inboxF, ui.inboxQ).filter((c) => c.status === 'open' && ['reply', 'optional'].includes(recommend(c).act) && !c.draft).slice(0, 40);
    runJobs('inbox', 'Drafting replies', [{ items, chunk: 8, prompt: promptReplies, apply: applyReplies }], { done: (n) => toast(`${plural(n, 'reply', 'replies')} drafted. Review each one before sending.`) });
  },
  'tpl-reply-batch': () => {
    let n = 0; for (const c of inboxList(ui.inboxF, ui.inboxQ)) if (c.status === 'open' && ['reply', 'optional'].includes(recommend(c).act) && !c.draft) { c.draft = tplReply(c); S.C.put(c); n++; }
    changed(); toast(`${plural(n, 'reply', 'replies')} filled from templates.`);
  },
  'clear-noreply': () => openModal('clearNoReply'),
  'clear-noreply-ok': () => {
    const list = noReplyCandidates(); const prev = list.map((c) => [c, c.status]);
    for (const c of list) { c.status = 'done'; c.updatedAt = nowISO(); S.C.put(c); }
    closeModal(); changed();
    toast(`${plural(list.length, 'conversation')} marked done.`, { action: 'Undo', onAction: () => { for (const [c, s] of prev) { c.status = s; S.C.put(c); } changed(); } });
  },
  'open-import': (el) => { ui.drawer = null; openModal('importLi', { kind: el.dataset.kind || '' }); },
  'add-convo': () => openModal('addConvo'),
  'nudge-open': (el) => {
    const c = S.convo(el.dataset.id); if (!c) return;
    c.status = 'open'; c.followUpAt = ''; c.draft = c.draft || tplDraft('nudge', convoAsLead(c), c.id);
    ui.inboxF = 'all'; ui.sel = c.id; ui.showDetail = true; S.putConvo(c); go('inbox');
  },

  /* Invites */
  'ai-invite-batch': () => {
    const limit = noteLimit();
    const items = queueSorted().filter((l) => !String(l.drafts.invite || '').trim()).map((lead, i) => ({ lead, style: lead.style || styleFor(i) }));
    runJobs('invites', 'Drafting notes', [{ items, chunk: 12, prompt: (ch) => promptInvites(ch, limit), apply: applyInvites(limit) }], { done: (n) => toast(`${plural(n, 'note')} drafted. Read each one before you send it.`) });
  },
  'tpl-invite-batch': () => {
    const limit = noteLimit(); let n = 0;
    for (const l of queueSorted()) if (!String(l.drafts.invite || '').trim()) { l.drafts.invite = fitNote(tplDraft('invite', l), limit); l.draftSrc = 'template'; S.L.put(l); n++; }
    changed(); toast(`${plural(n, 'note')} filled from templates.`);
  },
  'ai-invite-one': (el) => {
    const l = S.lead(el.dataset.id); if (!l) return; const limit = noteLimit();
    runJobs('invite-' + l.id, l.drafts.invite ? 'Redrafting' : 'Drafting', [{ items: [{ lead: l, style: l.style || S.meta.ai.style || 'peer' }], chunk: 1, prompt: (ch) => promptInvites(ch, limit), apply: applyInvites(limit) }], { fresh: !!l.drafts.invite });
  },
  'tpl-invite-one': (el) => { const l = S.lead(el.dataset.id); if (!l) return; l._tpl = (l._tpl || 0) + 1; l.drafts.invite = fitNote(tplDraft('invite', l, l.id + l._tpl), noteLimit()); l.draftSrc = 'template'; S.putLead(l); },
  'ai-rewrite-note': async (el) => {
    const l = S.lead(el.dataset.id); if (!l || !l.drafts.invite || ui.busy) return; const limit = noteLimit();
    const how = { shorter: `Make it shorter: under ${Math.round(limit * 0.6)} characters.`, warmer: 'Make it warmer and more human.', specific: 'Make it more specific to this person, using only the facts given.' }[el.dataset.how];
    const who = [cleanName(l.name), l.title, l.company, l.about && trunc(l.about, 400)].filter(Boolean).join(' · ');
    const ctl = new AbortController(); ui.busy = { key: 'invite-' + l.id, label: 'Rewriting', done: 0, total: 0, ctl }; render();
    try { const t = await AI.text(promptRewrite(l.drafts.invite, how, 'connection request note', limit, who), { fresh: true, tier: 'quick', signal: ctl.signal }); if (t) { l.drafts.invite = fitNote(stripQuotes(t), limit); S.putLead(l); } }
    catch (e) { const m = aiErrorText(e); if (m) toast(m, { tone: 'bad' }); } finally { ui.busy = null; render(); }
  },
  'send-invite': (el) => {
    const l = S.lead(el.dataset.id); if (!l) return;
    const note = String(document.getElementById('note-' + l.id)?.value ?? l.drafts.invite ?? '').trim();
    ui.invBare = false;
    if (note) copyText(note).then((ok) => toast(ok ? 'Note copied. On LinkedIn: Connect → Add a note → paste → Send.' : 'Could not copy. Select the note and copy it yourself.', ok ? {} : { tone: 'bad' }));
    ui.invPending = l.id; setTimeout(render, 80);
  },
  'inv-unsent': () => { ui.invPending = null; ui.invBare = false; render(); },
  'inv-sent': (el) => {
    const l = S.lead(el.dataset.id || ui.invPending); if (!l) return;
    const ready = queueSorted().filter((x) => !x.skipUntil || new Date(x.skipUntil) <= new Date());
    l.stage = 'invited'; l.t.invited = nowISO(); l.inviteNote = ui.invBare ? '' : String(l.drafts.invite || '').trim(); ui.invBare = false;
    l.inviteStyle = l.inviteNote ? (l.draftSrc === 'ai' ? (l.style || 'peer') : 'template') : 'blank';
    ui.invPending = null; ui.invCur = nextInList(ready, l.id); S.putLead(l);
    const b = budget();
    toast(`Invited ${firstName(l.name)}. ${b.left ? `${b.left} left today.` : 'That was the last one for today.'}`, { action: 'Undo', onAction: () => { l.stage = 'queued'; delete l.t.invited; l.inviteStyle = ''; S.putLead(l); ui.invCur = l.id; } });
  },
  'inv-undo': (el) => { const l = S.lead(el.dataset.id); if (!l) return; l.stage = 'queued'; delete l.t.invited; delete l.t.connected; l.inviteStyle = ''; ui.invCur = l.id; S.putLead(l); toast('Moved back to the queue.'); },
  'inv-skip': (el) => {
    const l = S.lead(el.dataset.id); if (!l) return;
    const ready = queueSorted().filter((x) => !x.skipUntil || new Date(x.skipUntil) <= new Date());
    const tz = P().limits.tz || guessTz(); const tomorrow = new Date(Date.now() + DAY); const key = tzKey(tomorrow, tz);
    l.skipUntil = new Date(`${key}T00:00:00Z`).toISOString(); ui.invCur = nextInList(ready, l.id); S.putLead(l);
  },
  'inv-unskip': (el) => { const l = S.lead(el.dataset.id); if (!l) return; l.skipUntil = ''; S.putLead(l); },
  'inv-remove': (el) => { const l = S.lead(el.dataset.id); if (!l) return; l.stage = 'new'; l.skipUntil = ''; ui.invPending = null; S.putLead(l); toast('Removed from the queue.', { action: 'Undo', onAction: () => { l.stage = 'queued'; S.putLead(l); } }); },
  'inv-pick': (el) => { ui.invCur = el.dataset.id; ui.invPending = null; ui.invBare = false; render(); $('#main').scrollTop = 0; },

  /* Follow-ups */
  'ai-fu-one': (el) => {
    const l = S.lead(el.dataset.id); const kind = el.dataset.kind; if (!l) return;
    runJobs('fu-' + l.id + ':' + kind, 'Drafting', [{ items: [l], chunk: 1, prompt: (ch) => promptMessages(kind, ch), apply: applyMsgs(kind) }], { fresh: !!l.drafts[kind] });
  },
  'tpl-fu-one': (el) => { const l = S.lead(el.dataset.id); const kind = el.dataset.kind; if (!l) return; l._tpl = (l._tpl || 0) + 1; l.drafts[kind] = tplDraft(kind, l, l.id + l._tpl); S.putLead(l); },
  'ai-fu-batch': () => {
    const d = dueLists();
    const jobs = FU_SECTIONS.map((s) => ({ items: d[s.kind].filter((l) => !String(l.drafts[s.kind] || '').trim()), chunk: 10, prompt: (ch) => promptMessages(s.kind, ch), apply: applyMsgs(s.kind) })).filter((j) => j.items.length);
    runJobs('followups', 'Drafting messages', jobs, { done: (n) => toast(`${plural(n, 'message')} drafted. Review before sending.`) });
  },
  'tpl-fu-batch': () => {
    const d = dueLists(); let n = 0;
    for (const s of FU_SECTIONS) for (const l of d[s.kind]) if (!String(l.drafts[s.kind] || '').trim()) { l.drafts[s.kind] = tplDraft(s.kind, l); S.L.put(l); n++; }
    changed(); toast(`${plural(n, 'message')} filled from templates.`);
  },
  'send-fu': (el) => {
    const l = S.lead(el.dataset.id); const kind = el.dataset.kind; if (!l) return;
    const text = document.getElementById(`fu-${l.id}-${kind}`)?.value ?? l.drafts[kind] ?? '';
    copyText(text).then((ok) => toast(ok ? 'Message copied. On LinkedIn: Message → paste → Send.' : 'Could not copy. Select the message and copy it yourself.', ok ? {} : { tone: 'bad' }));
    ui.fuPending = l.id + ':' + kind; setTimeout(render, 80);
  },
  'fu-unsent': () => { ui.fuPending = null; render(); },
  'fu-sent': (el) => {
    const l = S.lead(el.dataset.id); const kind = el.dataset.kind; if (!l) return;
    const before = clone(l); const now = nowISO();
    if (kind === 'welcome' || kind === 'reconnect') { l.t.welcomed = now; l.stage = 'messaged'; l.drafts.welcomeSent = l.drafts[kind]; }
    else if (kind === 'fu1') l.t.fu1 = now;
    else if (kind === 'fu2') l.t.fu2 = now;
    ui.fuPending = null; S.putLead(l);
    toast(`Marked as sent to ${firstName(l.name)}.`, { action: 'Undo', onAction: () => { Object.assign(l, before); S.putLead(l); } });
  },
  'lead-replied': (el) => openModal('replied', { id: el.dataset.id, text: '', cat: 'warm' }),
  'replied-save': () => {
    const m = ui.modal; const l = S.lead(m.id); if (!l) { closeModal(); return; }
    const now = nowISO(); const text = String(m.text || '').trim();
    const lastSent = l.drafts.fu2 && l.t.fu2 ? l.drafts.fu2 : l.drafts.fu1 && l.t.fu1 ? l.drafts.fu1 : l.drafts.welcomeSent || l.inviteNote || '';
    let c = l.convoId && S.convo(l.convoId);
    if (!c) c = normConvo({ id: uid('cv-'), name: l.name, company: l.company, headline: l.title, url: safeLi(l.url) ? l.url : '', source: 'lead', leadId: l.id });
    c.category = m.cat || 'warm'; c.status = 'open'; c.lastAt = now; c.lastFrom = 'them'; c.priority = 1;
    if (text) { c.messages = [...(c.messages || []), ...(lastSent && !(c.messages || []).length ? [{ me: true, at: l.t.fu2 || l.t.fu1 || l.t.welcomed || l.t.invited, text: lastSent }] : []), { me: false, at: now, text }].slice(-30); c.partial = false; c.preview = trunc(text, 300); }
    else { c.partial = true; c.preview = 'They replied on LinkedIn. Paste their message here for a better draft.'; }
    l.stage = m.cat === 'declined' ? 'lost' : m.cat === 'meeting' ? 'meeting' : 'replied'; l.t.replied = now; if (l.stage === 'meeting') l.t.meeting = now; if (l.stage === 'lost') l.t.closed = now;
    l.convoId = c.id; S.L.put(l); S.putConvo(c);
    ui.modal = null; ui.drawer = null; ui.inboxF = 'all'; ui.sel = c.id; ui.showDetail = true; go('inbox');
    if (text && AI.on) setTimeout(() => ACTIONS['ai-reply']({ dataset: { id: c.id } }), 50);
    else if (text) { c.draft = tplReply(c); S.putConvo(c); }
  },
  'lead-stage': (el) => { const l = S.lead(el.dataset.id); if (!l) return; const prev = l.stage; setStage(l, el.dataset.stage); toast(`${firstName(l.name)} is now “${STAGE[el.dataset.stage].label}”.`, { action: 'Undo', onAction: () => { l.stage = prev; S.putLead(l); } }); },
  'lead-snooze': (el) => { const l = S.lead(el.dataset.id); if (!l) return; l.snoozeUntil = new Date(Date.now() + 3 * DAY).toISOString(); S.putLead(l); toast(`Snoozed until ${fmtDate(l.snoozeUntil)}.`); },
  'lead-withdrawn': (el) => { const l = S.lead(el.dataset.id); if (!l) return; l.stage = 'nurture'; l.t.withdrawn = nowISO(); l.t.nurtured = l.t.withdrawn; S.putLead(l); toast('Marked as withdrawn. You can invite again in about three weeks.'); },
  'lead-accepted': (el) => { markAccepted([el.dataset.id]); toast('Marked as accepted. A welcome message is due.'); },
  'nurture-all': () => { for (const l of dueLists().nurture) { l.stage = 'nurture'; l.t.nurtured = nowISO(); S.L.put(l); } changed(); toast('Moved to nurture.'); },

  /* Leads */
  'leads-stage': (el) => { ui.leadsStage = el.dataset.stage; ui.leadsPage = 0; render(); },
  'leads-page': (el) => { ui.leadsPage += +el.dataset.d; render(); $('#main').scrollTop = 0; },
  'open-lead': (el) => { ui.drawer = el.dataset.id; ui.modal = null; render(); },
  'export-leads': () => saveFile(`leads-${tzKey(Date.now(), P().limits.tz || guessTz())}.csv`, leadsCsv(leadsFiltered())),
  'bulk-queue': () => { const ids = [...ui.picked]; queueLeads(ids); ui.picked.clear(); toast(`Queued ${plural(ids.length, 'lead')}.`); },
  'bulk-export': () => saveFile('leads-selected.csv', leadsCsv([...ui.picked].map((id) => S.lead(id)).filter(Boolean))),
  'bulk-delete': () => { const ids = [...ui.picked]; confirmBox({ title: `Delete ${plural(ids.length, 'lead')}?`, text: 'They are removed from the desk. Nothing changes on LinkedIn.', ok: 'Delete', danger: true }, () => { for (const id of ids) S.L.remove(id); ui.picked.clear(); changed(); toast(`Deleted ${plural(ids.length, 'lead')}.`); }); },
  'bulk-clear': () => { ui.picked.clear(); render(); },
  'lead-queue': (el) => { queueLeads([el.dataset.id]); toast('Queued for an invite.'); },
  'lead-to-invite': (el) => { ui.invCur = el.dataset.id; ui.drawer = null; go('invites'); },
  'lead-delete': (el) => { const l = S.lead(el.dataset.id); if (!l) return; confirmBox({ title: 'Delete lead?', text: `Remove ${esc(cleanName(l.name))} from the desk. Nothing changes on LinkedIn.`, ok: 'Delete', danger: true }, () => { ui.drawer = null; S.delLead(l.id); toast('Lead deleted.'); }); },
  'tag-del': (el) => { const t = tagTarget(el.dataset.bind); if (!t) return; const arr = [...(t.obj[t.field] || [])]; arr.splice(+el.dataset.i, 1); t.obj[t.field] = arr; t.save(); },

  /* ICP */
  'icp-sel': (el) => { ui.icpSel = el.dataset.id; render(); },
  'icp-new': () => { const i = newIcp(P().id); S.meta.icps.push(i); ui.icpSel = i.id; S.saveMeta(); setTimeout(() => $('#icp-name')?.select(), 60); },
  'icp-size': (el) => { const i = icpById(el.dataset.id); if (!i) return; const s = el.dataset.size; i.sizes = (i.sizes || []).includes(s) ? i.sizes.filter((x) => x !== s) : [...(i.sizes || []), s].sort((a, b) => SIZE_BANDS.indexOf(a) - SIZE_BANDS.indexOf(b)); S.saveMeta(); },
  'icp-delete': (el) => { const i = icpById(el.dataset.id); if (!i) return; confirmBox({ title: 'Delete this ICP?', text: `Leads in “${esc(i.name)}” move to your first remaining ICP.`, ok: 'Delete', danger: true }, () => { S.meta.icps = S.meta.icps.filter((x) => x.id !== i.id); for (const l of S.leads()) if (l.icpId === i.id) { l.icpId = ''; S.L.put(l); } ui.icpSel = null; S.saveMeta(); changed(); }); },
  'ai-icp': async (el) => {
    const i = icpById(el.dataset.id); const desc = $('#icp-desc')?.value.trim(); if (!i) return;
    if (!desc) { toast('Describe your ideal customer first.', { tone: 'bad' }); return; }
    if (ui.busy) return; const ctl = new AbortController(); ui.busy = { key: 'icp', label: 'Thinking about your ICP', done: 0, total: 0, ctl }; render();
    try {
      const r = await AI.json(promptIcp(desc, i), { signal: ctl.signal });
      const merge = (a, b) => [...new Set([...(a || []), ...((Array.isArray(b) ? b : []).map((x) => String(x).trim()).filter(Boolean))])];
      i.industries = merge(i.industries, r.industries); i.titles = merge(i.titles, r.titles); i.excludes = merge(i.excludes, r.excludes); i.locations = merge(i.locations, r.locations);
      if (r.pains && !i.pains) i.pains = String(r.pains); if (r.cta && !i.cta) i.cta = String(r.cta);
      S.saveMeta(); toast('Suggestions added. Remove anything that does not fit.');
    } catch (e) { const m = aiErrorText(e); if (m) toast(m, { tone: 'bad' }); } finally { ui.busy = null; render(); }
  },

  /* Write */
  'write-tab': (el) => { ui.writeTab = el.dataset.tab; render(); },
  'use-idea': (el) => { ui.write.topic = ui.write.ideas[+el.dataset.i] || ''; render(); },
  'ai-post': async () => {
    if (ui.busy) return; const w = ui.write; const ctl = new AbortController(); ui.busy = { key: 'post', label: 'Writing your post', done: 0, total: 0, ctl }; render();
    try {
      const t = await AI.text(promptPost(w, icps()[0]), { fresh: true, signal: ctl.signal, onText: ({ text }) => { w.post = text; const ta = $('#w-post'); if (ta) { ta.value = text; updateCount(ta); } } });
      w.post = stripQuotes(t);
    } catch (e) { if (e?.text) w.post = e.text; const m = aiErrorText(e); if (m) toast(m, { tone: 'bad' }); } finally { ui.busy = null; render(); }
  },
  'ai-ideas': async () => {
    if (ui.busy) return; const ctl = new AbortController(); ui.busy = { key: 'post', label: 'Finding topics', done: 0, total: 0, ctl }; render();
    try { ui.write.ideas = asArray(await AI.json(promptPostIdeas(icps()[0]), { signal: ctl.signal, fresh: true })).map(String).slice(0, 10); }
    catch (e) { const m = aiErrorText(e); if (m) toast(m, { tone: 'bad' }); } finally { ui.busy = null; render(); }
  },
  'ai-rewrite-post': async (el) => {
    const w = ui.write; if (!w.post || ui.busy) return; const ctl = new AbortController(); ui.busy = { key: 'post', label: 'Rewriting', done: 0, total: 0, ctl }; render();
    try { const t = await AI.text(promptRewrite(w.post, el.dataset.how === 'hook' ? 'Rewrite only the first line into a stronger, specific hook; keep the rest.' : 'Make it about 40% shorter while keeping the main point and the closing question.', 'post', 3000), { fresh: true, signal: ctl.signal }); if (t) w.post = stripQuotes(t); }
    catch (e) { const m = aiErrorText(e); if (m) toast(m, { tone: 'bad' }); } finally { ui.busy = null; render(); }
  },
  'ai-comments': async () => {
    const w = ui.write; if (!w.postIn.trim()) { toast('Paste the post first.', { tone: 'bad' }); return; }
    if (ui.busy) return; const ctl = new AbortController(); ui.busy = { key: 'comment', label: 'Reading the post', done: 0, total: 0, ctl }; render();
    try { w.comments = asArray(await AI.json(promptComments(w.postIn), { signal: ctl.signal, fresh: true })).map(String).slice(0, 3); }
    catch (e) { const m = aiErrorText(e); if (m) toast(m, { tone: 'bad' }); } finally { ui.busy = null; render(); }
  },
  'ai-inmail': async () => {
    const w = ui.write; const l = S.lead(w.inmailLead); if (!l || ui.busy) return;
    const ctl = new AbortController(); ui.busy = { key: 'inmail', label: 'Drafting InMail', done: 0, total: 0, ctl }; render();
    try { const r = await AI.json(promptInMail(l), { signal: ctl.signal, fresh: true }); w.inmailSubject = String(r.subject || '').slice(0, 200); w.inmailBody = String(r.body || ''); l.drafts.inmail = w.inmailBody; quietLead(l); }
    catch (e) { const m = aiErrorText(e); if (m) toast(m, { tone: 'bad' }); } finally { ui.busy = null; render(); }
  },
  'tpl-inmail': () => {
    const w = ui.write; const l = S.lead(w.inmailLead); if (!l) return;
    const t = tplDraft('inmail', l); const m = t.match(/^Subject:\s*(.*)\n+([\s\S]*)$/i);
    w.inmailSubject = m ? m[1].trim() : ''; w.inmailBody = m ? m[2].trim() : t; render();
  },
  'ai-profile': async () => {
    const w = ui.write; if (!w.headline.trim() && !w.about.trim()) { toast('Paste your headline or About section first.', { tone: 'bad' }); return; }
    if (ui.busy) return; const ctl = new AbortController(); ui.busy = { key: 'profile', label: 'Reviewing your profile', done: 0, total: 0, ctl }; render();
    try { const r = await AI.json(promptProfile(w.headline, w.about, icps()[0]), { signal: ctl.signal, fresh: true }); w.prof = { headlines: asArray(r.headlines).map(String), about: String(r.about || ''), fixes: asArray(r.fixes).map(String) }; }
    catch (e) { const m = aiErrorText(e); if (m) toast(m, { tone: 'bad' }); } finally { ui.busy = null; render(); }
  },

  /* Templates */
  'tpl-type': (el) => { ui.tplType = el.dataset.type; render(); },
  'tpl-add': (el) => { const list = ensureOwnTemplates(); list.push({ id: uid('t-'), type: el.dataset.type || ui.tplType, name: 'New template', body: '', active: true }); S.saveMeta(); },
  'tpl-delete': (el) => { const list = ensureOwnTemplates(); S.meta.templates = list.filter((t) => t.id !== el.dataset.id); S.saveMeta(); },
  'tpl-reset': () => confirmBox({ title: 'Restore default templates?', text: 'Your edited and added templates are replaced by the defaults.', ok: 'Restore', danger: true }, () => { S.meta.templates = null; S.saveMeta(); }),

  /* Insights */
  days: (el) => { ui.days = +el.dataset.d; render(); },
  'chart-table': (el) => { ui.tables[el.dataset.id] = !ui.tables[el.dataset.id]; render(); },

  /* Settings */
  'settings-tab': (el) => { ui.settingsTab = el.dataset.tab; render(); },
  'profile-add': () => openModal('profileAdd'),
  'profile-switch': (el) => { S.meta.active = el.dataset.id; ui.modal = null; ui.sel = null; ui.invCur = null; ui.icpSel = null; ui.picked.clear(); S.saveMeta(); toast(`Switched to ${P().name || 'profile'}.`); },
  'profile-delete': (el) => {
    const x = S.meta.profiles.find((p) => p.id === el.dataset.id); if (!x) return;
    const nl = [...S.L.items.values()].filter((l) => l.profileId === x.id).length, nc = [...S.C.items.values()].filter((c) => c.profileId === x.id).length;
    confirmBox({ title: `Delete ${x.name || 'this profile'}?`, text: `Also deletes its ${plural(nl, 'lead')} and ${plural(nc, 'conversation')} from the desk.`, ok: 'Delete profile', danger: true, typed: 'DELETE' }, () => {
      for (const l of [...S.L.items.values()]) if (l.profileId === x.id) S.L.remove(l.id);
      for (const c of [...S.C.items.values()]) if (c.profileId === x.id) S.C.remove(c.id);
      S.meta.profiles = S.meta.profiles.filter((p) => p.id !== x.id); S.meta.icps = S.meta.icps.filter((i) => i.profileId !== x.id); S.saveMeta();
    });
  },
  workday: (el) => { const p = P(); const d = +el.dataset.d; p.limits.workdays = p.limits.workdays.includes(d) ? p.limits.workdays.filter((x) => x !== d) : [...p.limits.workdays, d].sort(); S.saveMeta(); },
  'check-add': () => { P().checks.push({ id: uid('c-'), label: 'New inbox', note: '', url: '', until: '', doneOn: '' }); S.saveMeta(); },
  'check-del': (el) => { const p = P(); p.checks = p.checks.filter((c) => c.id !== el.dataset.id); S.saveMeta(); },
  backup: () => {
    const all = (B) => Object.fromEntries([...B.items.entries()]);
    saveFile(`outreach-desk-backup-${tzKey(Date.now(), P().limits.tz || guessTz())}.json`, JSON.stringify({ app: 'outreach-desk', v: 1, exportedAt: nowISO(), meta: S.meta, leads: all(S.L), convos: all(S.C) }, null, 1));
  },
  'restore-backup': () => openModal('restore'),
  'pick-backup': async () => handleBackupFile((await pickFiles('.json,application/json', false))[0]),
  'restore-ok': () => {
    const d = ui.modal.data; let nl = 0, nc = 0;
    if (d.meta) {
      if (!S.meta) S.meta = migrateMeta(clone(d.meta));
      else {
        for (const p of d.meta.profiles || []) if (!S.meta.profiles.some((x) => x.id === p.id)) S.meta.profiles.push(p);
        for (const i of d.meta.icps || []) if (!S.meta.icps.some((x) => x.id === i.id)) S.meta.icps.push(i);
        S.meta = migrateMeta(S.meta);
      }
      S.metaDirty = true;
    }
    for (const [id, l] of Object.entries(d.leads || {})) if (!S.L.items.has(id)) { S.L.put(normLead({ ...l, id })); nl++; }
    for (const [id, c] of Object.entries(d.convos || {})) if (!S.C.items.has(id)) { S.C.put(normConvo({ ...c, id })); nc++; }
    closeModal(); changed(); toast(`Restored ${plural(nl, 'lead')} and ${plural(nc, 'conversation')}.`);
  },
  'reset-profile': () => confirmBox({ title: 'Delete all leads and conversations?', text: `Everything for ${esc(P().name || 'this profile')} is removed from the desk. Download a backup first if you might need it.`, ok: 'Delete everything', danger: true, typed: 'RESET' }, () => {
    const pid = P().id;
    for (const l of [...S.L.items.values()]) if (!l.profileId || l.profileId === pid) S.L.remove(l.id);
    for (const c of [...S.C.items.values()]) if (!c.profileId || c.profileId === pid) S.C.remove(c.id);
    changed(); toast('Leads and conversations deleted.');
  }),

  /* Modals: add leads */
  'al-add-queue': () => { const f = $('#al-form'); if (!f) return; $('#al-queue').value = '1'; f.requestSubmit(); },
  'al-parse': () => { const m = ui.modal; const idx = leadIndex(); m.parsed = parseLooseList(m.paste || '').map((p) => ({ ...p, _dup: !!findDup(p, idx) })); if (!m.parsed.length) toast('No names found. Put one person per line.', { tone: 'bad' }); render(); },
  'al-parse-ai': async () => {
    const m = ui.modal; if (!String(m.paste || '').trim()) { toast('Paste something first.', { tone: 'bad' }); return; }
    if (ui.busy) return; const ctl = new AbortController(); ui.busy = { key: 'parse', label: 'Reading your list', done: 0, total: 0, ctl }; render();
    try {
      const idx = leadIndex();
      m.parsed = asArray(await AI.json(promptParseLeads(m.paste), { signal: ctl.signal })).filter((p) => p && p.name)
        .map((p) => ({ name: String(p.name), title: String(p.title || ''), company: String(p.company || ''), location: String(p.location || ''), url: safeLi(p.url) || '', industry: String(p.industry || ''), companySize: String(p.company_size || '') }))
        .map((p) => ({ ...p, _dup: !!findDup(p, idx) }));
      if (!m.parsed.length) toast('No people found in that text.', { tone: 'bad' });
    } catch (e) { const t = aiErrorText(e); if (t) toast(t, { tone: 'bad' }); } finally { ui.busy = null; render(); }
  },
  'al-add-parsed': () => {
    const m = ui.modal; const list = (m.parsed || []).filter((p) => !p._skip && !p._dup).map(({ _skip, _dup, ...rest }) => rest);
    const r = addLeadsBatch(list, { icpId: m.icpId, source: 'paste' }); closeModal();
    toast(`Added ${plural(r.added, 'lead')}${r.dups ? `, skipped ${r.dups} already in your list` : ''}.`, r.added ? { action: 'Queue best-fit', onAction: () => { const n = queueBest(budget().left); toast(`Queued ${plural(n, 'lead')}.`); go('invites'); } } : {});
  },
  'pick-csv': async () => handleCsvFile((await pickFiles('.csv,text/csv', false))[0]),
  'csv-reset': () => { ui.modal.csv = null; render(); },
  'csv-import': () => {
    const m = ui.modal; const list = csvLeads(m.csv);
    const r = addLeadsBatch(list, { icpId: m.icpId, source: 'csv' }); closeModal();
    toast(`Imported ${plural(r.added, 'lead')}${r.dups ? `, skipped ${r.dups} duplicates` : ''}.`);
    go('leads');
  },
  'acc-find': () => { const m = ui.modal; const invited = S.leads().filter((l) => l.stage === 'invited'); const found = namesInText(m.paste || '', invited); m.found = found.map((l) => l.id); m.picked = new Set(m.found); render(); },
  'acc-apply': () => { const n = markAccepted([...(ui.modal.picked || [])]); closeModal(); toast(`${plural(n, 'person', 'people')} marked as accepted. Welcome messages are ready in Follow-ups.`, n ? { action: 'Open', onAction: () => go('followups') } : {}); },
  'pick-export': async () => handleExportFiles(await pickFiles('.zip,.csv,application/zip,text/csv', true)),
  'im-reset': () => { ui.modal = { type: 'importLi', kind: ui.modal.kind }; render(); },
  'im-messages': () => {
    const m = ui.modal; const r = applyMessages(m.data.messages.convos, { onlyWaiting: m.onlyWaiting !== false, since: m.since ?? 365 });
    m.doneMessages = true; render();
    toast(`${plural(r.added, 'conversation')} added, ${r.merged} filled in with full threads.`, r.newIds.length && AI.on ? { action: 'Sort new ones with AI', onAction: () => sortConvos(r.newIds) } : {});
  },
  'im-accepts': () => {
    const m = ui.modal; const conns = m.data.connections;
    const byUrl = new Map(conns.filter((c) => liKey(c.url)).map((c) => [liKey(c.url), c])); const byName = new Map(conns.map((c) => [nameKey(c.name), c]));
    let n = 0;
    for (const l of S.leads().filter((x) => x.stage === 'invited')) { const c = (liKey(l.url) && byUrl.get(liKey(l.url))) || byName.get(nameKey(l.name)); if (c) { l.stage = 'connected'; l.t.connected = c.connectedOn || nowISO(); if (!l.url && c.url) l.url = c.url; S.L.put(l); n++; } }
    changed(); m.doneAccepts = true; toast(`${plural(n, 'person', 'people')} marked as accepted.`);
  },
  'im-mine': () => {
    const m = ui.modal; const picked = m.minedPicked || new Set();
    const list = (m.mined || []).filter((c) => picked.has(c.url || c.name)).map((c) => ({ name: c.name, first: c.first, title: c.title, company: c.company, url: c.url, email: c.email, connectedOn: c.connectedOn || nowISO() }));
    const r = addLeadsBatch(list, { source: 'connections' }); m.doneMine = true; render();
    toast(`Added ${plural(r.added, 'connection')}. Reconnect messages are waiting in Follow-ups.`, { action: 'Open', onAction: () => { closeModal(); go('followups'); } });
  },
  'im-invites': () => { const n = applyInvitations(ui.modal.data.invitations); ui.modal.doneInvites = true; render(); toast(`${plural(n, 'lead')} marked as invited.`); },
};
function sortConvos(ids) {
  const items = ids.map((id) => S.convo(id)).filter(Boolean);
  runJobs('inbox', 'Sorting conversations', [{ items, chunk: 15, prompt: promptClassify, apply: applyClassify }], { done: (n) => toast(`${plural(n, 'conversation')} sorted.`) });
}

/* ---------- Inputs (no re-render while typing) ---------- */
const INPUTS = {
  'lead-draft': (el) => { const l = S.lead(el.dataset.id); if (!l) return; const was = !!String(l.drafts[el.dataset.kind] || '').trim(); l.drafts[el.dataset.kind] = el.value; if (el.dataset.kind === 'invite') l.draftSrc = l.draftSrc === 'ai' ? 'ai' : 'manual'; quietLead(l); updateCount(el); if (was !== !!el.value.trim() || (el.dataset.kind === 'invite' && (el.value.length > noteLimit()) !== (el.dataset.over === '1'))) { el.dataset.over = el.value.length > noteLimit() ? '1' : '0'; render(); } },
  'convo-draft': (el) => { const c = S.convo(el.dataset.id); if (!c) return; const was = !!String(c.draft || '').trim(); c.draft = el.value; quietConvo(c); updateCount(el); if (was !== !!el.value.trim()) render(); },
  'convo-field': (el) => { const c = S.convo(el.dataset.id); if (!c) return; c[el.dataset.field] = el.value; quietConvo(c); },
  'lead-field': (el) => { const l = S.lead(el.dataset.id); if (!l) return; l[el.dataset.field] = el.value; quietLead(l); },
  'icp-lane': (el) => { const i = icpById(el.dataset.id); if (!i) return; const st = laneFor(i, el.dataset.lane); st.url = safeLi(el.value) || el.value.trim(); st.page = 1; if (el.dataset.lane === 'active') i.searchUrl = st.url; quietMeta(); },
  'icp-field': (el) => { const i = icpById(el.dataset.id); if (!i) return; i[el.dataset.field] = el.value; if (el.dataset.field === 'searchUrl') i.searchPage = 1; quietMeta(); },
  'profile-field': (el) => { const p = P(); p[el.dataset.field] = el.value; quietMeta(); },
  'check-field': (el) => { const c = (P().checks || []).find((x) => x.id === el.dataset.id); if (!c) return; c[el.dataset.field] = el.value; quietMeta(); },
  'tpl-field': (el) => {
    const list = ensureOwnTemplates(); const t = list.find((x) => x.id === el.dataset.id); if (!t) return; t[el.dataset.field] = el.value; quietMeta();
    if (el.dataset.field === 'body') { const pv = document.getElementById('tp-' + t.id); const txt = fillTpl(t.body, tplCtx(sampleCtxLead(), { sorry: 'Sorry for the slow reply.' })); if (pv) { pv.textContent = txt; updateCount({ id: 'tp-' + t.id, value: txt }); } }
  },
  write: (el) => { ui.write[el.dataset.k] = el.value; updateCount(el); },
  modal: (el) => { if (ui.modal) ui.modal[el.dataset.k] = el.value; },
  'inbox-q': debounce((el) => { ui.inboxQ = el.value; render(); }, 180),
  'leads-q': debounce((el) => { ui.leadsQ = el.value; ui.leadsPage = 0; render(); }, 180),
  'al-url': (el) => { const n = $('#al-name'); if (n && !n.value.trim()) { const s = slugName(el.value); if (s) n.value = s; } },
};
const CHANGES = {
  'check-done': (el) => { const p = P(); const c = p.checks.find((x) => x.id === el.dataset.id); if (!c) return; c.doneOn = el.checked ? tzKey(Date.now(), p.limits.tz || guessTz()) : ''; S.saveMeta(); },
  'convo-cat': (el) => { const c = S.convo(el.dataset.id); if (!c) return; c.category = el.value; c.priority = 0; S.putConvo(c); },
  'ai-style': (el) => { S.meta.ai.style = el.value; S.saveMeta(); },
  'ai-ab': (el) => { S.meta.ai.ab = el.checked; S.saveMeta(); },
  'ai-tier': (el) => { S.meta.ai.tier = el.value; S.saveMeta(); },
  pick: (el) => { if (el.checked) ui.picked.add(el.dataset.id); else ui.picked.delete(el.dataset.id); render(); },
  'pick-page': (el) => { const list = leadsFiltered().slice(ui.leadsPage * PAGE_SIZE, (ui.leadsPage + 1) * PAGE_SIZE); for (const l of list) { if (el.checked) ui.picked.add(l.id); else ui.picked.delete(l.id); } render(); },
  'bulk-stage': (el) => { if (!el.value) return; for (const id of ui.picked) { const l = S.lead(id); if (l) { l.stage = el.value; const k = STAGE_TS[el.value]; if (k && !l.t[k]) l.t[k] = nowISO(); S.L.put(l); } } toast(`Updated ${plural(ui.picked.size, 'lead')}.`); ui.picked.clear(); changed(); },
  'bulk-icp': (el) => { if (!el.value) return; for (const id of ui.picked) { const l = S.lead(id); if (l) { l.icpId = el.value; S.L.put(l); } } ui.picked.clear(); changed(); },
  'leads-icp': (el) => { ui.leadsIcp = el.value; ui.leadsPage = 0; render(); },
  'leads-sort': (el) => { ui.leadsSort = el.value; render(); },
  'lead-stage-sel': (el) => { const l = S.lead(el.dataset.id); if (l) setStage(l, el.value); },
  'lead-icp': (el) => { const l = S.lead(el.dataset.id); if (!l) return; l.icpId = el.value; S.putLead(l); },
  'icp-style': (el) => { const i = icpById(el.dataset.id); if (!i) return; i.style = el.value; S.saveMeta(); },
  write: (el) => { ui.write[el.dataset.k] = el.value; if (el.dataset.k === 'inmailLead') { const l = S.lead(el.value); ui.write.inmailSubject = ''; ui.write.inmailBody = l?.drafts.inmail || ''; } render(); },
  'profile-plan': (el) => { P().accountType = el.value; S.saveMeta(); },
  'profile-tone': (el) => { P().tone = el.value; S.saveMeta(); },
  'limit-day': (el) => { P().limits.day = clamp(+el.value || 20, 1, 40); S.saveMeta(); },
  'limit-week': (el) => { P().limits.week = clamp(+el.value || 100, 5, 200); S.saveMeta(); },
  'limit-time': (el) => { if (/^\d{2}:\d{2}$/.test(el.value)) { P().limits.time = el.value; S.saveMeta(); } },
  'limit-tz': (el) => { P().limits.tz = el.value; S.saveMeta(); },
  'cad-fu1': (el) => { P().cadence.fu1 = clamp(+el.value || 4, 1, 30); S.saveMeta(); },
  'cad-fu2': (el) => { P().cadence.fu2 = clamp(+el.value || 7, 1, 60); S.saveMeta(); },
  'cad-nurture': (el) => { P().cadence.nurture = clamp(+el.value || 14, 1, 90); S.saveMeta(); },
  'cad-withdraw': (el) => { P().cadence.withdraw = clamp(+el.value || 21, 7, 60); S.saveMeta(); },
  'cad-waiting': (el) => { P().cadence.waiting = clamp(+el.value || 3, 1, 30); S.saveMeta(); },
  'check-until': (el) => { const c = P().checks.find((x) => x.id === el.dataset.id); if (!c) return; c.until = el.value; S.saveMeta(); },
  'tpl-active': (el) => { const list = ensureOwnTemplates(); const t = list.find((x) => x.id === el.dataset.id); if (!t) return; t.active = el.checked; S.saveMeta(); },
  modal: (el) => { if (ui.modal) { ui.modal[el.dataset.k] = el.value; render(); } },
  'modal-bool': (el) => { if (ui.modal) { ui.modal[el.dataset.k] = el.checked; render(); } },
  'modal-num': (el) => { if (ui.modal) { ui.modal[el.dataset.k] = +el.value; render(); } },
  'al-pick': (el) => { const p = ui.modal?.parsed?.[+el.dataset.i]; if (p) { p._skip = !el.checked; render(); } },
  'csv-map': (el) => { const c = ui.modal?.csv; if (!c) return; if (el.value === '') delete c.map[el.dataset.k]; else c.map[el.dataset.k] = +el.value; render(); },
  'acc-pick': (el) => { const m = ui.modal; m.picked = m.picked || new Set(); if (el.checked) m.picked.add(el.dataset.id); else m.picked.delete(el.dataset.id); render(); },
  'mine-pick': (el) => { const m = ui.modal; m.minedPicked = m.minedPicked || new Set(); if (el.checked) m.minedPicked.add(el.dataset.key); else m.minedPicked.delete(el.dataset.key); render(); },
};
const SUBMITS = {
  setup: (f) => {
    const d = Object.fromEntries(new FormData(f));
    const p = newProfile({ name: String(d.name || '').trim(), company: String(d.company || '').trim(), url: safeLi(d.url) || String(d.url || '').trim(), accountType: d.accountType || 'premium', offer: String(d.offer || '').trim() });
    p.first = firstName(p.name); p.limits.day = clamp(+d.day || 20, 1, 40);
    S.meta = newMeta(p); S.saveMeta(); toast('Your desk is ready. Next: describe who you want to reach.'); go('today');
  },
  'add-lead': (f) => {
    const d = Object.fromEntries(new FormData(f));
    const lead = { name: String(d.name || '').trim(), title: d.title, company: d.company, url: safeLi(d.url) || String(d.url || '').trim(), companySize: d.companySize, industry: d.industry, location: d.location, about: d.about };
    const queue = d.queue === '1';
    const r = addLeadsBatch([lead], { icpId: ui.modal?.icpId, source: 'manual', queue });
    if (!r.added) { toast('This person is already in your leads.', { tone: 'bad' }); return; }
    const l = S.lead(r.ids[0]); const sc = scoreLead(l).score;
    closeModal();
    toast(`${firstName(l.name)} added${sc != null ? ` · fit ${sc}` : ''}${queue ? ' and queued' : ''}.`, queue ? { action: 'Open invites', onAction: () => { ui.invCur = l.id; go('invites'); } } : { action: 'Add another', onAction: () => openModal('addLeads', { tab: 'one' }) });
  },
  'profile-add': (f) => {
    const d = Object.fromEntries(new FormData(f));
    const cur = P();
    const p = newProfile({ name: String(d.name || '').trim(), url: safeLi(d.url) || String(d.url || '').trim(), company: String(d.company || '').trim(), accountType: d.accountType || 'premium', tz: cur.limits.tz });
    p.first = firstName(p.name); p.limits.tz = cur.limits.tz; p.limits.time = cur.limits.time;
    S.meta.profiles.push(p);
    if (d.copyIcp) for (const i of icps()) S.meta.icps.push({ ...clone(i), id: uid('icp-'), profileId: p.id });
    S.meta.active = p.id; ui.modal = null; ui.sel = null; ui.invCur = null; ui.icpSel = null; S.saveMeta(); toast(`Added ${p.name}. You are now working as this profile.`);
  },
  'add-convo': (f) => {
    const d = Object.fromEntries(new FormData(f));
    const text = String(d.text || '').trim();
    const c = normConvo({ id: uid('cv-'), name: String(d.name || '').trim(), company: String(d.company || '').trim(), url: safeLi(d.url) || '', thread: '', category: d.category || guessCategory(text, 'them'), status: 'open', lastAt: nowISO(), lastFrom: 'them', messages: [{ me: false, at: nowISO(), text: trunc(text, 6000) }], preview: trunc(text, 300), partial: false, source: 'manual' });
    const m = String(d.url || '').match(/messaging\/thread\/([^/?#]+)/); if (m) { try { c.thread = decodeURIComponent(m[1]); } catch { c.thread = m[1]; } }
    S.putConvo(c); ui.modal = null; ui.inboxF = 'all'; ui.sel = c.id; ui.showDetail = true; go('inbox');
  },
};

/* ---------- Event wiring ---------- */
document.addEventListener('click', (e) => {
  if (e.target.classList?.contains('overlay')) { closeModal(); return; }
  if (e.target.classList?.contains('drawer-ov')) { ui.drawer = null; render(); return; }
  const el = e.target.closest('[data-act], input, select, textarea, label, a[href]');
  if (!el || !el.dataset || !el.dataset.act) return;
  const fn = ACTIONS[el.dataset.act]; if (!fn) return;
  const external = el.tagName === 'A' && el.getAttribute('target') === '_blank';
  if (!external) e.preventDefault();
  try { const r = fn(el, e); if (r && r.catch) r.catch((err) => { console.error(err); toast('Something went wrong. Try again.', { tone: 'bad' }); }); }
  catch (err) { console.error(err); toast('Something went wrong. Try again.', { tone: 'bad' }); }
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset?.input && INPUTS[el.dataset.input]) INPUTS[el.dataset.input](el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset?.change && CHANGES[el.dataset.change]) CHANGES[el.dataset.change](el, e);
  else if (el.dataset?.input && !['inbox-q', 'leads-q', 'write', 'modal', 'al-url'].includes(el.dataset.input)) render();
});
document.addEventListener('submit', (e) => {
  const f = e.target; if (!f.dataset?.submit) return;
  e.preventDefault(); const fn = SUBMITS[f.dataset.submit]; if (fn) fn(f, e);
});
document.addEventListener('keydown', (e) => {
  const el = e.target;
  if (el.dataset?.tagin) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (addTags(el.dataset.tagin, el.value)) el.value = ''; return; }
    if (e.key === 'Backspace' && !el.value) { const t = tagTarget(el.dataset.tagin); if (t && (t.obj[t.field] || []).length) { t.obj[t.field] = t.obj[t.field].slice(0, -1); t.save(); } return; }
  }
  if (e.key === 'Escape') { if (ui.modal) { closeModal(); return; } if (ui.drawer) { ui.drawer = null; render(); return; } }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable;
  if (e.key === 'Enter' && !typing && !ui.modal) {
    if (ui.view === 'invites' && ui.invPending) { e.preventDefault(); ACTIONS['inv-sent']({ dataset: { id: ui.invPending } }); }
    else if (ui.view === 'inbox' && ui.replyPending) { e.preventDefault(); ACTIONS['reply-sent']({ dataset: { id: ui.replyPending } }); }
  }
});
document.addEventListener('focusout', (e) => { const el = e.target; if (el.dataset?.tagin && el.value.trim()) { if (addTags(el.dataset.tagin, el.value)) el.value = ''; } });
document.addEventListener('paste', (e) => {
  const el = e.target; if (!el.dataset?.tagin) return;
  const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
  if (/[,\n;]/.test(text)) { e.preventDefault(); addTags(el.dataset.tagin, text); }
});
document.addEventListener('dragover', (e) => { const z = e.target.closest?.('[data-drop]'); if (z) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', (e) => { const z = e.target.closest?.('[data-drop]'); if (z) z.classList.remove('over'); });
document.addEventListener('drop', (e) => {
  const z = e.target.closest?.('[data-drop]'); if (!z) return;
  e.preventDefault(); z.classList.remove('over');
  const files = [...(e.dataTransfer?.files || [])]; if (!files.length) return;
  if (z.dataset.drop === 'csv') handleCsvFile(files[0]);
  else if (z.dataset.drop === 'export') handleExportFiles(files);
  else if (z.dataset.drop === 'backup') handleBackupFile(files[0]);
});
function showTip(el) {
  const card = el.closest('.chart-card'); if (!card) return;
  let tip = card.querySelector('.tip'); if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; card.appendChild(tip); }
  tip.innerHTML = `<b>${esc(el.dataset.val)}</b>${esc(el.dataset.tip)}`;
  const cr = card.getBoundingClientRect(); let x, y;
  if (el.dataset.x && el.ownerSVGElement) { const sr = el.ownerSVGElement.getBoundingClientRect(); x = sr.left - cr.left + (+el.dataset.x / 100) * sr.width; y = sr.top - cr.top + (+el.dataset.y / 100) * sr.height; }
  else { const r = el.getBoundingClientRect(); x = r.left - cr.left + Math.min(r.width, 180) / 2; y = r.top - cr.top; }
  tip.style.left = clamp(x, 70, cr.width - 70) + 'px'; tip.style.top = y + 'px'; tip.hidden = false;
}
function hideTip(el) { const tip = el.closest?.('.chart-card')?.querySelector('.tip'); if (tip) tip.hidden = true; }
document.addEventListener('pointerover', (e) => { const el = e.target.closest?.('[data-tip]'); if (el) showTip(el); });
document.addEventListener('pointerout', (e) => { const el = e.target.closest?.('[data-tip]'); if (el) hideTip(el); });
document.addEventListener('focusin', (e) => { const el = e.target.closest?.('[data-tip]'); if (el) showTip(el); });
document.addEventListener('focusout', (e) => { const el = e.target.closest?.('[data-tip]'); if (el) hideTip(el); });
