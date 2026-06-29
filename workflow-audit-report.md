# Workshop Flow Workflow Audit Report

Generated: 2026-06-24T12:35:22.445Z
Base URL: http://localhost:5173
Marker: TEST-AUDIT-1782304459072

Safety note: Only TEST-AUDIT-marked records created by this run were used. Cleanup was attempted only for captured IDs after marker checks.

## Steps

| Step | Result | Notes | Screenshot |
| --- | --- | --- | --- |
| Technician creates and submits Vehicle Inspection | PASS | Created vehicle_inspections 38d12f59-fde3-49a3-81a4-0f465f73dfe6 | tests\screenshots\workflow-audit\01-technician-creates-and-submits-vehicle-inspection.png |
| Service Advisor can see submitted inspection | PASS | Submitted inspection visible in advisor Vehicle Inspections queue. | tests\screenshots\workflow-audit\02-service-advisor-can-see-submitted-inspection.png |
| Technician creates Parts Request | PASS | Created parts_requests f85d3558-723a-4340-8c5b-8948ba57e467 | tests\screenshots\workflow-audit\03-technician-creates-parts-request.png |
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
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.service_advisor&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.parts%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.f85d3558-723a-4340-8c5b-8948ba57e467&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.f85d3558-723a-4340-8c5b-8948ba57e467&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/vehicle_inspections?select=*&request_id=eq.f85d3558-723a-4340-8c5b-8948ba57e467&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/users?select=*&id=eq.8e8374dd-e807-46d7-97eb-2dddd22ec034 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.wc%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- PATCH https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?id=eq.f85d3558-723a-4340-8c5b-8948ba57e467&select=* net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.19427e98-adea-48e8-b954-18ba2af532f3&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.19427e98-adea-48e8-b954-18ba2af532f3&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/vehicle_inspections?select=*&request_id=eq.19427e98-adea-48e8-b954-18ba2af532f3&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.parts%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.wc%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- PATCH https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?id=eq.19427e98-adea-48e8-b954-18ba2af532f3&select=* net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.service_advisor&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED

## Status Changes Observed

- J22867663: created as sent_to_parts
- J22867663: quoted
- J22867663: advisor_action_required
- J22867663: recommendation_added
- J22867663: customer_approved
- J24703899: created as sent_to_parts
- J24703899: quoted; rules parser source=rules, parts_cost_ex_gst=18.50, line_total_inc_gst=20.35
- J24703899: sent_to_advisor
- J24703899: SMS includes Air Filter and $20.35 without TBC
- J24703899: customer_denied
- J24703899: customer_denied persisted, but denial dialog remained open after notification insert failure

## Records Created

- vehicle_inspections 38d12f59-fde3-49a3-81a4-0f465f73dfe6 (J82372350)
- parts_requests f85d3558-723a-4340-8c5b-8948ba57e467 (J22867663)
- parts_requests 19427e98-adea-48e8-b954-18ba2af532f3 (J24703899)

## Records Cleaned Up

- notifications 73a7e3d7-5495-4251-81b0-66ecfad31b7d: cleaned
- notifications 39728540-4336-412f-90a5-bc26ff37a566: cleaned
- notifications bd06a9c5-60f6-4090-841b-b5af464e43a3: cleaned
- notifications 24882a05-2689-442e-936e-0a79ca587615: cleaned
- notifications cc756105-0fa1-4235-914f-de3fb5abc57d: cleaned
- notifications e766fca5-3d2b-4509-a28a-7f4159c68605: cleaned
- notifications 714848fc-5036-4be8-bc10-c255f8048f5f: cleaned
- notifications 4c23bff1-6a19-4e67-821d-5231ad9fddc3: cleaned
- vehicle_inspections 38d12f59-fde3-49a3-81a4-0f465f73dfe6: cleaned
- parts_requests f85d3558-723a-4340-8c5b-8948ba57e467: cleaned
- parts_requests 19427e98-adea-48e8-b954-18ba2af532f3: cleaned
- storage:workshop-photos quote-pdfs/1782304479638-fdxndhl2dlt.pdf: cleaned
- storage:workshop-photos quote-pdfs/1782304503777-68yfeaex36a.pdf: cleaned

## Recommended First Fix

No handoff failure recorded. Review API abort noise separately if it remains reproducible outside navigation/logout transitions.

## Summary

- Steps passed: 10
- Steps failed: 0
- Steps skipped: 0
- Screenshots captured: 10
