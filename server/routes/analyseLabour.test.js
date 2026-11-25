import test from 'node:test';
import assert from 'node:assert/strict';
import analyseLabour from './analyseLabour.js';

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
    analyseLabour(req, res);
  });
}

test('analyse-labour returns the raw model text for the caller to parse', async () => {
  const openaiClient = {
    responses: {
      create: async () => ({
        output_text: '{"lines": [{"part_label": "Tyres", "hours": 1, "notes": "Fit four tyres"}]}',
      }),
    },
  };

  const response = await callRoute({ prompt: 'Analyse labour.' }, { openaiClient });

  assert.equal(response.status, 200);
  assert.equal(response.data.success, true);
  assert.equal(JSON.parse(response.data.text).lines[0].hours, 1);
});

test('analyse-labour reports missing OPENAI_API_KEY', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const response = await callRoute({ prompt: 'Analyse labour.' });
    assert.equal(response.status, 500);
    assert.equal(response.data.error, 'OPENAI_API_KEY is not configured');
  } finally {
    if (originalKey == null) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test('analyse-labour rejects a missing prompt', async () => {
  const response = await callRoute({});
  assert.equal(response.status, 400);
  assert.match(response.data.error, /prompt/);
});
