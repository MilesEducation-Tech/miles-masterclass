# Deploy production on release, not on every merge

Approved and implemented 2026-10-09 on `ci/MIL-44-deploy-on-release`. **Unblocked:** the prerequisites
below are met, and v3.1.0 was released through release-please the same day.

## Jira ticket

**Summary:** `ci(release): deploy production only when a release is merged`

**Issue type:** Task
**Component / scope:** release
**Branch:** `ci/MIL-44-deploy-on-release`
**Links:** blocked by: `RELEASE_PLEASE_TOKEN` secret (versioning.md §2) · `prompts/deploy-on-release.md`

### Context

PRs are small (one page or feature each) and every merge to `master` deploys straight to production.
The only gate before production is lint + build: there are no tests, no preview deploys, and UAT is opt-in.
Every deploy also changes `buildId`, and `UpdateChecker` then shows open tabs a dialog they can't close
and whose only button reloads the page. Ten merges a day can mean ten forced reloads a day, including
mid-exam or mid-checkout.

### Current behaviour

- Vercel builds and promotes a production deployment for every push to `master` (`vercel.json` has no
  `ignoreCommand`; `vercel.sh` picks `build:prod` when `VERCEL_ENV` is `production`).
- release-please (`.github/workflows/release.yml`) cuts versions, but versions don't gate deploys
  (git-playbook.md §12: "Versions don't gate deploys").

### Expected behaviour

- A `master` push builds production **only** when it is the merged Release PR. Every other `master` push
  gets a canceled deployment, and production stays where it is.
- UAT and any other non-production deploys build exactly as today.
- Users get one update prompt per release, not one per merge.

### Scope

- In: one `ignoreCommand` line in `vercel.json`; the docs that say "every merge deploys".
- Out: Skew Protection and Sentry (separate tickets, versioning.md §3–4); making the update prompt
  dismissable.

### Acceptance criteria

- [ ] Merging a non-release PR leaves a **Canceled** production deployment in Vercel, and
      `/version.json` on production doesn't change.
- [ ] Merging the Release PR builds production, and `/version.json` shows the new `version` and the
      release commit's `sha`.
- [ ] A push to `uat` still builds and deploys to `uat.milesmasterclass.us`.
- [ ] No doc still says every merge deploys to production.
- [ ] `pnpm format` and `pnpm lint` green (state the environment).

### How to verify

See "How to verify" below; it can only be checked on Vercel after the merge.

### Risks / assumptions / open questions

See below.

**Estimate:** S (< 50 lines)

---

## What I read

- `vercel.json`, `vercel.sh`, `release-please-config.json`, `.github/workflows/{release,ci,pr-title}.yml`
- `docs/engineering/versioning.md` §2–5, `git-workflow.md` §1 + Release, `git-playbook.md` §4, §6, §12
- Vercel docs (fetched 2026-10-09): `vercel.json` → `ignoreCommand`; Project settings → Ignored Build
  Step. Exit **1** builds, exit **0** cancels; the command can read the build-time system env vars;
  a Redeploy can untick "Use project's Ignore Build Step"; canceled builds still count toward deployment
  quotas and build slots.

## Locked decisions

1. **Find the release by its manifest, not its title.** The command checks whether `HEAD` changed
   `.release-please-manifest.json`. release-please bumps that file on every release, and nothing else
   touches it. Matching the commit title would depend on release-please's title pattern and on GitHub's
   ` (#N)` squash suffix.
2. **Gate production only.** If `VERCEL_ENV` is not `production`, the build runs. `vercel.sh` already
   uses the same test to choose `build:prod`.
3. **Put it inline in `vercel.json`, not in a script file.** It's one line. JSON can't hold the why, so
   versioning.md §4 does.

## The change

`vercel.json`, after `buildCommand`:

```json
"ignoreCommand": "[ \"$VERCEL_ENV\" != production ] && exit 1; git diff --quiet HEAD^ HEAD -- .release-please-manifest.json",
```

Tested locally on 2026-10-09 (macOS, `sh -c` with the exact string):

| Case                                           | Exit | Meaning |
| ---------------------------------------------- | ---- | ------- |
| current `master` HEAD, `VERCEL_ENV=production` | 0    | skip    |
| current `master` HEAD, `VERCEL_ENV=preview`    | 1    | build   |
| `248bc2b` (changes the manifest), `production` | 1    | build   |

## Docs touched

- `docs/engineering/versioning.md` §4: one bullet, "Production deploys on release, not on merge", with
  the mechanism, the two gotchas below and the escape hatch; one checklist line.
- `docs/engineering/git-workflow.md`: §1 bullet "Whatever is on `master` is what's in production" →
  production runs the last release; the `tag: "→ prod"` on the feature merge in the §1 diagram; the
  Release paragraph's "`master` deploys to production on merge".
- `docs/engineering/git-playbook.md`:
  - §4 step 8 "This deploys to production" → it lands on `master`; production gets it with the next release.
  - §6 hotfix: step 3 becomes "merge", and step 5 (merge the Release PR) becomes the step that deploys.
  - §12 "How it works" item 1 → merging the Release PR is what deploys.
  - The `→ prod` tag in the §5 diagram.

## Prerequisites (block the merge, not the branch)

1. ✅ `RELEASE_PLEASE_TOKEN` is set (2026-10-09, 11:09 UTC).
2. ✅ The annotated tag `v3.0.1` at the bootstrap commit `7bc8f63` is already on origin.
3. ✅ Release PR #86 `chore(master): release 3.1.0` is open and changes `.release-please-manifest.json`.

## Risks

- **A stretch of refactor-only merges never opens a Release PR.** release-please proposes a release
  only for releasable commits (`feat`, `fix`, `perf`, breaking changes). `refactor:`, `chore:` and
  `docs:` wait for the next one. That includes config-only changes like `5c8fc67`. Escape hatch: Vercel →
  Deployments → the canceled `master` deployment → **Redeploy** → untick "Use project's Ignore Build Step".
- **Hotfixes take one more click:** merge the fix, then merge the Release PR.
- **Canceled deployments still count** toward Vercel's deployment quota and build slots.
- **A batch is harder to bisect** than a single merge. Instant Rollback is unchanged (it doesn't rebuild).
- **Assumptions:**
  - The UAT environment's `VERCEL_ENV` is not `production`. `vercel.sh` already relies on this.
  - Vercel's clone includes `HEAD^`. Vercel's own `ignoreCommand` example uses it.

## Checks

```bash
pnpm format:fix
pnpm lint
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"
```

`build:prod` doesn't read `vercel.json`, so it proves nothing here.

## How to verify (after the merge, on Vercel)

1. The merge of **this** PR is itself the first test. Vercel → Deployments should show it **Canceled**
   with the Ignored Build Step message, and `curl -s https://www.milesmasterclass.com/version.json`
   should still show the previous `sha`.
2. Put any branch on `uat` (git-playbook.md §5). It builds as before.
3. Merge the Release PR. Production builds, and `/version.json` shows the new `version` and `sha`.
