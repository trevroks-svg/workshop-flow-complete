# Workshop Flow Workflow Audit Report

Generated: 2026-06-21T00:55:21.111Z
Base URL: http://localhost:5173
Marker: TEST-AUDIT-1782003256990

Safety note: Only TEST-AUDIT-marked records created by this run were used. Cleanup was attempted only for captured IDs after marker checks.

## Steps

| Step | Result | Notes | Screenshot |
| --- | --- | --- | --- |
| Technician creates and submits Vehicle Inspection | PASS | Created vehicle_inspections 82f11cd1-9897-4884-8120-73058a648e2f | tests\screenshots\workflow-audit\01-technician-creates-and-submits-vehicle-inspection.png |
| Service Advisor can see submitted inspection | PASS | Submitted inspection visible in advisor Vehicle Inspections queue. | tests\screenshots\workflow-audit\02-service-advisor-can-see-submitted-inspection.png |
| Technician creates Parts Request | PASS | Created parts_requests e722dc50-cea9-4862-a6ae-4f5df70eca7e | tests\screenshots\workflow-audit\03-technician-creates-parts-request.png |
| Parts Interpreter can see request | PASS | Request visible in Parts Interpreter queue. | tests\screenshots\workflow-audit\04-parts-interpreter-can-see-request.png |
| Parts Interpreter adds quote details and submits to Workshop Controller | PASS | Quote notes and ETA saved; quote PDF uploaded and text extracted for Advisor/AI processing. | tests\screenshots\workflow-audit\05-parts-interpreter-adds-quote-details-and-submits-to-workshop-controller.png |
| Workshop Controller can see quoted request | PASS | Quoted request visible in Workshop Controller queue. | tests\screenshots\workflow-audit\06-workshop-controller-can-see-quoted-request.png |
| Workshop Controller approves and sends to Service Advisor | PASS | Workshop Controller approved via recommendation path. | tests\screenshots\workflow-audit\07-workshop-controller-approves-and-sends-to-service-advisor.png |
| Service Advisor can see approved recommendation | PASS | Approved recommendation visible and added to recommendations. | tests\screenshots\workflow-audit\08-service-advisor-can-see-approved-recommendation.png |
| Service Advisor marks customer approved | PASS | Customer approval recorded. | tests\screenshots\workflow-audit\09-service-advisor-marks-customer-approved.png |
| Fresh TEST-AUDIT request supports rules-priced SMS and customer decline | PASS | Fresh TEST-AUDIT request generated priced SMS from rules parser and recorded customer denial. | tests\screenshots\workflow-audit\10-fresh-test-audit-request-supports-rules-priced-sms-and-customer-decline.png |

## Console Errors

None recorded.

## API Errors

- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.parts%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/vehicle_inspections?select=*&request_id=eq.e722dc50-cea9-4862-a6ae-4f5df70eca7e&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.e722dc50-cea9-4862-a6ae-4f5df70eca7e&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.parts%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.e722dc50-cea9-4862-a6ae-4f5df70eca7e&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/vehicle_inspections?select=*&request_id=eq.e722dc50-cea9-4862-a6ae-4f5df70eca7e&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.e722dc50-cea9-4862-a6ae-4f5df70eca7e&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.e722dc50-cea9-4862-a6ae-4f5df70eca7e&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.workshop_controller&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- PATCH https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?id=eq.e722dc50-cea9-4862-a6ae-4f5df70eca7e&select=* net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.parts%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.workshop_controller&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.wc%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.wc%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.4aabbc47-4da9-4fde-b859-13401f0fc915&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.4aabbc47-4da9-4fde-b859-13401f0fc915&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.4aabbc47-4da9-4fde-b859-13401f0fc915&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.4aabbc47-4da9-4fde-b859-13401f0fc915&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/vehicle_inspections?select=*&status=eq.submitted&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.advisor%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED

## Status Changes Observed

- J56870167: created as sent_to_parts
- J56870167: quoted
- J56870167: advisor_action_required
- J56870167: recommendation_added
- J56870167: customer_approved
- J28309506: created as sent_to_parts
- J28309506: quoted; rules parser source=rules, parts_cost_ex_gst=18.50, line_total_inc_gst=20.35
- J28309506: sent_to_advisor
- J28309506: SMS includes Air Filter and $20.35 without TBC
- J28309506: customer_denied

## Records Created

- vehicle_inspections 82f11cd1-9897-4884-8120-73058a648e2f (J74521865)
- parts_requests e722dc50-cea9-4862-a6ae-4f5df70eca7e (J56870167)
- parts_requests 4aabbc47-4da9-4fde-b859-13401f0fc915 (J28309506)

## Records Cleaned Up

- notifications e0d683c5-f61c-434f-aaf3-55ff2f4fd65b: cleaned
- notifications 41a07164-82f2-4b21-9360-d3beb105f9af: cleaned
- notifications 0b5a4f29-3476-4639-b45b-50f370692315: cleaned
- notifications 98937c3c-d8ce-49a3-80d7-a1f43ac345a2: cleaned
- notifications 174af196-d867-435e-884b-1740cc0e7ec1: cleaned
- notifications b5862411-16a3-415e-92f5-7680f59b8e9a: cleaned
- notifications f0e1759f-e25d-4dbc-8377-10fd824558d4: cleaned
- notifications 01fee05f-598a-443a-9458-c9f7e1cb4156: cleaned
- vehicle_inspections 82f11cd1-9897-4884-8120-73058a648e2f: cleaned
- parts_requests e722dc50-cea9-4862-a6ae-4f5df70eca7e: cleaned
- parts_requests 4aabbc47-4da9-4fde-b859-13401f0fc915: cleaned
- storage:workshop-photos quote-pdfs/1782003279180-md63yz1yx6.pdf: cleaned
- storage:workshop-photos quote-pdfs/1782003302212-vd4oj3tauo7.pdf: cleaned

## Recommended First Fix

No handoff failure recorded. Review API abort noise separately if it remains reproducible outside navigation/logout transitions.

## Summary

- Steps passed: 10
- Steps failed: 0
- Steps skipped: 0
- Screenshots captured: 10
