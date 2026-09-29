/* ================= Session: ICP → find people → queue =================
   Nothing here touches LinkedIn. You open the search, copy the results page,
   and paste it back. The desk sorts, scores and queues the people. */
function sessIcp(m) { return (m && icpById(m.icpId)) || icps()[0] || null; }
function pageUrl(url, n) {
  try { const u = new URL(url); if (n > 1) u.searchParams.set('page', String(n)); else u.searchParams.delete('page'); return u.href; } catch { return url; }
}
function extractLinks(html) {
  const out = []; if (!html) return out;
  let doc; try { doc = new DOMParser().parseFromString(html, 'text/html'); } catch { return out; }
  const seen = new Set();
  for (const a of doc.querySelectorAll('a[href]')) {
    let href = a.getAttribute('href') || '';
    if (href.startsWith('/')) href = 'https://www.linkedin.com' + href;
    if (!/linkedin\.com\/(in|sales\/lead|sales\/people)\//i.test(href)) continue;
    const url = safeLi(href); if (!url) continue;
    const text = (a.textContent || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    const k = liKey(url) + '|' + norm(text); if (seen.has(k)) continue; seen.add(k);
    out.push({ url, text });
  }
  return out;
}
function linkFor(name, links) {
  const nk = norm(cleanName(name)); if (!nk || !links?.length) return '';
  const exact = links.find((x) => norm(x.text) === nk);
  if (exact) return exact.url;
  const near = links.find((x) => { const t = norm(x.text); return t.length > 3 && (t.includes(nk) || nk.includes(t)); });
  if (near) return near.url;
  const slug = links.find((x) => nameKey(slugName(x.url)) && nameKey(slugName(x.url)) === nameKey(name));
  return slug ? slug.url : '';
}
function peopleFromLinks(links) {
  const byKey = new Map();
  for (const x of links || []) {
    const t = x.text.replace(/\b(1st|2nd|3rd)\b.*$/i, '').trim();
    if (!/^[\p{L}.'’ -]{3,60}$/u.test(t) || t.split(/\s+/).length < 2 || t.split(/\s+/).length > 5) continue;
    if (/view|profile|connect|message|save|linkedin|member/i.test(t)) continue;
    const k = liKey(x.url); if (!byKey.has(k)) byKey.set(k, { name: t, url: x.url, title: '', company: '', location: '' });
  }
  return [...byKey.values()];
}
function promptParseResults(text) {
  return `This text was copied (select all, copy) from a LinkedIn or Sales Navigator people-search results page. Read the facts off each person's result card. Do not judge whether they are a good lead; just report facts.
Ignore page chrome: navigation, filters, buttons, ads, "People also viewed", saved-search panels, and the account owner (${P().name || 'the user'}).

For each person listed as a search result, return:
- name: without degree markers ("2nd"), emoji, credentials or pronouns
- title, company: current role and current company as shown
- location: as shown; country: "US" if the location is in the United States, "other" if clearly elsewhere, "" if not shown
- degree: "1st", "2nd", "3rd" or "" as shown on the card
- pending: true if the card shows the invite is already pending
- role: "owner" (owner, founder, co-founder, broker-owner, principal or managing broker, president, CEO of their own firm), "exec" (CEO, COO, managing director or partner who is not clearly the founder), "team_lead" (leads or owns a team inside a brokerage), "manager", "agent" (agent, realtor, associate broker, salesperson), "staff" (assistant, coordinator, admin, marketing staff) or "other"
- owns_company: "yes", "no" or "unknown"
- company_type: "brokerage" (independent real estate brokerage or agency), "property_management", "developer", "commercial" (commercial real estate firm), "team" (a named team such as "The Smith Group at Keller Williams"), "solo" (a one-person brand, e.g. "Jane Doe Realty" with signs it is just them), "investor" (individual investor, wholesaler, flipper), "vendor" (sells services or software to real estate: marketing, web, CRM, lead gen, photography, coaching), "adjacent" (mortgage, lending, title, escrow, insurance, inspection, appraisal), "other" (not real estate) or "unknown"
- brand: the national brand they work under if any (Keller Williams, RE/MAX, eXp, Compass, Coldwell Banker, Century 21 and so on), else ""
- franchise_owner: true only if they own or run a franchise office of a national brand
- new_firm: true if the card shows they founded or joined their current company within about 2 years, or says the firm is new or recently launched
- changed_job: true if the card shows "Changed jobs" or a recent job change
- years_in_role: number of years in the current role if shown (e.g. "1 year 3 months" is 1.25), else null
- posted_recently: true if the card shows recent posting activity
- mutual: number of mutual or shared connections shown, else 0
- open_profile: true if the card shows an open profile or free InMail
- luxury: true if the headline or company positions them as luxury, boutique or high-end
- open_to_work: true if they are shown as open to work
- about: a short snippet of their headline or about text if shown, max 200 characters
Use "" or false or null when the card doesn't show it. Never guess or invent.

TEXT
"""${trunc(text, 60000)}"""

Reply with only a JSON array: [{"name":"","title":"","company":"","location":"","country":"","degree":"","pending":false,"role":"","owns_company":"","company_type":"","brand":"","franchise_owner":false,"new_firm":false,"changed_job":false,"years_in_role":null,"posted_recently":false,"mutual":0,"open_profile":false,"luxury":false,"open_to_work":false,"about":""}]`;
}
const GROUPS = { invite: 'Invite', message: 'Already connected: message them', skip: 'Skipped' };
function sessScore(people, icp) {
  const idx = leadIndex(); const health = acceptHealth();
  const cNames = new Set(), cUrls = new Set();
  for (const c of S.convos()) { const n = nameKey(c.name); if (n) cNames.add(n); const k = liKey(c.url); if (k) cUrls.add(k); }
  const reaching = new Map();
  for (const l of S.leads()) if (['queued', 'invited', 'connected', 'messaged', 'replied', 'meeting'].includes(l.stage) && !bigBrand(l.company, '')) { const k = companyKey(l.company); if (k) reaching.set(k, l); }
  const rows = people.map((p) => {
    const f = p._ai ? p : keywordFacts(p, icp);
    const dup = findDup(p, idx);
    const inbox = !dup && ((liKey(p.url) && cUrls.has(liKey(p.url))) || cNames.has(nameKey(p.name)));
    const q = qualify(f, { icp, dup, inbox, health });
    if (!p._ai && q.verdict !== 'skip') q.why.push('Checked by keywords only');
    return { ...p, _k: uid('x-'), _q: q, _pick: q.verdict !== 'skip' };
  });
  // One person per company: the best-ranked one gets the invite.
  const best = new Map();
  const conn = new Map();
  for (const r of rows) if (r._q.verdict === 'message' && !bigBrand(r.company, r.brand)) { const k = companyKey(r.company); if (k && !conn.has(k)) conn.set(k, r); }
  for (const r of rows) {
    if (r._q.verdict !== 'invite' || bigBrand(r.company, r.brand) || r.company_type === 'solo') continue;
    const k = companyKey(r.company); if (!k) continue;
    const via = conn.get(k);
    if (via) { r._q = { ...r._q, verdict: 'skip', reason: `You're connected to ${cleanName(via.name)} there. Start with them` }; r._pick = false; continue; }
    const had = reaching.get(k);
    if (had) { r._q = { ...r._q, verdict: 'skip', reason: `You're already reaching ${cleanName(had.name)} at ${r.company}` }; r._pick = false; continue; }
    const cur = best.get(k);
    if (!cur) best.set(k, r);
    else { const [win, lose] = r._q.pri > cur._q.pri ? [r, cur] : [cur, r]; best.set(k, win); lose._q = { ...lose._q, verdict: 'skip', reason: `${cleanName(win.name)} ranks higher at ${r.company}` }; lose._pick = false; }
  }
  const order = { invite: 0, message: 1, skip: 2 };
  return rows.sort((a, b) => order[a._q.verdict] - order[b._q.verdict] || b._q.pri - a._q.pri);
}
function healthLine(h) {
  if (!h.n) return '';
  const pct = Math.round(h.rate * 100);
  if (h.strict) return `<p class="hint" style="color:var(--bad)">${ic('shield')} Only ${pct}% of your last ${h.n} invites were accepted. LinkedIn restricts accounts with low acceptance, so only the strongest people are picked until it recovers above 25%.</p>`;
  if (h.low) return `<p class="hint">${ic('shield')} ${pct}% of your last ${h.n} invites were accepted. Aim for 35% or more; warm and active lanes help.</p>`;
  return `<p class="hint">${ic('shield')} ${pct}% of your last ${h.n} invites were accepted. Healthy.</p>`;
}

MODALS.session = (m) => {
  const icp = sessIcp(m); const b = budget(); const step = m.step || 'icp';
  const now = new Date();
  const ready = S.leads().filter((l) => l.stage === 'queued' && (!l.skipUntil || new Date(l.skipUntil) <= now));
  const fresh = S.leads().filter((l) => l.stage === 'new' && !scoreLead(l).excluded);
  const steps = [['icp', 'Confirm ICP'], ['find', 'Find people'], ['review', 'Pick & queue']];
  const si = steps.findIndex(([k]) => k === step);
  const stepper = `<ol class="stepper">${steps.map(([k, v], i) => `<li class="${i < si ? 'done' : i === si ? 'on' : ''}"><span>${i < si ? ic('check') : i + 1}</span>${v}</li>`).join('')}</ol>`;
  let body = '', foot = '';

  if (!icp) {
    return { title: 'Start session', body: emptyHtml('Set up your ICP first', 'The session finds people who match it.', `<button class="btn btn-primary" data-act="sess-edit-icp">Create an ICP</button>`), foot: '' };
  }
  const icpSel = icps().length > 1 ? `<div class="field" style="min-width:220px"><label for="sess-icp">ICP</label><select class="select" id="sess-icp" data-change="modal" data-k="icpId">${icps().map((i) => `<option value="${i.id}" ${icp.id === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</select></div>` : '';
  const queued = S.leads().filter((l) => l.stage === 'queued').length;

  if (step === 'icp') {
    const chips = (label, arr, n = 8) => arr?.length ? `<div class="sess-line"><span class="lbl">${label}</span><div class="chips">${arr.slice(0, n).map((x) => `<span class="pill plain">${esc(x)}</span>`).join('')}${arr.length > n ? `<span class="muted" style="font-size:12.5px">+${arr.length - n} more</span>` : ''}</div></div>` : '';
    const replies = inboxCounts().reply;
    body = `${stepper}
      <div class="sess-icp">
        <div class="row" style="justify-content:space-between;align-items:flex-end"><div class="min0"><span class="eyebrow">Targeting</span><h3 class="serif">${esc(icp.name)}</h3></div>${icpSel}</div>
        ${chips('Roles', icp.titles)}
        ${chips('Industry', icp.industries, 6)}
        ${chips('Company size', icp.sizes)}
        ${chips('Locations', icp.locations?.length ? icp.locations : ['Anywhere'])}
        ${chips('Skip titles', icp.excludes, 6)}
        ${icp.value ? `<div class="sess-line"><span class="lbl">Your offer</span><span style="font-size:13.5px">${esc(icp.value)}</span></div>` : ''}
      </div>
      <div class="sess-stats">
        <div><b>${b.left}</b><span>invites left today</span></div>
        <div><b>${ready.length}</b><span>already queued</span></div>
        <div><b>${fresh.length}</b><span>saved leads not queued</span></div>
      </div>
      ${healthLine(acceptHealth())}
      ${replies ? `<p class="hint">${ic('inbox')} ${plural(replies, 'reply is', 'replies are')} waiting too. <button class="linkish" data-act="sess-inbox">Answer them first</button> or do them after the invites.</p>` : ''}
      ${b.left <= 0 ? `<p class="hint" style="color:var(--bad)">${ic('alert')} Today's limit is used up. You can still find and queue people for tomorrow.</p>` : ''}`;
    foot = `<button class="btn btn-ghost" data-act="sess-edit-icp">${ic('pen')} Edit ICP</button><span class="spacer"></span>
      ${ready.length ? `<button class="btn" data-act="sess-continue">Invite the ${ready.length} queued</button>` : fresh.length && b.left ? `<button class="btn" data-act="sess-queue-saved">Queue ${Math.min(fresh.length, b.left)} saved leads</button>` : ''}
      <button class="btn btn-primary" data-act="sess-step" data-step="find">Looks right, find people ${ic('arrow')}</button>`;
  } else if (step === 'find') {
    const ls = lanesOf(icp);
    const laneId = m.lane || defaultLane(icp); m.lane = laneId;
    const lane = LANES.find((l) => l.id === laneId) || LANES[0];
    const st = laneFor(icp, lane.id);
    const saved = safeLi(st.url || '');
    const nLinks = (m.links || []).length;
    const laneChips = LANES.map((l, i) => { const x = ls[l.id]; return `<button class="lane" data-act="sess-lane" data-lane="${l.id}" aria-pressed="${l.id === lane.id}"><span class="lane-n">${i + 1}</span><span class="min0"><b>${l.name}</b><span>${x?.url ? `Saved · page ${x.page || 1}` : 'Not set up'}</span></span></button>`; }).join('');
    body = `${stepper}
      <div class="lanes" role="group" aria-label="Search lanes, warmest first">${laneChips}</div>
      <div class="sess-find">
        <section class="sess-card">
          <span class="sess-n">1</span>
          <div class="min0 stack" style="gap:10px">
            <h3>${esc(lane.name)} <span class="pill plain">${esc(lane.odds)}</span>${saved ? ` <span class="pill plain">page ${st.page || 1}</span>` : ''}</h3>
            <p class="hint" style="margin:0">${esc(lane.why)}</p>
            ${saved ? `<div class="row"><a class="btn btn-send" href="${esc(pageUrl(saved, st.page || 1))}" target="_blank" rel="noopener noreferrer">Open ${esc(lane.name.toLowerCase())} search, page ${st.page || 1} ${ic('ext')}</a>${(st.page || 1) > 1 ? `<button class="btn btn-sm btn-ghost" data-act="sess-page" data-n="1">Back to page 1</button>` : ''}<button class="btn btn-sm btn-ghost" data-act="sess-forget">Change link</button></div>
                <p class="hint" style="margin:0">After each page you paste, this moves on to the next page. When a lane runs dry, move to the next one.</p>`
              : `<details class="more" ${m.openRecipe !== false ? 'open' : ''}><summary>${ic('chevR')} Set it up once in Sales Navigator</summary><div class="recipe" style="margin-top:10px"><ol>${[...LANE_BASE, ...lane.filters].map((x) => { const [k, ...v] = x.split(': '); return `<li>${v.length ? `<b>${esc(k)}:</b> ${esc(v.join(': '))}` : esc(x)}</li>`; }).join('')}<li>Click <b>Save search</b>, then copy the page link from the address bar.</li></ol></div></details>
                <div class="row"><a class="btn" href="${LI.salesSearch}" target="_blank" rel="noopener noreferrer">Open Sales Navigator ${ic('ext')}</a></div>
                <div class="field"><label for="sess-url">Paste the search link here to reuse it every session</label><div class="row" style="flex-wrap:nowrap"><input class="input" id="sess-url" data-input="sess-url" placeholder="https://www.linkedin.com/sales/search/people?…" value="${esc(m.urlDraft || '')}"><button class="btn" data-act="sess-save-url">Save</button></div></div>`}
          </div>
        </section>
        <section class="sess-card">
          <span class="sess-n">2</span>
          <div class="min0 stack" style="gap:10px">
            <h3>Copy the results page and paste it here</h3>
            <p class="hint" style="margin:0">Scroll to the bottom so all 25 results load, then press <span class="kbd">Ctrl</span> + <span class="kbd">A</span> and <span class="kbd">Ctrl</span> + <span class="kbd">C</span> (on a Mac, <span class="kbd">⌘</span> + <span class="kbd">A</span>, <span class="kbd">⌘</span> + <span class="kbd">C</span>).</p>
            <label class="sr-only" for="sess-paste">Search results</label>
            <textarea class="textarea" id="sess-paste" data-input="modal" data-k="paste" data-paste="session" style="min-height:120px" placeholder="Click here and press Ctrl + V">${esc(m.paste || '')}</textarea>
            ${m.paste ? `<p class="hint" style="margin:0">${ic('check')} ${plural(String(m.paste).length, 'character')} pasted${nLinks ? ` · ${plural(nLinks, 'profile link')} captured` : ''}.</p>` : ''}
            ${busyHtml('sess')}
          </div>
        </section>
      </div>`;
    foot = `<button class="btn btn-ghost" data-act="sess-step" data-step="icp">Back</button><span class="spacer"></span>
      ${(m.found || []).length ? `<button class="btn" data-act="sess-step" data-step="review">Back to the ${m.found.length} found</button>` : ''}
      <button class="btn btn-primary" data-act="sess-parse" ${ui.busy ? 'disabled' : ''}>${AI.on ? ic('sparkle') + ' ' : ''}Check these people ${ic('arrow')}</button>`;
  } else {
    const found = m.found || [];
    const picked = found.filter((p) => p._pick);
    const pickInv = picked.filter((p) => p._q.verdict === 'invite');
    const pickMsg = picked.filter((p) => p._q.verdict === 'message');
    const nQueue = Math.min(pickInv.length, Math.max(0, b.left - queued));
    const counts = { invite: 0, message: 0, skip: 0 }; for (const p of found) counts[p._q.verdict]++;
    const showSkip = m.showSkip;
    const row = (p) => {
      const i = found.indexOf(p); const q = p._q;
      const sub = [p.title, p.company].filter(Boolean).join(' · ');
      const tierPill = q.tier ? `<span class="pill ${q.tier === 'A' ? 'tone-teal' : 'plain'}" title="${q.tier === 'A' ? 'Decision maker at a small firm' : 'Good, not the ideal buyer'}">${q.tier}</span>` : '';
      return `<label class="sess-row ${p._pick ? 'on' : ''} ${q.verdict === 'skip' ? 'is-skip' : ''}" for="sp-${i}">
        <input type="checkbox" id="sp-${i}" data-change="sess-pick" data-i="${i}" ${p._pick ? 'checked' : ''} ${q.reason && /Already in your leads|already have a conversation|already pending/i.test(q.reason) ? 'disabled' : ''}>
        ${avHtml(p.name)}
        <span class="min0"><b>${esc(cleanName(p.name) || p.name)}</b>${p.url ? ` <span class="muted" title="Profile link captured">${ic('link')}</span>` : ''}<span class="sess-sub">${esc(sub || 'No title shown')}${p.location ? ` · ${esc(p.location)}` : ''}</span><span class="sess-why">${esc(q.verdict === 'skip' ? q.reason : q.why.join(' · '))}</span></span>
        <span class="row" style="gap:8px">${tierPill}${q.verdict !== 'skip' ? `<span class="fit" title="Priority ${q.pri} of 100: need for a new brand plus odds of accepting"><i style="--w:${q.pri}%"></i>${q.pri}</span>` : ''}</span>
      </label>`;
    };
    const group = (v) => { const list = found.filter((p) => p._q.verdict === v); return list.length ? `<div class="sess-gh">${GROUPS[v]} <span class="n">${list.length}</span></div>${list.map(row).join('')}` : ''; };
    body = `${stepper}
      <div class="row" style="justify-content:space-between">
        <p class="sess-sum"><b>${plural(found.length, 'person', 'people')}</b> checked · <b>${counts.invite}</b> to invite${counts.message ? ` · <b>${counts.message}</b> to message` : ''} · ${counts.skip} skipped</p>
        ${counts.skip ? `<button class="btn btn-sm btn-ghost" data-act="sess-toggle-skip">${showSkip ? 'Hide' : 'Show'} skipped and why</button>` : ''}
      </div>
      <div class="sess-list">${group('invite')}${group('message')}${showSkip ? group('skip') : ''}${!counts.invite && !counts.message ? `<p class="hint" style="padding:14px">Nobody here is worth an invite${counts.skip ? '. Open “Show skipped” to see why' : '. Check that you copied the results page itself'}.</p>` : ''}</div>
      <p class="hint">Priority = need for a new brand (new firm, job change, luxury, growing team) + odds they accept (posting, mutual connections, 2nd degree). ${!nQueue && pickInv.length ? 'Today\'s invites are already queued or used, so these are saved for the next sessions.' : pickInv.length > nQueue ? `The top ${nQueue} go into today's queue. The other ${pickInv.length - nQueue} are saved for the next sessions.` : ''}</p>`;
    foot = `<button class="btn btn-ghost" data-act="sess-step" data-step="find">Back</button><span class="spacer"></span>
      <button class="btn" data-act="sess-add" data-more="1" ${picked.length ? '' : 'disabled'}>Save and paste the next page</button>
      <button class="btn btn-send" data-act="sess-add" ${picked.length ? '' : 'disabled'}>${nQueue ? `Queue ${nQueue} and start inviting` : `Save ${plural(picked.length, 'lead')}`} ${ic('arrow')}</button>`;
    if (pickMsg.length) foot = foot.replace('<span class="spacer"></span>', `<span class="spacer"></span><span class="hint">${plural(pickMsg.length, 'connection')} will go to Follow-ups for a message.</span>`);
  }
  return { title: step === 'icp' ? 'Start today\'s session' : step === 'find' ? 'Find people who match' : 'Who to invite', size: 'wide', body, foot };
};

/* Paste capture: keep the profile links that plain text loses. */
document.addEventListener('paste', (e) => {
  const el = e.target; if (el.dataset?.paste !== 'session' || !ui.modal) return;
  const html = (e.clipboardData || window.clipboardData)?.getData('text/html') || '';
  const links = extractLinks(html);
  if (links.length) { const have = new Set((ui.modal.links || []).map((x) => x.url + '|' + x.text)); ui.modal.links = [...(ui.modal.links || []), ...links.filter((x) => !have.has(x.url + '|' + x.text))]; }
  setTimeout(() => { if (ui.modal) { ui.modal.paste = el.value; render(); } }, 0);
});
/* Coming back from LinkedIn with an invite open: make Enter confirm it. */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || ui.view !== 'invites' || !ui.invPending) return;
  setTimeout(() => document.querySelector('[data-act="inv-sent"]')?.focus(), 60);
});
