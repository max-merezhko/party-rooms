const { getSupabaseAnon, getSupabaseWithUser, getDbClient } = require('../lib/supabase');

function extractBearer(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/**
 * Validates Supabase access token and attaches user + DB client.
 */
async function requireAuth(req, res, next) {
  try {
    const token = extractBearer(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization Bearer token' });
    }

    const supabase = getSupabaseAnon();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.accessToken = token;
    req.user = user;
    req.supabaseUser = getSupabaseWithUser(token);
    req.db = getDbClient(token);
    return next();
  } catch (err) {
    return res.status(401).json({ error: err.message || 'Unauthorized' });
  }
}

module.exports = {
  extractBearer,
  requireAuth,
};
