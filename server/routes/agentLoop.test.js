import test from 'node:test';
import assert from 'node:assert/strict';
import runAgentLoop, { getAgentLoopStatus, listAgentLoopDrafts } from './agentLoop.js';
import { createMemoryStore } from '../lib/agentLoopStore.js';

// Wed 25 Nov 2026, 10:00 ACDT — inside workshop hours.
const WED_1000 = new Date('2026-11-24T23:30:00Z');
const WED_0630 = new Date('2026-11-24T20:00:00Z'); // 06:30 ACDT — before open

const DEERE_PDF = [
  'PARTS QUOTATION',
  'Description Part Number Qty Unit Price (ex GST) GST Total (inc GST)',
  'ELEMENT SUB-ASSY 1780151020 1 $74.02 $7.40 $81.42',
  'CABIN FILTER 87139YZZ25 1 $80.85 $8.09 $88.94',
  'Subtotal (ex GST): $154.87',
  'GST (10%): $15.49',
  'TOTAL (inc GST): $170.36',
].join(' ');

function createFakeSupabase({ requests = [], businesses = [] } = {}) {
  const updates = [];
  return {
    updates,
    requests,
    from(table) {
      const state = { table, op: 'select', values: null, eqCol: null, eqVal: undefined };
      const q = {
        select() { return q; },
        in() { return q; },
        eq(col, val) { state.eqCol = col; state.eqVal = val; return q; },
        order() { return q; },
        limit() { return q; },
        update(values) {
          state.op = 'update';
          state.values = values;
          return q;
        },
        maybeSingle: async () => ({ data: null, error: null }),
        then(resolve) {
          if (state.op === 'update') {
            for (const row of requests) {
              if (row[state.eqCol] === state.eqVal) {
                Object.assign(row, state.values);
                updates.push({ id: row.id, values: state.values });
              }
            }
            return resolve({ data: null, error: null });
          }
          if (table === 'parts_requests') return resolve({ data: requests, error: null });
          if (table === 'businesses') return resolve({ data: businesses, error: null });
          return resolve({ data: [], error: null });
        },
      };
      return q;
    },
  };
}

function callRoute(handler, { headers = {}, locals = {} } = {}) {
  return new Promise(resolve => {
    const req = { headers, app: { locals } };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        resolve({ status: this.statusCode, data });
      },
    };
    handler(req, res);
  });
}

function deereRequest() {
  return {
    id: 'req-deere',
    job_card_number: 'J03073211',
    status: 'sent_to_advisor',
    parts: [{ part_type: 'air_filter', quantity: 1 }, { part_type: 'pollen_filter', quantity: 1 }],
    quote_pdf_text: DEERE_PDF,
    updated_at: '2026-11-25T00:00:00Z',
    created_at: '2026-11-25T00:00:00Z',
  };
}

test('POST /api/agent-loop/run drafts an SMS and writes it to the request', async () => {
  const requests = [deereRequest()];
  const supabase = createFakeSupabase({ requests });
  const store = createMemoryStore();
  const response = await callRoute(runAgentLoop, {
    locals: {
      agentLoop: {
        supabase,
        store,
        now: WED_1000,
        getScheduleRow: () => ({ jobCard: 'J03073211', owner: 'Mr Oliver Deere', modelDescription: 'Landcruiser Wagon GXL' }),
      },
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.data.success, true);
  assert.equal(response.data.ran, true);
  assert.equal(response.data.drafted.length, 1);
  assert.equal(response.data.drafted[0].quoteTotalIncGst, 170.36);
  assert.equal(supabase.updates.length, 1);
  assert.match(requests[0].advisor_sms_draft, /Total: \$170\.36 inc GST/);
  assert.equal(requests[0].customer_name, 'Mr Oliver Deere');
  assert.equal(await store.isSeen(response.data.drafted[0].requestId + ':sent_to_advisor:2026-11-25T00:00:00Z'), true);
});

test('POST /api/agent-loop/run does nothing outside workshop hours', async () => {
  const supabase = createFakeSupabase({ requests: [deereRequest()] });
  const response = await callRoute(runAgentLoop, {
    locals: { agentLoop: { supabase, store: createMemoryStore(), now: WED_0630 } },
  });
  assert.equal(response.status, 200);
  assert.equal(response.data.ran, false);
  assert.equal(response.data.reason, 'outside_workshop_hours');
  assert.equal(supabase.updates.length, 0);
});

test('POST /api/agent-loop/run enforces CRON_SECRET when set', async () => {
  process.env.CRON_SECRET = 'test-secret';
  try {
    const denied = await callRoute(runAgentLoop, {
      locals: { agentLoop: { supabase: createFakeSupabase(), store: createMemoryStore(), now: WED_1000 } },
    });
    assert.equal(denied.status, 403);

    const allowed = await callRoute(runAgentLoop, {
      headers: { 'x-cron-secret': 'test-secret' },
      locals: { agentLoop: { supabase: createFakeSupabase({ requests: [] }), store: createMemoryStore(), now: WED_1000 } },
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.data.ran, true);
  } finally {
    delete process.env.CRON_SECRET;
  }
});

test('GET /api/agent-loop/status reports hours, store and schedule state', async () => {
  const response = await callRoute(getAgentLoopStatus, {
    locals: { agentLoop: { store: createMemoryStore(), now: WED_1000 } },
  });
  assert.equal(response.status, 200);
  assert.equal(response.data.inWorkshopHours, true);
  assert.equal(response.data.storeBackend, 'memory');
  assert.equal(response.data.pollMinutes, 5);
  assert.equal(response.data.scheduleLoaded, false);
  assert.equal(response.data.openaiConfigured, false);
});

test('GET /api/agent-loop/drafts lists pending drafts and resolved ones', async () => {
  const requests = [deereRequest()];
  const supabase = createFakeSupabase({ requests });
  const store = createMemoryStore();
  const locals = {
    agentLoop: {
      supabase,
      store,
      now: WED_1000,
      getScheduleRow: () => null,
    },
  };

  await callRoute(runAgentLoop, { locals });

  const pending = await callRoute(listAgentLoopDrafts, { locals });
  assert.equal(pending.status, 200);
  assert.equal(pending.data.pending.length, 1);
  assert.equal(pending.data.pending[0].draftType, 'sms');
  assert.equal(pending.data.pending[0].currentStatus, 'sent_to_advisor');
  assert.match(pending.data.pending[0].draftText, /Total: \$170\.36 inc GST/);
  assert.equal(pending.data.resolved.length, 0);

  // Trevor approves in the app: the request moves to sent_to_customer.
  requests[0].status = 'sent_to_customer';
  const after = await callRoute(listAgentLoopDrafts, { locals });
  assert.equal(after.data.pending.length, 0);
  assert.equal(after.data.resolved.length, 1);
});
