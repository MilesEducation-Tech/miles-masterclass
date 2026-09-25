# Enforcement verification — 2026-09-25

Walking `github-setup.md`'s checklist against the **live** repository, with evidence. Every line either
passes with proof, fails with a cause, or is marked as needing a human.

**Verdict: the platform layer is correctly configured, and the repository is currently unmergeable for
anyone without admin bypass.** Those two facts are not in tension — the settings are right, but the
workflows on `master` are an older, broken revision that cannot satisfy them.

---

## 1. Verdict in one table

| Layer                       | State                                                                           |
| --------------------------- | ------------------------------------------------------------------------------- |
| Repository settings         | ✅ all correct                                                                  |
| `master-protection` ruleset | ✅ all five rules live, including `required_status_checks`                      |
| `tag-protection` ruleset    | ✅ live, `refs/tags/v*`, no bypass                                              |
| Security / supply chain     | ✅ secret scanning, push protection and Dependabot updates all enabled          |
| **CI on `master`**          | 🚨 **stale and broken — see §3. This is what blocks everything.**               |
| **Test suite in CI**        | 🚨 **red: 3 failures in `blob-download.spec.ts` that do not reproduce locally** |

---

## 2. What holds, with evidence

Read back from the API on 2026-09-25.

### Repository settings

```
squash_merge_commit_title  = PR_TITLE      squash_merge_commit_message = PR_BODY
allow_merge_commit = false                 allow_rebase_merge = false
allow_squash_merge = true                  delete_branch_on_merge = true
allow_update_branch = true                 has_wiki = false   has_projects = false
```

- [x] The merge button offers **only** "Squash and merge"
- [x] The head branch is deleted after merge
- [x] **C8 is fixed** — the squash subject is the PR title, not a commit message. This is what makes the
      `pr-title` check load-bearing rather than decorative.

### `master-protection` (id `23922688`)

```
rules   = deletion, non_fast_forward, required_linear_history, pull_request, required_status_checks
checks  = verify, pr-title, commitlint, branch-name     strict = true
pull_request: approvals=1  code_owner=true  dismiss_stale=true
              last_push=false  unattributed=false  threads=true  merge=[squash]
bypass  = RepositoryRole / always
```

- [x] **C1 is fixed** — `required_status_checks` exists. Red CI can no longer merge.
- [x] C2 / C3 fixed — both one-reviewer deadlock rules are off.
- [x] Direct pushes, deletions and force-pushes to `master` are all blocked by rule.

### `tag-protection` (id `23981239`)

```
include = refs/tags/v*     rules = deletion, non_fast_forward     bypass_actors = 0
```

- [x] C4 fixed. No bypass, deliberately — moving a release tag changes what Instant Rollback rolls back to.
- ⚠️ **Not yet provable:** there are **zero tags** in the repo, so the pattern has never matched anything.
  Verify when `v3.0.1` is first created (§5).

### Security

```
secret_scanning = enabled   secret_scanning_push_protection = enabled
dependabot_security_updates = enabled   dependabot_alerts = enabled
```

- [x] Push protection is on, and the pre-flight audit found nothing to rotate: every secret-typed field in
      `postman/*environment.json` is empty **at every revision**, and no `.env`/`.pem`/`.p12`/`.key` has
      ever been committed.

### CODEOWNERS

```
content: "* @me-sachin-singh"     codeowners/errors: 0     permission: admin
```

- [x] The handle resolves, has write access, and GitHub reports **zero** CODEOWNERS errors. This is the
      one that fails silently when wrong, so it was checked against the API rather than by reading the file.

### Local hooks

- [x] `git commit -m "update"` is rejected — verified through husky's own `commit-msg` wrapper, exit 1.
- [x] A commit on a branch named `my-stuff` is rejected — 11/11 branch cases, with CI and local agreeing.

---

## 3. 🚨 Blocker 1 — the workflows on `master` cannot satisfy the ruleset

**This is the live lockout, and it is the exact failure mode `github-setup.md` §3 warns about.**

The ruleset requires four checks. `master` can only produce **two**, and one of those always fails:

| Required context | Produced by `master` today?                                        |
| ---------------- | ------------------------------------------------------------------ |
| `verify`         | yes — but **fails**, see §4                                        |
| `pr-title`       | yes — but **always fails**, see below                              |
| `commitlint`     | **no — the job does not exist on `master`.** Permanently "pending" |
| `branch-name`    | **no — the job does not exist on `master`.** Permanently "pending" |

A required check that never reports is never satisfied, so **every pull request is blocked indefinitely**,
including the one that would fix it. Only the admin bypass can merge anything right now.

Two further defects in the `master` revision:

1. **`pr-title` can never pass.** Its `types` input is comma-separated, but the action treats each **line**
   as a regex wrapped in `^$`. The live run proves it — note the single bullet:

   ```
   ##[error]No release type found in pull request title "Feat/git version setup".
   Available types:
    - feat,fix,refactor,chore,docs,test,style,perf,build,ci
   ```

   Every title fails, including correct ones.

2. **`ci.yml` triggers on `push: branches: [main]`** — a branch that does not exist here. Post-merge CI on
   `master` has never run.

### How this happened

PR #14 merged at 05:33 UTC carrying only the first phases of this work. Its own checks were red at the
time and it was merged through the admin bypass, so the fixes for all three defects — which exist on
`feat/git-version-setup` — never reached `master`.

Evidence that the bypass was used while red: the squashed commit on `master` is
**`Feat/git version setup (#14)`**, which fails the very commitlint rules that PR installed.

> This is not an argument against the bypass — it exists precisely so the owner is never blocked. It is an
> argument for the habit `github-setup.md` §2 names: **don't merge red.** Here, merging red is what left
> `master` unable to satisfy its own ruleset.

---

## 4. 🚨 Blocker 2 — `verify` is red on three tests that pass locally

```
FAIL src/app/shared/utils/blob-download.spec.ts
  TypeError: Failed to execute 'readAsArrayBuffer' on 'FileReader':
             parameter 1 is not of type 'Blob'.
    ❯ jsdom/living/generated/FileReader.js:115
    ❯ jszip/lib/utils.js:467
  Tests  3 failed | 551 passed | 1 skipped
```

Locally the same suite is **green** (164 files, 559 passed). `jsdom` is lockfile-pinned to the same
`27.4.0` in both, so the dependency tree is identical. What differs is the environment: **CI is
ubuntu + Node 22.x; local is macOS + Node 24.15.0.**

### Root cause

`downloadFiles` does `response.blob()`, and under vitest `Response` is Node's native (undici) one — so the
value is a **Node `Blob`**. jszip then decides it is blob-like via the string tag, which succeeds:

```js
var isBlob =
  support.blob &&
  (data instanceof Blob ||
    ['[object File]', '[object Blob]'].indexOf(Object.prototype.toString.call(data)) !== -1);
```

…and hands it to `FileReader`, which in the jsdom environment is **jsdom's** `FileReader` and accepts only
**jsdom** `Blob`s. Node Blob into jsdom FileReader is the exact error above. Whether the two implementations
collide depends on how the globals resolve, which is what changes between Node majors.

**This is a test-environment defect, not a product defect** — a real browser has exactly one `Blob`.

### Not reproduced locally, and why

Homebrew's `node@22` is **22.13.1**, below the Angular CLI's floor (`v22.22.3`), so `ng test` hard-aborts
before running — the same floor that broke the Vercel deploy. Isolating Node-major from OS needs a real
22.22.3+. **Two variables differ and neither has been eliminated**; the Node major is the likelier of the two,
not a proven cause.

### Consequence for `AGENTS.md`

§9 now says all five gates are green. That was measured on macOS + Node 24 and **is not true of CI**, which
is the environment that decides merges. Corrected there — the claim now names the environment.

---

## 5. Needs a human — cannot be verified from here

Each of these needs an action that would change the repository.

- [ ] `git push origin master` is rejected **for a non-admin** (the owner's bypass makes a self-test
      meaningless — ask a colleague, or read the ruleset insights)
- [ ] A PR with a failing test cannot be merged
- [ ] A PR titled `update stuff` fails `pr-title` — only meaningful **after** §3 is fixed
- [ ] Any PR auto-requests `@me-sachin-singh` — confirm in the PR's **Owners** panel, not by reading the file
- [ ] The owner sees "Merge without waiting for requirements" and a colleague does not
- [ ] `git tag -d v3.0.1 && git push --delete origin v3.0.1` is rejected — **needs `v3.0.1` to exist first**
- [ ] A commit containing a fake token is blocked by push protection
- [ ] A Vercel preview URL appears on every PR

---

## 6. Recovery order

1. **Open a PR from `feat/git-version-setup` with a Conventional Commit title.** It carries the fixes for
   all three §3 defects: the `commitlint` and `branch-name` jobs, the `types` newline fix, and the `master`
   push trigger.
2. **Merge it with the admin bypass.** This is unavoidable and correct: `commitlint` and `branch-name`
   cannot report until they exist on `master`, so no ordinary merge is possible. It is the last bypass the
   process should need.
3. **Fix `blob-download.spec.ts` (§4).** Until then `verify` stays red and the bypass remains the only way
   to merge — which is the situation this whole harness exists to end.
4. **Re-run this checklist**, and complete §5 with a colleague for the items that need a non-admin.
5. Only then remove the rollout banner at the top of `git-workflow.md`.

> Steps 2 and 3 are the ones to resist skipping. A harness that everyone routes around via bypass is worse
> than no harness, because it looks like enforcement on the settings page while enforcing nothing.
