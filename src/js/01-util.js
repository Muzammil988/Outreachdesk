/* ================= Utilities ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const DAY = 864e5;
const nowISO = () => new Date().toISOString();
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const trunc = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, Math.max(0, n - 1)).trimEnd() + '…' : s; };
const plural = (n, one, many) => `${Number(n).toLocaleString('en-US')} ${n === 1 ? one : (many || one + 's')}`;
const _enc = new TextEncoder();
const byteLen = (o) => _enc.encode(JSON.stringify(o)).length;
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function debounce(fn, ms) {
  let t = null;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => { t = null; fn(...a); }, ms); };
  d.flush = () => { if (t) { clearTimeout(t); t = null; fn(); } };
  return d;
}
function norm(s) {
  return String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function hasPhrase(normHay, phrase) {
  const p = norm(phrase);
  return !!p && (' ' + normHay + ' ').includes(' ' + p + ' ');
}
function splitList(s) { return String(s ?? '').split(/[,\n;]+/).map((x) => x.trim()).filter(Boolean); }
function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------- Names ---------- */
const HONORIFIC = /^(dr|mr|mrs|ms|miss|engr|eng|prof|hafiz|sir)\.?$/i;
const MUHAMMAD = /^(muhammad|mohammad|mohammed|muhammed|mohamed|mohd|md)\.?$/i;
function cleanName(n) {
  return String(n ?? '').replace(/\([^)]*\)/g, ' ').replace(/,.*$/, '').replace(/[^\p{L}\p{M}\s.'-]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function firstName(n) {
  const nick = String(n ?? '').match(/\S\s+\(([\p{L}'-]{2,12})\)\s+\S/u);
  if (nick) return nick[1];
  const parts = cleanName(n).split(' ').filter(Boolean);
  let i = 0;
  while (i < parts.length - 1 && HONORIFIC.test(parts[i])) i++;
  if (MUHAMMAD.test(parts[i] || '') && parts.length - i >= 2) i++;
  return (parts[i] || '').replace(/\.$/, '');
}
function initials(n) {
  const parts = cleanName(n).split(' ').filter((p) => p && !HONORIFIC.test(p) && /\p{L}/u.test(p));
  if (!parts.length) return '?';
  const a = parts[0][0] || '';
  const b = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (a + b).toUpperCase();
}
const nameKey = (n) => norm(cleanName(n));

/* ---------- Dates ---------- */
function tzKey(d, tz) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d)); }
  catch { return new Date(d).toISOString().slice(0, 10); }
}
function tzNow(tz) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' })
      .formatToParts(new Date()).map((p) => [p.type, p.value]));
    return { h: (+parts.hour) % 24, m: +parts.minute, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday) };
  } catch { const d = new Date(); return { h: d.getHours(), m: d.getMinutes(), wd: d.getDay() }; }
}
function tzOffsetMin(tz, at = new Date()) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(at).map((x) => [x.type, x.value]));
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
    return Math.round((asUTC - at.getTime()) / 60000);
  } catch { return -at.getTimezoneOffset(); }
}
const daysSince = (iso) => { if (!iso) return Infinity; const t = new Date(iso).getTime(); return isNaN(t) ? Infinity : (Date.now() - t) / DAY; };
function fmtDate(iso, withYear) {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  const same = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(same && !withYear ? {} : { year: 'numeric' }) });
}
function fmtShort(iso) {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  const same = d.getFullYear() === new Date().getFullYear();
  return same ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).replace(' ', " '");
}
function fmtAgo(iso) {
  const d = daysSince(iso);
  if (!isFinite(d)) return '';
  if (d < 0) return 'upcoming';
  if (d < 1 / 24) return 'just now';
  if (d < 1) return Math.max(1, Math.round(d * 24)) + 'h ago';
  if (d < 2) return 'yesterday';
  if (d < 30) return Math.floor(d) + ' days ago';
  if (d < 365) { const m = Math.max(1, Math.floor(d / 30.4)); return m + (m === 1 ? ' month' : ' months') + ' ago'; }
  const y = Math.floor(d / 365); return y + (y === 1 ? ' year' : ' years') + ' ago';
}
function fmtDays(n) { n = Math.floor(n); return n <= 0 ? 'today' : n === 1 ? '1 day' : n + ' days'; }
function parseLooseDate(s) {
  s = String(s ?? '').trim(); if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 12), +(m[5] || 0), +(m[6] || 0))).toISOString();
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})$/);
  if (m) { const d = new Date(`${m[2]} ${m[1]}, ${m[3]} 12:00`); if (!isNaN(d)) return d.toISOString(); }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s*(?:(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i);
  if (m) {
    let y = +m[3]; if (y < 100) y += 2000;
    let h = m[4] ? +m[4] : 12;
    if (m[6]) { h = h % 12; if (/pm/i.test(m[6])) h += 12; }
    const d = new Date(y, +m[1] - 1, +m[2], h, +(m[5] || 0));
    if (!isNaN(d)) return d.toISOString();
  }
  const d = new Date(s); return isNaN(d) ? '' : d.toISOString();
}

/* ---------- CSV ---------- */
function parseCSV(text, delim) {
  text = String(text ?? '').replace(/^﻿/, '');
  if (!delim) {
    const nl = text.indexOf('\n');
    const first = text.slice(0, nl > -1 ? nl : text.length);
    delim = first.split('\t').length > first.split(',').length ? '\t' : ',';
  }
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"' && f === '') q = true;
    else if (c === delim) { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}
const csvCell = (v) => { v = String(v ?? ''); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
function findHeaderRow(rows, mustHave) {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const r = rows[i].map((x) => x.trim().toLowerCase());
    if (mustHave.every((h) => r.includes(h.toLowerCase()))) return i;
  }
  return -1;
}
function rowsToObjects(rows, headerIdx = 0) {
  const head = rows[headerIdx].map((h) => h.trim());
  return rows.slice(headerIdx + 1).map((r) => Object.fromEntries(head.map((h, i) => [h, String(r[i] ?? '').trim()])));
}

/* ---------- LinkedIn links (only ever linkedin.com) ---------- */
function liKey(u) {
  const m = String(u ?? '').match(/linkedin\.com\/(in|pub|sales\/lead|sales\/people)\/([^/?#\s,]+)/i);
  if (!m) return '';
  let slug = m[2]; try { slug = decodeURIComponent(slug); } catch { /* keep raw */ }
  return m[1].toLowerCase().replace('sales/people', 'sales/lead') + '/' + slug.toLowerCase();
}
function safeLi(u) {
  u = String(u ?? '').trim(); if (!u) return '';
  if (!/^https?:\/\//i.test(u)) { if (/^(www\.|[a-z]{2}\.)?linkedin\.com\//i.test(u)) u = 'https://' + u; else return ''; }
  try { const x = new URL(u); return /(^|\.)linkedin\.com$/i.test(x.hostname) ? 'https://' + x.host + x.pathname + x.search : ''; } catch { return ''; }
}
function safeHttp(u) { try { const x = new URL(String(u ?? '').trim()); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } }
const LI = {
  search: (q) => 'https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(q),
  messaging: 'https://www.linkedin.com/messaging/',
  thread: (id) => 'https://www.linkedin.com/messaging/thread/' + encodeURIComponent(id).replace(/%3D/gi, '=') + '/',
  connections: 'https://www.linkedin.com/mynetwork/invite-connect/connections/',
  sent: 'https://www.linkedin.com/mynetwork/invitation-manager/sent/',
  salesSearch: 'https://www.linkedin.com/sales/search/people',
  salesInbox: 'https://www.linkedin.com/sales/inbox',
  post: 'https://www.linkedin.com/feed/?shareActive=true',
  exportData: 'https://www.linkedin.com/mypreferences/d/download-my-data',
  feed: 'https://www.linkedin.com/feed/',
};

/* ---------- Clipboard (inside a click handler) ---------- */
function copyText(text) {
  text = String(text ?? '');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true, () => legacyCopy(text));
    }
  } catch { /* fall through */ }
  return Promise.resolve(legacyCopy(text));
}
function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove(); return ok;
}

/* ---------- Icons ---------- */
const ICONS = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  chart: '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-9"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sparkle: '<path d="M12 3.5 13.8 9l5.7 1.9-5.7 1.9L12 18.5l-1.8-5.7-5.7-1.9L10.2 9z"/><path d="M19 3v4M17 5h4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  arrow: '<path d="M5 12h14M13 5l7 7-7 7"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  paste: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  mark: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  flag: '<path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  plane: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  wave: '<path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>',
};
/* ---------- Artwork: stamps, postmark, avatars ---------- */
const AV_TONES = ['teal', 'coral', 'mint', 'butter', 'lilac', 'sky'];
const avTone = (name) => AV_TONES[hashStr(nameKey(name) || String(name || '?')) % AV_TONES.length];
const avHtml = (name, size = '') => `<span class="av ${size} tone-${avTone(name)}" aria-hidden="true">${esc(initials(name))}</span>`;
function stampPath(w, h, r, n, m) {
  const sx = w / n, sy = h / m; let d = 'M0 0';
  for (let i = 0; i < n; i++) { const c = sx * (i + 0.5); d += ` L${(c - r).toFixed(2)} 0 A${r} ${r} 0 0 0 ${(c + r).toFixed(2)} 0`; }
  d += ` L${w} 0`;
  for (let j = 0; j < m; j++) { const c = sy * (j + 0.5); d += ` L${w} ${(c - r).toFixed(2)} A${r} ${r} 0 0 0 ${w} ${(c + r).toFixed(2)}`; }
  d += ` L${w} ${h}`;
  for (let i = n - 1; i >= 0; i--) { const c = sx * (i + 0.5); d += ` L${(c + r).toFixed(2)} ${h} A${r} ${r} 0 0 0 ${(c - r).toFixed(2)} ${h}`; }
  d += ` L0 ${h}`;
  for (let j = m - 1; j >= 0; j--) { const c = sy * (j + 0.5); d += ` L0 ${(c + r).toFixed(2)} A${r} ${r} 0 0 0 0 ${(c - r).toFixed(2)}`; }
  return d + ' Z';
}
function stampSvg(score, label = 'FIT') {
  const w = 84, h = 98;
  const fill = score == null ? 'in-grey' : score >= 70 ? 'in-teal' : score >= 40 ? 'in-amber' : 'in-grey';
  const sub = score == null ? 'NO ICP' : score >= 70 ? 'GREAT MATCH' : score >= 40 ? 'MAYBE' : 'WEAK MATCH';
  return `<svg class="stamp" viewBox="-3 -3 ${w + 6} ${h + 6}" width="${w}" height="${h}" role="img" aria-label="ICP fit ${score == null ? 'unknown' : score + ' of 100'}">
    <path class="paper" d="${stampPath(w, h, 3.3, 7, 8)}"/>
    <rect class="${fill}" x="7.5" y="7.5" width="${w - 15}" height="${h - 15}" rx="2"/>
    <path class="st-wave" d="M13 ${h - 26} q6 -4 12 0 t12 0 t12 0 t12 0 t12 0"/>
    <text class="st-l" x="${w / 2}" y="27" text-anchor="middle">${label}</text>
    <text class="st-v" x="${w / 2}" y="58" text-anchor="middle">${score == null ? '–' : score}</text>
    <text class="st-s" x="${w / 2}" y="${h - 14}" text-anchor="middle">${sub}</text>
  </svg>`;
}
function brandSvg() {
  const w = 30, h = 34;
  return `<svg viewBox="-2 -2 ${w + 4} ${h + 4}" aria-hidden="true"><path fill="#FFFFFF" d="${stampPath(w, h, 1.9, 5, 6)}"/><rect x="4" y="4" width="${w - 8}" height="${h - 8}" rx="1.5" fill="#085761"/>
    <path d="M9.5 19.5 21 12l-4.2 12.5-2.4-4.3z" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/><path d="M14.4 20.2 21 12" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}
function heroArt(day, month, time, tz) {
  const cream = '#F9F3EB';
  return `<svg viewBox="0 0 300 200" aria-hidden="true" focusable="false">
    <defs><path id="pm-top" d="M 52 100 A 48 48 0 0 1 148 100"/><path id="pm-bot" d="M 44 100 A 56 56 0 0 0 156 100"/></defs>
    <path d="M18 178 C 70 178, 96 128, 150 130 S 238 98, 262 44" fill="none" stroke="#D2EEF3" stroke-width="2" stroke-dasharray="1.5 8" stroke-linecap="round" opacity=".75"/>
    <g transform="translate(246 18) rotate(-24)"><path d="M0 18 L44 0 L29 38 L19 25 Z" fill="#FFFDFC" stroke="#032F35" stroke-width="2" stroke-linejoin="round"/><path d="M44 0 L19 25 L17 36" fill="none" stroke="#032F35" stroke-width="2" stroke-linejoin="round"/></g>
    <g opacity=".95">
      <circle cx="100" cy="100" r="62" fill="none" stroke="${cream}" stroke-width="2.2"/>
      <circle cx="100" cy="100" r="42" fill="none" stroke="${cream}" stroke-width="1.4" opacity=".8"/>
      <text font-family="var(--f-body)" font-size="9" font-weight="700" letter-spacing="3" fill="${cream}"><textPath href="#pm-top" startOffset="50%" text-anchor="middle">LINKEDIN HOUR</textPath></text>
      <text font-family="var(--f-body)" font-size="9" font-weight="700" letter-spacing="3" fill="${cream}"><textPath href="#pm-bot" startOffset="50%" text-anchor="middle">${esc(time)} · ${esc(tz)}</textPath></text>
      <text x="100" y="104" text-anchor="middle" font-family="var(--f-display)" font-size="42" fill="${cream}">${esc(day)}</text>
      <text x="100" y="122" text-anchor="middle" font-family="var(--f-body)" font-size="10" font-weight="700" letter-spacing="3" fill="${cream}">${esc(month)}</text>
    </g>
    <g fill="none" stroke="${cream}" stroke-width="2.2" stroke-linecap="round" opacity=".5">
      <path d="M166 78 q9 -7 18 0 t18 0 t18 0 t18 0"/><path d="M170 94 q9 -7 18 0 t18 0 t18 0 t18 0"/><path d="M166 110 q9 -7 18 0 t18 0 t18 0 t18 0"/><path d="M170 126 q9 -7 18 0 t18 0 t18 0"/>
    </g>
    <circle cx="222" cy="150" r="5" fill="#E26A4F"/><circle cx="238" cy="160" r="3" fill="#E26A4F" opacity=".7"/>
  </svg>`;
}
function artEnvelope() {
  return `<svg viewBox="0 0 120 96" aria-hidden="true"><rect x="8" y="18" width="104" height="70" rx="8" fill="var(--surface)" stroke="var(--line-2)" stroke-width="2"/>
    <path d="M8 26 60 58 112 26" fill="none" stroke="var(--line-2)" stroke-width="2"/><rect x="82" y="26" width="22" height="26" rx="2" fill="var(--brand-wash)" stroke="var(--brand)" stroke-width="1.5" stroke-dasharray="2 2"/>
    <path d="M14 18h18l-4 7H10zM44 18h18l-4 7H40z" fill="var(--coral)" opacity=".75"/><path d="M29 18h11l-4 7h-11zM59 18h11l-4 7H55z" fill="var(--brand)" opacity=".75"/>
    <path d="M86 8 q6 -5 12 0 t12 0" fill="none" stroke="var(--coral)" stroke-width="2" stroke-linecap="round"/></svg>`;
}
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[n] || ''}</svg>`;

function loadScript(srcs) {
  const list = Array.isArray(srcs) ? srcs : [srcs];
  return list.reduce((p, src) => p.catch(() => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => res(); s.onerror = () => { s.remove(); rej(new Error('load failed: ' + src)); };
    document.head.appendChild(s);
  })), Promise.reject(new Error('start')));
}
async function capUse(name) {
  try {
    if (window.claude && typeof window.claude.use === 'function') return await window.claude.use(name);
  } catch { /* capability absent */ }
  return null;
}
