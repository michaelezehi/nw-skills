# NW skills

New Ward skills: the agent skills and slash commands I run every day in Claude Code.

Most are my own. Some started as other people's skills and now carry my changes, mostly an unlazy completion gate and the unslop writing rules wired in. Each one is marked in the tables below. Skills I use unchanged from someone else are not copied here; they are listed at the bottom with links to the source.

## Install

### Claude Code plugin

```bash
claude plugin marketplace add michaelezehi/nw-skills
claude plugin install nw-skills@nw-skills
```

Plugin skills and commands are namespaced, so `/reviewer` becomes `/nw-skills:reviewer`.

### skills.sh

```bash
npx skills@latest add michaelezehi/nw-skills
```

This copies editable skill folders into your project or `~/.claude/skills`.

### By hand

Copy any folder under `skills/<category>/` into `~/.claude/skills/`, and any file under `commands/` into `~/.claude/commands/`.

Several skills refer to each other by path, for example `~/.claude/skills/unlazy/scripts/gate-check.mjs` and `~/.claude/skills/unslop/SKILL.md`. Install those two first if you take only a few. The persona commands (`/bka`, `/rev`, `/reviewer`, `/sec`, `/uid` and others) load agent files from `~/.claude/agents/`, which are not part of this repo.

## Skills (73)

### Engineering

| Skill | What it does | Origin |
|---|---|---|
| [`app-user-journey`](skills/engineering/app-user-journey/SKILL.md) | Scan a codebase for every user role and map each one's real journey, registration, onboarding, the day-one surface, and a proposed leaner path, then ship it as an... | Original |
| [`build-speed`](skills/engineering/build-speed/SKILL.md) | Audit and fix any project's build + deploy pipeline for speed, kill cache-busting, move builds off the deploy box into CI, wire registry pull mode, and prove every... | Original |
| [`convex-backup-cron`](skills/engineering/convex-backup-cron/SKILL.md) | Install a 4x-daily production backup cron for Convex + DigitalOcean Spaces projects. | Original |
| [`convex-migration`](skills/engineering/convex-migration/SKILL.md) | End-to-end backend → Convex migration orchestrator. | Original |
| [`convex-prune`](skills/engineering/convex-prune/SKILL.md) | Inventory unused Convex tables and leftover Cloud-import tables, then prune them dry-run first. | Original |
| [`convex-selfhost`](skills/engineering/convex-selfhost/SKILL.md) | Moves a Convex Cloud project onto the self-hosted lon1 shape proven on x-unframed: inventory, compose clone, export/import, rebuild, pause Cloud (never delete), and... | Original |
| [`e2e-smoke-test`](skills/engineering/e2e-smoke-test/SKILL.md) | Generates an Optics smoke-checklist-v1 JSON catalog of forward-facing / public-facing roles and user-flow modules only. | Original |
| [`greptile-reviewer`](skills/engineering/greptile-reviewer/SKILL.md) | Legacy Greptile CLI and MCP review loop. Retired as the default reviewer, so it runs only when named. | Original |
| [`og`](skills/engineering/og/SKILL.md) | Install a dynamic Open Graph / Twitter social card route into a Next.js project. | Original |
| [`optics-qa`](skills/engineering/optics-qa/SKILL.md) | Install the Optic SDKs (browser and/or Node) in this project, wire up the init code, and connect the security bridge, a probe run whose findings upload into the... | Original |
| [`own-goal`](skills/engineering/own-goal/SKILL.md) | Run a goal or a whole PRD to completion, our way. | Original |
| [`qa-cases`](skills/engineering/qa-cases/SKILL.md) | Generate a shareable QA test case .md document for the current project. | Original |
| [`region`](skills/engineering/region/SKILL.md) | Stand up, verify, or deploy an Unframed data-residency region (gcc, us, asia, africa, uk, …). | Original |
| [`staging`](skills/engineering/staging/SKILL.md) | Spin up a QA staging environment for any project on one shared droplet, from a branch. | Original |
| [`unlazy`](skills/engineering/unlazy/SKILL.md) | Anti-laziness execution discipline, required on every task sized L or XL (the /prd-ch scale) and run on request for anything smaller. | Modified from [Leonxlnx/unlazy](https://github.com/Leonxlnx/unlazy) |
| [`vercel-react-best-practices`](skills/engineering/vercel-react-best-practices/SKILL.md) | React and Next.js performance optimization guidelines from Vercel Engineering. | Modified from [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |

### Security and load

| Skill | What it does | Origin |
|---|---|---|
| [`ddos`](skills/security/ddos/SKILL.md) | Authorized, self-owned application-layer (L7) DDoS-RESILIENCE testing of our OWN infrastructure, the third leg after /pentest and /loadtest. | Original |
| [`loadtest`](skills/security/loadtest/SKILL.md) | Authorized load and stress testing of our OWN apps with k6. | Original |
| [`pentest`](skills/security/pentest/SKILL.md) | Authorized defensive security review of our OWN projects. | Original |

### Design and frontend

| Skill | What it does | Origin |
|---|---|---|
| [`apple-design`](skills/design/apple-design/SKILL.md) | Apple's approach to interface design and fluid, physical motion, translated for the web. | Modified from [emilkowalski/skill](https://github.com/emilkowalski/skill) |
| [`brandkit`](skills/design/brandkit/SKILL.md) | Premium brand-kit image generation skill for creating high-end brand-guidelines boards, logo systems, identity decks, and visual-world presentations. | Modified from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) |
| [`click-burst`](skills/design/click-burst/SKILL.md) | Adds a performant click-triggered full-viewport color burst transition (scale + opacity only, no animated blur). | Original |
| [`design-taste-frontend`](skills/design/design-taste-frontend/SKILL.md) | Anti-slop frontend rules for LANDING PAGES, PORTFOLIOS, and MARKETING REDESIGNS: reads the brief, infers direction, ships interfaces that do not look templated, with... | Modified from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) |
| [`emil-design-eng`](skills/design/emil-design-eng/SKILL.md) | Emil Kowalski's design-engineering philosophy, animation decisions, springs, gestures, component feel, and the invisible details that make software feel great. | Modified from [emilkowalski/skill](https://github.com/emilkowalski/skill) |
| [`fed`](skills/design/fed/SKILL.md) | Alias for frontend-design. | Original |
| [`find-animation-opportunities`](skills/design/find-animation-opportunities/SKILL.md) | Search a codebase or UI for places that don't animate but should, and reject everything that shouldn't. | Modified from [emilkowalski/skill](https://github.com/emilkowalski/skill) |
| [`frontend-design`](skills/design/frontend-design/SKILL.md) | The main frontend skill. Distinctive, production-grade UI with high craft in typography, layout, colour and motion. | Original |
| [`iconize`](skills/design/iconize/SKILL.md) | Extract individual icons from sprite sheets into named, square PNG files organized by category. | Original |
| [`image-to-code`](skills/design/image-to-code/SKILL.md) | Alias for imagegen-frontend-web (image-first web flow: generate section images, then code them). | Modified from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) |
| [`imagegen-frontend-mobile`](skills/design/imagegen-frontend-mobile/SKILL.md) | Premium mobile app screen concept images, iOS, Android, and cross-platform screens and multi-screen flows (onboarding, auth, home, profile, settings, chat, commerce,... | Modified from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) |
| [`imagegen-frontend-web`](skills/design/imagegen-frontend-web/SKILL.md) | The image-first WEB flow, generate one premium horizontal reference image per section (hero, landing page, marketing site, product page, portfolio), deeply analyze... | Modified from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) |
| [`impeccable`](skills/design/impeccable/SKILL.md) | Use when the user wants to design, redesign, shape, critique, audit, polish, clarify, distill, harden, optimize, adapt, animate, colorize, extract, or otherwise... | Modified from [pbakaus/impeccable](https://github.com/pbakaus/impeccable) |
| [`improve-animations`](skills/design/improve-animations/SKILL.md) | Survey a codebase's animation and motion code as a senior motion advisor, then produce a prioritized audit and self-contained implementation plans for other agents... | Modified from [emilkowalski/skill](https://github.com/emilkowalski/skill) |
| [`industrial-brutalist-ui`](skills/design/industrial-brutalist-ui/SKILL.md) | OPT-IN STYLE PRESET, use ONLY when the user explicitly asks for brutalist / industrial / Swiss-print / terminal aesthetics, or names this skill. | Modified from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) |
| [`minimalist-ui`](skills/design/minimalist-ui/SKILL.md) | OPT-IN STYLE PRESET, use ONLY when the user explicitly asks for a minimalist / Notion-like / warm-monochrome editorial look, or names this skill. | Modified from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) |
| [`pick-ui-library`](skills/design/pick-ui-library/SKILL.md) | Pick the right library for a given frontend task from a curated, opinionated list, numbers, OTP inputs, charts, command menus, virtualization, drag and drop, toasts,... | Modified from [emilkowalski/skill](https://github.com/emilkowalski/skill) |
| [`prototype`](skills/design/prototype/SKILL.md) | Build multiple genuinely different versions of a UI piece you describe, rendered behind a visual picker so you can flip through them live and promote the one that... | Modified from [emilkowalski/skill](https://github.com/emilkowalski/skill) |
| [`redesign-existing-projects`](skills/design/redesign-existing-projects/SKILL.md) | Upgrades existing websites and apps to premium quality. | Modified from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) |
| [`review-animations`](skills/design/review-animations/SKILL.md) | Reviews animation and motion code against a high craft bar derived from Emil Kowalski's design engineering philosophy. | Modified from [emilkowalski/skill](https://github.com/emilkowalski/skill) |
| [`sketches`](skills/design/sketches/SKILL.md) | Hand-drawn SVG sketch/doodle system with a growing, brand-themeable repertoire. | Original |
| [`stitch-design-taste`](skills/design/stitch-design-taste/SKILL.md) | Semantic Design System Skill for Google Stitch. | Modified from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) |
| [`the-broadside`](skills/design/the-broadside/SKILL.md) | Install the broadside editorial slide-deck design system into the current React/Next.js project. | Original |
| [`the-stripe-modal`](skills/design/the-stripe-modal/SKILL.md) | Install the editorial-press design system (surface card + slide-in modal flow + hero empty state) into the current React/Next.js project. | Original |
| [`ui-ux-pro-max`](skills/design/ui-ux-pro-max/SKILL.md) | UI/UX design intelligence for web and mobile. | Modified from [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) |

### Writing and documents

| Skill | What it does | Origin |
|---|---|---|
| [`deck`](skills/writing/deck/SKILL.md) | Generate a beautiful, self-contained HTML deck from a markdown file using the target project's design tokens (color palette, fonts) and its shared line-art library,... | Original |
| [`email`](skills/writing/email/SKILL.md) | Engineering guide for building AI-powered email generation features. | Original |
| [`humanizer`](skills/writing/humanizer/SKILL.md) | Rewrite AI-sounding text so it reads like the writer without changing what it says. | Modified from [blader/humanizer](https://github.com/blader/humanizer) |
| [`legal-docs`](skills/writing/legal-docs/SKILL.md) | Audit any project for the legal, policy and compliance documents it needs, terms, privacy policy, DPA, sub-processor list, cookie consent, candidate/employee notices,... | Original |
| [`optics-resume`](skills/writing/optics-resume/SKILL.md) | Generate or update a CV/resume in the "Optics" yellow-and-black editorial design, a two-column print layout with a white name header, a black Professional Summary... | Original |
| [`rnd`](skills/writing/rnd/SKILL.md) | Create a shareable internal R&D page from a team brief, a votable consensus spec with a participant intro gate (--consensus), a screen-by-screen product build deck... | Original |
| [`unslop`](skills/writing/unslop/SKILL.md) | Cut AI tells from any writing. | Original |
| [`writing-clearly-and-concisely`](skills/writing/writing-clearly-and-concisely/SKILL.md) | Strunk companion for prose humans will read. | Modified from [softaworks/agent-toolkit](https://github.com/softaworks/agent-toolkit) |

### Growth and outreach

| Skill | What it does | Origin |
|---|---|---|
| [`crm-crush-product`](skills/growth/crm-crush-product/SKILL.md) | Research a product created in Crush CRM and prefill everything it needs to sell - description, framing, audiences, value propositions, call knowledge, never-claim... | Original |
| [`geo`](skills/growth/geo/SKILL.md) | Scan and optimize any project for GEO (Generative Engine Optimization) + SEO, structured data, sitemaps, robots.txt, metadata, AI crawler access, content signals. | Original |
| [`grow-seo-aeo`](skills/growth/grow-seo-aeo/SKILL.md) | Local SEO+AEO growth engine (BabyLoveGrowth.ai replica), audits via the geo skill, builds a keyword-clustered 30-day content calendar, scaffolds or adapts an in-repo... | Original |
| [`lead-research`](skills/growth/lead-research/SKILL.md) | Generates CRM-ready B2B lead CSVs for Unframed HR outreach from UK Companies House and public web sources. | Original |
| [`local-web-extract`](skills/growth/local-web-extract/SKILL.md) | Deprecated alias. | Original |
| [`my-contact-research`](skills/growth/my-contact-research/SKILL.md) | Builds a public-source B2B outreach CRM pack for any org type (rehab clinics, schools, law firms, investors, and similar). | Original |

### Video

| Skill | What it does | Origin |
|---|---|---|
| [`mediabunny`](skills/video/mediabunny/SKILL.md) | Multimedia handling in the browser with the Mediabunny library. | Modified from [remotion-dev/skills](https://github.com/remotion-dev/skills) |
| [`promo-film`](skills/video/promo-film/SKILL.md) | Make a cinematic Unframed film with Remotion, brand promos, product launches, feature announcements, launch trailers, product tours, and social cutdowns. | Original |
| [`remotion-best-practices`](skills/video/remotion-best-practices/SKILL.md) | Best practices for Remotion | Modified from [remotion-dev/skills](https://github.com/remotion-dev/skills) |
| [`remotion-captions`](skills/video/remotion-captions/SKILL.md) | Dealing with captions in Remotion | Modified from [remotion-dev/skills](https://github.com/remotion-dev/skills) |
| [`remotion-create`](skills/video/remotion-create/SKILL.md) | Creating a new Remotion video | Modified from [remotion-dev/skills](https://github.com/remotion-dev/skills) |
| [`remotion-docs`](skills/video/remotion-docs/SKILL.md) | Search and fetch Remotion documentation pages | Modified from [remotion-dev/skills](https://github.com/remotion-dev/skills) |
| [`remotion-interactivity`](skills/video/remotion-interactivity/SKILL.md) | Best practices for writing Remotion animations that stay intuitive for agents and editable in Remotion Studio Visual Mode. | Modified from [remotion-dev/skills](https://github.com/remotion-dev/skills) |
| [`remotion-maps`](skills/video/remotion-maps/SKILL.md) | Best practices for animating Maps in Remotion | Modified from [remotion-dev/skills](https://github.com/remotion-dev/skills) |
| [`remotion-markup`](skills/video/remotion-markup/SKILL.md) | Best practices for writing Remotion React Markup | Modified from [remotion-dev/skills](https://github.com/remotion-dev/skills) |
| [`remotion-render`](skills/video/remotion-render/SKILL.md) | Best practices for rendering videos | Modified from [remotion-dev/skills](https://github.com/remotion-dev/skills) |
| [`remotion-saas`](skills/video/remotion-saas/SKILL.md) | Building video apps with Remotion - framework, rendering and Player advice | Modified from [remotion-dev/skills](https://github.com/remotion-dev/skills) |
| [`remotion-upgrade`](skills/video/remotion-upgrade/SKILL.md) | Upgrade Remotion, its related packages, compatible Mediabunny packages, and installed Remotion Agent Skills. | Modified from [remotion-dev/skills](https://github.com/remotion-dev/skills) |
| [`video-shotcraft`](skills/video/video-shotcraft/SKILL.md) | Cinematic product videos from shot-recipe cards, a tested Remotion template, real page captures and sound design. | Modified from [Vincentwei1021/video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) |

### Machine and spend

| Skill | What it does | Origin |
|---|---|---|
| [`clean-ram`](skills/productivity/clean-ram/SKILL.md) | Find what is actually eating system memory on macOS, kill it safely, and show a coloured before/after table of what was freed. | Original |
| [`spend`](skills/productivity/spend/SKILL.md) | Show a colour-coded terminal dashboard of AI coding spend across all Claude Code and Codex projects, cost, tokens, sessions by name, and per-model breakdown for a... | Original |

## Commands

Slash commands in `commands/`. Folders become a namespace, so `commands/website/bento.md` runs as `/website:bento`.

| Command | What it does |
|---|---|
| `/aii` | Add an OpenRouter fallback chain (alias for /ai:implement). |
| `/bka` | Adopt the Backend Architect persona. |
| `/brg` | Adopt the Brand Guardian persona. |
| `/cancel-true-loop` | Cancel active True Loop. |
| `/cf` | Force-continue a context-exhausted session. |
| `/ch` | Enable handoff continuity mode for this session. |
| `/clone-website` | Clone any website pixel-perfectly. |
| `/fd-ch` | Frontend design with handoff continuity. |
| `/image-gen` | Generate structured JSON prompts for AI image generation (Nano Banana. |
| `/img` | Alias for /image-gen in 3-variation mode. |
| `/mob` | Adopt the Mobile App Builder persona. |
| `/pr` | Review PR comments from AI agents and code reviewers. |
| `/prd-ch` | Create a PRD fast and well. |
| `/research` | Deep research on any topic. |
| `/rev` | Adopt the Code Reviewer persona. |
| `/reviewer` | Full audit + fix pass on the current branch's changes. |
| `/rpt` | Adopt the Rapid Prototyper persona. |
| `/sec` | Adopt the Security Engineer persona. |
| `/security` | Audit and harden the network edge of a Docker + nginx project on a DigitalOcean droplet. |
| `/srd` | Adopt the Senior Developer persona. |
| `/true-loop-help` | Explain True Loop and available commands. |
| `/true-loop` | Start True Loop in current session. |
| `/uid` | Adopt the UI Designer persona. |
| `/uxa` | Adopt the UX Architect persona, UX structure, CSS systems. |
| `/video-gen` | Generate structured JSON prompts for AI video generation (VO 3.1, Veo, Runway, Kling. |
| `/ai:implement` | Add an OpenRouter client with automatic model fallback. |
| `/ship:optimisation` | Audit and fix this project's build + deploy pipeline for speed (alias for the build-speed skill. |
| `/website:aira-saas` | Aira-style premium SaaS landing page. |
| `/website:apple-site` | Apple-style scroll-animated product pages. |
| `/website:bento` | Bento grid dashboard/feature page. |
| `/website:brutalist` | Neo-brutalist website. |
| `/website:editorial` | Editorial/magazine-style website. |
| `/website:kinetic-type` | Kinetic typography website. |
| `/website:saas-linear` | Linear/Vercel-style SaaS landing page. |
| `/website:stripe-gradient` | Stripe-style marketing site. |

## Third-party skills I use unchanged

Install these from their own repos:

| Source | Skills |
|---|---|
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | hyperframes, hyperframes-animation, hyperframes-audio, hyperframes-cli, hyperframes-core, hyperframes-creative, hyperframes-keyframes, hyperframes-registry, hyperframes-studio, media-use, general-video, remotion-to-hyperframes |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | vercel-composition-patterns, vercel-react-native-skills, web-design-guidelines |
| [vercel-labs/skills](https://github.com/vercel-labs/skills) | find-skills |
| [emilkowalski/skill](https://github.com/emilkowalski/skill) | animation-vocabulary |
| [latent-spaces/brag](https://github.com/latent-spaces/brag) | brag |
| [21st-dev](https://github.com/21st-dev) | 21st-ai, 21st-cli-use, 21st-design-sync, 21st-registry, 21st-ui-build, 21st-ui-explore, 21st-ui-review |
| [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) | graphify |
| [glittercowboy/get-shit-done](https://github.com/glittercowboy/get-shit-done) | the `/gsd:*` commands |

## Licence

My own skills and commands are MIT, see [LICENSE](LICENSE). Modified skills keep their upstream licence and credit; see [NOTICE.md](NOTICE.md).
