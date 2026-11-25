/**
 * Agent loop — core logic (Phase 2).
 *
 * The loop polls for new upsells and recommendations and prepares drafts
 * for Trevor's approval. It never sends anything to a customer and never
 * changes a request's status.
 *
 * Proven in the 24-25 Nov 2026 trial (in the Base44 app) and carried over:
 * - Check every 5 minutes during workshop hours only.
 * - Upsells with status `sent_to_advisor` get an SMS draft.
 * - Tiles with status `advisor_action_required` get an invoice-note quote
 *   only — NEVER an SMS.
 * - Verify the quote PDF matches the job before pricing it.
 * - Read the daily job schedule for the customer name/vehicle; never invent
 *   them. Labour $190 inc GST (default), tyres at 2mm as a set of four,
 *   filters carry $0 labour, plain-ASCII drafts, fitted total only on
 *   invoice notes.
 *
 * Cost frame: the loop drafts deterministically from the rules-based quote
 * parser (no AI tokens). A quote the parser cannot read is flagged
 * `needs_attention` for a human to draft in the app — the AI path stays
 * available there via the existing Generate buttons. No AI call is made
 * by the loop itself.
 *
 * Freshness: only requests updated in the last 48 hours are drafted, so a
 * first run (or a restart) never resurrects a stale backlog. A request is
 * drafted once per status + updated_at — the seen store records that, so a
 * re-run never drafts the same upsell twice.
 */

import { parseQuoteText, parseNotePrices } from './quoteParser.js';
import { checkPdfMatchesJob } from './pdfJobMatch.js';
import { applyTyreSetOfFourRule } from './tyreRule.js';
import { resolveLabourRate, DEFAULT_LABOUR_RATE_INC_GST } from './labourRate.js';
import { scheduleRowToCustomer } from './jobSchedule.js';
import { groupFamily, groupsHaveOptions } from './plainPartName.js';
import { buildSmsDraft, buildRecommendationText, getGroupPricing, groupsWithLabour } from './draftText.js';

export const AGENT_LOOP_TIMEZONE = 'Australia/Adelaide';
export const WORKSHOP_OPEN_HOUR = 7; // 07:00 Adelaide time
export const WORKSHOP_CLOSE_HOUR = 17; // 17:00 Adelaide time
export const WORKSHOP_DAYS = [1, 2, 3, 4, 5, 6]; // Mon-Sat; workshop is closed Sundays
export const LOOP_POLL_MINUTES = 5;
export const LOOP_FRESH_HOURS = 48;

export const LOOP_STATUSES = ['sent_to_advisor', 'advisor_action_required'];
export const DRAFT_TYPE_FOR_STATUS = {
  sent_to_advisor: 'sms',
  advisor_action_required: 'recommendation',
};

/** Adelaide-local parts of a date (DST-aware via Intl). */
export function getAdelaideParts(date) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: AGENT_LOOP_TIMEZONE,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const get = type => parts.find(part => part.type === type)?.value;
  const weekdayName = get('weekday'); // Mon, Tue, ...
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekdayName) + 1;
  // Intl can return hour "24" at midnight when hour12 is false.
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));

  return { weekday, hour, minute };
}

/** True during workshop hours: Mon-Sat, 07:00-17:00 Adelaide time. */
export function isWorkshopHours(date = new Date()) {
  const { weekday, hour, minute } = getAdelaideParts(date);
  if (!WORKSHOP_DAYS.includes(weekday)) return false;
  const minutes = hour * 60 + minute;
  return minutes >= WORKSHOP_OPEN_HOUR * 60 && minutes < WORKSHOP_CLOSE_HOUR * 60;
}

/** 'sms' for sent_to_advisor, 'recommendation' for advisor_action_required, else null. */
export function classifyRequest(request) {
  return DRAFT_TYPE_FOR_STATUS[request?.status] || null;
}

/** True when the loop should consider this request at all. */
export function isCandidateRequest(request) {
  if (!request || typeof request !== 'object') return false;
  if (!LOOP_STATUSES.includes(request.status)) return false;
  if (request.is_archived) return false;
  if (request.wc_completed) return false;
  return true;
}

/** Only work updated recently is drafted — a restart must not resurrect a stale backlog. */
export function isFreshRequest(request, now = new Date(), maxAgeHours = LOOP_FRESH_HOURS) {
  const updatedAt = request?.updated_at || request?.created_at;
  if (!updatedAt) return true; // No timestamp to judge by — draft rather than silently skip.
  const ageMs = now - new Date(updatedAt);
  if (!Number.isFinite(ageMs) || ageMs < 0) return true;
  return ageMs <= maxAgeHours * 60 * 60 * 1000;
}

/** Dedup key: one draft per request, per status, per last update. */
export function seenKey(request) {
  return `${request.id}:${request.status}:${request.updated_at || request.created_at || ''}`;
}

/**
 * For 'other' parts the PDF line is a part code (GARNISH ASSY-FRT DR SIDE)
 * while the request carries the plain description the technician typed
 * ("Front passenger door side skirt"). Use the request's description for
 * the draft when there is exactly one 'other' part to match it to.
 */
function useRequestPartDescriptions(groups, request) {
  const otherParts = (request?.parts || []).filter(
    (part) => part.part_type === 'other' && String(part.other_description || '').trim()
  );
  if (otherParts.length !== 1) return groups;
  const description = otherParts[0].other_description.trim();
  return (groups || []).map((group) =>
    groupFamily(group) === 'other' ? { ...group, repair_name: description } : group
  );
}

/**
 * Analyse a request with the rules-based quote parser (no AI).
 * Returns { ok, groups, lineItems, quoteTotalIncGst, pdfJobMatch,
 * priceSource, gstBasis } or { ok: false, reason, pdfJobMatch? }.
 *
 * Quote sources, in order: the quote PDF, then the parts interpreter's
 * note (break B3 - a blank PDF with a note price still drafts, and the
 * draft flags carry the provenance: priceSource 'parts_note',
 * gstBasisUnconfirmed true). The PDF-vs-job check still runs on the
 * note path: a PDF showing a different job card is a mismatch even when
 * the price comes from the note.
 */
export function analyseRequestWithRules(request) {
  const rules = parseQuoteText(request?.quote_pdf_text);
  if (rules.success) {
    const pdfJobMatch = checkPdfMatchesJob(
      request,
      request.quote_pdf_text,
      rules.result.line_items
    );
    if (pdfJobMatch.status === 'mismatch') {
      return {
        ok: false,
        reason: `Quote PDF does not match this job: ${pdfJobMatch.reason}`,
        pdfJobMatch,
      };
    }

    const groups = applyTyreSetOfFourRule(
      rules.result.groups,
      rules.result.line_items,
      request
    );

    return {
      ok: true,
      source: 'rules',
      confidence: rules.confidence,
      groups: useRequestPartDescriptions(groups, request),
      lineItems: rules.result.line_items,
      quoteTotalIncGst: rules.result.quote_total_inc_gst ?? null,
      pdfJobMatch,
      priceSource: 'pdf',
      gstBasis: rules.result.gst_basis || 'labelled',
    };
  }

  const notePrices = parseNotePrices(request?.parts_interpreter_notes, request);
  if (notePrices) {
    const pdfJobMatch = checkPdfMatchesJob(
      request,
      request.quote_pdf_text,
      notePrices.line_items
    );
    if (pdfJobMatch.status === 'mismatch') {
      return {
        ok: false,
        reason: `Quote PDF does not match this job: ${pdfJobMatch.reason}`,
        pdfJobMatch,
      };
    }

    const groups = applyTyreSetOfFourRule(
      notePrices.groups,
      notePrices.line_items,
      request
    );

    return {
      ok: true,
      source: 'note',
      confidence: 0.8,
      groups: useRequestPartDescriptions(groups, request),
      lineItems: notePrices.line_items,
      quoteTotalIncGst: notePrices.quote_total_inc_gst ?? null,
      pdfJobMatch,
      priceSource: 'parts_note',
      gstBasis: 'unconfirmed',
    };
  }

  return { ok: false, reason: rules.reason || 'Quote could not be read automatically' };
}

/** Fitted total across priced groups, for the run summary. Null when the
 * groups are two or more options: their totals are alternatives and must
 * never be added together (break B1). */
export function quoteTotalForGroups(groups, request, labourRate) {
  const priced = groupsWithLabour(groups, request);
  if (groupsHaveOptions(priced)) return null;
  const prices = priced.map(group => getGroupPricing(group, request, priced, labourRate));
  if (!prices.length || !prices.every(Boolean)) return null;
  return Math.round((prices.reduce((sum, p) => sum + p.totalIncGst, 0) + Number.EPSILON) * 100) / 100;
}

/**
 * Process one candidate request into a draft (or a needs-attention outcome).
 * Pure apart from ctx.getScheduleRow.
 *
 * ctx: { getScheduleRow?: (jobCard) => row|null, labourRate?: number }
 */
export function processRequest(request, ctx = {}) {
  const draftType = classifyRequest(request);
  if (!draftType) return { action: 'skipped', reason: 'not_a_candidate' };

  // Never overwrite a draft an advisor already made in the app.
  if (draftType === 'sms' && String(request.advisor_sms_draft || '').trim()) {
    return { action: 'skipped', reason: 'draft_already_exists' };
  }
  if (draftType === 'recommendation' && String(request.recommendation_text || '').trim()) {
    return { action: 'skipped', reason: 'draft_already_exists' };
  }

  const analysis = analyseRequestWithRules(request);
  if (!analysis.ok) {
    return { action: 'needs_attention', reason: analysis.reason, pdfJobMatch: analysis.pdfJobMatch || null };
  }

  // Customer name/vehicle: the request first, then today's job schedule.
  // Never invented — when neither has them the draft is flagged.
  const scheduleRow = ctx.getScheduleRow ? ctx.getScheduleRow(request.job_card_number) : null;
  const scheduleCustomer = scheduleRowToCustomer(scheduleRow);
  const customerName = String(request.customer_name || '').trim()
    || String(scheduleCustomer?.customerName || '').trim();
  const vehicle = String(request.vehicle_type || '').trim()
    || String(scheduleCustomer?.vehicle || '').trim();
  const scheduleMatched = scheduleRow != null;
  const customerUnverified = !customerName || !vehicle;

  // Labour rate: the request's snapshot, then the business rate, then $190.
  const labourRate = resolveLabourRate(request.labour_rate_ex_gst, ctx.labourRate);

  const draftText = draftType === 'sms'
    ? buildSmsDraft({ customerName, vehicle, groups: analysis.groups, request, labourRate })
    : buildRecommendationText({ groups: analysis.groups, request, labourRate });

  return {
    action: 'drafted',
    draftType,
    draftText,
    customerName,
    vehicle,
    quoteTotalIncGst: quoteTotalForGroups(analysis.groups, request, labourRate),
    groups: analysis.groups,
    flags: {
      scheduleMatched,
      customerUnverified,
      pdfJobMatch: analysis.pdfJobMatch?.status || 'unverified',
      tyreRuleApplied: analysis.groups.some(group => group.tyre_rule_applied),
      priceSource: analysis.priceSource || 'pdf',
      gstBasis: analysis.gstBasis || 'labelled',
      gstBasisUnconfirmed: analysis.gstBasis === 'unconfirmed',
    },
  };
}

/**
 * One loop pass. Dependencies are injected so the pass is testable without
 * Supabase or OpenAI:
 *
 * deps: {
 *   now?: Date,
 *   fetchCandidates: () => Promise<request[]>,
 *   fetchBusinessRates?: (requests) => Promise<Map<businessId, rate>>,
 *   getScheduleRow?: (jobCard) => row|null,
 *   isSeen: (key) => Promise<boolean>,
 *   markSeen: (entry) => Promise<void>,
 *   writeDraft: (request, draft) => Promise<void>,
 *   logger?: { info, warn },
 * }
 */
export async function runAgentLoopPass(deps) {
  const now = deps.now || new Date();
  const log = deps.logger || console;
  const ranAt = now.toISOString();

  if (!isWorkshopHours(now)) {
    return {
      success: true,
      ran: false,
      reason: 'outside_workshop_hours',
      ranAt,
      adelaideTime: getAdelaideParts(now),
      checked: 0,
      drafted: [],
      skipped: [],
      needsAttention: [],
      errors: [],
    };
  }

  const candidates = await deps.fetchCandidates();
  const businessRates = deps.fetchBusinessRates
    ? await deps.fetchBusinessRates(candidates)
    : new Map();

  const drafted = [];
  const skipped = [];
  const needsAttention = [];
  const errors = [];

  for (const request of candidates) {
    const jobCard = request?.job_card_number || '(unknown)';
    try {
      if (!isCandidateRequest(request)) {
        skipped.push({ requestId: request?.id, jobCard, reason: 'not_a_candidate' });
        continue;
      }
      if (!isFreshRequest(request, now)) {
        skipped.push({ requestId: request.id, jobCard, reason: 'stale' });
        continue;
      }

      const key = seenKey(request);
      if (await deps.isSeen(key)) {
        skipped.push({ requestId: request.id, jobCard, reason: 'already_drafted' });
        continue;
      }

      const outcome = processRequest(request, {
        getScheduleRow: deps.getScheduleRow,
        labourRate: businessRates.get(request.business_id),
      });

      if (outcome.action === 'skipped') {
        skipped.push({ requestId: request.id, jobCard, reason: outcome.reason });
        continue;
      }

      if (outcome.action === 'needs_attention') {
        // Not marked seen: the next pass retries it (a quote may appear),
        // and it shows in every run summary until a human handles it.
        needsAttention.push({
          requestId: request.id,
          jobCard,
          status: request.status,
          reason: outcome.reason,
        });
        continue;
      }

      // Drafted: save the draft onto the request, then record the watermark.
      // The status is never changed here — approval stays with Trevor.
      await deps.writeDraft(request, {
        type: outcome.draftType,
        text: outcome.draftText,
        customerName: outcome.customerName,
        vehicle: outcome.vehicle,
        quoteTotalIncGst: outcome.quoteTotalIncGst,
        flags: outcome.flags,
      });
      await deps.markSeen({
        key,
        requestId: request.id,
        jobCardNumber: jobCard,
        status: request.status,
        requestUpdatedAt: request.updated_at || request.created_at || null,
        draftType: outcome.draftType,
        draftedAt: ranAt,
        flags: outcome.flags,
      });

      drafted.push({
        requestId: request.id,
        jobCard,
        status: request.status,
        draftType: outcome.draftType,
        quoteTotalIncGst: outcome.quoteTotalIncGst,
        flags: outcome.flags,
      });
    } catch (err) {
      log.warn?.(`Agent loop failed on ${jobCard}:`, err);
      errors.push({ requestId: request?.id, jobCard, error: err.message || String(err) });
    }
  }

  return {
    success: true,
    ran: true,
    ranAt,
    adelaideTime: getAdelaideParts(now),
    checked: candidates.length,
    drafted,
    skipped,
    needsAttention,
    errors,
  };
}

export { DEFAULT_LABOUR_RATE_INC_GST };
