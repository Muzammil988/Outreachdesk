/* ================= Settings ================= */
const TZS = ['Asia/Karachi', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kolkata', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'Australia/Sydney', 'UTC'];
function rulesHtml() {
  return `<div class="stack" style="gap:14px">
    <p>LinkedIn's User Agreement bans bots and automated tools that send invites or messages, scrape profiles, or change how LinkedIn looks. Accounts caught using them get restricted, and Sales Navigator seats go with them. This desk is built so none of that happens.</p>
    <ul class="steps">
      <li><b>You press every Send, on LinkedIn.</b> The desk copies the text and opens the right LinkedIn page in a new tab. Nothing clicks, types or sends for you.</li>
      <li><b>It never signs in to LinkedIn</b> and never asks for your password. You stay signed in to LinkedIn in your own browser.</li>
      <li><b>It never reads LinkedIn pages.</b> Data comes from LinkedIn's own “Get a copy of your data” export, files you import, and what you paste or type.</li>
      <li><b>No browser extension, no overlay</b> on LinkedIn's site.</li>
      <li><b>Built-in limits.</b> ${P().limits.day} invites a day and ${P().limits.week} a week by default, notes within your plan's character limit, and reminders to withdraw invites older than ${P().cadence.withdraw} days.</li>
      <li><b>Personal, reviewed messages.</b> AI drafts are starting points you read and edit. Templates rotate so people don't get identical text.</li>
    </ul>
    <p class="hint">Opening a chat on LinkedIn marks it as read there, which is normal LinkedIn behaviour.</p>
  </div>`;
}
VIEW_FN.settings = function () {
  if (!S.meta) return VIEW_FN.today();
  const p = P(); const tab = ui.settingsTab;
  const tabs = [['profile', 'Your profile'], ['limits', 'Limits and timing'], ['checks', 'Inboxes to check'], ['ai', 'AI drafting'], ['data', 'Import and export'], ['rules', 'LinkedIn rules']]
    .map(([k, v]) => `<button class="tab" role="tab" data-act="settings-tab" data-tab="${k}" aria-selected="${tab === k}">${v}</button>`).join('');
  const pf = (field, label, attrs = '', hint = '') => `<div class="field"><label for="pf-${field}">${label}</label><input class="input" id="pf-${field}" data-input="profile-field" data-field="${field}" value="${esc(p[field] || '')}" ${attrs}>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  const pt = (field, label, ph = '', hint = '') => `<div class="field full"><label for="pf-${field}">${label}</label><textarea class="textarea" id="pf-${field}" data-input="profile-field" data-field="${field}" placeholder="${esc(ph)}" style="min-height:74px">${esc(p[field] || '')}</textarea>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  let body = '';
  if (tab === 'profile') {
    const others = S.meta.profiles.filter((x) => x.id !== p.id);
    body = `<section class="panel pad stack">
      <div class="grid2">
        ${pf('name', 'Name on LinkedIn')}${pf('first', 'Goes by', `placeholder="${esc(firstName(p.name))}"`, 'Used to sign notes.')}
        ${pf('title', 'Your title')}${pf('company', 'Company')}
        <div class="field full"><label for="pf-url">LinkedIn profile link</label><input class="input" id="pf-url" data-input="profile-field" data-field="url" value="${esc(p.url || '')}" placeholder="https://www.linkedin.com/in/your-name">
          <span class="hint">${ic('shield')} No password or login needed. You stay signed in on LinkedIn in your own browser; this desk only opens pages there for you to act on.</span></div>
        <div class="field"><label for="pf-plan">LinkedIn plan</label>${selectHtml('pf-plan', 'data-change="profile-plan"', { free: 'Free (200-character notes)', premium: 'Premium (300)', salesnav: 'Sales Navigator (300)' }, p.accountType)}</div>
        <div class="field"><label for="pf-tone">Tone</label>${selectHtml('pf-tone', 'data-change="profile-tone"', { friendly: 'Friendly and plain', professional: 'Professional', direct: 'Direct and brief' }, p.tone)}</div>
        ${pt('offer', 'What you offer', 'Example: We build custom CRMs, listing sites and lead follow-up automation for small real estate firms.', 'Follow-ups and replies mention this. Invite notes never pitch.')}
        ${pt('audience', 'Who you help', 'Example: owner-led agencies with 1 to 50 people')}
        ${pt('proof', 'Proof you can mention', 'Example: Built the lead portal for [client name] that cut response time from hours to minutes.', 'Only what is true. Drafts never invent results.')}
        ${pf('cta', 'Preferred call to action', 'placeholder="a quick 15-minute call"')}${pf('calendar', 'Calendar link', 'placeholder="https://calendly.com/…"')}
        ${pf('careers', 'Careers contact for job seekers', 'placeholder="careers@yourcompany.com"')}${pf('language', 'Language')}
      </div></section>
      <section class="panel pad stack" style="margin-top:16px"><div class="card-h" style="margin:0"><h2>Other LinkedIn profiles</h2><button class="btn btn-sm" data-act="profile-add">${ic('plus')} Add a profile</button></div>
        <p class="hint">Manage outreach for more than one LinkedIn account. Each profile keeps its own leads, inbox, ICP and limits. Each person still sends from their own LinkedIn.</p>
        ${others.length ? `<div class="panel q-list">${others.map((x) => `<div class="q-row" style="cursor:default"><span class="av">${esc(initials(x.name))}</span><span class="min0"><span class="nm">${esc(x.name || 'Unnamed profile')}</span><span class="pv" style="display:block">${esc((ACCOUNT[x.accountType] || ACCOUNT.premium).label)}${x.company ? ' · ' + esc(x.company) : ''}</span></span><span class="row"><button class="btn btn-sm" data-act="profile-switch" data-id="${x.id}">Switch</button><button class="btn btn-sm btn-ghost btn-danger" data-act="profile-delete" data-id="${x.id}" aria-label="Delete profile">${ic('trash')}</button></span></div>`).join('')}</div>` : ''}
      </section>`;
  } else if (tab === 'limits') {
    const l = p.limits; const c = p.cadence;
    const tzs = TZS.includes(l.tz) ? TZS : [l.tz, ...TZS];
    const num = (id, field, label, val, min, max, hint) => `<div class="field"><label for="${id}">${label}</label><input class="input" type="number" id="${id}" data-change="${field}" min="${min}" max="${max}" value="${val}">${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
    body = `<section class="panel pad stack"><div class="card-h" style="margin:0"><h2>Invite limits</h2></div>
      <div class="grid3">${num('lim-day', 'limit-day', 'Invites per day', l.day, 1, 40, 'Keep it under about 20.')}${num('lim-week', 'limit-week', 'Invites per rolling week', l.week, 5, 200, 'LinkedIn allows roughly 100 a week.')}</div>
      <p class="hint">LinkedIn lowers the limit for accounts with low acceptance or “I don't know this person” reports. Tight targeting and personal notes keep yours healthy.</p></section>
      <section class="panel pad stack" style="margin-top:16px"><div class="card-h" style="margin:0"><h2>Daily session</h2></div>
      <div class="grid3">
        <div class="field"><label for="lim-time">Session time</label><input class="input" type="time" id="lim-time" data-change="limit-time" value="${esc(l.time)}"></div>
        <div class="field"><label for="lim-tz">Time zone</label><select class="select" id="lim-tz" data-change="limit-tz">${tzs.map((z) => `<option value="${esc(z)}" ${z === l.tz ? 'selected' : ''}>${esc(z.replace(/_/g, ' '))}</option>`).join('')}</select></div>
      </div>
      <div class="field"><span class="lbl">Work days</span><div class="chips">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => `<button class="chip" data-act="workday" data-d="${i}" aria-pressed="${l.workdays.includes(i)}">${d}</button>`).join('')}</div></div>
      <div class="row"><a class="btn btn-sm" href="${esc(gcalLink(p))}" target="_blank" rel="noopener noreferrer">${ic('calendar')} Add the session to Google Calendar ${ic('ext')}</a></div></section>
      <section class="panel pad stack" style="margin-top:16px"><div class="card-h" style="margin:0"><h2>Follow-up timing</h2></div>
      <div class="grid3">
        ${num('cad-fu1', 'cad-fu1', 'First follow-up after (days)', c.fu1, 1, 30)}${num('cad-fu2', 'cad-fu2', 'Final follow-up after (days)', c.fu2, 1, 60)}
        ${num('cad-nur', 'cad-nurture', 'Move to nurture after (days)', c.nurture, 1, 90)}${num('cad-wd', 'cad-withdraw', 'Withdraw invites after (days)', c.withdraw, 7, 60)}
        ${num('cad-wait', 'cad-waiting', 'Nudge a quiet reply after (days)', c.waiting, 1, 30)}
      </div></section>`;
  } else if (tab === 'checks') {
    body = `<section class="panel pad stack"><p class="hint">These show up on Today as a checklist. Items with an end date disappear after it.</p>
      ${(p.checks || []).map((c) => `<div class="grid3" style="align-items:end">
        <div class="field"><label for="ck-l-${c.id}">Inbox</label><input class="input" id="ck-l-${c.id}" data-input="check-field" data-field="label" data-id="${c.id}" value="${esc(c.label)}"></div>
        <div class="field"><label for="ck-n-${c.id}">Note</label><input class="input" id="ck-n-${c.id}" data-input="check-field" data-field="note" data-id="${c.id}" value="${esc(c.note || '')}"></div>
        <div class="field"><label for="ck-u-${c.id}">LinkedIn link</label><input class="input" id="ck-u-${c.id}" data-input="check-field" data-field="url" data-id="${c.id}" value="${esc(c.url || '')}" placeholder="https://www.linkedin.com/…"></div>
        <div class="field"><label for="ck-d-${c.id}">Show until</label><input class="input" type="date" id="ck-d-${c.id}" data-change="check-until" data-id="${c.id}" value="${esc(c.until || '')}"></div>
        <div><button class="btn btn-ghost btn-danger" data-act="check-del" data-id="${c.id}">${ic('trash')} Remove</button></div></div>`).join('<div class="divider"></div>')}
      <div class="row"><button class="btn" data-act="check-add">${ic('plus')} Add an inbox</button></div></section>`;
  } else if (tab === 'ai') {
    body = `<section class="panel pad stack">
      <p>${AI.state === 'ready' ? `${ic('check')} AI drafting is available. The first draft asks you to allow it; it runs on your own Claude account.` : AI.state === 'denied' ? 'AI drafting is turned off for this page. Reload and allow it when asked to turn it back on.' : 'AI drafting is not available in this view. Open the desk from Claude to use it.'}</p>
      <div class="grid3">
        <div class="field"><label for="ai-tier">Quality</label>${selectHtml('ai-tier', 'data-change="ai-tier"', AI_TIERS, S.meta.ai.tier)}<span class="hint">Fast suits quick rewrites. Best takes longer.</span></div>
        <div class="field"><label for="ai-style2">Default note style</label>${selectHtml('ai-style2', 'data-change="ai-style"', NOTE_STYLES, S.meta.ai.style)}</div>
      </div>
      <label class="toggle" for="ai-ab2"><input type="checkbox" id="ai-ab2" data-change="ai-ab" ${S.meta.ai.ab ? 'checked' : ''}> Test note styles against each other (rotates styles, compare in Insights)</label>
      <p class="hint">You review every draft. Nothing is sent from this page.</p></section>`;
  } else if (tab === 'data') {
    const L = S.leads().length, C = S.convos().length;
    body = `<section class="panel pad stack"><div class="card-h" style="margin:0"><h2>Where your data lives</h2></div>
      <p>${S.mode === 'db' ? 'Saved in this page\'s private storage on your Claude account, so it follows you across devices. People you share view-only access with do not see it.' : S.mode === 'local' ? 'Saved in this browser only. Open the desk from Claude to save it to your account.' : 'Not being saved in this view.'}</p>
      <p class="hint">${plural(L, 'lead')} and ${plural(C, 'conversation')} for this profile.</p></section>
      <section class="panel pad stack" style="margin-top:16px"><div class="card-h" style="margin:0"><h2>Import</h2></div>
      <div class="row"><button class="btn" data-act="open-import">${ic('upload')} LinkedIn data export</button><button class="btn" data-act="add-leads" data-tab="csv">${ic('upload')} Leads CSV</button><button class="btn" data-act="restore-backup">${ic('refresh')} Restore a backup</button></div>
      <details class="more"><summary>${ic('chevR')} How to get your LinkedIn data export</summary><ol class="steps" style="margin-top:8px">
        <li>On LinkedIn, open <b>Settings → Data privacy → Get a copy of your data</b>. <a class="link" href="${LI.exportData}" target="_blank" rel="noopener noreferrer">Open it</a></li>
        <li>Choose <b>“Want something in particular?”</b> and tick Connections, Messages and Invitations.</li>
        <li>Click <b>Request archive</b>. LinkedIn emails a download link, usually within minutes for these files.</li>
        <li>Import the .zip here, or the CSV files inside it.</li></ol></details></section>
      <section class="panel pad stack" style="margin-top:16px"><div class="card-h" style="margin:0"><h2>Export</h2></div>
      <div class="row"><button class="btn" data-act="export-leads">${ic('download')} Leads as CSV</button><button class="btn" data-act="backup">${ic('download')} Full backup (JSON)</button></div></section>
      <section class="panel pad stack" style="margin-top:16px"><div class="card-h" style="margin:0"><h2>Start over</h2></div>
      <p class="hint">Deletes every lead and conversation for this profile. Settings, ICPs and templates stay.</p>
      <div class="row"><button class="btn btn-danger" data-act="reset-profile">${ic('trash')} Delete leads and conversations</button></div></section>`;
  } else {
    body = `<section class="panel pad">${rulesHtml()}</section>`;
  }
  return `${pageHead('Settings', 'Your <em>desk</em>', `${esc(p.name || 'Your profile')} · changes save automatically.`)}
  <div class="tabs" role="tablist">${tabs}</div>${body}`;
};
