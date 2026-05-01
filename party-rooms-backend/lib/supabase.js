/**
 * Supabase clients for the Express API.
 * - Anon: auth helpers + optional public reads (depends on RLS).
 * - User: inherits JWT from the caller for row-level policies.
 * - Admin: optional service role for trusted server-side reads/writes (never expose to the browser).
 */

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

function assertConfig() {
  if (!url || !anonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
}

/** Default anon client (signup/login, getUser(token)). */
function getSupabaseAnon() {
  assertConfig();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Runs queries as the signed-in user (pass access_token from Authorization header). */
function getSupabaseWithUser(accessToken) {
  assertConfig();
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Bypasses RLS — only available when SUPABASE_SERVICE_ROLE_KEY is set (recommended for this backend). */
function getSupabaseAdmin() {
  assertConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Prefer admin if configured; otherwise user-scoped client (needs matching RLS policies). */
function getDbClient(accessToken) {
  const admin = getSupabaseAdmin();
  if (admin) return admin;
  return getSupabaseWithUser(accessToken);
}

module.exports = {
  getSupabaseAnon,
  getSupabaseWithUser,
  getSupabaseAdmin,
  getDbClient,
};
