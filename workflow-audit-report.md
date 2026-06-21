# Workshop Flow Workflow Audit Report

Generated: 2026-06-21T02:20:27.094Z
Base URL: http://localhost:5173
Marker: TEST-AUDIT-1782008368844

Safety note: Only TEST-AUDIT-marked records created by this run were used. Cleanup was attempted only for captured IDs after marker checks.

## Steps

| Step | Result | Notes | Screenshot |
| --- | --- | --- | --- |
| Technician creates and submits Vehicle Inspection | PASS | Created vehicle_inspections 6c90bcaa-6737-4c45-ab72-31425fdcd690 | tests\screenshots\workflow-audit\01-technician-creates-and-submits-vehicle-inspection.png |
| Service Advisor can see submitted inspection | PASS | Submitted inspection visible in advisor Vehicle Inspections queue. | tests\screenshots\workflow-audit\02-service-advisor-can-see-submitted-inspection.png |
| Technician creates Parts Request | PASS | Created parts_requests aed68287-fdfc-491f-99b9-532369e2b297 | tests\screenshots\workflow-audit\03-technician-creates-parts-request.png |
| Parts Interpreter can see request | PASS | Request visible in Parts Interpreter queue. | tests\screenshots\workflow-audit\04-parts-interpreter-can-see-request.png |
| Parts Interpreter adds quote details and submits to Workshop Controller | PASS | Quote notes and ETA saved; quote PDF uploaded and text extracted for Advisor/AI processing. | tests\screenshots\workflow-audit\05-parts-interpreter-adds-quote-details-and-submits-to-workshop-controller.png |
| Workshop Controller can see quoted request | PASS | Quoted request visible in Workshop Controller queue. | tests\screenshots\workflow-audit\06-workshop-controller-can-see-quoted-request.png |
| Workshop Controller approves and sends to Service Advisor | PASS | Workshop Controller approved via recommendation path. | tests\screenshots\workflow-audit\07-workshop-controller-approves-and-sends-to-service-advisor.png |
| Service Advisor can see approved recommendation | PASS | Approved recommendation visible and added to recommendations. | tests\screenshots\workflow-audit\08-service-advisor-can-see-approved-recommendation.png |
| Service Advisor marks customer approved | PASS | Customer approval recorded. | tests\screenshots\workflow-audit\09-service-advisor-marks-customer-approved.png |
| Fresh TEST-AUDIT request supports rules-priced SMS and customer decline | PASS | Fresh TEST-AUDIT request generated priced SMS from rules parser and recorded customer denial. Dialog remained open after status persisted; notification insert should be reviewed. | tests\screenshots\workflow-audit\10-fresh-test-audit-request-supports-rules-priced-sms-and-customer-decline.png |

## Console Errors

None recorded.

## API Errors

- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.workshop_controller&order=created_at.desc&limit=30 net::ERR_ABORTED
- PATCH https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?id=eq.aed68287-fdfc-491f-99b9-532369e2b297&select=* net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.939ae872-a939-40e4-9e52-f0e07d9f510c&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.939ae872-a939-40e4-9e52-f0e07d9f510c&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/vehicle_inspections?select=*&request_id=eq.939ae872-a939-40e4-9e52-f0e07d9f510c&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.wc%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- PATCH https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?id=eq.939ae872-a939-40e4-9e52-f0e07d9f510c&select=* net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.service_advisor&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED

## Status Changes Observed

- J13126150: created as sent_to_parts
- J13126150: quoted
- J13126150: advisor_action_required
- J13126150: recommendation_added
- J13126150: customer_approved
- J62841602: created as sent_to_parts
- J62841602: quoted; rules parser source=rules, parts_cost_ex_gst=18.50, line_total_inc_gst=20.35
- J62841602: sent_to_advisor
- J62841602: SMS includes Air Filter and $20.35 without TBC
- J62841602: customer_denied
- J62841602: customer_denied persisted, but denial dialog remained open after notification insert failure

## Records Created

- vehicle_inspections 6c90bcaa-6737-4c45-ab72-31425fdcd690 (J80724033)
- parts_requests aed68287-fdfc-491f-99b9-532369e2b297 (J13126150)
- parts_requests 939ae872-a939-40e4-9e52-f0e07d9f510c (J62841602)

## Records Cleaned Up

- notifications d475016d-a1f6-46d6-8b34-8795460a5385: cleaned
- notifications 534a9fff-2b6f-488f-8ac0-ca9d112a7095: cleaned
- notifications 832d3bed-c088-4be8-be0d-8c3b9ec5705f: cleaned
- notifications 4e66738f-4a6f-43e4-b850-7aa2d9547b49: cleaned
- notifications 75a7c19e-6698-4f6c-91d4-6e584cad0813: cleaned
- notifications 60c6906b-1a2e-4641-9641-d8427aaaa191: cleaned
- notifications f32d2a8e-55d6-42f2-a5c6-510fdb1b2c54: cleaned
- notifications 954b4695-2c11-4a7a-b10d-49a7cdf5adeb: cleaned
- vehicle_inspections 6c90bcaa-6737-4c45-ab72-31425fdcd690: cleaned
- parts_requests aed68287-fdfc-491f-99b9-532369e2b297: cleaned
- parts_requests 939ae872-a939-40e4-9e52-f0e07d9f510c: cleaned
- storage:workshop-photos quote-pdfs/1782008385537-w8irfqtqsbb.pdf: cleaned
- storage:workshop-photos quote-pdfs/1782008408838-ibjarmllpw.pdf: cleaned

## Recommended First Fix

No handoff failure recorded. Review API abort noise separately if it remains reproducible outside navigation/logout transitions.

## Summary

- Steps passed: 10
- Steps failed: 0
- Steps skipped: 0
- Screenshots captured: 10
