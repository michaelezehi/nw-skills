---
name: crm-crush-product
description: Research a product created in Crush CRM and prefill everything it needs to sell - description, framing, audiences, value propositions, call knowledge, never-claim list, pricing and contacts - written to our sales technique, plus a marketing strategy. Use when a new product is created in Crush CRM, when the user pastes a crm-crush.com/products?id=... or localhost:3000/products?id=... link, or asks to research, fill, rewrite or "do" a product's copy, emails or call rules.
---

# crm-crush-product

Takes a product that exists in Crush CRM, researches it, and fills every field
the email and call agents read, following
`references/sales-techniques.md` (read it first, every time). Runs from the
crush-crm repo: `~/Documents/src/__new-world__/crush-crm`.

## Input

- A product id: the `id=` of `https://crm-crush.com/products?id=...` (prod) or
  `http://localhost:3000/products?id=...` (local). crm-crush.com means prod.
- Workspace check: products in the Unframed or Renovyn workspaces are ours. A
  product owned by anyone else (a customer, a teammate's own workspace) is
  not: stop and ask before writing to it.

## Step 1: read the product

Prod admin key lives on the droplet; never commit it, never print it.

```bash
SP=<scratchpad>; KEY=$(ssh -o BatchMode=yes root@203.0.113.40 'cat /opt/convex-crush-prod/admin.key')
printf 'CONVEX_SELF_HOSTED_URL=https://api.crm-crush.com\nCONVEX_SELF_HOSTED_ADMIN_KEY=%s\n' "$KEY" > $SP/prod.env
env -u CONVEX_DEPLOYMENT npx convex data --env-file $SP/prod.env products --limit 200 --format jsonLines > $SP/products.jsonl
```

Local uses `http://127.0.0.1:3210` and the key in
`.convex/local/default/config.json`. Pull the product row to
`$SP/product.json`, and from `workspaceMembers` + `users` the user id of the
workspace owner (or an admin): writes run as that user with
`--identity '{"subject":"<userId>|cli","issuer":"https://api.crm-crush.com"}'`.

Note what is already there (the create flow writes a description, framing,
audiences, value propositions and one template set from the website). Keep
what is right, rewrite what breaks the rules.

## Step 2: research

Write `_r&d/products/<slug>/<MM-DD>/RESEARCH.md`, every claim with a source
and a confidence (HIGH official, MEDIUM two sources, LOW one).

1. The website: WebFetch the home page, product or features pages, pricing,
   about, contact, security or privacy, and the sitemap if there is one.
   Record exactly what the product does, for whom, the words it uses, the
   price if published, and the contact email and phone shown.
2. Sibling products: read the other products in the same workspace. Never
   claim for this product what belongs to a sibling (Unframed HR does not
   recruit; Unframed ATS does).
3. Competitors: WebSearch the category; 3 to 5 named competitors, what they
   lead with, where this product differs. Only verifiable differences.
4. Hooks per market the product will sell into: dated rule changes or
   verifiable facts a buyer in that seat would care about (for hiring:
   right-to-work checks, pay transparency, probation or dismissal rules). Each
   verified on an official or law-firm page with the date. Unverified hooks
   are listed as unverified and never used in copy.
5. Buyer map: for each audience, the job, the pain in their words, the
   outcome (see Persona in the reference), the objection they will raise.

## Step 3: write the fields

| Field | What goes in |
|---|---|
| `description` | Two or three plain sentences: what it is, who it is for, what changes for them. |
| `framing` | The "What we say" doc: who we are (one line), what we do (one paragraph), one pitch, three short lines the team may use. No puffery. |
| `audienceCategories` | Up to seven buyer titles, the ones the research says buy. Keep the create flow's list unless the research says otherwise. |
| `valuePropositions` | One per audience: the outcome for that seat in two sentences, claims only from the research. |
| `callKnowledge` | The agent's only facts, in labelled paragraphs, like Unframed HR's: What it is. Who it is for. The problem it solves. What is in the product, by area (one paragraph per area). What is live today, by market. Price (only if asked, as FIXED WORDING). The next step we offer. What we do not claim. Then "- \"question\" answer" lines for the ten questions buyers ask most (what do you do, how is it different from X, does it integrate with Y, is it AI, where is data held, price, can I see it, who uses it, what does it replace, what else do you do). |
| `callNeverClaim` | Everything a buyer might assume that is not true or not verified: integrations, markets, certifications, customer names, figures, sibling products' features. |
| `pricing` | Only a published price, one line per market in the same shape as Unframed HR's. None published: leave empty and say so in the report. |
| `competitorUrls`, `competitorNotes` | From step 2.3. |
| `website`, `contactEmail`, `contactPhone` | From the site. Never invent. |

The product stores no email templates or call scripts to fill: since 24 Sep
2026 the writer writes every email, and the call agent runs every call, from
these fields and the sales rules. Old templates and scripts stay as history.

Unslop every line. Then run the checker from the repo root and fix until it
passes:

```bash
npx tsx ~/.claude/skills/crm-crush-product/scripts/check-copy.ts $SP/product.json $SP/rows.json
```

## Step 4: save through the app

**One writer at a time.** Check for another session working on the same
product (`ListAgents`). On 23 Sep two fills of X-Unframed ATS were blanked
seconds after they landed by an open product edit page whose Save sent every
field from a stale copy. Since commit 2959e5e8 the page saves only the fields
it changed and takes server changes into the rest; a tab loaded before that
ship still runs the old code, so ask the user to reload any open product page.

One `products:update` call with every field, run as the workspace owner. It
records a version of every email and call-copy slot it changes; the old copy
stays restorable. Never patch the document directly, never delete versions.

```bash
env -u CONVEX_DEPLOYMENT npx convex run --env-file $SP/prod.env --identity '<identity>' products:update "$(cat $SP/update.json)"
```

## Step 5: verify

- Read the product back a minute after the save, not straight away: every
  field matches what you wrote. A field back to empty means an open edit page
  saved over it; the version you wrote is in `copyVersions`, restore it once
  the page is closed.
- `copyVersions` has a row for every changed slot.
- check-copy on the saved product: `ALL VALID`.
- `RESEARCH.md` gives a source and a confidence for every claim the fields
  make.

## Step 6: marketing strategy

Write `_r&d/products/<slug>/<MM-DD>/STRATEGY.md`: the buyer map, the first
campaign per market (audience, list source, hook, email sequence of four to
seven touches each adding something new, when the call step comes in), the
objections and answers, what to measure in the first 35 conversations, and
the open questions for the team (price not published, unverified hooks,
integrations to confirm). Offer to publish it as an artifact.

## Report

A short table: each field, before and after in one line, plus the checker
result and the versions kept. Name anything left empty and why. Before
reporting, check each claim against a tool result from this session; say
plainly what is unverified. Delete `$SP/prod.env` and the data dumps.
