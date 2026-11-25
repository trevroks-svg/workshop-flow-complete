/**
 * server/middleware/requireAuth.test.js
 *
 * Tests for server/middleware/requireAuth.js — the session + staff-role
 * check that now guards every user-facing API route (see server/index.js).
 *
 * Two layers:
 * 1. Unit tests: call the middleware directly with fake clients injected
 *    via req.app.locals.auth (same override pattern as
 *    req.app.locals.agentLoop).
 * 2. Integration tests: a real Express app wired exactly like server/index.js
 *    — a protected route behind requireAuth, an admin-only route behind
 *    requireAuth + requireRoles, and POST /api/agent-loop/run WITHOUT
 *    either — proving the cron route still works with CRON_SECRET and is
 *    rejected without it, while protected routes 401 without a token and
 *    403 for a signed-in user with no staff role.
 *
 * Nothing here touches a real Supabase project: the auth client, the
 * profile lookup and the cron pass all run against fakes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import requireAuth, { requireRoles } from './requireAuth.js';
import runAgentLoop from '../routes/agentLoop.js';
import { createMemoryStore } from '../lib/agentLoopStore.js';

// Wed 25 Nov 2026, 10:00 ACDT — inside workshop hours.
const WED_1000 = new Date('2026-11-24T23:30:00Z');

function fakeAuthClient(validToken = 'valid-token') {
  return {
    auth: {
      async getUser(token) {
        if (token === validToken) {
          return { data: { user: { id: 'user-1', email: 'trev@example.com' } }, error: null };
        }
        return { data: { user: null }, error: new Error('Invalid token') };
      },
    },
  };
}

function profileFor(staffRole, businessId = 'biz-1') {
  if (staffRole === null) return null;
  return { id: 'user-1', staff_role: staffRole, business_id: businessId };
}

function callMiddleware({
  headers = {},
  authClient = fakeAuthClient(),
  getUserProfile = async () => profileFor('technician'),
} = {}) {
  return new Promise(resolve => {
    const req = { headers, app: { locals: { auth: { authClient, getUserProfile } } } };
    let nextCalled = false;
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ status: this.statusCode, data, nextCalled, user: req.user }); },
    };
    const next = () => { nextCalled = true; resolve({ status: null, data: null, nextCalled, user: req.user }); };
    requireAuth(req, res, next);
  });
}

test('requireAuth accepts a valid token and attaches req.user with staff role', async () => {
  const result = await callMiddleware({ headers: { authorization: 'Bearer valid-token' } });
  assert.equal(result.nextCalled, true);
  assert.deepEqual(result.user, {
    id: 'user-1',
    email: 'trev@example.com',
    staff_role: 'technician',
    business_id: 'biz-1',
  });
});

test('requireAuth rejects a missing token with 401', async () => {
  const result = await callMiddleware({ headers: {} });
  assert.equal(result.nextCalled, false);
  assert.equal(result.status, 401);
});

test('requireAuth rejects a non-Bearer Authorization header with 401', async () => {
  const result = await callMiddleware({ headers: { authorization: 'Token valid-token' } });
  assert.equal(result.nextCalled, false);
  assert.equal(result.status, 401);
});

test('requireAuth rejects an invalid token with 401', async () => {
  const result = await callMiddleware({ headers: { authorization: 'Bearer not-a-real-token' } });
  assert.equal(result.nextCalled, false);
  assert.equal(result.status, 401);
});

test('requireAuth rejects when getUser returns no user with 401', async () => {
  const emptyClient = { auth: { async getUser() { return { data: { user: null }, error: null }; } } };
  const result = await callMiddleware({
    headers: { authorization: 'Bearer valid-token' },
    authClient: emptyClient,
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.status, 401);
});

test('requireAuth answers 503 when no auth client is configured', async () => {
  const savedUrl = process.env.SUPABASE_URL;
  const savedKey = process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  try {
    const req = { headers: { authorization: 'Bearer valid-token' }, app: { locals: {} } };
    const result = await new Promise(resolve => {
      const res = {
        status(code) { this.statusCode = code; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
      };
      requireAuth(req, res, () => resolve({ status: null, data: null }));
    });
    assert.equal(result.status, 503);
  } finally {
    if (savedUrl !== undefined) process.env.SUPABASE_URL = savedUrl;
    if (savedKey !== undefined) process.env.SUPABASE_ANON_KEY = savedKey;
  }
});

// ── Staff-role check ─────────────────────────────────────────────────────────

test('requireAuth rejects a signed-in user with no profile row with 403', async () => {
  const result = await callMiddleware({
    headers: { authorization: 'Bearer valid-token' },
    getUserProfile: async () => null,
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.status, 403);
  assert.match(result.data.error, /no staff role/i);
});

test('requireAuth rejects a signed-in user with no staff_role with 403', async () => {
  const result = await callMiddleware({
    headers: { authorization: 'Bearer valid-token' },
    getUserProfile: async () => ({ id: 'user-1', staff_role: null, business_id: 'biz-1' }),
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.status, 403);
});

test('requireAuth rejects a staff_role outside the app role list with 403', async () => {
  const result = await callMiddleware({
    headers: { authorization: 'Bearer valid-token' },
    getUserProfile: async () => ({ id: 'user-1', staff_role: 'superuser', business_id: 'biz-1' }),
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.status, 403);
});

test('requireAuth accepts every role the app defines', async () => {
  for (const role of [
    'technician', 'parts_interpreter', 'workshop_controller',
    'service_advisor', 'service_manager', 'admin', 'super_admin',
  ]) {
    const result = await callMiddleware({
      headers: { authorization: 'Bearer valid-token' },
      getUserProfile: async () => profileFor(role),
    });
    assert.equal(result.nextCalled, true, `role ${role} should pass`);
    assert.equal(result.user.staff_role, role);
  }
});

test('requireAuth answers 503 when the role lookup throws', async () => {
  const result = await callMiddleware({
    headers: { authorization: 'Bearer valid-token' },
    getUserProfile: async () => { throw new Error('database down'); },
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.status, 503);
});

test('requireAuth answers 503 when the service-role key is not configured', async () => {
  const savedUrl = process.env.SUPABASE_URL;
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    // Valid token, but no profile override and no service-role client.
    const req = {
      headers: { authorization: 'Bearer valid-token' },
      app: { locals: { auth: { authClient: fakeAuthClient() } } },
    };
    const result = await new Promise(resolve => {
      const res = {
        status(code) { this.statusCode = code; return this; },
        json(data) { resolve({ status: this.statusCode, data }); },
      };
      requireAuth(req, res, () => resolve({ status: null, data: null }));
    });
    assert.equal(result.status, 503);
    assert.match(result.data.error, /role verification/i);
  } finally {
    if (savedUrl !== undefined) process.env.SUPABASE_URL = savedUrl;
    if (savedKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  }
});

// ── requireRoles ─────────────────────────────────────────────────────────────

function callRequireRoles(allowed, user) {
  return new Promise(resolve => {
    const req = { user };
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ status: this.statusCode, data }); },
    };
    requireRoles(...allowed)(req, res, () => resolve({ status: null }));
  });
}

test('requireRoles allows a listed role and blocks the rest', async () => {
  assert.equal((await callRequireRoles(['admin', 'super_admin'], { staff_role: 'admin' })).status, null);
  assert.equal((await callRequireRoles(['admin', 'super_admin'], { staff_role: 'super_admin' })).status, null);
  const blocked = await callRequireRoles(['admin', 'super_admin'], { staff_role: 'technician' });
  assert.equal(blocked.status, 403);
  const noUser = await callRequireRoles(['admin'], undefined);
  assert.equal(noUser.status, 401);
});

// ── Integration: wiring as in server/index.js ─────────────────────────────────

function createFakeSupabase() {
  return {
    from(table) {
      const q = {
        select() { return q; },
        in() { return q; },
        eq() { return q; },
        order() { return q; },
        limit() { return q; },
        update() { return q; },
        maybeSingle: async () => ({ data: null, error: null }),
        then(resolve) { return resolve({ data: [], error: null }); },
      };
      return q;
    },
  };
}

async function withTestServer(fn, { profile = profileFor('technician') } = {}) {
  const app = express();
  app.use(express.json());
  app.locals.auth = {
    authClient: fakeAuthClient(),
    getUserProfile: async () => profile,
  };
  app.locals.agentLoop = {
    supabase: createFakeSupabase(),
    store: createMemoryStore(),
    now: WED_1000,
  };
  app.get('/api/protected', requireAuth, (req, res) => res.json({ ok: true, user: req.user }));
  app.post('/api/admin-only', requireAuth, requireRoles('admin', 'super_admin'), (req, res) => res.json({ ok: true }));
  app.post('/api/agent-loop/run', runAgentLoop);

  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('integration: protected route 401s without a token, 200s with a valid one', async () => {
  await withTestServer(async base => {
    const noToken = await fetch(`${base}/api/protected`);
    assert.equal(noToken.status, 401);

    const badToken = await fetch(`${base}/api/protected`, {
      headers: { Authorization: 'Bearer nope' },
    });
    assert.equal(badToken.status, 401);

    const goodToken = await fetch(`${base}/api/protected`, {
      headers: { Authorization: 'Bearer valid-token' },
    });
    assert.equal(goodToken.status, 200);
    const body = await goodToken.json();
    assert.equal(body.ok, true);
    assert.equal(body.user.id, 'user-1');
    assert.equal(body.user.staff_role, 'technician');
  });
});

test('integration: signed-in user with no staff role gets 403 on a protected route', async () => {
  await withTestServer(async base => {
    const res = await fetch(`${base}/api/protected`, {
      headers: { Authorization: 'Bearer valid-token' },
    });
    assert.equal(res.status, 403);
  }, { profile: null });
});

test('integration: requireRoles blocks a technician from an admin-only route, allows an admin', async () => {
  await withTestServer(async base => {
    const res = await fetch(`${base}/api/admin-only`, {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    });
    assert.equal(res.status, 403);
  }, { profile: profileFor('technician') });

  await withTestServer(async base => {
    const res = await fetch(`${base}/api/admin-only`, {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    });
    assert.equal(res.status, 200);
  }, { profile: profileFor('admin') });
});

test('integration: cron route still works with CRON_SECRET and is rejected without it', async () => {
  process.env.CRON_SECRET = 'test-secret';
  try {
    await withTestServer(async base => {
      const denied = await fetch(`${base}/api/agent-loop/run`, { method: 'POST' });
      assert.equal(denied.status, 403);

      const allowed = await fetch(`${base}/api/agent-loop/run`, {
        method: 'POST',
        headers: { 'x-cron-secret': 'test-secret' },
      });
      assert.equal(allowed.status, 200);
      const body = await allowed.json();
      assert.equal(body.ran, true);
    });
  } finally {
    delete process.env.CRON_SECRET;
  }
});
