/* eslint-disable @typescript-eslint/no-explicit-any */
// Behavioral PostgREST double, NOT SQL/RLS proof. Unknown operations fail loudly.
import { randomUUID } from 'node:crypto';
export type Row = Record<string, any>;
export class FakeDb {
  tables: Record<string, Row[]> = {};
  journal: Row[] = [];
  fail: ((table: string, op: string) => string | null) = () => null;
  before: ((table: string, op: string) => void) = () => {};
  rpcFailure: string | null = null;
  rows(table: string): Row[] { return this.tables[table] ??= []; }
  from(table: string) {
    let op = 'select', payload: Row | Row[] = {}, single = false, limit = Infinity;
    let order: { field: string; ascending: boolean } | null = null;
    let conflict: string | undefined, ignoreDuplicates = false;
    const filters: ((row: Row) => boolean)[] = [];
    let promise: Promise<any> | undefined;
    const query: any = {
      select: () => query,
      insert: (value: Row | Row[]) => { op = 'insert'; payload = value; return query; },
      upsert: (value: Row | Row[], options: any = {}) => { op = 'upsert'; payload = value; conflict = options.onConflict; ignoreDuplicates = options.ignoreDuplicates; return query; },
      update: (value: Row) => { op = 'update'; payload = value; return query; },
      delete: () => { op = 'delete'; return query; },
      eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
      in: (key: string, value: unknown[]) => { filters.push(row => value.includes(row[key])); return query; },
      lt: (key: string, value: string) => { filters.push(row => row[key] < value); return query; },
      order: (field: string, options: any) => { order = { field, ascending: options.ascending }; return query; },
      limit: (value: number) => { limit = value; return query; },
      single: () => { single = true; return query; },
      maybeSingle: () => { single = true; return query; },
      then: (resolve: any, reject: any) => {
        promise ??= Promise.resolve().then(() => {
          this.before(table, op);
          this.journal.push({ table, op, payload: structuredClone(payload) });
          const failure = this.fail(table, op);
          if (failure) return { data: null, error: { message: failure } };
          const all = this.rows(table);
          let selected = all.filter(row => filters.every(f => f(row)));
          if (op === 'update') selected.forEach(row => Object.assign(row, payload));
          if (op === 'delete') this.tables[table] = all.filter(row => !selected.includes(row));
          if (op === 'insert' || op === 'upsert') {
            selected = (Array.isArray(payload) ? payload : [payload]).map(input => {
              const existing = conflict && all.find(row => row[conflict!] === input[conflict!]);
              if (existing) { if (!ignoreDuplicates) Object.assign(existing, input); return existing; }
              const row = { id: randomUUID(), attempts: 0, max_attempts: 3, ...structuredClone(input) };
              all.push(row); return row;
            });
          }
          if (order) selected.sort((a, b) => (a[order!.field] - b[order!.field]) * (order!.ascending ? 1 : -1));
          selected = selected.slice(0, limit);
          return { data: structuredClone(single ? selected[0] ?? null : selected), error: null };
        });
        return promise.then(resolve, reject);
      },
    };
    return query;
  }
  async rpc(name: string, args: Row) {
    this.journal.push({ rpc: name, args });
    if (this.rpcFailure === name) return { data: null, error: { message: 'T08_DB_UNAVAILABLE' } };
    if (name === 'claim_auto_publications') {
      const claimed = this.rows('sutra_auto_publications').filter(row => row.status === 'pending' &&
        (!args.p_video_id || row.auto_video_id === args.p_video_id) &&
        (!row.run_after || Date.parse(row.run_after) <= Date.now())).slice(0, args.p_limit);
      claimed.forEach(row => Object.assign(row, { status: 'publishing', locked_by: args.p_worker, attempts: row.attempts + 1 }));
      return { data: structuredClone(claimed), error: null };
    }
    if (name === 'finish_auto_publication') {
      const row = this.rows('sutra_auto_publications').find(row => row.id === args.p_id && row.locked_by === args.p_worker);
      if (!row) return { data: false, error: null };
      Object.assign(row, { status: args.p_status, external_post_id: args.p_external_post_id, last_error: args.p_last_error,
        error_class: args.p_error_class, locked_by: null, run_after: new Date(Date.now() + args.p_run_after_seconds * 1000).toISOString() });
      return { data: true, error: null };
    }
    throw new Error(`T08 unsupported RPC ${name}`);
  }
}
