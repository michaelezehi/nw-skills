---
name: terminal-upgrade
description: Turn `pnpm dev` / `npm run dev` / `yarn dev` / `bun dev` in every repo on this machine into Devdeck, a calm live terminal dashboard. It shows each dev server with port, memory and hot reloads, streams Convex calls, keeps errors to one line until opened, and has a log pane, colour palettes and copy-to-clipboard. One global install plus a shell hook, with nothing written inside any repo. Use when the user runs /terminal-upgrade, or asks to upgrade, prettify or dashboard their dev terminal.
argument-hint: "[install | uninstall | plan | update | repo]"
disable-model-invocation: true
---

# Terminal upgrade

Devdeck replaces the interleaved scroll of a dev command with a live dashboard. It runs each dev server as its own process group, parses Next.js, Vite, Convex, tsx and tsc output, and opens on a plain stacked view.

`$ARGUMENTS` picks the path:

| Argument | Does |
|---|---|
| `install` (default) | machine-wide setup, once. Every repo picks it up with no files added |
| `uninstall` | removes the hook, the command and `~/.devdeck`; palette and overrides stay |
| `plan` | shows what Devdeck detects in the current repo |
| `update` | refreshes the global copy after the template changed |
| `repo` | installs Devdeck into this one repo as a package, for teams who want it committed |

Scripts live in `${CLAUDE_SKILL_DIR}/scripts`, and the Devdeck source in `${CLAUDE_SKILL_DIR}/template`.

## How machine-wide works

- **One copy.** It lives in `~/.devdeck/app`, run by `~/.devdeck/bin/devdeck`.
- **Shell hook.** `~/.devdeck/shell.sh` is sourced from `~/.zshrc` (and `~/.bashrc` if present). It wraps `pnpm`, `npm`, `yarn` and `bun`, and runs Devdeck in place of the raw output only when all of these are true:
  - The command is exactly `dev` or `run dev`.
  - stdin and stdout are a terminal. CI, pipes and agent shells such as Claude's Bash tool get the normal output.
  - The current package is the repo root. `pnpm dev` inside `apps/web` still starts just that app.
  - The repo has a `dev` script that does not already start its own Devdeck.
- **Escape hatches.** `DEVDECK=0 pnpm dev` skips it once, and `command pnpm dev` skips the hook.
- **Safe fallback.** When Devdeck cannot run in a repo (no dev processes, a bad config, Devdeck already open there) it exits 78 and the hook runs the original command as usual. The `devdeck` command runs on the Node that installed it (22 or later), so a repo pinned to an old Node through nvm or volta still works.
- **Root script respected.** A root `dev` that is a workspace runner (`turbo dev`, `pnpm -r`, `nx run-many`, a turbo filter that only excludes) gets one card per package. Any other root `dev` (a positive `--filter`, `dotenv -- next dev`) runs as one service, so its env and filters are kept.
- **Detection.** Devdeck finds the dev servers itself on every start: workspaces, package manager, each package's `dev` script, kind and port.
- **Overrides.** Per-user overrides live in `~/.config/devdeck/repos.json`, keyed by repo root. Nothing goes in the repo:
  ```json
  { "/Users/me/src/acme": { "title": "ACME", "services": { "pdf": { "port": 8011 }, "storybook": null } } }
  ```
  `null` hides a service, and `"add": [ ... ]` adds one.
- **Git ignore.** `.devdeck/`, the runtime socket the Claude mod reads, goes into the global git excludes file, so no repo ever shows it.
- **In-repo installs win.** A repo with its own `devdeck.config.ts` (installed with `repo`) keeps using it.

## Steps

### install

```bash
node ${CLAUDE_SKILL_DIR}/scripts/install-global.mjs --dry-run
node ${CLAUDE_SKILL_DIR}/scripts/install-global.mjs
```

Show the dry run to the user first: it edits `~/.zshrc` and the global git excludes. Then run it, and check:

```bash
/bin/zsh -ic 'command -v devdeck; whence -w pnpm npm'
```

Then show the plan for the repo they are in (next step) so they see what `pnpm dev` will open.

### plan

```bash
~/.devdeck/bin/devdeck --plan --root "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
```

Show the user the services (id, kind, dir, port), the title and any warnings in one short table. Look for:
- A server that sets its port in code. Detection only reads the `dev` script, so read the entry file and offer an override.
- Two services claiming one port.
- A single `dev` script running several processes (`concurrently`). It shows as one card; splitting the script gives one card each.

Offer fixes as entries in `~/.config/devdeck/repos.json`.

### uninstall

```bash
node ${CLAUDE_SKILL_DIR}/scripts/install-global.mjs --uninstall --dry-run
node ${CLAUDE_SKILL_DIR}/scripts/install-global.mjs --uninstall
```

Show the dry run first: it lists the exact lines it removes from the shell rc and the git excludes file, and deletes `~/.devdeck`.

### update

Run `install` again. It builds the new copy beside the old one and swaps it in only when its dependencies installed, so a failed update leaves the working copy alone. The hook and excludes lines are idempotent.

### repo

Commits Devdeck into one repo, so teammates get it without the hook:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/detect.mjs > /tmp/devdeck-plan.json
node ${CLAUDE_SKILL_DIR}/scripts/install.mjs /tmp/devdeck-plan.json --dry-run
node ${CLAUDE_SKILL_DIR}/scripts/install.mjs /tmp/devdeck-plan.json
```

This copies the package to `packages/devdeck` or `tools/devdeck` and writes `devdeck.config.ts`. It also points the root `dev` at Devdeck, keeps the old command as `dev:raw`, adds `.devdeck/` to `.gitignore`, installs and typechecks. Confirm the plan with the user before writing. Commit by path when their rules say to commit as you go.

## Hand over

Do not start `dev` yourself; the user runs it. Report:
- What changed on the machine, and the check output.
- The keys:

| Key | Does |
|---|---|
| `v` or `/` | plain list or detailed deck |
| `l` | cycle the feed, the raw logs of the focused server (`←` `→` switch server), and quiet: big cards that explain each number |
| `c` / `t` | collapse Convex Calls / Timeline in the detailed deck |
| `e`, `enter` | open errors; full body, file paths are Cmd-clickable |
| `y` / `Y` | copy the open error or visible logs / every error |
| `C` | colour palette: 8 presets (Spectrum gives each stat and server its own colour) plus per-colour overrides, saved in `~/.config/devdeck/theme.json` |
| `b`, `esc` or `x` | back one view / close every view |
| `r`, `o`, `q` | restart a server, open it in the browser, quit and stop everything |
| `h` or `?` | help: every key, plus what the terminal does (Cmd-click a port opens it in the browser, Cmd-click a path opens the file) |

- A dev server already running on a port will collide. Stop the old one first.
- Open a new terminal, or `source ~/.zshrc`, before the first try.

## Inside Claude Code

The `devdeck` mod mirrors the dashboard as one line above the prompt. It also adds a `/devdeck` pane and a `devdeck_status` tool that reads error bodies without opening logs. Offer it once:

```bash
claude plugin marketplace add michaelezehi/nw-skills
claude plugin install devdeck@nw-skills
```

## Maintaining the template

`template/` is a copy of a working Devdeck package without its tests. Keep the tested development copy in a repo of your own. After changing it, refresh the template, run `install` again, and publish the skill:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/sync-template.mjs <path-to-your-devdeck-package>
```
