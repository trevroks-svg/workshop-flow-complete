import test from 'node:test';
import assert from 'node:assert/strict';
import generateAdvisorSms from './generateAdvisorSms.js';

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
    generateAdvisorSms(req, res);
  });
}

test('generate-advisor-sms returns sanitised plain-ASCII smsText', async () => {
  const openaiClient = {
    responses: {
      create: async () => ({ output_text: 'Hi Jo — it’s ready, “tyres fitted”.' }),
    },
  };

  const response = await callRoute({ prompt: 'Generate an SMS.' }, { openaiClient });

  assert.equal(response.status, 200);
  assert.equal(response.data.success, true);
  assert.equal(response.data.smsText, `Hi Jo - it's ready, "tyres fitted".`);
});

test('generate-advisor-sms reports missing OPENAI_API_KEY', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const response = await callRoute({ prompt: 'Generate an SMS.' });
    assert.equal(response.status, 500);
    assert.equal(response.data.error, 'OPENAI_API_KEY is not configured');
  } finally {
    if (originalKey == null) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test('generate-advisor-sms rejects a missing prompt', async () => {
  const response = await callRoute({});
  assert.equal(response.status, 400);
  assert.match(response.data.error, /prompt/);
});

test('generate-advisor-sms returns a failure response when OpenAI fails', async () => {
  const openaiClient = {
    responses: {
      create: async () => {
        throw new Error('mock OpenAI failure');
      },
    },
  };

  const response = await callRoute({ prompt: 'Generate an SMS.' }, { openaiClient });
  assert.equal(response.status, 500);
  assert.equal(response.data.error, 'mock OpenAI failure');
});
