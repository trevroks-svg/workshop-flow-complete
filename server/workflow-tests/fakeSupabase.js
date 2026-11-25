// In-memory Supabase-compatible client for workflow tests.
// Implements only the PostgREST surface the app actually uses:
//   from(table).select(cols, {count, head}).eq().in().order().limit()
//   .maybeSingle() / .single()
//   .update(payload).eq() / .upsert(row) / .insert(row) / .delete().eq()
// Every builder is thenable, exactly like the real supabase-js client.
// Pass { missingTables: ['agent_loop_seen'] } to simulate a table that has
// not been migrated yet (PostgREST PGRST205) — used to test the store fallback.
export function createFakeSupabase({ missingTables = [] } = {}) {
  const tables = {
    parts_requests: [],
    businesses: [],
    agent_loop_seen: [],
    notifications: [],
  };
  const missing = new Set(missingTables);
  let idCounter = 1;

  function tableRows(name) {
    if (missing.has(name)) return null;
    if (!(name in tables)) return null;
    return tables[name];
  }

  class Builder {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.orderBy = null;
      this.limitN = null;
      this.op = 'select';
      this.cols = '*';
      this.countMode = null;
      this.head = false;
      this.payload = null;
      this.singleMode = null;
    }
    select(cols = '*', opts = {}) {
      this.op = 'select';
      this.cols = cols;
      if (opts.count === 'exact') this.countMode = 'exact';
      this.head = !!opts.head;
      return this;
    }
    eq(col, val) {
      this.filters.push((r) => r[col] === val);
      return this;
    }
    in(col, vals) {
      this.filters.push((r) => vals.includes(r[col]));
      return this;
    }
    order(col, { ascending = true } = {}) {
      this.orderBy = { col, ascending };
      return this;
    }
    limit(n) {
      this.limitN = n;
      return this;
    }
    maybeSingle() {
      this.singleMode = 'maybe';
      return this;
    }
    single() {
      this.singleMode = 'single';
      return this;
    }
    update(payload) {
      this.op = 'update';
      this.payload = payload;
      return this;
    }
    upsert(row) {
      this.op = 'upsert';
      this.payload = row;
      return this;
    }
    insert(row) {
      this.op = 'insert';
      this.payload = row;
      return this;
    }
    delete() {
      this.op = 'delete';
      return this;
    }
    _project(rows) {
      if (this.cols === '*') return rows.map((r) => ({ ...r }));
      const wanted = String(this.cols).split(',').map((s) => s.trim()).filter(Boolean);
      return rows.map((r) => {
        const out = {};
        for (const c of wanted) out[c] = r[c];
        return out;
      });
    }
    _applyFilters(rows) {
      return rows.filter((r) => this.filters.every((f) => f(r)));
    }
    _applyOrder(rows) {
      if (!this.orderBy) return rows;
      const { col, ascending } = this.orderBy;
      return [...rows].sort((a, b) => {
        const av = a[col] ?? '';
        const bv = b[col] ?? '';
        if (av < bv) return ascending ? -1 : 1;
        if (av > bv) return ascending ? 1 : -1;
        return 0;
      });
    }
    async _run() {
      const rows = tableRows(this.table);
      if (rows === null) {
        return {
          data: null,
          error: {
            code: 'PGRST205',
            message: `Could not find the table 'public.${this.table}' in the schema cache`,
          },
          count: null,
        };
      }
      if (this.op === 'select') {
        let out = this._applyOrder(this._applyFilters(rows));
        const total = out.length;
        if (this.limitN != null) out = out.slice(0, this.limitN);
        if (this.head) return { data: null, error: null, count: total };
        if (this.singleMode === 'maybe') return { data: out[0] ?? null, error: null, count: null };
        if (this.singleMode === 'single') {
          if (!out.length) {
            return { data: null, error: { code: 'PGRST116', message: 'No rows found' }, count: null };
          }
          return { data: out[0], error: null, count: null };
        }
        return {
          data: this._project(out),
          error: null,
          count: this.countMode === 'exact' ? total : null,
        };
      }
      if (this.op === 'update') {
        const matched = this._applyFilters(rows);
        for (const r of matched) Object.assign(r, this.payload);
        return { data: matched.map((r) => ({ ...r })), error: null, count: null };
      }
      if (this.op === 'insert') {
        const row = { id: this.payload.id || `fake-${idCounter++}`, ...this.payload };
        rows.push(row);
        return { data: [{ ...row }], error: null, count: null };
      }
      if (this.op === 'upsert') {
        const keyCol = this.table === 'agent_loop_seen' ? 'key' : 'id';
        const existing = rows.find((r) => r[keyCol] === this.payload[keyCol]);
        if (existing) Object.assign(existing, this.payload);
        else rows.push({ ...this.payload });
        return { data: [{ ...this.payload }], error: null, count: null };
      }
      if (this.op === 'delete') {
        const matched = this._applyFilters(rows);
        for (const r of matched) rows.splice(rows.indexOf(r), 1);
        return { data: matched, error: null, count: null };
      }
      return { data: null, error: { message: 'unsupported op' }, count: null };
    }
    then(resolve, reject) {
      return this._run().then(resolve, reject);
    }
    catch(reject) {
      return this._run().catch(reject);
    }
  }

  return {
    tables,
    from(table) {
      return new Builder(table);
    },
    _reset() {
      for (const k of Object.keys(tables)) tables[k].length = 0;
      idCounter = 1;
    },
  };
}
