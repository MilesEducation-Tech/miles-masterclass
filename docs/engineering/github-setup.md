# GitHub setup — production grade

How to configure the repository so the workflow in `git-workflow.md` is enforced by the platform, not by
people remembering. Work through it in order; each section says what it prevents.

> **Our default branch is `master`.** The ruleset that protects it is named `master-protection`, and every
> example below targets `master`. Where a rule targets "the default branch" symbolically
> (`~DEFAULT_BRANCH`), it keeps working if that ever changes.

---

## 0. The mental model

Enforcement happens in three places, and each catches a different class of mistake:

| Layer                                      | Runs                         | Catches                                                                                                    | Can be bypassed?             |
| ------------------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Local** — husky, lint-staged, commitlint | On your machine, at commit   | Formatting, lint, bad commit message, bad branch name                                                      | Yes, with `--no-verify`      |
| **CI** — GitHub Actions                    | On every PR push             | Broken build, failing tests, bad PR title, bad commits, boundary violations                                | No, if the check is required |
| **Platform** — rulesets                    | At push/merge time on GitHub | Direct pushes to `master`, unreviewed merges, red merges, deleted branches, force-pushes, unprotected tags | Only by listed bypass actors |

Local hooks are for speed, CI is for truth, and rulesets are for the rules that _must_ hold. Never rely on a
local hook alone for anything that matters, because it's advisory.

**Rulesets vs classic branch protection:** rulesets are the current system. They can be layered (several apply
at once), have an "Evaluate" mode for testing without blocking, and are configurable as JSON via the API.
Use rulesets. If you see "Branches → Add branch protection rule" in an old guide, that's the legacy UI.

> Because rulesets **layer**, always `PATCH` the existing one rather than `POST` a new one with the same
> intent. Two rulesets both targeting `master` are both in force, and the effective rules are the union —
> which is a confusing way to lock yourself out.

**Plan caveat:** protection for a _private_ repo needs GitHub Team or above. This repo is **public** on a
**Team** org, so branch protection and secret scanning are both available. Some rules are further limited:
commit-metadata rules (message/author-email patterns) are available to organizations on a GitHub Enterprise
plan, and push rulesets (file path, extension, size restrictions) can only be created for private or internal
repos — **so neither is available here.** Section 4 gives a CI-based equivalent that works on every plan.

---

## 1. Repository settings (Settings → General)

These are one-click and prevent a surprising amount of mess.

**Pull Requests section:**

- ✅ Allow squash merging → set "Default commit message" to **"Pull request title and description"**.
  This is what makes the PR title become the commit message on `master`, which is why section 4 lints PR titles.
  **Check this one specifically.** The default is "Default to the commit message", under which a
  single-commit PR takes its subject from the commit, not the PR title — and then linting the PR title
  guarantees nothing about what lands on `master`.
- ❌ Allow merge commits — with one exception: re-enable it temporarily for the Part A refactor PR, which
  should merge with a merge commit to preserve its per-phase history. Turn it back off afterwards.
- ❌ Allow rebase merging.
- ✅ Always suggest updating pull request branches.
- ✅ Automatically delete head branches.

**Other:**

- The default branch is `master`.
- Disable Wikis and Projects if you don't use them, so nobody looks for documentation there.

Same thing via the API, which is easier to verify than to eyeball:

```bash
gh api -X PATCH repos/MilesEducation-Tech/miles-masterclass \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true \
  -F allow_update_branch=true \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=PR_BODY
```

---

## 2. Ruleset: protect `master`

Settings → Rules → Rulesets → New branch ruleset.

| Setting                                           | Value                                                        | Prevents                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Name                                              | `master-protection`                                          |                                                                                                          |
| Enforcement                                       | Active (start with **Evaluate** for a day if you're nervous) |                                                                                                          |
| Target                                            | Include default branch                                       |                                                                                                          |
| Restrict deletions                                | ✅                                                           | Deleting `master`                                                                                        |
| Block force pushes                                | ✅                                                           | Rewriting shared history                                                                                 |
| Require linear history                            | ✅                                                           | Merge-commit spaghetti (turn off while merging the refactor PR)                                          |
| Require a pull request before merging             | ✅                                                           | Direct pushes                                                                                            |
| — Required approvals                              | 1                                                            | Unreviewed code                                                                                          |
| — Dismiss stale approvals on push                 | ✅                                                           | "Approved, then I pushed something else"                                                                 |
| — Require review from Code Owners                 | ✅                                                           | Unreviewed changes to core/shared/auth/payments                                                          |
| — Require approval of the most recent push        | ❌                                                           | Leave OFF: it demands an approver other than the last pusher, which is impossible in a one-reviewer repo |
| — Require extra approval for unattributed changes | ❌                                                           | Leave OFF: same one-reviewer deadlock                                                                    |
| — Require conversation resolution                 | ✅                                                           | Merging with open review comments                                                                        |
| — Allowed merge methods                           | Squash only                                                  | Accidental merge commits                                                                                 |
| Require status checks to pass                     | ✅ (see section 3)                                           | Merging red code                                                                                         |
| — Require branches to be up to date               | ✅                                                           | "Passed on my branch, broke on master"                                                                   |

**Bypass list — required in this repo.** @me-sachin-singh is the sole reviewer and GitHub does not let anyone
approve their own pull request. Without a bypass, his own PRs would be unmergeable forever. Add
**Repository admin**, mode **Always**.

What that means in practice:

| Situation                           | Outcome                                                           |
| ----------------------------------- | ----------------------------------------------------------------- |
| A colleague opens a PR              | Needs @me-sachin-singh's approval + green CI before merge unlocks |
| A colleague pushes to `master`      | Rejected                                                          |
| @me-sachin-singh opens a PR         | CI still runs; merge via "Merge without waiting for requirements" |
| @me-sachin-singh pushes to `master` | Allowed                                                           |

The bypass exists so the owner is never blocked, not so the process gets skipped. Two habits keep it honest:
still open a PR for your own work (you get CI, the preview URL and a reviewable diff), and don't merge red —
if a required check is wrong, fix the check rather than bypassing it. When a second reliable reviewer exists,
narrow the bypass to "Pull requests" mode or remove it, and turn "Require approval of the most recent push"
back on.

Same thing via the API, which you can commit as `.github/rulesets/master.json` and re-apply anywhere:

```bash
# creating it for the first time
gh api -X POST repos/OWNER/REPO/rulesets --input .github/rulesets/master.json

# amending the one that already exists — prefer this
gh api -X PUT repos/OWNER/REPO/rulesets/RULESET_ID --input .github/rulesets/master.json
```

```json
{
  "name": "master-protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": true,
        "require_last_push_approval": false,
        "require_extra_approval_for_unattributed_changes": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["squash"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "verify" },
          { "context": "pr-title" },
          { "context": "commitlint" },
          { "context": "branch-name" }
        ]
      }
    }
  ],
  "bypass_actors": [{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }]
}
```

Don't trust that `actor_id` blindly — role IDs vary. Add the bypass once in the UI, then read the real values
back and keep that file as the committed source of truth:

```bash
gh api repos/MilesEducation-Tech/miles-masterclass/rulesets --jq '.[] | {id, name}'
gh api repos/MilesEducation-Tech/miles-masterclass/rulesets/RULESET_ID > .github/rulesets/master.json
```

> **Re-record that file whenever you change a rule or rename a CI job.** A committed ruleset that has
> drifted from the live one is worse than no file at all, because the next person applies it and silently
> reverts a rule somebody added in the UI.

### Protect the release tags too

A second ruleset, target **tags**, pattern `v*`, with "Restrict deletions" and "Block force pushes" enabled.
Without it, anyone can move `v3.1.0` to point at different code, and your rollback target silently changes.

---

## 3. CI: the checks that become required

`.github/workflows/ci.yml`. The **job name** is what appears as the check context, so `verify` here matches
`"context": "verify"` above.

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [master]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm format
      - run: pnpm lint
      - run: pnpm ng test --watch=false
      - run: pnpm build:prod
      - run: pnpm build-storybook
```

**Step order is deliberate.** `format` and `lint` take under a minute; `build:prod` and `build-storybook`
take several. Cheap gates first means a missing space fails fast instead of after two full builds.

**pnpm in CI:** `pnpm/action-setup@v4` reads the `packageManager` field in `package.json`
(`pnpm@12.5.1`), so the CI version matches yours exactly — don't pin a version in the workflow as well or the
two will drift. It must come **before** `setup-node`, because `cache: pnpm` needs the pnpm binary to resolve
the store path. Always install with `--frozen-lockfile`, so CI fails on an out-of-date `pnpm-lock.yaml`
instead of silently resolving something new.

Notes:

- A check only appears in the ruleset picker **after it has run at least once**. So merge the workflow first,
  then add it as required. Getting this backwards is the classic way to lock the repo: a required check that
  has never reported sits at "pending" forever, and the PR that would fix it is blocked too.
- Keep `verify` as one job while the suite is fast. Split it into `lint` / `test` / `build` jobs (and require all
  three) when you want parallelism and clearer failure signals — but remember to mark **all** of them
  required, or splitting quietly weakens the gate.
- `permissions: contents: read` at the top means a compromised dependency in CI can't push to the repo.
  Also set Settings → Actions → General → Workflow permissions to **read-only** as the org default.
- Pin third-party actions to a commit SHA rather than a tag for anything that touches secrets.

---

## 4. Commit and PR title rules

This is the "commit message rules" part, and it works differently depending on your plan.

**Everyone: enforce the PR title.** Because you squash-merge with "Pull request title and description", the PR
title _becomes_ the commit on `master`. Lint it:

```yaml
# .github/workflows/pr-title.yml
name: pr-title
on:
  pull_request:
    types: [opened, edited, synchronize]
permissions:
  pull-requests: read
jobs:
  pr-title:
    runs-on: ubuntu-latest
    steps:
      # Pinned to a SHA, not a tag: this action receives GITHUB_TOKEN.
      - uses: amannn/action-semantic-pull-request@<commit-sha>
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          types: feat,fix,refactor,chore,docs,test,style,perf,build,ci
          scopes: core,shared,layout,admin,payment,offerings,cpe-tracker,partners,blog,seo,auth,deps,release
          requireScope: false
```

**Everyone: enforce local commits** with commitlint in husky (see `versioning.md`), plus a CI job so
`--no-verify` doesn't get the last word:

```yaml
# add to .github/workflows/pr-title.yml
commitlint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with: { fetch-depth: 0 } # commitlint needs the full history to diff against master
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: pnpm exec commitlint --from origin/${{ github.base_ref }} --to HEAD
```

Since you squash-merge, this one is advisory in the sense that only the PR title reaches `master`. Keep it as
a **required check** anyway — it keeps branch history readable for review and for `git log` during a bisect,
and it is what makes `--no-verify` pointless rather than merely discouraged.

**Branch names:** the same restrictions family covers branch naming
(`^(feat|fix|chore|refactor|docs|hotfix)/`). That rule is Enterprise-only, so on this plan use a small CI job
that checks `github.head_ref`:

```yaml
branch-name:
  runs-on: ubuntu-latest
  steps:
    - name: Branch must be type/description
      run: |
        echo "${{ github.head_ref }}" \
          | grep -qE '^(feat|fix|chore|refactor|docs|test|style|perf|build|ci|hotfix)/' \
          || { echo "::error::Branch '${{ github.head_ref }}' must start with type/ — see docs/engineering/git-workflow.md §2"; exit 1; }
```

**Enterprise orgs only: enforce at the platform.** Rulesets can restrict commit metadata, e.g. requiring the
message to match a Conventional Commits pattern. **Not available on this repo's plan** — the CI jobs above are
the equivalent. Details worth knowing if that ever changes:

- Patterns use **RE2** syntax. Negative lookahead (`?!`) is unsupported; use "Must not match" instead.
- Regexes are single-line by default; start with `(?m)` to match across lines of a message.
- Use `\n?$` rather than bare `$` for end-of-line anchors.
- On squash merges only the resulting commit is validated, and an author-email rule must also allow
  `noreply@github.com` or squash merges will fail.
- Rules apply to new commits only, never retroactively to existing history.

A starting pattern for the subject line:
`^(feat|fix|refactor|chore|docs|test|style|perf|build|ci)(\([a-z0-9-]+\))?!?: .{1,72}\n?$`

---

## 5. CODEOWNERS

`.github/CODEOWNERS`. With "Require review from Code Owners" enabled, this is what auto-requests review on
every PR.

```
* @me-sachin-singh
```

One line is all you need while there's a single owner. Per-path entries would only repeat the same name.
Add them when someone else can genuinely own an area:

```
# once the team grows
/src/app/core/          @me-sachin-singh
/src/app/shared/        @me-sachin-singh
/supabase/migrations/   @me-sachin-singh @some-backend-dev
/.github/               @me-sachin-singh
```

Owners need write access, and **an invalid file is silently ignored** — a misspelled handle does not error,
it just means nobody is requested while the rule still demands a code-owner approval. Check the "Owners"
panel on a real PR to confirm it applied. Prefer teams (`@org/frontend`) over individuals as soon as there
are two of you, so reviews don't queue behind one person.

---

## 6. PR template

`.github/pull_request_template.md` — the version in `git-workflow.md`. Keep it short. A template nobody fills
in is worse than none, because reviewers learn to skim past it.

Optionally add `.github/ISSUE_TEMPLATE/bug.yml` with required fields for version (from `/version.json`),
browser, and steps. That closes the loop with the build-identity work in `versioning.md`.

---

## 7. Vercel integration

- Connect the repo through the Vercel GitHub app. Production deploys from `master`; every PR gets a preview.
- Set env vars per environment in Vercel (Production / Preview / Development), not in the repo.
- Enable **Skew Protection** (Settings → Advanced) and wire the deployment ID into requests — see `versioning.md`.
- Consider adding Vercel's deployment status as a required check so a PR can't merge if its preview failed to
  build. Verify it reports reliably on your plan first; a check that sometimes doesn't post will block every merge.
- Use the Ignored Build Step to skip preview builds for docs-only branches if preview minutes become a concern.

> If you ever rename the default branch, Vercel's production branch must be changed in the dashboard in the
> same window, or production deploys stop silently.

---

## 8. Security settings (Settings → Code security)

| Feature                           | Turn on             | Notes                                                                                                          |
| --------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Dependabot alerts                 | ✅                  | Free on all plans                                                                                              |
| Dependabot security updates       | ✅                  | Auto-PRs for vulnerable deps                                                                                   |
| Dependabot version updates        | ✅                  | Needs `.github/dependabot.yml` (below)                                                                         |
| Secret scanning + push protection | ✅                  | **Free here — this repo is public.** Push protection is the one that actually blocks a leak _before_ it lands. |
| CodeQL (code scanning)            | ✅ if available     | Free for public repos, so available here                                                                       |
| Private vulnerability reporting   | ✅ for public repos |                                                                                                                |

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: '/'
    schedule: { interval: weekly, day: monday }
    open-pull-requests-limit: 5
    groups:
      angular:
        patterns: ['@angular*', '@angular-devkit/*', 'angular-eslint', 'zone.js']
      storybook:
        patterns: ['@storybook/*', 'storybook', 'eslint-plugin-storybook']
      dev-minor:
        dependency-type: development
        update-types: ['minor', 'patch']
    commit-message:
      prefix: 'chore(deps)'
  - package-ecosystem: github-actions
    directory: '/'
    schedule: { interval: monthly }
    commit-message:
      prefix: 'ci(deps)'
```

Grouping matters for Angular: the packages must move together, and 20 separate PRs that each fail
`pnpm build` are worse than one that passes.

**Rotate anything already leaked.** If a token ever reached the repo — including in
`postman/*_PROD.postman_environment.json` — rotate it. Deleting the file doesn't remove it from history, and
this repo is public. Check `postman/` **before** enabling push protection, so the first thing it flags isn't
something that has already been public for months.

---

## 9. Optional, once the team is bigger than ~4

- **Merge queue:** serializes merges and tests each PR against the real merge result. Fixes "both PRs were green,
  master is red". Worth it once you get several merges a day.
- **Environments** (Settings → Environments): if you ever deploy from Actions rather than Vercel's integration,
  environments give you required reviewers and environment-scoped secrets for production.
- **Push ruleset:** would block `.env`, `*.pem`, `*.p12`, and files over ~5 MB from ever entering the commit
  graph — but push rulesets are private/internal-repo only, so **not available on this public repo.** Secret
  scanning push protection (§8) covers the credential half.
- **Org-level rulesets:** if you add more repos, define the ruleset once at the org level and target
  repositories by property instead of repeating it.

---

## 10. Rollout order (don't lock yourself out)

1. Merge `ci.yml` and `pr-title.yml` on a normal PR, so the checks exist and have run once.
2. Add CODEOWNERS and the PR template.
3. Create/amend `master-protection` in **Evaluate** mode. Open a test PR and read the ruleset insights.
4. Switch it to **Active**. Confirm that `git push origin master` from your machine is now rejected.
5. Add the tag ruleset.
6. Turn on Dependabot and secret scanning.
7. Set Actions workflow permissions to read-only, and pin third-party actions.
8. Tell the team: paste the updated `git-workflow.md`, and say clearly which day the rules go live.

## Verification checklist

- [ ] `git push origin master` is rejected
- [ ] A PR with a failing test cannot be merged
- [ ] A PR titled `update stuff` fails the `pr-title` check
- [ ] A local `git commit -m "update"` is rejected by commitlint
- [ ] A commit on a branch named `my-stuff` is rejected locally, and the PR fails `branch-name` in CI
- [ ] Any PR requests @me-sachin-singh as code-owner reviewer automatically — confirmed in the PR's
      **Owners** panel, not assumed
- [ ] @me-sachin-singh sees "Merge without waiting for requirements" on his own PR, and a colleague does not
- [ ] The merge button offers only "Squash and merge"
- [ ] The squashed commit on `master` is the PR title verbatim, not a branch commit message
- [ ] The head branch is deleted after merge
- [ ] `git tag -d v3.0.1 && git push --delete origin v3.0.1` is rejected
- [ ] A commit containing a fake token is blocked by push protection
- [ ] A Vercel preview URL appears on every PR
