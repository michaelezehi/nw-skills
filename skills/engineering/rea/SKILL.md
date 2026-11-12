---
name: rea
description: "Guided tour and quick start for REA (npm `rea-agents`): checks the install, says what REA can and cannot inspect on the machine, runs a safe static demo on a target the user picks and reads the result back in plain words. Use on /rea, \"how does REA work\", \"show me REA\", \"what can rea do\", or a first look at an app, binary or site."
---

# /rea: see how REA works

REA is a local MCP server and CLI (`rea`) that inspects shipped software
without its source: Electron and JavaScript bundles, native binaries, .NET,
Android APKs, firmware, websites. Every result is an Evidence record: what was
found, where (file, offset, hash), how sure it is, and what it could not see.

This skill is the front door. It shows the tool working on something real in
a few minutes. For a full investigation (explain a feature, compare versions,
decompile, reconstruct) use `reverse-engineer-anything` instead: REA's own skill,
229 tools, kept current by `rea update`. The repo is github.com/morluto/rea.

## Install notes

- Node: REA needs Node 22.23.4+, 24.22.1+ or 26.12.1+. Check `node --version`;
  with nvm, `nvm install 24` adds a new enough one beside the old.
- Install: `npm install --global rea-agents@<version>` from a directory
  outside any project, then `rea setup --client claude_code --dry-run` to see
  the plan (one MCP entry in `~/.claude.json` with a backup, one skill folder),
  then the same with `--yes`.
- Pin the Node path. `rea setup` registers the bare `rea` shim, whose
  `#!/usr/bin/env node` picks whatever Node comes first on the agent's PATH.
  If an older Node is on the system, the server crashes at start. Re-register
  with absolute paths:
  `claude mcp remove rea -s user && claude mcp add rea -s user -- "$(command -v node)" "$(npm root -g)/rea-agents/scripts/rea.mjs" mcp`
  (run it with the right Node active).
- Native engines are optional. Static JavaScript, Electron, Go, Mach-O
  headers, models and most "inspect-*" commands need none. Decompiling native
  code needs Hopper, Ghidra, IDA or Kuna.

## Steps

### 1. Health check (one command, no fixes)

```bash
rea doctor --client claude_code --format json
```

Report three lines: Node version, `registration:claude_code` status, and which
engines are present. "config_drift" for other agents (Codex, Cursor, Gemini)
is expected; only fix those if the user asks. If the `mcp__rea__*` tools are
missing from this session but registration is healthy, the user must restart
Claude Code. Do not rerun setup for that.

### 2. Ask what to look at

Offer, in one `[!ASK]`:

- An Electron app already installed (list the smallest few:
  `for a in /Applications/*.app; do f="$a/Contents/Resources/app.asar"; [ -f "$f" ] && echo "$(du -k "$f" | cut -f1)K $f"; done | sort -n | head`)
- A website (public page, static capture of its scripts)
- A binary or package file they name
- "Just explain it" (skip to step 4 with the capability table)

Only targets the user owns or may examine. REA's own policy refuses DRM or
license bypass, game cheats, and access-control bypass; so does this skill.

### 3. Run the demo, always to a file

REA output is large. A 6 MB Electron archive can produce 300 MB of JSON. Never print a result inline. Write to the scratchpad and summarise
with a script.

Electron or JavaScript:

```bash
rea analyze-javascript-application "<path>/app.asar" \
  --integrity-policy record-and-continue --json > "$OUT/app.json"
```

`--integrity-policy record-and-continue` is needed for most signed macOS
apps: code signing changes the unpacked `.node` addon after packaging, and
without the flag REA stops with `artifact_integrity_mismatch`. The flag keeps
going and marks those bytes untrusted.

Read it back:

```bash
python3 -I -c "import json,sys;d=json.load(open(sys.argv[1]))['normalized_result'];print(json.dumps({'summary':d['summary'],'statistics':d['statistics']},indent=1))" "$OUT/app.json"
```

For any other target start with the general probe, which picks the right
next commands itself:

```bash
rea inspect-artifact "<path>" --format json > "$OUT/inspect.json"
```

Websites: `rea analyze-web-bundle --help` first; it drives a headless browser
and fetches the page, so confirm the URL with the user before running it.

Delete the big JSON when the tour is done.

### 4. Explain what came back

Turn the numbers into sentences about the app, for example: "2 windows, 82 IPC calls between the UI and the main process (53
handlers in main), 4 APIs bridged into the page, 1 native macOS addon; 3,065
JS files parsed, none failed." Then name one thing worth a follow-up and the
command for it (`rea inspect-analysis-view`, `rea function`, `rea compare`).

Close with how to go further: ask in plain words ("how does search work in
<app>, show me the evidence"), and the `reverse-engineer-anything` skill plus
the `mcp__rea__*` tools take over.

## What REA reads and what it does not

| Target | Works here now | Needs |
|---|---|---|
| Electron / JS bundles, ASAR | yes | nothing |
| Websites (script capture) | yes | network, a URL you may test |
| Go binaries, Mach-O headers, model files (GGUF, safetensors) | yes | nothing |
| Native decompile (C, C++, Swift, Rust) | no | Hopper, Ghidra 12.1, IDA or Kuna |
| Android APK classes and methods | no | JADX headless JAR + Java |
| Runtime tracing (Frida, LLDB, GDB) | partly | the debugger, and it runs the target |

Static commands only read files. Anything with `capture-`, `debug-` or a
browser runs code or touches the network: say so before running it.

## Security review (REA 6.8.0, Nov 2026)

- npm package carries SLSA provenance from the GitHub build of morluto/rea.
- No `preinstall` or `postinstall` hook; `prepare` only acts in a git checkout.
- Shipped code contacts only localhost, GitHub release URLs for optional
  tools, and Hopper's download API. No telemetry library, no reads of SSH
  keys, cloud credentials, browser logins or Keychain.
- Sockets open only for Chrome DevTools Protocol (local browser analysis).
- It runs with your user's permissions and is not a sandbox. Open untrusted
  binaries in a VM.

Re-check after a major version bump before running `rea update`.

## Update

```bash
rea update   # then re-apply the absolute Node registration above
```
