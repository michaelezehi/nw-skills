#!/bin/bash
# precompact.sh - Generates handoff file when context is about to be compacted
# Triggered by Claude Code's PreCompact hook event

set -euo pipefail

HOOK_INPUT=$(cat)

# Extract data from hook input
CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty')
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // "unknown"')
TRANSCRIPT=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // empty')
TRIGGER=$(echo "$HOOK_INPUT" | jq -r '.trigger // "auto"')

# Exit if no working directory
if [[ -z "$CWD" ]]; then
  exit 0
fi

HANDOFF_DIR="$CWD/.claude/handoffs"
mkdir -p "$HANDOFF_DIR/archive"

# Extract todos from transcript (last TodoWrite call)
TODOS=""
if [[ -n "$TRANSCRIPT" && -f "$TRANSCRIPT" ]]; then
  # Find the last TodoWrite tool result and extract todos
  TODOS=$(grep -o '"todos":\s*\[[^]]*\]' "$TRANSCRIPT" 2>/dev/null | tail -1 | sed 's/"todos":\s*//' || echo "")
fi

# Get modified files from git
MODIFIED_FILES=""
if git -C "$CWD" rev-parse --git-dir > /dev/null 2>&1; then
  MODIFIED_FILES=$(git -C "$CWD" diff --name-only HEAD 2>/dev/null | head -10 || echo "")
  if [[ -z "$MODIFIED_FILES" ]]; then
    MODIFIED_FILES=$(git -C "$CWD" status --porcelain 2>/dev/null | awk '{print $2}' | head -10 || echo "")
  fi
fi

# Get project name
PROJECT_NAME=$(basename "$CWD")

# Generate timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Format todos as markdown table if we have them
TODOS_TABLE="No todos captured"
if [[ -n "$TODOS" && "$TODOS" != "[]" ]]; then
  TODOS_TABLE="| Status | Task |
|--------|------|"
  # Parse JSON array and format as table rows
  TODOS_TABLE="$TODOS_TABLE
$(echo "$TODOS" | jq -r '.[] | "| \(.status) | \(.content) |"' 2>/dev/null || echo "| - | Could not parse todos |")"
fi

# Format modified files
FILES_LIST="No modified files detected"
if [[ -n "$MODIFIED_FILES" ]]; then
  FILES_LIST=$(echo "$MODIFIED_FILES" | sed 's/^/- /')
fi

# Generate handoff file
cat > "$HANDOFF_DIR/current.md" << EOF
---
session_id: $SESSION_ID
created_at: $TIMESTAMP
trigger: $TRIGGER
status: in_progress
project: $PROJECT_NAME
---

# Session Handoff

## Todo List State
$TODOS_TABLE

## Modified Files
$FILES_LIST
EOF

# Ensure handoff stays small (<2KB) - truncate if needed
HANDOFF_SIZE=$(wc -c < "$HANDOFF_DIR/current.md" 2>/dev/null || echo 0)
if [[ "$HANDOFF_SIZE" -gt 2048 ]]; then
  head -c 2048 "$HANDOFF_DIR/current.md" > "$HANDOFF_DIR/current.md.tmp"
  mv "$HANDOFF_DIR/current.md.tmp" "$HANDOFF_DIR/current.md"
fi

# Signal for wrapper script that handoff is pending
touch "$HANDOFF_DIR/.handoff-pending"

# Log for debugging
echo "Handoff created at $HANDOFF_DIR/current.md (${HANDOFF_SIZE}B)" >&2

exit 0
