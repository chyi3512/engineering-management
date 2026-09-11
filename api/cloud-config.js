// Only public browser configuration is returned. Never expose a secret/service-role key.
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || '';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !key.startsWith('sb_publishable_')) {
    return res.status(503).json({ error: 'Supabase 尚未設定：請設定 SUPABASE_URL 與 SUPABASE_PUBLISHABLE_KEY。' });
  }
  return res.status(200).json({ url, key });
};
