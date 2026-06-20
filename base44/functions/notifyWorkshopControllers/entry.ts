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

        // Trigger when status changes to 'quoted' OR 'awaiting_workshop_approval'
        const triggerStatuses = ['quoted', 'awaiting_workshop_approval'];
        if (!triggerStatuses.includes(newStatus) || oldStatus === newStatus) {
            return Response.json({ success: true, message: 'Status change does not require WC notification' });
        }

        const requestId = payload.event.entity_id;
        const request = payload.data;

        if (!request) {
            return Response.json({ success: false, error: 'Request data not found' });
        }

        const allUsers = await base44.asServiceRole.entities.User.list();
        const workshopControllers = allUsers.filter(u => u.staff_role === 'workshop_controller');

        if (!workshopControllers || workshopControllers.length === 0) {
            return Response.json({ success: true, message: 'No workshop controllers found' });
        }

        const appUrl = new URL(req.url).origin;
        const requestUrl = `${appUrl}/#/RequestDetail?id=${requestId}`;

        const isQuoted = newStatus === 'quoted';
        const title = isQuoted
            ? `Quote Ready for Review – Job #${request.job_card_number}`
            : `Awaiting Your Approval – Job #${request.job_card_number}`;
        const message = isQuoted
            ? `Parts Interpreter has uploaded a quote. Please review and approve.`
            : `A quote is awaiting your approval for Job #${request.job_card_number}.`;
        const emailSubject = isQuoted
            ? 'Quote Ready for Review – Action Required'
            : 'Quote Awaiting Your Approval – Action Required';

        // Create in-app notification for each workshop controller
        const notifPromises = workshopControllers.map(controller =>
            base44.asServiceRole.entities.Notification.create({
                type: 'approval_required',
                title,
                message,
                request_id: requestId,
                job_card_number: request.job_card_number,
                recipient_email: controller.email,
                recipient_role: 'workshop_controller',
                is_read: false
            })
        );

        // Send emails
        const emailPromises = workshopControllers.map(controller =>
            base44.asServiceRole.integrations.Core.SendEmail({
                to: controller.email,
                subject: emailSubject,
                body: `Hello ${controller.full_name},\n\n${message}\n\nJob Card Number: ${request.job_card_number}\nCustomer: ${request.customer_name || 'N/A'}\nVehicle: ${request.vehicle_type || 'N/A'}\nQuote Total (Inc GST): $${request.parts_total_inc_gst?.toFixed(2) || 'N/A'}\n\nView the request here:\n${requestUrl}\n\nThank you.`
            })
        );

        // Set action_required flag
        await base44.asServiceRole.entities.PartsRequest.update(requestId, {
            action_required: true,
            action_required_since: new Date().toISOString(),
            action_required_role: 'workshop_controller'
        });

        await Promise.all([...notifPromises, ...emailPromises]);

        return Response.json({
            success: true,
            message: `Notified ${workshopControllers.length} workshop controller(s)`,
            recipients: workshopControllers.map(c => c.email)
        });

    } catch (error) {
        console.error('Error in notifyWorkshopControllers:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});