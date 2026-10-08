---
description: Force-continue a context-exhausted session — recovers todos, modified files, and last work from the transcript.
---

# Force Continue — Recover from context-exhausted sessions

You are recovering a dead session. Follow these steps exactly:

## Step 1: Find candidate sessions

Run this bash command to list recent transcripts for this project:

```bash
CWD=$(pwd)
PROJECT_SLUG=$(echo "$CWD" | sed 's|/|-|g')
PROJECT_DIR="$HOME/.claude/projects/$PROJECT_SLUG"
if [[ -d "$PROJECT_DIR" ]]; then
  for f in $(ls -t "$PROJECT_DIR"/*.jsonl 2>/dev/null | head -5); do
    SID=$(basename "$f" .jsonl)
    SIZE=$(wc -c < "$f" | tr -d ' ')
    SIZE_KB=$((SIZE / 1024))
    MOD=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$f" 2>/dev/null || echo "unknown")
    TASK=$(grep '"role":"human"' "$f" 2>/dev/null | head -1 | jq -r '.message.content | if type == "array" then map(select(.type == "text")) | map(.text) | join(" ") else . end' 2>/dev/null | head -c 80 || echo "")
    LAST=$(grep '"role":"assistant"' "$f" 2>/dev/null | tail -1 | jq -r '.message.content | if type == "array" then map(select(.type == "text")) | map(.text) | join(" ") else . end' 2>/dev/null | head -c 80 || echo "")
    echo "SESSION:${SID}|SIZE:${SIZE_KB}KB|DATE:${MOD}|TASK:${TASK}|LAST:${LAST}"
  done
else
  echo "NO_SESSIONS"
fi
```

## Step 2: Select session

- If NO_SESSIONS: tell user no sessions found for this directory.
- If only 1 session: auto-select it, tell user which one.
- If multiple: use AskUserQuestion to let the user pick. For each option show:
  - **Label:** First 8 chars of session ID + date
  - **Description:** "Task: <initial prompt> | Last: <last Claude output snippet>"

## Step 3: Extract context from chosen transcript

Run bash to extract todos, last work, and modified files from the **Claude transcript** (not git):

```bash
TRANSCRIPT="<selected_transcript_path>"
echo "=== TODOS ==="
grep -o '"todos":\s*\[[^]]*\]' "$TRANSCRIPT" 2>/dev/null | tail -1 | sed 's/"todos":\s*//' || echo "[]"
echo "=== LAST WORK ==="
grep '"role":"assistant"' "$TRANSCRIPT" 2>/dev/null | tail -3 | jq -r '.message.content | map(select(.type == "text")) | map(.text) | join(" ")' 2>/dev/null | tail -c 1500 || echo "No context extracted"
echo "=== MODIFIED FILES ==="
git diff --name-only HEAD 2>/dev/null | head -10 || git status --porcelain 2>/dev/null | awk '{print $2}' | head -10 || echo "None"
```

## Step 4: Create handoff and continue

1. Archive any existing `.claude/handoffs/current.md` to `.claude/handoffs/archive/`
2. Write a new `.claude/handoffs/current.md` with the extracted todos, modified files, and last work context
3. Keep the handoff under 2KB
4. Read the handoff file you just created
5. Continue working from the recovered context — pick up pending tasks immediately

Apply writing-clearly-and-concisely skill to all output.
