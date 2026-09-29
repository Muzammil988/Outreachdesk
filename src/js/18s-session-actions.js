/* ================= Session actions ================= */
function draftQueuedNotes() {
  if (!AI.on || ui.busy) return;
  if (queueSorted().some((l) => !String(l.drafts.invite || '').trim())) ACTIONS['ai-invite-batch']();
}
const bool = (v) => v === true || /^(true|yes)$/i.test(String(v));
function factsFromAi(p) {
  const pick = (v, list, d) => (list.includes(String(v || '').toLowerCase()) ? String(v).toLowerCase() : d);
  const yrs = p.years_in_role == null || p.years_in_role === '' ? null : Number(p.years_in_role);
  return {
    _ai: true,
    name: String(p.name || '').trim(), title: String(p.title || ''), company: String(p.company || ''), location: String(p.location || ''),
    country: pick(p.country, ['us', 'other'], '') === 'us' ? 'US' : pick(p.country, ['us', 'other'], ''),
    degree: (String(p.degree || '').match(/1st|2nd|3rd/) || [''])[0], pending: bool(p.pending),
    role: pick(p.role, ['owner', 'exec', 'team_lead', 'manager', 'agent', 'staff', 'other'], 'other'),
    owns_company: pick(p.owns_company, ['yes', 'no', 'unknown'], 'unknown'),
    company_type: pick(p.company_type, ['brokerage', 'property_management', 'developer', 'commercial', 'team', 'solo', 'investor', 'vendor', 'adjacent', 'other', 'unknown'], 'unknown'),
    brand: String(p.brand || ''), franchise_owner: bool(p.franchise_owner), new_firm: bool(p.new_firm), changed_job: bool(p.changed_job),
    years_in_role: Number.isFinite(yrs) ? yrs : null, posted_recently: bool(p.posted_recently), mutual: Math.max(0, parseInt(p.mutual, 10) || 0),
    open_profile: bool(p.open_profile), luxury: bool(p.luxury), open_to_work: bool(p.open_to_work), about: trunc(String(p.about || ''), 300),
  };
}
Object.assign(ACTIONS, {
  'sess-step': (el) => { ui.modal.step = el.dataset.step; render(); },
  'sess-edit-icp': () => { const icp = sessIcp(ui.modal); closeModal(); if (icp) ui.icpSel = icp.id; go('icp'); },
  'sess-inbox': () => { closeModal(); ui.inboxF = 'reply'; ui.showDetail = false; go('inbox'); },
  'sess-continue': () => { closeModal(); ui.invPending = null; go('invites'); draftQueuedNotes(); },
  'sess-queue-saved': () => { const n = queueBest(budget().left); closeModal(); toast(`Queued ${plural(n, 'saved lead')}.`); go('invites'); draftQueuedNotes(); },
  'sess-lane': (el) => { ui.modal.lane = el.dataset.lane; ui.modal.urlDraft = ''; render(); },
  'sess-save-url': () => {
    const m = ui.modal; const icp = sessIcp(m); if (!icp) return;
    const u = safeLi(m.urlDraft || document.getElementById('sess-url')?.value || '');
    if (!u || !/\/(sales\/search|search\/results)\//.test(u)) { toast('That doesn’t look like a LinkedIn search link. Copy it from the address bar of the results page.', { tone: 'bad' }); return; }
    const st = laneFor(icp, m.lane || defaultLane(icp)); st.url = u; st.page = 1; m.urlDraft = ''; S.saveMeta(); toast('Search saved. Open it, then paste the results.');
  },
  'sess-page': (el) => { const m = ui.modal; const icp = sessIcp(m); if (!icp) return; laneFor(icp, m.lane || defaultLane(icp)).page = Math.max(1, +el.dataset.n || 1); S.saveMeta(); render(); },
  'sess-forget': () => { const m = ui.modal; const icp = sessIcp(m); if (!icp) return; const st = laneFor(icp, m.lane || defaultLane(icp)); m.urlDraft = st.url || ''; st.url = ''; st.page = 1; if (m.lane === 'active' || !m.lane) { icp.searchUrl = ''; } S.saveMeta(); render(); },
  'sess-toggle-skip': () => { ui.modal.showSkip = !ui.modal.showSkip; render(); },
  'sess-parse': async () => {
    const m = ui.modal; const icp = sessIcp(m); const text = String(m.paste || '').trim();
    if (ui.busy) return;
    if (!text) { toast('Paste the results page first: Ctrl + A, Ctrl + C on LinkedIn, then Ctrl + V here.', { tone: 'bad' }); document.getElementById('sess-paste')?.focus(); return; }
    let people = [];
    if (AI.on) {
      const ctl = new AbortController(); ui.busy = { key: 'sess', label: 'Reading each result card', done: 0, total: 0, ctl }; render();
      try {
        people = asArray(await AI.json(promptParseResults(text), { signal: ctl.signal })).filter((p) => p && p.name).map(factsFromAi);
      } catch (e) { const t = aiErrorText(e); if (t) toast(t, { tone: 'bad' }); ui.busy = null; render(); if (e?.code === 'cancelled') return; }
      ui.busy = null;
    }
    if (!people.length) people = peopleFromLinks(m.links);
    if (!people.length) people = parseLooseList(text).slice(0, 60);
    if (!people.length) { toast('No people found. Copy the whole results page and paste again.', { tone: 'bad' }); render(); return; }
    for (const p of people) if (!safeLi(p.url)) p.url = linkFor(p.name, m.links);
    const seen = new Set((m.found || []).map((p) => nameKey(p.name) + '|' + norm(shortCompany(p.company))));
    people = people.filter((p) => { const k = nameKey(p.name) + '|' + norm(shortCompany(p.company)); if (seen.has(k)) return false; seen.add(k); return true; });
    const laneId = m.lane || defaultLane(icp);
    for (const p of people) p._lane = laneId;
    const pk = (p) => nameKey(p.name) + '|' + companyKey(p.company);
    const prev = new Map((m.found || []).filter((p) => p._touched).map((p) => [pk(p), p._pick]));
    m.found = sessScore([...(m.found || []).map(({ _q, _pick, _k, _touched, ...rest }) => rest), ...people], icp);
    for (const p of m.found) if (prev.has(pk(p))) { p._pick = prev.get(pk(p)); p._touched = true; }
    const st = icp && lanesOf(icp)[laneId];
    if (st && st.url) { st.page = (st.page || 1) + 1; S.saveMeta(); }
    m.paste = ''; m.links = []; m.step = 'review'; render();
  },
  'sess-add': (el) => {
    const m = ui.modal; const icp = sessIcp(m);
    const picked = (m.found || []).filter((p) => p._pick);
    const toLead = (p) => ({
      name: p.name, title: p.title, company: p.company, location: p.location, url: p.url || '', industry: p.industry || '', companySize: p.companySize || '',
      about: p.about || '',
      notes: (p._q.verdict === 'skip' ? ['Picked by hand: ' + p._q.reason] : p._q.why).join(' · '),
      q: { tier: p._q.tier, pri: p._q.pri, why: p._q.why, lane: p._lane || '', at: nowISO(), f: { new_firm: !!p.new_firm, changed_job: !!p.changed_job, luxury: !!p.luxury, posted: !!p.posted_recently, mutual: +p.mutual || 0, degree: p.degree || '', type: p.company_type || '', role: p.role || '' } },
    });
    const inv = picked.filter((p) => p._q.verdict !== 'message');
    const msg = picked.filter((p) => p._q.verdict === 'message');
    const r = addLeadsBatch(inv.map(toLead), { icpId: icp?.id, source: 'search' });
    const rm = addLeadsBatch(msg.map((p) => ({ ...toLead(p), connectedOn: nowISO() })), { icpId: icp?.id, source: 'search' });
    const b = budget(); const queued = S.leads().filter((l) => l.stage === 'queued').length;
    const ranked = r.ids.map((id) => S.lead(id)).filter(Boolean).sort((a, x) => (scoreLead(x).score ?? -1) - (scoreLead(a).score ?? -1));
    const toQueue = ranked.slice(0, Math.max(0, b.left - queued)).map((l) => l.id);
    if (toQueue.length) queueLeads(toQueue);
    const msgNote = rm.added ? ` ${plural(rm.added, 'connection')} added to Follow-ups for a message.` : '';
    if (el.dataset.more) {
      m.found = []; m.step = 'find'; m.showSkip = false; render();
      toast(`Saved ${plural(r.added, 'lead')}${toQueue.length ? `, ${toQueue.length} queued` : ''}.${msgNote} Paste the next page.`);
      return;
    }
    closeModal(); ui.invCur = toQueue[0] || null; ui.invPending = null; go('invites');
    const q = S.leads().filter((l) => l.stage === 'queued').length;
    toast((q ? `${plural(q, 'person', 'people')} ready to invite.${AI.on ? ' Drafting their notes now.' : ''}` : `Saved ${plural(r.added, 'lead')} for the next sessions.`) + msgNote);
    draftQueuedNotes();
  },
  'send-invite-bare': (el) => {
    const l = S.lead(el.dataset.id); if (!l) return;
    ui.invPending = l.id; ui.invBare = true;
    toast(l.url && /\/sales\//.test(l.url) ? 'In Sales Navigator: ⋯ → Connect → Send without a note.' : 'On LinkedIn: Connect → Send without a note.');
    setTimeout(render, 80);
  },
});
INPUTS['sess-url'] = (el) => { if (ui.modal) ui.modal.urlDraft = el.value; };
CHANGES['sess-pick'] = (el) => { const p = ui.modal?.found?.[+el.dataset.i]; if (p) { p._pick = el.checked; p._touched = true; render(); } };
