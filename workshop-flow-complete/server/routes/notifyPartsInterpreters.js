/**
 * POST /api/notify-parts-interpreters
 *
 * Called when a new PartsRequest is created.
 * Notifies all users with staff_role = 'parts_interpreter' in the same business.
 *
 * Body: { request_id, request_data }
 *   request_data: the newly created PartsRequest row
 */

import { supabaseAdmin } from '../supabaseAdmin.js';
import { sendEmail } from '../email.js';

export default async function notifyPartsInterpreters(req, res) {
  try {
    const { request_id: requestId, request_data: request } = req.body;

    if (!requestId || !request) {
      return res.status(400).json({ error: 'request_id and request_data are required' });
    }

    // Find all parts interpreters in the same business
    const { data: interpreters, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .eq('staff_role', 'parts_interpreter')
      .eq('business_id', request.business_id);

    if (error) throw error;

    if (!interpreters?.length) {
      return res.json({ success: true, message: 'No parts interpreters found' });
    }

    const appUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const requestUrl = `${appUrl}/RequestDetail?id=${requestId}`;

    const title   = `New Parts Request – Job #${request.job_card_number}`;
    const message = `${request.technician_name || 'A technician'} submitted a new request requiring your quote.`;

    // Create in-app notifications
    const notifications = interpreters.map(i => ({
      type:            'new_request',
      title,
      message,
      request_id:      requestId,
      job_card_number: request.job_card_number,
      recipient_email: i.email,
      recipient_role:  'parts_interpreter',
      business_id:     request.business_id,
      is_read:         false,
    }));

    const { error: notifError } = await supabaseAdmin
      .from('notifications')
      .insert(notifications);
    if (notifError) throw notifError;

    // Set action_required flag
    const { error: updateError } = await supabaseAdmin
      .from('parts_requests')
      .update({
        action_required:       true,
        action_required_since: new Date().toISOString(),
        action_required_role:  'parts_interpreter',
      })
      .eq('id', requestId);
    if (updateError) throw updateError;

    // Send emails
    const partsList = (request.parts || []).map(p => p.part_type).join(', ') || 'N/A';
    await Promise.all(interpreters.map(i =>
      sendEmail({
        to:      i.email,
        subject: title,
        body: `Hello ${i.full_name},\n\nA new parts request has been submitted and requires your quote.\n\nJob Card Number: ${request.job_card_number}\nSubmitted by: ${request.technician_name || 'N/A'}\nParts: ${partsList}\n\nView the request:\n${requestUrl}\n\nThank you.`,
      })
    ));

    return res.json({
      success:    true,
      message:    `Notified ${interpreters.length} parts interpreter(s)`,
      recipients: interpreters.map(i => i.email),
    });

  } catch (err) {
    console.error('notifyPartsInterpreters error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
