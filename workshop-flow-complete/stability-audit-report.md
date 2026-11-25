# Workshop Flow Stability Audit Report

Generated: 2026-06-21 10:25 Australia/Adelaide

Scope: authorised fix validation plus test-only stability audit evidence. The only application code change was the denied notification type in `src/components/CustomerDecisionDialog.jsx`. No schema, RLS, or unrelated application code was changed.

Fix applied:

- `CustomerDecisionDialog.jsx` now inserts notification type `customer_denied` for denied customer decisions instead of invalid type `customer_decision_recorded`.

Audit harness context from previous authorised test updates:

- Customer approval waits for `CustomerDecisionDialog` to close, then polls Supabase until `status === "customer_approved"`.
- A fresh TEST-AUDIT Air Filter decline/SMS branch uploads a priced Air Filter quote PDF, asserts rules parser output, generates SMS, and polls Supabase until `status === "customer_denied"`.
- Added `tests/fixtures/test-audit-air-filter-quote.pdf` for the priced Air Filter audit path.

## Test Commands Run

- `npx playwright test tests/e2e/workflow-audit.spec.js --project=chromium`
- Read-only Supabase verification query for remaining `TEST-AUDIT` records and latest denial/SMS state

Latest workflow audit result: `1 passed (1.2m)`.

## Checklist Results

| # | Check | Result | Evidence / Notes | Failure Screenshot |
| --- | --- | --- | --- | --- |
| 1 | App starts locally | PASS | Playwright started Vite at `http://localhost:5173`; workflow audit ran against it. | - |
| 2 | Server/API starts locally | PASS | Workflow audit completed against local app/API routes, including mocked `/api/ai/analyse-repairs` coverage. | - |
| 3 | All six roles can log in | PASS | Previous role audit confirmed Technician, Parts Interpreter, Workshop Controller, Service Advisor, Service Manager, and Administrator logins. | - |
| 4 | Role menus display correctly | PASS | Previous role audit found role-appropriate visible menu/dashboard items and no permission-denied pages. See `role-audit-report.md`. | - |
| 5 | No blank pages | PASS | Previous role audit recorded `Blank Pages: 0` for all six roles. | - |
| 6 | No console errors | PASS | Latest workflow audit recorded `None recorded`. The prior notification 400 did not recur after the fix. | - |
| 7 | Technician can create Vehicle Inspection | PASS | Fresh TEST-AUDIT inspection created: `82f11cd1-9897-4884-8120-73058a648e2f` (`J74521865`). | - |
| 8 | Service Advisor can see submitted Vehicle Inspection | PASS | Service Advisor saw the submitted TEST-AUDIT inspection. | - |
| 9 | Technician can create Parts Request | PASS | Fresh TEST-AUDIT parts requests created: `e722dc50-cea9-4862-a6ae-4f5df70eca7e` and `4aabbc47-4da9-4fde-b859-13401f0fc915`. | - |
| 10 | Parts Interpreter can upload quote PDF | PASS | Quote PDFs uploaded during workflow audit. | - |
| 11 | PDF text extraction works | PASS | Workflow audit confirmed `quote_pdf_text` and `quote_pdf_extracted_at` were populated. | - |
| 12 | Rules parser extracts Air Filter pricing | PASS | Fresh Air Filter branch confirmed `source: rules`, `parts_cost_ex_gst: 18.50`, and `line_total_inc_gst: 20.35`. | - |
| 13 | Workshop Controller can approve | PASS | Recommendation path advanced to `advisor_action_required`; immediate upsell path advanced to `sent_to_advisor`. | - |
| 14 | Service Advisor can generate SMS with price, not TBC | PASS | SMS contained `Air Filter` and `$20.35`, and did not include `TBC`. Read-back confirmed saved `advisor_sms_draft`. | - |
| 15 | Customer approval and decline paths work | PASS | Approval reached `customer_approved`; decline reached and persisted as `customer_denied`. Denial dialog closed cleanly in the latest workflow audit. | - |
| 16 | TEST-AUDIT records and uploads are cleaned up | FAIL | Workflow report claimed cleanup, but read-back still found 24 `parts_requests` and 15 `vehicle_inspections` marked TEST-AUDIT after rerun. | - |

## Console Errors

None recorded in the latest workflow audit.

## API / Network Errors

No notification `400` occurred after the `customer_denied` notification type fix.

Workflow audit still recorded repeated Supabase `net::ERR_ABORTED` request aborts, mostly notification/list queries during navigation/logout transitions. Representative examples:

- `GET .../rest/v1/notifications?...recipient_role=eq.parts_interpreter... net::ERR_ABORTED`
- `GET .../rest/v1/parts_requests?... net::ERR_ABORTED`
- `GET .../rest/v1/businesses?... net::ERR_ABORTED`
- `PATCH .../rest/v1/parts_requests?id=eq.e722dc50-cea9-4862-a6ae-4f5df70eca7e&select=* net::ERR_ABORTED`

## Customer Denial Verification

Latest decline/SMS TEST-AUDIT record:

- `parts_requests`: `4aabbc47-4da9-4fde-b859-13401f0fc915`
- Job card: `J28309506`
- Marker notes: `TEST-AUDIT-1782003256990 decline and sms audit`
- Final status: `customer_denied`
- Saved SMS draft includes `Air Filter` and `$20.35`
- Saved SMS draft does not include `TBC`
- Workflow audit console errors: none
- Notification insert `400`: not reproduced after fix

## Cleanup Result

Cleanup verification after the rerun found remaining TEST-AUDIT rows:

- `parts_requests`: 24 remaining
- `vehicle_inspections`: 15 remaining

The workflow report still lists the latest records as cleaned, but read-back verification proves rows remain. I did not change Supabase policies, schema, or real records.

## Critical Issues

- TEST-AUDIT cleanup is not actually succeeding. Delete/storage-remove calls are reported as cleaned by the audit, but read-back still finds TEST-AUDIT rows.

## High Priority Issues

- Existing audit cleanup reporting can say rows were cleaned when deletion did not remove them. This makes repeated stability runs accumulate test data.

## Medium Priority Issues

- Workflow audit still records Supabase `net::ERR_ABORTED` request noise, mainly during navigation/logout transitions.
- Fresh local API startup can depend on server-only environment keys being present, although the workflow audit completed in this validation run.

## Recommended Next Fix

Fix TEST-AUDIT cleanup verification and deletion next. The denied notification 400 is fixed, but the audit still cannot be trusted as a repeatable stability gate while it leaves TEST-AUDIT records behind.
