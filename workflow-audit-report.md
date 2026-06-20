# Workshop Flow Workflow Audit Report

Generated: 2026-06-18T04:09:55.815Z
Base URL: http://localhost:5173
Marker: TEST-AUDIT-1781755761275

Safety note: Only TEST-AUDIT-marked records created by this run were used. Cleanup was attempted only for captured IDs after marker checks.

## Steps

| Step | Result | Notes | Screenshot |
| --- | --- | --- | --- |
| Technician creates Parts Request | PASS | Created parts_requests 1fddf9da-89aa-43d1-9394-20c15f2cf6bd | tests\screenshots\workflow-audit\01-technician-creates-parts-request.png |
| Parts Interpreter can see request | PASS | Request visible in Parts Interpreter queue. | tests\screenshots\workflow-audit\02-parts-interpreter-can-see-request.png |
| Parts Interpreter adds quote details and submits to Workshop Controller | PASS | Quote notes and ETA saved; quote PDF uploaded and text extracted for Advisor/AI processing. | tests\screenshots\workflow-audit\03-parts-interpreter-adds-quote-details-and-submits-to-workshop-controller.png |
| Workshop Controller can see quoted request | PASS | Quoted request visible in Workshop Controller queue. | tests\screenshots\workflow-audit\04-workshop-controller-can-see-quoted-request.png |
| Workshop Controller approves and sends to Service Advisor | PASS | Workshop Controller approved via recommendation path. | tests\screenshots\workflow-audit\05-workshop-controller-approves-and-sends-to-service-advisor.png |
| Service Advisor can see approved recommendation | PASS | Approved recommendation visible and added to recommendations. | tests\screenshots\workflow-audit\06-service-advisor-can-see-approved-recommendation.png |
| Service Advisor marks customer approved | PASS | Customer approval recorded. | tests\screenshots\workflow-audit\07-service-advisor-marks-customer-approved.png |

## Console Errors

None recorded.

## API Errors

- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.1fddf9da-89aa-43d1-9394-20c15f2cf6bd&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/vehicle_inspections?select=*&request_id=eq.1fddf9da-89aa-43d1-9394-20c15f2cf6bd&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.parts%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.1fddf9da-89aa-43d1-9394-20c15f2cf6bd&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.workshop_controller&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.workshop_controller&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.1fddf9da-89aa-43d1-9394-20c15f2cf6bd&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.1fddf9da-89aa-43d1-9394-20c15f2cf6bd&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/quote_request_photos?select=*&quote_request_id=eq.1fddf9da-89aa-43d1-9394-20c15f2cf6bd&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&id=eq.1fddf9da-89aa-43d1-9394-20c15f2cf6bd&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.wc%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_email=eq.test.wc%40fmgauto.com.au&order=created_at.desc&limit=30 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/businesses?select=*&id=eq.906467f2-e10b-44ef-80b3-d62b909698c7&order=created_at.desc&limit=200 net::ERR_ABORTED
- GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.service_advisor&order=created_at.desc&limit=30 net::ERR_ABORTED

## Status Changes Observed

- TEST-AUDIT-1781755761275-PARTS: created as sent_to_parts
- TEST-AUDIT-1781755761275-PARTS: quoted
- TEST-AUDIT-1781755761275-PARTS: advisor_action_required
- TEST-AUDIT-1781755761275-PARTS: recommendation_added
- TEST-AUDIT-1781755761275-PARTS: customer_approved

## Records Created

- parts_requests 1fddf9da-89aa-43d1-9394-20c15f2cf6bd (TEST-AUDIT-1781755761275-PARTS)

## Records Cleaned Up

- notifications 07676fe7-852d-4fb8-9e33-ea1117337416: cleaned
- notifications 10521a78-cc26-407c-a523-bb5b09cc3745: cleaned
- notifications ce4e466b-3db0-4924-86ba-0f098abf1f46: cleaned
- notifications 4601e049-e996-47d5-a482-3eba91770f19: cleaned
- parts_requests 1fddf9da-89aa-43d1-9394-20c15f2cf6bd: cleaned
- storage:workshop-photos quote-pdfs/1781755779456-nrglx9l2ugs.pdf: cleaned

## Recommended First Fix

No handoff failure recorded. Review API abort noise separately if it remains reproducible outside navigation/logout transitions.

## Summary

- Steps passed: 7
- Steps failed: 0
- Steps skipped: 0
- Screenshots captured: 7
