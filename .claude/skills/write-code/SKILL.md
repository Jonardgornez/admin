---
name: write-code
description: Writes frontend and backend code following project standards, coordinating specialist subagents (coder, security-reviewer, tester). Use when the user asks to add, build, or implement a feature.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

## Step 1: Load the code style rules

Before planning, read `.claude/rules/code-style.md` so the coding
conventions (component structure, TypeScript, Tailwind, forms,
API calls, naming, etc.) shape the plan from the start rather
than being retrofitted during review.

## Step 2: Plan

Before writing any code:
- If it's unclear from the request, ask the user whether this is a
  **mockup (UI only)** or a **full implementation (with backend)**.
  For a mockup, scope the plan to UI/components with mock data only
  — skip API integration, database work, and real validation
  wiring until the user asks to connect a backend.
- Explore the codebase to understand existing patterns
- Identify every file that will be created or modified
- Note any risks (shared modules, breaking changes)
- Present the plan and wait for the user's approval before editing
  anything

## Step 3: Create a todo list

Break the approved plan into discrete steps.
Track each as pending → in_progress → completed.

## Step 4: Execute each todo item

You are the orchestrator. Subagents cannot talk to each other —
every handoff goes through you, and every handoff costs a full
round trip. Don't spawn subagents reflexively. Decide per item:

**Trivial items** (renaming, styling, config tweaks, non-sensitive
UI, anything with no security surface) — just do it directly
yourself. No coder subagent needed. Run the relevant test yourself,
mark it complete.

**Substantial items** (new logic, new files, anything non-trivial)
— delegate to the **coder** subagent.
1. Coder implements, reports back what it built, which files
   changed, and whether the change is security-sensitive (touches
   auth, input handling, secrets, sessions, or API endpoints).
2. **Only if coder flags it security-sensitive**, delegate to
   **security-reviewer** with the exact files touched. Do not
   invoke security-reviewer for items coder didn't flag — trust
   the flag rather than reviewing everything by default.
3. If security-reviewer reports any 🔴 CRITICAL finding, relay it
   back to **coder** to fix, then re-run security-reviewer on the
   same files. Repeat until 🟢 CLEAN. Cap this loop at 3 rounds —
   if still not clean, stop and surface it to the user instead of
   looping indefinitely.
4. Delegate to **tester** only if the item added or changed
   testable logic. Skip it for pure config/doc changes.
5. Mark the todo item completed once every subagent you actually
   invoked for it has reported success.

If a task is small enough that Step 2's plan has 1-2 todo items
with no security surface, skip subagents entirely and just
implement it yourself — the orchestration overhead isn't worth it
for small tasks.

## Step 4b: Checkpoint after each completed item

`/undo-file` only restores one file — it doesn't catch a later
item breaking something an earlier item built. After marking any
todo item complete, run the FULL test suite (not just the item's
own test), not only lint/unit tests scoped to that item. If a
previously-passing test now fails, stop immediately: do not
proceed to the next todo item. Report which item broke which test
and ask the user how to proceed (fix now vs. roll back the item).

If the project uses git, also commit after each completed item
with a small, reviewable message (e.g. `wip: jwt.ts + tests`) so
the user has real rollback points beyond file snapshots. Mention
this to the user if you do it, so they're not surprised by the
commit history.

## Step 5: Final check

Once all todos are complete:
- Run the full test suite yourself (not just per-item)
- Delegate to **security-reviewer** once more, across ALL files
  changed in this task, not just the ones flagged individually
- Summarize: what changed, which files were touched, test results,
  and final security status

## Step 6: Suggest next steps

Remind the user they can run `/save-it` if they're satisfied with
the result, or `/undo-file` if any unrelated file was touched by
mistake.
