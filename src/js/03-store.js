/* ================= Storage =================
   Records live in the page's private database (db capability) as "bucket"
   documents: leads/<bucket> and convos/<bucket>, each {items: {id: record}}.
   Settings, ICPs and templates live in meta/app. When the database is not
   available (a saved copy of the page), the desk falls back to this browser. */
class Buckets {
  constructor(name, maxItems, maxBytes) {
    this.name = name; this.maxItems = maxItems; this.maxBytes = maxBytes;
    this.items = new Map(); this.loc = new Map(); this.members = new Map(); this.sizes = new Map();
    this.dirty = new Set(); this.inflight = new Set();
  }
  normalize(obj) {
    const out = {};
    for (const [id, it] of Object.entries(obj || {})) {
      if (!it || typeof it !== 'object') continue;
      out[id] = this.name === 'leads' ? normLead(Object.assign({}, it, { id })) : normConvo(Object.assign({}, it, { id }));
    }
    return out;
  }
  load(b, obj, already) {
    const recs = already ? obj : this.normalize(obj);
    const old = this.members.get(b);
    if (old) for (const id of old) if (this.loc.get(id) === b) { this.items.delete(id); this.loc.delete(id); this.sizes.delete(id); }
    const set = new Set();
    for (const [id, rec] of Object.entries(recs)) {
      const prev = this.loc.get(id);
      if (prev && prev !== b) this.members.get(prev)?.delete(id);
      this.items.set(id, rec); this.loc.set(id, b); set.add(id); this.sizes.set(id, byteLen(rec));
    }
    this.members.set(b, set);
  }
  drop(b) {
    for (const id of this.members.get(b) || []) if (this.loc.get(id) === b) { this.items.delete(id); this.loc.delete(id); this.sizes.delete(id); }
    this.members.delete(b);
  }
  bytes(b) { let s = 0; for (const id of this.members.get(b) || []) s += this.sizes.get(id) || 0; return s; }
  pick(bytes) {
    for (const [b, set] of this.members) if (set.size < this.maxItems && this.bytes(b) + bytes < this.maxBytes) return b;
    const nb = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this.members.set(nb, new Set());
    return nb;
  }
  put(rec) {
    const id = rec.id; const bytes = byteLen(rec);
    this.items.set(id, rec); this.sizes.set(id, bytes);
    let b = this.loc.get(id);
    if (b && this.bytes(b) > this.maxBytes * 1.35) { this.members.get(b)?.delete(id); this.dirty.add(b); b = null; }
    if (!b || !this.members.has(b)) { b = this.pick(bytes); this.members.get(b).add(id); this.loc.set(id, b); }
    this.dirty.add(b);
  }
  remove(id) {
    const b = this.loc.get(id);
    this.items.delete(id); this.loc.delete(id); this.sizes.delete(id);
    if (b) { this.members.get(b)?.delete(id); this.dirty.add(b); }
  }
  obj(b) { const o = {}; for (const id of this.members.get(b) || []) { const it = this.items.get(id); if (it) o[id] = it; } return o; }
  split(b) {
    const ids = [...(this.members.get(b) || [])];
    const half = ids.slice(Math.ceil(ids.length / 2));
    const nb = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this.members.set(nb, new Set(half));
    for (const id of half) { this.members.get(b).delete(id); this.loc.set(id, nb); }
    this.dirty.add(b); this.dirty.add(nb);
  }
  clear() { this.items.clear(); this.loc.clear(); this.members.clear(); this.sizes.clear(); this.dirty.clear(); }
}

const S = {
  mode: 'loading', ready: false, meta: null, metaDirty: false, metaInflight: false,
  L: new Buckets('leads', 60, 170000),
  C: new Buckets('convos', 40, 170000),
  adapter: null, save: 'idle', saveErr: null, version: 0, dbError: null,
  profile() { const m = this.meta; if (!m) return null; return m.profiles.find((p) => p.id === m.active) || m.profiles[0] || null; },
  leads() { const pid = this.profile()?.id; return [...this.L.items.values()].filter((l) => !l.profileId || l.profileId === pid); },
  convos() { const pid = this.profile()?.id; return [...this.C.items.values()].filter((c) => !c.profileId || c.profileId === pid); },
  lead(id) { return this.L.items.get(id) || null; },
  convo(id) { return this.C.items.get(id) || null; },
  putLead(l) { l.profileId = l.profileId || this.profile()?.id || ''; this.L.put(l); changed(); },
  putConvo(c) { c.profileId = c.profileId || this.profile()?.id || ''; c.updatedAt = nowISO(); this.C.put(c); changed(); },
  delLead(id) { this.L.remove(id); changed(); },
  delConvo(id) { this.C.remove(id); changed(); },
  saveMeta() { this.metaDirty = true; changed(); },
};

let _derived = new Map();
function derived(key, fn) { if (!_derived.has(key)) _derived.set(key, fn()); return _derived.get(key); }
function bump() { S.version++; _derived = new Map(); render(); }
function changed() { bump(); scheduleFlush(); }

const scheduleFlush = debounce(() => { flush(); }, 550);
let _flushing = false, _again = false;
async function flush() {
  if (!S.adapter) return;
  if (_flushing) { _again = true; return; }
  if (!S.metaDirty && !S.L.dirty.size && !S.C.dirty.size) return;
  _flushing = true; setSave('saving');
  let failed = null;
  try {
    if (S.metaDirty && S.meta) {
      S.metaDirty = false; S.metaInflight = true;
      try { await withRetry(() => S.adapter.writeMeta(clone(S.meta))); }
      catch (e) { S.metaDirty = true; failed = e; }
      finally { S.metaInflight = false; }
    }
    for (const B of [S.L, S.C]) {
      const ids = [...B.dirty]; B.dirty.clear();
      for (const b of ids) {
        B.inflight.add(b);
        try {
          const obj = B.obj(b);
          if (!Object.keys(obj).length) { await withRetry(() => S.adapter.deleteBucket(B.name, b)); B.members.delete(b); }
          else await withRetry(() => S.adapter.writeBucket(B.name, b, clone(obj)));
        } catch (e) {
          if (e && (e.code === 'invalid_argument' || e.code === 'transform_error') && (B.members.get(b)?.size || 0) > 1) B.split(b);
          else B.dirty.add(b);
          failed = e;
        } finally { B.inflight.delete(b); }
      }
    }
  } finally {
    _flushing = false;
    setSave(failed ? 'error' : 'saved', failed);
    if (failed && failed.code === 'quota_exceeded') toast('Storage is full. Delete old leads or conversations, then try again.', { tone: 'bad' });
    if (_again || (failed && (failed.code === 'invalid_argument' || failed.code === 'transform_error'))) { _again = false; scheduleFlush(); }
  }
}
async function withRetry(fn) {
  try { return await fn(); }
  catch (e) {
    if (e && (e.code === 'unavailable' || e.code === 'resource_exhausted')) { await sleep(700 + Math.random() * 1300); return fn(); }
    throw e;
  }
}
function setSave(state, err) {
  S.save = state; S.saveErr = err || null;
  const el = document.getElementById('save-state');
  if (el) el.outerHTML = saveStateHtml();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') scheduleFlush.flush(); });

/* ---------- Adapters ---------- */
function DbAdapter(db) {
  return {
    kind: 'db',
    writeMeta: (m) => db.doc('meta/app').set(m),
    writeBucket: (coll, b, obj) => db.doc(coll + '/' + b).set({ items: obj, n: Object.keys(obj).length, at: nowISO() }),
    deleteBucket: (coll, b) => db.doc(coll + '/' + b).delete(),
    subscribe(h) {
      const un = [];
      un.push(db.doc('meta/app').onSnapshot((s) => h.meta(s), (e) => h.error('meta', e)));
      for (const coll of ['leads', 'convos']) un.push(db.collection(coll).onSnapshot((snap) => h.coll(coll, snap), (e) => h.error(coll, e)));
      return () => un.forEach((u) => { try { u(); } catch { /* already closed */ } });
    },
  };
}
const LOCAL_KEY = 'outreach-desk:v1';
function LocalAdapter() {
  let data;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    data = raw ? JSON.parse(raw) : { meta: null, leads: {}, convos: {} };
    localStorage.setItem(LOCAL_KEY + ':probe', '1'); localStorage.removeItem(LOCAL_KEY + ':probe');
  } catch { return null; }
  data.leads = data.leads || {}; data.convos = data.convos || {};
  const persist = () => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch (e) { throw { code: 'quota_exceeded', message: String(e) }; } };
  return {
    kind: 'local', initial: data,
    writeMeta: async (m) => { data.meta = m; persist(); },
    writeBucket: async (coll, b, obj) => { data[coll][b] = obj; persist(); },
    deleteBucket: async (coll, b) => { delete data[coll][b]; persist(); },
    subscribe: () => () => {},
  };
}
function MemoryAdapter() {
  return { kind: 'memory', writeMeta: async () => {}, writeBucket: async () => {}, deleteBucket: async () => {}, subscribe: () => () => {} };
}

function stableStr(v) {
  if (Array.isArray(v)) return '[' + v.map(stableStr).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableStr(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
function onMetaSnap(snap) {
  if (S.metaDirty || S.metaInflight) return;
  if (!snap.exists) return;
  const incoming = migrateMeta(clone(snap.data()));
  if (stableStr(incoming) !== stableStr(S.meta)) { S.meta = incoming; bump(); }
}
function onCollSnap(B, snap) {
  let any = false;
  for (const ch of snap.docChanges()) {
    const b = ch.doc.id;
    if (B.dirty.has(b) || B.inflight.has(b)) continue;
    if (ch.type === 'removed') { if (B.members.has(b)) { B.drop(b); any = true; } continue; }
    const recs = B.normalize(clone((ch.doc.data() || {}).items || {}));
    const cur = B.members.has(b) ? stableStr(B.obj(b)) : '';
    if (cur !== stableStr(recs)) { B.load(b, recs, true); any = true; }
  }
  if (any) bump();
}

async function initStore() {
  const db = await capUse('db');
  if (db) {
    S.adapter = DbAdapter(db); S.mode = 'db';
    await new Promise((resolve) => {
      const got = { meta: false, leads: false, convos: false };
      let done = false;
      const check = () => { if (!done && got.meta && got.leads && got.convos) { done = true; resolve(); } };
      S.unsub = S.adapter.subscribe({
        meta: (s) => { onMetaSnap(s); if (!s.metadata || !s.metadata.fromCache) { got.meta = true; check(); } },
        coll: (name, snap) => { onCollSnap(name === 'leads' ? S.L : S.C, snap); if (!snap.metadata || !snap.metadata.fromCache) { got[name] = true; check(); } },
        error: (what, e) => {
          S.dbError = e;
          if (e && e.code === 'revoked') { S.mode = 'memory'; S.adapter = MemoryAdapter(); toast('This page lost access to its saved data. Reload to try again.', { tone: 'bad' }); }
          got[what] = true; check(); render();
        },
      });
      setTimeout(() => { if (!done) { done = true; resolve(); } }, 9000);
    });
  } else {
    const local = LocalAdapter();
    if (local) {
      S.adapter = local; S.mode = 'local';
      if (local.initial.meta) S.meta = migrateMeta(local.initial.meta);
      for (const [b, obj] of Object.entries(local.initial.leads || {})) S.L.load(b, obj);
      for (const [b, obj] of Object.entries(local.initial.convos || {})) S.C.load(b, obj);
    } else { S.adapter = MemoryAdapter(); S.mode = 'memory'; }
  }
  S.ready = true; bump();
}
