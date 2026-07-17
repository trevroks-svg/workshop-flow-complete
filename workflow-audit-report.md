# Workshop Flow Workflow Audit Report

Generated: 2026-07-17T02:17:12.654Z
Base URL: http://127.0.0.1:5173
Marker: TEST-AUDIT-1784254563699

Safety note: Only TEST-AUDIT-marked records created by this run were used. Cleanup was attempted only for captured IDs after marker checks.

## Steps

| Step | Result | Notes | Screenshot |
| --- | --- | --- | --- |
| Technician creates and submits Vehicle Inspection | PASS | Created vehicle_inspections 9e471291-c12a-4669-bd2c-06a01e1e5fa9 | tests\screenshots\workflow-audit\01-technician-creates-and-submits-vehicle-inspection.png |
| Service Advisor can see submitted inspection | PASS | Submitted inspection visible in advisor Vehicle Inspections queue. | tests\screenshots\workflow-audit\02-service-advisor-can-see-submitted-inspection.png |
| Technician creates Parts Request | PASS | Created parts_requests 7eb2b51e-8135-407a-bf58-22fbe33db847 | tests\screenshots\workflow-audit\03-technician-creates-parts-request.png |
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
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.technician&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.workshop_controller&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.7eb2b51e-8135-407a-bf58-22fbe33db847&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.wc%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.7eb2b51e-8135-407a-bf58-22fbe33db847&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.7eb2b51e-8135-407a-bf58-22fbe33db847&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.wc%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.7eb2b51e-8135-407a-bf58-22fbe33db847&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.parts%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.parts%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.0a41b11c-9665-4052-97b2-78e859873373&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.0a41b11c-9665-4052-97b2-78e859873373&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.parts%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/vehicle_inspections?select=*&request_id=eq.0a41b11c-9665-4052-97b2-78e859873373&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.0a41b11c-9665-4052-97b2-78e859873373&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.0a41b11c-9665-4052-97b2-78e859873373&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/vehicle_inspections?select=*&request_id=eq.0a41b11c-9665-4052-97b2-78e859873373&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.wc%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- PATCH https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?id=eq.0a41b11c-9665-4052-97b2-78e859873373&select=* net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.advisor%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/vehicle_inspections?select=*&status=eq.reviewed&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/vehicle_inspections?select=*&status=eq.submitted&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED

## Status Changes Observed

- J53221184: created as sent_to_parts
- J53221184: quoted
- J53221184: advisor_action_required
- J53221184: recommendation_added
- J53221184: customer_approved
- J66592020: created as sent_to_parts
- J66592020: quoted; rules parser source=rules, parts_cost_ex_gst=18.50, line_total_inc_gst=20.35
- J66592020: sent_to_advisor
- J66592020: SMS includes Air Filter and $20.35 without TBC
- J66592020: customer_denied
- J66592020: customer_denied persisted, but denial dialog remained open after notification insert failure

## Records Created

- vehicle_inspections 9e471291-c12a-4669-bd2c-06a01e1e5fa9 (J37475574)
- parts_requests 7eb2b51e-8135-407a-bf58-22fbe33db847 (J53221184)
- parts_requests 0a41b11c-9665-4052-97b2-78e859873373 (J66592020)

## Records Cleaned Up

- notifications 9f9adbaa-6d6a-4806-92cd-46e655518f18: cleaned
- notifications 03d13b27-9f33-4d67-aafe-57d88a544aa7: cleaned
- notifications 8e2e8220-14d6-438d-96f7-08100913e05d: cleaned
- notifications 4ebf544b-9950-4f97-9344-4b6e3f3fd46e: cleaned
- notifications 449ffc6c-8815-470c-b405-19d12200f222: cleaned
- notifications cd91ddc4-a3be-40ef-abf2-ea203d603e6d: cleaned
- notifications 9603ee22-f4df-4cf9-a3b8-9c95be7eff7f: cleaned
- notifications 3ed9f7af-506a-4795-b36e-6f39cf66a6c9: cleaned
- vehicle_inspections 9e471291-c12a-4669-bd2c-06a01e1e5fa9: cleaned
- parts_requests 7eb2b51e-8135-407a-bf58-22fbe33db847: cleaned
- parts_requests 0a41b11c-9665-4052-97b2-78e859873373: cleaned
- storage:workshop-photos quote-pdfs/1784254584177-c53jq7ezu8t.pdf: cleaned
- storage:workshop-photos quote-pdfs/1784254613520-21uc8y7wlx8.pdf: cleaned

## Recommended First Fix

No handoff failure recorded. Review API abort noise separately if it remains reproducible outside navigation/logout transitions.

## Summary

- Steps passed: 10
- Steps failed: 0
- Steps skipped: 0
- Screenshots captured: 10
