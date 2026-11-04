#!/bin/bash
# Runs on PostToolUse for Write/Edit.
# Appends a lightweight record of every file touched during a session.

INPUT=$(cat)

if command -v jq >/dev/null 2>&1; then
  FILE=$(echo "$INPUT" | jq -r '.tool_input.path // .tool_input.file_path // empty')
elif command -v python3 >/dev/null 2>&1; then
  FILE=$(echo "$INPUT" | python3 -c '
import json, sys
try:
    ti = json.load(sys.stdin).get("tool_input", {})
    print(ti.get("path") or ti.get("file_path") or "")
except Exception:
    print("")
')
else
  echo "⚠️  log-activity.sh: neither jq nor python3 available, skipping this log entry." >&2
  exit 0
fi

if [ -n "$FILE" ]; then
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
  mkdir -p .claude/memory
  echo "- $TIMESTAMP → $FILE" >> .claude/memory/files-touched.md
fi
