import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        if (payload.event.type !== 'update') {
            return Response.json({ success: true, message: 'Not an update event' });
        }

        const newStatus = payload.data?.status;
        const oldStatus = payload.old_data?.status;

        // Trigger on these advisor-relevant status transitions
        const triggerStatuses = ['sent_to_advisor', 'advisor_action_required', 'customer_approved', 'customer_denied'];
        if (!triggerStatuses.includes(newStatus) || oldStatus === newStatus) {
            return Response.json({ success: true, message: 'Status change does not require advisor notification' });
        }

        const requestId = payload.event.entity_id;
        const request = payload.data;

        if (!request) {
            return Response.json({ success: false, error: 'Request data not found' });
        }

        const allUsers = await base44.asServiceRole.entities.User.list();
        const serviceAdvisors = allUsers.filter(u => u.staff_role === 'service_advisor');

        if (!serviceAdvisors || serviceAdvisors.length === 0) {
            return Response.json({ success: true, message: 'No service advisors found' });
        }

        const appUrl = new URL(req.url).origin;
        const requestUrl = `${appUrl}/#/RequestDetail?id=${requestId}`;

        let title, message, emailSubject, notifType;

        if (newStatus === 'sent_to_advisor') {
            notifType = 'approval_completed';
            title = `Quote Approved – Action Required – Job #${request.job_card_number}`;
            message = `Workshop Controller approved the quote. Present to customer. Total: $${request.parts_total_inc_gst?.toFixed(2) || 'N/A'}`;
            emailSubject = 'Quote Approved – Action Required';
        } else if (newStatus === 'advisor_action_required') {
            notifType = 'approval_completed';
            title = `Action Required – Job #${request.job_card_number}`;
            message = `A recommendation needs to be added to Job #${request.job_card_number}.`;
            emailSubject = 'Action Required – Parts Request';
        } else if (newStatus === 'customer_approved') {
            notifType = 'customer_approved';
            title = `Customer Approved – Job #${request.job_card_number}`;
            message = `Customer approved the quote for Job #${request.job_card_number}.`;
            emailSubject = 'Customer Approved Quote';
        } else if (newStatus === 'customer_denied') {
            notifType = 'sent_to_customer';
            title = `Customer Declined – Job #${request.job_card_number}`;
            message = `Customer declined the quote for Job #${request.job_card_number}.`;
            emailSubject = 'Customer Declined Quote';
        }

        // Create in-app notification for each service advisor
        const notifPromises = serviceAdvisors.map(advisor =>
            base44.asServiceRole.entities.Notification.create({
                type: notifType,
                title,
                message,
                request_id: requestId,
                job_card_number: request.job_card_number,
                recipient_email: advisor.email,
                recipient_role: 'service_advisor',
                is_read: false
            })
        );

        // Send emails (only for statuses that need action, not just FYI)
        const actionStatuses = ['sent_to_advisor', 'advisor_action_required'];
        const emailPromises = actionStatuses.includes(newStatus)
            ? serviceAdvisors.map(advisor =>
                base44.asServiceRole.integrations.Core.SendEmail({
                    to: advisor.email,
                    subject: emailSubject,
                    body: `Hello ${advisor.full_name},\n\n${message}\n\nJob Card Number: ${request.job_card_number}\nCustomer: ${request.customer_name || 'N/A'}\nVehicle: ${request.vehicle_type || 'N/A'}\nTotal (Inc GST): $${request.parts_total_inc_gst?.toFixed(2) || 'N/A'}\n\nView the request here:\n${requestUrl}\n\nThank you.`
                })
            )
            : [];

        // Set action_required flag for actionable statuses
        if (actionStatuses.includes(newStatus)) {
            await base44.asServiceRole.entities.PartsRequest.update(requestId, {
                action_required: true,
                action_required_since: new Date().toISOString(),
                action_required_role: 'service_advisor'
            });
        }

        await Promise.all([...notifPromises, ...emailPromises]);

        return Response.json({
            success: true,
            message: `Notified ${serviceAdvisors.length} service advisor(s)`,
            recipients: serviceAdvisors.map(a => a.email)
        });

    } catch (error) {
        console.error('Error in notifyServiceAdvisors:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});