---
name: release
description: How this app is versioned, released, deployed and rolled back — SemVer from Conventional Commits, release-please, build identity (version.json / APP_BUILD), Vercel deploys and Instant Rollback, cache headers, and version-skew handling for old browser tabs. Use when cutting a release, bumping a version, writing release notes or a changelog, shipping a hotfix, rolling back, debugging "which build is the user on", stale-chunk or 404-after-deploy problems, or wiring the update checker, service worker or cache headers.
---

# Releases & versioning

Authoritative detail lives in `docs/engineering/versioning.md`. Read it before answering anything it covers.

## Four versions, four jobs

App version (SemVer, for humans) · build identity (SHA + built-at, for debugging) · asset hashes (Angular,
for caching) · API contract version (for compatibility). Don't conflate them.

## Cutting a release

The version comes from commit messages: `fix:` → patch, `feat:` → minor, `!`/`BREAKING CHANGE:` → major;
`chore/docs/refactor/test/style` → no bump. release-please keeps an open Release PR; merging it bumps
`package.json`, writes `CHANGELOG.md`, tags `v3.1.0`, and creates the GitHub Release.
Manual fallback: bump `package.json`, commit `chore(release): v3.1.0`, tag, push with `--tags`.

## Build identity

`scripts/generate-version.mjs` (prebuild) writes `public/version.json` with `version`, `sha`, `builtAt`;
the SHA comes from CI (`$GITHUB_SHA` / `$VERCEL_GIT_COMMIT_SHA`). The same values are compiled in via
`ng build --define "APP_BUILD={…}"`. Never `import` `package.json` into app code.
Surface it: `GET /version` in `server.ts` with `no-store` (and in the transfer-cache filter), a
`<meta name="app-version">` tag, the Sentry `release` tag, and an `X-Client-Version` request header.

## Deploy & rollback

One build produces both the SSR server and browser bundles; they ship together, always. Roll back with
Vercel Instant Rollback, not a revert-and-rebuild. Cache headers: hashed assets `immutable` for a year,
HTML `no-cache`, `/version` and `version.json` `no-store`.

## Version skew (old tabs)

An old tab requesting a deleted chunk 404s after a deploy. Two layers:

1. **Platform:** Vercel Skew Protection pins a client to the deployment that served its HTML. Angular isn't
   a zero-config framework there, so send `VERCEL_DEPLOYMENT_ID` (as `dpl` query param, `x-deployment-id`
   header, or `__vdpl` cookie) when `VERCEL_SKEW_PROTECTION_ENABLED === '1'`. Check Vercel's current docs.
2. **App:** the update checker compares its compiled SHA against `/version` on `visibilitychange`, then turns
   the next navigation into a full page load (`location.assign`). Prompt instead of auto-reloading on pages with
   unsaved input (checkout, exams, admin forms). Add `withNavigationErrorHandler` to `provideRouter` as a
   last-resort recovery. Keep the service worker's update prompt and this one unified — never two dialogs.

## Versions vs flags

The version says which code is deployed; flags say which parts are active. Ship dark, flip later.
Frequent boring bumps, exciting flag flips.
