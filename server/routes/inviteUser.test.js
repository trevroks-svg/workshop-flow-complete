/**
 * server/routes/inviteUser.test.js
 *
 * Tests for server/routes/inviteUser.js — POST /api/invite-user.
 *
 * Two layers:
 * 1. Unit tests: call the handler directly with a fake service-role client
 *    injected via req.app.locals.auth (same override pattern as
 *    req.app.locals.agentLoop / requireAuth).
 * 2. Integration tests: a real Express app wired exactly like server/index.js
 *    — the route behind requireAuth + requireRoles('admin', 'super_admin')
 *    — proving a technician is blocked, an admin gets through, and a
 *    signed-in user with no staff role never reaches the handler.
 *
 * Nothing here touches a real Supabase project: the Auth Admin API and the
 * users-table lookup are always fakes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import inviteUser from './inviteUser.js';
import requireAuth, { requireRoles } from '../middleware/requireAuth.js';

function fakeAuthClient(validToken = 'valid-token') {
  return {
    auth: {
      async getUser(token) {
        if (token === validToken) {
          return { data: { user: { id: 'admin-1', email: 'admin@example.com' } }, error: null };
        }
        return { data: { user: null }, error: new Error('Invalid token') };
      },
    },
  };
}

/**
 * Fake service-role client: answers the users-table duplicate check and
 * records inviteUserByEmail calls.
 */
function fakeAdminClient({ existingEmails = [], inviteError = null } = {}) {
  const invites = [];
  return {
    invites,
    from() {
      const state = { email: null };
      const q = {
        select() { return q; },
        eq(col, val) { if (col === 'email') state.email = val; return q; },
        async maybeSingle() {
          if (existingEmails.includes(state.email)) {
            return { data: { id: 'user-existing' }, error: null };
          }
          return { data: null, error: null };
        },
      };
      return q;
    },
    auth: {
      admin: {
        async inviteUserByEmail(email, options) {
          if (inviteError) return { data: { user: null }, error: inviteError };
          invites.push({ email, options });
          return { data: { user: { id: 'user-invited', email } }, error: null };
        },
      },
    },
  };
}

function callHandler({ body = {}, adminClient = fakeAdminClient(), user = { id: 'admin-1', staff_role: 'admin', business_id: 'biz-1' } } = {}) {
  return new Promise(resolve => {
    const req = { body, user, app: { locals: { auth: { adminClient } } } };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ status: this.statusCode, data }); },
    };
    inviteUser(req, res);
  });
}

test('invite-user sends the invite and returns the new user id', async () => {
  const adminClient = fakeAdminClient();
  const result = await callHandler({
    adminClient,
    body: { email: '  New.User@Example.com ', business_id: 'biz-1' },
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.ok, true);
  assert.equal(result.data.email, 'new.user@example.com');
  assert.equal(result.data.user_id, 'user-invited');
  assert.equal(adminClient.invites.length, 1);
  assert.equal(adminClient.invites[0].email, 'new.user@example.com');
  assert.deepEqual(adminClient.invites[0].options.data, { business_id: 'biz-1' });
});

test('invite-user stores a supplied staff role in the invite metadata', async () => {
  const adminClient = fakeAdminClient();
  const result = await callHandler({
    adminClient,
    body: { email: 'tech@example.com', business_id: 'biz-1', staff_role: 'technician' },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(adminClient.invites[0].options.data, { business_id: 'biz-1', staff_role: 'technician' });
});

test('invite-user prefers the inviting admin business over the body value', async () => {
  const adminClient = fakeAdminClient();
  await callHandler({
    adminClient,
    body: { email: 'tech@example.com', business_id: 'biz-other' },
    user: { id: 'admin-1', staff_role: 'admin', business_id: 'biz-1' },
  });
  assert.deepEqual(adminClient.invites[0].options.data, { business_id: 'biz-1' });
});

test('invite-user rejects a missing or malformed email with 400', async () => {
  for (const bad of [undefined, '', '   ', 'not-an-email', 'a@b', '@example.com', 42]) {
    const result = await callHandler({ body: { email: bad } });
    assert.equal(result.status, 400, `email ${JSON.stringify(bad)} should 400`);
  }
});

test('invite-user rejects an invalid staff role with 400', async () => {
  const adminClient = fakeAdminClient();
  const result = await callHandler({
    adminClient,
    body: { email: 'tech@example.com', staff_role: 'superuser' },
  });
  assert.equal(result.status, 400);
  assert.equal(adminClient.invites.length, 0);
});

test('invite-user rejects an already-registered email with 409', async () => {
  const adminClient = fakeAdminClient({ existingEmails: ['taken@example.com'] });
  const result = await callHandler({
    adminClient,
    body: { email: 'taken@example.com' },
  });
  assert.equal(result.status, 409);
  assert.match(result.data.error, /already registered/i);
  assert.equal(adminClient.invites.length, 0);
});

test('invite-user maps the Auth API already-registered error to 409', async () => {
  const adminClient = fakeAdminClient({ inviteError: new Error('User already registered') });
  const result = await callHandler({
    adminClient,
    body: { email: 'taken@example.com' },
  });
  assert.equal(result.status, 409);
});

test('invite-user answers 500 when the invite itself fails', async () => {
  const adminClient = fakeAdminClient({ inviteError: new Error('SMTP is down') });
  const result = await callHandler({
    adminClient,
    body: { email: 'tech@example.com' },
  });
  assert.equal(result.status, 500);
  assert.match(result.data.error, /failed to send invitation/i);
});

test('invite-user answers 503 when the service-role key is not configured', async () => {
  const savedUrl = process.env.SUPABASE_URL;
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const req = {
      body: { email: 'tech@example.com' },
      user: { id: 'admin-1', staff_role: 'admin', business_id: 'biz-1' },
      app: { locals: { auth: {} } },
    };
    const result = await new Promise(resolve => {
      const res = {
        status(code) { this.statusCode = code; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
      };
      inviteUser(req, res);
    });
    assert.equal(result.status, 503);
  } finally {
    if (savedUrl !== undefined) process.env.SUPABASE_URL = savedUrl;
    if (savedKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  }
});

// ── Integration: wiring as in server/index.js ─────────────────────────────────

async function withTestServer(fn, { profile = { id: 'admin-1', staff_role: 'admin', business_id: 'biz-1' } } = {}) {
  const adminClient = fakeAdminClient();
  const app = express();
  app.use(express.json());
  app.locals.auth = {
    authClient: fakeAuthClient(),
    getUserProfile: async () => profile,
    adminClient,
  };
  app.post(
    '/api/invite-user',
    requireAuth,
    requireRoles('admin', 'super_admin'),
    inviteUser,
  );

  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base, adminClient);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('integration: invite-user 401s without a token', async () => {
  await withTestServer(async base => {
    const res = await fetch(`${base}/api/invite-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tech@example.com' }),
    });
    assert.equal(res.status, 401);
  });
});

test('integration: a technician is blocked from inviting with 403', async () => {
  await withTestServer(async (base, adminClient) => {
    const res = await fetch(`${base}/api/invite-user`, {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tech@example.com' }),
    });
    assert.equal(res.status, 403);
    assert.equal(adminClient.invites.length, 0);
  }, { profile: { id: 'user-2', staff_role: 'technician', business_id: 'biz-1' } });
});

test('integration: a signed-in user with no staff role never reaches the handler', async () => {
  await withTestServer(async (base, adminClient) => {
    const res = await fetch(`${base}/api/invite-user`, {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tech@example.com' }),
    });
    assert.equal(res.status, 403);
    assert.equal(adminClient.invites.length, 0);
  }, { profile: null });
});

test('integration: an admin invite succeeds end to end', async () => {
  await withTestServer(async (base, adminClient) => {
    const res = await fetch(`${base}/api/invite-user`, {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tech@example.com', business_id: 'biz-1' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.invited, true);
    assert.equal(body.email, 'tech@example.com');
    assert.equal(adminClient.invites.length, 1);
  });
});
