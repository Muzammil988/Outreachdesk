/* ================= UI state, shell & shared components ================= */
const ui = {
  view: 'today', inboxF: 'reply', inboxQ: '', sel: null, showDetail: false,
  invCur: null, invPending: null, replyPending: null, fuPending: null,
  leadsQ: '', leadsStage: 'all', leadsIcp: 'all', leadsSort: 'fit', leadsPage: 0, picked: new Set(),
  drawer: null, modal: null, busy: null, days: 30, icpSel: null, writeTab: 'post', tplType: 'invite',
  write: { topic: '', angle: 'lessons', length: 'medium', post: '', ideas: [], postIn: '', comments: [], inmailLead: '', inmailSubject: '', inmailBody: '', headline: '', about: '', prof: null },
  settingsTab: 'profile', theme: 'light',
};
const VIEWS = {
  today: { label: 'Today', icon: 'clock' },
  inbox: { label: 'Inbox', icon: 'inbox' },
  invites: { label: 'Invites', icon: 'userplus' },
  followups: { label: 'Follow-ups', icon: 'repeat' },
  leads: { label: 'Leads', icon: 'users' },
  icp: { label: 'ICP', icon: 'target' },
  write: { label: 'Write', icon: 'pen' },
  templates: { label: 'Templates', icon: 'file' },
  insights: { label: 'Insights', icon: 'chart' },
  settings: { label: 'Settings', icon: 'sliders' },
};
const VIEW_FN = {};
const AFTER = {};
const MODALS = {};

/* Light by default. Dark only when chosen here; the choice stays in this browser. */
const THEME_KEY = 'outreach-desk:theme';
function applyTheme() {
  let t = 'light';
  try { t = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch { t = ui.theme || 'light'; }
  ui.theme = t;
  document.documentElement.classList.toggle('dark', t === 'dark');
}
function setTheme(t) { ui.theme = t; try { localStorage.setItem(THEME_KEY, t); } catch { /* per-browser only */ } document.documentElement.classList.toggle('dark', t === 'dark'); render(); }

function go(view) {
  if (!VIEWS[view]) view = 'today';
  ui.view = view;
  if (location.hash.slice(1) !== view) { try { history.replaceState(null, '', '#' + view); } catch { /* sandboxed */ } }
  render();
  const m = $('#main'); if (m) m.scrollTop = 0;
}
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS[v] && v !== ui.view) { ui.view = v; render(); } });

let _rq = false;
function render() { if (_rq) return; _rq = true; requestAnimationFrame(() => { _rq = false; renderNow(); }); }
function renderNow() {
  const a = document.activeElement;
  const keep = a && a.id && /^(TEXTAREA|INPUT|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'file'
    ? { id: a.id, s: a.selectionStart, e: a.selectionEnd, st: a.scrollTop } : null;
  const dScroll = $('.drawer-b')?.scrollTop || 0, mScroll = $('.modal-b')?.scrollTop || 0;
  renderRail(); renderTopbar(); renderTabbar();
  const main = $('#main');
  if (main) {
    const sc = main.scrollTop;
    let html;
    try { html = (VIEW_FN[ui.view] || VIEW_FN.today)(); }
    catch (err) { console.error(err); html = emptyHtml('This screen hit a problem', esc(err && err.message || err), `<button class="btn" data-act="go" data-view="today">Back to Today</button>`); }
    main.innerHTML = `<div class="page">${html}</div>`;
    main.scrollTop = sc;
  }
  renderDrawer(); renderModal();
  const db = $('.drawer-b'); if (db) db.scrollTop = dScroll;
  const mb = $('.modal-b'); if (mb) mb.scrollTop = mScroll;
  try { AFTER[ui.view]?.(); } catch (err) { console.error(err); }
  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) { el.focus({ preventScroll: true }); try { if (keep.s != null) el.setSelectionRange(keep.s, keep.e); } catch { /* not a text field */ } el.scrollTop = keep.st; }
  }
}

/* ---------- Shell ---------- */
function navCounts() {
  return derived('nav', () => {
    const c = inboxCounts();
    const hot = S.convos().filter((x) => inboxMatches(x, 'reply') && HOT_CATS.includes(x.category)).length;
    return { inbox: c.reply || 0, hot, invites: S.leads().filter((l) => l.stage === 'queued').length, due: sendableDue(), leads: S.leads().length };
  });
}
function navLink(v, n, hot) {
  const d = VIEWS[v];
  return `<a href="#${v}" data-act="go" data-view="${v}" ${ui.view === v ? 'aria-current="page"' : ''}><span class="ico">${ic(d.icon)}</span><span>${d.label}</span>${n ? `<span class="badge ${hot ? 'hot' : ''}">${n > 999 ? '999+' : n}</span>` : ''}</a>`;
}
const brandMark = () => `<span class="brand-mark">${brandSvg()}</span>`;
function meButton() {
  const p = S.profile(); if (!p) return '';
  const many = (S.meta?.profiles?.length || 0) > 1;
  return `<button class="me" data-act="profiles" aria-label="LinkedIn profile: ${esc(p.name || 'you')}. Switch or add profiles">${avHtml(p.name || 'Me', 'sm')}<span class="min0" style="flex:1"><span class="me-name">${esc(p.name || 'Your profile')}</span><span class="me-sub">${esc((ACCOUNT[p.accountType] || ACCOUNT.premium).label)}${many ? ' · switch' : ''}</span></span>${ic('chevD')}</button>`;
}
function renderRail() {
  const el = $('#rail'); if (!el) return;
  const c = navCounts();
  el.innerHTML = `
    <a class="brand" href="#today" data-act="go" data-view="today">${brandMark()}<span><span class="brand-name">Outreach Desk</span><span class="brand-tag">LinkedIn, sent by hand</span></span></a>
    ${meButton()}
    <nav class="nav" aria-label="Sections">
      <div class="nav-label">Daily work</div>
      ${navLink('today')}${navLink('inbox', c.inbox, c.hot > 0)}${navLink('invites', c.invites)}${navLink('followups', c.due, c.due > 0)}${navLink('leads', c.leads)}
      <div class="nav-label">Setup and tools</div>
      ${navLink('icp')}${navLink('write')}${navLink('templates')}${navLink('insights')}${navLink('settings')}
    </nav>
    <div class="rail-foot">
      ${S.meta ? `<div class="rail-card">${budgetInner(true)}</div>` : ''}
      <div class="rail-links">
        <button data-act="theme" aria-label="Switch to ${ui.theme === 'dark' ? 'light' : 'dark'} mode">${ic(ui.theme === 'dark' ? 'sun' : 'moon')} ${ui.theme === 'dark' ? 'Light' : 'Dark'} mode</button>
        <button data-act="rules">${ic('shield')} LinkedIn rules</button>
      </div>
      ${saveStateHtml()}
    </div>`;
}
function renderTopbar() {
  const el = $('#topbar'); if (!el) return;
  el.innerHTML = `<a class="brand" href="#today" data-act="go" data-view="today">${brandMark()}<span><span class="brand-name">Outreach Desk</span></span></a>${meButton()}`;
}
function renderTabbar() {
  const el = $('#tabbar'); if (!el) return;
  const c = navCounts();
  const t = (v, n) => `<a href="#${v}" data-act="go" data-view="${v}" ${ui.view === v ? 'aria-current="page"' : ''}>${ic(VIEWS[v].icon)}<span>${VIEWS[v].label}</span>${n ? `<span class="dot">${n > 99 ? '99+' : n}</span>` : ''}</a>`;
  const moreOn = !['today', 'inbox', 'invites', 'followups'].includes(ui.view);
  el.innerHTML = t('today') + t('inbox', c.inbox) + t('invites', c.invites) + t('followups', c.due)
    + `<button data-act="more" ${moreOn ? 'aria-current="page"' : ''}>${ic('more')}<span>More</span></button>`;
}
function saveStateHtml() {
  let dot = 'save-dot', text, act = 'noop';
  if (S.mode === 'loading') { dot += ' saving'; text = 'Opening your desk…'; }
  else if (S.mode === 'local') { dot += ' local'; text = 'Saved in this browser only'; }
  else if (S.mode === 'memory') { dot += ' error'; text = 'Changes are not saved in this view'; }
  else if (S.save === 'saving') { dot += ' saving'; text = 'Saving…'; }
  else if (S.save === 'error') { dot += ' error'; text = 'Could not save. Retry'; act = 'retry-save'; }
  else text = 'All changes saved';
  return `<button id="save-state" data-act="${act}"><span class="${dot}"></span> ${esc(text)}</button>`;
}
function budgetInner(mini) {
  const b = budget();
  const pct = Math.min(100, (b.week / b.perWeek) * 100);
  const cls = pct >= 100 ? 'bad' : pct >= 85 ? 'warn' : '';
  const meter = `<div class="meter ${cls}" role="img" aria-label="${b.week} of ${b.perWeek} invites used in the last 7 days"><i style="width:${pct}%"></i></div>`;
  if (mini) return `<div class="budget-top"><span>Invites this week</span><b>${b.week} / ${b.perWeek}</b></div>${meter}`;
  return `<div class="budget-top"><span>Today <b>${b.day} / ${b.perDay}</b></span><span>Last 7 days <b>${b.week} / ${b.perWeek}</b></span></div>${meter}`;
}
function budgetHtml() { return `<div class="budget">${budgetInner(false)}</div>`; }
function pageHead(eyebrow, title, sub, actions) {
  return `<div class="ph"><div class="min0"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${actions ? `<div class="ph-actions">${actions}</div>` : ''}</div>`;
}

/* ---------- Toasts ---------- */
function toast(msg, opts = {}) {
  const root = $('#toasts'); if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast' + (opts.tone === 'bad' ? ' bad' : '');
  el.innerHTML = `<span class="t-ic">${ic(opts.tone === 'bad' ? 'alert' : 'check')}</span><span>${esc(msg)}</span>${opts.action ? `<button type="button">${esc(opts.action)}</button>` : ''}`;
  if (opts.action) el.querySelector('button').addEventListener('click', () => { el.remove(); opts.onAction && opts.onAction(); });
  root.appendChild(el);
  while (root.children.length > 2) root.firstElementChild.remove();
  setTimeout(() => el.remove(), opts.ms || (opts.action ? 8000 : 4200));
}

/* ---------- Modal & drawer ---------- */
function openModal(type, data = {}) { ui.modal = Object.assign({ type }, data); render(); }
function closeModal() { ui.modal = null; render(); }
function renderModal() {
  const root = $('#modal-root'); if (!root) return;
  const def = ui.modal && MODALS[ui.modal.type];
  if (!def) { root.innerHTML = ''; return; }
  let m;
  try { m = def(ui.modal); } catch (err) { console.error(err); m = { title: 'Something went wrong', body: `<p>${esc(err && err.message || err)}</p>` }; }
  root.innerHTML = `<div class="overlay"><div class="modal ${m.size || ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-h"><h2 id="modal-title">${m.title}</h2><button class="btn btn-ghost btn-icon" data-act="modal-close" aria-label="Close">${ic('x')}</button></div>
    <div class="modal-b">${m.body}</div>${m.foot ? `<div class="modal-f">${m.foot}</div>` : ''}</div></div>`;
}
function renderDrawer() {
  const root = $('#drawer-root'); if (!root) return;
  const l = ui.drawer && S.lead(ui.drawer);
  if (!l) { ui.drawer = null; root.innerHTML = ''; return; }
  root.innerHTML = `<div class="drawer-ov"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="Lead details">${leadDrawerHtml(l)}</aside>`;
}

/* ---------- Shared bits ---------- */
function busyHtml(key) {
  const b = ui.busy; if (!b || (key && b.key !== key)) return '';
  return `<div class="busy" role="status"><span class="spin"></span><span>${esc(b.label)}${b.total ? ` · <b>${b.done} of ${b.total}</b>` : '…'}</span><span class="spacer"></span><button class="btn btn-sm btn-ghost" data-act="busy-stop">${ic('stop')} Stop</button></div>`;
}
function tagInput(id, values, bind, placeholder) {
  return `<div class="tags">${(values || []).map((v, i) => `<span class="tag">${esc(v)}<button type="button" data-act="tag-del" data-bind="${esc(bind)}" data-i="${i}" aria-label="Remove ${esc(v)}">${ic('x')}</button></span>`).join('')}<input id="${esc(id)}" data-tagin="${esc(bind)}" placeholder="${esc(placeholder || 'Type, then press Enter')}" autocomplete="off"></div>`;
}
function stagePill(stage) { const s = STAGE[stage] || STAGE.new; return `<span class="pill tone-${s.tone}">${esc(s.label)}</span>`; }
function catChip(c) { const d = CATS[c.category] || CATS.review; return `<span class="cat tone-${GROUP_TONE[d.group] || 'grey'}">${esc(d.label)}</span>`; }
function countHtml(id, len, max) {
  const cls = max && len > max ? 'over' : max && len > max * 0.9 ? 'near' : '';
  return `<span class="count ${cls}" data-count="${esc(id)}" ${max ? `data-max="${max}"` : ''}>${len}${max ? ' / ' + max : ''}</span>`;
}
function updateCount(el) {
  const c = document.querySelector(`[data-count="${CSS.escape(el.id)}"]`); if (!c) return;
  const max = +c.dataset.max || 0; const len = el.value.length;
  c.textContent = len + (max ? ' / ' + max : '');
  c.classList.toggle('over', !!max && len > max);
  c.classList.toggle('near', !!max && len <= max && len > max * 0.9);
}
function sendLink(href, act, id, label, disabled, extra = '') {
  if (disabled) return `<span class="btn btn-send btn-lg is-disabled" aria-disabled="true">${ic('copy')} ${label}</span>`;
  return `<a class="btn btn-send btn-lg" href="${esc(href)}" target="_blank" rel="noopener noreferrer" data-act="${act}" data-id="${esc(id)}" ${extra}>${ic('copy')} ${label} ${ic('ext')}</a>`;
}
function optionList(obj, sel) { return Object.entries(obj).map(([k, v]) => `<option value="${esc(k)}" ${k === sel ? 'selected' : ''}>${esc(typeof v === 'string' ? v : v.label)}</option>`).join(''); }
function selectHtml(id, attrs, obj, sel) { return `<select class="select" id="${esc(id)}" ${attrs}>${optionList(obj, sel)}</select>`; }
function emptyHtml(title, text, actions = '', art = true) {
  return `<div class="empty">${art ? `<div class="empty-art">${artEnvelope()}</div>` : ''}<div class="min0"><h3>${title}</h3><p>${text}</p>${actions ? `<div class="row">${actions}</div>` : ''}</div></div>`;
}
function aiBtn(act, id, label, extra = '') {
  if (!AI.on) return '';
  return `<button class="btn btn-sm btn-soft" data-act="${act}" data-id="${esc(id || '')}" ${ui.busy ? 'disabled' : ''} ${extra}>${ic('sparkle')} ${label}</button>`;
}
function aiStatusLine() {
  if (AI.state === 'ready' || AI.state === 'checking') return '';
  return `<p class="hint">${AI.state === 'denied' ? 'AI drafting is turned off for this page.' : 'AI drafting is not available in this view.'} Templates fill in drafts instead.</p>`;
}
