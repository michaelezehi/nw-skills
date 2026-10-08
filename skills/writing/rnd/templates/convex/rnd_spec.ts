// R&D living-spec sign-off — shared votes/comments for an rnd/ consensus page.
// Ported pattern: founder-x apps/api/convex-out/convex/rnd_spec.ts.
//
// One shared internal document (keyed by `doc`) carrying per-page
// approve/decline/comment votes and a discussion thread for the named
// participants. NOT tenant-scoped and not behind auth (the rnd/ surface is a
// noindex internal page). Hardened by validating person against a fixed
// allow-list and capping text length, so an anonymous caller can't write
// arbitrary identities or unbounded payloads.
//
// Tables required in schema.ts (see the rnd skill's anatomy.md):
//   spec_votes    by_doc, by_doc_page_person
//   spec_comments by_doc
import { ConvexError, v } from 'convex/values';
import { mutation, query, type MutationCtx } from './_generated/server.js';

// ── EDIT ME: the participant ids from the consensus page's PEOPLE ──
const ALLOWED_PEOPLE = ['REPLACE_ME'] as const;

const MAX_NOTE = 2000;
const MAX_COMMENT = 4000;

const statusValidator = v.union(v.literal('approve'), v.literal('decline'), v.literal('comment'));

function assertPerson(person: string): void {
  if (!(ALLOWED_PEOPLE as readonly string[]).includes(person)) {
    throw new ConvexError({ code: 'INVALID_PERSON', value: person });
  }
}

function findVote(ctx: MutationCtx, doc: string, pageId: string, person: string) {
  return ctx.db
    .query('spec_votes')
    .withIndex('by_doc_page_person', (q) =>
      q.eq('doc', doc).eq('page_id', pageId).eq('person', person),
    )
    .unique();
}

export const get = query({
  args: { doc: v.string() },
  handler: async (ctx, { doc }) => {
    const [votes, comments] = await Promise.all([
      ctx.db
        .query('spec_votes')
        .withIndex('by_doc', (q) => q.eq('doc', doc))
        .collect(),
      ctx.db
        .query('spec_comments')
        .withIndex('by_doc', (q) => q.eq('doc', doc))
        .collect(),
    ]);
    return {
      votes: votes.map((row) => ({
        pageId: row.page_id,
        person: row.person,
        status: row.status ?? null,
        note: row.note ?? '',
        updatedAt: row.updated_at,
      })),
      comments: comments
        .sort((a, b) => a.created_at - b.created_at)
        .map((row) => ({
          id: row._id,
          pageId: row.page_id,
          author: row.author,
          text: row.text,
          ts: row.created_at,
        })),
    };
  },
});

export const setVote = mutation({
  args: {
    doc: v.string(),
    pageId: v.string(),
    person: v.string(),
    // omit / undefined clears the status
    status: v.optional(statusValidator),
  },
  handler: async (ctx, { doc, pageId, person, status }): Promise<null> => {
    assertPerson(person);
    const existing = await findVote(ctx, doc, pageId, person);
    const now = Date.now();
    if (existing) {
      if (!status && !existing.note) {
        await ctx.db.delete(existing._id);
        return null;
      }
      await ctx.db.patch(existing._id, { status: status ?? undefined, updated_at: now });
      return null;
    }
    if (!status) return null;
    await ctx.db.insert('spec_votes', { doc, page_id: pageId, person, status, updated_at: now });
    return null;
  },
});

export const setNote = mutation({
  args: { doc: v.string(), pageId: v.string(), person: v.string(), note: v.string() },
  handler: async (ctx, { doc, pageId, person, note }): Promise<null> => {
    assertPerson(person);
    const trimmed = note.slice(0, MAX_NOTE);
    const existing = await findVote(ctx, doc, pageId, person);
    const now = Date.now();
    if (existing) {
      if (!trimmed && !existing.status) {
        await ctx.db.delete(existing._id);
        return null;
      }
      await ctx.db.patch(existing._id, { note: trimmed || undefined, updated_at: now });
      return null;
    }
    if (!trimmed) return null;
    await ctx.db.insert('spec_votes', {
      doc,
      page_id: pageId,
      person,
      note: trimmed,
      updated_at: now,
    });
    return null;
  },
});

export const addComment = mutation({
  args: { doc: v.string(), pageId: v.string(), author: v.string(), text: v.string() },
  handler: async (ctx, { doc, pageId, author, text }): Promise<null> => {
    assertPerson(author);
    const trimmed = text.trim().slice(0, MAX_COMMENT);
    if (!trimmed) throw new ConvexError({ code: 'EMPTY_COMMENT' });
    await ctx.db.insert('spec_comments', {
      doc,
      page_id: pageId,
      author,
      text: trimmed,
      created_at: Date.now(),
    });
    return null;
  },
});

// Edit / delete — only the comment's own author may change it (auth-lite).
export const editComment = mutation({
  args: { id: v.id('spec_comments'), author: v.string(), text: v.string() },
  handler: async (ctx, { id, author, text }): Promise<null> => {
    assertPerson(author);
    const row = await ctx.db.get(id);
    if (!row) throw new ConvexError({ code: 'NOT_FOUND' });
    if (row.author !== author) throw new ConvexError({ code: 'FORBIDDEN' });
    const trimmed = text.trim().slice(0, MAX_COMMENT);
    if (!trimmed) throw new ConvexError({ code: 'EMPTY_COMMENT' });
    await ctx.db.patch(id, { text: trimmed });
    return null;
  },
});

export const deleteComment = mutation({
  args: { id: v.id('spec_comments'), author: v.string() },
  handler: async (ctx, { id, author }): Promise<null> => {
    assertPerson(author);
    const row = await ctx.db.get(id);
    if (!row) return null;
    if (row.author !== author) throw new ConvexError({ code: 'FORBIDDEN' });
    await ctx.db.delete(id);
    return null;
  },
});
