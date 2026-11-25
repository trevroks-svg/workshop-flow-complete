/**
 * POST /api/agent-loop/run      — one agent loop pass (call every 5 minutes)
 * GET  /api/agent-loop/status   — loop state: workshop hours, last run, store
 * GET  /api/agent-loop/drafts   — drafts awaiting Trevor's approval
 *
 * Trigger (primary): an external scheduler hitting POST /api/agent-loop/run
 * every 5 minutes, e.g.
 *   - A cron job:  *\/5 7-16 * * 1-6 curl -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:3001/api/agent-loop/run
 *   - Railway / Render scheduled jobs, or GitHub Actions on a schedule.
 * The pass itself checks workshop hours (Mon-Sat 07:00-17:00 Adelaide time)
 * and does nothing outside them, so the cron can run all day.
 *
 * Optional in-process timer: set AGENT_LOOP_ENABLED=true and the server
 * runs the pass every 5 minutes itself (see startAgentLoopTimer, wired up
 * in server/index.js). Off by default — the external cron is the primary
 * mechanism because it keeps working even if the server restarts.
 *
 * Protect the run endpoint with a secret in production, same pattern as
 * /api/check-overdue-requests:
 *   req.headers['x-cron-secret'] === process.env.CRON_SECRET
 *
 * Drafts are written onto the parts request (advisor_sms_draft /
 * recommendation_text) and shown in the app's existing SMS Draft and
 * Invoice Recommendation panels — that is where Trevor reviews them.
 * The loop never changes a request's status and never sends anything.
 * Approval stays manual: Trevor (or an advisor) marks the request
 * Sent to Customer / Recommendation Added in the app.
 *
 * For tests, pass overrides via req.app.locals.agentLoop:
 *   { supabase, store, fetchCandidates, fetchBusinessRates,
 *     getScheduleRow, writeDraft, now }
 * — the same override pattern as req.app.locals.openaiClient.
 */

import {
  LOOP_STATUSES,
  LOOP_POLL_MINUTES,
  isWorkshopHours,
  getAdelaideParts,
  runAgentLoopPass,
} from '../lib/agentLoop.js';
import { createAgentLoopStore } from '../lib/agentLoopStore.js';
import { getStoredSchedule } from './jobSchedule.js';
import { matchJobCard } from '../lib/jobSchedule.js';

let cachedStore = null;
let lastRun = null;
let timerStarted = false;

async function getSupabase(overrides) {
  if (overrides?.supabase) return overrides.supabase;
  const { supabaseAdmin } = await import('../supabaseAdmin.js');
  return supabaseAdmin;
}

async function getStore(overrides) {
  if (overrides?.store) return overrides.store;
  if (!cachedStore) {
    cachedStore = await createAgentLoopStore(await getSupabase(overrides));
  }
  return cachedStore;
}

function fetchCandidates(supabase) {
  return async () => {
    const { data, error } = await supabase
      .from('parts_requests')
      .select('*')
      .in('status', LOOP_STATUSES)
      .eq('is_archived', false)
      .eq('wc_completed', false)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) throw error;
    return data || [];
  };
}

function fetchBusinessRates(supabase) {
  return async (requests) => {
    const rates = new Map();
    const ids = [...new Set((requests || []).map(r => r.business_id).filter(Boolean))];
    if (!ids.length) return rates;
    const { data, error } = await supabase
      .from('businesses')
      .select('id, default_labour_rate')
      .in('id', ids);
    if (error) throw error;
    for (const row of data || []) {
      rates.set(row.id, row.default_labour_rate);
    }
    return rates;
  };
}

function getScheduleRow(overrides) {
  if (overrides?.getScheduleRow) return overrides.getScheduleRow;
  return (jobCard) => matchJobCard(getStoredSchedule().rows, jobCard);
}

function writeDraft(supabase) {
  return async (request, draft) => {
    const updates = {};
    if (draft.type === 'sms') {
      updates.advisor_sms_draft = draft.text;
      updates.advisor_sms_generated_at = new Date().toISOString();
    } else {
      updates.recommendation_text = draft.text;
    }
    // Save the schedule-matched customer details with the draft, as the
    // app's own SMS generator does — but never overwrite what is already
    // on the request.
    if (!String(request.customer_name || '').trim() && draft.customerName) {
      updates.customer_name = draft.customerName;
    }
    if (!String(request.vehicle_type || '').trim() && draft.vehicle) {
      updates.vehicle_type = draft.vehicle;
    }
    const { error } = await supabase
      .from('parts_requests')
      .update(updates)
      .eq('id', request.id);
    if (error) throw error;
  };
}

/** Build the dependency set for one pass (real Supabase unless overridden). */
export async function buildLoopDeps(overrides = {}) {
  const supabase = await getSupabase(overrides);
  const store = await getStore(overrides);
  return {
    now: overrides.now,
    fetchCandidates: overrides.fetchCandidates || fetchCandidates(supabase),
    fetchBusinessRates: overrides.fetchBusinessRates || fetchBusinessRates(supabase),
    getScheduleRow: getScheduleRow(overrides),
    isSeen: (key) => store.isSeen(key),
    markSeen: (entry) => store.markSeen(entry),
    writeDraft: overrides.writeDraft || writeDraft(supabase),
    logger: overrides.logger || console,
    _store: store,
  };
}

export default async function runAgentLoop(req, res) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers['x-cron-secret'] !== cronSecret) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const deps = await buildLoopDeps(req.app?.locals?.agentLoop);
    const summary = await runAgentLoopPass(deps);
    lastRun = summary;
    return res.json(summary);
  } catch (err) {
    console.error('agentLoop run error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** In-process timer (optional — see header). Runs the pass every 5 minutes. */
export function startAgentLoopTimer() {
  if (timerStarted) return;
  timerStarted = true;

  const tick = async () => {
    try {
      const deps = await buildLoopDeps();
      const summary = await runAgentLoopPass(deps);
      lastRun = summary;
      if (summary.ran) {
        console.log(
          `Agent loop: checked ${summary.checked}, drafted ${summary.drafted.length}, ` +
          `needs attention ${summary.needsAttention.length}, errors ${summary.errors.length}`
        );
      }
    } catch (err) {
      console.error('Agent loop timer error:', err);
    }
  };

  // First pass shortly after startup, then every 5 minutes. The pass
  // no-ops outside workshop hours.
  setTimeout(tick, 10 * 1000);
  setInterval(tick, LOOP_POLL_MINUTES * 60 * 1000);
  console.log('Agent loop timer started (every 5 minutes, workshop hours only).');
}

export async function getAgentLoopStatus(req, res) {
  try {
    const overrides = req.app?.locals?.agentLoop;
    const store = await getStore(overrides);
    const now = overrides?.now || new Date();
    const schedule = getStoredSchedule();
    return res.json({
      success: true,
      inWorkshopHours: isWorkshopHours(now),
      adelaideTime: getAdelaideParts(now),
      pollMinutes: LOOP_POLL_MINUTES,
      storeBackend: store.backend,
      storeTableMissing: store.tableMissing,
      seenCount: await store.count(),
      scheduleLoaded: schedule.rows.length > 0,
      scheduleRowCount: schedule.rows.length,
      scheduleImportedAt: schedule.importedAt,
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      lastRun,
    });
  } catch (err) {
    console.error('agentLoop status error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

const APPROVED_STATUSES = new Set([
  'sent_to_customer',
  'recommendation_added',
  'customer_approved',
  'customer_denied',
]);

export async function listAgentLoopDrafts(req, res) {
  try {
    const overrides = req.app?.locals?.agentLoop;
    const supabase = await getSupabase(overrides);
    const store = await getStore(overrides);
    const seen = await store.listSeen();

    // Current status of each drafted request, so the list shows what is
    // still awaiting approval vs already actioned.
    const ids = [...new Set(seen.map(entry => entry.requestId).filter(Boolean))];
    const currentById = new Map();
    if (ids.length) {
      const { data, error } = await supabase
        .from('parts_requests')
        .select('id, status, job_card_number, advisor_sms_draft, recommendation_text')
        .in('id', ids);
      if (error) throw error;
      for (const row of data || []) currentById.set(row.id, row);
    }

    const pending = [];
    const resolved = [];
    for (const entry of seen) {
      const current = currentById.get(entry.requestId);
      const item = {
        ...entry,
        currentStatus: current?.status || null,
        draftText: entry.draftType === 'sms'
          ? current?.advisor_sms_draft || null
          : current?.recommendation_text || null,
      };
      if (current && APPROVED_STATUSES.has(current.status)) resolved.push(item);
      else pending.push(item);
    }

    return res.json({ success: true, pending, resolved });
  } catch (err) {
    console.error('agentLoop drafts error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
