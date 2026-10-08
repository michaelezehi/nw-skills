"use client";

// Convex-backed shared votes/comments for an rnd consensus page → lib/rnd/useSpec.ts.
//
// This is the React path: live, reactive subscriptions via convex/react — no
// polling, no fetch shim. Every participant sees every vote/comment the moment
// it lands. Requires the host's ConvexProvider mounted and an `api` export.
//
//   founder-x:  import { api } from "@/lib/convex";
// Adjust the import below to wherever the host exposes its generated `api`
// (e.g. "@/convex/_generated/api"). No ConvexProvider yet → run the
// convex-quickstart skill; never fall back to localStorage (votes must be shared).

import { useQuery, useMutation } from "convex/react";
import { api } from "@/lib/convex";
import type { SpecVote, SpecComment, VoteStatus } from "@/lib/rnd/types";

export interface UseSpec {
  votes: SpecVote[];
  comments: SpecComment[];
  loading: boolean;
  setVote: (pageId: string, person: string, status: VoteStatus) => Promise<unknown>;
  setNote: (pageId: string, person: string, note: string) => Promise<unknown>;
  addComment: (pageId: string, author: string, text: string) => Promise<unknown>;
}

export function useSpec(doc: string): UseSpec {
  // `api.rnd_spec.*` is stringly-typed via anyApi on some hosts — cross-check
  // the function names against the deployed rnd_spec module.
  const data = useQuery(api.rnd_spec.get, { doc });
  const setVoteFn = useMutation(api.rnd_spec.setVote);
  const setNoteFn = useMutation(api.rnd_spec.setNote);
  const addCommentFn = useMutation(api.rnd_spec.addComment);

  return {
    votes: data?.votes ?? [],
    comments: data?.comments ?? [],
    loading: data === undefined,
    setVote: (pageId, person, status) =>
      setVoteFn(status ? { doc, pageId, person, status } : { doc, pageId, person }),
    setNote: (pageId, person, note) => setNoteFn({ doc, pageId, person, note }),
    addComment: (pageId, author, text) => addCommentFn({ doc, pageId, author, text }),
  };
}
