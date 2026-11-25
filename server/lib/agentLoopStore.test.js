import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore, createAgentLoopStore } from './agentLoopStore.js';

const ENTRY = {
  key: 'req-1:sent_to_advisor:2026-11-25T00:00:00Z',
  requestId: 'req-1',
  jobCardNumber: 'J03073211',
  status: 'sent_to_advisor',
  requestUpdatedAt: '2026-11-25T00:00:00Z',
  draftType: 'sms',
  draftedAt: '2026-11-25T00:00:00Z',
  flags: {},
};

test('memory store records and recalls seen requests', async () => {
  const store = createMemoryStore();
  assert.equal(store.backend, 'memory');
  assert.equal(await store.isSeen(ENTRY.key), false);
  await store.markSeen(ENTRY);
  assert.equal(await store.isSeen(ENTRY.key), true);
  assert.equal(await store.count(), 1);
  const listed = await store.listSeen();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].jobCardNumber, 'J03073211');
});

test('memory store lists most recent drafts first', async () => {
  const store = createMemoryStore();
  await store.markSeen({ ...ENTRY, key: 'a', draftedAt: '2026-11-25T00:00:00Z' });
  await store.markSeen({ ...ENTRY, key: 'b', draftedAt: '2026-11-25T01:00:00Z' });
  const listed = await store.listSeen();
  assert.equal(listed[0].key, 'b');
  assert.equal(listed[1].key, 'a');
});

test('supabase store falls back to memory when the table does not exist', async () => {
  const missingTableError = { code: 'PGRST205', message: 'Could not find the table agent_loop_seen in the schema cache' };
  const fakeSupabase = {
    from() {
      return {
        select: () => ({ limit: async () => ({ data: null, error: missingTableError }) }),
      };
    },
  };
  const store = await createAgentLoopStore(fakeSupabase);
  assert.equal(store.backend, 'memory');
  assert.equal(store.tableMissing, true);
  await store.markSeen(ENTRY);
  assert.equal(await store.isSeen(ENTRY.key), true);
});
