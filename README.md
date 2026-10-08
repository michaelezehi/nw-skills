# NW skills

New Ward skills: agent skills and slash commands for Claude Code that I use on every project.

Most are my own. Some started as other people's skills and now carry my changes, mostly an unlazy completion gate and plain-writing rules wired in. Each one is marked in the tables below.

## Install

### Claude Code plugin

```bash
claude plugin marketplace add michaelezehi/nw-skills
claude plugin install nw-skills@nw-skills
```

Plugin skills and commands are namespaced, so `/research` becomes `/nw-skills:research`.

### skills.sh

```bash
npx skills@latest add michaelezehi/nw-skills
```

This copies editable skill folders into your project or `~/.claude/skills`.

### By hand

Copy any folder under `skills/<category>/` into `~/.claude/skills/`, and any file under `commands/` into `~/.claude/commands/`.

Several skills point at `~/.claude/skills/unlazy/scripts/gate-check.mjs` and `~/.claude/skills/unslop/SKILL.md`. Install unlazy and unslop first if you take only a few.

## Skills (37)

### Engineering

| Skill | What it does | Origin |
|---|---|---|
| [`app-user-journey`](skills/engineering/app-user-journey/SKILL.md) | Scan a codebase for every user role and map each one's real journey, registration, onboarding, the day-one surface, and a proposed leaner path, then ship it as an... | Original |
| [`build-speed`](skills/engineering/build-speed/SKILL.md) | Audit and fix any project's build + deploy pipeline for speed, kill cache-busting, move builds off the deploy box into CI, wire registry pull mode, and prove every... | Original |
| [`convex-backup-cron`](skills/engineering/convex-backup-cron/SKILL.md) | Install a 4x-daily production backup cron for Convex + DigitalOcean Spaces projects. | Original |
| [`og`](skills/engineering/og/SKILL.md) | Install a dynamic Open Graph / Twitter social card route into a Next.js project. | Original |
| [`own-goal`](skills/engineering/own-goal/SKILL.md) | Run a goal or a whole PRD to completion: a verifiable completion condition worked in a loop until met, with an accountability record and a /reviewer gate. | Original |
| [`qa-cases`](skills/engineering/qa-cases/SKILL.md) | Generate a shareable QA test case .md document for the current project. | Original |
| [`unlazy`](skills/engineering/unlazy/SKILL.md) | Anti-laziness execution discipline, required on every task sized L or XL (the /prd-ch scale) and run on request for anything smaller. | Modified from [Leonxlnx/unlazy](https://github.com/Leonxlnx/unlazy) |
| [`vercel-react-best-practices`](skills/engineering/vercel-react-best-practices/SKILL.md) | React and Next.js performance optimization guidelines from Vercel Engineering. | Modified from [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |

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

### Writing

| Skill | What it does | Origin |
|---|---|---|
| [`humanizer`](skills/writing/humanizer/SKILL.md) | Rewrite AI-sounding text so it reads like the writer without changing what it says. | Modified from [blader/humanizer](https://github.com/blader/humanizer) |
| [`rnd`](skills/writing/rnd/SKILL.md) | Create a shareable internal R&D page from a team brief, a votable consensus spec with a participant intro gate (--consensus), a screen-by-screen product build deck... | Original |
| [`unslop`](skills/writing/unslop/SKILL.md) | Cut AI tells from any writing. | Original |
| [`writing-clearly-and-concisely`](skills/writing/writing-clearly-and-concisely/SKILL.md) | Strunk companion for prose humans will read. | Modified from [softaworks/agent-toolkit](https://github.com/softaworks/agent-toolkit) |

## Commands

| Command | What it does |
|---|---|
| `/cf` | Force-continue a context-exhausted session. |
| `/ch` | Handoff continuity mode: numbered task list, accountability record with every question and decision, optional HTML summary. |
| `/fd-ch` | Frontend design run with reconnaissance, a quality gate and an accountability record, built on the frontend-design skill. |
| `/pr` | Read every PR review comment, fix what is actionable, and reply to each one. |
| `/prd-ch` | Create a PRD fast and well. |
| `/research` | Deep research on any topic. |
| `/reviewer` | Full audit and fix pass on the current task's changes, using any review skills installed on your machine (never Greptile or CodeRabbit). |

## Handoff hooks (optional)

`/ch`, `/fd-ch` and `/prd-ch` hand work over to a fresh session when context runs low. That needs three hooks in `hooks/`:

- `context-monitor.sh` warns at about 70 and 90 percent context use.
- `precompact.sh` writes `.claude/handoffs/current.md` (todos and modified files) before compaction.
- `session-start.sh` feeds that handoff back in when the next session starts.

They are not switched on by installing the plugin. To use them, copy the scripts to `~/.claude/hooks/` and add this to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{ "hooks": [{ "type": "command", "command": "~/.claude/hooks/context-monitor.sh" }] }],
    "PreCompact": [{ "hooks": [{ "type": "command", "command": "~/.claude/hooks/precompact.sh" }] }],
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "~/.claude/hooks/session-start.sh" }] }]
  }
}
```

Without them the commands still run; you just lose the automatic handoff.

## Licence

My own skills and commands are MIT, see [LICENSE](LICENSE). Modified skills keep their upstream licence and credit; see [NOTICE.md](NOTICE.md).
