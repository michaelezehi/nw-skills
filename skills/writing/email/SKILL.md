---
name: email
description: Engineering guide for building AI-powered email generation features. Unslop always applies first. Use when writing LLM prompts, validators, or systems that generate outreach emails. Ensures output sounds human, not like AI slop.
argument-hint: [prompt | validator | system | audit]
---

# AI Email Generation Engineering Skill

## Parent skill

Emails are people-facing. Apply `unslop` first (`~/.claude/skills/unslop/SKILL.md`,
or `agent-skills/unslop/SKILL.md` in x-unframed). Em dashes are prohibited.
Period or comma only. No en dash, hyphen-as-dash, or parentheses as a dash
stand-in.

Use this skill whenever you are building, modifying, or reviewing code that uses an LLM to generate emails. This includes: system prompts, user prompts, post-generation validators, email template systems, and outreach pipelines.

The goal: every email your system produces must pass the read-aloud test. If a human recipient would suspect it was AI-generated, the system failed. (The stakes are measured: professionals rate heavily-AI-written mail as sincere roughly half as often as lightly-assisted mail, and fully AI-written emails get spam-flagged ~2.7x more.)

---

## Part 1: The Banned Vocabulary Registry

Every email generation system enforces this list twice, in the prompt and in a post-generation validator, because the prompt alone leaks. Keep it in one file so the two cannot drift apart.

Tells drift by model era: classic GPT-4 tells (delve, tapestry) have faded in newer output, while current models lean on emphasizing/highlighting/showcasing and contrastive framing. Keep the classics banned (older models still emit them) and expect to extend this list.

### Banned Words

**Verbs:** delve, leverage, utilize, harness, streamline, foster, embark, augment, facilitate, spearhead, synergize, revolutionize, supercharge, turbocharge, empower, elevate, amplify, unlock, underscore, showcase, garner, boast

**Adjectives:** pivotal, robust, innovative, seamless, cutting-edge, comprehensive, groundbreaking, transformative, unprecedented, dynamic, holistic, impactful, game-changing, crucial, intricate, meticulous, vibrant

**Nouns:** landscape, realm, tapestry, synergy, paradigm, beacon, journey, ecosystem, treasure trove, underpinnings, bandwidth, deep dive, value-add, testament, myriad

**Transitions:** furthermore, moreover, consequently, notably, importantly, additionally, in conclusion, in summary, it's worth noting, it's important to note

### Banned Phrases

"I hope this finds you well", "I trust this finds you", "Please don't hesitate", "at your earliest convenience", "I would love to connect", "your support is invaluable", "we offer comprehensive solutions", "I wanted to reach out", "reaching out because", "I came across", "thought leadership", "best-in-class", "world-class", "end-to-end", "at scale", "pain point", "low-hanging fruit", "move the needle", "circle back", "touch base", "here's the thing", "evolving landscape", "pivotal moment", "serves as", "stands as", "aligns with"

### Banned Constructions

- `it's not X, it's Y` / `not because X, but because Y` — contrastive framing, now the most-cited AI tell (LinkedIn began algorithmically demoting it in May 2026)
- `not just X, but also Y`
- `whether it's X or Y` (listing abstract benefits)
- `from X to Y` (listing abstract benefits)
- Rule of three — three parallel adjectives or clauses ("fast, simple, and powerful")
- Copula avoidance — "represents" / "marks a" where "is" would do

### Implementation Pattern

```typescript
// Export from a single file (e.g., emailValidator.ts)
export const BANNED_WORDS = [...] as const;
export const BANNED_PHRASES = [...] as const;
export const BANNED_CONSTRUCTIONS = [
  /not\s+because\s+.{3,40},?\s*but\s+because/i,
  /not\s+just\s+.{3,40},?\s*but\s+(?:also\s+)?/i,
  /whether\s+it'?s\s+.{3,30}\s+or\s+/i,
  /\bit'?s\s+not\s+(?:about\s+)?.{3,40}[,.;]\s*it'?s\b/i,
] as const;

// Generate the prompt block from the same source
export function bannedVocabPromptBlock(): string {
  return `BANNED VOCABULARY (never use):
Words: ${BANNED_WORDS.join(", ")}
Phrases: ${BANNED_PHRASES.join("; ")}
Constructions: never use "not because X, but because Y", "not just X, but also Y", or "whether it's X or Y".`;
}
```

---

## Part 2: System Prompt Rules

When writing any LLM system prompt that generates email content, include every one of these rules. Adapt the wording to your context; each rule closes a specific tell, so dropping one lets it back in.

### Writing Rules (embed in every email system prompt)

```
1. No em dashes. Use a comma, a period, or rewrite.
2. No filler openers. Never start with a problem statement about the industry.
   Never begin with: "Hope this finds you well", "I wanted to reach out",
   "In today's...", "In an era of...", "The challenge of...".
3. [Insert bannedVocabPromptBlock() output here]
4. No passive voice. Active voice only.
5. Vary sentence length. At least one under 6 words. At least one over 15.
   Never three similar-length sentences in a row.
6. Use contractions: you're, we've, it's, don't. Email, not a press release.
7. Deliberate imperfection. Include at least one: sentence fragment, sentence
   starting with "And" or "But", or an informal aside. Too-perfect grammar
   signals a machine.
8. No consultant register. If a sentence could appear in a McKinsey slide deck,
   rewrite in plain English.
9. Subject line: max 6 words. Lowercase feel. No question marks. No exclamation
   marks. No "Quick question", "Reaching out about", "Checking in".
10. Under 100 words for the email body. If longer, it's not done yet.
11. CTA requires zero effort from the recipient. Yes/no question, specific time
    offer, or one-word-reply prompt. Never ask them to self-diagnose or explain
    their process.
12. One stat beats three paragraphs. If a number proves it, lead with it.
13. Every sentence must prove something, ask for something, or give the reader
    a reason to keep reading. Nothing else earns its place.
14. No rule-of-three. Never three parallel adjectives, clauses, or list items
    ("fast, simple, and powerful"). Two or four, never three.
```

### Persona Framing

Always set the persona in the system prompt. Specific beats generic:

- Good: "Write like a busy founder who texts more than they email. Short sentences. Conversational. If you read it aloud and cringe, rewrite it."
- Bad (produces generic output): "Write in a professional and friendly tone."

### Messaging Rules (business logic layer)

```
1. The ONLY goal of the first email is to get a reply. Not to sell, not to book a call.
2. Never dump features. Pick ONE relevant to the recipient.
3. Never fabricate statistics, company names, or claims.
4. Never frame the recipient's work negatively.
5. Calibrate language to seniority and domain.
6. Research is context for you, not content for the email.
7. CTA must require zero work. Never ask open questions.
```

---

## Part 3: User Prompt Structure

### Required Blocks

Every user prompt that generates an email should include these sections:

```
1. TASK — "Write the 3 body paragraphs of a cold outreach email from [product] to [name]."
2. PRODUCT CONTEXT — what the product is, one key value prop
3. RECIPIENT CONTEXT — name, title, company, industry
4. RESEARCH BRIEF — labeled "for your context only, do NOT echo back"
5. PERSONALIZATION RULES — the hierarchy (see below)
6. DATA RULES — "never fabricate", "if limited data, write from product angle only"
7. STRUCTURE — what each paragraph should contain
8. OUTPUT FORMAT — JSON schema, no markdown fences
```

### Personalization Hierarchy (include in every user prompt)

```
PERSONALIZATION RULES:
- Use the strongest available signal:
  1. Trigger: funding round, job posting, product launch, news event
  2. Content: their blog post, LinkedIn post, podcast, talk
  3. Company: tech stack, hiring patterns, market moves
  4. Role: common challenges for their title/seniority
  5. Industry: sector trends (weakest, use only if nothing else)
- Must be verifiable. If the brief doesn't contain it, don't invent it.
- If nothing useful found, skip personalization. Write from product angle only.
```

### Few-Shot Voice Anchoring

If you have example emails from the sender, inject them:

```
VOICE EXAMPLES (match this voice exactly — real emails from the sender):
--- Example 1 (cold outreach to VP Sales):
[paste email]
---
Analyze the voice: sentence length, word choices, how they open, how they close.
Match it. Do not copy phrases verbatim.
```

Cap at 3 examples. Store on the product/campaign entity, not hardcoded.

---

## Part 4: Post-Generation Validator

Every email generation pipeline validates output before returning it to the user or sending it, because models break prompt rules some of the time (see the em dash line in Part 7).

### Validator Interface

```typescript
interface ValidationResult {
  passed: boolean;
  violations: Array<{
    rule: string;    // "banned_word" | "banned_phrase" | "banned_construction" |
                     // "word_count" | "subject_too_long" | "banned_subject_starter" |
                     // "em_dash" | "filler_opener"
    found: string;   // the offending text
    severity: "block" | "warn";
  }>;
  wordCount: number;
}
```

### Checks (in order)

1. **Banned word scan** — regex `\bword\b` against body text. Severity: `block`.
2. **Banned phrase scan** — case-insensitive substring match. Severity: `block`.
3. **Banned construction scan** — regex patterns. Severity: `block`.
4. **Word count** — strip HTML, count words. Over limit: `block`.
5. **Subject line** — over 8 words: `warn`. Banned starters ("quick question", "reaching out", "checking in", "following up"): `block`.
6. **Em dash** — any `—` remaining: `block`.
7. **Filler opener** — first sentence starts with "in today's", "in the world of", "in an era", "it's no secret": `block`.

### Retry Strategy

On block violations:
1. Build a feedback string from violations: `"VIOLATION: banned_word — found 'leverage'. Remove or replace this."`
2. Append to user prompt and re-generate ONCE
3. If the second attempt also fails, accept with logged warnings (never block the user)

---

## Part 5: Variant Strategy Pattern

When generating multiple email variants, use distinct strategies to test different hypotheses:

| Strategy | Hook | Word Cap | CTA |
|---|---|---|---|
| **Problem-led** | Open with a specific problem they face, stated as shared truth. No philosophy openers. | 100 | Zero-effort ask |
| **Insight-led** | Share a non-obvious insight from building the product. Guard against thought-leadership cliches. | 100 | Zero-effort ask |
| **Direct-ask** | Radically brief. Who you are, what you built, one question. | 60 | One direct question |

### Temperature Variance

When generating 3+ variants in parallel from the same model, vary temperature (e.g. 0.7 / 0.8 / 0.9 across strategies) to prevent convergence on near-identical drafts.

---

## Part 6: Deliverability Floor

Copy can't outrun infrastructure. Any pipeline that sends (not just drafts) must meet the 2026 baseline:

**Bulk senders (5,000+ msgs/day — Gmail + Yahoo since 2024, Microsoft consumer since May 2025):**
- SPF **and** DKIM **and** DMARC (minimum `p=none`, aligned From domain). Gmail hard-rejects failures with 5xx errors since Nov 2025; Microsoft rejects with `550 5.7.515`.
- RFC 8058 one-click unsubscribe on marketing mail (`List-Unsubscribe` + `List-Unsubscribe-Post` headers), honored within 2 days, plus a visible body link.
- Spam complaint rate under 0.1%, never 0.3% — at 0.3% Gmail withholds delivery mitigation until 7 consecutive clean days.

**Cold 1:1 outreach (sequencers, below bulk volume):**
- Plain text or minimal HTML. Logos, buttons, and images pattern-match to marketing mail.
- No open-tracking pixels — campaigns without them reply ~68% higher, and pixels inherit shared tracking-domain reputation.
- Opt-out: a plain-text line ("not relevant? reply and I'll stop") satisfies CAN-SPAM without the newsletter-classification signal a formal unsubscribe header adds. This is contested among deliverability vendors — pick one approach deliberately.
- Max 30-50 emails/inbox/day, dedicated sending subdomain (never the primary domain), 2-4 week warm-up ramp.

---

## Part 7: Architecture Checklist

When building or reviewing an email generation system, verify:

- [ ] Banned vocabulary lives in ONE file, imported by both prompt builder and validator
- [ ] System prompt includes all 14 writing rules
- [ ] System prompt sets a specific persona ("busy founder"), not a vague tone ("professional")
- [ ] User prompt includes personalization hierarchy
- [ ] User prompt labels research as "context only, do NOT echo back"
- [ ] Output format is constrained JSON (subject + body HTML)
- [ ] Post-generation validator runs before returning/sending
- [ ] Validator retries once on block, then accepts with warnings
- [ ] Subject lines capped at 6 words in the prompt
- [ ] Body capped at 100 words (60 for direct-ask)
- [ ] Em dashes stripped in post-processing (LLMs ignore this rule ~20% of the time)
- [ ] Duplicate greeting/sign-off stripped (LLMs add "Hi Name," even when told not to)
- [ ] Few-shot examples supported (stored on product/campaign, injected when available)
- [ ] Temperature varied across parallel variant generation
- [ ] If the pipeline sends: SPF/DKIM/DMARC verified, opt-out present, no tracking pixel (Part 6)

---

## Part 8: Performance Benchmarks

Reference data to inform system design decisions:

| Factor | Impact on Reply Rate |
|---|---|
| 50-80 word emails | +50-65% vs longer (Lavender, 300k emails) |
| 2+ personalization attributes in body | +56% (Woodpecker, 20M emails) |
| Small segments (21-50 recipients) | 6.2% vs 2.4% for 500+ |
| Multi-email sequence vs single send | +160%; replies peak at follow-up 2, decline after 3 (Backlinko, 12M) |
| Manual editing of AI drafts | +18% |
| Disabling open tracking | +68% (7.4% vs 4.4%) |

Average cold-email reply rate has fallen to ~3.4% (2026) as inboxes saturate with low-effort AI outreach — the ceiling keeps dropping for generic mail, not for well-built systems.

**The 95/5 rule:** 95% of AI cold emails get zero response. The 5% that work treat the LLM as a drafting accelerator with mandatory validation, not an autonomous sender.

---

## When to Use This Skill

- Building a new email generation feature
- Writing or modifying LLM prompts that produce email content
- Adding a post-generation validator or quality check
- Reviewing existing email generation code for AI-tell leakage
- Designing a multi-variant email testing system
- Adding personalization or voice-anchoring to an email pipeline

This skill is about **engineering the system**, not writing individual emails.
