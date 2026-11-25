-- Agent loop watermark (Phase 2, 25 Nov 2026).
--
-- Records which parts requests the agent loop has already drafted, so a
-- re-run never drafts the same upsell twice. One row per request + status +
-- last update: if a request flips status or its quote is updated, its key
-- changes and the loop may draft it again.
--
-- HOW TO APPLY (Trevor, or whoever deploys this):
--   1. Open the Supabase dashboard for this project -> SQL Editor.
--   2. Paste this file and press Run.
--   3. No data is touched — this only creates one new table.
-- The loop never runs this itself. Until it is applied, the loop falls back
-- to an in-memory watermark that forgets drafts on a server restart.

create table if not exists agent_loop_seen (
  key text primary key,
  request_id text not null,
  job_card_number text,
  status text not null,
  request_updated_at timestamptz,
  draft_type text not null check (draft_type in ('sms', 'recommendation')),
  drafted_at timestamptz not null default now(),
  flags jsonb not null default '{}'::jsonb
);

comment on table agent_loop_seen is
  'Agent loop watermark: one row per parts request the loop has drafted. Drafts themselves live on parts_requests (advisor_sms_draft / recommendation_text); this table only records that a draft was made.';
