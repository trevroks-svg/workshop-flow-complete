import test from 'node:test';
import assert from 'node:assert/strict';
import generateWorkshopText, { buildPrompt } from './generateWorkshopText.js';

function callRoute(body) {
  return new Promise(resolve => {
    const req = {
      body,
      app: { locals: { openaiClient: { responses: { create: async () => ({ output_text: 'Generated workshop text' }) } } } },
    };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ status: this.statusCode, data }); },
    };
    generateWorkshopText(req, res);
  });
}

test('generates SMS text through OpenAI', async () => {
  const response = await callRoute({
    type: 'sms', customerName: 'Sam', vehicle: 'Toyota', variant: 'standard',
    repairLines: '- Air Filter: $20.35 inc GST', totalIncGst: 20.35,
  });
  assert.equal(response.status, 200);
  assert.equal(response.data.text, 'Generated workshop text');
  assert.match(buildPrompt({ type: 'sms', repairLines: '- Air Filter', totalIncGst: 20.35 }), /reply YES/i);
});

test('includes completed structured pricing in the SMS prompt', () => {
  const prompt = buildPrompt({
    type: 'sms',
    variant: 'standard',
    repairLines: '- We recommend Battery: $364.29 inc GST',
    repairs: [{
      repairDescription: 'Battery',
      partsCostExGst: 309.17,
      labourHours: 0.2,
      labourRateExGst: 110,
      labourTotalExGst: 22,
      repairTotalExGst: 331.17,
      gst: 33.12,
      totalIncGst: 364.29,
    }],
    totalIncGst: 364.29,
  });

  assert.match(prompt, /"partsCostExGst":309\.17/);
  assert.match(prompt, /"labourTotalExGst":22/);
  assert.match(prompt, /"totalIncGst":364\.29/);
  assert.match(prompt, /do not recalculate/i);
});

test('generates recommendation text through OpenAI', async () => {
  const response = await callRoute({ type: 'recommendation', repairLines: 'Repair: Air Filter' });
  assert.equal(response.status, 200);
  assert.equal(response.data.text, 'Generated workshop text');
  assert.match(buildPrompt({ type: 'recommendation', repairLines: 'Repair: Air Filter' }), /invoice\/DMS/i);
});

test('rejects invalid workshop text requests', async () => {
  const response = await callRoute({ type: 'email', repairLines: 'Air Filter' });
  assert.equal(response.status, 400);
  assert.match(response.data.error, /type/);
});
