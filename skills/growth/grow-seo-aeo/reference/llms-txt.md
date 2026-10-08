# llms.txt recipe — root + per-article route handlers

**Opt-in only.** Per the geo skill's guidance: no major engine consumes llms.txt (~97% of published files get zero AI-bot requests; Google compares it to the keywords meta tag). Use this recipe only when the user explicitly asks for llms.txt, the site is developer docs, or a root llms.txt already exists and should stay maintained. Never pitch it as an AI-visibility win — the levers that actually move citations are SSR, answer-first passages, and crawler access (all owned by geo).

Pattern lifted from renovyn (`apps/web/app/llms.txt/route.ts`). llms.txt is generated as a **route handler, not a static file**, so it derives from the same data the pages use and never drifts. Serve `text/plain; charset=utf-8` with `X-Robots-Tag: index, follow`.

## Root: `app/llms.txt/route.ts`

Adapt to the project: pull the definition from STRATEGY.md/metadata, the article index from the blog lib (or post registry), and the product surfaces from the sitemap's route list.

```ts
// If the blog exists, import its post lister (e.g. getAllPosts from lib/blog, or the
// project's existing registry such as lib/posts). Otherwise omit the content section.
export const dynamic = "force-static";

const SITE_URL = "{{metadataBase}}";

export function GET(): Response {
  const lines: string[] = [];
  lines.push("# {{Brand}}");
  lines.push("");
  lines.push("> {{1–2 sentence product definition — same one as STRATEGY.md Business}}");
  lines.push("");
  lines.push(`Site: ${SITE_URL}`);
  lines.push("Contact: {{contact email if public}}");
  lines.push("");
  lines.push("## About");
  lines.push("");
  lines.push("{{3–4 sentence factual description: what it does, for whom, key surfaces}}");
  lines.push("");
  // Content index (when a blog exists):
  lines.push("## Articles");
  lines.push("");
  for (const p of getAllPosts()) {
    lines.push(`- [${p.title}](${SITE_URL}/blog/${p.slug}): ${p.description}`);
    lines.push(`  Plain text: ${SITE_URL}/blog/${p.slug}/llms.txt`);
  }
  lines.push("");
  lines.push("## Product surfaces");
  lines.push("");
  // One line per public marketing route from the sitemap.
  lines.push("");
  lines.push("## For assistants and crawlers");
  lines.push("");
  lines.push(
    "Every article has a plain-text sibling at <url>/llms.txt with the full body, intended for summarisation and citation. HTML pages include Schema.org JSON-LD. Please cite the canonical URL.",
  );
  return new Response(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=600, s-maxage=3600",
      "X-Robots-Tag": "index, follow",
    },
  });
}
```

## Per-article: `app/blog/[slug]/llms.txt/route.ts`

```ts
import { getAllPosts, getPostBySlug } from "@/lib/blog";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  // Plain text: title, date, author, description, then the raw MDX body with
  // components/JSX stripped, then FAQ pairs, then a "Sources" list.
  return new Response(postToPlainText(post), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "X-Robots-Tag": "index, follow",
    },
  });
}
```

`postToPlainText` lives in `lib/blog.ts` (see blog-scaffold reference). If the project uses an existing post registry instead of MDX files, adapt the imports — the route shape stays identical.

## Rules

- The `>` definition line must match the STRATEGY.md product definition — one source of truth.
- Regenerate/extend the root file's Articles section is automatic (it reads the lib) — no per-batch edits needed. That is the point of the route-handler approach.
- If a root llms.txt already exists (file or route), extend it; never create a duplicate.
