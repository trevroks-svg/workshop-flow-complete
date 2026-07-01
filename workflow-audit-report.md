# Workshop Flow Workflow Audit Report

Generated: 2026-07-01T11:13:31.587Z
Base URL: http://localhost:5173
Marker: TEST-AUDIT-1782904343270

Safety note: Only TEST-AUDIT-marked records created by this run were used. Cleanup was attempted only for captured IDs after marker checks.

## Steps

| Step | Result | Notes | Screenshot |
| --- | --- | --- | --- |
| Technician creates Parts Request | PASS | Created parts_requests a0b86c62-895d-4b12-9be3-638b382b7c56 | tests\screenshots\workflow-audit\01-technician-creates-parts-request.png |
| Parts Interpreter can see request | PASS | Request visible in Parts Interpreter queue. | tests\screenshots\workflow-audit\02-parts-interpreter-can-see-request.png |
| Parts Interpreter adds quote details and submits to Workshop Controller | PASS | Quote notes and ETA saved; quote PDF uploaded and text extracted for Advisor/AI processing. | tests\screenshots\workflow-audit\03-parts-interpreter-adds-quote-details-and-submits-to-workshop-controller.png |
| Workshop Controller can see quoted request | PASS | Quoted request visible in Workshop Controller queue. | tests\screenshots\workflow-audit\04-workshop-controller-can-see-quoted-request.png |
| Workshop Controller approves and sends to Service Advisor | PASS | Workshop Controller approved via recommendation path. | tests\screenshots\workflow-audit\05-workshop-controller-approves-and-sends-to-service-advisor.png |
| Service Advisor can see approved recommendation | PASS | Approved recommendation visible and added to recommendations. | tests\screenshots\workflow-audit\06-service-advisor-can-see-approved-recommendation.png |
| Service Advisor marks customer approved | PASS | Customer approval recorded. | tests\screenshots\workflow-audit\07-service-advisor-marks-customer-approved.png |
| Fresh TEST-AUDIT request supports rules-priced SMS and customer decline | PASS | Fresh TEST-AUDIT request generated priced SMS from rules parser and recorded customer denial. Dialog remained open after status persisted; notification insert should be reviewed. | tests\screenshots\workflow-audit\08-fresh-test-audit-request-supports-rules-priced-sms-and-customer-decline.png |

## Console Errors

None recorded.

## API Errors

- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/users?select=*&id=eq.d8445c2e-c6b8-4a3c-8e8c-5ceeb32ccaa3 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.parts%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/users?select=*&id=eq.8e8374dd-e807-46d7-97eb-2dddd22ec034 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.wc%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.a0b86c62-895d-4b12-9be3-638b382b7c56&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.a0b86c62-895d-4b12-9be3-638b382b7c56&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.a0b86c62-895d-4b12-9be3-638b382b7c56&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.wc%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.a0b86c62-895d-4b12-9be3-638b382b7c56&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.wc%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.parts%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.a715562c-392c-4519-963a-70f6a9d1edd5&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/vehicle_inspections?select=*&request_id=eq.a715562c-392c-4519-963a-70f6a9d1edd5&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.a715562c-392c-4519-963a-70f6a9d1edd5&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.a715562c-392c-4519-963a-70f6a9d1edd5&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/vehicle_inspections?select=*&request_id=eq.a715562c-392c-4519-963a-70f6a9d1edd5&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.parts%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.a715562c-392c-4519-963a-70f6a9d1edd5&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.parts%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.wc%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- PATCH https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?id=eq.a715562c-392c-4519-963a-70f6a9d1edd5&select=* net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/vehicle_inspections?select=*&status=eq.submitted&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.advisor%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/vehicle_inspections?select=*&status=eq.reviewed&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED

## Status Changes Observed

- TEST-AUDIT-1782904343270-PARTS: created as sent_to_parts
- TEST-AUDIT-1782904343270-PARTS: quoted
- TEST-AUDIT-1782904343270-PARTS: advisor_action_required
- TEST-AUDIT-1782904343270-PARTS: recommendation_added
- TEST-AUDIT-1782904343270-PARTS: customer_approved
- J31782306: created as sent_to_parts
- J31782306: quoted; rules parser source=rules, parts_cost_ex_gst=18.50, line_total_inc_gst=20.35
- J31782306: sent_to_advisor
- J31782306: SMS includes Air Filter and $20.35 without TBC
- J31782306: customer_denied
- J31782306: customer_denied persisted, but denial dialog remained open after notification insert failure

## Records Created

- parts_requests a0b86c62-895d-4b12-9be3-638b382b7c56 (TEST-AUDIT-1782904343270-PARTS)
- parts_requests a715562c-392c-4519-963a-70f6a9d1edd5 (J31782306)

## Records Cleaned Up

- notifications 2ceeb937-617a-4c63-91c9-ed04ea12d914: cleaned
- notifications 9b03437f-9cdb-40ac-8875-e28b33f0208d: cleaned
- notifications 6910da8c-278f-48f8-8693-c3380280bcad: cleaned
- notifications 5c57d742-b391-4e13-83cb-2a772919926f: cleaned
- notifications ac7db22a-e33e-40f9-b747-0989cc7899ff: cleaned
- notifications d5035bf4-838e-44a7-89a9-46af6480b11d: cleaned
- notifications 989cccf8-f581-4edc-bf81-2d384e40f269: cleaned
- notifications 11122862-b95a-408b-91aa-cdab2a100983: cleaned
- parts_requests a0b86c62-895d-4b12-9be3-638b382b7c56: cleaned
- parts_requests a715562c-392c-4519-963a-70f6a9d1edd5: cleaned
- storage:workshop-photos quote-pdfs/1782904361390-t6g34wcv63m.pdf: cleaned
- storage:workshop-photos quote-pdfs/1782904391237-qtbhn3vat2i.pdf: cleaned

## Recommended First Fix

No handoff failure recorded. Review API abort noise separately if it remains reproducible outside navigation/logout transitions.

## Summary

- Steps passed: 8
- Steps failed: 0
- Steps skipped: 0
- Screenshots captured: 8
