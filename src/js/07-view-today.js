/* ================= Today ================= */
const HOWTO_KEY = 'outreach-desk:howto-done';
function howtoDismissed() { try { return localStorage.getItem(HOWTO_KEY) === '1'; } catch { return !!ui.howtoDone; } }
function loadingHtml() {
  const tiles = ['Reply to messages', 'Welcome new connections', 'Send follow-ups', "Send today's invites", 'Check who accepted', 'Other inboxes'];
  return `<section class="hero" aria-busy="true"><div><div class="eyebrow">Today</div><h1>Opening your <em>desk</em>…</h1><p class="hero-sub">Loading your leads, conversations and today's plan.</p></div></section>
  <div class="tiles">${tiles.map((t, i) => `<div class="tile done"><div class="tile-top"><span class="tile-ico tone-grey">${ic('clock')}</span><span class="tile-step">Step ${i + 1}</span></div><div class="skel" style="width:40%;height:28px;margin-top:14px"></div><span class="tile-title">${t}</span><div class="skel" style="width:${50 + ((i * 17) % 40)}%"></div></div>`).join('')}</div>`;
}
function setupHtml() {
  return `<section class="hero"><div><div class="eyebrow">Welcome</div><h1>Set up your <em>desk</em></h1><p class="hero-sub">Two minutes. You can change all of this later in Settings.</p></div><div class="hero-art">${heroArt(String(new Date().getDate()), new Date().toLocaleDateString('en-US', { month: 'short' }).toUpperCase(), '3:00 PM', 'DAILY')}</div></section>
  <form class="panel pad stack" data-submit="setup" style="max-width:780px">
    <div class="grid2">
      <div class="field"><label for="su-name">Your name on LinkedIn</label><input class="input" id="su-name" name="name" required autocomplete="name"></div>
      <div class="field"><label for="su-company">Company</label><input class="input" id="su-company" name="company" autocomplete="organization"></div>
      <div class="field full"><label for="su-url">Your LinkedIn profile link</label><input class="input" id="su-url" name="url" placeholder="https://www.linkedin.com/in/your-name"><span class="hint">No password needed. You stay signed in to LinkedIn in your own browser, and this desk never signs in for you.</span></div>
      <div class="field"><label for="su-plan">LinkedIn plan</label>${selectHtml('su-plan', 'name="accountType"', { free: 'Free', premium: 'Premium', salesnav: 'Sales Navigator' }, 'premium')}</div>
      <div class="field"><label for="su-day">Invites per day</label><input class="input" id="su-day" name="day" type="number" min="1" max="40" value="20"></div>
      <div class="field full"><label for="su-offer">What you offer <span class="muted">(optional)</span></label><textarea class="textarea" id="su-offer" name="offer" placeholder="Example: We build custom CRMs and lead follow-up tools for small real estate teams."></textarea></div>
    </div>
    <div class="row"><button class="btn btn-send btn-lg" type="submit">Create my desk ${ic('arrow')}</button></div>
  </form>`;
}
function greeting(tz) { const h = tzNow(tz).h; return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }

VIEW_FN.today = function () {
  if (!S.meta) return S.ready ? setupHtml() : loadingHtml();
  const p = P(); const b = budget(); const si = sessionInfo(p);
  const ibc = inboxCounts();
  const reply = S.convos().filter((c) => inboxMatches(c, 'reply'));
  const hot = reply.filter((c) => HOT_CATS.includes(c.category)).sort((a, x) => String(a.lastAt).localeCompare(String(x.lastAt)));
  const leads = S.leads();
  const queued = leads.filter((l) => l.stage === 'queued');
  const fresh = leads.filter((l) => l.stage === 'new' && !scoreLead(l).excluded);
  const due = dueLists();
  const pending = leads.filter((l) => l.stage === 'invited');
  const checks = activeChecks(p);
  const openChecks = checks.filter((c) => !c.done);
  const now = new Date();
  const dateLine = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: si.tz }).format(now);
  const day = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: si.tz }).format(now);
  const mon = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: si.tz }).format(now).toUpperCase();
  const welcomeN = due.welcome.length + due.reconnect.length;
  const fuN = due.fu1.length + due.fu2.length + due.nudge.length;
  const invitesClear = !queued.length && (b.left <= 0 || b.day > 0);

  const steps = [
    {
      n: reply.length, tone: 'coral', icon: 'msg', title: 'Reply to messages', act: 'go-inbox', data: 'data-f="reply"',
      flag: hot.length ? `${hot.length} warm` : '',
      text: hot.length ? `${plural(hot.length, 'lead is', 'leads are')} waiting, the oldest since ${fmtDate(hot[0].lastAt, true)}.` : reply.length ? `${plural(reply.length, 'conversation needs', 'conversations need')} an answer.` : ibc.review ? `${ibc.review} need a quick look first.` : 'Nothing is waiting on you.',
      cta: reply.length ? 'Open inbox' : ibc.review ? 'Take a look' : '', done: !reply.length && !ibc.review,
    },
    {
      n: welcomeN, tone: 'mint', icon: 'mail', title: 'Welcome new connections', act: 'go', data: 'data-view="followups"',
      text: welcomeN ? 'They accepted your invite. A thank-you and one easy question.' : 'Nobody new to welcome yet.', cta: welcomeN ? 'Say hello' : '', done: !welcomeN,
    },
    {
      n: fuN, tone: 'sky', icon: 'repeat', title: 'Send follow-ups', act: 'go', data: 'data-view="followups"',
      text: fuN ? `${due.fu1.length} first, ${due.fu2.length} final and ${due.nudge.length} ${due.nudge.length === 1 ? 'nudge' : 'nudges'} are due.` : 'No follow-ups are due today.', cta: fuN ? 'Follow up' : '', done: !fuN,
    },
    {
      n: queued.length, tone: 'teal', icon: 'plane', title: "Send today's invites",
      act: queued.length ? 'go' : fresh.length && b.left ? 'queue-best' : 'add-leads', data: queued.length ? 'data-view="invites"' : fresh.length && b.left ? `data-n="${Math.min(fresh.length, b.left)}"` : '',
      text: b.left <= 0 ? 'Today\'s limit is used up. More tomorrow.' : queued.length ? `${b.left} left today and ${b.leftWeek} left this week.` : fresh.length ? `${plural(fresh.length, 'new lead is', 'new leads are')} ready to queue.` : 'No leads yet. Find about 20 in Sales Navigator and add them.',
      cta: queued.length ? 'Open invites' : fresh.length && b.left ? `Queue ${Math.min(fresh.length, b.left)} best-fit` : b.left <= 0 ? '' : 'Add leads', done: invitesClear,
    },
    {
      n: pending.length, tone: 'lilac', icon: 'check', title: 'Check who accepted', act: 'check-accepts', data: '',
      text: pending.length ? `${plural(pending.length, 'invite is', 'invites are')} waiting for an answer.` : 'No invites are waiting.', cta: pending.length ? 'Check now' : '', done: !pending.length,
    },
    {
      n: openChecks.length, tone: 'butter', icon: 'inbox', title: 'Other inboxes', act: 'scroll-checks', data: '',
      text: openChecks.length ? `${openChecks.map((c) => c.label).slice(0, 2).join(', ')}${openChecks.length > 2 ? ` and ${openChecks.length - 2} more` : ''}.` : checks.length ? 'All checked for today.' : 'Add inboxes to check in Settings.', cta: openChecks.length ? 'Tick them off' : '', done: !openChecks.length,
    },
  ];
  const doneN = steps.filter((s) => s.done).length;
  const tiles = steps.map((s, i) => `
    <button class="tile ${s.done ? 'done' : ''}" data-act="${s.act}" ${s.data}>
      <span class="tile-top"><span class="tile-ico tone-${s.done ? 'grey' : s.tone}">${ic(s.done ? 'check' : s.icon)}</span>${s.flag ? `<span class="tile-flag tone-coral">${esc(s.flag)}</span>` : `<span class="tile-step">Step ${i + 1}</span>`}</span>
      <span class="tile-n">${s.done ? 'All clear' : s.n}</span>
      <span class="tile-title">${s.title}</span>
      <span class="tile-text">${s.text}</span>
      ${s.cta ? `<span class="tile-cta">${esc(s.cta)} ${ic('arrow')}</span>` : ''}
    </button>`).join('');

  const s30 = statsFor(30); const s7 = statsFor(7);
  const acc = s30.invited ? Math.round((s30.accepted / s30.invited) * 100) : null;
  const weekPct = Math.min(100, (b.week / b.perWeek) * 100);

  const att = [];
  if (!p.offer) att.push({ icon: 'pen', tone: 'coral', t: '<b>Add what you offer.</b> Follow-ups and replies can mention it once the desk knows.', a: `<button class="btn btn-sm btn-soft" data-act="go-settings" data-tab="profile">Add</button>` });
  if (!safeLi(p.url)) att.push({ icon: 'link', tone: 'teal', t: '<b>Add your LinkedIn profile link</b> so the desk knows whose account it works for.', a: `<button class="btn btn-sm btn-soft" data-act="go-settings" data-tab="profile">Add</button>` });
  for (const c of hot.slice(0, 3)) att.push({ icon: 'flag', tone: 'coral', t: `<b>${esc(cleanName(c.name))}</b> · ${esc(CATS[c.category].label.toLowerCase())}, waiting ${esc(fmtAgo(c.lastAt).replace(' ago', ''))}`, s: esc(trunc(c.preview, 96)), a: `<button class="btn btn-sm btn-soft" data-act="open-convo" data-id="${c.id}">Reply</button>` });
  for (const c of checks.filter((x) => x.until && !x.done)) att.push({ icon: 'alert', tone: 'butter', t: `<b>${esc(c.label)}</b>`, s: esc(c.note || ''), a: safeLi(c.url) ? `<a class="btn btn-sm btn-soft" href="${esc(safeLi(c.url))}" target="_blank" rel="noopener noreferrer">Open ${ic('ext')}</a>` : '' });
  if (due.withdraw.length) att.push({ icon: 'archive', tone: 'butter', t: `<b>${plural(due.withdraw.length, 'invite')}</b> older than ${p.cadence.withdraw} days. Withdrawing them keeps your account healthy.`, a: `<button class="btn btn-sm btn-soft" data-act="go" data-view="followups">Review</button>` });
  if (acc != null && s30.invited >= 20 && acc < 25) att.push({ icon: 'target', tone: 'butter', t: `<b>Acceptance is ${acc}%.</b> Tighten the ICP or try another note style.`, a: `<button class="btn btn-sm btn-soft" data-act="go" data-view="insights">See why</button>` });
  if (!icps().length) att.push({ icon: 'target', tone: 'teal', t: '<b>Describe who you want to reach.</b> Your ICP scores every lead.', a: `<button class="btn btn-sm btn-soft" data-act="go" data-view="icp">Create ICP</button>` });

  const showHowto = leads.length < 3 && !howtoDismissed();
  const checksHtml = checks.length ? `<div class="checks">${checks.map((c) => `
      <label class="check ${c.done ? 'done' : ''}" for="chk-${esc(c.id)}"><input type="checkbox" id="chk-${esc(c.id)}" data-change="check-done" data-id="${esc(c.id)}" ${c.done ? 'checked' : ''}>
      <span class="min0"><b>${esc(c.label)}</b>${c.note ? ` <span class="cn">· ${esc(c.note)}</span>` : ''}${safeLi(c.url) ? ` · <a href="${esc(safeLi(c.url))}" target="_blank" rel="noopener noreferrer">Open</a>` : ''}</span></label>`).join('')}</div>`
    : `<p class="hint">Add the other inboxes you check (company pages, Sales Navigator) in Settings.</p>`;

  return `
  <section class="hero">
    <div class="min0">
      <div class="eyebrow">${esc(dateLine)}</div>
      <h1>${greeting(si.tz)}${myFirst() ? `, <em>${esc(myFirst())}</em>` : ''}</h1>
      <p class="hero-sub">Your LinkedIn hour is <b>${si.label} ${esc(si.tzLabel)}</b><span class="time-chip ${si.when === 'now' ? 'tone-coral' : 'tone-teal'}">${ic('clock')} ${esc(si.when)}</span></p>
      <div class="hero-progress"><div class="meter"><i style="width:${Math.round((doneN / steps.length) * 100)}%"></i></div><span>${doneN} of ${steps.length} steps clear</span></div>
      <div class="hero-actions">
        <button class="btn btn-send btn-lg" data-act="start-session">Start session ${ic('arrow')}</button>
        <a class="btn btn-lg" href="${esc(gcalLink(p))}" target="_blank" rel="noopener noreferrer">${ic('calendar')} Add ${si.label.replace(':00', '')} reminder</a>
      </div>
    </div>
    <div class="hero-art">${heroArt(day, mon, si.label, si.tzLabel)}</div>
  </section>
  ${showHowto ? `<section class="howto" aria-label="How it works">
    <div class="howto-step"><span class="howto-n tone-coral">1</span><span><b>Pick who to reach</b>Your ICP is ready. Add people from Sales Navigator or your connections.</span></div>
    <div class="howto-step"><span class="howto-n tone-teal">2</span><span><b>Let AI draft the note</b>Every note and reply is written for you to read and edit.</span></div>
    <div class="howto-step"><span class="howto-n tone-mint">3</span><span><b>Copy, open, send</b>The desk copies the text and opens LinkedIn. You press Send.</span></div>
    <button class="btn btn-sm" data-act="howto-done">Got it</button>
  </section>` : ''}
  <div class="tiles" aria-label="Today's session, in order">${tiles}</div>
  <div class="today-grid">
    <section class="panel pad" aria-label="Needs attention">
      <div class="card-h"><h2>Needs attention</h2>${att.length ? `<span class="hint">${plural(att.length, 'item')}</span>` : ''}</div>
      ${att.length ? `<div class="att">${att.slice(0, 7).map((x) => `
        <div class="att-item"><span class="att-ic tone-${x.tone}">${ic(x.icon)}</span><div class="min0"><div class="t">${x.t}</div>${x.s ? `<div class="s">${x.s}</div>` : ''}</div><div>${x.a || ''}</div></div>`).join('')}</div>`
        : `<p class="hint">Nothing needs your attention. Nice and tidy.</p>`}
    </section>
    <div class="stack" style="gap:18px">
      <section class="panel pad deep" aria-label="This week">
        <div class="card-h"><h2>This week</h2><button class="btn btn-sm btn-ghost" data-act="go" data-view="insights">Insights ${ic('arrow')}</button></div>
        <div class="stats">
          <div><div class="stat-l">Invites, 7 days</div><div class="stat-v">${b.week}<small>/ ${b.perWeek}</small></div><div class="meter ${weekPct >= 100 ? 'bad' : weekPct >= 85 ? 'warn' : ''}" style="margin-top:8px"><i style="width:${weekPct}%"></i></div></div>
          <div><div class="stat-l">Accepted, 30 days</div><div class="stat-v">${acc == null ? '–' : acc + '%'}</div><div class="stat-d">${s30.invited ? `${s30.accepted} of ${s30.invited} invites` : 'Send invites to see this'}</div></div>
          <div><div class="stat-l">Replies sent, 7 days</div><div class="stat-v">${s7.repliesSent}</div><div class="stat-d">${ibc.reply ? `${ibc.reply} still waiting` : 'Inbox clear'}</div></div>
          <div><div class="stat-l">Meetings, 30 days</div><div class="stat-v">${s30.meetings}</div><div class="stat-d">${s30.replied ? `${s30.replied} leads replied` : 'From replies to meetings'}</div></div>
        </div>
      </section>
      <section class="panel pad" id="checks" aria-label="Other inboxes">
        <div class="card-h"><h2>Other inboxes</h2><button class="btn btn-sm btn-ghost" data-act="go-settings" data-tab="checks">Edit</button></div>
        ${checksHtml}
      </section>
    </div>
  </div>`;
};
