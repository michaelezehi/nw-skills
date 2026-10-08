---
description: Add an OpenRouter client with automatic model fallback — detects framework and existing AI SDK usage, then wires it in.
argument-hint: [provider/model notes]
---

# /ai:implement — Add OpenRouter Fallback Chain

You are implementing an OpenRouter client with automatic model fallback for the current project. Follow these steps precisely.

## Step 1 — Detect

Scan the project to determine:

1. **Framework** — check in order:
   - `convex/` directory exists → **Convex**
   - `@nestjs/core` in package.json deps → **NestJS**
   - `next.config.*` exists → **Next.js**
   - `hono` in deps → **Hono**
   - `express` in deps → **Express**
   - Otherwise → **vanilla Node**

2. **Existing AI calls** — grep for these patterns:
   - `@anthropic-ai/sdk` or `new Anthropic(` → Anthropic SDK
   - `openai` import or `new OpenAI(` → OpenAI SDK
   - `@ai-sdk/` or `import { generateText` → Vercel AI SDK
   - `fetch("https://api.openai.com` or `fetch("https://api.anthropic.com` → raw fetch
   - Existing `openrouter` imports → already migrated

3. **Existing client** — check if an `openrouter.ts` or `openrouter.client.ts` already exists

Report findings before proceeding. If an existing OpenRouter client is found, ask the user whether to update it or skip client creation.

## Step 2 — Create Client

Place the client file based on framework:

| Framework | Path |
|-----------|------|
| Convex | `convex/ai/openrouter.ts` |
| NestJS | `src/modules/ai/openrouter.client.ts` |
| Next.js | `lib/ai/openrouter.ts` |
| Hono/Express/Node | `src/lib/openrouter.ts` |

### Template

```typescript
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const PRIMARY_MODELS = [
  "google/gemini-3-flash-preview",
  "qwen/qwen3-235b-a22b-2507",
];

const FALLBACK_MODELS = [
  "google/gemini-2.5-flash",
  "mistralai/mistral-small-3.2-24b-instruct",
  "openai/gpt-4o-mini",
];

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterOptions {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

async function callModel(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: OpenRouterOptions,
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? 30_000,
  );

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 512,
        temperature: opts.temperature ?? 0.7,
        messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${model} returned ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${model} returned empty content`);
    return content;
  } catch (error) {
    const label =
      error instanceof Error && error.name === "AbortError"
        ? "timeout"
        : String(error);
    console.warn(`[openrouter] ${model} failed: ${label}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Call OpenRouter with automatic model fallback chain.
 * Tries primary models first, then fallbacks. Returns null only if all fail.
 */
export async function openRouterChat(
  messages: ChatMessage[],
  opts: OpenRouterOptions = {},
): Promise<{ content: string; model: string } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const models = [...PRIMARY_MODELS, ...FALLBACK_MODELS];

  for (const model of models) {
    const content = await callModel(apiKey, model, messages, opts);
    if (content) return { content, model };
  }

  return null;
}
```

**Adapt the template:**
- For NestJS: wrap in an injectable service class
- For Convex: add `"use node"` if the file uses Node APIs and is in the convex/ dir
- Add project-specific `HTTP-Referer` and `X-Title` headers if the project has a known domain/name

## Step 3 — Migrate

For each file with existing direct AI provider calls, replace with `openRouterChat()`.

### Migration patterns

**Anthropic SDK → openRouterChat:**
```typescript
// Before
const msg = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: prompt }],
});
const result = msg.content[0].text;

// After
const result = await openRouterChat(
  [{ role: "user", content: prompt }],
  { maxTokens: 1024 },
);
```

**OpenAI SDK → openRouterChat:**
```typescript
// Before
const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: prompt }],
});
const result = completion.choices[0].message.content;

// After
const result = await openRouterChat(
  [{ role: "user", content: prompt }],
);
```

**Vercel AI SDK → openRouterChat:**
```typescript
// Before
const { text } = await generateText({
  model: openai("gpt-4o"),
  prompt,
});

// After
const result = await openRouterChat(
  [{ role: "user", content: prompt }],
);
const text = result?.content;
```

### Do not migrate (flag for manual work)

- Streaming responses (SSE / ReadableStream / `.stream()`)
- Function/tool calling (`tools:` parameter)
- Embeddings (`embed()` or `/embeddings` endpoint)
- Image generation

For each skipped call, add a `// TODO: migrate to OpenRouter (streaming/tools/embeddings)` comment and list it in the report.

## Step 4 — Environment Variables

Add `OPENROUTER_API_KEY` to:
- `.env.example` (if it exists) — with placeholder value
- `.env.local` or `.env` (if it exists) — with placeholder value
- Docker compose env section (if `docker-compose*.yml` exists)
- Convex env (remind user to run `npx convex env set OPENROUTER_API_KEY <key>`)

Do not overwrite existing `OPENROUTER_API_KEY` values; they may be real keys.

## Step 5 — Report

Print a summary:

```
## OpenRouter Implementation Report

**Framework:** [detected]
**Client created:** [path]

### Migrated
- [file:line] — [what was replaced]

### Skipped (manual migration needed)
- [file:line] — [reason: streaming/tools/embeddings]

### Environment
- [what was added where]

### Removed dependencies (safe to uninstall)
- [package] — no longer imported anywhere
```

After the report, check if any AI SDK packages (`@anthropic-ai/sdk`, `openai`, `@ai-sdk/*`) are no longer imported anywhere. If so, suggest removing them.

## Step 6 — API Key Check

After the report, check whether an `OPENROUTER_API_KEY` value actually exists in the project's environment:

1. Check `.env`, `.env.local`, `.env.development`, `.env.production` for a non-empty `OPENROUTER_API_KEY=` value
2. For Convex projects, run `npx convex env get OPENROUTER_API_KEY` to check if it's set

If no key is found (missing or placeholder), prompt the user:

> Your `OPENROUTER_API_KEY` is not set yet. Paste your key and I'll add it to the right env file, or you can set it manually.
>
> Get one at: https://openrouter.ai/keys

If the user provides a key:
- For Convex: run `npx convex env set OPENROUTER_API_KEY <key>`
- For other frameworks: write it to `.env.local` (create if needed), never `.env.production`
- Confirm it was saved

If a valid key already exists, skip this step silently.
