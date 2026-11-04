---
name: run-tests
description: Runs the test suite and fixes failures. Use when the user asks to run tests or says tests are failing.
allowed-tools: Read, Bash, Edit
---

1. Run `npm test` and capture output
2. If tests fail, read the failing test file and the code under test
3. Identify the root cause
4. Fix the issue
5. Re-run tests to confirm passing
6. Summarize what was fixed
