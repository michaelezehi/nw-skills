#!/bin/bash
# context-monitor.sh - PostToolUse hook that prevents context death
# Warns early, creates emergency handoff at critical threshold
set -euo pipefail

HOOK_INPUT=$(cat)
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty')
CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty')

[[ -z "$SESSION_ID" || -z "$CWD" ]] && exit 0

# Find transcript
PROJECT_SLUG=$(echo "$CWD" | sed 's|/|-|g')
TRANSCRIPT="$HOME/.claude/projects/$PROJECT_SLUG/$SESSION_ID.jsonl"
[[ ! -f "$TRANSCRIPT" ]] && exit 0

# Skip if already handled at this level
WARN_FLAG="/tmp/.claude-warn-$SESSION_ID"
CRIT_FLAG="/tmp/.claude-crit-$SESSION_ID"

TRANSCRIPT_SIZE=$(wc -c < "$TRANSCRIPT" 2>/dev/null || echo 0)

# Thresholds (lowered to prevent "Conversation too long" crashes)
WARN_THRESHOLD=200000
CRIT_THRESHOLD=400000

# CRITICAL (~80%+): create emergency handoff and tell Claude to EXIT
if [[ "$TRANSCRIPT_SIZE" -gt "$CRIT_THRESHOLD" && ! -f "$CRIT_FLAG" ]]; then
  touch "$CRIT_FLAG"

  # Create emergency handoff (same logic as precompact.sh but lighter)
  HANDOFF_DIR="$CWD/.claude/handoffs"
  mkdir -p "$HANDOFF_DIR/archive"

  MODIFIED_FILES=""
  if git -C "$CWD" rev-parse --git-dir > /dev/null 2>&1; then
    MODIFIED_FILES=$(git -C "$CWD" diff --name-only HEAD 2>/dev/null | head -10 || echo "")
    [[ -z "$MODIFIED_FILES" ]] && MODIFIED_FILES=$(git -C "$CWD" status --porcelain 2>/dev/null | awk '{print $2}' | head -10 || echo "")
  fi

  FILES_LIST="None"
  [[ -n "$MODIFIED_FILES" ]] && FILES_LIST=$(echo "$MODIFIED_FILES" | sed 's/^/- /')

  cat > "$HANDOFF_DIR/current.md" << EOF
---
session_id: $SESSION_ID
created_at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
trigger: context-monitor-emergency
status: in_progress
project: $(basename "$CWD")
---

# Emergency Handoff

## Modified Files
$FILES_LIST
EOF

  touch "$HANDOFF_DIR/.handoff-pending"
  echo "Emergency handoff created at $HANDOFF_DIR/current.md" >&2

  jq -n '{
    "hookSpecificOutput": {
      "additionalContext": "EMERGENCY: Context ~80%+ full. Handoff file created. STOP ALL WORK NOW. Do not make any more tool calls. Tell the user you are stopping to prevent a crash, then exit immediately."
    }
  }'

# WARNING (~50-60%): switch to concise mode
elif [[ "$TRANSCRIPT_SIZE" -gt "$WARN_THRESHOLD" && ! -f "$WARN_FLAG" ]]; then
  touch "$WARN_FLAG"
  jq -n '{
    "hookSpecificOutput": {
      "additionalContext": "CONTEXT WARNING (~60%): Be terse. Cut filler. No restating. Apply writing-clearly-and-concisely strictly. Preserve context for actual work."
    }
  }'
fi
