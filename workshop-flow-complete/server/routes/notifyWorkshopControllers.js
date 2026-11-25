/**
 * POST /api/notify-workshop-controllers
 *
 * Called when a PartsRequest status changes to 'quoted' or 'awaiting_workshop_approval'.
 *
 * Body: { request_id, new_status, old_status, request_data }
 */

import { supabaseAdmin } from '../supabaseAdmin.js';
import { sendEmail } from '../email.js';

const TRIGGER_STATUSES = ['quoted', 'awaiting_workshop_approval'];

export default async function notifyWorkshopControllers(req, res) {
  try {
    const { request_id: requestId, new_status: newStatus, old_status: oldStatus, request_data: request } = req.body;

    if (!TRIGGER_STATUSES.includes(newStatus) || oldStatus === newStatus) {
      return res.json({ success: true, message: 'Status change does not require WC notification' });
    }

    const { data: controllers, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .eq('staff_role', 'workshop_controller')
      .eq('business_id', request.business_id);

    if (error) throw error;
    if (!controllers?.length) {
      return res.json({ success: true, message: 'No workshop controllers found' });
    }

    const appUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const requestUrl = `${appUrl}/RequestDetail?id=${requestId}`;

    const isQuoted  = newStatus === 'quoted';
    const title     = isQuoted
      ? `Quote Ready for Review – Job #${request.job_card_number}`
      : `Awaiting Your Approval – Job #${request.job_card_number}`;
    const message   = isQuoted
      ? `Parts Interpreter has uploaded a quote. Please review and approve.`
      : `A quote is awaiting your approval for Job #${request.job_card_number}.`;
    const subject   = isQuoted
      ? 'Quote Ready for Review – Action Required'
      : 'Quote Awaiting Your Approval – Action Required';

    // In-app notifications
    const notifications = controllers.map(c => ({
      type:            'approval_required',
      title,
      message,
      request_id:      requestId,
      job_card_number: request.job_card_number,
      recipient_email: c.email,
      recipient_role:  'workshop_controller',
      business_id:     request.business_id,
      is_read:         false,
    }));

    const { error: notifError } = await supabaseAdmin.from('notifications').insert(notifications);
    if (notifError) throw notifError;

    // action_required flag
    const { error: updateError } = await supabaseAdmin
      .from('parts_requests')
      .update({
        action_required:       true,
        action_required_since: new Date().toISOString(),
        action_required_role:  'workshop_controller',
      })
      .eq('id', requestId);
    if (updateError) throw updateError;

    // Emails
    await Promise.all(controllers.map(c =>
      sendEmail({
        to:      c.email,
        subject,
        body: `Hello ${c.full_name},\n\n${message}\n\nJob Card: ${request.job_card_number}\nCustomer: ${request.customer_name || 'N/A'}\nVehicle: ${request.vehicle_type || 'N/A'}\nQuote Total (Inc GST): $${request.parts_total_inc_gst?.toFixed(2) || 'N/A'}\n\n${requestUrl}`,
      })
    ));

    return res.json({ success: true, message: `Notified ${controllers.length} workshop controller(s)` });

  } catch (err) {
    console.error('notifyWorkshopControllers error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
