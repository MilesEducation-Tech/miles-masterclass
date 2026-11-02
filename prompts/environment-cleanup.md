# Environment files: keep only what is used, group by feature

Status: **approved and built**, uncommitted. See `docs/refactor/STATE.md` for the gate results.

## Goal

`src/environments/environment{,.development,.local}.ts` hold only **deployment configuration**: values that change
per build, addresses and public keys of external systems, and switches someone flips per deploy. They are grouped by
the feature that reads them. Every key nothing reads is deleted. App constants that happen to live there today move
next to the code that uses them. No behaviour changes: every value that stays keeps its exact value in every build.

## What I read

- The three environment files (546 lines). `angular.json` `fileReplacements`: `development` → `environment.development.ts`
  (UAT and Vercel previews), `local` → `environment.local.ts`.
- Every access path in `src/` (`environment.X` / `environment.X.y`, with `?.` and destructuring), across the 61 files
  that import the environment, plus `src/server.ts`, `src/seo.ts` and `proxy.conf.json`.

## Findings

### Unused: delete (0 readers anywhere in `src/`)

| Key                                                                                                                        | Notes                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `SSO_SUPPORT_API_KEY`                                                                                                      | The hidden QA login route (`DEV_LOGIN_PATH`) it served no longer exists. Empty in all three files.          |
| `WEBINAR.pollsEnabled`                                                                                                     | No poll surface exists.                                                                                     |
| `WP_BLOG.apiBaseUrlBrowser`, `WP_BLOG.apiBaseUrlSsr`                                                                       | There is no blog feature in `src/app` any more. The only mention is a comment in `src/server.ts`.           |
| `AI_LABS.supabaseUrl`, `supabaseAnonKey`, `tenantId`, `clientId`, `domainHint`, `copilotUrl`, `redirectPath`, `storageKey` | The Entra / Supabase sign-in for AI Labs is gone. Only `catalogueCourses` and `assessmentEnabled` are read. |
| `AI_LABS.AI_LABS_CHANNEL`, `AI_LABS.AI_LABS_CALLBACK_DONE`                                                                 | Same reason.                                                                                                |

That's 15 keys, and with them about 120 lines of comments that describe things that no longer exist.

### Used, but app constants rather than deployment config: move to the code that uses them

They have the same value in all three builds, and no deploy would ever change them.

| Key                                                                                       | Readers                                                   | Moves to                                                                              |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `appType`, `platform`                                                                     | `app-interceptor.ts` (`X-App-Type`, `X-Platform` headers) | constants in `app-interceptor.ts`                                                     |
| `AUTH.accessToken`, `refreshToken`, `profileStatus`, `legacyProfileStatus` (cookie names) | `auth-session.ts` only                                    | constants in `auth-session.ts`                                                        |
| `AUTH.browserSessionId` (cookie name)                                                     | `storage.ts` only                                         | constant in `storage.ts`                                                              |
| `WEBINAR.joinWindowMinutes`                                                               | `webinar-status.ts`, `webinar-facade.ts`                  | `webinar/constants/live-session.ts`                                                   |
| `WEBINAR.leaseHeartbeatSeconds`                                                           | `live-session.ts`, `meeting-session.ts`                   | `webinar/constants/live-session.ts` (next to `HEARTBEAT_MIN/MAX_SECONDS`, its bounds) |
| `WEBINAR.registrationPollCapSeconds`                                                      | `webinar-registration.ts` only                            | constant in `webinar-registration.ts`                                                 |

Each constant takes its explanatory comment with it.

### Used and deployment config: stays

| Key                         | Why it stays                                       | Values today                                        |
| --------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| `production`                | differs per build                                  | prod `true`, others `false`                         |
| `SITE_URL`                  | differs per build                                  | `.com` / `uat.` / `localhost:4101`                  |
| `BASE_API_URL`              | external system; prod moves to the live API later  | UAT in all three (the prod `why:` stays)            |
| `S3_BUCKET_URL`, `GCS_URL`  | external CDNs                                      | same in all                                         |
| `LOGGER.LogLevel`           | should differ per build (see Questions)            | `DEBUG` in all, **production included**             |
| `AUTH.otpLength`            | a property of the SSO deployment, read in 4 places | 6                                                   |
| `SUPABASE.url`, `anonKey`   | external system (public, RLS-scoped key)           | same in all                                         |
| `SALESFORCE_LEAD`           | external system; an empty `url` disables it        | same in all                                         |
| `WEBINAR.liveEnabled`       | kill switch                                        | `true` in all                                       |
| `AI_LABS.catalogueCourses`  | course ids differ between UAT and prod             | prod ids in all (UAT has none yet)                  |
| `AI_LABS.assessmentEnabled` | feature switch                                     | `false` in all                                      |
| `I18N.enabled`, `languages` | differ per build                                   | prod off / `['en']`; UAT and local on / 5 languages |

## Locked decisions (proposed)

1. **One `Environment` type, documented once.**
   - New `src/environments/environment.model.ts` holds an `Environment` interface. Each key's explanation lives on the
     interface, once.
   - Each file ends `} satisfies Environment;`, so a key missing from, misspelt in, or extra in any build fails
     type-checking in **every** build. Today a key that only `environment.ts` has compiles fine in `build:prod` and
     breaks only `build:dev`.
   - The three value files then keep only short `why:` comments for values that differ, such as prod's UAT
     `BASE_API_URL`.
2. **Feature groups, in this order:**
   1. top-level deployment identity: `production`, `SITE_URL`
   2. core: `BASE_API_URL`, `S3_BUCKET_URL`, `GCS_URL`, `LOGGER`
   3. features: `AUTH`, `SUPABASE`, `SALESFORCE_LEAD`, `WEBINAR`, `AI_LABS`, `I18N`

   The cross-cutting top-level names (`BASE_API_URL`, `S3_BUCKET_URL`, `GCS_URL`, `SITE_URL`) **keep their names**.
   Renaming them into `API`/`ASSETS` groups would touch ~115 call sites in ~60 files for no functional gain. If you
   want it, it's a separate mechanical PR.

3. **Values don't change.** Same `LogLevel.DEBUG` in prod, same UAT API in prod, same flags. This is a refactor.
   Anything that should change is a question below, not a silent edit.
4. **`src/server.ts`:** its comment that points at `environment.WP_BLOG.apiBaseUrlBrowser` is reworded to point at
   `proxy.conf.json`. The `/blog-api` proxy itself is left alone. With no blog feature it looks orphaned, but removing
   server routes is its own change.

## Files touched

- **Environments:**
  - `src/environments/environment.ts`, `environment.development.ts`, `environment.local.ts`: about 546 → 150 lines
  - `src/environments/environment.model.ts`: new, ~90 lines with the docs
- **Constants moving in:** `core/interceptors/app/app-interceptor.ts`, `core/services/auth-session/auth-session.ts`,
  `core/services/storage/storage.ts`
- **Webinar:** `features/offerings/webinar/constants/live-session.ts`, `utils/webinar-status.ts`,
  `services/webinar-facade.ts`, `services/meeting-session.ts`, `services/webinar-registration.ts`
- **Server:** `src/server.ts` (comment only)

Estimate: about 650 changed lines, roughly 450 of them deletions. Additions and edits are about 200, so it's an M by
substance despite the raw count. One PR, because the type and the deletions must land together, or the
`satisfies` check fails.

**Branch:** `refactor/MIL-<n>-environment-cleanup`, off `master`.

**Before starting:** the comment-only `liveEnabled` edits are still uncommitted on `fix/MIL-140-live-room-isolation`.
Commit them first, since this work rewrites the same lines.

## Security

- **Smaller public bundle:** removing the AI Labs block removes a second Supabase project's URL and anon key, plus the
  Entra tenant and client ids, from the public bundle. They were public by design, but nothing used them.
- **No real secret left in the bundle:** the `SSO_SUPPORT_API_KEY` slot was empty everywhere, and deleting it removes
  the temptation to fill it.
- **No secrets added.** `environment.model.ts` has types only.

## Acceptance criteria

- No key in any environment file has zero readers. A grep over `src/` for each leaf proves it, with the list in the
  report.
- Every build type-checks against `Environment`. Deleting any key from one file breaks `tsc`.
- Every moved constant has the same value as before. `dist/` still contains `X-App-Type`/`WA` and the same cookie names.
- `pnpm lint` 0 errors, `pnpm build:prod` green with the initial bundle the same or smaller, and the `development`
  configuration builds.
- The running app (`pnpm start`, port 4101) shows no visible change:
  - home renders its S3/GCS images
  - sign-in still shows 6 OTP boxes
  - the webinar list shows Join at the same time
  - AI Labs shows the same two catalogue sections

## Checks

```bash
pnpm lint
pnpm format:fix
pnpm build:prod
pnpm exec ng build --configuration development
```

## Risks

- **Skills and docs:** a `.claude/` skill or a doc may mention a removed key. I can't edit `.claude/`, so I'll list any
  hits for you to fix.
- **Unknown consumers:** a consumer outside `src/` that I haven't seen (a Vercel env script, say) would break. I found
  none: `scripts/` and the configs don't import the environment.

## Questions (each defaults to "no change" if you don't answer)

1. **`LOGGER.LogLevel` is `DEBUG` in production**, so every `logger.debug`/`info` prints in learners' consoles. Should
   production be `WARN` once you soft-launch? This refactor won't change it.
2. Do you want the optional follow-up PR that groups `BASE_API_URL` / `S3_BUCKET_URL` / `GCS_URL` under `API` /
   `ASSETS`?
3. Remove the orphaned `/blog-api` proxy (`src/server.ts`, `proxy.conf.json`) in its own PR?

## Jira ticket draft

**Summary:** `refactor(core): keep only used environment config, grouped by feature`

**Issue type:** Tech debt · **Component:** core · **Branch:** `refactor/MIL-<n>-environment-cleanup` ·
**Links:** `prompts/environment-cleanup.md`

- **Context:** the three environment files have grown to 546 lines. 15 keys have no reader, and app constants sit
  next to deployment config. The files aren't type-linked, so they can drift apart.
- **Current behaviour:** dead config for the removed blog and AI Labs sign-in still ships in the bundle. The cookie
  names and webinar tuning live in the environment, though they never vary.
- **Expected behaviour:** the environment holds only used deployment config, grouped by feature, checked by one
  `Environment` type.
- **Scope:**
  - In: the three files, the new type, and moving 9 constants to their readers.
  - Out: renaming the top-level URL keys, the logger level, and the `/blog-api` proxy.
- **Acceptance criteria:** as above.
- **Estimate:** M.
