// Director tier tables. Spread into the host schema (`...walkthroughTables`).
// Every row is owned by the director who runs the story; nothing here is
// shared between directors.
import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const walkthroughTables = {
  /** One row per director: the story they are on and where it stands. */
  wt_runs: defineTable({
    owner_user_id: v.id('users'),
    story_id: v.string(),
    /** Steps already applied. The step on screen is beats[beat_index - 1]. */
    beat_index: v.number(),
    status: v.union(v.literal('idle'), v.literal('playing'), v.literal('paused'), v.literal('done')),
    /** The tab driving a playing run, and until when. Stops two tabs playing at double speed. */
    driver_id: v.optional(v.string()),
    lease_until: v.optional(v.number()),
    updated_at: v.number(),
  }).index('by_owner', ['owner_user_id']),

  /** Every write a step made, in order, so restart and step back can undo them. */
  wt_writes: defineTable({
    run_id: v.id('wt_runs'),
    seq: v.number(),
    op: v.union(v.literal('insert'), v.literal('patch'), v.literal('replace'), v.literal('delete')),
    table: v.string(),
    row_id: v.string(),
    /** The whole row before a patch, replace or delete, system fields stripped. */
    before: v.optional(v.any()),
  }).index('by_run_seq', ['run_id', 'seq']),

  /** Cards that stand in for emails and notifications. */
  wt_prompts: defineTable({
    run_id: v.id('wt_runs'),
    owner_user_id: v.id('users'),
    recipient_user_id: v.id('users'),
    beat_id: v.string(),
    title: v.string(),
    body: v.string(),
    cta_label: v.optional(v.string()),
    cta_route: v.optional(v.string()),
    created_at: v.number(),
    seen_at: v.optional(v.number()),
  })
    .index('by_run', ['run_id'])
    .index('by_recipient_created', ['recipient_user_id', 'created_at']),
};
