/* ================= Domain logic ================= */
const P = () => S.profile() || newProfile();
const noteLimit = () => (ACCOUNT[P().accountType] || ACCOUNT.premium).note;
const icps = () => (S.meta?.icps || []).filter((i) => !i.profileId || i.profileId === P().id);
const icpById = (id) => (S.meta?.icps || []).find((i) => i.id === id) || null;
const icpFor = (lead) => icpById(lead?.icpId) || icps()[0] || null;
const templates = () => (Array.isArray(S.meta?.templates) && S.meta.templates.length ? S.meta.templates : DEFAULT_TEMPLATES);
const tplsOf = (type) => templates().filter((t) => t.type === type && t.active !== false);
function pickTpl(type, seed) { const list = tplsOf(type); return list.length ? list[hashStr(String(seed) + type) % list.length] : null; }
const snoozed = (x) => !!x.snoozeUntil && new Date(x.snoozeUntil) > new Date();
const myFirst = () => { const p = P(); return p.first || firstName(p.name) || ''; };
const shortCompany = (c) => String(c || '').replace(/[,\s]+(LLC|L\.L\.C\.|Inc\.?|Ltd\.?|Limited|Pvt\.?\s*Ltd\.?|\(Pvt\.?\)\s*Ltd\.?|Corp\.?|Co\.)$/i, '').trim();

/* ---------- ICP fit ---------- */
function sizeRange(s) {
  s = String(s ?? '').toLowerCase().replace(/,/g, '');
  if (!s.trim()) return null;
  if (/self/.test(s)) return [1, 1];
  const nums = (s.match(/\d+/g) || []).map(Number);
  if (!nums.length) return null;
  if (/\+/.test(s) && nums.length === 1) return [nums[0], Infinity];
  return [Math.min(...nums), Math.max(...nums)];
}
function scoreLead(lead, icp) {
  icp = icp || icpFor(lead);
  if (!icp) return { score: null, reasons: [] };
  if (lead.q && lead.q.pri != null && (!lead.icpId || lead.icpId === icp.id)) return { score: lead.q.pri, reasons: lead.q.why || [], tier: lead.q.tier };
  return derived('score:' + lead.id + ':' + icp.id, () => {
    const reasons = [];
    const hay = norm([lead.title, lead.company, lead.industry, lead.about, lead.headline].join(' '));
    const ex = (icp.excludes || []).find((x) => hasPhrase(hay, x));
    if (ex) return { score: 0, reasons: [`Excluded word: ${ex}`], excluded: true };
    let s = 0;
    const t = (icp.titles || []).find((x) => hasPhrase(norm([lead.title, lead.headline].join(' ')), x));
    if (t) { s += 40; reasons.push(`Role: ${t}`); }
    const i = (icp.industries || []).find((x) => hasPhrase(hay, x));
    if (i) { s += 30; reasons.push(`Industry: ${i}`); }
    const r = sizeRange(lead.companySize);
    if (!(icp.sizes || []).length) s += 20;
    else if (r) {
      const ok = icp.sizes.some((b) => { const br = sizeRange(b); return br && r[0] <= br[1] && r[1] >= br[0]; });
      if (ok) { s += 20; reasons.push(`Size: ${lead.companySize}`); } else reasons.push(`Size ${lead.companySize} is outside target`);
    } else { s += 8; reasons.push('Size unknown'); }
    const locs = icp.locations || [];
    if (icpWantsUS(icp)) {
      const us = isUS(lead.location);
      if (us === false) return { score: 0, reasons: ['Outside the USA'], excluded: true };
      if (us) { s += 10; reasons.push('In the USA'); } else s += 4;
    } else if (!locs.length) s += 10;
    else if (lead.location) { const l = locs.find((x) => hasPhrase(norm(lead.location), x)); if (l) { s += 10; reasons.push(`Location: ${l}`); } else reasons.push('Outside target locations'); }
    else s += 4;
    return { score: Math.min(100, s), reasons };
  });
}
function fitHtml(lead) {
  const { score } = scoreLead(lead);
  if (score == null) return '<span class="muted">—</span>';
  return `<span class="fit" title="ICP fit ${score} of 100"><i style="--w:${score}%"></i>${score}</span>`;
}

/* ---------- Budget & schedule ---------- */
function budget() {
  return derived('budget', () => {
    const p = P(); const tz = p.limits.tz || guessTz(); const today = tzKey(Date.now(), tz);
    let day = 0, week = 0;
    for (const l of S.leads()) {
      const t = l.t.invited; if (!t) continue;
      if (tzKey(t, tz) === today) day++;
      if (daysSince(t) < 7) week++;
    }
    const perDay = +p.limits.day || 20, perWeek = +p.limits.week || 100;
    const leftDay = Math.max(0, perDay - day), leftWeek = Math.max(0, perWeek - week);
    return { day, week, perDay, perWeek, leftDay, leftWeek, left: Math.min(leftDay, leftWeek) };
  });
}
function fmtClock(h, m) { const ap = h >= 12 ? 'PM' : 'AM'; const h12 = ((h + 11) % 12) + 1; return `${h12}:${String(m).padStart(2, '0')} ${ap}`; }
function tzShort(tz) {
  try {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date()).find((x) => x.type === 'timeZoneName')?.value;
    if (s && !/^(GMT|UTC)[+-]/.test(s)) return s;
  } catch { /* unknown zone */ }
  const known = { 'Asia/Karachi': 'PKT', 'Asia/Dubai': 'GST', 'Asia/Kolkata': 'IST', 'Europe/London': 'UK time' };
  return known[tz] || String(tz).split('/').pop().replace(/_/g, ' ');
}
function sessionInfo(p = P()) {
  const tz = p.limits.tz || guessTz();
  const [hh, mm] = String(p.limits.time || '15:00').split(':').map((x) => +x || 0);
  const now = tzNow(tz);
  const nowMin = now.h * 60 + now.m, target = hh * 60 + mm;
  const workday = (p.limits.workdays || [1, 2, 3, 4, 5]).includes(now.wd);
  let when;
  if (!workday) when = 'no session today';
  else if (nowMin < target) { const d = target - nowMin; when = 'in ' + (d >= 60 ? Math.floor(d / 60) + 'h ' : '') + (d % 60) + 'm'; }
  else if (nowMin < target + 120) when = 'now';
  else when = 'wrapped for today';
  return { tz, hh, mm, label: fmtClock(hh, mm), tzLabel: tzShort(tz), when, workday, now };
}
function gcalLink(p = P()) {
  const tz = p.limits.tz || guessTz();
  const { hh, mm } = sessionInfo(p);
  const days = p.limits.workdays?.length ? p.limits.workdays : [1, 2, 3, 4, 5];
  const now = tzNow(tz); const nowMin = now.h * 60 + now.m;
  let add = 0;
  for (let i = 0; i < 8; i++) { const wd = (now.wd + i) % 7; if (days.includes(wd) && (i > 0 || nowMin < hh * 60 + mm)) { add = i; break; } }
  const key = tzKey(Date.now() + add * DAY, tz).replace(/-/g, '');
  const pad = (n) => String(n).padStart(2, '0');
  const endMin = hh * 60 + mm + 45;
  const byday = days.map((d) => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d]).join(',');
  const q = new URLSearchParams({
    action: 'TEMPLATE', text: 'LinkedIn outreach session',
    details: 'Open Outreach Desk and work through Today: replies, welcomes, follow-ups, then invites. You send everything on LinkedIn yourself.',
    dates: `${key}T${pad(hh)}${pad(mm)}00/${key}T${pad(Math.floor(endMin / 60) % 24)}${pad(endMin % 60)}00`,
    ctz: tz, recur: `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
  });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}
function activeChecks(p = P()) {
  const today = tzKey(Date.now(), p.limits.tz || guessTz());
  return (p.checks || []).filter((c) => !c.until || c.until >= today).map((c) => ({ ...c, done: c.doneOn === today }));
}

/* ---------- Follow-up engine ---------- */
function leadDue(l) {
  const c = P().cadence; const t = l.t || {};
  switch (l.stage) {
    case 'invited': return daysSince(t.invited) >= c.withdraw ? { kind: 'withdraw', since: t.invited } : null;
    case 'connected': return t.welcomed ? null : { kind: l.existing ? 'reconnect' : 'welcome', since: t.connected };
    case 'messaged':
      if (t.fu2) return daysSince(t.fu2) >= c.nurture ? { kind: 'nurture', since: t.fu2 } : null;
      if (t.fu1) return daysSince(t.fu1) >= c.fu2 ? { kind: 'fu2', since: t.fu1 } : null;
      return daysSince(t.welcomed) >= c.fu1 ? { kind: 'fu1', since: t.welcomed } : null;
    default: return null;
  }
}
function dueLists() {
  return derived('due', () => {
    const out = { welcome: [], reconnect: [], fu1: [], fu2: [], nurture: [], withdraw: [], nudge: [] };
    for (const l of S.leads()) { if (snoozed(l)) continue; const d = leadDue(l); if (d) out[d.kind].push(l); }
    for (const c of S.convos()) if (c.status === 'waiting' && c.followUpAt && new Date(c.followUpAt) <= new Date() && !snoozed(c)) out.nudge.push(c);
    return out;
  });
}
const sendableDue = () => { const d = dueLists(); return d.welcome.length + d.reconnect.length + d.fu1.length + d.fu2.length + d.nudge.length; };

/* ---------- Inbox triage ---------- */
function recommend(c) {
  if (c.status === 'done' || c.status === 'archived') return { act: 'done', label: 'Done' };
  if (c.status === 'waiting') return { act: 'wait', label: c.followUpAt ? `You replied. Nudge ${new Date(c.followUpAt) <= new Date() ? 'now' : 'on ' + fmtDate(c.followUpAt)} if they stay quiet.` : 'You replied. Waiting on them.' };
  if (snoozed(c)) return { act: 'snoozed', label: `Snoozed until ${fmtDate(c.snoozeUntil)}` };
  const age = daysSince(c.lastAt); const cat = c.category;
  if (c.lastFrom === 'me' && !HOT_CATS.includes(cat)) return { act: 'optional', label: 'Your message was last. Nothing to answer.' };
  if (HOT_CATS.includes(cat)) {
    if (cat === 'meeting' && c.partial) return { act: 'reply', hot: true, label: age > 45 ? 'Check who they are, then reopen with a short apology' : 'Check who they are, then offer a time' };
    return { act: 'reply', hot: true, label: age > 45 ? 'Reopen it: short apology for the delay, then one clear next step' : 'Reply today and suggest a next step' };
  }
  if (cat === 'declined') return age > 90 ? { act: 'reply', label: 'Budgets reset since then: a light check-in is fair' } : { act: 'optional', label: 'Leave it for now' };
  if (cat === 'network') return age > 540 ? { act: 'optional', label: 'Old thread: an optional reconnect note' } : { act: 'reply', label: 'Friendly reply with one question' };
  if (cat === 'partner') return { act: 'reply', label: 'Ask for specifics, or decline politely' };
  if (cat === 'personal') return age > 540 ? { act: 'optional', label: 'Old personal note: reply if you want to reconnect' } : { act: 'reply', label: 'A personal reply' };
  if (cat === 'review') return { act: 'look', label: 'Only a preview is saved. Open it on LinkedIn, then paste the thread here' };
  if (cat === 'congrats') return age > 60 ? { act: 'optional', label: 'Months old: a late thank-you is still kind, or mark done' } : { act: 'reply', label: 'Say thanks' };
  if (cat === 'job') return age > 120 ? { act: 'optional', label: 'Old request: send a kind no or mark done' } : { act: 'reply', label: 'Kind reply' };
  if (cat === 'event') return { act: 'optional', label: age > 30 ? 'The event has likely passed: no reply needed' : 'Decline or RSVP' };
  if (cat === 'pitch') return { act: 'optional', label: 'No reply needed, or a polite no' };
  return { act: 'none', label: 'No reply needed' };
}
function convoRank(c) { return (c.priority || CATS[c.category]?.pr || 3); }
function inboxMatches(c, f) {
  const g = CATS[c.category]?.group;
  const open = c.status === 'open' && !snoozed(c);
  switch (f) {
    case 'reply': return open && recommend(c).act === 'reply';
    case 'waiting': return c.status === 'waiting';
    case 'done': return c.status === 'done' || c.status === 'archived';
    case 'all': return true;
    default: return open && g === f;
  }
}
function inboxList(f, q) {
  const qn = norm(q || '');
  const list = S.convos().filter((c) => inboxMatches(c, f) && (!qn || norm([c.name, c.company, c.preview, c.headline].join(' ')).includes(qn)));
  if (f === 'done') return list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return list.sort((a, b) => convoRank(a) - convoRank(b) || String(b.lastAt).localeCompare(String(a.lastAt)));
}
function inboxCounts() {
  return derived('inboxCounts', () => Object.fromEntries(INBOX_FILTERS.map((f) => [f.id, S.convos().filter((c) => inboxMatches(c, f.id)).length])));
}
function noReplyCandidates() {
  return S.convos().filter((c) => c.status === 'open' && !snoozed(c) && ['none', 'optional'].includes(recommend(c).act)
    && ['fyi', 'pitch'].includes(CATS[c.category]?.group));
}

/* ---------- Templates ---------- */
function sorryFor(c) { const d = daysSince(c.lastAt); return d > 180 ? 'Sorry for the very late reply.' : d > 21 ? 'Sorry for the slow reply.' : ''; }
function tplCtx(lead, extra = {}) {
  const p = P(); const icp = icpFor(lead);
  return Object.assign({
    first: lead?.first || firstName(lead?.name) || 'there',
    name: cleanName(lead?.name || ''),
    title: lead?.title || '', company: lead?.company || '',
    city: String(lead?.location || '').split(',')[0].trim(),
    industry: String(lead?.industry || icp?.industries?.[0] || 'your industry').toLowerCase(),
    my_first: myFirst(), my_name: p.name || '', my_company: shortCompany(p.company),
    offer: String(p.offer || '').trim(), cta: icp?.cta || p.cta || 'a quick call',
    calendar: safeHttp(p.calendar) ? p.calendar.trim() : '', careers: p.careers || '', sorry: '',
  }, extra);
}
function fillTpl(body, ctx) {
  const has = (seg) => [...seg.matchAll(/\{(\w+)\}/g)].every((m) => String(ctx[m[1]] ?? '').trim());
  let out = String(body ?? '').replace(/\[\[([\s\S]*?)\]\]/g, (_, inner) => { for (const alt of inner.split('||')) if (has(alt)) return alt; return ''; });
  out = out.replace(/\{(\w+)\}/g, (_, v) => String(ctx[v] ?? '').trim());
  return out.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.!?;:])/g, '$1').replace(/([^.])\.\.(?!\.)/g, '$1.').replace(/\n{3,}/g, '\n\n').trim();
}
function convoAsLead(c) {
  const l = c.leadId && S.lead(c.leadId);
  return l || { id: c.id, name: c.name, first: firstName(c.name), company: c.company, title: c.headline, industry: '' };
}
function tplDraft(kind, lead, seed) { const t = pickTpl(kind, seed || lead.id); return t ? fillTpl(t.body, tplCtx(lead)) : ''; }
function tplReply(c, seed) {
  const t = pickTpl('reply:' + c.category, seed || c.id) || pickTpl('reply:review', seed || c.id);
  return t ? fillTpl(t.body, tplCtx(convoAsLead(c), { sorry: sorryFor(c) })) : '';
}
function fitNote(text, limit) {
  text = String(text || '').trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (end > limit * 0.6) return cut.slice(0, end + 1).trim();
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + '.';
}

/* ---------- Links ---------- */
function leadLink(l) {
  const u = safeLi(l.url);
  if (u) return { href: u, label: /\/sales\//.test(u) ? 'Sales Navigator' : 'profile', direct: true };
  return { href: LI.search([cleanName(l.name), shortCompany(l.company)].filter(Boolean).join(' ')), label: 'LinkedIn search', direct: false };
}
function convoLink(c) {
  if (c.thread) return { href: LI.thread(c.thread), label: 'chat', direct: true };
  const u = safeLi(c.url);
  if (u) return { href: u, label: 'profile', direct: true, viaProfile: true };
  return { href: LI.messaging, label: 'Messaging', direct: false };
}

/* ---------- Stats ---------- */
function statsFor(days) {
  return derived('stats:' + days, () => {
    const since = days ? Date.now() - days * DAY : 0;
    const inP = (iso) => !!iso && new Date(iso).getTime() >= since;
    const leads = S.leads();
    const invitedL = leads.filter((l) => inP(l.t.invited));
    const welcomedL = leads.filter((l) => inP(l.t.welcomed));
    const out = {
      added: leads.filter((l) => inP(l.t.added)).length,
      invited: invitedL.length,
      accepted: invitedL.filter((l) => l.t.connected).length,
      welcomed: welcomedL.length,
      repliedLeads: welcomedL.filter((l) => l.t.replied).length,
      replied: leads.filter((l) => inP(l.t.replied)).length,
      meetings: leads.filter((l) => inP(l.t.meeting)).length,
      won: leads.filter((l) => l.stage === 'won' && inP(l.t.closed)).length,
      repliesSent: 0, byStyle: {}, byIcp: {},
    };
    for (const c of S.convos()) out.repliesSent += (c.sent || []).filter(inP).length;
    for (const l of invitedL) {
      const k = l.inviteStyle || 'template';
      (out.byStyle[k] = out.byStyle[k] || { n: 0, acc: 0 }).n++;
      if (l.t.connected) out.byStyle[k].acc++;
      const ik = l.icpId || 'none';
      (out.byIcp[ik] = out.byIcp[ik] || { n: 0, acc: 0 }).n++;
      if (l.t.connected) out.byIcp[ik].acc++;
    }
    return out;
  });
}
function seriesInvites(days) {
  const tz = P().limits.tz || guessTz();
  const leads = S.leads().filter((l) => l.t.invited);
  if (days && days <= 31) {
    const keys = []; for (let i = days - 1; i >= 0; i--) keys.push(tzKey(Date.now() - i * DAY, tz));
    const counts = Object.fromEntries(keys.map((k) => [k, 0]));
    for (const l of leads) { const k = tzKey(l.t.invited, tz); if (k in counts) counts[k]++; }
    return keys.map((k) => { const d = new Date(k + 'T12:00:00Z'); return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }), v: counts[k] }; });
  }
  const weeks = days ? Math.ceil(days / 7) : 13;
  const arr = Array.from({ length: weeks }, (_, i) => ({ start: Date.now() - (weeks - i) * 7 * DAY, v: 0 }));
  for (const l of leads) { const age = daysSince(l.t.invited); const idx = weeks - 1 - Math.floor(age / 7); if (idx >= 0 && idx < weeks) arr[idx].v++; }
  return arr.map((w) => ({ label: new Date(w.start + DAY).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), v: w.v, week: true }));
}

/* ---------- Dedupe & matching ---------- */
function leadIndex() {
  return derived('leadIndex', () => {
    const byUrl = new Map(), byName = new Map();
    for (const l of S.leads()) {
      const k = liKey(l.url); if (k) byUrl.set(k, l);
      const n = nameKey(l.name); if (n) { if (!byName.has(n)) byName.set(n, []); byName.get(n).push(l); }
    }
    return { byUrl, byName };
  });
}
function findDup(l, idx = leadIndex()) {
  const k = liKey(l.url); if (k && idx.byUrl.has(k)) return idx.byUrl.get(k);
  const n = nameKey(l.name); if (!n) return null;
  const same = idx.byName.get(n) || [];
  const ck = norm(shortCompany(l.company));
  return same.find((x) => !ck || !norm(x.company) || norm(shortCompany(x.company)) === ck) || null;
}
function namesInText(text, leads) {
  const hay = ' ' + norm(text) + ' ';
  return leads.filter((l) => { const k = nameKey(l.name); return k && k.split(' ').length >= 2 && hay.includes(' ' + k + ' '); });
}

/* ---------- LinkedIn export parsing ---------- */
function detectCsv(rows) {
  if (findHeaderRow(rows, ['CONVERSATION ID', 'FROM']) >= 0) return 'messages';
  if (findHeaderRow(rows, ['First Name', 'Last Name', 'URL']) >= 0) return 'connections';
  if (findHeaderRow(rows, ['From', 'To', 'Direction']) >= 0) return 'invitations';
  return 'generic';
}
function stripHtml(s) {
  return String(s ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
}
function parseConnections(rows) {
  const hi = findHeaderRow(rows, ['First Name', 'Last Name']);
  if (hi < 0) return [];
  return rowsToObjects(rows, hi).map((o) => ({
    name: [o['First Name'], o['Last Name']].filter(Boolean).join(' ').trim(), first: o['First Name'] || '',
    url: o['URL'] || '', email: o['Email Address'] || '', company: o['Company'] || '', title: o['Position'] || '',
    connectedOn: parseLooseDate(o['Connected On']),
  })).filter((c) => c.name);
}
function parseInvitations(rows) {
  const hi = findHeaderRow(rows, ['From', 'To', 'Direction']);
  if (hi < 0) return [];
  return rowsToObjects(rows, hi).map((o) => ({
    from: o['From'] || '', to: o['To'] || '', at: parseLooseDate(o['Sent At']), message: o['Message'] || '',
    dir: String(o['Direction'] || '').toUpperCase(), inviter: o['inviterProfileUrl'] || '', invitee: o['inviteeProfileUrl'] || '',
  }));
}
function parseMessages(rows, myName) {
  const hi = findHeaderRow(rows, ['CONVERSATION ID', 'FROM']);
  if (hi < 0) return { convos: [], me: '' };
  const byId = new Map(); const seen = new Map();
  for (const o of rowsToObjects(rows, hi)) {
    if (/^(yes|true)$/i.test(o['IS MESSAGE DRAFT'] || '')) continue;
    const id = o['CONVERSATION ID']; if (!id) continue;
    const m = {
      title: o['CONVERSATION TITLE'] || '', from: o['FROM'] || '', fromUrl: o['SENDER PROFILE URL'] || '', to: o['TO'] || '',
      toUrls: o['RECIPIENT PROFILE URLS'] || '', at: parseLooseDate(o['DATE']), subject: o['SUBJECT'] || '', text: stripHtml(o['CONTENT']), folder: o['FOLDER'] || '',
    };
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(m);
    if (m.from) { if (!seen.has(m.from)) seen.set(m.from, new Set()); seen.get(m.from).add(id); }
  }
  let me = '';
  const want = nameKey(myName || '');
  if (want) for (const n of seen.keys()) if (nameKey(n) === want) { me = n; break; }
  if (!me) { let best = 0; for (const [n, set] of seen) if (set.size > best) { best = set.size; me = n; } }
  const convos = [];
  for (const [id, list] of byId) {
    list.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const theirs = list.filter((m) => m.from && m.from !== me);
    const other = theirs[theirs.length - 1];
    let name = other?.from || '', url = other?.fromUrl || '';
    if (!name) { const mine = list.find((m) => m.from === me); name = String(mine?.to || '').split(',')[0].trim(); url = String(mine?.toUrls || '').split(',')[0].trim(); }
    if (!name || /^linkedin/i.test(name)) continue;
    const last = list[list.length - 1];
    convos.push({
      thread: id, name, url, title: list[0].title, group: new Set(list.map((m) => m.from)).size > 2,
      lastAt: last.at, lastFrom: last.from === me ? 'me' : 'them', msgCount: list.length,
      inmail: list.some((m) => !!m.subject), sponsored: /sponsored/i.test(list[0].title + ' ' + list[0].folder),
      messages: list.slice(-30).map((m) => ({ me: m.from === me, at: m.at, text: trunc((m.subject ? m.subject + '\n' : '') + m.text, 2000) })),
    });
  }
  return { convos, me };
}
const COL_GUESS = {
  first: ['first name', 'firstname', 'given name'],
  last: ['last name', 'lastname', 'surname', 'family name'],
  name: ['name', 'full name', 'fullname', 'contact name', 'lead name', 'person'],
  title: ['title', 'job title', 'position', 'headline', 'role', 'current title'],
  company: ['company', 'company name', 'organization', 'organisation', 'account', 'account name', 'current company'],
  url: ['url', 'profile url', 'linkedin', 'linkedin url', 'linkedin profile', 'profile', 'person linkedin url', 'lead url', 'sales navigator url'],
  location: ['location', 'city', 'geography', 'region', 'country'],
  industry: ['industry', 'company industry'],
  companySize: ['company size', 'employees', 'headcount', 'company headcount', 'size', 'employee count'],
  email: ['email', 'email address', 'e mail'],
  notes: ['notes', 'note', 'comments', 'about', 'summary'],
};
function guessMapping(headers) {
  const hs = headers.map((h) => norm(h)); const map = {}; const used = new Set();
  for (const [field, opts] of Object.entries(COL_GUESS)) {
    const o = opts.map(norm);
    let idx = hs.findIndex((h, i) => !used.has(i) && o.includes(h));
    if (idx < 0 && !['first', 'last', 'name'].includes(field)) idx = hs.findIndex((h, i) => !used.has(i) && o.some((x) => h.includes(x)));
    if (idx >= 0) { map[field] = idx; used.add(idx); }
  }
  return map;
}
function slugName(url) {
  const k = liKey(url); if (!k.startsWith('in/')) return '';
  return k.slice(3).replace(/-[0-9a-f]{6,}$/i, '').replace(/-\d+$/, '').split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}
function parseLooseList(text) {
  const out = [];
  for (let line of String(text || '').split(/\n+/)) {
    line = line.trim(); if (!line) continue;
    const url = (line.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/[^\s,|;\t]+/i) || [])[0] || '';
    const rest = line.replace(url, ' ');
    const parts = rest.split(/\t|\s[|•·–—-]\s|,|;/).map((s) => s.trim()).filter(Boolean);
    let [name = '', title = '', company = '', location = ''] = parts;
    const at = title.match(/^(.*?)\s+(?:at|@)\s+(.+)$/i);
    if (at && !company) { title = at[1]; company = at[2]; }
    if (!name && url) name = slugName(url);
    if (name) out.push({ name, title, company, location, url: safeLi(url) || url });
  }
  return out;
}
function icpRecipe(icp) {
  const q = (t) => (/\s|-/.test(t) ? `"${t}"` : t);
  const titles = (icp.titles || []).slice(0, 10);
  const ex = (icp.excludes || []).slice(0, 8);
  const bool = titles.length ? `(${titles.map(q).join(' OR ')})${ex.length ? ` NOT (${ex.map(q).join(' OR ')})` : ''}` : '';
  const kwInd = (icp.industries || []).slice(0, 3).map(q).join(' OR ');
  const kwTit = titles.slice(0, 6).map(q).join(' OR ');
  const kw = [kwInd && `(${kwInd})`, kwTit && `(${kwTit})`].filter(Boolean).join(' AND ');
  return { bool, searchUrl: kw ? LI.search(kw) : '', kw };
}
function mineNetwork(conns, icp) {
  const idx = leadIndex();
  return conns.map((c) => {
    const pseudo = { id: 'x', title: c.title, company: c.company, industry: '', about: '', companySize: '', location: '' };
    const hay = norm([c.title, c.company].join(' '));
    const ex = (icp.excludes || []).find((x) => hasPhrase(hay, x));
    const t = (icp.titles || []).find((x) => hasPhrase(norm(c.title), x));
    const i = (icp.industries || []).find((x) => hasPhrase(hay, x));
    const score = ex ? 0 : (t ? 50 : 0) + (i ? 50 : 0);
    return { ...c, score, why: [t && `Role: ${t}`, i && `Industry: ${i}`].filter(Boolean), dup: !!findDup({ ...pseudo, name: c.name, url: c.url }, idx) };
  }).filter((c) => c.score >= 50 && !c.dup).sort((a, b) => b.score - a.score);
}
