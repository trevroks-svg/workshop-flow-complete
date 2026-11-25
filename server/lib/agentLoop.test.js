import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isWorkshopHours,
  getAdelaideParts,
  classifyRequest,
  isCandidateRequest,
  isFreshRequest,
  seenKey,
  analyseRequestWithRules,
  processRequest,
  runAgentLoopPass,
} from './agentLoop.js';

// Wed 25 Nov 2026, 10:00 ACDT (UTC+10:30) — inside workshop hours.
const WED_1000 = new Date('2026-11-24T23:30:00Z');
const WED_0630 = new Date('2026-11-24T20:00:00Z'); // 06:30 ACDT — before open
const WED_1700 = new Date('2026-11-25T06:30:00Z'); // 17:00 ACDT — closed
const WED_1659 = new Date('2026-11-25T06:29:00Z'); // 16:59 ACDT — still open
const SAT_1030 = new Date('2026-11-28T00:00:00Z'); // Sat 28 Nov, 10:30 ACDT
const SUN_1030 = new Date('2026-11-29T00:00:00Z'); // Sun 29 Nov, 10:30 ACDT
const WINTER_0700 = new Date('2026-07-14T21:30:00Z'); // Wed 15 Jul, 07:00 AEST (+9:30)
const WINTER_0659 = new Date('2026-07-14T21:29:00Z'); // 06:59 AEST

test('Adelaide parts resolve correctly across DST', () => {
  assert.deepEqual(getAdelaideParts(WED_1000), { weekday: 3, hour: 10, minute: 0 });
  assert.deepEqual(getAdelaideParts(WINTER_0700), { weekday: 3, hour: 7, minute: 0 });
});

test('workshop hours are Mon-Sat 07:00-17:00 Adelaide time', () => {
  assert.equal(isWorkshopHours(WED_1000), true);
  assert.equal(isWorkshopHours(WED_1659), true);
  assert.equal(isWorkshopHours(WED_0630), false);
  assert.equal(isWorkshopHours(WED_1700), false);
  assert.equal(isWorkshopHours(SAT_1030), true);
  assert.equal(isWorkshopHours(SUN_1030), false);
  assert.equal(isWorkshopHours(WINTER_0700), true);
  assert.equal(isWorkshopHours(WINTER_0659), false);
});

test('classification: sent_to_advisor is an SMS, advisor_action_required is a recommendation only', () => {
  assert.equal(classifyRequest({ status: 'sent_to_advisor' }), 'sms');
  assert.equal(classifyRequest({ status: 'advisor_action_required' }), 'recommendation');
  assert.equal(classifyRequest({ status: 'sent_to_parts' }), null);
  assert.equal(classifyRequest({ status: 'quoted' }), null);
  assert.equal(classifyRequest({ status: 'sent_to_customer' }), null);
  assert.equal(isCandidateRequest({ status: 'sent_to_advisor' }), true);
  assert.equal(isCandidateRequest({ status: 'sent_to_advisor', is_archived: true }), false);
  assert.equal(isCandidateRequest({ status: 'sent_to_advisor', wc_completed: true }), false);
});

test('freshness: only work updated in the last 48 hours is drafted', () => {
  const recent = { updated_at: '2026-11-25T00:00:00Z' }; // 10:30 ACDT Wed, ~30 min before the run
  const old = { updated_at: '2026-11-22T00:00:00Z' };
  assert.equal(isFreshRequest(recent, WED_1000), true);
  assert.equal(isFreshRequest(old, WED_1000), false);
  assert.equal(isFreshRequest({}, WED_1000), true); // no timestamp — draft rather than skip silently
});

test('seen key changes when the request is updated or flips status', () => {
  const base = { id: 'abc', status: 'sent_to_advisor', updated_at: '2026-11-25T00:00:00Z' };
  assert.equal(seenKey(base), 'abc:sent_to_advisor:2026-11-25T00:00:00Z');
  assert.notEqual(seenKey({ ...base, updated_at: '2026-11-25T01:00:00Z' }), seenKey(base));
  assert.notEqual(seenKey({ ...base, status: 'advisor_action_required' }), seenKey(base));
});

// Trial case, 25 Nov 2026 (J03073211): filters quote on a standard-format PDF.
const DEERE_PDF = [
  'PARTS QUOTATION',
  'Description Part Number Qty Unit Price (ex GST) GST Total (inc GST)',
  'ELEMENT SUB-ASSY 1780151020 1 $74.02 $7.40 $81.42',
  'CABIN FILTER 87139YZZ25 1 $80.85 $8.09 $88.94',
  'Subtotal (ex GST): $154.87',
  'GST (10%): $15.49',
  'TOTAL (inc GST): $170.36',
].join(' ');

const DEERE_REQUEST = {
  id: 'req-deere',
  job_card_number: 'J03073211',
  status: 'sent_to_advisor',
  parts: [{ part_type: 'air_filter', quantity: 1 }, { part_type: 'pollen_filter', quantity: 1 }],
  quote_pdf_text: DEERE_PDF,
  updated_at: '2026-11-25T00:00:00Z',
  created_at: '2026-11-25T00:00:00Z',
};

test('rules analysis prices the Deere filters quote with $0 labour', () => {
  const analysis = analyseRequestWithRules(DEERE_REQUEST);
  assert.equal(analysis.ok, true);
  assert.equal(analysis.groups.length, 2);
  assert.equal(analysis.quoteTotalIncGst, 170.36);
});

test('rules analysis refuses a mismatched PDF', () => {
  const analysis = analyseRequestWithRules({
    job_card_number: 'J03073149',
    parts: [{ part_type: 'tyres', quantity: 1 }],
    quote_pdf_text: [
      'PARTS QUOTATION',
      'Description Part Number Qty Unit Price (ex GST) GST Total (inc GST)',
      'Battery BT-123 1 $200.00 $20.00 $220.00',
      'Subtotal (ex GST): $200.00',
      'GST (10%): $20.00',
      'TOTAL (inc GST): $220.00',
    ].join(' '),
  });
  assert.equal(analysis.ok, false);
  assert.equal(analysis.pdfJobMatch.status, 'mismatch');
});

test('rules analysis fails cleanly on a blank/stale PDF (notes-only pricing)', () => {
  const analysis = analyseRequestWithRules({
    job_card_number: 'J03073213',
    parts: [{ part_type: 'tyres', quantity: 2 }],
    quote_pdf_text: 'PARTS QUOTATION TOTAL $0.00',
    parts_interpreter_notes: 'hifly HP801 $179 each+fit, 3 days',
  });
  assert.equal(analysis.ok, false);
  assert.match(analysis.reason, /could not be read|No complete/i);
});

test('processRequest drafts the Deere SMS at $170.36 with schedule details', () => {
  const outcome = processRequest(DEERE_REQUEST, {
    getScheduleRow: () => ({
      jobCard: 'J03073211',
      owner: 'Mr Oliver Deere',
      modelDescription: 'Landcruiser Wagon GXL',
      mobile: '0447298869',
    }),
  });
  assert.equal(outcome.action, 'drafted');
  assert.equal(outcome.draftType, 'sms');
  assert.equal(outcome.quoteTotalIncGst, 170.36);
  assert.match(outcome.draftText, /Hi Mr Oliver Deere, for your Landcruiser Wagon GXL/);
  assert.match(outcome.draftText, /Total: \$170\.36 inc GST/);
  assert.equal(outcome.flags.scheduleMatched, true);
  assert.equal(outcome.flags.customerUnverified, false);
});

test('processRequest flags a draft when no schedule row matches', () => {
  const outcome = processRequest(DEERE_REQUEST, { getScheduleRow: () => null });
  assert.equal(outcome.action, 'drafted');
  assert.equal(outcome.flags.scheduleMatched, false);
  assert.equal(outcome.flags.customerUnverified, true);
  assert.match(outcome.draftText, /^Hi there,/);
});

test('processRequest never overwrites a draft already in the app', () => {
  const outcome = processRequest(
    { ...DEERE_REQUEST, advisor_sms_draft: 'Existing draft' },
    { getScheduleRow: () => null },
  );
  assert.equal(outcome.action, 'skipped');
  assert.equal(outcome.reason, 'draft_already_exists');
});

test('processRequest builds a recommendation note, never an SMS, for advisor_action_required', () => {
  const request = {
    id: 'req-waite',
    job_card_number: 'J03073209',
    status: 'advisor_action_required',
    parts: [{ part_type: 'other', quantity: 1, other_description: 'Front passenger door side skirt' }],
    quote_pdf_text: [
      'PARTS QUOTATION',
      'Description Part Number Qty Unit Price (ex GST) GST Total (inc GST)',
      'GARNISH ASSY-FRT DR SIDE 87721S8SB0 1 $223.10 $22.31 $245.41',
      'Subtotal (ex GST): $223.10',
      'GST (10%): $22.31',
      'TOTAL (inc GST): $245.41',
    ].join(' '),
    labour_lines: [{ part_type: 'other', hours: 1 }],
    updated_at: '2026-11-25T00:00:00Z',
  };
  const outcome = processRequest(request, { getScheduleRow: () => null });
  assert.equal(outcome.action, 'drafted');
  assert.equal(outcome.draftType, 'recommendation');
  // $223.10 ex GST + GST = $245.41, plus 1h labour at $190 inc GST.
  assert.equal(outcome.quoteTotalIncGst, 435.41);
  assert.match(outcome.draftText, /Recommend GARNISH ASSY-FRT DR SIDE: \$435\.41 inc GST \(fitted\)\./);
  assert.doesNotMatch(outcome.draftText, /Please reply YES/);
});

test('processRequest returns needs_attention when the quote cannot be read', () => {
  const outcome = processRequest({
    id: 'req-dixon',
    job_card_number: 'J03073213',
    status: 'advisor_action_required',
    parts: [{ part_type: 'tyres', quantity: 2 }],
    quote_pdf_text: 'PARTS QUOTATION TOTAL $0.00',
    parts_interpreter_notes: 'hifly HP801 $179 each+fit, 3 days',
    updated_at: '2026-11-25T00:00:00Z',
  }, { getScheduleRow: () => null });
  assert.equal(outcome.action, 'needs_attention');
});

function makeDeps({ requests, now, seen = new Set(), scheduleRows = {} }) {
  const written = [];
  const marked = [];
  return {
    written,
    marked,
    seen,
    deps: {
      now,
      fetchCandidates: async () => requests,
      fetchBusinessRates: async () => new Map(),
      getScheduleRow: (jobCard) => scheduleRows[jobCard] || null,
      isSeen: async (key) => seen.has(key),
      markSeen: async (entry) => { seen.add(entry.key); marked.push(entry); },
      writeDraft: async (request, draft) => { written.push({ request, draft }); },
      logger: { info() {}, warn() {} },
    },
  };
}

test('runAgentLoopPass drafts once and skips the same request on the next run', async () => {
  const { deps, written, marked, seen } = makeDeps({
    requests: [DEERE_REQUEST],
    now: WED_1000,
    scheduleRows: {
      J03073211: { jobCard: 'J03073211', owner: 'Mr Oliver Deere', modelDescription: 'Landcruiser Wagon GXL' },
    },
  });

  const first = await runAgentLoopPass(deps);
  assert.equal(first.ran, true);
  assert.equal(first.checked, 1);
  assert.equal(first.drafted.length, 1);
  assert.equal(first.drafted[0].draftType, 'sms');
  assert.equal(written.length, 1);
  assert.equal(marked.length, 1);
  assert.equal(marked[0].requestId, 'req-deere');
  assert.equal(seen.size, 1);

  const second = await runAgentLoopPass(deps);
  assert.equal(second.drafted.length, 0);
  assert.equal(second.skipped.length, 1);
  assert.equal(second.skipped[0].reason, 'already_drafted');
  assert.equal(written.length, 1); // no second draft written
});

test('runAgentLoopPass does nothing outside workshop hours', async () => {
  const { deps } = makeDeps({ requests: [DEERE_REQUEST], now: WED_0630 });
  const summary = await runAgentLoopPass(deps);
  assert.equal(summary.ran, false);
  assert.equal(summary.reason, 'outside_workshop_hours');
  assert.equal(summary.checked, 0);

  const sunday = makeDeps({ requests: [DEERE_REQUEST], now: SUN_1030 });
  assert.equal((await runAgentLoopPass(sunday.deps)).ran, false);
});

test('runAgentLoopPass reports needs_attention and skips stale work', async () => {
  const stale = { ...DEERE_REQUEST, id: 'req-stale', job_card_number: 'J03070000', updated_at: '2026-11-20T00:00:00Z' };
  const unparseable = {
    id: 'req-unparseable',
    job_card_number: 'J03073213',
    status: 'advisor_action_required',
    parts: [{ part_type: 'tyres', quantity: 2 }],
    quote_pdf_text: 'PARTS QUOTATION TOTAL $0.00',
    updated_at: '2026-11-25T00:00:00Z',
  };
  const { deps } = makeDeps({ requests: [stale, unparseable], now: WED_1000 });
  const summary = await runAgentLoopPass(deps);
  assert.equal(summary.drafted.length, 0);
  assert.equal(summary.skipped.length, 1);
  assert.equal(summary.skipped[0].reason, 'stale');
  assert.equal(summary.needsAttention.length, 1);
  assert.equal(summary.needsAttention[0].jobCard, 'J03073213');
});

test('runAgentLoopPass keeps going when one request fails', async () => {
  const bad = { ...DEERE_REQUEST, id: 'req-bad', job_card_number: 'J03079999' };
  const { deps } = makeDeps({
    requests: [bad, DEERE_REQUEST],
    now: WED_1000,
    scheduleRows: {},
  });
  deps.writeDraft = async (request, draft) => {
    if (request.id === 'req-bad') throw new Error('Supabase is down');
  };
  const summary = await runAgentLoopPass(deps);
  assert.equal(summary.errors.length, 1);
  assert.equal(summary.errors[0].jobCard, 'J03079999');
  assert.equal(summary.drafted.length, 1);
  assert.equal(summary.drafted[0].jobCard, 'J03073211');
});
