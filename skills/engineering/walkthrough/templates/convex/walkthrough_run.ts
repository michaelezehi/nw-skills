// Director tier: the server-held story run. Pattern code: adapt the auth
// helpers, the story import and the effect writers to the host. Ported from
// a working three-role implementation; keep every rule in the comments.
//
//  - Every call is gated on the REAL signed-in user being on the director
//    allowlist (env `WALKTHROUGH_DIRECTOR_EMAILS`), even while acting as a
//    persona. Any doubt falls back to "not a director".
//  - `expectedIndex` makes advancing idempotent: a doubled or stale call
//    returns the run unchanged.
//  - A lease (`driver_id`, `lease_until`) lets one tab drive a playing run.
//  - Effects write through `recordingCtx`, so restart, a story switch and
//    step back can undo them.
//  - Prompts are rows, never emails.

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { deleteRunPrompts, recordingCtx, undoRunWrites } from './_ledger';
import { STORIES, storyById, type Beat, type StoryKey } from './_story';
import { applyEffect } from './_effects';

const storyArg = { story: v.optional(v.string()) };
/** How long past a step's hold the driving tab keeps the run before another may take it. */
const LEASE_GRACE_MS = 15_000;

async function requireDirector(ctx: any) {
  // HOST: resolve the real user (not the persona being acted as) and check
  // `isDirector(realUser.email)` against WALKTHROUGH_DIRECTOR_EMAILS.
  throw new Error('wire requireDirector to the host auth');
}

async function findRun(ctx: any, ownerId: string) {
  return await ctx.db.query('wt_runs').withIndex('by_owner', (q: any) => q.eq('owner_user_id', ownerId)).first();
}

/** The shape the client's `RunView` reads. Fill names into titles and copy here. */
function runView(run: any) {
  const story = storyById(run.story_id);
  const beats: readonly Beat[] = story?.beats ?? [];
  const index = run.beat_index;
  const last = index > 0 ? beats[index - 1] : undefined;
  return {
    runId: String(run._id),
    story: story?.key ?? '',
    storyLabel: story?.label ?? '',
    steps: beats.map((b) => b.title),
    index,
    total: beats.length,
    status: run.status,
    lastStep: last
      ? { id: last.id, index: index - 1, title: last.title, route: last.route, viewAs: last.viewAs ?? null, holdMs: last.holdMs, explain: last.explain }
      : null,
    drivenElsewhere: false,
  };
}

async function writePrompts(ctx: any, run: any, beat: Beat, world: any) {
  for (const [i, p] of (beat.prompts ?? []).entries()) {
    await ctx.db.insert('wt_prompts', {
      run_id: run._id,
      owner_user_id: run.owner_user_id,
      recipient_user_id: world.seats[p.to],
      beat_id: beat.id,
      title: p.title,
      body: p.body,
      ...(p.ctaLabel ? { cta_label: p.ctaLabel } : {}),
      ...(p.ctaRoute ? { cta_route: p.ctaRoute } : {}),
      created_at: Date.now() + i,
    });
  }
}

/** Put the director on `story` at step one, undoing every row and prompt the run wrote before. */
async function resetRun(ctx: any, ownerId: string, story: StoryKey, status: 'idle' | 'playing') {
  const run = await findRun(ctx, ownerId);
  const fields = { story_id: STORIES[story].id, beat_index: 0, status, updated_at: Date.now() };
  if (!run) return await ctx.db.get(await ctx.db.insert('wt_runs', { owner_user_id: ownerId, ...fields }));
  await undoRunWrites(ctx, run._id);
  await deleteRunPrompts(ctx, run._id);
  await ctx.db.patch(run._id, { ...fields, driver_id: undefined, lease_until: undefined });
  return await ctx.db.get(run._id);
}

export const getRun = query({
  args: storyArg,
  handler: async (ctx, { story = 'founder' }) => {
    const { realUser } = await requireDirector(ctx);
    const run = await findRun(ctx, realUser._id);
    // A run on another view's story is not this view's run: it reads as not started.
    if (!run || run.story_id !== STORIES[story as StoryKey].id) return null;
    return runView(run);
  },
});

export const startRun = mutation({
  args: storyArg,
  handler: async (ctx, { story = 'founder' }) => {
    const { realUser } = await requireDirector(ctx);
    let run = await findRun(ctx, realUser._id);
    // Starting another view's story undoes the last story's writes first.
    if (!run || run.story_id !== STORIES[story as StoryKey].id) {
      run = await resetRun(ctx, realUser._id, story as StoryKey, 'playing');
    } else if (run.status === 'idle' || run.status === 'paused') {
      await ctx.db.patch(run._id, { status: 'playing', updated_at: Date.now() });
      run = await ctx.db.get(run._id);
    }
    return runView(run);
  },
});

export const advanceBeat = mutation({
  args: {
    runId: v.id('wt_runs'),
    expectedIndex: v.number(),
    step: v.optional(v.boolean()),
    driverId: v.optional(v.string()),
  },
  handler: async (ctx, { runId, expectedIndex, step, driverId }) => {
    const { realUser, world } = await requireDirector(ctx);
    const run = await ctx.db.get(runId);
    if (!run || String(run.owner_user_id) !== String(realUser._id)) throw new Error('not your run');
    const beats = storyById(run.story_id)?.beats ?? [];
    const beat = beats[expectedIndex];
    if (run.status === 'done' || run.beat_index !== expectedIndex || !beat) return runView(run);
    const now = Date.now();
    if (run.driver_id !== undefined && run.driver_id !== driverId && (run.lease_until ?? 0) > now) {
      return { ...runView(run), drivenElsewhere: true };
    }
    // A paused run moves only one step at a time, on request.
    if (run.status === 'paused' && step !== true) return runView(run);
    await applyEffect(recordingCtx(ctx, run._id), beat.effect, world);
    await writePrompts(ctx, run, beat, world);
    const index = expectedIndex + 1;
    await ctx.db.patch(run._id, {
      beat_index: index,
      status: index >= beats.length ? 'done' : run.status === 'idle' ? 'paused' : run.status,
      updated_at: now,
      driver_id: driverId,
      lease_until: driverId === undefined ? undefined : now + beat.holdMs + LEASE_GRACE_MS,
    });
    return runView(await ctx.db.get(run._id));
  },
});

/**
 * One step back. Undoes every write, replays the steps before the one being
 * left, and re-raises only the prompts of the step now on screen, so the
 * screens show the world as it stood when that step first played. Paused.
 */
export const stepBack = mutation({
  args: { runId: v.id('wt_runs'), expectedIndex: v.number() },
  handler: async (ctx, { runId, expectedIndex }) => {
    const { realUser, world } = await requireDirector(ctx);
    const run = await ctx.db.get(runId);
    if (!run || String(run.owner_user_id) !== String(realUser._id)) throw new Error('not your run');
    const beats = storyById(run.story_id)?.beats ?? [];
    if (run.beat_index !== expectedIndex || expectedIndex < 2 || expectedIndex > beats.length) {
      return runView(run);
    }
    const target = expectedIndex - 1;
    await undoRunWrites(ctx, run._id);
    await deleteRunPrompts(ctx, run._id);
    const recording = recordingCtx(ctx, run._id);
    for (const beat of beats.slice(0, target)) await applyEffect(recording, beat.effect, world);
    await writePrompts(ctx, run, beats[target - 1]!, world);
    await ctx.db.patch(run._id, {
      beat_index: target,
      status: 'paused',
      updated_at: Date.now(),
      driver_id: undefined,
      lease_until: undefined,
    });
    return runView(await ctx.db.get(run._id));
  },
});

export const pauseRun = mutation({
  args: { runId: v.id('wt_runs') },
  handler: async (ctx, { runId }) => {
    await requireDirector(ctx);
    const run = await ctx.db.get(runId);
    if (run.status === 'playing') await ctx.db.patch(run._id, { status: 'paused' });
    // Paused, nobody drives: any tab may step or resume.
    await ctx.db.patch(run._id, { driver_id: undefined, lease_until: undefined, updated_at: Date.now() });
    return runView(await ctx.db.get(run._id));
  },
});

export const restartRun = mutation({
  args: storyArg,
  handler: async (ctx, { story = 'founder' }) => {
    const { realUser } = await requireDirector(ctx);
    return runView(await resetRun(ctx, realUser._id, story as StoryKey, 'idle'));
  },
});
