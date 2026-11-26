import test from 'node:test';
import assert from 'node:assert/strict';
import createCheckoutSession from './createCheckoutSession.js';

function callRoute(body) {
  return new Promise(resolve => {
    const req = { body };
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
    createCheckoutSession(req, res);
  });
}

test('create-checkout-session reports missing STRIPE_SECRET_KEY', async () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;

  try {
    const response = await callRoute({ business_name: 'Test', email: 'test@example.com' });
    assert.equal(response.status, 500);
    assert.equal(response.data.error, 'STRIPE_SECRET_KEY is not configured');
  } finally {
    if (originalKey == null) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  }
});
