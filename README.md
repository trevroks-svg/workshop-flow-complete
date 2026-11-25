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
