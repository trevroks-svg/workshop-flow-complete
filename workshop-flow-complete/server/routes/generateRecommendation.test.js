import test from 'node:test';
import assert from 'node:assert/strict';
import generateRecommendation from './generateRecommendation.js';

function callRoute(handler, body, { openaiClient } = {}) {
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
    handler(req, res);
  });
}

test('generate-recommendation returns sanitised plain-ASCII text', async () => {
  const openaiClient = {
    responses: {
      create: async () => ({ output_text: 'Recommend Tyres: $986.00 inc GST (fitted) — set of four.' }),
    },
  };

  const response = await callRoute(generateRecommendation, { prompt: 'Generate a recommendation.' }, { openaiClient });

  assert.equal(response.status, 200);
  assert.equal(response.data.success, true);
  assert.equal(response.data.text, 'Recommend Tyres: $986.00 inc GST (fitted) - set of four.');
});

test('generate-recommendation reports missing OPENAI_API_KEY and rejects a missing prompt', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const noKey = await callRoute(generateRecommendation, { prompt: 'Generate a recommendation.' });
    assert.equal(noKey.status, 500);
    assert.equal(noKey.data.error, 'OPENAI_API_KEY is not configured');
  } finally {
    if (originalKey == null) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }

  const noPrompt = await callRoute(generateRecommendation, {});
  assert.equal(noPrompt.status, 400);
  assert.match(noPrompt.data.error, /prompt/);
});
