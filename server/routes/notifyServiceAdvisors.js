/**
 * POST /api/notify-service-advisors
 *
 * Triggered when a PartsRequest status changes to an advisor-relevant state.
 *
 * Body: { request_id, new_status, old_status, request_data }
 */

import { supabaseAdmin } from '../supabaseAdmin.js';
import { sendEmail } from '../email.js';

const TRIGGER_STATUSES = ['sent_to_advisor', 'advisor_action_required', 'customer_approved', 'customer_denied'];
const ACTION_STATUSES  = ['sent_to_advisor', 'advisor_action_required'];

export default async function notifyServiceAdvisors(req, res) {
  try {
    const { request_id: requestId, new_status: newStatus, old_status: oldStatus, request_data: request } = req.body;

    if (!TRIGGER_STATUSES.includes(newStatus) || oldStatus === newStatus) {
      return res.json({ success: true, message: 'Status change does not require advisor notification' });
    }

    const { data: advisors, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .eq('staff_role', 'service_advisor')
      .eq('business_id', request.business_id);

    if (error) throw error;
    if (!advisors?.length) {
      return res.json({ success: true, message: 'No service advisors found' });
    }

    const appUrl     = process.env.CLIENT_URL || 'http://localhost:5173';
    const requestUrl = `${appUrl}/RequestDetail?id=${requestId}`;

    let title, message, subject, notifType;

    if (newStatus === 'sent_to_advisor') {
      notifType = 'approval_completed';
      title     = `Quote Approved – Action Required – Job #${request.job_card_number}`;
      message   = `Workshop Controller approved the quote. Present to customer. Total: $${request.parts_total_inc_gst?.toFixed(2) || 'N/A'}`;
      subject   = 'Quote Approved – Action Required';
    } else if (newStatus === 'advisor_action_required') {
      notifType = 'approval_completed';
      title     = `Action Required – Job #${request.job_card_number}`;
      message   = `A recommendation needs to be added to Job #${request.job_card_number}.`;
      subject   = 'Action Required – Parts Request';
    } else if (newStatus === 'customer_approved') {
      notifType = 'customer_approved';
      title     = `Customer Approved – Job #${request.job_card_number}`;
      message   = `Customer approved the quote for Job #${request.job_card_number}.`;
      subject   = 'Customer Approved Quote';
    } else if (newStatus === 'customer_denied') {
      notifType = 'sent_to_customer';
      title     = `Customer Declined – Job #${request.job_card_number}`;
      message   = `Customer declined the quote for Job #${request.job_card_number}.`;
      subject   = 'Customer Declined Quote';
    }

    // In-app notifications
    const notifications = advisors.map(a => ({
      type:            notifType,
      title,
      message,
      request_id:      requestId,
      job_card_number: request.job_card_number,
      recipient_email: a.email,
      recipient_role:  'service_advisor',
      business_id:     request.business_id,
      is_read:         false,
    }));

    const { error: notifError } = await supabaseAdmin.from('notifications').insert(notifications);
    if (notifError) throw notifError;

    // action_required flag for actionable statuses only
    if (ACTION_STATUSES.includes(newStatus)) {
      const { error: updateError } = await supabaseAdmin
        .from('parts_requests')
        .update({
          action_required:       true,
          action_required_since: new Date().toISOString(),
          action_required_role:  'service_advisor',
        })
        .eq('id', requestId);
      if (updateError) throw updateError;

      // Emails only for action-required statuses
      await Promise.all(advisors.map(a =>
        sendEmail({
          to:      a.email,
          subject,
          body: `Hello ${a.full_name},\n\n${message}\n\nJob Card: ${request.job_card_number}\nCustomer: ${request.customer_name || 'N/A'}\nVehicle: ${request.vehicle_type || 'N/A'}\nTotal (Inc GST): $${request.parts_total_inc_gst?.toFixed(2) || 'N/A'}\n\n${requestUrl}`,
        })
      ));
    }

    return res.json({ success: true, message: `Notified ${advisors.length} service advisor(s)` });

  } catch (err) {
    console.error('notifyServiceAdvisors error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
