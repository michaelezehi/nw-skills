# savvy-progress

Our fork of [johnnyvizz/claude-kit](https://github.com/johnnyvizz/claude-kit) savvy-progress (MIT, see LICENSE). It adds a terminal drawing (`hooks/terminal.tsx`): the bar, the pill and small crabs in each tier's hat colour, painted in 24-bit coloured cells, so any truecolor terminal shows the desktop's look.

A Claude Code mod: a progress bar above the prompt and a live panel of subagents. Made for the [savvy-flow](https://github.com/johnnyvizz/claude-kit) skill, and useful with any subagents.

- **Progress bar**: the flow's title, phase, accepted tasks out of planned, and a button with the crew size that opens the panel. It appears once something reports progress (savvy-flow does) or a `savvy-*` worker starts.
- **Agents panel** (`/agents-info` toggles it): running, finished and planned subagents with model, effort, task progress, context, estimated cost and time. Working crabs walk, and each savvy tier animates its prop: the astronaut floats, the detective sweeps the magnifier, the engineer turns the wrench, the chef tosses the omelette, the racer runs with a fluttering flag. `prefers-reduced-motion` stops them.
- **Finishing**: a crab whose run is done turns green and plants a flag in its tier's colour; for three seconds it waves a claw and the pennant flutters, then it rests. When the flow closes, the band's crab waves and one sparkle sweeps the green bar.
- **What it did**: click a finished agent's title to open a few plain lines under its card: what it did, then anything it needs from you, flagged in yellow when it waits on you and violet when it only asks.
- **Motion in the terminal**: the bar fills smoothly with eighth blocks in a gradient of the accent, a soft sheen sweeps the fill while work is out and the running segment breathes ahead of it. Frames come from one 125 ms clock (`hooks/motion.ts`) that runs only while something moves, so an idle session keeps no timer.

## Tools it adds

- `mcp__savvy-progress__progress`: the orchestrator reports the plan, phase and accepted tasks.
- `mcp__savvy-progress__step`: a worker reports its own steps (`done`, `total`, `note`). A worker that does not report shows its context fill in grey instead. With its last step it can send `summary` and `followUp`; without them the open card is cut from its final report.

Cost is a rough estimate from token counts and a built-in per-model price table (`PRICES` in `hooks/register.tsx`), not a bill.

## Settings

`language`: `auto` (default), `en` or `ru`. `auto` follows Claude Code's `language` setting, then the system locale, and falls back to English. Set it in `/config`, or, for a mod loaded by hand, in `~/.claude/settings.json`:

```json
{ "pluginConfigs": { "savvy-progress": { "options": { "language": "ru" } } } }
```

Install instructions are in the [repository README](../../README.md).
