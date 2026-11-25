/**
 * Watermark store for the agent loop — records which requests have already
 * been drafted, so a re-run never drafts the same upsell twice.
 *
 * Primary backend: the `agent_loop_seen` Supabase table (see
 * supabase/migrations/202611250001_agent_loop_seen.sql). It survives server
 * restarts and deploys, which a file or in-memory store on a free host does
 * not — Render's free tier has an ephemeral filesystem, and Railway only
 * persists files on a paid volume. A file-backed store was considered and
 * rejected for that reason.
 *
 * The table is created by a shipped migration that Trevor applies himself
 * in the Supabase SQL editor — the loop never runs migrations. Until the
 * table exists, the store falls back to an in-memory Map (same API): the
 * loop keeps working, it just forgets what it drafted if the server
 * restarts. `createAgentLoopStore` probes the table once at startup and
 * reports which backend is active, so /api/agent-loop/status can show it.
 *
 * Entry shape (both backends):
 *   { key, requestId, jobCardNumber, status, requestUpdatedAt,
 *     draftType, draftedAt, flags }
 */

export function createMemoryStore() {
  const entries = new Map();
  return {
    backend: 'memory',
    tableMissing: false,
    async isSeen(key) {
      return entries.has(key);
    },
    async markSeen(entry) {
      entries.set(entry.key, { ...entry });
    },
    async listSeen() {
      return [...entries.values()].sort((a, b) =>
        String(b.draftedAt || '').localeCompare(String(a.draftedAt || '')));
    },
    async count() {
      return entries.size;
    },
  };
}

function isMissingTableError(error) {
  if (!error) return false;
  // PostgREST "table not found" and Postgres undefined_table.
  if (error.code === 'PGRST205' || error.code === '42P01') return true;
  return /agent_loop_seen/i.test(error.message || '');
}

export async function createAgentLoopStore(supabase) {
  const memory = createMemoryStore();

  if (!supabase) return memory;

  try {
    const { error } = await supabase.from('agent_loop_seen').select('key').limit(1);
    if (error) {
      if (isMissingTableError(error)) {
        console.warn(
          'Agent loop: agent_loop_seen table not found — using in-memory watermark store. ' +
          'Apply supabase/migrations/202611250001_agent_loop_seen.sql in the Supabase SQL editor ' +
          'so drafts survive a server restart.'
        );
        return { ...memory, tableMissing: true };
      }
      throw error;
    }
  } catch (error) {
    if (isMissingTableError(error)) {
      return { ...memory, tableMissing: true };
    }
    console.warn('Agent loop: could not reach agent_loop_seen table, using in-memory store:', error.message);
    return { ...memory, tableMissing: false };
  }

  return {
    backend: 'supabase',
    tableMissing: false,
    async isSeen(key) {
      const { data, error } = await supabase
        .from('agent_loop_seen')
        .select('key')
        .eq('key', key)
        .maybeSingle();
      if (error) throw error;
      return data != null;
    },
    async markSeen(entry) {
      const { error } = await supabase.from('agent_loop_seen').upsert({
        key: entry.key,
        request_id: entry.requestId,
        job_card_number: entry.jobCardNumber,
        status: entry.status,
        request_updated_at: entry.requestUpdatedAt,
        draft_type: entry.draftType,
        drafted_at: entry.draftedAt,
        flags: entry.flags || {},
      });
      if (error) throw error;
    },
    async listSeen() {
      const { data, error } = await supabase
        .from('agent_loop_seen')
        .select('*')
        .order('drafted_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []).map(row => ({
        key: row.key,
        requestId: row.request_id,
        jobCardNumber: row.job_card_number,
        status: row.status,
        requestUpdatedAt: row.request_updated_at,
        draftType: row.draft_type,
        draftedAt: row.drafted_at,
        flags: row.flags || {},
      }));
    },
    async count() {
      const { count, error } = await supabase
        .from('agent_loop_seen')
        .select('key', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
  };
}
