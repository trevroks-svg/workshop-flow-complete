/**
 * POST /api/check-overdue-requests
 *
 * Scans all active PartsRequests and creates overdue notifications
 * for requests that have sat in a status longer than the threshold.
 *
 * Call this on a schedule — e.g. every hour via:
 *   - A cron job:  0 * * * * curl -X POST http://localhost:3001/api/check-overdue-requests
 *   - Vercel Cron Jobs (vercel.json)
 *   - Railway / Render scheduled jobs
 *   - GitHub Actions on a schedule
 *
 * Protect this endpoint with a secret header in production:
 *   req.headers['x-cron-secret'] === process.env.CRON_SECRET
 */

import { supabaseAdmin } from '../supabaseAdmin.js';

// Hours before a request is considered overdue at each status
const OVERDUE_THRESHOLDS = {
  sent_to_parts:              4,
  quoted:                     8,
  awaiting_workshop_approval: 4,
  sent_to_advisor:            2,
  sent_to_customer:           24,
};

const ROLE_FOR_STATUS = {
  sent_to_parts:              'parts_interpreter',
  quoted:                     'workshop_controller',
  awaiting_workshop_approval: 'workshop_controller',
  sent_to_advisor:            'service_advisor',
  sent_to_customer:           'service_advisor',
};

export default async function checkOverdueRequests(req, res) {
  try {
    // Optional: protect with a secret
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers['x-cron-secret'] !== cronSecret) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data: allRequests, error } = await supabaseAdmin
      .from('parts_requests')
      .select('*')
      .eq('is_archived', false)
      .eq('wc_completed', false)
      .limit(500);

    if (error) throw error;

    const now = new Date();
    let overdueCount = 0;
    const toInsert = [];

    for (const request of allRequests) {
      const threshold = OVERDUE_THRESHOLDS[request.status];
      if (!threshold) continue;

      const lastChange   = new Date(request.updated_at || request.created_at);
      const hoursElapsed = (now - lastChange) / (1000 * 60 * 60);
      if (hoursElapsed < threshold) continue;

      const targetRole = ROLE_FOR_STATUS[request.status];
      if (!targetRole) continue;

      // Avoid duplicate notifications: skip if one was sent in the last 4 hours
      const { data: recent } = await supabaseAdmin
        .from('notifications')
        .select('id, created_at')
        .eq('request_id', request.id)
        .eq('recipient_role', targetRole)
        .eq('type', 'overdue')
        .gte('created_at', new Date(now - 4 * 60 * 60 * 1000).toISOString());

      if (recent?.length) continue;

      const hoursText = Math.round(hoursElapsed);
      toInsert.push({
        type:            'overdue',
        title:           `Overdue: Job #${request.job_card_number} (${hoursText}h)`,
        message:         `This request has been waiting ${hoursText} hours in "${request.status.replace(/_/g, ' ')}" status.`,
        request_id:      request.id,
        job_card_number: request.job_card_number,
        recipient_role:  targetRole,
        business_id:     request.business_id,
        is_read:         false,
      });
      overdueCount++;
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin.from('notifications').insert(toInsert);
      if (insertError) throw insertError;
    }

    return res.json({
      success:       true,
      overdue_found: overdueCount,
      message:       `Created ${overdueCount} overdue notification(s)`,
    });

  } catch (err) {
    console.error('checkOverdueRequests error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
