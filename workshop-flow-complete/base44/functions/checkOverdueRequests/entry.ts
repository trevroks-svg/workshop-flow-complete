import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Thresholds in hours before a request is considered overdue
const OVERDUE_THRESHOLDS = {
    sent_to_parts: 4,          // Parts interpreter should quote within 4 hours
    quoted: 8,                  // WC should review within 8 hours
    awaiting_workshop_approval: 4, // WC should approve within 4 hours
    sent_to_advisor: 2,         // Advisor should contact customer within 2 hours
    sent_to_customer: 24        // Customer decision expected within 24 hours
};

const ROLE_FOR_STATUS = {
    sent_to_parts: 'parts_interpreter',
    quoted: 'workshop_controller',
    awaiting_workshop_approval: 'workshop_controller',
    sent_to_advisor: 'service_advisor',
    sent_to_customer: 'service_advisor'
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const allRequests = await base44.asServiceRole.entities.PartsRequest.list('-created_date', 200);
        const now = new Date();

        let overdueCount = 0;
        const overdueNotifications = [];

        for (const request of allRequests) {
            if (request.is_archived || request.wc_completed) continue;

            const threshold = OVERDUE_THRESHOLDS[request.status];
            if (!threshold) continue;

            // Use updated_date as the last status change time
            const lastChange = new Date(request.updated_date || request.created_date);
            const hoursElapsed = (now - lastChange) / (1000 * 60 * 60);

            if (hoursElapsed < threshold) continue;

            const targetRole = ROLE_FOR_STATUS[request.status];
            if (!targetRole) continue;

            // Avoid duplicate overdue notifications: check if one was created in the last 4 hours
            const recentNotifs = await base44.asServiceRole.entities.Notification.filter({
                request_id: request.id,
                recipient_role: targetRole,
                type: 'overdue'
            });

            const alreadyNotified = recentNotifs.some(n => {
                const created = new Date(n.created_date);
                return (now - created) < 4 * 60 * 60 * 1000;
            });

            if (alreadyNotified) continue;

            const hoursText = Math.round(hoursElapsed);
            const title = `Overdue: Job #${request.job_card_number} (${hoursText}h)`;
            const message = `This request has been waiting ${hoursText} hours in "${request.status.replace(/_/g, ' ')}" status.`;

            overdueNotifications.push(
                base44.asServiceRole.entities.Notification.create({
                    type: 'overdue',
                    title,
                    message,
                    request_id: request.id,
                    job_card_number: request.job_card_number,
                    recipient_role: targetRole,
                    is_read: false
                })
            );

            overdueCount++;
        }

        if (overdueNotifications.length > 0) {
            await Promise.all(overdueNotifications);
        }

        return Response.json({
            success: true,
            overdue_found: overdueCount,
            message: `Created ${overdueCount} overdue notification(s)`
        });

    } catch (error) {
        console.error('Error in checkOverdueRequests:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});