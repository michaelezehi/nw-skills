---
name: agent-reach
description: >
  AgentReach. See, hear and read what a link points at when built-in fetch or
  search can't: YouTube videos and Shorts, Instagram reels and posts, TikTok,
  X/Twitter, LinkedIn video and posts, Reddit, GitHub, Facebook, Bilibili,
  podcasts, Loom, Vimeo and any web page. Gets the title, caption, chapters and
  a full transcript (subtitles, or local Whisper when a video has none).
  Use whenever the user pastes a video or social link to watch, scope, study or
  improve from; when WebFetch or WebSearch returns "can't access", a login wall,
  a page shell or no body; or when the user says "look at this video", "watch
  this", "what does this reel say", "transcribe", "AgentReach" or /agent-reach.
  Never answer "I can't see this video" before running this skill.
---

# AgentReach

Read-only access to platforms our built-in tools can't open. Two tools, both
installed locally (see Upkeep for a fresh machine):

| Tool | What it does | Where |
|---|---|---|
| `watch.sh` | Metadata, caption, chapters and full transcript for any video URL | `~/.claude/skills/agent-reach/scripts/watch.sh` |
| `agent-reach` | Search and read across 14 platforms, JSON out | `~/.local/bin/agent-reach` (v1.6, uv tool, github.com/Panniantong/Agent-Reach) |

`agent-reach` comes from the upstream repo. Its own skill and references sit in
`~/.agents/skills/agent-reach/` (`references/capabilities.md`, `sessions.md`,
`maintenance.md`). Read those when a channel needs login or breaks.

## Step zero: ask for the accounts first

Before any run that gathers data from X, LinkedIn, Instagram or Facebook
(research, lead or competitor scans, a list of links, a skill that fans out
agents), ask for every login the run needs once, up front, so it never stops
halfway to ask.

1. List the platforms the run will touch: the links given plus the platforms
   the task names.
2. Run the preflight (3 to 7 s per platform, in parallel):

   ```bash
   python3 ~/.claude/skills/agent-reach/scripts/preflight.py <platforms or urls>
   python3 ~/.claude/skills/agent-reach/scripts/preflight.py --all   # every login platform
   ```

   It prints `ready` or `needs login` per platform and exits 0 (all ready),
   2 (logins needed) or 1 (a platform is broken).
3. Exit 2: run it again with `--open`, which opens one AgentReach login window
   per platform. Then end the turn with one callout built from the `ASK:` line:

   `> [!ACTION] Log into your X, LinkedIn and Instagram in the AgentReach browser windows, then tell me when you're done.`

   Gather nothing behind a login until the user answers. Public parts of the
   run (YouTube, web pages, GitHub) may start meanwhile.
4. The user says done: run the preflight again. Platforms still not ready get
   one more ask; after that, carry on without them and say which ones are
   missing and what that leaves out.
5. Sub-agents never ask for logins. The driver runs step zero before
   dispatching them and tells each one which platforms are ready.

The windows belong to AgentReach's own browser (`~/.agent-reach/browser`),
not your everyday Chrome. A login there is saved and reused, so later runs
pass the preflight with no ask. The user logs in themselves; never type a
password or handle a cookie for them.

YouTube, GitHub, Reddit, web pages and public videos through `watch.sh` need
no login, and the preflight says so. `watch.sh` reuses your everyday Chrome
cookies on its own when a video wants a login.

## Rule: never stop at "I can't see it"

When a link is given and WebFetch fails, returns a login page, or has no body:

1. A video or reel (anything with sound): run `watch.sh`.
2. A post, thread, repo, profile or search: run `agent-reach`.
3. Both failed: say which step failed and the exact error, then ask.

Say which of these you used ("transcript from subtitles", "transcript from
local Whisper", "caption only") so the user knows what you actually saw.
Whisper hears speech. It does not see the picture: on-screen text and visuals
are not in the transcript unless spoken. Say so when it matters.

## Videos: watch.sh

```bash
~/.claude/skills/agent-reach/scripts/watch.sh "<url>" [out_dir]
```

- Prints title, uploader, date, views, likes, description and chapters, then
  the transcript. Saves `meta.json` and `transcript.txt` to `out_dir`
  (default `$TMPDIR/agent-reach/<timestamp>`). Pass the session scratchpad as
  `out_dir` when there is one.
- Order: site subtitles (English, then Arabic) first; when there are none, it
  downloads the audio and transcribes it locally with `whisper-cli` and
  `~/.agent-reach/models/ggml-small.bin`, language auto-detected.
  `WHISPER_MODEL=<path>` overrides the model.
- Retries once with the user's Chrome cookies when a site wants a login
  (Instagram often does). No cookies are printed or stored.
- Timing: a short YouTube video with subtitles took 34 s; a 90 s reel through
  Whisper took about a minute.
- Works on every site yt-dlp supports: YouTube, Shorts, Instagram, TikTok, X,
  LinkedIn, Facebook, Vimeo, Loom, Bilibili, Twitch clips and more.

For a long video, read `transcript.txt` in parts. To check a moment, the
chapters line gives the timestamps.

## Everything else: agent-reach

```bash
agent-reach read "<url>"                        # picks the channel from the URL
agent-reach <channel> <action> [args]           # e.g. agent-reach reddit search "cold email" --limit 5
agent-reach channels                            # every action and its params
agent-reach doctor --text                       # what works right now
```

In zsh, pass the args as separate words (`agent-reach ${=cmd}` in a loop), or
the CLI sees one argument and returns `BAD_INPUT`.

Output is one JSON object. `ok: true`: content is in `items[]` (`title`,
`url`, `author`, `published_at`, `text`). `ok: false`: read `error.code` and
follow `error.hint`.

| Channel | Actions | Login |
|---|---|---|
| web | search, read | no |
| youtube | read, search, subtitle | no (`transcribe` needs a Groq key; use `watch.sh` instead) |
| github | search, read | no |
| reddit | search, read, subreddit | no (left un-added: its browser route returned UPSTREAM_BROKEN on 25 Oct, the public route works) |
| twitter | search, profile, tweets, thread | `agent-reach login twitter` for full search |
| instagram | search, profile, posts | `agent-reach login instagram` |
| facebook | search, profile | `agent-reach login facebook` |
| linkedin | jobs, read | `agent-reach login linkedin` |
| bilibili, xiaohongshu, boss, v2ex, xueqiu, xiaoyuzhou | see `agent-reach channels` | varies |

Measured on 25 Oct 2026: `read` on YouTube and GitHub returned full text;
`read` on an Instagram reel returned the caption and page shell only, so use
`watch.sh` for reels.

### Errors

| error.code | Do |
|---|---|
| `NEED_LOGIN` | Keep what you have. Tell the user to run `! agent-reach login <channel>` and log in themselves |
| `NEED_SETUP` | Run the hinted `agent-reach add <channel>`. A key goes in via `agent-reach configure <key>`, which the user runs |
| `RATE_LIMITED`, `PLATFORM_BLOCKED`, `BUSY` | Stop. Don't switch backends or retry in a loop |
| `UPSTREAM_BROKEN` | Ask before running `agent-reach update` once |
| `BAD_INPUT` | Check `agent-reach channels` |

## Red lines

- Read only. Never post, comment, like or message.
- Never log in for the user. Never ask for, print or save a password, cookie
  or key.
- Research on a link the user gave. Not for building contact lists or
  enriching CRM records at scale.
- Downloads and transcripts go to a temp or scratchpad folder, never into a
  project repo.

## Upkeep

- `brew upgrade yt-dlp` when a site starts failing; sites change often and an
  8-month-old yt-dlp failed on Instagram until it was updated.
- `agent-reach update` updates the CLI (ask first).
- Missing pieces on a new machine: `brew install yt-dlp ffmpeg whisper-cpp`,
  `uv tool install https://github.com/Panniantong/Agent-Reach/releases/latest/download/agent-reach.zip && agent-reach setup`,
  and the model:
  `curl -L -o ~/.agent-reach/models/ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin`.
  Never install `agent-reach` from PyPI: that package is a different project.
