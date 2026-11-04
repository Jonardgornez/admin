---
name: undo-file
description: Restores a file to how it was before Claude touched it. Use when the user notices an unintended file change and types /undo-file.
allowed-tools: Read, Bash
argument-hint: "[optional filename]"
---

The user wants to restore a file Claude accidentally modified.

1. Read `.claude/memory/snapshots/index.md`
2. If no filename was given as an argument, show the user a list
   of recently touched files with timestamps, e.g.:
   "Recent file changes:
    1. src/components/Header.tsx — 14:32
    2. src/app/page.tsx — 14:35
    3. src/lib/auth.ts — 14:41"
   Then ask which one to restore.
3. If a filename was given ($1), skip straight to step 4 for that file.
4. Find the latest `.bak` snapshot for the chosen file under
   `.claude/memory/snapshots/`.
5. Restore it: copy the `.bak` back to the original path.
6. Confirm: "✅ Restored {file} to its state before I touched it."
7. Append a line to `.claude/memory/activity-log.md`:
   "⚠️ Undone: {file} restored by user request at {timestamp}"
