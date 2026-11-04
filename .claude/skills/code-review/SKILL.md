---
name: code-review
description: Reviews staged changes before a PR is submitted. Use when the user asks for a code review or wants feedback before opening a PR.
allowed-tools: Read, Grep, Glob, Bash
---

Review staged changes for:
1. TypeScript errors or `any` types
2. Missing tests
3. Security issues (exposed secrets, SQL injection) — if found,
   suggest running the security-reviewer subagent for a deeper pass
4. Performance problems
5. Code style violations against @.claude/rules/code-style.md

Format feedback as:
- 🔴 Must fix
- 🟡 Should fix
- 🟢 Nice to have
