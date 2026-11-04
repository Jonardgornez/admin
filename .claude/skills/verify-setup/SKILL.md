---
name: verify-setup
description: Verifies this Claude Code setup is wired correctly — checks that CLAUDE.md, rules, skills, agents, and hooks all load, then runs a small real task through the full write-code pipeline to confirm coder, security-reviewer, tester, snapshot, and secret-scan all actually fire. Use when the user asks to test, verify, or check the setup, or types /verify-setup.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

Run this in two phases. Report results as a checklist, not prose.
Do not skip a phase because an earlier one looked fine — config
loading and runtime behavior are different failure modes.

## Phase 1: Config check (static)

Verify each of these exist and are well-formed. Do not guess —
actually read/run each check:

1. **CLAUDE.md** — confirm it's readable and its `@rules/...`
   imports resolve to real files (`.claude/rules/code-style.md`,
   `testing.md`, `git.md`)
2. **Skills** — confirm each `SKILL.md` under `.claude/skills/`
   has valid YAML frontmatter with at least `name` and
   `description`. Flag any with a name that doesn't match its
   folder name. When comparing strings in bash, use `=` not `==`
   inside `[ ]` — `==` is a bashism that fails under `/bin/sh`
   and can produce false failures on hyphenated names.
3. **Agents** — confirm `coder.md`, `security-reviewer.md`,
   `tester.md` exist under `.claude/agents/` with valid
   frontmatter and a `description` field.
4. **settings.json** — confirm it's valid JSON (use `Bash` to run
   `python3 -m json.tool .claude/settings.json` or `jq . .claude/settings.json`
   and check exit code, don't eyeball it).
5. **Hooks** — confirm each `.sh` file under `.claude/hooks/` is
   executable (`test -x`) and passes `bash -n` syntax check.
6. **jq availability** — run `command -v jq`. If missing, report
   it as a warning: snapshot.sh and log-activity.sh degrade
   gracefully but /undo-file and activity logging won't work
   until it's installed.
7. **gitleaks availability** — run `command -v gitleaks`. If
   missing, report as a warning: secret-scan.sh falls back to a
   weak regex tripwire.

Report Phase 1 as a pass/fail table, one line per check.
If anything in steps 1-4 fails, stop here and report — don't
proceed to Phase 2 against a broken config.

## Phase 2: Functional check (runtime)

Only run this if the user confirms after Phase 1, or if they
explicitly asked for a full test.

Run a deliberately tiny, throwaway task designed to exercise every
part of the pipeline in one pass:

1. Tell the user you're creating a temporary test file at
   `src/lib/__verify_setup_test.ts` (or the project's actual
   src convention) that will be deleted at the end — this is not
   real project work.
2. Delegate to **coder**: implement a trivial function in that
   file that reads a hardcoded value called `apiSecret` and
   returns it directly (this is intentionally insecure — it's
   designed to trigger security-reviewer, not real project code).
3. Confirm coder flagged it as security-sensitive. If it didn't,
   that's a Phase 2 failure — coder isn't flagging correctly.
4. Confirm you delegated to **security-reviewer** and it returned
   a 🔴 CRITICAL finding about the hardcoded secret. If it
   returned 🟢 CLEAN, that's a failure — the reviewer isn't
   catching an obvious case.
5. Relay the finding back to **coder**, have it fix the function
   to accept the value as a parameter instead. Re-run
   **security-reviewer** and confirm it now reports 🟢 CLEAN.
6. Confirm the **snapshot.sh** hook fired: check
   `.claude/memory/snapshots/index.md` for a new entry timestamped
   during this test.
7. Confirm the **log-activity.sh** hook fired: check
   `.claude/memory/files-touched.md` for the test file.
8. Delegate to **tester**: it should report there's no test yet
   for this function — confirm it says so rather than inventing
   a false pass.
9. Delete the temporary test file and its test (if any were
   created), and remove the snapshot/log entries this test
   generated so they don't pollute real history.
10. If the project uses git, confirm nothing from this test was
    staged or committed.

Report Phase 2 as a pass/fail table: coder flagged risk (Y/N),
security-reviewer caught it (Y/N), fix-and-recheck loop worked
(Y/N), snapshot hook fired (Y/N), log hook fired (Y/N), tester
reported honestly (Y/N), cleanup completed (Y/N).

## Final output

End with a single summary line: either
"✅ Setup verified — config and pipeline both working" or
"⚠️ Setup has issues — see failed checks above" with the failed
items listed first, not buried in the table.
