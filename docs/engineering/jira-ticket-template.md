# Jira ticket template

Every branch is `type/MIL-<n>-description` (git-workflow.md §2), so every branch starts with a ticket.
Copy the block below into Jira, fill it, and use the issued `MIL-<n>` in the branch name, the PR's
"Ticket:" line, and (optionally) the commit footer.

Keep one ticket to one PR (~400 changed lines). If the work needs more, split it into linked tickets
now rather than at review.

---

**Summary:** `<type>(<scope>): <what changes, imperative, ≤ 72 chars>`
_(same as the PR title / squash commit — types and scopes are in CLAUDE.md)_

**Issue type:** Bug | Story | Task | Tech debt
**Component / scope:** core | shared | layout | admin | payment | offerings | cpe-tracker | partners | blog | seo | auth
**Branch:** `<type>/MIL-<n>-<short-description>`
**Links:** epic / parent · blocked by · relates to · Postman request(s) · `prompts/<name>.md`

### Context

Why this exists: the problem, who hits it, and what prompted it (contract change, bug report, incident).

### Current behaviour

What happens today, with file:line references or reproduction steps.

### Expected behaviour

What should happen, citing the contract (Postman folder / request, `docs/*.md`) where one exists.

### Scope

- In:
- Out (and which ticket covers it):

### Acceptance criteria

- [ ] Observable, testable outcome 1
- [ ] Observable, testable outcome 2
- [ ] `pnpm lint`, `pnpm ng test --watch=false`, `pnpm build:prod` green (state the environment)

### How to verify

Steps on local (`pnpm start`, port 4101) or the preview URL — routes, accounts, what to look for.

### Risks / assumptions / open questions

Anything the reviewer or backend must confirm.

**Estimate:** S (< 100 lines) | M (100–400) | L (> 400 — split it)
