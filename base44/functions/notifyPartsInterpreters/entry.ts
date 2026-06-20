import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        if (payload.event.type !== 'create') {
            return Response.json({ success: true, message: 'Not a create event' });
        }

        const requestId = payload.event.entity_id;
        const request = payload.data;

        if (!request) {
            return Response.json({ success: false, error: 'Request data not found' });
        }

        const allUsers = await base44.asServiceRole.entities.User.list();
        const partsInterpreters = allUsers.filter(u => u.staff_role === 'parts_interpreter');

        if (!partsInterpreters || partsInterpreters.length === 0) {
            return Response.json({ success: true, message: 'No parts interpreters found' });
        }

        const appUrl = new URL(req.url).origin;
        const requestUrl = `${appUrl}/#/RequestDetail?id=${requestId}`;

        const title = `New Parts Request – Job #${request.job_card_number}`;
        const message = `${request.technician_name || 'A technician'} submitted a new request requiring your quote.`;

        // Create in-app notification for each parts interpreter
        const notifPromises = partsInterpreters.map(interpreter =>
            base44.asServiceRole.entities.Notification.create({
                type: 'new_request',
                title,
                message,
                request_id: requestId,
                job_card_number: request.job_card_number,
                recipient_email: interpreter.email,
                recipient_role: 'parts_interpreter',
                is_read: false
            })
        );

        // Send emails
        const emailPromises = partsInterpreters.map(interpreter =>
            base44.asServiceRole.integrations.Core.SendEmail({
                to: interpreter.email,
                subject: title,
                body: `Hello ${interpreter.full_name},\n\nA new parts request has been submitted and requires your quote.\n\nJob Card Number: ${request.job_card_number}\nSubmitted by: ${request.technician_name || request.created_by}\nParts: ${(request.parts || []).map(p => p.part_type).join(', ') || 'N/A'}\n\nView the request here:\n${requestUrl}\n\nThank you.`
            })
        );

        // Set action_required flag on the request
        await base44.asServiceRole.entities.PartsRequest.update(requestId, {
            action_required: true,
            action_required_since: new Date().toISOString(),
            action_required_role: 'parts_interpreter'
        });

        await Promise.all([...notifPromises, ...emailPromises]);

        return Response.json({
            success: true,
            message: `Notified ${partsInterpreters.length} parts interpreter(s)`,
            recipients: partsInterpreters.map(p => p.email)
        });

    } catch (error) {
        console.error('Error in notifyPartsInterpreters:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});