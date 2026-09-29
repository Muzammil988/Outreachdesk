// POST /api/ai  { prompt, tier?, json? }  ->  { text, model }
// Keeps the Anthropic API key on the server. Requires the APP_PASSWORD header so
// strangers who find the URL can't spend your credits.
const crypto = require('crypto');

const MODELS = {
  quick: process.env.MODEL_QUICK || 'claude-haiku-4-5-20251001',
  default: process.env.MODEL_DEFAULT || 'claude-sonnet-5-5',
  complex: process.env.MODEL_BEST || 'claude-opus-5-5',
};
const MAX_PROMPT_CHARS = 200000;

function sameSecret(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const password = process.env.APP_PASSWORD;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!password) return res.status(503).json({ error: 'Set APP_PASSWORD in Vercel before using AI drafting.' });
  if (!key) return res.status(503).json({ error: 'Set ANTHROPIC_API_KEY in Vercel before using AI drafting.' });
  if (!sameSecret(req.headers['x-app-password'] || '', password)) return res.status(401).json({ error: 'Wrong or missing app password' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const prompt = String((body && body.prompt) || '');
  if (!prompt.trim()) return res.status(400).json({ error: 'Empty prompt' });
  if (prompt.length > MAX_PROMPT_CHARS) return res.status(413).json({ error: 'Prompt too large' });
  const model = MODELS[body.tier] || MODELS.default;

  const payload = { model, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] };
  if (body.json) payload.system = 'Reply with only valid JSON exactly as requested. No prose before or after it, no code fences.';

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || ('Anthropic API error ' + r.status);
      if (r.status === 429 || r.status === 529) return res.status(429).json({ error: msg });
      if (r.status === 400 && /too long|too many tokens/i.test(msg)) return res.status(413).json({ error: msg });
      return res.status(502).json({ error: msg });
    }
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    return res.status(200).json({ text, model });
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach the Anthropic API' });
  }
};
