# Commerce epic MIL-69: from branches to UAT to production

A step-by-step runbook for the nine stacked PRs (MIL-70 to MIL-78). It follows the team's Flow B ("needs
UAT sign-off", `docs/engineering/git-playbook.md` §5) and the release process in
`docs/engineering/versioning.md`.

Tickets: `prompts/commerce-jira-tickets.md` (includes the 12-step UAT test plan). Plan:
`prompts/commerce-api-rebind.md`.

---

## 0. Understand the moving parts first

**The stack.** Each branch starts from the one before it, so each PR shows only its own commit:

```
master ── MIL-70 ── MIL-71 ── MIL-72 ── MIL-73 ── MIL-74 ── MIL-75 ── MIL-76 ── MIL-77 ── MIL-78
          headers   aliases   cart      plans     cart+     address   checkout  orders    course
                              read                coupons                                 buttons
```

**Rules to know before you start:**

- **MIL-81's head contains all eleven changes** (it sits on MIL-80, which sits on the rest). So one UAT
  deploy, of MIL-81, tests the whole epic.
- **`uat` is a slot, not a branch you merge into.** It is pointed at MIL-78's exact head commit (§4), and
  Vercel's UAT environment builds it. Code never travels `uat → master`; every ticket still reaches
  `master` through its own PR.
- **`master` is protected:**
  - squash merges only, with linear history;
  - the branch must be **up to date** with `master`;
  - 1 code-owner approval;
  - **any push dismisses existing approvals.**
- **Squash creates a new commit**, so after MIL-70 merges, MIL-71's branch still carries the original
  MIL-70 commit, which `master` doesn't have under that id. Before MIL-71 can merge, it is rebased with
  `--onto`, which drops the already-merged commit. The content is identical, so this never conflicts.
- **One rebase moves all eleven branches.** Git ≥ 2.38's `git rebase --update-refs`, run on the top branch,
  rebases the whole stack and moves every branch name with it. You never rebase nine branches one by one.
- **Why no conflicts are expected (checked 2026-10-13):** since the stack was cut from `5ce38e9`, `master`
  gained one commit (#121, favicon), which only changed `public/favicon.ico`. No file in the stack touches
  it. If more lands on `master` before you start, re-check with:

  ```bash
  comm -12 <(git diff --name-only 5ce38e9 origin/master | sort) <(git diff --name-only 5ce38e9 feat/MIL-78-offerings-buy-to-plan | sort)
  ```

  An empty result means a conflict-free rebase.

---

## 1. Backend gate: check before anything goes on UAT

**UAT runs on a Vercel URL for now** (decided 2026-10-13), written `<UAT_URL>` below. It is the `vercel.app`
URL of the UAT environment's `uat` build (§4). Until the backend allows that origin and `x-accept-language`, every browser API call there fails.

> **Why not a milesmasterclass domain (checked 2026-10-13):**
>
> - `uat.milesmasterclass.com` serves an old build (`b6307ecd`, 2026-10-09) from a commit in no branch.
> - `uat.milesmasterclass.us`, which `git-playbook.md` names, 301-redirects to production.
> - There is no `uat` branch.
>
> UAT CORS allows both domains, but not `x-accept-language`.

```bash
curl -s -o /dev/null -D - -X OPTIONS "https://uat-api.milescaira.com/api/v1/commerce/cart/" -H "Origin: https://<UAT_URL>" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: x-accept-language,x-country-code,x-platform,x-app-type" | grep -i "access-control-allow"
```

Pass: `access-control-allow-origin: https://<UAT_URL>`, and all four header names in `access-control-allow-headers`.

| Need from the backend                                                               | Blocks         |
| ----------------------------------------------------------------------------------- | -------------- |
| UAT CORS allows the origin `https://<UAT_URL>`                                      | **Everything** |
| UAT CORS lists `x-accept-language` (it already lists the other three)               | **Everything** |
| Stripe configured on UAT (checkout now answers `gateway_not_configured`)            | Test steps 5–8 |
| CAIRA's Stripe return → `https://<UAT_URL>/checkout/success` and `/checkout/cancel` | Steps 6–7, 12  |
| UAT coupon codes: one percentage code and one 100% code                             | Steps 3 and 8  |

You can do sections 2–3 (rebase, push, open PRs, CI) while waiting. Only section 4 needs the gate.

---

## 2. One-time: tidy, rebase onto today's master, check, push

```bash
git switch feat/MIL-78-offerings-buy-to-plan
```

**2.1 Commit the epic's docs** (tickets, this guide, plan, STATE). They ride in the MIL-78 PR. The working
tree must be clean before a rebase.

```bash
git add prompts/commerce-jira-tickets.md prompts/commerce-release-guide.md prompts/commerce-api-rebind.md docs/refactor/STATE.md
```

```bash
git commit -m "docs(payment): add the commerce Jira tickets and release guide"
```

**2.2 Rebase the whole stack onto the latest master.**

```bash
git fetch origin
```

```bash
git rebase --update-refs origin/master
```

**What happens and what to check:**

- Git replays the 10 commits (9 tickets + docs) onto `origin/master` and moves the eight lower branch
  names (`feat/MIL-70…` to `feat/MIL-77…`) to their new commits.
- Expected: no conflicts (§0).
- `--update-refs` moves **every** local branch that points into the stack, not just the nine. Delete
  strays first (`git branch --contains d0968a8` lists them).
- **If a conflict does happen:**
  1. Fix the file.
  2. `git add <file>`.
  3. `git rebase --continue`.
  4. To back out entirely instead: `git rebase --abort`. The branches return to where they were.

**2.3 Check the result.**

```bash
git log --oneline --decorate origin/master..feat/MIL-78-offerings-buy-to-plan
```

You should see 10 commits, each ticket branch name sitting on its own commit, and `origin/master` directly
below MIL-70.

**2.4 Run the gates on the top of the stack** (it contains everything):

```bash
pnpm install --frozen-lockfile && pnpm lint && pnpm build:prod
```

**2.5 Push the nine branches.** `--force-with-lease` is needed because rebasing rewrote them. It refuses to
overwrite anything on GitHub you haven't fetched.

```bash
git push --force-with-lease -u origin feat/MIL-70-api-request-headers refactor/MIL-71-payment-alias-imports feat/MIL-72-commerce-cart-read feat/MIL-73-commerce-plans feat/MIL-74-commerce-cart-coupons feat/MIL-75-commerce-addresses feat/MIL-76-commerce-checkout feat/MIL-77-commerce-orders feat/MIL-78-offerings-buy-to-plan
```

---

## 3. Open the eleven PRs (drafts, stacked, `needs-uat`)

The PR descriptions (one `MIL-7x.md` each, from `.github/pull_request_template.md`) and `open-prs.sh` were
prepared alongside this guide. The script runs, in order:

```
gh pr create --draft --label needs-uat --base master                                --head feat/MIL-70-api-request-headers       --title "feat(core): send country, platform, app and language headers to the API" --body-file MIL-70.md
gh pr create --draft --label needs-uat --base feat/MIL-70-api-request-headers       --head refactor/MIL-71-payment-alias-imports --title "refactor(payment): use path aliases for every import"                  --body-file MIL-71.md
gh pr create --draft --label needs-uat --base refactor/MIL-71-payment-alias-imports --head feat/MIL-72-commerce-cart-read        --title "feat(payment): read the cart from the commerce API"                    --body-file MIL-72.md
gh pr create --draft --label needs-uat --base feat/MIL-72-commerce-cart-read        --head feat/MIL-73-commerce-plans            --title "feat(payment): bind plans and add-to-cart to the subscriptions API"    --body-file MIL-73.md
gh pr create --draft --label needs-uat --base feat/MIL-73-commerce-plans            --head feat/MIL-74-commerce-cart-coupons     --title "feat(payment): bind the cart and coupons to the commerce API"          --body-file MIL-74.md
gh pr create --draft --label needs-uat --base feat/MIL-74-commerce-cart-coupons     --head feat/MIL-75-commerce-addresses        --title "feat(payment): bind billing addresses to the commerce API"             --body-file MIL-75.md
gh pr create --draft --label needs-uat --base feat/MIL-75-commerce-addresses        --head feat/MIL-76-commerce-checkout         --title "feat(payment): checkout, Stripe return and payment retry"              --body-file MIL-76.md
gh pr create --draft --label needs-uat --base feat/MIL-76-commerce-checkout         --head feat/MIL-77-commerce-orders           --title "feat(payment): bind order history to the commerce API"                 --body-file MIL-77.md
gh pr create --draft --label needs-uat --base feat/MIL-77-commerce-orders           --head feat/MIL-78-offerings-buy-to-plan     --title "feat(offerings): send course buy buttons to the plan page"             --body-file MIL-78.md
```

**Then:**

- **CI:** wait for it to go green on all eleven. CI (`verify`, `pr-title`, `commitlint`, `branch-name`) runs
  on every pull request, whatever its base.
- **Jira:** link each PR in its ticket.
- **Code review** can start now. Don't approve yet: the merge-time rebases dismiss approvals (§7).

---

## 4. Put the epic on UAT (a Vercel URL)

**When:** CI is green on all eleven (green: #123–#131 since 2026-10-13, #133 and #134 since 2026-10-14).

**How UAT is wired** (`github-setup.md` §7):

- Preview deployments are **off** for the project, so PR branches never build.
- A custom Vercel **UAT environment** builds the `uat` branch.
- `vercel.sh` runs `build:dev` against `uat-api` for anything that isn't Production.
- On 2026-10-13 there was **no `uat` branch**, so the UAT environment had nothing to build.

### 4.1 Check the UAT environment (someone with Vercel access, once)

Vercel → Project → Settings → Environments → **UAT**:

- **Branch Tracking** is `uat`.
- **Environment variables** are set for UAT.

If it tracks another branch, set it to `uat`. Don't enable Preview deployments; that would build every PR.

### 4.2 Put MIL-81's head (the top of the stack) on `uat`

`uat` doesn't exist yet, so the first push creates it. No force is needed:

```bash
git fetch origin && git push origin origin/feat/MIL-81-coupon-list:refs/heads/uat
```

**Every later update** (after a fix, §5) needs a force, but only if nobody else moved `uat`:

```bash
git fetch origin && git push --force-with-lease=uat origin origin/feat/MIL-81-coupon-list:refs/heads/uat
```

Vercel builds the UAT environment within a few minutes (Deployments, filtered by UAT).

### 4.3 Get the URL and confirm the build

1. **Take the stable URL** from the UAT deployment in Vercel. That is `<UAT_URL>`.
   - **Use** the `uat` branch alias (`<project>-git-uat-<team>.vercel.app`) or the environment's own
     domain. It survives every redeploy.
   - **Never** the per-deployment URL (`<project>-<hash>-<team>.vercel.app`), which changes on every
     push. The backend configures CORS and the Stripe return against this one address.
2. **Check the version.** `version` must start with MIL-81's head:

   ```bash
   curl -s https://<UAT_URL>/version.json
   ```

   Compare with:

   ```bash
   git rev-parse --short origin/feat/MIL-81-coupon-list
   ```

   **Deployment Protection:** if Vercel Authentication is on, `curl` sees a login page; check in the
   browser instead. Testers without a Vercel seat need a way past it, so decide this before QA. The Stripe
   return lands on the same URL, so test in a browser that already passed the protection.

3. **Send `<UAT_URL>` to the backend** for §1.
4. **Comment "On UAT at `<UAT_URL>`, commit `<sha>`"** on #131 and the epic.

### 4.4 Smoke check before QA starts (2 minutes)

1. Open `https://<UAT_URL>/us/accounting/payment/plan` with DevTools open.
2. **Console:** no CORS errors.
3. **Network:** `subscriptions/plans/` answers 200 and carries `X-Country-Code: US`, `X-Platform`,
   `X-App-Type` and `X-Accept-Language`.

**Any CORS error** means the §1 gate isn't met. Wait for the backend; nothing else is affected.

---

## 5. Test on UAT

Run the 12-step UAT test plan in the epic (`prompts/commerce-jira-tickets.md` → MIL-69). Record results per
ticket.

### When QA finds a bug

The fix belongs in the ticket that owns the code. All work happens on the top branch, and the stack is
rebuilt in one go.

| Area                      | Owning ticket | Branch                              |
| ------------------------- | ------------- | ----------------------------------- |
| Request headers           | MIL-70        | `feat/MIL-70-api-request-headers`   |
| Cart read, badge          | MIL-72        | `feat/MIL-72-commerce-cart-read`    |
| Plans, Subscribe          | MIL-73        | `feat/MIL-73-commerce-plans`        |
| Cart, coupons             | MIL-74        | `feat/MIL-74-commerce-cart-coupons` |
| Addresses                 | MIL-75        | `feat/MIL-75-commerce-addresses`    |
| Checkout, Stripe, invoice | MIL-76        | `feat/MIL-76-commerce-checkout`     |
| Order history             | MIL-77        | `feat/MIL-77-commerce-orders`       |
| Course buttons            | MIL-78        | `feat/MIL-78-offerings-buy-to-plan` |

1. Find the owning ticket's commit:

   ```bash
   git log --oneline origin/master..feat/MIL-78-offerings-buy-to-plan
   ```

2. Fix the code on the top branch, then record the fix **for that commit**:

   ```bash
   git switch feat/MIL-78-offerings-buy-to-plan
   ```

   ```bash
   git add <changed files>
   ```

   ```bash
   git commit --fixup=<owning-commit-sha>
   ```

3. Fold the fix into the owning commit, and move every branch name with it:

   ```bash
   GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash --update-refs origin/master
   ```

4. Run the gates, then push all eleven with the §2.5 command (`--force-with-lease`).
5. Move `uat` to the new MIL-78 head with the §4.2 "every later update" command. UAT doesn't follow
   MIL-78 on its own. Once `version.json` shows the new head (§4.3), re-test.

**What this keeps true:** every ticket stays one commit, and the fix shows in the right PR. Anything pushed
**after** sign-off, other than a pure rebase, needs UAT again (playbook rule).

---

## 6. Sign-off

When the whole plan passes, do the following on **each** of the eleven PRs:

1. Comment **"UAT approved by `<name>` on `<date>`, commit `<sha on UAT>`"**.
2. Remove the `needs-uat` label.
3. Click **Ready for review**.

All three for PRs #123–#131, #133 and #134 in one go. Replace the name, date and sha first:

```bash
for n in 123 124 125 126 127 128 129 130 131 133 134; do gh pr comment $n --body "UAT approved by NAME on DATE, commit \`SHA\`" && gh pr edit $n --remove-label needs-uat && gh pr ready $n; done
```

Reviewers can now finish their review. The **approval** for each PR is given in §7, right before it merges,
because each rebase dismisses earlier approvals.

---

## 7. Merge into master, one PR at a time, bottom-up

Eleven rounds. Keep `master` otherwise quiet during the run if you can, so every round stays a fast
rebase.

**Round 1 (MIL-70):**

1. A code owner approves.
2. **Squash and merge** (the squash title is the PR title).
3. GitHub deletes `feat/MIL-70-…` and **retargets MIL-71's PR to `master` automatically**.

**Rounds 2–9.** For each next ticket, rebase the remaining stack onto the new `master`, dropping the
ticket that just merged. `<merged>` is the branch merged in the previous round:

```bash
git fetch origin
```

```bash
git switch feat/MIL-78-offerings-buy-to-plan
```

```bash
git rebase --update-refs --onto origin/master <merged>
```

Then push the remaining branches (only the ones not merged yet), and wait for CI:

```bash
git push --force-with-lease origin <remaining branches…>
```

Approve that round's PR, then **Squash and merge**.

| Round | Merge PR | Then rebase with `--onto origin/master …` | Push            |
| ----- | -------- | ----------------------------------------- | --------------- |
| 1     | MIL-70   | `feat/MIL-70-api-request-headers`         | MIL-71 … MIL-78 |
| 2     | MIL-71   | `refactor/MIL-71-payment-alias-imports`   | MIL-72 … MIL-78 |
| 3     | MIL-72   | `feat/MIL-72-commerce-cart-read`          | MIL-73 … MIL-78 |
| 4     | MIL-73   | `feat/MIL-73-commerce-plans`              | MIL-74 … MIL-78 |
| 5     | MIL-74   | `feat/MIL-74-commerce-cart-coupons`       | MIL-75 … MIL-78 |
| 6     | MIL-75   | `feat/MIL-75-commerce-addresses`          | MIL-76 … MIL-78 |
| 7     | MIL-76   | `feat/MIL-76-commerce-checkout`           | MIL-77, MIL-78  |
| 8     | MIL-77   | `feat/MIL-77-commerce-orders`             | MIL-78          |
| 9     | MIL-78   | `feat/MIL-78-offerings-buy-to-plan`       | MIL-80          |
| 10    | MIL-80   | `feat/MIL-80-billing-on-review`           | MIL-81          |
| 11    | MIL-81   | (none: last one)                          | (none)          |

**Why `--onto origin/master <merged>`:**

- It takes only the commits **above** the merged branch and replays them on the new `master`.
- The merged ticket's original commit is skipped, because `master` already has it as the squash.
- Your local `<merged>` branch still points at exactly what GitHub squashed, so the cut is precise.
- It can't conflict unless someone else changed the same lines on `master` in between. If they did,
  resolve the conflict as in §2.2.

**When all eleven are in:**

- **Reset UAT to production**, so the next epic starts clean:

  ```bash
  git fetch origin && git push --force-with-lease=uat origin origin/master:refs/heads/uat
  ```

- **Clean up locally:**

  ```bash
  git switch master && git pull --ff-only
  ```

  ```bash
  git branch -D feat/MIL-70-api-request-headers refactor/MIL-71-payment-alias-imports feat/MIL-72-commerce-cart-read feat/MIL-73-commerce-plans feat/MIL-74-commerce-cart-coupons feat/MIL-75-commerce-addresses feat/MIL-76-commerce-checkout feat/MIL-77-commerce-orders feat/MIL-78-offerings-buy-to-plan
  ```

---

## 8. Production

**How production deploys here:**

- **Nothing reaches production on merge.** Each push to `master` lets release-please open or update a
  **Release PR**. The `feat:` commits make it a minor bump: `chore(master): release 3.6.0`.
- **Vercel builds production only when that Release PR merges** (`ignoreCommand` in `vercel.json`).
- **After it goes live,** every open tab reloads once (`UpdateChecker`).

### 8.1 Before merging the Release PR (go/no-go)

- [ ] **Production CORS** allows all four headers. Expect four header names in the output:

  ```bash
  curl -s -o /dev/null -D - -X OPTIONS "https://api.milescaira.com/api/v1/commerce/cart/" -H "Origin: https://www.milesmasterclass.com" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: x-accept-language,x-country-code,x-platform,x-app-type" | grep -i "access-control-allow-headers"
  ```

- [ ] **Production CAIRA** has the commerce, subscriptions and account APIs live, with plans and prices
      configured per market.
- [ ] **Production Stripe** is live, and CAIRA's production return points at
      `https://<production domain>/checkout/success` and `/checkout/cancel`.
- [ ] **Decide `BASE_API_URL`.** `src/environments/environment.ts`, the production build, points at
      **`https://uat-api.milescaira.com/`** today. If production should talk to the production API, flip
      it in its own `fix(core)` PR **before** the Release PR. Otherwise the live site keeps using the UAT
      backend and Stripe test mode.
- [ ] **Support is briefed:** subscribers can't cancel auto-renewal from the app yet (no CAIRA endpoint),
      and Indian (INR) orders can't be paid online yet.

### 8.2 Release

1. Review the Release PR's CHANGELOG. It should list the nine commits.
2. **Squash and merge** the Release PR. Vercel builds and promotes production.
3. **Smoke test production** within minutes:
   - The plan page loads with prices in the right currency.
   - Sign in, Subscribe, and the cart shows the line.
   - Checkout reaches Stripe. Use a 100% coupon if you don't want a real charge, or refund a test charge.
   - The return lands on the invoice, and order history shows the order.
4. **If something is wrong:** Vercel → Deployments → previous production deployment → **Instant
   Rollback**. That's immediate, with no rebuild. Rollback stops auto-promotion, so after the fix ships,
   click **Undo Rollback** to promote the new release.

### 8.3 After the release

- Close MIL-70 to MIL-78 and the epic MIL-69 in Jira.
- Follow up the open backend questions: learner subscription status and management, a coupon list if
  product wants it, and INR payments.

---

## 9. Troubleshooting

| Symptom                                              | Cause and fix                                                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| "This branch is out-of-date with the base branch"    | `master` moved. Run the §7 rebase (or §2.2 before any merge), then push.                                                                   |
| Approval disappeared                                 | A push dismissed it (ruleset). Re-request review.                                                                                          |
| A PR shows commits from the ticket below it          | It was retargeted to `master` but not rebased yet. Run the §7 rebase for that round.                                                       |
| Every API call fails on UAT with a CORS error        | §1 gate not met: the backend hasn't allowed `https://<UAT_URL>` or `x-accept-language` yet.                                                |
| Checkout says "Payments are temporarily unavailable" | Stripe isn't configured on that environment (`gateway_not_configured`).                                                                    |
| `git rebase --update-refs` left a branch behind      | That branch's tip wasn't in the rebased range. Check with `git log --oneline --decorate origin/master..feat/MIL-78-offerings-buy-to-plan`. |
