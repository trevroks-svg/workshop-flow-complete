/**
 * server/lib/roles.js
 *
 * The staff roles the app defines — single source of truth for server-side
 * role checks. These are the same values used by the frontend:
 * - src/pages/AdminUsers.jsx STAFF_ROLES (technician, parts_interpreter,
 *   workshop_controller, service_advisor, service_manager, admin)
 * - src/Layout.jsx role map, which additionally defines super_admin
 * - supabase/migrations/202607310001_private_workshop_storage.sql, whose
 *   storage policies check the same set
 *
 * Do not invent new roles here. If the business adds one, add it to the
 * frontend lists and this file together.
 */

export const STAFF_ROLES = [
  'technician',
  'parts_interpreter',
  'workshop_controller',
  'service_advisor',
  'service_manager',
  'admin',
  'super_admin',
];

/** Roles that may manage users and other admin-only operations. */
export const ADMIN_ROLES = ['admin', 'super_admin'];

/** Roles that may manage the workshop day (schedule import, agent drafts). */
export const MANAGER_ROLES = ['service_manager', 'admin', 'super_admin'];

export function isValidStaffRole(role) {
  return typeof role === 'string' && STAFF_ROLES.includes(role);
}
