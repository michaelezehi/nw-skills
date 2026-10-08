# Phase 3 recipe — publishing surface: detect, adapt, or scaffold

## 1. Detection order (always before scaffolding)

1. `app/blog/**` or `pages/blog/**` exists → use it.
2. `content/`, `posts/`, `articles/` MDX/MD directories → use them.
3. A post registry in code — Grep `lib/` and `src/lib/` for exports like `posts`, `articles`, `getAllPosts` feeding a `[slug]` route (e.g. OTF's `lib/posts.ts` → `/community/[slug]`). → **Adapt**: add new entries in that system's own format; do not build a parallel blog.
4. Nothing found → scaffold (section 3) after the user confirms the file plan.

## 2. Stack matrix

| Stack | Action |
|---|---|
| Next.js App Router | Scaffold below |
| Next.js Pages Router | Same shape with `pages/blog/[slug].tsx` + `getStaticProps`; llms.txt (only if opted in) via `pages/api` rewrite or `public/llms.txt` (regenerated each batch) |
| Astro | Content collections (`src/content/blog/` + zero extra deps); llms.txt (only if opted in) as static endpoints |
| Vite SPA / no SSR | Drafts-only mode: articles land in `_seo/drafts/*.mdx`; calendar tracks them; user publishes elsewhere |
| No web surface | Drafts-only mode. Offer to scaffold a minimal standalone Next.js site only if the user explicitly opts in |

## 3. Next.js App Router scaffold

Dependencies (detect the package manager from the lockfile): `gray-matter`, `next-mdx-remote` (+ `@tailwindcss/typography` if Tailwind present). Rejected: contentlayer (unmaintained), `@next/mdx` (file-as-route blocks a templated `[slug]` page with frontmatter-driven metadata/schema).

Files (never overwrite; show this plan and get consent first):

```
content/blog/                       # articles (templates/article.template.mdx schema)
lib/blog.ts                         # types + fs readers + postToPlainText
app/blog/page.tsx                   # index page
app/blog/[slug]/page.tsx            # article page
app/blog/rss.xml/route.ts           # optional — offer, don't force
edits: app/sitemap.ts               # append blog URLs

# Only when the llms.txt opt-in is active (see SKILL.md Phase 1 / llms-txt reference):
app/blog/[slug]/llms.txt/route.ts   # per-article plain text
edits: app/llms.txt/route.ts        # article index reads lib/blog automatically
```

### `lib/blog.ts`

```ts
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface PostFrontmatter {
  title: string;
  description: string;
  slug: string;
  date: string;
  author: string;
  cluster: string;
  keywords: string[];
  image?: string;
  faq: { q: string; a: string }[];
  sources: { title: string; url: string }[];
}

export interface Post extends PostFrontmatter {
  body: string;
}

const BLOG_DIR = path.join(process.cwd(), "content/blog");

export function getAllPosts(): Post[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => {
      const { data, content } = matter(fs.readFileSync(path.join(BLOG_DIR, f), "utf8"));
      return { ...(data as PostFrontmatter), body: content };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): Post | undefined {
  return getAllPosts().find((p) => p.slug === slug);
}

export function postToPlainText(post: Post): string {
  const body = post.body
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/^import .*$/gm, "");
  const faq = post.faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");
  const sources = post.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n");
  return `# ${post.title}\n\n${post.description}\n\nBy ${post.author} — ${post.date}\n\n${body}\n\n## FAQ\n\n${faq}\n\n## Sources\n\n${sources}\n`;
}
```

### `app/blog/[slug]/page.tsx` (shape — adapt imports/styling to the project)

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { JsonLd } from "@/components/shared/JsonLd"; // created by the geo skill

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `${SITE_URL}/blog/${post.slug}` },
    openGraph: { title: post.title, description: post.description },
    twitter: { card: "summary_large_image", title: post.title, description: post.description },
  };
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();
  return (
    <article className="prose mx-auto">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          author: { "@type": "Person", name: post.author },
          mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
        }}
      />
      {/* FAQPage schema is a bonus, not the signal: Google dropped FAQ rich
          results (May 2026) and LLMs read the visible FAQ section below. Kept
          because the frontmatter already structures the data (geo's shared-const
          condition) — never add it where the Q&A isn't also visible on-page. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: post.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
            { "@type": "ListItem", position: 3, name: post.title },
          ],
        }}
      />
      <h1>{post.title}</h1>
      <MDXRemote source={post.body} />
      <section>
        <h2>FAQ</h2>
        {post.faq.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </section>
    </article>
  );
}
```

`app/blog/page.tsx`: metadata + cluster-grouped list of `getAllPosts()` + `Blog`/`ItemList` JSON-LD. Match the project's existing list-page styling — read a sibling marketing page first and mirror its components.

### Sitemap edit

Append to the existing `app/sitemap.ts` return (mirror how it already builds routes):

```ts
...getAllPosts().map((p) => ({
  url: `${SITE_URL}/blog/${p.slug}`,
  lastModified: p.date,
  changeFrequency: "monthly" as const,
  priority: 0.6,
})),
```

## 4. Safety rules

- Show the file plan; write only after consent. Never overwrite an existing file.
- Style the pages with the project's own components/design tokens — read the landing page first.
- Run the app's typecheck after scaffold changes; fix errors before writing articles.
- If the project's CLAUDE.md caps file sizes, respect it (split `lib/blog.ts` if needed).
