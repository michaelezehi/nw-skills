// The write ledger behind a deterministic restart and a true step back.
//
// Each step's effect runs against a ctx whose `db` records every insert,
// patch, replace and delete into `wt_writes` before passing it through, so
// the ledger holds what actually happened, including writes made by shared
// helpers the effect calls. Undo walks the ledger newest first.
//
// Two rules the host must add (the reference implementation does both):
//  1. Guard every write: refuse a row whose team is not a sandbox or demo
//     team, and a user who is not one of the director's personas. A write
//     that resolves to no team is refused, never filed under a default.
//  2. Drop the scheduler: `ctx.scheduler` calls are swallowed, so a step can
//     never send an email or move on its own between takes.
//
// Known limit of this minimal version: a row the run deleted comes back
// under a NEW id. If other rows point at it, repoint them after the restore
// (walk the schema validators for `v.id(table)` fields), or the restart
// leaves dangling references. Test it: snapshot every table with ids taken
// out, play, restart, compare, and check every id still resolves.

type Ctx = { db: any; scheduler?: any };

const strip = (doc: Record<string, unknown>) => {
  const { _id, _creationTime, ...rest } = doc;
  return rest;
};

export function recordingCtx<C extends Ctx>(ctx: C, runId: string): C {
  let seq: number | null = null;
  const next = async () => {
    if (seq === null) {
      const last = await ctx.db
        .query('wt_writes')
        .withIndex('by_run_seq', (q: any) => q.eq('run_id', runId))
        .order('desc')
        .first();
      seq = last ? last.seq : 0;
    }
    seq += 1;
    return seq;
  };
  const log = async (op: string, table: string, rowId: string, before?: unknown) =>
    ctx.db.insert('wt_writes', {
      run_id: runId,
      seq: await next(),
      op,
      table,
      row_id: rowId,
      ...(before === undefined ? {} : { before }),
    });
  const db = {
    ...ctx.db,
    query: ctx.db.query.bind(ctx.db),
    get: ctx.db.get.bind(ctx.db),
    normalizeId: ctx.db.normalizeId?.bind(ctx.db),
    async insert(table: string, value: Record<string, unknown>) {
      const id = await ctx.db.insert(table, value);
      await log('insert', table, String(id));
      return id;
    },
    async patch(id: string, value: Record<string, unknown>) {
      const row = await ctx.db.get(id);
      await log('patch', tableName(row, id), id, row ? strip(row) : undefined);
      return ctx.db.patch(id, value);
    },
    async replace(id: string, value: Record<string, unknown>) {
      const row = await ctx.db.get(id);
      await log('replace', tableName(row, id), id, row ? strip(row) : undefined);
      return ctx.db.replace(id, value);
    },
    async delete(id: string) {
      const row = await ctx.db.get(id);
      await log('delete', tableName(row, id), id, row ? strip(row) : undefined);
      return ctx.db.delete(id);
    },
  };
  const scheduler = { runAfter: async () => null, runAt: async () => null, cancel: async () => {} };
  return { ...ctx, db, scheduler } as C;
}

/**
 * The table a row belongs to. Convex has no public id-to-table call inside a
 * mutation, so resolve it with `ctx.db.normalizeId(table, id)` over the
 * schema's table names (the reference implementation caches this per run).
 * Placeholder: the host fills TABLES from `Object.keys(schema.tables)`.
 */
export let TABLES: string[] = [];
let normalize: ((table: string, id: string) => unknown) | null = null;
export function configureLedger(tables: string[], db: { normalizeId: (t: string, id: string) => unknown }) {
  TABLES = tables;
  normalize = (t, id) => db.normalizeId(t, id);
}
function tableName(_row: unknown, id: string): string {
  const hit = normalize ? TABLES.find((t) => normalize!(t, id) !== null) : undefined;
  if (!hit) throw new Error(`wt ledger: no table for ${id}; call configureLedger first`);
  return hit;
}

/** Undo every write the run made, newest first, and clear the ledger. */
export async function undoRunWrites(ctx: Ctx, runId: string): Promise<number> {
  const writes = await ctx.db
    .query('wt_writes')
    .withIndex('by_run_seq', (q: any) => q.eq('run_id', runId))
    .order('desc')
    .collect();
  for (const w of writes) {
    if (w.op === 'insert') {
      if (await ctx.db.get(w.row_id)) await ctx.db.delete(w.row_id);
    } else if (w.op === 'patch' || w.op === 'replace') {
      if (w.before && (await ctx.db.get(w.row_id))) await ctx.db.replace(w.row_id, w.before);
    } else if (w.op === 'delete' && w.before) {
      // Comes back under a new id: see "Known limit" above.
      await ctx.db.insert(w.table, w.before);
    }
    await ctx.db.delete(w._id);
  }
  return writes.length;
}

export async function deleteRunPrompts(ctx: Ctx, runId: string): Promise<number> {
  const rows = await ctx.db
    .query('wt_prompts')
    .withIndex('by_run', (q: any) => q.eq('run_id', runId))
    .collect();
  for (const row of rows) await ctx.db.delete(row._id);
  return rows.length;
}
