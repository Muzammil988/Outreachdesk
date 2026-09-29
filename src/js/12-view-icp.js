/* ================= ICP ================= */
VIEW_FN.icp = function () {
  if (!S.meta) return VIEW_FN.today();
  const list = icps();
  let sel = ui.icpSel && icpById(ui.icpSel);
  if (!sel || (sel.profileId && sel.profileId !== P().id)) sel = list[0] || null;
  if (sel) ui.icpSel = sel.id;
  const leadsFor = (i) => S.leads().filter((l) => (l.icpId || list[0]?.id) === i.id);
  const cards = list.map((i) => {
    const ls = leadsFor(i); const avg = ls.length ? Math.round(ls.reduce((s, l) => s + (scoreLead(l, i).score || 0), 0) / ls.length) : null;
    return `<button class="icp-card" data-act="icp-sel" data-id="${i.id}" aria-current="${sel && i.id === sel.id}"><b>${esc(i.name)}</b><span>${plural(ls.length, 'lead')}${avg != null ? ` · average fit ${avg}` : ''}</span></button>`;
  }).join('');
  if (!sel) {
    return `${pageHead('ICP', 'Who you want to <em>reach</em>', 'Your ideal customer profile scores every lead and shapes every draft.')}
    ${emptyHtml('No ICP yet', 'Describe the companies and roles you sell to. Leads get a fit score from it, and drafts speak to their problems.', `<button class="btn btn-primary" data-act="icp-new">${ic('plus')} Create an ICP</button>`)}`;
  }
  const s = statsFor(0).byIcp[sel.id];
  const r = icpRecipe(sel);
  const id = sel.id;
  const sizeChips = SIZE_BANDS.map((b) => `<button class="chip" data-act="icp-size" data-id="${id}" data-size="${b}" aria-pressed="${(sel.sizes || []).includes(b)}">${b}</button>`).join('');
  return `
  ${pageHead('ICP', 'Who you want to <em>reach</em>', 'Changes save as you type, and fit scores update everywhere.', `<button class="btn" data-act="icp-new">${ic('plus')} New ICP</button>`)}
  <div class="icp-grid">
    <div class="stack" style="gap:8px">${cards}</div>
    <div class="stack" style="gap:16px">
      ${AI.on ? `<div class="panel pad stack" style="gap:10px"><div class="field"><label for="icp-desc">Describe your ideal customer in a sentence or two</label><textarea class="textarea" id="icp-desc" style="min-height:64px" placeholder="Example: Owners and brokers of small real estate agencies in the US who handle their own lead follow-up."></textarea></div>
        ${busyHtml('icp')}<div class="row"><button class="btn btn-sm" data-act="ai-icp" data-id="${id}" ${ui.busy ? 'disabled' : ''}>${ic('sparkle')} Suggest roles, words and problems</button><span class="hint">Adds suggestions to the fields below. Review them before relying on them.</span></div></div>` : ''}
      <section class="panel pad stack" aria-label="Who">
        <div class="card-h" style="margin:0"><h2>Who they are</h2></div>
        <div class="field"><label for="icp-name">Name</label><input class="input" id="icp-name" data-input="icp-field" data-field="name" data-id="${id}" value="${esc(sel.name)}"></div>
        <div class="field"><span class="lbl">Industry words</span>${tagInput('icp-ind', sel.industries, 'icp:' + id + ':industries', 'e.g. real estate, realty, brokerage')}<span class="hint">Matched against title, company, industry and profile notes.</span></div>
        <div class="field"><span class="lbl">Company size (employees)</span><div class="chips">${sizeChips}</div></div>
        <div class="field"><span class="lbl">Roles</span>${tagInput('icp-titles', sel.titles, 'icp:' + id + ':titles', 'e.g. owner, founder, broker')}<span class="hint">Whole-word match, so “ceo” won't match “ceremony”.</span></div>
        <div class="field"><span class="lbl">Exclude anyone whose profile says</span>${tagInput('icp-ex', sel.excludes, 'icp:' + id + ':excludes', 'e.g. intern, student, recruiter')}</div>
        <div class="field"><span class="lbl">Locations <span class="muted">(leave empty for anywhere)</span></span>${tagInput('icp-loc', sel.locations, 'icp:' + id + ':locations', 'e.g. Texas, Dubai, London')}</div>
      </section>
      <section class="panel pad stack" aria-label="Messaging">
        <div class="card-h" style="margin:0"><h2>What to say to them</h2></div>
        <div class="field"><label for="icp-pains">Their common problems</label><textarea class="textarea" id="icp-pains" data-input="icp-field" data-field="pains" data-id="${id}">${esc(sel.pains)}</textarea></div>
        <div class="field"><label for="icp-value">How you help them</label><textarea class="textarea" id="icp-value" data-input="icp-field" data-field="value" data-id="${id}" placeholder="One or two sentences. Leave empty and drafts won't pitch anything.">${esc(sel.value)}</textarea></div>
        <div class="grid2">
          <div class="field"><label for="icp-cta">Call to action</label><input class="input" id="icp-cta" data-input="icp-field" data-field="cta" data-id="${id}" value="${esc(sel.cta)}" placeholder="a quick 15-minute call"></div>
          <div class="field"><label for="icp-style">Default note style</label>${selectHtml('icp-style', `data-change="icp-style" data-id="${id}"`, NOTE_STYLES, sel.style || 'peer')}</div>
        </div>
      </section>
      <section class="panel pad stack" aria-label="Find them">
        <div class="card-h" style="margin:0"><h2>Find them on LinkedIn</h2><div class="row"><a class="btn btn-sm" href="${LI.salesSearch}" target="_blank" rel="noopener noreferrer">Sales Navigator ${ic('ext')}</a>${r.searchUrl ? `<a class="btn btn-sm" href="${esc(r.searchUrl)}" target="_blank" rel="noopener noreferrer">LinkedIn search ${ic('ext')}</a>` : ''}</div></div>
        ${recipeHtml(sel)}
        <div class="stack" style="gap:8px"><span class="lbl">Saved searches, warmest first</span>
          ${LANES.map((l, i) => { const st = lanesOf(sel)[l.id] || {}; return `<div class="lane-row"><span class="lane-n">${i + 1}</span><span class="min0"><b>${l.name}</b><span class="hint" style="display:block">${esc(l.why)}</span></span><input class="input" aria-label="${esc(l.name)} search link" data-input="icp-lane" data-id="${id}" data-lane="${l.id}" value="${esc(st.url || '')}" placeholder="Paste the Sales Navigator link">${st.url ? `<span class="pill plain">page ${st.page || 1}</span>` : ''}</div>`; }).join('')}
          <span class="hint">Every lane uses the base filters above plus its own. The session shows the exact filters for each one.</span></div>
        <div class="row"><button class="btn btn-send btn-sm" data-act="start-session" data-step="find">${ic('search')} Find people now</button></div>
        <div class="divider" style="margin:4px 0"></div>
        <div class="row"><button class="btn btn-sm" data-act="open-import" data-kind="connections">${ic('users')} Find matches in my existing connections</button><span class="hint">Uses Connections.csv from LinkedIn's own data export.</span></div>
      </section>
      <div class="row">
        <span class="hint">${s ? `${plural(s.n, 'invite')} sent to this ICP · ${Math.round((s.acc / s.n) * 100)}% accepted` : 'No invites sent to this ICP yet.'}</span>
        <span class="spacer"></span>
        ${list.length > 1 ? `<button class="btn btn-sm btn-danger" data-act="icp-delete" data-id="${id}">${ic('trash')} Delete ICP</button>` : ''}
      </div>
    </div>
  </div>`;
};
function promptIcp(desc, icp) {
  return `Help define an ideal customer profile for LinkedIn outreach.

${senderBlock()}

Current profile name: ${icp.name}
Description from the sender: """${desc}"""

Return concise suggestions:
- industries: 5 to 10 lowercase words or short phrases that appear in company names, titles or industries for these firms
- titles: 6 to 12 lowercase role words for decision makers
- excludes: 4 to 8 lowercase words that mark people to skip
- locations: only if the description names places, else []
- pains: 2 or 3 short sentences on problems these customers commonly have (general truths, no statistics)
- cta: a short call to action phrase

Reply with only JSON: {"industries": [], "titles": [], "excludes": [], "locations": [], "pains": "", "cta": ""}`;
}
