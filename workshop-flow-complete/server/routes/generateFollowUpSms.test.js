import test from 'node:test';
import assert from 'node:assert/strict';
import generateFollowUpSms, { buildPrompt } from './generateFollowUpSms.js';

const validPayload = {
  customerName: 'Test Customer',
  vehicle: 'Toyota Corolla',
  jobCard: 'J31782306',
  status: 'declined',
  declineDate: '1 July 2026',
  declinedWork: [
    {
      repairName: 'Air Filter',
      parts: ['Air Filter AF-1087 x1'],
      partsCostExGst: 18.5,
      labourHours: 0.5,
      labourRate: 190,
      totalIncGst: 115.35, // parts $18.50 ex GST ($20.35 inc) + 0.5h labour at $190 inc GST ($95)
    },
  ],
  totalIncGst: 115.35,
};

function callRoute(body, { openaiClient } = {}) {
  return new Promise(resolve => {
    const req = {
      body,
      app: openaiClient ? { locals: { openaiClient } } : { locals: {} },
    };
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

    generateFollowUpSms(req, res);
  });
}

test('generate-follow-up-sms returns smsText for a valid payload', async () => {
  const openaiClient = {
    responses: {
      create: async () => ({ output_text: 'Hi Test Customer, follow-up SMS text.' }),
    },
  };

  const response = await callRoute(validPayload, { openaiClient });

  assert.equal(response.status, 200);
  assert.equal(response.data.success, true);
  assert.equal(response.data.smsText, 'Hi Test Customer, follow-up SMS text.');
});

test('generate-follow-up-sms reports missing OPENAI_API_KEY', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const response = await callRoute(validPayload);

    assert.equal(response.status, 500);
    assert.equal(response.data.success, false);
    assert.equal(response.data.error, 'OPENAI_API_KEY is not configured');
  } finally {
    if (originalKey == null) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test('generate-follow-up-sms rejects malformed payloads', async () => {
  const response = await callRoute({ ...validPayload, declinedWork: [{ parts: [] }] });

  assert.equal(response.status, 400);
  assert.equal(response.data.success, false);
  assert.match(response.data.error, /declinedWork/);
});

test('generate-follow-up-sms returns fallback-safe failure response when OpenAI fails', async () => {
  const openaiClient = {
    responses: {
      create: async () => {
        throw new Error('mock OpenAI failure');
      },
    },
  };

  const response = await callRoute(validPayload, { openaiClient });

  assert.equal(response.status, 500);
  assert.equal(response.data.success, false);
  assert.equal(response.data.error, 'mock OpenAI failure');
  assert.equal(response.data.smsText, undefined);
});

test('generate-follow-up-sms charges labour inc GST and returns plain-ASCII text', async () => {
  let capturedPrompt = '';
  const openaiClient = {
    responses: {
      create: async ({ input }) => {
        capturedPrompt = input;
        return { output_text: 'Hi — it’s a follow-up…' };
      },
    },
  };

  const response = await callRoute(validPayload, { openaiClient });

  assert.equal(response.status, 200);
  assert.equal(response.data.smsText, `Hi - it's a follow-up...`);
  assert.equal(buildPrompt(validPayload).includes('0.5h @ $190/h inc GST'), true);
});
