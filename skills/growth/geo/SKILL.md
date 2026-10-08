---
name: geo
description: Scan and optimize any project for GEO (Generative Engine Optimization) + SEO — structured data, sitemaps, robots.txt, metadata, AI crawler access, content signals. Use when the user says /geo, "SEO audit", "are we indexable", "AI crawlers", "structured data", "sitemap", or before launch. For content pipelines on top of this, use grow-seo-aeo.
argument-hint: [audit | metadata | schema | sitemap | robots | content | all]
---

Optimize this project for both traditional SEO and Generative Engine Optimization (GEO) — ensuring content ranks in search AND gets cited by AI-powered engines (Google AI Overviews/AI Mode, ChatGPT search, Perplexity, Claude).

The Princeton/Georgia Tech baseline (arXiv:2311.09735) showed citations, statistics, and expert quotes lift AI-engine visibility 30-40%. Large-scale citation studies since add: engines retrieve **passages, not pages** (only ~12% of AI-cited URLs sit in Google's organic top 10); ~44% of citations come from the first 30% of a document; recently-updated content earns ~3x more Perplexity citations; and AI crawlers do **not** execute JavaScript — client-rendered content is invisible to every engine except Google.

## Step 1: Read Project Context

Before doing anything, understand the project:

1. **Read CLAUDE.md** (root and `.claude/` if present) — extract product description, brand rules, positioning, copy rules
2. **Read package.json** — project name, framework (next, vite, remix, etc.), dependencies
3. **Detect framework:**
   - `next` in dependencies → Next.js. Check for `app/` (App Router) or `pages/` (Pages Router)
   - `vite` → Vite/React (warn: client-rendered content is invisible to AI crawlers unless prerendered); other → flag as unsupported, still audit what's possible
4. **Map public routes** — Glob for `**/page.tsx` or `**/page.jsx` in the app directory. Categorize:
   - **Public marketing** — landing, pricing, about, FAQ, blog, legal pages
   - **Auth** — sign-in, sign-up, forgot-password (noindex)
   - **Dashboard/app** — behind auth (noindex)
   - **Dynamic public** — forms, surveys with tokens (case-by-case)
5. **Check metadataBase** — look in root layout for `metadataBase` to get the canonical domain

## Step 2: Audit (Always Runs First)

Scan the project and score each GEO+SEO category. Use Glob and Grep to check for files and patterns.

### Audit Checklist

**A. Metadata Coverage**
- Grep for `export const metadata` and `export async function generateMetadata` in all page.tsx and layout.tsx
- Count: pages with metadata / total public pages
- Check root layout for: title, description, openGraph, twitter

**B. Structured Data (JSON-LD)**
- Grep for `application/ld+json` across the project
- Check for: Organization, WebSite, SoftwareApplication, FAQPage, Article, BreadcrumbList schemas
- Check for a reusable JsonLd component

**C. Sitemap**
- Check for `app/sitemap.ts`, `app/sitemap.xml`, or `public/sitemap.xml`
- If exists, verify it lists all public routes with lastmod dates

**D. Robots Configuration**
- Check for `app/robots.ts` or `public/robots.txt`
- If exists, check for AI crawler rules — and flag dead directives (`Claude-Web` and `anthropic-ai` are deprecated tokens; rules targeting them do nothing)

**E. AI Crawler Access + Renderability**
- Check if robots config ALLOWS the crawlers that produce citations: OAI-SearchBot + ChatGPT-User (GPTBot is training-only), PerplexityBot, Claude-SearchBot + Claude-User (ClaudeBot is training-only). Googlebot/Bingbot come via `*` — AI Overviews/AI Mode run off Googlebot's index; ChatGPT search grounds in Bing's
- Google-Extended is a Gemini-**training** opt-out token, not a crawler — blocking it does NOT remove a site from AI Overviews or AI Mode
- Renderability: confirm public content is server-rendered (SSR/SSG) — AI crawlers fetch raw HTML only, no JS execution
- If `llms.txt` exists, note it but score nothing: no major engine consumes it (~97% of published files get zero AI-bot requests; Google compares it to the keywords meta tag). Don't create one except for developer-docs sites

**F. Meta Robots Snippet Directive**
- Check for `max-snippet: -1` in metadata — snippet controls are Google's documented lever for what AI Overviews/AI Mode may display; `-1` allows unlimited passage extraction
- Conversely `nosnippet`/`data-nosnippet` keep content OUT of AI answers — flag if present on public marketing pages

**G. Semantic HTML**
- Check marketing/landing pages for proper semantic elements: `<article>`, `<section>`, proper heading hierarchy (h1 > h2 > h3)
- Check for `<blockquote>`, `<cite>`, `<time>` elements where appropriate

**H. Content GEO Signals**
- Check landing/marketing content for:
  - Statistics with sources (numbers + citations)
  - Expert quotations with attribution
  - Clear product definition in first 2-3 sentences
  - FAQ section with direct Q&A format
  - Comparison tables

### Print Scorecard

```
📊 GEO + SEO Audit
━━━━━━━━━━━━━━━━━━

A. Metadata Coverage     [✅|⚠️|❌] X/Y pages
B. Structured Data       [✅|⚠️|❌] Types found: ...
C. Sitemap              [✅|⚠️|❌] Status
D. Robots Config        [✅|⚠️|❌] Status
E. AI Crawler Access    [✅|⚠️|❌] Citation crawlers allowed + SSR
F. Snippet Directive    [✅|⚠️|❌] max-snippet status
G. Semantic HTML        [✅|⚠️|❌] Assessment
H. Content GEO Signals  [✅|⚠️|❌] Stats/citations/quotes found

GEO Score: XX/100

Quick Wins:
1. ...
2. ...
3. ...
```

**Scoring:**
- Each category is worth up to 12.5 points (8 × 12.5 = 100)
- ✅ = full points, ⚠️ = half points, ❌ = 0 points

Every count on the scorecard (pages with metadata, routes in the sitemap, schema types) comes from a grep or glob run in this session. Say plainly which figures are unverified.

**If scope is `audit`, stop here.** Print the scorecard and recommendations. Do not modify files.

## Step 3: Fix (Runs for All Non-Audit Scopes)

Based on scope argument, generate or modify files. Always confirm with the user before modifying existing content (not metadata/technical files).

### Scope: `robots` or `all`

Create `app/robots.ts` (Next.js App Router):

```typescript
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "{{metadataBase from layout}}";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", "/admin/", "/dashboard/", "/edit/"],
      },
      // Citation/search crawlers — these drive AI answer visibility
      { userAgent: "OAI-SearchBot", allow: "/" },
      { userAgent: "ChatGPT-User", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "Claude-SearchBot", allow: "/" },
      { userAgent: "Claude-User", allow: "/" },
      // Training crawlers: a content-rights call, ask the user.
      // Blocking these does not affect citations.
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" }, // Gemini training + Vertex grounding opt-in
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

Adapt disallow paths to the actual route groups found in step 1. Do not add `Claude-Web` (deprecated). Googlebot and Bingbot are covered by `*` — but since ChatGPT search grounds in Bing's index, recommend Bing Webmaster Tools + IndexNow if AI citations matter.

### Scope: `sitemap` or `all`

Create `app/sitemap.ts`:

```typescript
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "{{metadataBase}}";
  return [
    // List all public marketing routes found in step 1
    // Each with url, lastModified (today's date), changeFrequency, priority (home 1.0, others 0.8)
    // Do NOT include auth, dashboard, admin, API, or token-based dynamic routes
  ];
}
```

### Scope: `schema` or `all`

1. **Create `components/shared/JsonLd.tsx`** if it doesn't exist:

```tsx
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/<\/script/gi, "<\\/script");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
```

2. **Add Organization JSON-LD to root layout** — name, url, logo, description from CLAUDE.md context

3. **Add WebSite JSON-LD to home page** — name, url, description, publisher ref

4. **Add SoftwareApplication JSON-LD** (if SaaS product) — name, category, operatingSystem: "Web"

5. **FAQPage JSON-LD is now optional** — Google stopped displaying FAQ rich results entirely (May 2026), and LLMs read the visible Q&A text, not the markup. Prioritize clean on-page Q&A structure; add the schema only where the Q&A data is already exported as a shared const

6. **Add BreadcrumbList JSON-LD** to all public pages — structured navigation path

### Scope: `metadata` or `all`

For each public marketing page missing metadata:

1. Add `export const metadata: Metadata = { ... }` with:
   - `title` — descriptive, includes primary keyword, under 60 chars
   - `description` — factual, specific (include a product claim), under 160 chars
   - `openGraph` — title, description, image, url
   - `twitter` — card: "summary_large_image", title, description, image
   - `alternates: { canonical: "{{baseUrl}}/{{path}}" }`

2. Update root layout metadata to include:
   - `robots: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" as const }`

Follow brand and copy rules from CLAUDE.md. If the project says "no AI in copy", do not use "AI" in any metadata descriptions.

### Scope: `content` or `all`

For marketing/landing pages, recommend (and implement with confirmation):

1. **Definition block** — Ensure the hero or first section has a clear, self-contained 1-2 sentence product definition that could be extracted by an AI engine as a complete answer. Front-load: ~44% of AI citations come from the first 30% of a page
2. **Answer-first passages** — Each `<h2>`/`<h3>` section should open with a 1-3 sentence direct answer before elaborating; engines retrieve self-contained chunks, not whole pages
3. **Semantic HTML** — Wrap major content sections in `<article>` or `<section>` with proper heading hierarchy; add visible dates (`<time>`, dateModified) — freshness measurably increases citations
4. **FAQ optimization** — Ensure FAQ section uses clear Q&A format extractable by AI engines
5. **Recommend** (don't auto-generate): where to add statistics, citations, expert quotes, or comparison tables — flag specific sections. Off-page, branded mentions are the strongest correlate of AI Overview visibility; note it, don't build it

## Rules

- **Never invent content.** Only restructure, tag, and optimize what exists. Recommend where new content (stats, citations) would help.
- **Respect brand rules.** Read CLAUDE.md and follow all copy/naming rules.
- **Prefer editing over creating.** Don't create new components if existing ones can be modified.
- **Public pages only.** Don't add metadata or schema to auth/dashboard/admin routes.
- **Export shared data.** If FAQ data or similar content is needed for both UI and schema, export it as a named const rather than duplicating.
- **Framework-specific.** Use Next.js App Router conventions (Metadata type, sitemap.ts, robots.ts). Don't use generic HTML approaches.

## After Completion

Print a summary of changes made:
```
✅ GEO Optimization Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Created:
- app/robots.ts — AI crawler access configured
- app/sitemap.ts — X public routes mapped
- components/shared/JsonLd.tsx — reusable schema component

Modified:
- app/layout.tsx — Organization JSON-LD + robots meta
- app/page.tsx — WebSite + FAQ schema + page metadata

GEO Score: Before → After (+X points)

Remaining recommendations:
- Add 2-3 statistics with sources + an expert/customer quote with attribution
- Register with Bing Webmaster Tools + IndexNow (ChatGPT search grounds in Bing)
- Create author/team page with credentials (E-E-A-T signal)
```
