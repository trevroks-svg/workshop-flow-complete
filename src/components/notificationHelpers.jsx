/**
 * notificationHelpers.js
 *
 * Client-side helpers for creating notifications and managing action-required flags.
 * These call your own API server (server/routes/) rather than base44 functions.
 */

import { entities } from '@/api/entities';

/**
 * Creates an in-app notification and sets the action-required flag on the request.
 * Email sending is handled server-side (see server/routes/notify*.js).
 */
export async function createNotificationWithAction({
  requestId,
  requestData,
  targetRole,
  notificationType,
  notificationTitle,
  notificationMessage,
}) {
  const now = new Date().toISOString();

  // Create in-app notification
  await entities.Notification.create({
    type: notificationType,
    title: notificationTitle,
    message: notificationMessage,
    request_id: requestId,
    job_card_number: requestData.job_card_number,
    recipient_role: targetRole,
    business_id: requestData.business_id,
    is_read: false,
  });

  // Set action-required flag on the request
  await entities.PartsRequest.update(requestId, {
    action_required: true,
    action_required_since: now,
    action_required_role: targetRole,
  });
}

/**
 * Clears the action-required flag when a user opens a request.
 */
export async function clearActionRequired(requestId, userEmail) {
  const now = new Date().toISOString();

  await entities.PartsRequest.update(requestId, {
    action_required: false,
    action_cleared_at: now,
    action_cleared_by: userEmail,
  });
}
