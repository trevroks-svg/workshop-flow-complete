// Workflow test harness: a real Express server mounting the app's real routes
// (agent loop, job schedule, AI routes) against an in-memory fake Supabase,
// plus a stage machine that mirrors the UI's status gates exactly as the
// frontend enforces them (see src/pages/PartsRequestForm.jsx and
// src/pages/RequestDetail.jsx).
// Nothing here touches Trevor's live Supabase project.
import express from 'express';
import runAgentLoop, {
  getAgentLoopStatus,
  listAgentLoopDrafts,
} from '../routes/agentLoop.js';
import {
  importJobSchedule,
  matchJobSchedule,
  jobScheduleStatus,
  resetStoredSchedule,
} from '../routes/jobSchedule.js';
import analyseRepairs from '../routes/analyseRepairs.js';
import generateAdvisorSms from '../routes/generateAdvisorSms.js';
import generateRecommendation from '../routes/generateRecommendation.js';
import { createMemoryStore } from '../lib/agentLoopStore.js';

export function createHarnessServer({ fake, store, now, businessId, cronSecret }) {
  const app = express();
  app.use(express.json());
  app.locals.agentLoop = { supabase: fake, store, now, businessId };
  app.post('/api/job-schedule/import', importJobSchedule);
  app.get('/api/job-schedule/match', matchJobSchedule);
  app.get('/api/job-schedule/status', jobScheduleStatus);
  app.post('/api/agent-loop/run', runAgentLoop);
  app.get('/api/agent-loop/status', getAgentLoopStatus);
  app.get('/api/agent-loop/drafts', listAgentLoopDrafts);
  app.post('/api/ai/analyse-repairs', analyseRepairs);
  app.post('/api/ai/generate-advisor-sms', generateAdvisorSms);
  app.post('/api/ai/generate-recommendation', generateRecommendation);
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      resolve({ app, server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

export function newMemoryStore() {
  return createMemoryStore();
}

// ---------------------------------------------------------------------------
// Stage machine — mirrors the UI gates. Each function returns
// { ok: true, request } or { ok: false, error } and mutates the fake row.
// ---------------------------------------------------------------------------
let requestCounter = 0;

export function technicianSubmit(fake, input, nowIso) {
  // Gates from PartsRequestForm.jsx: job card required, at least one part,
  // tyre size required for tyre orders, description required for 'other'.
  if (!input.job_card_number) {
    return { ok: false, stage: 'technician_submit', error: 'Job card number is required' };
  }
  if (!input.parts || input.parts.length === 0) {
    return { ok: false, stage: 'technician_submit', error: 'At least one part is required' };
  }
  for (const p of input.parts) {
    if (p.type === 'tyres' && !p.tyre_size) {
      return { ok: false, stage: 'technician_submit', error: 'Tyre size is required for tyre orders' };
    }
    if (p.type === 'other' && !p.description) {
      return { ok: false, stage: 'technician_submit', error: 'Description is required for Other parts' };
    }
  }
  requestCounter += 1;
  const request = {
    id: `wf-req-${String(requestCounter).padStart(3, '0')}`,
    business_id: input.business_id || 'biz-1',
    job_card_number: input.job_card_number,
    vehicle_type: input.vehicle_type || null,
    rego: input.rego || null,
    customer_name: input.customer_name || null,
    parts: input.parts,
    tyre_tread_depths: input.tyre_tread_depths || null,
    status: 'sent_to_parts',
    action_required: 'parts_interpreter',
    quote_pdf_text: null,
    parts_eta_selection: null,
    is_archived: false,
    wc_completed: false,
    labour_lines: [],
    labour_time_selection: null,
    labour_custom_hours: null,
    parts_interpreter_notes: input.parts_interpreter_notes || null,
    advisor_sms_draft: input.advisor_sms_draft || null,
    recommendation_text: null,
    created_by: 'test.technician@fmgauto.com.au',
    created_at: nowIso,
    updated_at: nowIso,
    audit_log: [{ action: 'Request created and sent to parts', by: 'test.technician@fmgauto.com.au', at: nowIso }],
  };
  fake.tables.parts_requests.push(request);
  return { ok: true, request };
}

export function partsUploadQuote(fake, { request, pdfText, eta, extractionFailed, nowIso }) {
  // UI gate (RequestDetail.jsx): upload button only renders for
  // sent_to_parts; it requires an ETA selection first.
  if (request.status !== 'sent_to_parts') {
    return { ok: false, stage: 'parts_upload_quote', error: `Quote upload only available while status is sent_to_parts (is ${request.status})` };
  }
  if (!eta) {
    return { ok: false, stage: 'parts_upload_quote', error: 'Please select a parts ETA before uploading a quote' };
  }
  request.parts_eta_selection = eta;
  if (extractionFailed) {
    // UI catch: extraction failure is warn-only; status still becomes quoted.
    request._extraction_warning = 'PDF text extraction failed — quote attached without extracted text';
  } else {
    request.quote_pdf_text = pdfText;
  }
  request.status = 'quoted';
  request.action_required = 'workshop_controller';
  request.updated_at = nowIso;
  request.audit_log.push({ action: 'Quote attached and sent to workshop controller', by: 'test.parts@fmgauto.com.au', at: nowIso });
  return { ok: true, request };
}

export function controllerApprove(fake, { request, labourLines = [], labourTimeSelection = null, customHours = null, decision, notes = null, nowIso }) {
  // UI gate: approve buttons only render for status 'quoted'.
  if (request.status !== 'quoted') {
    return { ok: false, stage: 'controller_approve', error: `Controller approval only available while status is quoted (is ${request.status})` };
  }
  // UI gate: labourIsValid = all labour lines have finite hours, OR a labour
  // time selection exists (and 'other' needs custom hours).
  const linesValid = labourLines.length > 0 && labourLines.every((l) => Number.isFinite(l.hours));
  const selectionValid =
    labourTimeSelection &&
    (labourTimeSelection !== 'other' || (customHours != null && Number.isFinite(customHours) && customHours > 0));
  if (!linesValid && !selectionValid) {
    return { ok: false, stage: 'controller_approve', error: 'Controller approval blocked: no valid labour time (no labour lines and no labour time selection)' };
  }
  request.labour_lines = labourLines;
  request.labour_time_selection = labourTimeSelection;
  request.labour_custom_hours = customHours;
  if (notes) request.controller_notes = notes;
  if (decision === 'immediate') {
    request.status = 'sent_to_advisor';
    request.action_required = 'advisor';
    request.approval_action = 'immediate';
    request.audit_log.push({ action: 'Workshop controller approved upsell', by: 'test.wc@fmgauto.com.au', at: nowIso });
  } else if (decision === 'recommendation') {
    request.status = 'advisor_action_required';
    request.action_required = 'advisor';
    request.approval_action = 'recommendation';
    request.audit_log.push({ action: 'Workshop controller approved as recommendation', by: 'test.wc@fmgauto.com.au', at: nowIso });
  } else {
    return { ok: false, stage: 'controller_approve', error: `Unknown controller decision: ${decision}` };
  }
  request.updated_at = nowIso;
  return { ok: true, request };
}

export function advisorMarkSent(fake, { request, nowIso }) {
  // UI gate: button renders on sent_to_advisor only when an SMS draft exists.
  if (request.status !== 'sent_to_advisor') {
    return { ok: false, stage: 'advisor_mark_sent', error: `Mark as Sent to Customer only available while status is sent_to_advisor (is ${request.status})` };
  }
  if (!request.advisor_sms_draft) {
    return { ok: false, stage: 'advisor_mark_sent', error: 'No SMS draft to send — button is hidden until a draft exists' };
  }
  request.status = 'sent_to_customer';
  request.action_required = 'customer';
  request.updated_at = nowIso;
  request.audit_log.push({ action: 'Sent to customer', by: 'test.advisor@fmgauto.com.au', at: nowIso });
  return { ok: true, request };
}

export function advisorAddRecommendation(fake, { request, nowIso }) {
  // UI gate: button renders on advisor_action_required only when a note exists.
  if (request.status !== 'advisor_action_required') {
    return { ok: false, stage: 'advisor_add_recommendation', error: `Add to Recommendations only available while status is advisor_action_required (is ${request.status})` };
  }
  if (!request.recommendation_text) {
    return { ok: false, stage: 'advisor_add_recommendation', error: 'No recommendation text to add — button is hidden until a note exists' };
  }
  request.status = 'recommendation_added';
  request.action_required = null;
  request.updated_at = nowIso;
  request.audit_log.push({ action: 'Added to recommendations', by: 'test.advisor@fmgauto.com.au', at: nowIso });
  return { ok: true, request };
}

export function customerDecision(fake, { request, decision, nowIso }) {
  if (request.status !== 'sent_to_customer') {
    return { ok: false, stage: 'customer_decision', error: `Customer decision only available while status is sent_to_customer (is ${request.status})` };
  }
  request.status = decision === 'approved' ? 'customer_approved' : 'customer_denied';
  request.action_required = null;
  request.updated_at = nowIso;
  request.audit_log.push({ action: decision === 'approved' ? 'Customer approved' : 'Customer denied', by: 'customer', at: nowIso });
  return { ok: true, request };
}

export { resetStoredSchedule };
