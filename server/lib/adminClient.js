/**
 * server/lib/adminClient.js
 *
 * Lazy service-role Supabase client for server-side operations that must
 * bypass RLS — currently the staff-role lookup behind requireAuth and the
 * user-invite route. This is the same client as server/supabaseAdmin.js,
 * but created lazily (and never imported at module load) so importing a
 * route or middleware never throws when the env vars are absent — the
 * existing server tests run with no Supabase env at all.
 *
 * For tests, pass overrides via req.app.locals.auth:
 *   { adminClient }        — a fake Supabase-like client (used by the
 *                            invite route for its users-table + Auth Admin
 *                            calls)
 *   { getUserProfile }     — async (userId) => profile row | null (used by
 *                            requireAuth instead of querying the users table)
 *
 * The service-role key bypasses all checks, so this client must never be
 * used to verify a caller's session — that is what the ANON-key client in
 * requireAuth is for.
 */

import { createClient } from '@supabase/supabase-js';

let cachedAdminClient = null;

export function getAdminClient(overrides) {
  if (overrides?.adminClient) return overrides.adminClient;
  if (cachedAdminClient) return cachedAdminClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  cachedAdminClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedAdminClient;
}

/**
 * Load a user's staff profile the same way the frontend does
 * (src/lib/AuthContext.jsx): the public.users row keyed by auth user id.
 * Returns the row ({ id, staff_role, business_id }) or null when there is
 * no row. Throws on a database error.
 */
export async function loadUserProfile(overrides, adminClient, userId) {
  if (typeof overrides?.getUserProfile === 'function') {
    return overrides.getUserProfile(userId);
  }
  const { data, error } = await adminClient
    .from('users')
    .select('id, staff_role, business_id')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
