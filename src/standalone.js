/* Standalone runtime for Outreach Desk outside claude.ai.
   - AI drafting goes through /api/ai (your Anthropic API key stays on the server).
   - Data is saved in this browser (localStorage). Use Settings → Data → Full backup to move it.
   - Files are saved with a normal browser download. */
(function () {
  'use strict';
  const PW_KEY = 'outreach-desk:app-password';
  let health = null;
  async function getHealth() {
    if (health) return health;
    try { const r = await fetch('/api/health', { cache: 'no-store' }); health = r.ok ? await r.json() : { ai: false }; }
    catch { health = { ai: false }; }
    return health;
  }
  const readPw = () => { try { return localStorage.getItem(PW_KEY) || ''; } catch { return ''; } };
  const writePw = (v) => { try { localStorage.setItem(PW_KEY, v); } catch { /* session only */ } };

  function askPassword(message) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
      wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(16,41,45,.45);backdrop-filter:blur(3px);padding:16px';
      wrap.innerHTML = '<form style="width:min(380px,100%);background:#FFFDFC;border-radius:20px;padding:24px;box-shadow:0 28px 70px -16px rgba(16,41,45,.4);font:14px/1.5 \'Plus Jakarta Sans\',system-ui,sans-serif;color:#10292D">'
        + '<h2 style="margin:0 0 6px;font:400 26px/1.1 \'Instrument Serif\',Georgia,serif">Unlock AI drafting</h2>'
        + '<p data-msg style="margin:0 0 14px;color:#4b5e61"></p>'
        + '<input type="password" autocomplete="current-password" required style="width:100%;box-sizing:border-box;height:42px;border:1px solid #E2D6C5;border-radius:11px;padding:0 12px;font:inherit;background:#fff">'
        + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button type="button" data-cancel style="height:38px;padding:0 14px;border-radius:11px;border:1px solid #E2D6C5;background:#fff;font:600 13.5px inherit;cursor:pointer">Not now</button>'
        + '<button type="submit" style="height:38px;padding:0 16px;border-radius:11px;border:0;background:#085761;color:#fff;font:600 13.5px inherit;cursor:pointer">Unlock</button></div></form>';
      wrap.querySelector('[data-msg]').textContent = message;
      const input = wrap.querySelector('input');
      const done = (v) => { wrap.remove(); resolve(v); };
      wrap.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); done(input.value); });
      wrap.querySelector('[data-cancel]').addEventListener('click', () => done(null));
      document.body.appendChild(wrap); setTimeout(() => input.focus(), 30);
    });
  }

  async function call(body, signal) {
    let wrong = false;
    for (;;) {
      let r;
      try {
        r = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json', 'x-app-password': readPw() }, body: JSON.stringify(body), signal });
      } catch (e) {
        if (e && e.name === 'AbortError') throw { code: 'cancelled', message: 'Stopped' };
        throw { code: 'network', message: String(e) };
      }
      if (r.status === 401) {
        const pw = await askPassword(wrong ? 'That password didn’t work. Try again.' : 'Enter the app password you set in Vercel (APP_PASSWORD).');
        if (pw == null) throw { code: 'cancelled', message: 'No password' };
        writePw(pw); wrong = true; continue;
      }
      const data = await r.json().catch(() => ({}));
      if (r.status === 429) throw { code: 'rate_limited', message: data.error || 'Busy' };
      if (r.status === 413) throw { code: 'prompt_too_large', message: data.error || 'Too large' };
      if (!r.ok) throw { code: 'network', message: data.error || ('HTTP ' + r.status) };
      return data;
    }
  }
  function parseJson(text) {
    let t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return JSON.parse(t); } catch { /* try to cut out the JSON */ }
    const start = t.search(/[[{]/); const end = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'));
    if (start >= 0 && end > start) { try { return JSON.parse(t.slice(start, end + 1)); } catch { /* fall through */ } }
    throw { code: 'invalid_json', message: 'The reply was not valid JSON' };
  }
  const sample = async (input, opts = {}) => {
    const { text = '' } = await call({ prompt: String(input), tier: opts.modelTier || 'default' }, opts.signal);
    if (opts.onText) opts.onText({ text, delta: text });
    return { text, truncated: false };
  };
  sample.json = async (input, opts = {}) => {
    const { text = '' } = await call({ prompt: String(input), tier: opts.modelTier || 'default', json: true }, opts.signal);
    if (opts.onText) opts.onText({ text, delta: text });
    return parseJson(text);
  };
  const downloads = {
    save: async ({ filename, data }) => {
      const blob = data instanceof Blob ? data : new Blob([data], { type: /\.json$/i.test(filename) ? 'application/json' : /\.csv$/i.test(filename) ? 'text/csv' : 'text/plain' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    },
  };
  window.claude = {
    use: async (name) => {
      if (name === 'sample') { const h = await getHealth(); return h.ai ? sample : null; }
      if (name === 'downloads') return downloads;
      return null; // db: the app falls back to this browser's storage
    },
  };
})();
