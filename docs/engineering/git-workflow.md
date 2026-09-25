# Git workflow — miles-masterclass

How we branch, review and ship. Read this once; keep the "Daily routine" section handy.

> **Our default branch is `master`, not `main`.** If you've worked on repos that use `main`, translate as
> you read — every command here says `master` because that is what the remote actually has.

> **Rollout status (2026-09-25).** The review half of §5 is live today: you cannot push to `master`, and a
> PR needs a code-owner approval with conversations resolved. The **automated** half is still being wired
> up — commitlint (§3), the branch-name guard (§2) and the required CI checks (§6) land over the next few
> PRs, tracked in `prompts/engineering-enforcement-harness.md`. Until they do, treat those sections as the
> rules you're expected to follow rather than rules a machine currently enforces for you. This note comes
> out when the checklist at the end of `github-setup.md` is fully green.

---

## 1. The short version

We use **GitHub Flow**: one permanent branch (`master`), and short-lived branches off it.

- `master` is always deployable. Whatever is on `master` is what's in production.
- You never commit directly to `master`. Everything goes through a Pull Request (PR).
- A branch lives **1–3 days**, not weeks. Small PRs get reviewed fast, and big ones rot.
- Every PR gets a Vercel preview URL. Test there before asking for review.

```mermaid
gitGraph
  commit id: "v3.0.1"
  branch feat/MIL-231-seat-allocation
  commit id: "feat: seat picker"
  commit id: "test: seat picker"
  checkout master
  merge feat/MIL-231-seat-allocation tag: "preview → prod"
  branch fix/MIL-240-invoice-total
  commit id: "fix: invoice total"
  checkout master
  merge fix/MIL-240-invoice-total
```

**Why not a `develop` branch?** Because we deploy from `master` and every PR already gets its own preview
environment. A second long-lived branch would only add a merge step and a place for work to get stuck.

---

## 2. Branches

### Permanent

| Branch             | Purpose                                                                                                                   | Who can push               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `master`           | Production. Protected.                                                                                                    | Nobody directly — PRs only |
| `uat` _(optional)_ | A stable URL for client/QA sign-off. Fast-forwarded from `master` or from a specific commit when QA needs a frozen build. | Release owner              |

### Temporary (yours)

Name them `type/TICKET-short-description`, all lowercase, words separated by hyphens.

| Prefix      | Use it for                        | Example                           |
| ----------- | --------------------------------- | --------------------------------- |
| `feat/`     | New functionality                 | `feat/MIL-231-seat-allocation`    |
| `fix/`      | Bug fix                           | `fix/MIL-240-invoice-total`       |
| `chore/`    | Deps, config, tooling, CI         | `chore/MIL-255-bump-angular`      |
| `refactor/` | Restructuring, no behavior change | `refactor/MIL-260-payment-facade` |
| `docs/`     | Documentation only                | `docs/MIL-262-readme`             |
| `hotfix/`   | Urgent production fix             | `hotfix/MIL-299-checkout-500`     |

Rules:

- One branch = one ticket = one PR. If you find a second problem, open a second ticket.
- Delete the branch after merge. GitHub offers this automatically; take it.
- Never branch off someone else's branch unless you genuinely depend on their work.
  If you must, say so in the PR description.

The prefix list is **enforced**, not advisory: a local hook rejects the commit, and a CI job rejects the
PR. See §6.

---

## 3. Commits

We use **Conventional Commits**, because release notes and the version bump are generated from them.

```
<type>(<scope>): <what changed, imperative, lowercase>

[optional body: why, not what]
[optional footer: MIL-231, BREAKING CHANGE: ...]
```

**Types:** `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`, `build`, `ci`.
This list **is enforced** — commitlint rejects anything else. (`revert` is also accepted, because
`git revert` writes it for you.)

**Scope** is the area of the app, matching our folder structure: `core`, `shared`, `layout`, `admin`,
`payment`, `offerings`, `tracker`, `partners`, `seo`, `auth`, plus the other feature folders
(`library`, `legal`, `home`, `milesverse`, `ai-labs`, `uae-caira`, `connect-us`, `faculty`), and
`deps` / `release` for dependency bumps and release commits.

> **Scope is not machine-enforced on your local commits, and that is deliberate.** Two reasons, both
> measured rather than assumed:
>
> 1. This repo's history uses **23 distinct scopes**, and only four of them appear in any canonical list.
>    The most common by far is `structure` (15 commits) — the structure refactor's own required
>    convention. A locked list would reject the work we are actively doing.
> 2. Any such list drifts. The one in `CLAUDE.md` already has: it names `blog`, a feature that has since
>    been removed, and `cpe-tracker`, where the folder is `tracker`. Drift in a doc is untidy; drift in a
>    _blocking_ gate stops work.
>
> So **scope is a convention a reviewer holds you to, not a gate.** Use one from the list above. The
> `type` is what carries machine meaning — it decides the version bump — and that _is_ enforced, on both
> your commits and the PR title.
>
> If we ever want scope enforced, the place to do it is the PR title (that is what lands on `master`), and
> `.github/workflows/pr-title.yml` carries the measured list ready to uncomment. One switch, one list, one
> place to keep current.

Line length: the subject may run to **100 characters** (not the conventional 72 — the house style here is
descriptive, and several existing subjects run to 77). Long lines in the _body_ are a warning, not an
error, so an unwrappable URL or a path table won't block a commit.

Good:

```
feat(payment): add promo code validation to cart
fix(cpe-tracker): correct credit total for half-credit courses
refactor(shared): move dialogs out of components into shared/dialogs
```

Bad:

```
update                  ← update what?
fixed bug               ← which bug?
WIP                     ← don't push WIP to a PR you want reviewed
final final v2          ← no
```

Practical notes:

- Commit often locally; tidy up before pushing. `git rebase -i` is your friend, but only on your own branch.
- husky + lint-staged run Prettier and ESLint on commit, and **commitlint rejects a message that isn't a
  Conventional Commit**. If a commit is rejected, fix the code or the message —
  never use `--no-verify`. CI re-checks both, so `--no-verify` only delays the failure.
- Merged PRs are **squashed** into one commit on `master`, so `master` stays readable.
  The exception is the refactor PRs in section 8.

> **Because we squash, the PR title becomes the commit on `master`.** That is why §6 lints the PR title as
> strictly as the commits, and why the repo is configured so the squash message comes from the PR title
> and body rather than from your branch's commit messages.

---

## 4. Pull Requests

### Size

Aim for **under 400 changed lines**. If it's bigger, split it: one PR for the backend contract, one for
the UI, one for the tests. A 2,000-line PR does not get reviewed; it gets rubber-stamped.

This one is a review norm, not a bot. Nobody fails your build over a line count — but a reviewer is
entitled to ask you to split.

### Description template

`.github/pull_request_template.md`, which GitHub pre-fills for you:

```markdown
## What

One or two sentences on what this changes.

## Why

Ticket: MIL-\_\_\_
The problem this solves.

## How to test

1. Open the preview URL at /…
2. …

## Screenshots / recordings

(Required for any UI change: mobile 375px + desktop.)

## Checklist

- [ ] `pnpm lint`, `pnpm ng test --watch=false`, `pnpm build:prod` pass locally
- [ ] No new `eslint-disable`, `@ts-ignore`, or skipped tests
- [ ] Follows the structure rules in AGENTS.md (placement, boundaries, naming)
- [ ] Tailwind utilities used; no new component CSS unless unavoidable
- [ ] Tested on the preview URL, mobile + desktop
- [ ] Branch is `type/TICKET-description` and the PR title is a Conventional Commit
```

### Review rules

- **1 approval minimum**; 2 for anything touching `core/`, `shared/`, auth, or payments.
- Reviewers respond within **one working day**. If you can't, say so, and someone else picks it up.
- The author merges, not the reviewer. The author is the one who knows if it's ready.
- Comments are about the code, not the person. "This will break when X is null" — not "you always forget null checks."
- Suggest changes with GitHub's suggestion blocks where you can; it's faster than a paragraph.

### Keeping your branch current

Before asking for review, and again before merging:

```bash
git fetch origin
git rebase origin/master      # your branch, so rebase is fine
# fix conflicts, then:
git push --force-with-lease
```

Use `--force-with-lease`, never plain `--force`. It refuses to overwrite someone else's push.

---

## 5. Branch protection on `master`

`master` is protected by a GitHub ruleset. Full setup is in `docs/engineering/github-setup.md`. What it
means for you day to day:

- You cannot push to `master`. Everything goes through a PR.
- A PR needs **one approval from @me-sachin-singh** (the code owner) and green CI before it can merge.
- Only "Squash and merge" is available. The branch is deleted automatically afterwards.
- Stale approvals are dismissed when you push again, so re-request review after changes.
- All review conversations must be resolved before merging.
- Release tags (`v*`) are protected too: they can't be moved or deleted.

@me-sachin-singh has admin bypass, because GitHub doesn't let anyone approve their own PR and he's the only
reviewer. That's an escape hatch for his own work, not a different standard: his changes still go through a
PR and still have to be green.

`.github/CODEOWNERS`:

```
* @me-sachin-singh
```

Every PR therefore requests his review automatically. As the team grows, we'll add per-path owners
(`/src/app/core/`, `/supabase/migrations/`) so reviews spread out instead of queueing behind one person.

---

## 6. CI

The same gates we run locally, run on every PR. **Nothing merges red** — these are required status checks
on the ruleset, not suggestions.

The workflows are `.github/workflows/ci.yml` and `.github/workflows/pr-title.yml`; read those for the
exact steps rather than trusting a copy pasted into a doc. Four checks must be green:

| Check         | What it does                                                                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verify`      | `pnpm format` → `pnpm lint` → `pnpm ng test --watch=false` → `pnpm build:prod` → `pnpm build-storybook`. Fast gates first, so a formatting slip fails in under a minute instead of after two builds. |
| `pr-title`    | Your PR title is a Conventional Commit with a known type and scope                                                                                                                                   |
| `commitlint`  | Every commit on the branch is a Conventional Commit, even if you used `--no-verify`                                                                                                                  |
| `branch-name` | Your branch matches `type/description`                                                                                                                                                               |

The job name is the check name, so don't rename a job without updating the ruleset — a check that never
reports reads as "pending", which blocks the merge forever.

---

## 7. Releases and hotfixes

Full detail is in **`docs/engineering/versioning.md`**. The short version:

### Release

`master` deploys to production on merge. Version numbers are **derived from commit messages**, not chosen
by hand: `fix:` bumps the patch, `feat:` the minor, and `!`/`BREAKING CHANGE:` the major. A release tool
(release-please) keeps an open Release PR with the next version and the changelog; merging it bumps
`package.json`, writes `CHANGELOG.md`, and creates the tag `v3.1.0` and a GitHub Release.

Until that's wired up, do it manually:

```bash
git checkout master && git pull
# bump "version" in package.json (3.0.1 → 3.1.0 for features, 3.0.2 for fixes)
git commit -am "chore(release): v3.1.0"
git tag -a v3.1.0 -m "v3.1.0"
git push origin master --tags
```

`scripts/generate-version.mjs` writes `version.json` at build time, which the in-app update checker reads.
So a version bump must be a real commit on `master`, never a manual edit on the server.

### Rollback

Use Vercel's Instant Rollback to the previous deployment. Don't revert-and-rebuild under pressure;
roll back first, then fix forward with a normal PR.

### Hotfix

Production is broken and you can't wait for the queue:

```bash
git checkout master && git pull
git checkout -b hotfix/MIL-299-checkout-500
# smallest possible fix + a test that would have caught it
git push -u origin hotfix/MIL-299-checkout-500
```

Open the PR, mark it urgent, get one fast review, merge, tag a patch version. Because we only have
`master`, there is nothing to back-merge afterwards.

---

## 8. The refactor: extra rules while it runs

The structure refactor moves most files in `src/app`. That makes it the one situation where our normal
"just rebase" advice isn't enough.

### The branches

- **Part A (structure moves):** one branch, `refactor/structure`, with **one commit per phase**.
  It merges with a **merge commit** (`--no-ff`), not a squash, so each phase stays reviewable in history.
- **Part B (modernization):** one branch per phase or feature, e.g. `refactor/phase-09-data-payment`.
  These follow the normal squash-merge rules.

> ⚠️ The Part A merge commit is a **deliberate, temporary exception** to the squash-only rule in §5.
> It needs `required_linear_history` turned off and merge commits re-enabled for exactly that one PR,
> and both must be put back the same day. Treat it as an announced maintenance window, not a precedent.

### What everyone else must do

1. **Merge your open work before Part A lands.** A branch that's open across the restructure will conflict
   with hundreds of renamed paths. Finish it, or park it and re-do it after.
2. **During the Part A merge window** (announced in advance, usually a day), don't merge anything into `master`.
3. **Straight after Part A merges**, everyone runs:
   ```bash
   git checkout master && git pull
   git checkout your-branch
   git merge master            # merge, NOT rebase, for this one
   ```
   Use `merge` here because rebasing replays each of your commits across the renames and you resolve the
   same conflict repeatedly. A merge makes you resolve it once.
4. **Resolving rename conflicts:** git usually detects the rename and moves your change with it. When it
   shows "deleted by them", the file moved. Find the new path
   (`git log --diff-filter=R --find-renames -- old/path`), then apply your change there and
   `git add` the new path.
5. **After the refactor**, the rules in `AGENTS.md` are enforced by ESLint. A PR that imports across feature
   boundaries will fail CI. That's intentional.

---

## 9. Daily routine (copy this)

```bash
# 1. Start fresh from master
git checkout master
git pull

# 2. New branch for your ticket
git checkout -b feat/MIL-231-seat-allocation

# 3. Work. Commit in small, meaningful pieces.
git add -p
git commit -m "feat(admin): add seat allocation dialog"

# 4. Push and open a PR (first push sets the upstream)
git push -u origin feat/MIL-231-seat-allocation

# 5. Before review, and again before merging: get current with master
git fetch origin
git rebase origin/master
git push --force-with-lease

# 6. Merge via the GitHub UI (Squash and merge), delete the branch.
```

---

## 10. pnpm conventions

We use **pnpm only**. Mixing package managers creates a second lockfile and a different dependency tree,
and the two will disagree at the worst moment.

| Task                               | Command                                               |
| ---------------------------------- | ----------------------------------------------------- |
| Install after cloning or pulling   | `pnpm install`                                        |
| Install exactly what's locked (CI) | `pnpm install --frozen-lockfile`                      |
| Add a runtime dependency           | `pnpm add <pkg>`                                      |
| Add a dev dependency               | `pnpm add -D <pkg>`                                   |
| Remove                             | `pnpm remove <pkg>`                                   |
| Run a binary from node_modules     | `pnpm exec <bin>` (not `npx`)                         |
| One-off package, not installed     | `pnpm dlx <pkg>`                                      |
| Run a script                       | `pnpm <script>`, e.g. `pnpm start`, `pnpm build:prod` |

- **Never run `npm install` or `yarn`** in this repo. If a `package-lock.json` or `yarn.lock` appears,
  delete it — it shouldn't be committed.
- **Always commit `pnpm-lock.yaml`** together with the `package.json` change that caused it. A PR that changes
  dependencies without the lockfile will fail CI's `--frozen-lockfile` install.
- **Never hand-edit the lockfile.** Change `package.json` via `pnpm add`/`pnpm remove` and commit the result.
- **The pnpm version is pinned** by `"packageManager": "pnpm@12.5.1"` in `package.json`. Enable Corepack
  (`corepack enable`) and your machine will use that exact version automatically. CI reads the same field.
- After a branch switch that changes dependencies, run `pnpm install` before anything else. Stale
  `node_modules` produce confusing build errors.
- Commit dependency changes as `chore(deps): …`.

---

## 11. Things that break the repo — don't do these

| Don't                                                     | Why                                           | Do instead                                                 |
| --------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| `git push --force` to a shared branch                     | Erases other people's commits                 | `git push --force-with-lease`, and only on your own branch |
| `git commit --no-verify`                                  | Skips lint/format/commitlint; CI fails anyway | Fix the lint error or the commit message                   |
| Commit directly to `master`                               | Skips review and CI                           | Branch + PR                                                |
| Commit `.env`, keys, or Postman env files with tokens     | Leaks credentials                             | Use env vars; tell the team if it happens so we can rotate |
| Commit `dist/`, `node_modules/`, `.angular/`, `.DS_Store` | Bloats the repo                               | Check `.gitignore`; `git status` before committing         |
| Edit `pnpm-lock.yaml` by hand                             | Corrupts resolution                           | `pnpm add` / `pnpm install`, then commit the result        |
| Leave a branch open for 3 weeks                           | Guaranteed conflict hell                      | Split the work and ship in pieces                          |
| Mix a refactor and a feature in one PR                    | Impossible to review; a bug can't be bisected | Two PRs: refactor first, then the feature                  |

---

## Glossary for anyone newer to git

- **Branch** — your own copy of the code to work on, so you don't disturb anyone else.
- **Commit** — a saved snapshot with a message explaining the change.
- **Push / pull** — upload your commits to GitHub / download other people's.
- **PR (Pull Request)** — "please review my branch and put it into master." Where review and CI happen.
- **Rebase** — replay your commits on top of the latest `master`, so history stays a straight line.
- **Merge conflict** — two people changed the same lines. Git can't choose, so you decide and commit the fix.
- **Squash** — collapse all the commits on your branch into one commit on `master`.
- **CI** — the automated checks (lint, tests, build) that run on your PR.
- **Preview URL** — the temporary Vercel deployment of your branch, for testing before merge.
