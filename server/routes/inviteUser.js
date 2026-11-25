/**
 * server/routes/inviteUser.js
 *
 * POST /api/invite-user — invite a new staff member by email.
 *
 * Called from src/pages/AdminUsers.jsx (the "Invite User" dialog), which
 * sends { email, business_id } and only checks res.ok — on success it
 * toasts "Invitation sent" and notes the new user appears after they
 * complete signup, at which point an admin assigns their staff role in
 * the same page.
 *
 * Flow
 * 1. Validate the email (400 on missing/malformed).
 * 2. If a staff_role is supplied, it must be one of server/lib/roles.js
 *    (400 otherwise). The role is OPTIONAL: the AdminUsers dialog does not
 *    ask for one — the role is assigned after signup, per the dialog's own
 *    "How it works" steps. When a role is supplied it is stored in the
 *    invite's user metadata so the signup-time profile creation can pick
 *    it up.
 * 3. Reject an email that already has a users row with 409. The Auth Admin
 *    API's own "already registered" error is mapped to 409 as well.
 * 4. Send the invite with supabaseAdmin.auth.admin.inviteUserByEmail —
 *    the user gets an invitation email, clicks the link and completes
 *    signup. business_id (the inviting admin's business, falling back to
 *    the body's value) is stored in the invite metadata so the new user's
 *    profile can be linked to the business at signup.
 *
 * The users row itself is NOT created here: it is created at signup by the
 * project's existing signup-time mechanism (the same one the frontend
 * relies on — BusinessOnboarding updates the row by auth id). Creating it
 * here would risk a duplicate-key failure in that mechanism.
 *
 * Route protection (server/index.js): requireAuth + requireRoles('admin',
 * 'super_admin') — only admins may invite, matching the AdminUsers page
 * gate in the frontend.
 *
 * For tests, the service-role client comes from req.app.locals.auth
 * (adminClient override), the same seam as requireAuth — see
 * server/lib/adminClient.js.
 */

import { getAdminClient } from '../lib/adminClient.js';
import { STAFF_ROLES } from '../lib/roles.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function inviteUser(req, res) {
  const body = req.body ?? {};

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }

  // Role is optional (assigned after signup in the AdminUsers UI). When
  // supplied it must be a role the app defines — accept staff_role, with
  // `role` as a tolerated alias.
  const staffRole = body.staff_role ?? body.role ?? null;
  if (staffRole !== null && staffRole !== undefined && !STAFF_ROLES.includes(staffRole)) {
    return res.status(400).json({ error: `Invalid staff role: ${staffRole}` });
  }

  const admin = getAdminClient(req.app?.locals?.auth);
  if (!admin) {
    console.error('invite-user: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured');
    return res.status(503).json({ error: 'User invites are not configured on the server' });
  }

  // Already registered? A row in public.users means the person is already
  // a staff member (or has already been invited and signed up).
  try {
    const { data: existing, error: lookupError } = await admin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) {
      return res.status(409).json({ error: 'A user with this email is already registered' });
    }
  } catch (err) {
    console.error('invite-user: failed to check existing users:', err);
    return res.status(503).json({ error: 'Unable to check existing users' });
  }

  // The invite belongs to the inviting admin's business; fall back to the
  // business_id the frontend sent (same value in practice).
  const businessId =
    req.user?.business_id ||
    (typeof body.business_id === 'string' && body.business_id ? body.business_id : null) ||
    null;

  const metadata = {};
  if (businessId) metadata.business_id = businessId;
  if (staffRole) metadata.staff_role = staffRole;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: metadata });
  if (error) {
    if (/already registered/i.test(error.message || '')) {
      return res.status(409).json({ error: 'A user with this email is already registered' });
    }
    console.error('invite-user: failed to send invitation:', error);
    return res.status(500).json({ error: 'Failed to send invitation' });
  }

  return res.status(200).json({
    ok: true,
    invited: true,
    email,
    user_id: data?.user?.id ?? null,
  });
}
