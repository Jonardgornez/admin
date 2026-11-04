---
name: save-it
description: Saves the just-completed task to persistent memory. Use when the user is satisfied with the result and types /save-it.
allowed-tools: Read, Edit, Write
---

The user is satisfied with what was just completed.
Append a new entry to `.claude/memory/activity-log.md`:

```
## {today's date}
### Task: {what the user asked for}
- What was done: {summary of what was built}
- Files touched:
  - {file path} ({created/modified} — {one line of what changed})
- Security: {status from security-reviewer, if it ran}
- Decisions made: {any choices made and why}
- Status: ✅ Complete
```

Keep it concise — one line per file. Never delete or overwrite
earlier entries, always append. Then confirm:
"✅ Saved! I'll remember this next session."
