# My Web App

## Stack

- Frontend: React 19, TypeScript, Vite
- Linting: oxlint
- Not installed yet: Tailwind, cva, react-hook-form, Zod, a router, and a test runner (rules that mention them apply once they're added)

## Folder Structure

├── src/
│ ├── main.tsx # App entry point
│ ├── App.tsx # Root component
│ ├── App.css
│ ├── index.css # Global styles
│ ├── assets/ # Images and SVGs imported by components
│ ├── component/
│ │ └── ui/ # Reusable UI components (empty)
│ ├── data/ # Mockup data (not created yet)
│ ├── lib/
│ │ └── validations/ # Validation schemas like zod (not created yet)
│ └── types/ # Shared TypeScript types (not created yet)
├── public/ # Static assets served as-is
├── index.html # Vite HTML entry
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── .oxlintrc.json
└── package.json

## Instructions

- Always use TypeScript, never plain JS
- Use npm
- Run `npm run lint` before finishing any task

## Rules

@.claude/rules/code-style.md
@.claude/rules/testing.md
@.claude/rules/git.md

## Memory Instructions

- At the start of a session, use /remember to recall prior work
- At the end of every satisfying task, use /save-it to log it
- Never delete old entries in activity-log.md, always append
- Keep each file entry to one line

## Workflow Requirements

For any non-trivial task (more than a one-line fix), use the
write-code skill. It will:

1. Plan first and wait for approval before editing
2. Create a todo list
3. Delegate each item to specialist subagents (coder, security-reviewer, tester)
4. Only mark an item complete once all relevant checks pass
5. Run a final check across the whole task before finishing
