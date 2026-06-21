# Workshop Flow Role Audit Report

Generated: 2026-06-21T02:19:17.972Z
Base URL: http://localhost:5173

Mutation note: Workflow actions that create, save, submit, approve, decline, upload, or otherwise change records were not executed because `.env` points to a hosted Supabase project and the audit instructions prohibit updating production data.

## Technician

- Login Success/Fail: Success
- Visible Menu Items: Job History Search, Sign Out
- Visible Dashboard Widgets: Parts Requests, Submitted Vehicle Inspections (15), All, Sent to Parts, Approved, New Inspection, New Request, View
- Pages Tested: Dashboard, Job History Search, Vehicle Inspection, Parts Request Form
- Pages Passed: Dashboard, Job History Search, Vehicle Inspection, Parts Request Form
- Pages Failed: None
- Console Errors: 0
- Network Errors: 0
- API Errors: 0
- Permission Errors: 0
- Blank Pages: 0
- Screenshots Captured: 5

| Page | URL | Result | Findings | Screenshot |
| --- | --- | --- | --- | --- |
| Dashboard | /Dashboard | Pass | - | tests\screenshots\technician\dashboard.png |
| Job History Search | /SearchHistory | Pass | - | tests\screenshots\technician\job-history-search.png |
| Vehicle Inspection | /VehicleInspection | Pass | - | tests\screenshots\technician\vehicle-inspection.png |
| Parts Request Form | /PartsRequestForm | Pass | - | tests\screenshots\technician\parts-request-form.png |

| Workflow Check | Result | Notes |
| --- | --- | --- |
| Create Vehicle Inspection | Skipped | Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data. |
| Save Draft Inspection | Skipped | Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data. |
| Submit Inspection | Skipped | Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data. |
| Create Parts Request | Skipped | Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data. |
| Upload Photos | Skipped | Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data. |
| Generate Recommendation | Skipped | Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data. |
| View Submitted Requests | Covered by page/menu audit where data was available | Read/navigation coverage only; no record mutation performed. |

## Parts Interpreter

- Login Success/Fail: Success
- Visible Menu Items: Job History Search, Sign Out
- Visible Dashboard Widgets: Parts Requests, All, Sent to Parts, Quote History
- Pages Tested: Dashboard, Job History Search
- Pages Passed: Job History Search
- Pages Failed: Dashboard (Network errors: 2)
- Console Errors: 0
- Network Errors: 2
- API Errors: 0
- Permission Errors: 0
- Blank Pages: 0
- Screenshots Captured: 3

| Page | URL | Result | Findings | Screenshot |
| --- | --- | --- | --- | --- |
| Dashboard | /Dashboard | Fail | Network errors: 2 | tests\screenshots\parts-interpreter\dashboard.png |
| Job History Search | /SearchHistory | Pass | - | tests\screenshots\parts-interpreter\job-history-search.png |

| Workflow Check | Result | Notes |
| --- | --- | --- |
| View New Parts Requests | Covered by page/menu audit where data was available | Read/navigation coverage only; no record mutation performed. |
| Open Request Details | Covered by page/menu audit where data was available | Read/navigation coverage only; no record mutation performed. |
| Add Quote Information | Skipped | Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data. |
| Add ETA Information | Skipped | Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data. |
| Save Quote | Skipped | Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data. |
| Submit To Workshop Controller | Skipped | Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data. |

## Workshop Controller

- Login Success/Fail: Success
- Visible Menu Items: Job History Search, Sign Out
- Visible Dashboard Widgets: Parts Requests, All, Needs Review, Decisions, History
- Pages Tested: Dashboard, Job History Search
- Pages Passed: Job History Search
- Pages Failed: Dashboard (Network errors: 2)
- Console Errors: 0
- Network Errors: 2
- API Errors: 0
- Permission Errors: 0
- Blank Pages: 0
- Screenshots Captured: 3

| Page | URL | Result | Findings | Screenshot |
| --- | --- | --- | --- | --- |
| Dashboard | /Dashboard | Fail | Network errors: 2 | tests\screenshots\workshop-controller\dashboard.png |
| Job History Search | /SearchHistory | Pass | - | tests\screenshots\workshop-controller\job-history-search.png |

| Workflow Check | Result | Notes |
| --- | --- | --- |
| View Quoted Requests | Covered by page/menu audit where data was available | Read/navigation coverage only; no record mutation performed. |
| Review Request | Covered by page/menu audit where data was available | Read/navigation coverage only; no record mutation performed. |
| Approve Request | Skipped | Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data. |
| Send To Advisor | Skipped | Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data. |
| Verify Status Change | Skipped | Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data. |

## Service Advisor

- Login Success/Fail: Success
- Visible Menu Items: Job History Search, Sign Out
- Visible Dashboard Widgets: Parts Requests, Upsells/Recommendations (0), Vehicle Inspections (15), All, Waiting on Quote, Awaiting WC, Awaiting Decision, Approved, Denied, View
- Pages Tested: Dashboard, Job History Search
- Pages Passed: Job History Search
- Pages Failed: Dashboard (Network errors: 2)
- Console Errors: 0
- Network Errors: 2
- API Errors: 0
- Permission Errors: 0
- Blank Pages: 0
- Screenshots Captured: 3

| Page | URL | Result | Findings | Screenshot |
| --- | --- | --- | --- | --- |
| Dashboard | /Dashboard | Fail | Network errors: 2 | tests\screenshots\service-advisor\dashboard.png |
| Job History Search | /SearchHistory | Pass | - | tests\screenshots\service-advisor\job-history-search.png |

| Workflow Check | Result | Notes |
| --- | --- | --- |
| View Submitted Vehicle Inspections | Covered by page/menu audit where data was available | Read/navigation coverage only; no record mutation performed. |
| View Approved Recommendations | Covered by page/menu audit where data was available | Read/navigation coverage only; no record mutation performed. |
| View Customer Quote Information | Covered by page/menu audit where data was available | Read/navigation coverage only; no record mutation performed. |
| Mark Approved | Skipped | Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data. |
| Mark Declined | Skipped | Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data. |
| Verify Dashboard Updates | Skipped | Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data. |

## Service Manager

- Login Success/Fail: Success
- Visible Menu Items: Business Settings, Follow-Up Report, Cleanup Orders, Job History Search, Sign Out
- Visible Dashboard Widgets: Parts Requests, Upsells/Recommendations (0), Vehicle Inspections (15), All, Active, WC Completed, View
- Pages Tested: Dashboard, Business Settings, Follow-Up Report, Cleanup Orders, Job History Search
- Pages Passed: Business Settings, Follow-Up Report, Cleanup Orders, Job History Search
- Pages Failed: Dashboard (Network errors: 2)
- Console Errors: 0
- Network Errors: 2
- API Errors: 0
- Permission Errors: 0
- Blank Pages: 0
- Screenshots Captured: 6

| Page | URL | Result | Findings | Screenshot |
| --- | --- | --- | --- | --- |
| Dashboard | /Dashboard | Fail | Network errors: 2 | tests\screenshots\service-manager\dashboard.png |
| Business Settings | /BusinessSettings | Pass | - | tests\screenshots\service-manager\business-settings.png |
| Follow-Up Report | /FollowUpReport | Pass | - | tests\screenshots\service-manager\follow-up-report.png |
| Cleanup Orders | /CleanupOrders | Pass | - | tests\screenshots\service-manager\cleanup-orders.png |
| Job History Search | /SearchHistory | Pass | - | tests\screenshots\service-manager\job-history-search.png |

| Workflow Check | Result | Notes |
| --- | --- | --- |
| View Reports | Covered by page/menu audit where data was available | Read/navigation coverage only; no record mutation performed. |
| View Follow Up Report | Covered by page/menu audit where data was available | Read/navigation coverage only; no record mutation performed. |
| View Open Requests | Covered by page/menu audit where data was available | Read/navigation coverage only; no record mutation performed. |
| View Dashboard Metrics | Covered by page/menu audit where data was available | Read/navigation coverage only; no record mutation performed. |
| Verify Reporting Pages Load | Covered by page/menu audit where data was available | Read/navigation coverage only; no record mutation performed. |

## Administrator

- Login Success/Fail: Success
- Visible Menu Items: Business Settings, Follow-Up Report, Cleanup Orders, Statistics Dashboard, User Management, Testing Checklist, Job History Search, Sign Out
- Visible Dashboard Widgets: Parts Requests, Upsells/Recommendations (0), Vehicle Inspections (15), All, Active, WC Completed, Overview, Technician, Parts, Workshop, Advisor, Manager, View
- Pages Tested: Dashboard, Business Settings, Follow-Up Report, Cleanup Orders, Statistics Dashboard, User Management, Testing Checklist, Job History Search
- Pages Passed: Business Settings, Follow-Up Report, Cleanup Orders, Statistics Dashboard, User Management, Testing Checklist, Job History Search
- Pages Failed: Dashboard (Network errors: 2)
- Console Errors: 0
- Network Errors: 2
- API Errors: 0
- Permission Errors: 0
- Blank Pages: 0
- Screenshots Captured: 9

| Page | URL | Result | Findings | Screenshot |
| --- | --- | --- | --- | --- |
| Dashboard | /Dashboard | Fail | Network errors: 2 | tests\screenshots\administrator\dashboard.png |
| Business Settings | /BusinessSettings | Pass | - | tests\screenshots\administrator\business-settings.png |
| Follow-Up Report | /FollowUpReport | Pass | - | tests\screenshots\administrator\follow-up-report.png |
| Cleanup Orders | /CleanupOrders | Pass | - | tests\screenshots\administrator\cleanup-orders.png |
| Statistics Dashboard | /AdminStats | Pass | - | tests\screenshots\administrator\statistics-dashboard.png |
| User Management | /AdminUsers | Pass | - | tests\screenshots\administrator\user-management.png |
| Testing Checklist | /TestingChecklist | Pass | - | tests\screenshots\administrator\testing-checklist.png |
| Job History Search | /SearchHistory | Pass | - | tests\screenshots\administrator\job-history-search.png |

| Workflow Check | Result | Notes |
| --- | --- | --- |
| View User Management | Covered by page/menu audit where data was available | Read/navigation coverage only; no record mutation performed. |
| View Business Settings | Covered by page/menu audit where data was available | Read/navigation coverage only; no record mutation performed. |
| View Admin Dashboard | Covered by page/menu audit where data was available | Read/navigation coverage only; no record mutation performed. |
| View System Configuration | Covered by page/menu audit where data was available | Read/navigation coverage only; no record mutation performed. |
| Verify Administrative Functions Load | Skipped | Not executed because the action would create, save, submit, approve, decline, upload, or change hosted Supabase data. |

## CRITICAL ISSUES

None recorded.

## HIGH PRIORITY ISSUES

None recorded.

## MEDIUM PRIORITY ISSUES

- **Parts Interpreter** - Network error on Dashboard: GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
- **Parts Interpreter** - Network error on Dashboard: GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- **Workshop Controller** - Network error on Dashboard: GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- **Workshop Controller** - Network error on Dashboard: GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.workshop_controller&order=created_at.desc&limit=30 net::ERR_ABORTED
- **Service Advisor** - Network error on Dashboard: GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- **Service Advisor** - Network error on Dashboard: GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.service_advisor&order=created_at.desc&limit=30 net::ERR_ABORTED
- **Service Manager** - Network error on Dashboard: GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.service_advisor&order=created_at.desc&limit=30 net::ERR_ABORTED
- **Service Manager** - Network error on Dashboard: GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED
- **Administrator** - Network error on Dashboard: GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.admin&order=created_at.desc&limit=30 net::ERR_ABORTED
- **Administrator** - Network error on Dashboard: GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/parts_requests?select=*&order=created_at.desc&limit=100 net::ERR_ABORTED

## LOW PRIORITY ISSUES

None recorded.

## Single Highest Priority Issue To Fix First

**Parts Interpreter - Network error on Dashboard:** GET https://dbvgfevlfneapbqopbzv.supabase.co/rest/v1/notifications?select=*&recipient_role=eq.parts_interpreter&order=created_at.desc&limit=30 net::ERR_ABORTED
