/**
 * server/middleware/requireAuth.js
 *
 * Express middleware: verify the caller's Supabase session AND staff role
 * before any user-facing API handler runs.
 *
 * How it works
 * - The browser sends the current session's access token as
 *   `Authorization: Bearer <jwt>` (see src/lib/apiFetch.js).
 * - The token is verified with supabase.auth.getUser(token) against an
 *   ANON-key client — never the service-role client (service role bypasses
 *   all checks, so verifying with it would prove nothing).
 * - Missing or invalid/expired tokens are rejected with 401.
 * - The caller's staff profile is then read from the public.users table
 *   (same lookup as src/lib/AuthContext.jsx) via the service-role client
 *   (see server/lib/adminClient.js). The role comes from that database row
 *   — never from anything the caller sends. A signed-in user with no row,
 *   no staff_role, or a role outside server/lib/roles.js is rejected with
 *   403. The verified user's id, email, staff_role and business_id are
 *   attached to req.user for handlers to use.
 *
 * requireRoles(...allowed) is a second middleware factory for per-route
 * least privilege — chain it after requireAuth, e.g.
 *   app.post('/api/invite-user', requireAuth, requireRoles('admin'), inviteUser)
 * It answers 403 when the caller's role is not in the allowed list.
 *
 * Routes that must NOT use this middleware
 * - POST /api/agent-loop/run and POST /api/check-overdue-requests: called by
 *   an external cron with no user session; they have their own optional
 *   CRON_SECRET check inside the handler.
 * - POST /api/stripe-webhook: verified by Stripe's signature instead.
 * - GET /api/health: public liveness check.
 *
 * Configuration: SUPABASE_URL, SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY (server/.env — the anon key is the same public
 * key the frontend already uses as VITE_SUPABASE_ANON_KEY; it is safe to
 * use server-side for verification).
 *
 * For tests, pass overrides via req.app.locals.auth:
 *   { authClient: { auth: { getUser: async (token) => ({ data, error }) } } }
 *   { getUserProfile: async (userId) => ({ id, staff_role, business_id }) }
 *   { adminClient }  — a fake Supabase-like client used for the profile
 *                      lookup when no getUserProfile override is given
 * — the same req.app.locals override pattern as req.app.locals.agentLoop.
 * The Supabase clients are created lazily so importing this module never
 * throws when the env vars are absent (existing route tests run with no
 * Supabase env at all).
 */

import { createClient } from '@supabase/supabase-js';
import { getAdminClient, loadUserProfile } from '../lib/adminClient.js';
import { isValidStaffRole } from '../lib/roles.js';

let cachedClient = null;

function getAuthClient(overrides) {
  if (overrides?.authClient) return overrides.authClient;
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  cachedClient = createClient(url, anonKey, { auth: { persistSession: false } });
  return cachedClient;
}

export default async function requireAuth(req, res, next) {
  const overrides = req.app?.locals?.auth;
  const client = getAuthClient(overrides);

  if (!client) {
    console.error('requireAuth: SUPABASE_URL / SUPABASE_ANON_KEY are not configured');
    return res.status(503).json({ error: 'Authentication is not configured on the server' });
  }

  const header = req.headers?.authorization;
  const token =
    typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization Bearer token' });
  }

  const { data, error } = await client.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  // Role check: the caller's staff_role is read from public.users by auth
  // user id — never trusted from the request. A signed-in user with no
  // role is blocked here exactly as the frontend's AuthContext blocks them
  // from the app ('user_not_registered').
  const admin = getAdminClient(overrides);
  if (!admin && typeof overrides?.getUserProfile !== 'function') {
    console.error('requireAuth: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured');
    return res.status(503).json({ error: 'Role verification is not configured on the server' });
  }

  let profile;
  try {
    profile = await loadUserProfile(overrides, admin, data.user.id);
  } catch (err) {
    console.error('requireAuth: failed to load user profile:', err);
    return res.status(503).json({ error: 'Unable to verify user role' });
  }

  if (!profile || !isValidStaffRole(profile.staff_role)) {
    return res.status(403).json({ error: 'User has no staff role assigned for this app' });
  }

  req.user = {
    id: data.user.id,
    email: data.user.email,
    staff_role: profile.staff_role,
    business_id: profile.business_id ?? null,
  };
  return next();
}

/**
 * Restrict a route to specific staff roles. Must be chained after
 * requireAuth, which populates req.user. Answers 403 when the caller's
 * role is not in the allowed list.
 */
export function requireRoles(...allowed) {
  return (req, res, next) => {
    if (!req.user?.staff_role) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowed.includes(req.user.staff_role)) {
      return res.status(403).json({
        error: `This action requires one of the following roles: ${allowed.join(', ')}`,
      });
    }
    return next();
  };
}
