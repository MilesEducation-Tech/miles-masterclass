# Copilot instructions

**Read and follow [`AGENTS.md`](../AGENTS.md) at the repository root before changing anything.** It is the single
source of truth for this repo, and it applies to every tool:

- **§3 Structure:** feature-first folders, placement, import boundaries, aliases and naming.
- **§4 Tech stack & standards:** `@Service()` + `inject()`, `httpResource` reads, ng-primitives, `@defer`,
  `injectAsync`, Tailwind first.
- **§9 Before you ship:** the gates, and what enforces each rule.

For branches, commits, PRs and releases (GitHub Flow), see `docs/engineering/git-workflow.md` and
`docs/engineering/versioning.md`.

These rules are enforced by git hooks and required CI checks, not only by this file. A change passes when all of
these pass:

```bash
pnpm lint                 # ESLint + scripts/check-structure.mjs
pnpm format
pnpm ng test --watch=false
pnpm build:prod
```

Do not add rules to this file. Put them in `AGENTS.md`, so Claude, Cursor, Copilot, Codex and Gemini all read the
same thing.
