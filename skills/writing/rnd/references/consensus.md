# Consensus mode — brief → votable living spec

Reproduces founder-x `/rnd/platform-redesign`: a participant intro gate, a
per-page current/planned spec with quotes and technical notes, the source brief
viewable in place, and shared approve/decline/comment voting.

## 1. Extract the structure (then STOP and confirm)

Input is a brief (file path or pasted text) and/or a named participant list
("participants: Ana (UX), Ben (engineering)").

Build the intermediate structure from `anatomy.md`:

- **PEOPLE** — every named participant: `{ id, codename?, role }`. If the brief
  names speakers, they are the participants. If only a list was given, use it.
  Codenames are optional flavour; invent only if the team already uses them.
- **PAGES** — one card per surface/topic under discussion. For each: what it is
  **today** (`current`), what the team **agreed to change** (`planned`), the
  best **verbatim quote** (`quote`), and a short **technical note**
  (`architect`) — the engineering read on feasibility/sequence. Assign
  `priority` (`must|should|nice|new`) and a `group`.
- **DOCS + PAGE_REFS** — section the brief itself (`{ id, heading, body[] }`)
  and map each page to the sections that discuss it. This powers the in-page
  source viewer, so claims stay checkable.
- **ALIGNED** — points already agreed before voting (rendered above the spec).

**Checkpoint (mandatory):** show the user the extracted PEOPLE, the PAGES list
(titles + one-liners), and the doc sections. Build only after they confirm.

## 2. Convex — the shared store (required, never localStorage-only)

Votes/comments must be visible to every participant. Mirror founder-x's
hardened `rnd_spec` module (it is auth-lite by design: the page is an internal
noindex URL; writes are bounded by a fixed person allow-list and length caps).

1. **Detect the host's Convex dir** (`convex/`, `apps/api/convex-out/convex/`,
   any dir with `_generated/`). If the project already HAS an `rnd_spec` module
   (founder-x does), reuse it — just pick a new unique `DOC_ID`; the tables are
   multi-doc by design.
2. **Else scaffold:** copy `templates/convex/rnd_spec.ts` into the Convex dir,
   set `ALLOWED_PEOPLE` to the PEOPLE ids, and add the `spec_votes` +
   `spec_comments` tables from `anatomy.md` to `schema.ts`. (Add
   `spec_agreements` only if the user wants the generated-agreement loop.)
3. **No Convex at all?** Tell the user this mode needs a Convex deployment and
   offer to set one up (`npm create convex@latest` / the convex-quickstart
   skill). Do not silently fall back to localStorage.
4. **Push** with the project's established command. founder-x:
   `cd apps/api/convex-out && npx convex dev --once` — NEVER `npx convex deploy`
   there. Other projects: `npx convex dev --once` in the Convex root.
5. **Capture the deployment URL** from `.env.local`
   (`CONVEX_URL`/`NEXT_PUBLIC_CONVEX_URL`) and copy it **verbatim** — newer
   deployments include a region segment
   (`https://<name>.eu-west-1.convex.cloud`) and the bare
   `<name>.convex.cloud` form 404s at the router. The page embeds this URL.

### How the page talks to Convex

**React host (default) — live subscriptions.** `templates/react/useSpec.ts`
wraps `convex/react` `useQuery(api.rnd_spec.get, { doc })` +
`useMutation(api.rnd_spec.setVote|setNote|addComment)`. No polling — every
participant sees a vote the instant it lands. Point the `api` import at the
host's generated api (founder-x: `@/lib/convex`). The host must have a
`ConvexProvider` mounted; if not, run the convex-quickstart skill.

**HTML fallback — vanilla fetch** (no framework, no client lib):

```js
const CONVEX_URL = 'https://<deployment>.convex.cloud';  // verbatim incl. region
async function convex(kind /* 'query'|'mutation' */, path, args) {
  const r = await fetch(`${CONVEX_URL}/api/${kind}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args, format: 'json' }),
  });
  const j = await r.json();
  if (j.status !== 'success') throw new Error(j.errorMessage || 'convex error');
  return j.value;
}
// read: convex('query','rnd_spec:get',{ doc }) · write: 'rnd_spec:setVote' etc.
```

Fallback refresh: refetch after every write, on `visibilitychange`, and on a
30 s interval.

## 3. The identity gate (the participant intro page)

The first thing a visitor sees: a full-screen "Who are you?" picker over
PEOPLE — one button per participant (shared hand-drawn avatar from Sketches,
name, codename/role). Selection is **per-person, local**:

- write `?as=<id>` into the URL (`history.replaceState`) so the shared link
  returns you as the same person, and mirror to
  `localStorage['rnd-<slug>-identity']`;
- on load resolve URL param first, then localStorage; no match → show the gate;
- a header chip shows who you are with a "switch" action that clears identity.

Copy register: "Pick your character — you'll vote and comment as them. Saved to
this link." / "No password — switch anytime from the header."

## 4. The spec page

**React host (default):** route `app/rnd/<slug>/page.tsx` (`consensus-page.tsx`)
renders the `ConsensusSpec` client (`templates/react/ConsensusSpec.tsx` +
`IdentityGate.tsx` + `consensus.module.css`), fed a `ConsensusData` module at
`lib/rnd/<slug>.ts` (`consensus-data.example.ts`). Identity via
`lib/rnd/identity.ts`, votes via `lib/rnd/useSpec.ts`. **No-framework fallback:**
one `index.html` from `templates/consensus.html`. Either way, the layout in
order:

1. **Hero** — eyebrow (`<Project> · R&D · <Topic>`), big headline, one-paragraph
   intro, the ALIGNED points, optional JOURNEY strip.
2. **Progress tracker** — per-participant counts of approved/total, computed
   from the live Convex data.
3. **Pages, grouped** — each card: area + priority chip, title, **Current** vs
   **Planned** panels side by side, the participant quote, the technical note,
   the Sketches wireframe, source chips (open the DOC section in a slide-over
   viewer), then the vote row.
4. **Vote row** — Approve / Decline / Comment buttons (write `setVote` as the
   chosen identity), a note field (`setNote`, debounced), the team's current
   votes as chips (everyone's, from `get`), and the comment thread
   (`addComment`; author-only edit/delete if those mutations exist).
5. **Footer** — "Internal R&D surface. Not indexed."

Every page card gets a sketch: `render.py find` per page concept; reuse or
draw + `add`. The founder-x repertoire already covers foyer / home / compass /
assessment / blueprint / team-analysis / flags / members and more.

## 5. Report

Tell the user: the page path/URL, the `DOC_ID`, which Convex functions were
reused vs created, the deployment pushed to, and the index entry added.
