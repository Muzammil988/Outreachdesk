/* ================= Modals & import flows ================= */
let _confirmFn = null;
function confirmBox({ title, text, ok = 'Confirm', danger = false, typed = '' }, fn) { _confirmFn = fn; openModal('confirm', { title, text, ok, danger, typed, typedVal: '' }); }
MODALS.confirm = (m) => ({
  title: esc(m.title), size: 'narrow',
  body: `<p>${m.text}</p>${m.typed ? `<div class="field" style="margin-top:12px"><label for="cf-typed">Type ${esc(m.typed)} to confirm</label><input class="input" id="cf-typed" data-input="modal" data-k="typedVal" autocomplete="off"></div>` : ''}`,
  foot: `<button class="btn" data-act="modal-close">Cancel</button><button class="btn ${m.danger ? 'btn-danger' : 'btn-primary'}" data-act="confirm-ok">${esc(m.ok)}</button>`,
});
MODALS.rules = () => ({ title: 'How this stays within LinkedIn\'s rules', body: rulesHtml(), foot: '<button class="btn btn-primary" data-act="modal-close">Got it</button>' });
MODALS.more = () => ({
  title: 'More', size: 'narrow',
  body: `<nav class="stack" style="gap:6px">${['leads', 'icp', 'write', 'templates', 'insights', 'settings'].map((v) => `<button class="btn btn-lg" style="justify-content:flex-start" data-act="go-close" data-view="${v}">${ic(VIEWS[v].icon)} ${VIEWS[v].label}</button>`).join('')}
    <button class="btn btn-lg btn-ghost" style="justify-content:flex-start" data-act="rules">${ic('shield')} LinkedIn rules</button></nav>`,
});
MODALS.profiles = () => ({
  title: 'LinkedIn profiles', size: 'narrow',
  body: `<div class="stack" style="gap:8px">${S.meta.profiles.map((x) => `<button class="icp-card" data-act="profile-switch" data-id="${x.id}" aria-current="${x.id === S.meta.active}"><b>${esc(x.name || 'Unnamed profile')}</b><span>${esc((ACCOUNT[x.accountType] || ACCOUNT.premium).label)}${x.company ? ' · ' + esc(x.company) : ''}${x.id === S.meta.active ? ' · active' : ''}</span></button>`).join('')}</div>
    <p class="hint" style="margin-top:12px">Each profile has its own leads, inbox, ICP and limits. No LinkedIn password is ever stored.</p>`,
  foot: `<button class="btn" data-act="go-settings" data-tab="profile">Edit profile</button><button class="btn btn-primary" data-act="profile-add">${ic('plus')} Add profile</button>`,
});
MODALS.profileAdd = () => ({
  title: 'Add a LinkedIn profile', size: 'narrow',
  body: `<form class="stack" data-submit="profile-add" id="pa-form">
    <div class="field"><label for="pa-name">Name on LinkedIn</label><input class="input" id="pa-name" name="name" required></div>
    <div class="field"><label for="pa-url">LinkedIn profile link</label><input class="input" id="pa-url" name="url" placeholder="https://www.linkedin.com/in/…"><span class="hint">No password needed. The person sends from their own LinkedIn.</span></div>
    <div class="field"><label for="pa-company">Company</label><input class="input" id="pa-company" name="company"></div>
    <div class="field"><label for="pa-plan">LinkedIn plan</label>${selectHtml('pa-plan', 'name="accountType"', { free: 'Free', premium: 'Premium', salesnav: 'Sales Navigator' }, 'premium')}</div>
    <label class="toggle" for="pa-icp"><input type="checkbox" id="pa-icp" name="copyIcp" checked> Copy my current ICPs to this profile</label>
  </form>`,
  foot: `<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" type="submit" form="pa-form">Add and switch</button>`,
});

/* ---------- Add leads ---------- */
MODALS.addLeads = (m) => {
  const tab = m.tab || 'one';
  const tabs = [['one', 'One lead'], ['paste', 'Paste a list'], ['csv', 'CSV file']].map(([k, v]) => `<button class="tab" role="tab" data-act="modal-tab" data-tab="${k}" aria-selected="${tab === k}">${v}</button>`).join('');
  const icpSel = icps().length ? `<div class="field"><label for="al-icp">ICP</label><select class="select" id="al-icp" data-change="modal" data-k="icpId">${icps().map((i) => `<option value="${i.id}" ${(m.icpId || icps()[0].id) === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</select></div>` : '';
  let body = '', foot = '';
  if (tab === 'one') {
    body = `<form class="stack" id="al-form" data-submit="add-lead">
      <div class="grid2">
        <div class="field"><label for="al-name">Name</label><input class="input" id="al-name" name="name" required></div>
        <div class="field"><label for="al-url">LinkedIn profile link</label><input class="input" id="al-url" name="url" placeholder="https://www.linkedin.com/in/… or a Sales Navigator link" data-input="al-url"></div>
        <div class="field"><label for="al-title">Title</label><input class="input" id="al-title" name="title"></div>
        <div class="field"><label for="al-company">Company</label><input class="input" id="al-company" name="company"></div>
        <div class="field"><label for="al-size">Company size</label><input class="input" id="al-size" name="companySize" list="al-sizes" placeholder="e.g. 11-50"><datalist id="al-sizes">${SIZE_BANDS.map((s) => `<option value="${s}"></option>`).join('')}</datalist></div>
        <div class="field"><label for="al-ind">Industry</label><input class="input" id="al-ind" name="industry"></div>
        <div class="field"><label for="al-loc">Location</label><input class="input" id="al-loc" name="location"></div>
        ${icpSel}
        <div class="field full"><label for="al-about">What you know about them <span class="muted">(optional)</span></label><textarea class="textarea" id="al-about" name="about" placeholder="Paste their headline, a line from their About section or a recent post. Notes get more personal."></textarea></div>
      </div>
      <input type="hidden" name="queue" id="al-queue" value="">
    </form>`;
    foot = `<button class="btn" data-act="modal-close">Cancel</button><button class="btn" type="submit" form="al-form">Add lead</button><button class="btn btn-send" data-act="al-add-queue">Add and queue invite</button>`;
  } else if (tab === 'paste') {
    const parsed = m.parsed || [];
    body = `<div class="stack">
      <div class="field"><label for="al-paste">Paste names, titles, companies and profile links</label><textarea class="textarea" id="al-paste" data-input="modal" data-k="paste" style="min-height:150px" placeholder="One person per line, for example:&#10;Sara Khan, Owner, Skyline Realty, https://www.linkedin.com/in/…&#10;Or paste rows from a spreadsheet.">${esc(m.paste || '')}</textarea></div>
      ${busyHtml('parse')}
      <div class="row">${AI.on ? `<button class="btn btn-primary btn-sm" data-act="al-parse-ai" ${ui.busy ? 'disabled' : ''}>${ic('sparkle')} Sort it with AI</button>` : ''}<button class="btn btn-sm" data-act="al-parse">Read as a simple list</button>${icps().length ? '<span class="spacer"></span>' + icpSel.replace('class="field"', 'class="field" style="min-width:200px"') : ''}</div>
      ${parsed.length ? `<div class="list-check">${parsed.map((p, i) => `<label for="alp-${i}"><input type="checkbox" id="alp-${i}" data-change="al-pick" data-i="${i}" ${p._skip ? '' : 'checked'}><span class="min0"><b>${esc(p.name)}</b> <span class="muted">${esc([p.title, p.company].filter(Boolean).join(' · '))}</span></span><span class="hint">${p._dup ? 'Already added' : safeLi(p.url) ? 'Has link' : ''}</span></label>`).join('')}</div>` : ''}
    </div>`;
    const n = parsed.filter((p) => !p._skip && !p._dup).length;
    foot = `<button class="btn" data-act="modal-close">Cancel</button>${parsed.length ? `<button class="btn btn-primary" data-act="al-add-parsed" ${n ? '' : 'disabled'}>Add ${plural(n, 'lead')}</button>` : ''}`;
  } else {
    const c = m.csv;
    const fields = [['name', 'Full name'], ['first', 'First name'], ['last', 'Last name'], ['title', 'Title'], ['company', 'Company'], ['url', 'Profile link'], ['location', 'Location'], ['industry', 'Industry'], ['companySize', 'Company size'], ['email', 'Email'], ['notes', 'Notes']];
    body = c ? `<div class="stack">
      <p class="hint">${esc(c.fileName)} · ${plural(c.rows.length, 'row')}. Match the columns, then import.</p>
      <div class="grid3">${fields.map(([k, lab]) => `<div class="field"><label for="map-${k}">${lab}</label><select class="select" id="map-${k}" data-change="csv-map" data-k="${k}"><option value="">(none)</option>${c.headers.map((h, i) => `<option value="${i}" ${c.map[k] === i ? 'selected' : ''}>${esc(h || 'Column ' + (i + 1))}</option>`).join('')}</select></div>`).join('')}</div>
      ${icpSel}
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Title</th><th>Company</th><th>Link</th></tr></thead><tbody>${csvLeads(c).slice(0, 5).map((l) => `<tr><td>${esc(l.name)}</td><td>${esc(l.title)}</td><td>${esc(l.company)}</td><td>${safeLi(l.url) ? 'Yes' : ''}</td></tr>`).join('')}</tbody></table></div>
    </div>` : `<div class="stack"><button class="dropzone" data-act="pick-csv" data-drop="csv">${ic('upload', 'lg')}<b>Choose a CSV file</b><span>or drop it here. Sales Navigator list exports, CRM exports and spreadsheets all work.</span></button></div>`;
    foot = `<button class="btn" data-act="modal-close">Cancel</button>${c ? `<button class="btn" data-act="csv-reset">Choose another file</button><button class="btn btn-primary" data-act="csv-import">Import ${plural(csvLeads(c).length, 'lead')}</button>` : ''}`;
  }
  return { title: 'Add leads', size: 'wide', body: `<div class="tabs" role="tablist">${tabs}</div>${body}`, foot };
};
function csvLeads(c) {
  const g = (r, k) => (c.map[k] === undefined || c.map[k] === '' ? '' : String(r[c.map[k]] ?? '').trim());
  return c.rows.map((r) => {
    const url = g(r, 'url');
    let name = g(r, 'name') || [g(r, 'first'), g(r, 'last')].filter(Boolean).join(' ');
    if (!name && url) name = slugName(url);
    return { name, first: g(r, 'first'), title: g(r, 'title'), company: g(r, 'company'), url, location: g(r, 'location'), industry: g(r, 'industry'), companySize: g(r, 'companySize'), email: g(r, 'email'), notes: g(r, 'notes') };
  }).filter((l) => l.name);
}
function addLeadsBatch(list, { icpId, source = 'manual', queue = false } = {}) {
  const idx = leadIndex(); let added = 0, dups = 0; const ids = [];
  const pid = P().id;
  for (const raw of list) {
    if (!raw || !String(raw.name || '').trim()) continue;
    if (findDup(raw, idx)) { dups++; continue; }
    const l = normLead({ ...raw, id: uid('l-'), profileId: pid, icpId: icpId || icps()[0]?.id || '', source, stage: 'new', t: { added: nowISO() } });
    if (raw.connectedOn) { l.stage = 'connected'; l.existing = true; l.t.connected = raw.connectedOn; }
    l.url = safeLi(l.url) || l.url;
    S.L.put(l); ids.push(l.id); added++;
    const k = liKey(l.url); if (k) idx.byUrl.set(k, l);
    const n = nameKey(l.name); if (n) { if (!idx.byName.has(n)) idx.byName.set(n, []); idx.byName.get(n).push(l); }
  }
  if (queue && ids.length) queueLeads(ids);
  changed();
  return { added, dups, ids };
}
function styleFor(i) {
  const ai = S.meta.ai;
  if (!ai.ab) return ai.style || 'peer';
  const keys = ['peer', 'specific', 'question', 'short', 'value'];
  return keys[(i + budget().week) % keys.length];
}
function queueLeads(ids) {
  let i = 0;
  for (const id of ids) {
    const l = S.lead(id); if (!l || !['new', 'nurture', 'lost'].includes(l.stage)) continue;
    l.stage = 'queued'; l.t.queued = nowISO(); l.skipUntil = ''; l.style = l.style || styleFor(i++);
    S.L.put(l);
  }
  changed();
}
function queueBest(n) {
  const fresh = S.leads().filter((l) => l.stage === 'new' && !scoreLead(l).excluded)
    .sort((a, b) => (scoreLead(b).score ?? -1) - (scoreLead(a).score ?? -1) || String(a.t.added).localeCompare(String(b.t.added)));
  const ids = fresh.slice(0, n).map((l) => l.id);
  queueLeads(ids);
  return ids.length;
}

/* ---------- Check acceptances ---------- */
MODALS.accepts = (m) => {
  const invited = S.leads().filter((l) => l.stage === 'invited').sort((a, b) => String(b.t.invited).localeCompare(String(a.t.invited)));
  const picked = m.picked || new Set();
  const tab = m.tab || 'paste';
  const tabs = [['paste', 'Paste my connections page'], ['tick', 'Tick them myself']].map(([k, v]) => `<button class="tab" role="tab" data-act="modal-tab" data-tab="${k}" aria-selected="${tab === k}">${v}</button>`).join('');
  const listHtml = (arr) => arr.length ? `<div class="list-check">${arr.map((l) => `<label for="acc-${l.id}"><input type="checkbox" id="acc-${l.id}" data-change="acc-pick" data-id="${l.id}" ${picked.has(l.id) ? 'checked' : ''}><span class="min0"><b>${esc(cleanName(l.name))}</b> <span class="muted">${esc(l.company || '')}</span></span><span class="hint">Invited ${esc(fmtDate(l.t.invited))}</span></label>`).join('')}</div>` : '';
  let body;
  if (tab === 'paste') {
    const found = m.found ? invited.filter((l) => m.found.includes(l.id)) : null;
    body = `<ol class="steps"><li>Open your <a class="link" href="${LI.connections}" target="_blank" rel="noopener noreferrer">Connections page</a> (sorted by recently added).</li><li>Select all (Ctrl+A or Cmd+A), copy, and paste below.</li><li>The desk finds the people you invited in that list.</li></ol>
      <div class="field" style="margin-top:12px"><label for="acc-paste">Pasted page</label><textarea class="textarea" id="acc-paste" data-input="modal" data-k="paste" style="min-height:110px">${esc(m.paste || '')}</textarea></div>
      <div class="row" style="margin-top:10px"><button class="btn btn-sm" data-act="acc-find">${ic('search')} Find matches</button>${found ? `<span class="hint">${found.length ? `${plural(found.length, 'match', 'matches')} among ${invited.length} pending invites` : 'No pending invites found in that text.'}</span>` : ''}</div>
      ${found && found.length ? `<div style="margin-top:12px">${listHtml(found)}</div>` : ''}`;
  } else {
    body = invited.length ? listHtml(invited) : '<p class="muted">No pending invites.</p>';
  }
  return { title: 'Who accepted?', size: 'wide', body: `<div class="tabs" role="tablist">${tabs}</div>${body}`, foot: `<button class="btn" data-act="modal-close">Close</button><button class="btn btn-primary" data-act="acc-apply" ${picked.size ? '' : 'disabled'}>Mark ${plural(picked.size, 'person', 'people')} as accepted</button>` };
};
function markAccepted(ids, when) {
  let n = 0;
  for (const id of ids) { const l = S.lead(id); if (!l || !['invited', 'queued', 'new'].includes(l.stage)) continue; l.stage = 'connected'; l.t.connected = when || nowISO(); S.L.put(l); n++; }
  changed(); return n;
}

/* ---------- LinkedIn export import ---------- */
MODALS.importLi = (m) => {
  const d = m.data;
  if (!d) {
    return {
      title: 'Import your LinkedIn data', size: 'wide',
      body: `<div class="stack">
        <p>${m.kind === 'connections' ? 'Use <b>Connections.csv</b> to find people in your network who match your ICP, and to spot who accepted your invites.' : m.kind === 'messages' ? 'Use <b>messages.csv</b> to bring in full threads with direct chat links. Conversations from the snapshot are matched and filled in.' : 'Use the files from LinkedIn\'s own data export: Connections, messages and Invitations.'}</p>
        <button class="dropzone" data-act="pick-export" data-drop="export">${ic('upload', 'lg')}<b>Choose the .zip or CSV files</b><span>or drop them here. Nothing is uploaded anywhere except your own desk.</span></button>
        ${busyHtml('import')}
        <details class="more"><summary>${ic('chevR')} How to get the export</summary><ol class="steps" style="margin-top:8px">
          <li><a class="link" href="${LI.exportData}" target="_blank" rel="noopener noreferrer">Open LinkedIn → Settings → Data privacy → Get a copy of your data</a>.</li>
          <li>Pick <b>“Want something in particular?”</b>, tick Connections, Messages and Invitations, then Request archive.</li>
          <li>LinkedIn emails you a link, usually within minutes. Download the .zip and choose it here.</li></ol></details>
      </div>`,
      foot: '<button class="btn" data-act="modal-close">Close</button>',
    };
  }
  const icp = icps()[0];
  const parts = [];
  if (d.messages) {
    const w = d.messages.convos;
    const since = m.since ?? 365; const onlyWaiting = m.onlyWaiting !== false;
    const cut = since ? Date.now() - since * DAY : 0;
    const plan = planMessages(w, { onlyWaiting, since });
    parts.push(`<section class="panel pad stack"><div class="sec-h" style="margin:0"><h2>Messages</h2><span class="hint">${plural(w.length, 'conversation')} · you are “${esc(d.messages.me || '?')}”</span></div>
      <div class="row"><label class="toggle" for="im-wait"><input type="checkbox" id="im-wait" data-change="modal-bool" data-k="onlyWaiting" ${onlyWaiting ? 'checked' : ''}> Only conversations where they wrote last</label>
        <label class="lbl" for="im-since">From the last</label><select class="select" id="im-since" data-change="modal-num" data-k="since" style="width:auto">${[[90, '3 months'], [180, '6 months'], [365, '12 months'], [0, 'all time']].map(([v, l]) => `<option value="${v}" ${since === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <p class="hint">${plan.add ? `${plural(plan.add, 'new conversation')} will be added` : 'No new conversations match these filters'}${plan.merge ? `, and ${plural(plan.merge, 'conversation')} already on your desk will get the full thread and chat link` : ''}.</p>
      <div class="row"><button class="btn btn-primary btn-sm" data-act="im-messages" ${m.doneMessages ? 'disabled' : ''}>${m.doneMessages ? ic('check') + ' Imported' : 'Import conversations'}</button></div></section>`);
  }
  if (d.connections) {
    const conns = d.connections;
    const invited = S.leads().filter((l) => l.stage === 'invited');
    const byUrl = new Map(conns.filter((c) => liKey(c.url)).map((c) => [liKey(c.url), c]));
    const byName = new Map(conns.map((c) => [nameKey(c.name), c]));
    const acc = invited.filter((l) => (liKey(l.url) && byUrl.has(liKey(l.url))) || byName.has(nameKey(l.name)));
    const mined = icp ? (m.mined || mineNetwork(conns, icp)) : [];
    if (icp && !m.mined) m.mined = mined;
    const mp = m.minedPicked || new Set(mined.slice(0, 50).map((c) => c.url || c.name));
    if (!m.minedPicked) m.minedPicked = mp;
    parts.push(`<section class="panel pad stack"><div class="sec-h" style="margin:0"><h2>Connections</h2><span class="hint">${plural(conns.length, 'connection')}</span></div>
      ${acc.length ? `<div class="row"><span>${plural(acc.length, 'person', 'people')} you invited ${acc.length === 1 ? 'is' : 'are'} now connected.</span><button class="btn btn-sm btn-primary" data-act="im-accepts" ${m.doneAccepts ? 'disabled' : ''}>${m.doneAccepts ? ic('check') + ' Marked' : 'Mark as accepted'}</button></div>` : '<p class="hint">None of your pending invites appear in this file yet.</p>'}
      ${icp ? `<div class="divider" style="margin:4px 0"></div><div><b>${plural(mined.length, 'connection')} match “${esc(icp.name)}”.</b> <span class="hint">Matched on title and company words only, since the export has no industry or size. Check before messaging.</span></div>
        ${mined.length ? `<div class="list-check">${mined.slice(0, 300).map((c, i) => `<label for="mn-${i}"><input type="checkbox" id="mn-${i}" data-change="mine-pick" data-key="${esc(c.url || c.name)}" ${mp.has(c.url || c.name) ? 'checked' : ''}><span class="min0"><b>${esc(c.name)}</b> <span class="muted">${esc([c.title, c.company].filter(Boolean).join(' · '))}</span></span><span class="hint">${esc(c.why.join(', '))}</span></label>`).join('')}</div>
        <div class="row"><button class="btn btn-sm btn-primary" data-act="im-mine" ${!mp.size || m.doneMine ? 'disabled' : ''}>${m.doneMine ? ic('check') + ' Added' : `Add ${plural(mp.size, 'person', 'people')} as leads to reconnect with`}</button><span class="hint">They go to Follow-ups with a reconnect message, not a cold invite.</span></div>` : ''}` : '<p class="hint">Create an ICP to find matches in your connections.</p>'}
    </section>`);
  }
  if (d.invitations) {
    const out = d.invitations.filter((x) => x.dir === 'OUTGOING');
    const leads = S.leads().filter((l) => !l.t.invited && ['new', 'queued'].includes(l.stage));
    const upd = leads.filter((l) => out.some((x) => (liKey(x.invitee) && liKey(x.invitee) === liKey(l.url)) || nameKey(x.to) === nameKey(l.name)));
    parts.push(`<section class="panel pad stack"><div class="sec-h" style="margin:0"><h2>Invitations</h2><span class="hint">${plural(out.length, 'sent invite')}</span></div>
      ${upd.length ? `<div class="row"><span>${plural(upd.length, 'lead')} already got an invite from you on LinkedIn.</span><button class="btn btn-sm btn-primary" data-act="im-invites" ${m.doneInvites ? 'disabled' : ''}>${m.doneInvites ? ic('check') + ' Updated' : 'Mark them as invited'}</button></div>` : '<p class="hint">Nothing to update in your leads.</p>'}</section>`);
  }
  return { title: 'Import your LinkedIn data', size: 'wide', body: `<div class="stack">${busyHtml('import')}${parts.join('') || '<p>No LinkedIn files recognised. Choose Connections.csv, messages.csv or Invitations.csv.</p>'}</div>`, foot: `<button class="btn" data-act="im-reset">Choose other files</button><button class="btn btn-primary" data-act="modal-close">Done</button>` };
};
async function readExportFiles(files) {
  const out = {};
  const handle = (name, text) => {
    const rows = parseCSV(text); if (!rows.length) return;
    const kind = detectCsv(rows);
    if (kind === 'messages') out.messages = parseMessages(rows, P().name);
    else if (kind === 'connections') out.connections = parseConnections(rows);
    else if (kind === 'invitations') out.invitations = parseInvitations(rows);
  };
  for (const f of files) {
    if (/\.zip$/i.test(f.name) || f.type === 'application/zip') {
      if (!window.JSZip) await loadScript(['https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js']);
      const zip = await window.JSZip.loadAsync(f);
      for (const entry of Object.values(zip.files)) {
        if (entry.dir || !/(^|\/)(connections|messages|invitations)\.csv$/i.test(entry.name)) continue;
        handle(entry.name, await entry.async('string'));
      }
    } else if (/\.csv$/i.test(f.name) || /text|csv/.test(f.type)) {
      handle(f.name, await f.text());
    }
  }
  return out;
}
function guessCategory(text, lastFrom) {
  const t = String(text || '').toLowerCase();
  if (lastFrom === 'me') return 'review';
  if (/congrat|anniversary|new role|new position/.test(t)) return 'congrats';
  if (t.length < 40 && /^(thanks|thank you|thx|great|awesome|same here|ok|okay|noted|sure)\b/.test(t.trim())) return 'thanks';
  if (/intern(ship)?|\bjob\b|vacanc|opening|\bcv\b|resume|looking for (an? )?(opportunit|role|position)/.test(t)) return 'job';
  if (/webinar|summit|conference|meetup|join us|you're invited|you are invited|rsvp|event/.test(t)) return 'event';
  if (/calendar|schedule a|good time|hop on a call|quick call|15.?min|30.?min|meet(ing)? next week/.test(t)) return /we help|our (team|services|agency)|i help/.test(t) ? 'pitch' : 'meeting';
  if (/we help|our (team|services|agency|company) (can|helps|offers)|outsourc|offshore|lead gen|appointments|book(ing)? \d+|white.?label|i help (companies|agencies|founders)/.test(t)) return 'pitch';
  if (/partner(ship)?|collaborat/.test(t)) return 'partner';
  return 'review';
}
function planMessages(list, { onlyWaiting = true, since = 365 } = {}) {
  const cut = since ? Date.now() - since * DAY : 0;
  const threads = new Set(S.convos().filter((c) => c.thread).map((c) => c.thread));
  const names = new Set(S.convos().filter((c) => !c.thread).map((c) => nameKey(c.name)));
  let merge = 0, add = 0;
  for (const m of list) {
    if (m.group || m.sponsored) continue;
    if (threads.has(m.thread) || names.has(nameKey(m.name))) { merge++; continue; }
    if (cut && new Date(m.lastAt).getTime() < cut) continue;
    if (onlyWaiting && m.lastFrom !== 'them') continue;
    add++;
  }
  return { merge, add };
}
function applyMessages(list, { onlyWaiting = true, since = 365 } = {}) {
  const cut = since ? Date.now() - since * DAY : 0;
  const existing = S.convos();
  const byThread = new Map(existing.filter((c) => c.thread).map((c) => [c.thread, c]));
  const byName = new Map();
  for (const c of existing) if (!c.thread) { const k = nameKey(c.name); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(c); }
  const idx = leadIndex(); const pid = P().id;
  let added = 0, merged = 0; const newIds = [];
  for (const m of list) {
    if (m.group || m.sponsored) continue;
    let target = byThread.get(m.thread);
    if (!target) { const cands = byName.get(nameKey(m.name)) || []; target = cands.find((c) => c.source === 'snapshot') || cands[0]; if (target) byName.set(nameKey(m.name), cands.filter((c) => c !== target)); }
    const lead = findDup({ name: m.name, url: m.url, company: '' }, idx);
    if (target) {
      target.thread = m.thread; target.url = target.url || m.url; target.messages = m.messages; target.partial = false; target.msgCount = m.msgCount;
      if (!target.lastAt || m.lastAt >= target.lastAt) { target.lastAt = m.lastAt; target.lastFrom = m.lastFrom; target.preview = trunc(m.messages[m.messages.length - 1]?.text || target.preview, 300); }
      if (m.lastFrom === 'me' && target.status === 'open') target.status = HOT_CATS.includes(target.category) ? 'waiting' : 'done';
      if (lead) { target.leadId = lead.id; lead.convoId = target.id; }
      S.C.put(target); merged++;
    } else {
      if (cut && new Date(m.lastAt).getTime() < cut) continue;
      if (onlyWaiting && m.lastFrom !== 'them') continue;
      const lastTheirs = [...m.messages].reverse().find((x) => !x.me);
      const c = normConvo({
        id: uid('cv-'), profileId: pid, name: m.name, url: m.url, thread: m.thread, category: lead && lead.t.invited ? 'warm' : guessCategory(lastTheirs?.text, m.lastFrom),
        status: m.lastFrom === 'them' ? 'open' : 'done', lastAt: m.lastAt, lastFrom: m.lastFrom, msgCount: m.msgCount, inmail: m.inmail,
        preview: trunc(lastTheirs?.text || '', 300), messages: m.messages, partial: false, source: 'export', leadId: lead?.id || '', needsSort: true,
      });
      S.C.put(c); newIds.push(c.id); added++;
      if (lead) lead.convoId = c.id;
    }
    if (lead && m.lastFrom === 'them' && ['invited', 'connected', 'messaged'].includes(lead.stage)) {
      const theirs = [...m.messages].reverse().find((x) => !x.me);
      if (theirs && (!lead.t.welcomed || theirs.at > lead.t.welcomed || lead.stage !== 'messaged')) { lead.stage = 'replied'; lead.t.replied = theirs.at || nowISO(); if (!lead.t.connected) lead.t.connected = lead.t.replied; }
      S.L.put(lead);
    }
  }
  changed();
  return { added, merged, newIds };
}
function applyInvitations(invs) {
  const out = invs.filter((x) => x.dir === 'OUTGOING'); let n = 0;
  for (const l of S.leads()) {
    if (l.t.invited || !['new', 'queued'].includes(l.stage)) continue;
    const hit = out.find((x) => (liKey(x.invitee) && liKey(x.invitee) === liKey(l.url)) || nameKey(x.to) === nameKey(l.name));
    if (hit) { l.stage = 'invited'; l.t.invited = hit.at || nowISO(); l.inviteNote = hit.message || l.inviteNote; S.L.put(l); n++; }
  }
  changed(); return n;
}

/* ---------- Conversations ---------- */
MODALS.addConvo = () => ({
  title: 'Add a conversation', size: 'wide',
  body: `<form class="stack" id="ac-form" data-submit="add-convo"><div class="grid2">
    <div class="field"><label for="ac-name">Their name</label><input class="input" id="ac-name" name="name" required></div>
    <div class="field"><label for="ac-company">Company</label><input class="input" id="ac-company" name="company"></div>
    <div class="field"><label for="ac-url">Profile or chat link</label><input class="input" id="ac-url" name="url" placeholder="https://www.linkedin.com/…"></div>
    <div class="field"><label for="ac-cat">Type</label><select class="select" id="ac-cat" name="category"><option value="">Guess from the text</option>${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></div>
    <div class="field full"><label for="ac-text">Paste the conversation</label><textarea class="textarea" id="ac-text" name="text" required style="min-height:150px" placeholder="Copy the messages from LinkedIn and paste them here."></textarea></div></div></form>`,
  foot: '<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" type="submit" form="ac-form">Add to inbox</button>',
});
MODALS.replied = (m) => {
  const l = S.lead(m.id);
  return {
    title: `${esc(cleanName(l?.name || ''))} replied`, size: 'wide',
    body: `<div class="stack"><p>Paste their reply so the desk can draft your answer. You can also skip this.</p>
      <div class="field"><label for="rp-text">Their reply</label><textarea class="textarea" id="rp-text" data-input="modal" data-k="text" style="min-height:120px">${esc(m.text || '')}</textarea></div>
      <div class="field"><label for="rp-cat">What kind of reply is it?</label><select class="select" id="rp-cat" data-change="modal" data-k="cat">${[['warm', 'Interested or asking questions'], ['meeting', 'Wants to meet'], ['declined', 'Not now or no'], ['network', 'Friendly, no buying signal']].map(([k, v]) => `<option value="${k}" ${(m.cat || 'warm') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>`,
    foot: '<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" data-act="replied-save">Save and draft a reply</button>',
  };
};
MODALS.clearNoReply = () => {
  const list = noReplyCandidates();
  const by = list.reduce((a, c) => { a[c.category] = (a[c.category] || 0) + 1; return a; }, {});
  return {
    title: 'Clear conversations that need no reply', size: 'narrow',
    body: `<p>These get marked done. They stay in the Done filter and you can reopen any of them.</p><ul class="steps" style="margin-top:10px">${Object.entries(by).map(([k, n]) => `<li>${n} × ${esc(CATS[k].label)}</li>`).join('')}</ul>`,
    foot: `<button class="btn" data-act="modal-close">Cancel</button><button class="btn btn-primary" data-act="clear-noreply-ok">Mark ${list.length} as done</button>`,
  };
};
MODALS.restore = (m) => ({
  title: 'Restore a backup', size: 'narrow',
  body: m.data ? `<p>This backup has ${plural(Object.keys(m.data.leads || {}).length, 'lead')} and ${plural(Object.keys(m.data.convos || {}).length, 'conversation')}. Restoring adds anything missing and keeps what you have.</p>`
    : `<button class="dropzone" data-act="pick-backup" data-drop="backup">${ic('upload', 'lg')}<b>Choose a backup file</b><span>outreach-desk-backup.json</span></button>`,
  foot: `<button class="btn" data-act="modal-close">Cancel</button>${m.data ? '<button class="btn btn-primary" data-act="restore-ok">Restore</button>' : ''}`,
});
