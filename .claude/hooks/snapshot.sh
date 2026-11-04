#!/bin/bash
# Runs on PreToolUse for Write/Edit.
# Backs up the target file before it gets modified, so /undo-file
# can restore it later.

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
  echo "⚠️  snapshot.sh: neither jq nor python3 available, skipping backup for this edit." >&2
  echo "   Install jq (apt install jq / brew install jq) for /undo-file to work." >&2
  exit 0
fi

if [ -n "$FILE" ] && [ -f "$FILE" ]; then
  SNAPSHOT_DIR=".claude/memory/snapshots"
  mkdir -p "$SNAPSHOT_DIR"

  TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
  # Flatten the full path into the backup filename instead of nesting
  # directories, so an absolute path like c:\Users\...\file.ts doesn't
  # recreate the whole filesystem tree under snapshots/.
  SAFE_PATH=$(echo "$FILE" | sed -e 's/[\/\\:]/_/g')
  cp "$FILE" "$SNAPSHOT_DIR/${SAFE_PATH}.${TIMESTAMP}.bak"

  echo "$TIMESTAMP | $FILE" >> .claude/memory/snapshots/index.md
fi
