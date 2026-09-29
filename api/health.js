// GET /api/health -> tells the page whether AI drafting is set up. Reveals no secrets.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ai: Boolean(process.env.ANTHROPIC_API_KEY && process.env.APP_PASSWORD) });
};
