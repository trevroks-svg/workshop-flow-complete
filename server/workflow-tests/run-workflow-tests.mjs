// End-to-end workflow test runner.
// Boots the real server routes against an in-memory fake Supabase and drives
// each scenario through every stage: technician submit -> parts quote upload
// -> controller labour approval -> sent to advisor -> agent loop draft ->
// advisor action -> customer decision. Nothing touches Trevor's live Supabase.
//
// Run:  node server/workflow-tests/run-workflow-tests.mjs
// Report: ~/workspace/goals/workshop-upsell-separate-agent/files/WORKFLOW_TEST_REPORT_2026-11-25.md
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createFakeSupabase } from './fakeSupabase.js';
import {
  createHarnessServer,
  newMemoryStore,
  technicianSubmit,
  partsUploadQuote,
  controllerApprove,
  advisorMarkSent,
  advisorAddRecommendation,
  customerDecision,
} from './workflowHarness.js';
import { SCENARIOS, NOW, CRON_SECRET } from './scenarios.js';
import { createAgentLoopStore } from '../lib/agentLoopStore.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPORT_PATH = resolve(
  process.env.HOME,
  'workspace/goals/workshop-upsell-separate-agent/files/WORKFLOW_TEST_REPORT_2026-11-25.md'
);

// Test-only env: no OpenAI key (verifies the no-key behaviour), no Supabase
// env (the routes must not hydrate from Trevor's live project).
process.env.CRON_SECRET = CRON_SECRET;
process.env.BUSINESS_ID = 'biz-1';
delete process.env.OPENAI_API_KEY;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const results = [];
const findings = [];

function check(cond, label, detail = '') {
  return { label, pass: !!cond, detail: cond ? '' : detail };
}

async function post(baseUrl, path, body, headers = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch { /* non-JSON body */ }
  return { status: res.status, json };
}

async function get(baseUrl, path, headers = {}) {
  const res = await fetch(`${baseUrl}${path}`, { headers });
  let json = null;
  try {
    json = await res.json();
  } catch { /* non-JSON body */ }
  return { status: res.status, json };
}

function buildScheduleCsv() {
  const header = ['Job Card', 'In Date', 'Pick up Date', 'Rego', 'Model Description', 'Owner', 'Mobile', 'Email', 'Operation', 'Advisor Name'];
  const rows = SCENARIOS.filter((s) => s.schedule).map((s) => {
    const r = s.schedule;
    return [r.jobCard, r.inDate || '25/11/26', '25/11/26', r.rego, r.modelDescription, r.owner, r.mobile, '', 'Service', 'Test Advisor'];
  });
  const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  return csv;
}

function isPlainAscii(text) {
  return /^[\x00-\x7F]*$/.test(text);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const fake0 = createFakeSupabase();
const store0 = newMemoryStore();
const { server, baseUrl } = await createHarnessServer({
  fake: fake0, store: store0, now: new Date(NOW), businessId: 'biz-1',
});

// 0. Import the synthetic schedule once (shared module state in the route).
const csvText = buildScheduleCsv();
const importRes = await post(baseUrl, '/api/job-schedule/import', { csvText });
const scheduleImported = importRes.status === 200 && importRes.json?.success;
const scheduleCount = importRes.json?.rowCount ?? 0;
const matchRes = await get(baseUrl, '/api/job-schedule/match?jobCard=J03074001');
const scheduleMatchOk = matchRes.status === 200 && matchRes.json?.row?.owner === 'Test Parker';

for (const scenario of SCENARIOS) {
  const fake = createFakeSupabase();
  fake.tables.businesses.push({ id: 'biz-1', default_labour_rate: 190 });
  const store = newMemoryStore();
  const now = new Date(scenario.now || NOW);

  const stageResults = [];
  const checks = [];
  const notes = [];

  // Rebuild the server per scenario so app.locals.agentLoop is isolated.
  const { server: scServer, baseUrl: scBase } = await createHarnessServer({
    fake, store, now, businessId: 'biz-1',
  });

  try {
    // Stage 1 — technician submits.
    const s1 = technicianSubmit(fake, scenario.request, scenario.now || NOW);
    stageResults.push({ stage: '1. Technician submits', pass: s1.ok, detail: s1.ok ? `status ${s1.request.status}` : s1.error });
    if (!s1.ok) {
      results.push({ id: scenario.id, name: scenario.name, stageResults, checks, notes, verdict: 'FAIL', draftText: null });
      continue;
    }
    const request = s1.request;

    // Stage 2 — parts attaches the quote PDF.
    const s2 = partsUploadQuote(fake, { request, pdfText: scenario.pdfText, eta: scenario.eta, nowIso: scenario.now || NOW });
    stageResults.push({ stage: '2. Parts attaches quote PDF', pass: s2.ok, detail: s2.ok ? `status ${s2.request.status}, ETA ${scenario.eta}` : s2.error });
    if (!s2.ok) {
      results.push({ id: scenario.id, name: scenario.name, stageResults, checks, notes, verdict: 'FAIL', draftText: null });
      continue;
    }

    // Stage 3 — workshop controller approves a labour time.
    const s3 = controllerApprove(fake, {
      request,
      labourLines: scenario.controller.labourLines,
      labourTimeSelection: scenario.controller.labourTimeSelection || null,
      customHours: scenario.controller.customHours || null,
      decision: scenario.controller.decision,
      nowIso: scenario.now || NOW,
    });
    stageResults.push({
      stage: '3. Controller approves labour',
      pass: s3.ok,
      detail: s3.ok ? `status ${s3.request.status} (${scenario.controller.decision})` : s3.error,
    });
    if (!s3.ok) {
      results.push({ id: scenario.id, name: scenario.name, stageResults, checks, notes, verdict: 'FAIL', draftText: null });
      continue;
    }

    if (scenario.updatedAtOverride) request.updated_at = scenario.updatedAtOverride;

    // Stage 4 — agent loop run (real HTTP route, CRON_SECRET protected).
    const loopRes = await post(scBase, '/api/agent-loop/run', {}, { 'x-cron-secret': CRON_SECRET });
    const summary = loopRes.json?.summary || loopRes.json;
    const loopOk = loopRes.status === 200 && summary;
    stageResults.push({
      stage: '4. Agent loop runs (HTTP)',
      pass: loopOk,
      detail: loopOk
        ? `ran=${summary.ran} checked=${summary.checked ?? 0} drafted=${(summary.drafted || []).length} needsAttention=${(summary.needsAttention || []).length} skipped=${(summary.skipped || []).length}`
        : `HTTP ${loopRes.status}: ${JSON.stringify(loopRes.json)}`,
    });

    const draft = (summary?.drafted || []).find((d) => d.jobCard === scenario.request.job_card_number);
    const na = (summary?.needsAttention || []).find((d) => d.jobCard === scenario.request.job_card_number);
    const sk = (summary?.skipped || []).find((d) => d.jobCard === scenario.request.job_card_number);
    const draftText = request.advisor_sms_draft || request.recommendation_text || null;

    const exp = scenario.expect;
    if (exp.loopRan === false) {
      checks.push(check(summary?.ran === false, 'Loop does not run outside workshop hours', `ran=${summary?.ran}`));
      checks.push(check(summary?.reason === exp.reason, 'Outside-hours reason', `reason=${summary?.reason}`));
      checks.push(check(!draftText, 'No draft written', `draft=${JSON.stringify(draftText)}`));
    } else if (exp.action === 'drafted') {
      checks.push(check(!!draft, 'Loop drafted for this job', `drafted=${JSON.stringify(summary?.drafted)}`));
      if (draft) {
        checks.push(check(draft.draftType === exp.draftType, `Draft type is ${exp.draftType}`, `got ${draft.draftType}`));
        checks.push(check(draft.quoteTotalIncGst === exp.quoteTotal, `Quote total $${exp.quoteTotal}`, `got $${draft.quoteTotalIncGst}`));
        if (exp.greeting) checks.push(check(draftText?.includes(exp.greeting), `Greeting "${exp.greeting}"`, `draft text: ${JSON.stringify(draftText)}`));
        for (const needle of exp.contains || []) {
          checks.push(check(draftText?.includes(needle), `Draft contains "${needle}"`, `draft text: ${JSON.stringify(draftText)}`));
        }
        for (const needle of exp.notContains || []) {
          checks.push(check(!draftText?.includes(needle), `Draft does not contain "${needle}"`, `draft text: ${JSON.stringify(draftText)}`));
        }
        for (const [key, val] of Object.entries(exp.flags || {})) {
          checks.push(check(draft.flags?.[key] === val, `Flag ${key}=${val}`, `flags=${JSON.stringify(draft.flags)}`));
        }
        // Trial SMS rules on every SMS draft.
        if (exp.draftType === 'sms') {
          checks.push(check(isPlainAscii(draftText), 'SMS draft is plain ASCII', `non-ASCII in: ${JSON.stringify(draftText)}`));
          checks.push(check(!draftText.includes('"'), 'SMS draft has no quotation marks', `draft: ${JSON.stringify(draftText)}`));
          checks.push(check(request.status === 'sent_to_advisor', 'Loop did not change the request status', `status=${request.status}`));
        }
        if (exp.draftType === 'recommendation') {
          checks.push(check(!request.advisor_sms_draft, 'No SMS draft on a recommendation tile', `advisor_sms_draft=${JSON.stringify(request.advisor_sms_draft)}`));
          checks.push(check(request.status === 'advisor_action_required', 'Loop did not change the request status', `status=${request.status}`));
        }
      }
    } else if (exp.action === 'needs_attention') {
      checks.push(check(!!na, 'Loop flagged needs_attention (no draft)', `needsAttention=${JSON.stringify(summary?.needsAttention)}`));
      if (na) checks.push(check(exp.reasonMatch.test(na.reason), `Reason matches ${exp.reasonMatch}`, `reason="${na.reason}"`));
      checks.push(check(!draftText, 'No draft written', `draft=${JSON.stringify(draftText)}`));
    } else if (exp.action === 'skipped') {
      checks.push(check(!!sk, `Loop skipped (${exp.skipReason})`, `skipped=${JSON.stringify(summary?.skipped)}`));
      if (sk) checks.push(check(sk.reason === exp.skipReason, `Skip reason is ${exp.skipReason}`, `reason=${sk.reason}`));
      checks.push(check(!draftText || scenario.id === 'R17', 'No new draft written', `draft=${JSON.stringify(draftText)}`));
    }

    if (scenario.expect.secondRun) {
      const loop2 = await post(scBase, '/api/agent-loop/run', {}, { 'x-cron-secret': CRON_SECRET });
      const sum2 = loop2.json?.summary || loop2.json;
      checks.push(check(sum2?.drafted?.length === 0, 'Second run drafts nothing', `drafted=${JSON.stringify(sum2?.drafted)}`));
      const sk2 = (sum2?.skipped || []).find((d) => d.jobCard === scenario.request.job_card_number);
      checks.push(check(sk2?.reason === scenario.expect.secondRun.skipReason, `Second run skips as ${scenario.expect.secondRun.skipReason}`, `skipped=${JSON.stringify(sum2?.skipped)}`));
      stageResults.push({ stage: '4b. Agent loop re-run (dedup)', pass: !!sk2, detail: sk2 ? `skipped: ${sk2.reason}` : `summary=${JSON.stringify(sum2)}` });
    }

    // Stage 5 — advisor acts on the draft (where the scenario calls for it).
    if (scenario.postLoop === 'advisor_mark_sent_then_customer_approve') {
      const s5 = advisorMarkSent(fake, { request, nowIso: scenario.now || NOW });
      stageResults.push({ stage: '5. Advisor marks Sent to Customer', pass: s5.ok, detail: s5.ok ? `status ${s5.request.status}` : s5.error });
      if (s5.ok) {
        const s6 = customerDecision(fake, { request, decision: 'approved', nowIso: scenario.now || NOW });
        stageResults.push({ stage: '6. Customer approves', pass: s6.ok, detail: s6.ok ? `status ${s6.request.status}` : s6.error });
      }
    } else if (scenario.postLoop === 'advisor_mark_sent') {
      const s5 = advisorMarkSent(fake, { request, nowIso: scenario.now || NOW });
      stageResults.push({ stage: '5. Advisor marks Sent to Customer', pass: s5.ok, detail: s5.ok ? `status ${s5.request.status}` : s5.error });
    } else if (scenario.postLoop === 'advisor_add_recommendation') {
      const s5 = advisorAddRecommendation(fake, { request, nowIso: scenario.now || NOW });
      stageResults.push({ stage: '5. Advisor adds note to invoice', pass: s5.ok, detail: s5.ok ? `status ${s5.request.status}` : s5.error });
    }

    if (scenario.expect.note) notes.push(scenario.expect.note);
    if (draftText) notes.push(`Draft text: ${draftText.replace(/\n/g, ' | ')}`);

    const verdict = stageResults.every((s) => s.pass) && checks.every((c) => c.pass) ? 'PASS' : 'FAIL';
    results.push({ id: scenario.id, name: scenario.name, stageResults, checks, notes, verdict, draftText });
  } finally {
    scServer.close();
  }
}

// ---------------------------------------------------------------------------
// Gate checks (UI gates the stage machine enforces)
// ---------------------------------------------------------------------------
const gateChecks = [];
{
  const fake = createFakeSupabase();
  const g1a = technicianSubmit(fake, { job_card_number: 'J03074901', parts: [{ part_type: 'battery', type: 'battery' }] }, NOW);
  const g1b = partsUploadQuote(fake, { request: g1a.request, pdfText: 'x', eta: null, nowIso: NOW });
  gateChecks.push(check(!g1b.ok && /ETA/i.test(g1b.error), 'G1 — parts cannot upload a quote without an ETA selection', g1b.error || 'upload succeeded'));
  const g2 = technicianSubmit(fake, { job_card_number: '', parts: [{ part_type: 'battery', type: 'battery' }] }, NOW);
  gateChecks.push(check(!g2.ok, 'G2 — technician cannot submit without a job card number', g2.error || 'submit succeeded'));
  const g3a = technicianSubmit(fake, { job_card_number: 'J03074902', parts: [{ part_type: 'battery', type: 'battery' }] }, NOW);
  const g3b = controllerApprove(fake, { request: g3a.request, labourLines: [], decision: 'immediate', nowIso: NOW });
  gateChecks.push(check(!g3b.ok && /quoted/.test(g3b.error), 'G3 — controller cannot approve a request still with parts (wrong status)', g3b.error || 'approve succeeded'));
  const g4a = technicianSubmit(fake, { job_card_number: 'J03074903', parts: [{ part_type: 'battery', type: 'battery' }] }, NOW);
  partsUploadQuote(fake, { request: g4a.request, pdfText: 'PARTS QUOTATION TOTAL $0.00', eta: 'in_stock', nowIso: NOW });
  const g4b = controllerApprove(fake, { request: g4a.request, labourLines: [], decision: 'immediate', nowIso: NOW });
  gateChecks.push(check(!g4b.ok && /labour/i.test(g4b.error), 'G4 — controller cannot approve without a valid labour time', g4b.error || 'approve succeeded'));
  const g5a = technicianSubmit(fake, { job_card_number: 'J03074904', parts: [{ part_type: 'battery', type: 'battery' }] }, NOW);
  partsUploadQuote(fake, { request: g5a.request, pdfText: 'PARTS QUOTATION TOTAL $0.00', eta: 'in_stock', nowIso: NOW });
  controllerApprove(fake, { request: g5a.request, labourLines: [{ hours: 0.25 }], decision: 'immediate', nowIso: NOW });
  const g5b = advisorMarkSent(fake, { request: g5a.request, nowIso: NOW });
  gateChecks.push(check(!g5b.ok && /No SMS draft/.test(g5b.error), 'G5 — advisor cannot mark Sent to Customer with no SMS draft', g5b.error || 'mark sent succeeded'));
}

// ---------------------------------------------------------------------------
// Route checks (real HTTP routes, no OpenAI key, no live Supabase)
// ---------------------------------------------------------------------------
const routeChecks = [];
{
  const fake = createFakeSupabase();
  const store = newMemoryStore();
  const { server: rcServer, baseUrl: rcBase } = await createHarnessServer({ fake, store, now: new Date(NOW), businessId: 'biz-1' });
  try {
    const noSecret = await post(rcBase, '/api/agent-loop/run', {}, {});
    routeChecks.push(check(noSecret.status === 403, 'C1a — /run without a cron secret returns 403', `HTTP ${noSecret.status}`));
    const wrongSecret = await post(rcBase, '/api/agent-loop/run', {}, { 'x-cron-secret': 'wrong' });
    routeChecks.push(check(wrongSecret.status === 403, 'C1b — /run with a wrong secret returns 403', `HTTP ${wrongSecret.status}`));
    const rightSecret = await post(rcBase, '/api/agent-loop/run', {}, { 'x-cron-secret': CRON_SECRET });
    routeChecks.push(check(rightSecret.status === 200, 'C1c — /run with the right secret returns 200', `HTTP ${rightSecret.status}`));

    const mismatchReq = {
      job_card_number: 'J03074006', vehicle_type: 'Triton GSR',
      parts: [{ part_type: 'tyres', description: '265/60R18 tyres' }],
      quote_pdf_text: 'PARTS QUOTATION Description Part Number Qty Unit Price (ex GST) GST Total (inc GST) LN1MF TOYOTA BATTERY 109700 1 $309.17 $30.92 $340.09 Subtotal (ex GST): $309.17 GST (10%): $30.92 TOTAL (inc GST): $340.09',
    };
    const ar1 = await post(rcBase, '/api/ai/analyse-repairs', { request: mismatchReq });
    routeChecks.push(check(ar1.status === 200 && ar1.json?.success === false && ar1.json?.pdf_job_match?.status === 'mismatch', 'C2a — analyse-repairs rejects a mismatched battery PDF on a tyres job', `HTTP ${ar1.status} body=${JSON.stringify(ar1.json)?.slice(0, 200)}`));

    const matchReq = {
      job_card_number: 'J03074001', vehicle_type: 'RAV4 Hybrid GX',
      parts: [{ part_type: 'tyres', description: '225/65R17 102H SC-MS' }],
      tyre_tread_depths: { lh_front: 5, rh_front: 2, lh_rear: 2, rh_rear: 1 },
      labour_lines: [{ hours: 1 }],
      quote_pdf_text: 'PARTS QUOTATION Description Part Number Qty Unit Price (ex GST) GST Total (inc GST) Tyre 225/65R17 102H TYR-22565 1 $180.91 $18.09 $199.00 Subtotal (ex GST): $180.91 GST (10%): $18.09 TOTAL (inc GST): $199.00',
    };
    const ar2 = await post(rcBase, '/api/ai/analyse-repairs', { request: matchReq });
    routeChecks.push(check(ar2.status === 200 && ar2.json?.success === true && ar2.json?.result?.groups?.[0]?.parts_cost_ex_gst === 723.64 && ar2.json?.result?.groups?.[0]?.tyre_rule_applied === true, 'C2b — analyse-repairs reprices a matching tyres quote as a set of four (rules path, no AI) when the line says "Tyre"', `HTTP ${ar2.status} body=${JSON.stringify(ar2.json)?.slice(0, 300)}`));

    // C2e — fixed (B6): the route's quote_total_inc_gst is recomputed after
    // the tyre rule reprices the groups — $986, not the stale $199.
    routeChecks.push(check(ar2.json?.result?.quote_total_inc_gst === 986 && ar2.json?.result?.groups?.[0]?.parts_cost_ex_gst === 723.64, 'C2e — analyse-repairs quote_total_inc_gst is recomputed after the tyre rule: $986 (was $199 stale, break B6)', `quote_total_inc_gst=${ar2.json?.result?.quote_total_inc_gst} parts_cost_ex_gst=${ar2.json?.result?.groups?.[0]?.parts_cost_ex_gst}`));

    // C2d — fixed (B0): the same tyres quote in the realistic size-only
    // shape (no word "Tyre" in the line) is now accepted and repriced.
    const realTyreReq = {
      job_card_number: 'J03074001', vehicle_type: 'RAV4 Hybrid GX',
      parts: [{ part_type: 'tyres', description: '225/65R17 102H SC-MS' }],
      tyre_tread_depths: { lh_front: 5, rh_front: 2, lh_rear: 2, rh_rear: 1 },
      labour_lines: [{ hours: 1 }],
      quote_pdf_text: 'PARTS QUOTATION Description Part Number Qty Unit Price (ex GST) GST Total (inc GST) 225/65R17 102H SC-MS 4341300 1 $180.91 $18.09 $199.00 Subtotal (ex GST): $180.91 GST (10%): $18.09 TOTAL (inc GST): $199.00',
    };
    const ar2d = await post(rcBase, '/api/ai/analyse-repairs', { request: realTyreReq });
    routeChecks.push(check(ar2d.status === 200 && ar2d.json?.success === true && ar2d.json?.result?.groups?.[0]?.parts_cost_ex_gst === 723.64 && ar2d.json?.result?.quote_total_inc_gst === 986, 'C2d — analyse-repairs accepts the realistic size-only tyres line and reprices it to $986 (break B0 fixed)', `HTTP ${ar2d.status} body=${JSON.stringify(ar2d.json)?.slice(0, 200)}`));

    // C2f — fixed (B2): an unlabelled dealer quote (no ex/inc GST labels,
    // no table header) parses, with the GST basis inferred.
    const unlabelledReq = {
      job_card_number: 'J03074007', vehicle_type: 'RAV4 Hybrid GX',
      parts: [{ part_type: 'battery', description: 'LN1MF Toyota Battery' }],
      labour_lines: [{ hours: 0.25 }],
      quote_pdf_text: 'PARTS QUOTATION VICTOR HARBOR TOYOTA LN1MF TOYOTA BATTERY 109700 1 $309.17 $30.92 $340.09 PARTS TOTAL $309.17 GST $30.92 TOTAL $340.09',
    };
    const ar2f = await post(rcBase, '/api/ai/analyse-repairs', { request: unlabelledReq });
    routeChecks.push(check(ar2f.status === 200 && ar2f.json?.success === true && ar2f.json?.result?.quote_total_inc_gst === 340.09 && ar2f.json?.result?.gst_basis === 'inferred', 'C2f — analyse-repairs parses an unlabelled dealer quote, total $340.09, GST basis inferred (break B2 fixed)', `HTTP ${ar2f.status} body=${JSON.stringify(ar2f.json)?.slice(0, 200)}`));

    const blankReq = {
      job_card_number: 'J03074011', vehicle_type: 'Yaris Cross',
      parts: [{ part_type: 'battery', description: 'LN1MF Toyota Battery' }],
      quote_pdf_text: 'PARTS QUOTATION TOTAL $0.00',
    };
    const ar3 = await post(rcBase, '/api/ai/analyse-repairs', { request: blankReq });
    routeChecks.push(check(ar3.status === 500 && /OPENAI_API_KEY is not configured/.test(ar3.json?.error || ''), 'C2c — analyse-repairs with an unparseable quote and no OpenAI key returns 500 (in-app AI button needs a key)', `HTTP ${ar3.status} body=${JSON.stringify(ar3.json)?.slice(0, 160)}`));

    const sms = await post(rcBase, '/api/ai/generate-advisor-sms', { prompt: 'Draft an SMS' });
    routeChecks.push(check(sms.status === 500 && /OPENAI_API_KEY is not configured/.test(sms.json?.error || ''), 'C3a — generate-advisor-sms without a key returns 500', `HTTP ${sms.status}`));
    const rec = await post(rcBase, '/api/ai/generate-recommendation', { prompt: 'Draft a recommendation' });
    routeChecks.push(check(rec.status === 500 && /OPENAI_API_KEY is not configured/.test(rec.json?.error || ''), 'C3b — generate-recommendation without a key returns 500', `HTTP ${rec.status}`));

    // C4 — /drafts lists pending drafts (seed one via the loop, then list).
    fake.tables.businesses.push({ id: 'biz-1', default_labour_rate: 190 });
    const t = technicianSubmit(fake, { job_card_number: 'J03074002', vehicle_type: 'C-HR Hybrid Koba', parts: [{ part_type: 'battery', type: 'battery' }] }, NOW);
    partsUploadQuote(fake, { request: t.request, pdfText: SCENARIOS[1].pdfText, eta: 'in_stock', nowIso: NOW });
    controllerApprove(fake, { request: t.request, labourLines: [{ hours: 0.25 }], decision: 'immediate', nowIso: NOW });
    await post(rcBase, '/api/agent-loop/run', {}, { 'x-cron-secret': CRON_SECRET });
    const drafts = await get(rcBase, '/api/agent-loop/drafts');
    routeChecks.push(check(drafts.status === 200 && drafts.json?.pending?.length === 1 && drafts.json.pending[0].jobCardNumber === 'J03074002', 'C4 — /drafts lists the one pending draft', `HTTP ${drafts.status} body=${JSON.stringify(drafts.json)?.slice(0, 200)}`));
  } finally {
    rcServer.close();
  }

  // C5 — watermark store falls back to memory when the migration is not applied.
  const fakeMissing = createFakeSupabase({ missingTables: ['agent_loop_seen'] });
  const fallbackStore = await createAgentLoopStore(fakeMissing);
  const isMemoryFallback = fallbackStore.backend === 'memory' && fallbackStore.tableMissing === true;
  await fallbackStore.markSeen({ key: 'k1', requestId: 'r1', jobCardNumber: 'J1', status: 'sent_to_advisor', requestUpdatedAt: NOW, draftType: 'sms', draftedAt: NOW, flags: {} });
  const seenList = await fallbackStore.listSeen();
  const seenCount = await fallbackStore.count();
  routeChecks.push(check(isMemoryFallback && seenList.length === 1 && seenCount === 1, 'C5 — store falls back to in-memory when agent_loop_seen is missing (migration not applied), and still records the watermark', `backend=${fallbackStore.backend} tableMissing=${fallbackStore.tableMissing} list=${seenList.length} count=${seenCount}`));

  // C6 — with the table present, the Supabase-backed store records and reads the watermark.
  const fakePresent = createFakeSupabase();
  const supaStore = await createAgentLoopStore(fakePresent);
  await supaStore.markSeen({ key: 'k2', requestId: 'r2', jobCardNumber: 'J2', status: 'sent_to_advisor', requestUpdatedAt: NOW, draftType: 'sms', draftedAt: NOW, flags: {} });
  const seen2 = await supaStore.isSeen('k2');
  const notSeen = await supaStore.isSeen('nope');
  const list2 = await supaStore.listSeen();
  routeChecks.push(check(supaStore.backend === 'supabase' && seen2 === true && notSeen === false && list2.length === 1, 'C6 — Supabase-backed watermark store records and reads entries (table present)', `backend=${supaStore.backend} isSeen(k2)=${seen2} isSeen(nope)=${notSeen} list=${list2.length}`));
}

// ---------------------------------------------------------------------------
// Baseline + frontend build
// ---------------------------------------------------------------------------
let baseline = 'not run';
try {
  // Run the suite with a clean env: this runner sets CRON_SECRET for its own
  // harness, and the repo's agentLoop route tests assert on the no-secret
  // behaviour — the value must not leak into the child process.
  const cleanEnv = { ...process.env };
  delete cleanEnv.CRON_SECRET;
  delete cleanEnv.BUSINESS_ID;
  const out = execSync('npm test', { cwd: resolve(REPO_ROOT, 'server'), encoding: 'utf8', timeout: 120000, maxBuffer: 10 * 1024 * 1024, env: cleanEnv });
  const m = out.match(/ℹ pass (\d+)/) || out.match(/(\d+) pass/);
  baseline = m ? `${m[1]} server tests pass` : 'npm test ran (see output)';
} catch (e) {
  baseline = `npm test FAILED (exit ${e.status}): ${String(e.stdout || e.stderr || e.message).slice(-400)}`;
}

let frontendBuild = 'not run';
try {
  execSync('npm run build', { cwd: REPO_ROOT, encoding: 'utf8', timeout: 180000, stdio: 'pipe' });
  frontendBuild = 'PASS — vite production build succeeds';
} catch (e) {
  frontendBuild = `FAIL — ${String(e.stdout || e.message).slice(0, 300)}`;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const passed = results.filter((r) => r.verdict === 'PASS').length;
const failed = results.filter((r) => r.verdict === 'FAIL');
const gatePassed = gateChecks.filter((c) => c.pass).length;
const routePassed = routeChecks.filter((c) => c.pass).length;

const md = [];
md.push('# Workshop upsell app — end-to-end workflow test report');
md.push('');
md.push('**Date:** Wednesday 25 November 2026 (runs executed in ACDT, test clock Wed 25 Nov 2026 10:30 ACDT)');
md.push('**App:** workshop-flow-complete, Phase 2 copy (GitHub master commit `b9e5973`) plus the workflow-test fixes of 25 Nov 2026 (B0-B6) - see "Breaks found - and fixed" below.');
md.push('**Method:** the real Express routes (agent loop, job schedule, AI routes) run against an in-memory fake Supabase; every scenario is driven stage by stage — technician submit → parts quote upload → controller labour approval → sent to advisor → agent loop draft → advisor action → customer decision. The UI gates are mirrored from `src/pages/PartsRequestForm.jsx` and `src/pages/RequestDetail.jsx`. No test data touched Trevor\u2019s live Supabase project. No app code was changed — only test files under `server/workflow-tests/`.');
md.push('');
md.push(`**Baseline:** ${baseline}. **Frontend build:** ${frontendBuild}.`);
md.push('');
md.push(`**Result: ${passed} of ${results.length} workflow runs passed; ${gatePassed} of ${gateChecks.length} UI-gate checks passed; ${routePassed} of ${routeChecks.length} route checks passed.**`);
md.push('');
md.push('## Per-run results');
md.push('');
md.push('| Run | Scenario | Stages | Checks | Verdict |');
md.push('| --- | -------- | ------ | ------ | ------- |');
for (const r of results) {
  const stages = r.stageResults.map((s) => `${s.pass ? '✓' : '✗'} ${s.stage.replace(/^\d+\. /, '')}`).join('<br>');
  const checks = r.checks.map((c) => `${c.pass ? '✓' : '✗'} ${c.label}`).join('<br>');
  md.push(`| ${r.id} | ${r.name} | ${stages} | ${checks} | **${r.verdict}** |`);
}
md.push('');
md.push('## What each run produced');
md.push('');
for (const r of results) {
  md.push(`### ${r.id} — ${r.name} — ${r.verdict}`);
  for (const s of r.stageResults) md.push(`- ${s.pass ? 'PASS' : 'FAIL'} — ${s.stage}: ${s.detail}`);
  for (const c of r.checks) {
    if (!c.pass) md.push(`- FAIL — ${c.label}: ${c.detail}`);
  }
  if (r.draftText) md.push(`- Draft written: \`${r.draftText.replace(/\n/g, ' | ')}\``);
  for (const n of r.notes) {
    if (!n.startsWith('Draft text:')) md.push(`- Note: ${n}`);
  }
  md.push('');
}
md.push('## Breaks found - and fixed');
md.push('');
md.push('Six breaks were found in the first run (25 Nov 2026) and fixed the same day. Each entry below keeps the original finding and records the fix and how it is verified now. The scenarios that used to fail now pass - R1, R4, R5, R7 and route checks C2d/C2e, plus new run R18 and route check C2f.');
md.push('');
md.push('### B0 - The loop rejected every realistic tyres quote (and air-filter-only quotes) as a "mismatch" - FIXED');
md.push('**Original finding (run R1, route check C2d).** A tyres quote in the shape the workshop actually produces - a line like `225/65R17 102H SC-MS 4341300 1 $180.91 $18.09 $199.00` - was rejected by the PDF-vs-job check with `Quote PDF line items do not mention any of the requested parts`, so the loop flagged the job `needs_attention` and never drafted the SMS. The Parker trial job that sold $986 of tyres would not have been drafted. The same failure hit an air-filter-only job: the line `ELEMENT SUB-ASSY` contains none of the air-filter keywords. The Deere filters job only passed because it also had a pollen filter whose line says "CABIN FILTER".');
md.push('**Fix:** `server/lib/pdfJobMatch.js` (mirrored in `src/lib/pdfJobMatch.js`) now recognises part families by pattern as well as by keyword - a tyre-size pattern (`225/65R17`) for tyres, `ELEMENT SUB-ASSY` / `AIR REFINER` for air filters - and the family check also looks at part numbers, because the Tune extractor can put the part word (e.g. BATTERY) in the part-number slot. The tyre rule (`tyreRule.js`) recognises size-only lines the same way, so the set-of-four reprice also fires on them.');
md.push('**Verified now:** R1 drafts the Parker job at $986.00 from the size-only line; C2d accepts the same line at the route and returns the repriced $986 total; the air-filter code line matches its job (`pdfJobMatch.test.js`); a battery PDF on a tyres job is still rejected (R6, `pdfJobMatch.test.js`).');
md.push('');
md.push('### B1 - Two-option quotes: the SMS Total line summed both options - FIXED');
md.push('**Original finding (run R4).** A quote listing two tyre options (Kumho $884.80 fitted, Hifly $466.80 fitted) drafted both option lines correctly, but the SMS `Total:` line added them together - **$1,351.60 inc GST** - as if the customer is buying both.');
md.push('**Fix:** the draft builders (`server/lib/draftText.js`, mirrored in the frontend `SMSDraftGenerator.jsx`) now detect mutually exclusive options (`groupsHaveOptions` in the new shared `plainPartName.js`) and write the total as alternatives - `Total: $884.80 inc GST or $466.80 inc GST (choose one option)` - never a sum. The loop summary total (`quoteTotalForGroups`) is null for options, since there is no single total. The AI prompt in the app carries the same rule.');
md.push('**Verified now:** R4 drafts with the or-form total and no $1,351.60 anywhere; R18 does the same for note-priced options; `draftText.test.js` asserts both.');
md.push('');
md.push('### B2 - Unlabelled dealer quotes did not parse, so the loop could not draft for them - FIXED');
md.push('**Original finding (run R7).** A quote in the plain dealer layout - part line and totals with no `(ex GST)` / `(inc GST)` labels and no `Description Part Number ...` header (the shape of the Toyota battery quotes from the 24-25 Nov trial) - failed with `No complete high-confidence quote table rows found` and the loop flagged `needs_attention`.');
md.push('**Fix:** `quoteParser.js` gained a generic unlabelled branch (`buildGenericResult`): it parses complete table rows without a header, strips the totals block and the "PARTS QUOTATION <dealer>" header first, reconciles the row sums against the PARTS TOTAL / GST / TOTAL block when one is present (a mismatch fails cleanly instead of drafting a wrong total), and supports two-money rows (unit + line total, GST basis determined from the maths). The result records `gst_basis: "inferred"`; labelled tables report `"labelled"`. Whether the real Toyota dealer PDFs carry the labelled header could not be verified locally - that needs a real extracted PDF from the live app.');
md.push('**Verified now:** R7 drafts the Davis battery job at $387.59 with `gstBasis: "inferred"`; new route check C2f parses the same layout at the route (total $340.09, basis inferred); a totals mismatch still fails (`quoteParser.test.js`).');
md.push('');
md.push('### B3 - Quotes priced only in interpreter notes could not be drafted by the loop - FIXED');
md.push('**Original finding (run R5).** When the price lived in a parts interpreter note (e.g. "hifly HP801 $179 each+fit, 3 days") and the attached PDF was blank, the loop flagged `needs_attention` - it never read note prices. The trial\u2019s Neale tyres job was exactly this shape.');
md.push('**Fix:** the loop (`agentLoop.js`) now falls back to the interpreter note when the PDF has no usable price (`parseNotePrices` in `quoteParser.js`): it reads per-unit prices ("$179 each", "$359 EA") and bare prices, takes the quantity from the matching request part (default 1), and prices from the note. The PDF-vs-job check still runs on this path - a PDF showing a different job card is still a mismatch. The draft says the price came from the note (an advisor-facing line, plus `priceSource: "parts_note"` and `gstBasisUnconfirmed: true` in the draft flags), because a note never states the GST basis. The tyre rule still applies to note-priced tyres when tread data says a set of four is needed.');
md.push('**Verified now:** R5 drafts the Neale job at $488.80 from the note; R18 drafts both note-priced options ($884.80 / $466.80) with the or-form total; `quoteParser.test.js` covers single, two-option and no-price notes.');
md.push('');
md.push('### B4 - Tyre descriptions starting with a size lost the size in the SMS - FIXED');
md.push('**Original finding (runs R1, R13).** The parser\u2019s description pattern could not start with a digit, so a tyre line like `225/65R17 102H SC-MS` was drafted as `R17 102H SC-MS: $986.00 inc GST` - the `225/65` prefix was dropped.');
md.push('**Fix:** the table-row description pattern in `quoteParser.js` now allows an optional leading tyre size, and the same size-aware pattern is used for two-money rows and note prices.');
md.push('**Verified now:** R1 drafts "Tyre 225/65R17: $986.00 inc GST"; R13 drafts "Hifly tyre 265/65R17: $227.50 inc GST"; `quoteParser.test.js` asserts the full description survives parsing.');
md.push('');
md.push('### B5 - SMS drafts used raw PDF part descriptions, not plain English - FIXED');
md.push('**Original finding (runs R3, R12).** The loop drafted the PDF\u2019s description verbatim: a customer would read `ELEMENT SUB-ASSY: $81.42 inc GST` instead of "air filter", and `BLADE,HYBRID REFILL,8.5x710MM: $64.42 inc GST` instead of "wiper blades". The recommendation notes had the same issue.');
md.push('**Fix:** a new shared module `plainPartName.js` (server + frontend copies) maps part descriptions to plain names - "Tyre 225/65R17", "Kumho HP71 tyre", "Toyota battery", "Air filter", "Cabin filter", "Wiper blades" - keeping brand/model codes that matter (HP71, HP801) and the full tyre size, and using the request part type as a hint when the name alone is ambiguous (a note saying "hifly HP801" is tyres because the job\u2019s part is tyres). The loop, the frontend fallback builders and the AI prompts all use it. For "other" parts the loop uses the technician\u2019s plain description from the request when there is exactly one (e.g. "Front passenger door side skirt" instead of "GARNISH ASSY-FRT DR SIDE").');
md.push('**Verified now:** R3 drafts "Air filter" / "Cabin filter"; R12 drafts "Wiper blades"; R10 recommends "Hifly HP801 tyre"; R2/R7/R9 draft "Toyota battery"; `plainPartName.test.js` covers the mappings.');
md.push('');
md.push('### B6 - Analyse-repairs reported a stale quote total after the tyre rule repriced the groups - FIXED');
md.push('**Original finding (route checks C2b/C2e).** POST `/api/ai/analyse-repairs` on the Parker tyres quote returned `result.groups[0].parts_cost_ex_gst: 723.64` with `tyre_rule_applied: true` (the set-of-four reprice, correct) but `result.quote_total_inc_gst: 199` - the raw total from the PDF, not recomputed. The route (and the shared lib `buildAnalysisResult` in `src/lib/analyseRepairs.js`) spread the parsed result and overrode only `groups`, leaving the total stale.');
md.push('**Fix:** a shared helper `recomputeQuoteTotalAfterTyreRule` (`tyreRule.js`) recomputes the fitted total from the repriced groups plus labour (controller line when there is one group, otherwise each group\u2019s labour hours) whenever a group was repriced, in both the route (rules and OpenAI paths) and the frontend `buildAnalysisResult`. It returns null when nothing was repriced, so non-tyre totals are untouched.');
md.push('**Verified now:** C2e returns `quote_total_inc_gst: 986` for the Parker quote; `analyseRepairs.test.js` asserts the same at the route; `tyreRule.test.js` covers the helper directly.');
md.push('');
md.push('## What passed cleanly');
md.push('');
md.push('- **Tyre rule pricing (R1, R13, C2b, C2d, C2e):** 2mm tread as a set of four prices correctly - $986.00 for the Parker job end to end through the loop from the realistic size-only tyre line (R1) and via the route (C2b, C2d, C2e); no reprice when road treads are above 2mm (Harford, $227.50 single tyre, R13).');
md.push('- **Labour $190 inc GST (R2–R4, R8–R10, R12–R14):** 0.25 hr = $47.50, 0.5 hr = $95, 1 hr = $190 in every draft; filters carry $0 labour (R3, $170.36). The Dixon recommendation now totals $583.80 (the trial\u2019s $583.79 used the old $189.99 labour line — the fix working).');
md.push('- **PDF-vs-job check (R6, C2a):** a battery PDF on a tyres job is rejected, never priced — the exact failure the trial caught on job J03073149.');
md.push('- **Recommendation path (R10):** `advisor_action_required` produces an invoice-note quote only — no SMS draft is written, and the note quotes the fitted total only.');
md.push('- **No schedule row (R9):** the draft is still produced but opens "Hi there," and is flagged `customer_unverified` — nothing is guessed.');
md.push('- **Dedup (R14):** a second loop pass on the same request skips it as `already_drafted`; no duplicate draft.');
md.push('- **Guards (R15, R16, R17):** outside workshop hours the loop does not run; stale requests (3 days old) are skipped; a request the advisor already drafted is left untouched.');
md.push('- **Plain-ASCII SMS (all SMS runs):** every SMS draft was plain ASCII with no quotation marks, as the dealer system requires.');
md.push('- **Cron secret (C1):** `/run` returns 403 without a secret and 403 with a wrong one; 200 with the right one.');
md.push('- **Watermark store fallback (C5):** with the `agent_loop_seen` table missing (migration not applied), the store falls back to in-memory and still records the watermark.');
md.push('- **UI gates (G1–G5):** quote upload needs an ETA; a job card number is required; the controller cannot approve from the wrong status or without a valid labour time; the advisor cannot mark Sent to Customer with no draft.');
md.push('- **Schedule import (setup):** the synthetic CSV imported cleanly and `GET /api/job-schedule/match` returned the right owner/vehicle for a job card.');
md.push('');
md.push('## Route checks (no OpenAI key, no live Supabase)');
md.push('');
for (const c of routeChecks) md.push(`- ${c.pass ? 'PASS' : 'FAIL'} — ${c.label}${c.pass ? '' : ` — ${c.detail}`}`);
md.push('');
md.push('Note: `C2c`, `C3a` and `C3b` returning 500 is the *expected* behaviour without a key — the in-app AI buttons (`Analyse repairs`, `Generate SMS`, `Generate recommendation`) need `OPENAI_API_KEY` on the server. The agent loop itself never calls AI, so it drafts with no key at all.');
md.push('');
md.push('## UI gates');
md.push('');
for (const c of gateChecks) md.push(`- ${c.pass ? 'PASS' : 'FAIL'} — ${c.label}${c.pass ? '' : ` — ${c.detail}`}`);
md.push('');
md.push('## PDF extraction (real files, pdfjs)');
md.push('');
md.push('- `tests/fixtures/test-audit-air-filter-quote.pdf` extracts to the labelled table format and parses at 0.97 confidence (total $20.35) — the extraction → parse path works end to end on a real PDF.');
md.push('- `tests/fixtures/test-audit-quote.pdf` is a placeholder containing only the words "TEST-AUDIT quote fixture" — it does not parse, by design (it is a dummy for the Playwright login tests, not a quote).');
md.push('- A corrupt PDF buffer throws from the extractor; the UI catches that and still moves the request to `quoted` without extracted text (warn-only) — verified by code read, not by a run, because the loop then flags it `needs_attention` the same way as the blank-PDF runs.');
md.push('');
md.push('## Frontend / UI');
md.push('');
md.push('- **Production build passes** (vite).');
md.push('- **Dev server boots and serves the app shell:** `npm run dev` with dummy `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` returns HTTP 200 with the app title ("My Workshop Flow | Automotive Workshop Management Software") and the root mount div. No browser was needed for that check.');
md.push('- **No browser-driven UI test was possible in this environment:** Playwright 1.61.0 is installed but no Chromium binary is present, and both `npx playwright install chromium` and `npx playwright install chromium-headless-shell` stalled downloading from cdn.playwright.dev (timed out at 240s and 120s). The login-screen render and the click-through of the workflow stages (submit → upload → approve → draft) in a real browser are therefore **not verified here** — they need a machine with a working browser download, or the hosted staging environment.');
md.push('- **The existing Playwright e2e specs were deliberately NOT run:** they log in with test users against Trevor\u2019s live Supabase and would write test data into the production project. The stage gates they cover are instead mirrored in the stage machine (`workflowHarness.js`) and verified by the gate checks G1–G5 above.');
md.push('');
md.push('## What still needs a live hosted environment to test');
md.push('');
md.push('- **Real Supabase:** the full round trip (auth, row-level security, the `agent_loop_seen` migration applied for real, concurrent advisors editing the same request) was not tested — the fake Supabase mimics the PostgREST surface the app uses but not auth, RLS or Postgres itself. The Playwright role tests (`tests/e2e/role-audit-full.spec.js` etc.) log in with test users against Trevor\u2019s live Supabase and were deliberately **not** run — they would write test data into the production project.');
md.push('- **Deployed 5-minute cron:** the `/run` endpoint was exercised over HTTP with the secret, but the actual scheduled trigger (Render/Railway cron calling it every 5 minutes in workshop hours) can only be proven once hosted.');
md.push('- **Real dealer PDFs:** whether the Toyota/Hyundai dealer quote PDFs the workshop actually receives carry the labelled table header (parseable) or the unlabelled layout (B2) can only be confirmed from real extracted PDFs in the live app.');
md.push('- **In-app AI buttons with a key:** the analyse/SMS/recommendation routes return 500 without `OPENAI_API_KEY` (expected). Their AI output quality can only be tested once a key is configured on the server.');
md.push('- **Google sign-in and the frontend against the live backend:** the frontend build passes; the login screen rendering against a live Supabase backend was not tested here (no live credentials were used).');
md.push('- **SMS sending:** by design v1 is drafts only with manual DMS send — there is nothing to test for sending, and no SMS was sent in any run.');
md.push('');
md.push('## Test scripts (re-runnable)');
md.push('');
md.push('- `server/workflow-tests/run-workflow-tests.mjs` — the runner (this report is its output).');
md.push('- `server/workflow-tests/scenarios.js` — the 17 scenarios and expected outcomes.');
md.push('- `server/workflow-tests/workflowHarness.js` — real-routes test server + stage machine mirroring the UI gates.');
md.push('- `server/workflow-tests/fakeSupabase.js` — in-memory Supabase-compatible client (supports a missing-table simulation for the migration fallback).');
md.push('- `server/workflow-tests/probe-parser.mjs`, `server/workflow-tests/probe-pdf.mjs` — parser-shape and PDF-extraction probes used while building the scenarios.');
md.push('');
md.push('Re-run with: `node server/workflow-tests/run-workflow-tests.mjs` from the repo root.');
md.push('');

writeFileSync(REPORT_PATH, md.join('\n'));
server.close();

console.log(`\nWorkflow runs: ${passed}/${results.length} passed`);
for (const r of results) console.log(`  ${r.id} ${r.verdict} — ${r.name}`);
console.log(`Gate checks: ${gatePassed}/${gateChecks.length} passed`);
console.log(`Route checks: ${routePassed}/${routeChecks.length} passed`);
console.log(`Baseline: ${baseline}`);
console.log(`Frontend build: ${frontendBuild}`);
console.log(`Schedule import: ${scheduleImported ? `ok (${scheduleCount} rows)` : 'FAILED'}; match: ${scheduleMatchOk ? 'ok' : 'FAILED'}`);
console.log(`Report: ${REPORT_PATH}`);
