# Workshop Flow

Service parts order app for the Fleurieu Motor Group workshop — the Codex-built
replacement for the Base44 app of the same name. Technicians raise parts
requests, parts interpreters price them from quote PDFs, the workshop
controller approves, and service advisors send the customer an SMS draft (or
add the quote to the invoice as a recommendation) and record the customer's
decision.

## Stack

- Frontend: React + Vite (`src/`)
- Server: Express (`server/`) — notifications, Stripe, and the AI routes
- Database: Supabase (see `supabase/migrations/`)

## Workflow statuses

`sent_to_parts` → `quoted` → `awaiting_workshop_approval` → `sent_to_advisor`
→ `sent_to_customer` → `customer_approved` / `customer_denied`.
Recommendation tiles use `advisor_action_required` → `recommendation_added`.

## Rules the app enforces (from the Nov 2026 workshop trial)

- Labour is charged **inc GST** — the rate in Business Settings is the
  inc-GST hourly rate (default $190). Entering 190 charges $190, not $209.
- A quote PDF is checked against its job card before it is used — a PDF for
  another job is flagged and never priced.
- Tyres: tread at or below **2mm** is recommended as a **set of four**.
- SMS drafts are **plain ASCII only** (no em dashes or curly quotes — the
  dealer system turns them into "?"), with no quotation marks around the text.
- Invoice recommendation notes quote the **fitted total only**.
- When a quote lists two options (e.g. two tyre brands), both are drafted.
- The daily job schedule CSV can be uploaded on the Dashboard; SMS drafts
  match customer name and vehicle by **Job Card**, never by rego. If no row
  matches, the draft is flagged incomplete — details are never invented.
- SMS drafts are drafts only. Nothing is sent to a customer without approval.

## Agent loop (Phase 2)

The server can poll for new upsells and prepare drafts for approval, on its
own — no one has to sit watching the app.

- **What it does:** every 5 minutes during workshop hours (Mon–Sat,
  07:00–17:00 Adelaide time) it checks for requests at `sent_to_advisor`
  and `advisor_action_required`. The first get an SMS draft; the second get
  an invoice-note quote only, never an SMS. Drafts are written onto the
  request (`advisor_sms_draft` / `recommendation_text`) and reviewed in the
  app's existing panels. The loop never changes a status and never sends
  anything — approval stays manual.
- **How it drafts:** deterministically from the rules-based quote parser
  (no AI tokens). A quote the parser cannot read is flagged
  `needs_attention` in the run summary instead of guessed at — draft it in
  the app, where the AI Generate buttons are available. Air/pollen filters
  carry $0 labour; labour hours come from the controller's labour line, the
  PDF's labour line, or the 0.5h estimate, in that order.
- **Trigger (primary):** an external scheduler hitting the endpoint every
  5 minutes:
  `POST /api/agent-loop/run` (protect with `CRON_SECRET` via the
  `x-cron-secret` header). The pass no-ops outside workshop hours, so the
  cron can run all day. Or set `AGENT_LOOP_ENABLED=true` to run the same
  pass on an in-process timer instead.
- **Dedup:** the `agent_loop_seen` table records every drafted request
  (one row per request + status + last update). Apply
  `supabase/migrations/202611250001_agent_loop_seen.sql` in the Supabase
  SQL editor to enable it; until then the loop falls back to an in-memory
  store that forgets drafts on restart.
- **Watch it:** `GET /api/agent-loop/status` (hours, last run, store,
  schedule) and `GET /api/agent-loop/drafts` (drafts still awaiting
  approval vs already actioned). Import the day's job schedule first
  (`POST /api/job-schedule/import`) so drafts get the customer name and
  vehicle — otherwise they are flagged `customer_unverified`.
- **Freshness:** only requests updated in the last 48 hours are drafted,
  so a restart never resurrects a stale backlog.

## Run it

See [SETUP.md](SETUP.md). In short:

```bash
npm install
npm run dev        # frontend on http://localhost:5173
cd server
npm install
cp server/.env.example server/.env   # fill in the keys
node index.js      # API on http://localhost:3001
```

## Tests

```bash
cd server && npm test
```
