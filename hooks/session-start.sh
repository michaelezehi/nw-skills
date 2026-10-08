#!/bin/bash
# session-start.sh - Loads handoff context into new sessions
# Triggered by Claude Code's SessionStart hook event

set -euo pipefail

HOOK_INPUT=$(cat)

# Extract working directory
CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty')

# Exit if no working directory
if [[ -z "$CWD" ]]; then
  exit 0
fi

HANDOFF_FILE="$CWD/.claude/handoffs/current.md"

# Check if handoff file exists
if [[ ! -f "$HANDOFF_FILE" ]]; then
  exit 0
fi

# Read handoff content
HANDOFF_CONTENT=$(cat "$HANDOFF_FILE")

# Create context with planning instructions
read -r -d '' CONTEXT << 'CONTEXT_EOF' || true
## HANDOFF CONTINUATION
Previous session hit context limits. Review context below and continue from pending tasks.
Apply writing-clearly-and-concisely skill to all output — no verbose explanations, every word earns its place.
---
CONTEXT_EOF

# Append handoff content
CONTEXT="$CONTEXT
$HANDOFF_CONTENT"

# Archive the handoff file
ARCHIVE_DIR="$CWD/.claude/handoffs/archive"
mkdir -p "$ARCHIVE_DIR"
ARCHIVE_NAME="$(date +%Y%m%d-%H%M%S)-handoff.md"
mv "$HANDOFF_FILE" "$ARCHIVE_DIR/$ARCHIVE_NAME"

# Remove the pending signal
rm -f "$CWD/.claude/handoffs/.handoff-pending"

# Output JSON with additionalContext for Claude
# Using jq to properly escape the content
jq -n --arg ctx "$CONTEXT" '{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": $ctx
  }
}'
