# Workshop Flow Workflow Audit Report

Generated: 2026-11-25T10:47:31.620Z
Base URL: http://localhost:5173
Marker: TEST-AUDIT-1795603571230

Safety note: Only TEST-AUDIT-marked records created by this run were used. Cleanup was attempted only for captured IDs after marker checks.

## Steps

| Step | Result | Notes | Screenshot |
| --- | --- | --- | --- |
| Technician creates and submits Vehicle Inspection | PASS | Created vehicle_inspections c8b68538-52bb-40fb-ab02-f8b6a08247f9 | tests\screenshots\workflow-audit\01-technician-creates-and-submits-vehicle-inspection.png |
| Service Advisor can see submitted inspection | PASS | Submitted inspection visible in advisor Vehicle Inspections queue. | tests\screenshots\workflow-audit\02-service-advisor-can-see-submitted-inspection.png |
| Technician creates Parts Request | PASS | Created parts_requests fbf67e0f-4c02-4a2e-a996-c35911329c06 | tests\screenshots\workflow-audit\03-technician-creates-parts-request.png |
| Parts Interpreter can see request | PASS | Request visible in Parts Interpreter queue. | tests\screenshots\workflow-audit\04-parts-interpreter-can-see-request.png |
| Parts Interpreter adds quote details and submits to Workshop Controller | PASS | Quote notes and ETA saved; quote PDF uploaded and text extracted for Advisor/AI processing. | tests\screenshots\workflow-audit\05-parts-interpreter-adds-quote-details-and-submits-to-workshop-controller.png |
| Workshop Controller can see quoted request | PASS | Quoted request visible in Workshop Controller queue. | tests\screenshots\workflow-audit\06-workshop-controller-can-see-quoted-request.png |
| Workshop Controller approves and sends to Service Advisor | PASS | Workshop Controller approved via recommendation path. | tests\screenshots\workflow-audit\07-workshop-controller-approves-and-sends-to-service-advisor.png |
| Service Advisor can see approved recommendation | PASS | Approved recommendation visible and added to recommendations. | tests\screenshots\workflow-audit\08-service-advisor-can-see-approved-recommendation.png |
| Service Advisor marks customer approved | PASS | Customer approval recorded. | tests\screenshots\workflow-audit\09-service-advisor-marks-customer-approved.png |
| Fresh TEST-AUDIT request supports rules-priced SMS and customer decline | FAIL | expect(locator).toHaveValue(expected) failed<br><br>Locator: getByPlaceholder(/click 'generate sms draft'/i)<br>Timeout: 30000ms<br>Expected pattern: /Air Filter/<br>Received string:  "Hi there,<br>We recommend the following work:<br>Air filter: $20.35 inc GST<br>Total: $20.35 inc GST<br>Please reply YES to approve or NO to decline. Fleurieu Motor Group Service 08 8552 1255"<br><br>Call log:<br>  - Expect "toHaveValue" with timeout 30000ms<br>  - waiting for getByPlaceholder(/click 'generate sms draft'/i)<br>    62 × locator resolved to <textarea placeholder="Click 'Generate SMS Draft' to create a message, or type your own..." class="flex w-full rounded-md border border-input bg-transparent px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm min-h-[140px] font-mono text-sm">Hi there,↵We recommend the following work:↵Air fi…</textarea><br>       - unexpected value "Hi there,<br>We recommend the following work:<br>Air filter: $20.35 inc GST<br>Total: $20.35 inc GST<br>Please reply YES to approve or NO to decline. Fleurieu Motor Group Service 08 8552 1255"<br> | tests\screenshots\workflow-audit\10-fresh-test-audit-request-supports-rules-priced-sms-and-customer-decline-error.png |

## Console Errors

- Failed to load resource: the server responded with a status of 502 (Bad Gateway)
- Failed to load resource: the server responded with a status of 502 (Bad Gateway)
- SMS generation failed: Error: AI SMS generation failed (502)
    at generateSms (http://localhost:5173/src/components/sms/SMSDraftGenerator.jsx:277:31)
    at async handleGenerate (http://localhost:5173/src/components/sms/SMSDraftGenerator.jsx:318:4)

## API Errors

- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.technician&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.technician&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/vehicle_inspections?select=*&request_id=eq.fbf67e0f-4c02-4a2e-a996-c35911329c06&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.parts%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/vehicle_inspections?select=*&request_id=eq.fbf67e0f-4c02-4a2e-a996-c35911329c06&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.parts%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.fbf67e0f-4c02-4a2e-a996-c35911329c06&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.fbf67e0f-4c02-4a2e-a996-c35911329c06&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.fbf67e0f-4c02-4a2e-a996-c35911329c06&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.fbf67e0f-4c02-4a2e-a996-c35911329c06&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.workshop_controller&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- PATCH https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?id=eq.fbf67e0f-4c02-4a2e-a996-c35911329c06&select=* net::ERR_ABORTED
- 502 GET http://localhost:5173/api/job-schedule/match?jobCard=J47435756
- 502 POST http://localhost:5173/api/ai/generate-advisor-sms
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.workshop_controller&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- PATCH https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?id=eq.c8531284-5e8c-4fda-8fb9-c59073d4ee92&select=* net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.service_advisor&order=created_at.desc&limit=30 net::ERR_ABORTED
- POST http://localhost:5173/api/ai/generate-advisor-sms net::ERR_ABORTED

## Status Changes Observed

- J94801678: created as sent_to_parts
- J94801678: quoted
- J94801678: advisor_action_required
- J94801678: recommendation_added
- J94801678: customer_approved
- J47435756: created as sent_to_parts
- J47435756: quoted; rules parser source=rules, parts_cost_ex_gst=18.50, line_total_inc_gst=20.35
- J47435756: sent_to_advisor

## Records Created

- vehicle_inspections c8b68538-52bb-40fb-ab02-f8b6a08247f9 (J96869542)
- parts_requests fbf67e0f-4c02-4a2e-a996-c35911329c06 (J94801678)
- parts_requests c8531284-5e8c-4fda-8fb9-c59073d4ee92 (J47435756)

## Records Cleaned Up

- notifications a46790b9-2289-4c79-a4db-3084bbe7b608: cleaned
- notifications e5855376-e931-49e2-92af-6d77a8adfde2: cleaned
- notifications a9be2561-33a5-4802-9cd7-caba2ab82d14: cleaned
- notifications 1f8d3542-4b09-4fa3-b8b5-0684a6c137b5: cleaned
- notifications 8b7f795d-b93c-4e87-870d-d030d56df755: cleaned
- notifications 90f5ab14-1b25-455e-bb84-33846851fa98: cleaned
- notifications e668c988-5a21-4a8a-a58c-129364c05201: cleaned
- vehicle_inspections c8b68538-52bb-40fb-ab02-f8b6a08247f9: cleaned
- parts_requests fbf67e0f-4c02-4a2e-a996-c35911329c06: cleaned
- parts_requests c8531284-5e8c-4fda-8fb9-c59073d4ee92: cleaned
- storage:workshop-photos quote-pdfs/1795603585928-8ftq8opz0dv.pdf: cleaned
- storage:workshop-photos quote-pdfs/1795603607833-qq0fwaxpmsm.pdf: cleaned

## Recommended First Fix

expect(locator).toHaveValue(expected) failed

Locator: getByPlaceholder(/click 'generate sms draft'/i)
Timeout: 30000ms
Expected pattern: /Air Filter/
Received string:  "Hi there,
We recommend the following work:
Air filter: $20.35 inc GST
Total: $20.35 inc GST
Please reply YES to approve or NO to decline. Fleurieu Motor Group Service 08 8552 1255"

Call log:
  - Expect "toHaveValue" with timeout 30000ms
  - waiting for getByPlaceholder(/click 'generate sms draft'/i)
    62 × locator resolved to <textarea placeholder="Click 'Generate SMS Draft' to create a message, or type your own..." class="flex w-full rounded-md border border-input bg-transparent px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm min-h-[140px] font-mono text-sm">Hi there,↵We recommend the following work:↵Air fi…</textarea>
       - unexpected value "Hi there,
We recommend the following work:
Air filter: $20.35 inc GST
Total: $20.35 inc GST
Please reply YES to approve or NO to decline. Fleurieu Motor Group Service 08 8552 1255"


## Summary

- Steps passed: 9
- Steps failed: 1
- Steps skipped: 0
- Screenshots captured: 10
