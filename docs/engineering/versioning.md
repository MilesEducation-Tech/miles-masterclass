# Versioning & releases — miles-masterclass

How a commit becomes a version, a build, a deploy, and a running app — and how we keep old browser tabs
from breaking when we ship.

Companion to `docs/engineering/git-workflow.md`, which covers branching and PRs.

> **Shipped vs planned.** This document describes the target state. Where something is not wired up yet
> it is marked **`TODO`**, so you can tell the machinery that exists from the machinery we intend. Don't
> assume an unmarked paragraph is aspirational — the update checker in §5 is real and running today.

---

## 0. Four different "versions"

Versioning covers four separate things, and each answers a different question.

| Thing                    | Example              | Answers                                | Where it lives here                       |
| ------------------------ | -------------------- | -------------------------------------- | ----------------------------------------- |
| **App version (SemVer)** | `3.1.0`              | What changed, for humans               | `package.json`, git tag, `CHANGELOG.md`   |
| **Build identity**       | git SHA + build time | Exactly which code is running          | `version.json`, `APP_VERSION`             |
| **Asset hashes**         | `main-A7F3K2.js`     | Which file to cache                    | Angular does this automatically           |
| **API contract version** | `/v2`, headers       | Can this frontend talk to that backend | Backend routes, `X-Client-Version` header |

They are independent. A refactor can change every asset hash without changing the app version. A backend
can move to `/v2` without us cutting a major.

---

## 1. The commit message decides the version

Nobody picks version numbers by hand. We already write Conventional Commits (see the git workflow doc),
and the release tool derives the version from them:

| Commit message                                                  | Bump  | Example       |
| --------------------------------------------------------------- | ----- | ------------- |
| `fix(payment): correct tax rounding`                            | patch | 3.0.1 → 3.0.2 |
| `feat(cpe-tracker): add badge filters`                          | minor | 3.0.1 → 3.1.0 |
| `feat(api)!: drop v1 endpoints`, or a `BREAKING CHANGE:` footer | major | 3.0.1 → 4.0.0 |
| `chore:`, `docs:`, `refactor:`, `test:`, `style:`               | none  | —             |

Enforce the format with **commitlint**, in the existing husky hook and in CI, so a bad message can't reach
`master`:

```bash
pnpm add -D @commitlint/cli @commitlint/config-conventional
echo "export default { extends: ['@commitlint/config-conventional'] };" > commitlint.config.mjs
echo 'pnpm exec commitlint --edit $1' > .husky/commit-msg
```

> ⚠️ **Do not run `pnpm exec husky init` here.** husky is already installed and `"prepare": "husky"` is
> already in `package.json`. `husky init` **overwrites `.husky/pre-commit`**, which would destroy the
> existing lint-staged hook. Writing the one `commit-msg` file is the whole change. If you do run it by
> accident, restore the hook: `echo 'pnpm exec lint-staged' > .husky/pre-commit`.

For a web app users never install, SemVer is mostly for communication: stakeholders, support tickets,
and rollback conversations. Reserve major bumps for real contract breaks, such as removed API versions,
changed URLs, or a forced re-login.

## 2. The release tool cuts the version

**`TODO` — not wired up yet.** `package.json` currently sits at `3.0.1`, with no `CHANGELOG.md` and no tags.

**release-please** is the simplest option for an app. It watches `master` and keeps an open "Release PR" that
accumulates the next version number and the changelog. Merging that PR bumps `package.json`, writes
`CHANGELOG.md`, creates the tag `v3.1.0`, and creates a GitHub Release.

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [master]
permissions:
  contents: write
  pull-requests: write
jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          release-type: node
```

semantic-release does the same job with no PR step, which suits teams that release on every merge.
We prefer the PR step: it gives one place to review the changelog before it becomes public.

Until this is set up, bump `package.json` manually in a `chore(release): v3.1.0` commit and tag it.
The rest of this document works either way.

## 3. The build stamps identity into the bundle

**Shipped.** `scripts/generate-version.mjs` runs in the `prebuild`, `prestart`, `pretest` and `prelint`
hooks — and once after install via `prepare` — and writes two files that must agree per deploy. Both are
**gitignored**, precisely because every one of those paths regenerates them:

1. **`src/app/core/version/app-version.ts`** — exports `APP_VERSION` (the build id), plus `APP_SEMVER`,
   `APP_SHA` and `APP_BUILT_AT`. Imported by both the browser and server bundles. This is the _running_
   build.
2. **`public/version.json`** — copied to the build output and served at `/version.json`. This is the
   _deployed_ version a client polls.

```jsonc
// public/version.json — written at build time, never edited by hand
{
  "version": "3.1.0",
  "sha": "9f2c41a",
  "builtAt": "2026-09-23T06:12:44Z",
  "buildId": "9f2c41a.1758607964",
}
```

> **Why a generated `.ts` file and not Angular's `--define`.**
> A `--define "APP_BUILD={…}"` flag would work, but it has to be threaded through every build
> configuration and every CI invocation, and it silently produces `undefined` if one of them is missed.
> A generated module is type-checked, is impossible to forget (the `pre*` hooks own it), and fails loudly
> at compile time if it's absent. **There is no `APP_BUILD` symbol in this repo — use `APP_VERSION`.**

> **Why `buildId` is `sha.timestamp` and not the bare SHA.**
> A redeploy of the _same commit_ — a rollback, a env-var change, a retried build — must still trip the
> update prompt, because the running bundle may differ from what's now served. A bare SHA compares equal
> across those and the prompt never fires. `APP_VERSION` carries the `sha.timestamp` form for exactly this
> reason; `sha` and `version` are separate fields for humans. **Don't "simplify" `APP_VERSION` to a SHA.**

CI supplies the SHA; the script reads `VERCEL_GIT_COMMIT_SHA`, `GIT_COMMIT_SHA` or `COMMIT_REF` from the
environment and falls back to `git rev-parse --short HEAD`, then `local`. The semver comes from `package.json`.

Then surface the identity everywhere it earns its keep:

- **`GET /version.json` in `src/server.ts`** with `Cache-Control: no-store` — **shipped**, registered
  before the static and Angular handlers so it always wins. This is what a live tab compares itself
  against. Serving it from the SSR server (rather than only as a static file) means it always reflects the
  code actually answering requests.
- **`TODO` A `<meta name="app-version">` tag** in `index.html`, so support can ask a user to check it.
- **`TODO` An `X-Client-Version` header** on API calls, added in the existing app interceptor, so the
  backend can see which clients are still out there.
- **`TODO` A Sentry/OpenTelemetry `release` tag**, so every error maps to an exact commit and its source
  maps. No error reporter is installed today — this is "adopt Sentry", a separate ticket.

## 4. The deploy is atomic, and old assets stay reachable

The SSR server bundle and the browser bundle come from the same `ng build`. They ship together, always.
**Never deploy or version them separately.** Build once per commit, and configure per environment at runtime.

On Vercel that means:

- **Rollback = Instant Rollback** to the previous deployment in the dashboard. No rebuild, no re-tag.
  (In a container setup the equivalent is pointing back at `app:3.0.2`.)
- **Each deployment is immutable**, but the production domain always routes to the newest one. That's the
  part that bites: an old tab asking for an old chunk hits the new deployment, where that filename no longer exists.
- **`TODO` Enable Skew Protection** (Vercel Pro/Enterprise) in Settings → Advanced. It pins a client's
  requests to the deployment that served its HTML, so old tabs keep getting old chunks. Zero-config support
  only covers certain frameworks, so for Angular wire it up manually: when
  `VERCEL_SKEW_PROTECTION_ENABLED === '1'`, send `VERCEL_DEPLOYMENT_ID` as the `dpl` query parameter, the
  `x-deployment-id` header, or the `__vdpl` cookie on requests for assets and APIs. Check the current
  Vercel docs before implementing; the details change.
- Skew Protection is a safety net, not a substitute for section 5. Both layers together is the goal.

Caching rules that make all this safe (`vercel.json` headers):

| Path                    | `Cache-Control`                       | Why                                        | Status                                                          |
| ----------------------- | ------------------------------------- | ------------------------------------------ | --------------------------------------------------------------- |
| Hashed `*.js`, `*.css`  | `public, max-age=31536000, immutable` | New content always gets a new filename     | shipped                                                         |
| `index.html` / SSR HTML | `no-cache`                            | The entry point must always be current     | `TODO`                                                          |
| `/version.json`         | `no-store`                            | Skew detection is worthless if it's cached | shipped on the SSR route; `TODO` for the CDN-served static copy |
| `/assets/*` (unhashed)  | `public, max-age=3600`                | Compromise for images and fonts            | `TODO`                                                          |

> **Why the HTML header lives in `src/server.ts` and not `vercel.json`.** Routes here are extensionless, so
> a `vercel.json` rule broad enough to catch them (`/(.*)`) would also match hashed assets, and would then
> have to be ordered against the `immutable` rule to avoid un-caching every bundle. Setting it on the
> Angular handler is unambiguous: `express.static` is registered before it, so only rendered HTML is
> touched. `/assets/*` is still uncovered — a separate, low-risk `vercel.json` addition.

## 5. Runtime handles version skew

This is the part most teams miss. The sequence that breaks:

1. A user opens the app at 10:00 and loads v3.0.2's JavaScript.
2. We deploy v3.1.0 at 10:30.
3. At 11:00 the user clicks a link to a lazy route. Their old router asks for `checkout-B81QZ.js`, a v3.0.2 chunk.

If that file is gone, the navigation fails. Section 4 keeps the file reachable. The tab is still running old code
against a newer server, though, so it should upgrade itself.

**Shipped:** `src/app/shared/services/update-checker.ts`. It compares the baked-in `APP_VERSION` against
`/version.json` and, on a mismatch, opens the non-closeable `VersionUpdateDialog` whose only action clears
caches and reloads. The shape:

```ts
@Service()
export class UpdateChecker {
  private readonly runningVersion = APP_VERSION;
  /** Minimum gap between checks so navigation bursts don't spam the network. */
  private readonly throttleMs = 30_000;
  /** Safety poll for tabs left open a long time. */
  private readonly pollMs = 10 * 60_000;

  init(): void {
    if (!isPlatformBrowser(this.platformId) || this.started) return;
    this.started = true;

    setTimeout(() => this.check(), 4000); // after hydration, not during it
    this.router.events.subscribe((e) => e instanceof NavigationEnd && this.check());
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible') this.check();
    });
    setInterval(() => this.check(), this.pollMs);
  }
}
```

Note `@Service()`, not `@Injectable` — see `AGENTS.md` §6. The dialog is `import()`ed lazily so it stays
out of the initial bundle, and a failed fetch is swallowed on purpose (offline, or local dev where
`/version.json` isn't served).

Three layers, in order of preference:

- **Detection** — **shipped.** On boot, on every navigation, on tab refocus, and on a 10-minute poll,
  all throttled to one check per 30s and prompting at most once.
- **Prompt, then reload** — **shipped.** A non-closeable dialog. The doc's original suggestion was a
  _silent_ upgrade (turn the next navigation into a full page load). We prompt instead, deliberately: this
  app has exams, checkout and admin forms with unsaved input, and a silent `location.assign` mid-exam loses
  a candidate's answers. Asking is the right default here.
- **`TODO` Last-resort recovery.** Add `withNavigationErrorHandler` to `provideRouter` in
  `src/app/app.config.ts`: if a chunk fails to load anyway, catch it and `location.assign(url)`.

> **The service worker is not part of this.** `src/service-worker.ts` is ~40 lines of Netcore/FCM **push
> notification** config, served dynamically at `/sw.js`. It has no cache, no `skipWaiting` and no update
> flow, so there is no competing "new version available" prompt to reconcile. If a caching service worker
> is ever introduced, that reconciliation becomes real work — until then, there is nothing to do.

## 6. How this relates to feature flags

Versioning and flags complement each other. **The version tells you which code is deployed. Flags decide which
parts of it are active.** So v3.1.0 can ship the new checkout switched off, and the release to users happens later
through the flag, with no new version.

A healthy setup therefore has frequent, boring version bumps and exciting flag flips. If your releases are
scary, you're using versions to do a flag's job.

---

## Checklist for adopting this

- [x] commitlint wired into husky (`.husky/commit-msg`) and CI (the `commitlint` required check)
- [ ] release-please workflow added; first Release PR merged
- [x] `generate-version.mjs` emits `version`, `sha`, `builtAt` and `buildId`, with the SHA coming from CI
- [x] Build identity compiled into both bundles via the generated `app-version.ts` (`APP_VERSION`)
- [x] `GET /version.json` route in `server.ts` with `no-store`
- [x] Entry-point HTML is `no-cache` and `/version.json` is `no-store` — both set in `src/server.ts`
      rather than `vercel.json`, to avoid ordering a broad `Cache-Control` rule against the hashed-asset
      `immutable` rule. `/assets/*` is still uncovered
- [ ] Vercel Skew Protection enabled, and the deployment ID wired into requests
- [x] Update checker compares versions and prompts on mismatch
- [x] `withNavigationErrorHandler` added to `provideRouter`, scoped to chunk-load failures and guarded
      against reload loops
- [ ] Sentry release tag and source maps uploaded per deploy
- [x] ~~Service worker update flow and the update dialog reconciled into one prompt~~ — N/A, the SW is
      push-only and has no update flow
