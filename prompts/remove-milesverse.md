# Remove the MilesVerse simulation feature

## Goal

Delete MilesVerse (the logged-in "Simulation — AI Role-play" area) completely:

- the `features/milesverse/` folder and its four routes
- the header nav entry
- its env config
- the `@milesverse/sdk` dependency
- every live reference to it

No replacement and no redirect.

## What I read

- An import audit of the whole repo for `milesverse` / `miles-verse` / `MILESVERSE`, plus every symbol, selector,
  CSS prefix, localStorage key and route path the feature defines. I spot-checked the load-bearing hits by hand:
  - `features.routes.ts`
  - `nav.config.ts`
  - `engagement-dialog.ts`
  - `pnpm-workspace.yaml`
  - the i18n files
  - the env blocks
- `docs/engineering/versioning.md` (when to cut a major), `git-workflow.md` (scope list, `pnpm remove`), and
  `prompts/remove-unit-tests.md` for shape.

**Audit result:** nothing outside the folder imports anything inside it. The only inbound links are the four lazy
`loadComponent` routes. The feature imports only generic code: `@shared/ui/button`, `localePath`, `@env`,
`@ng-icons`. So nothing has to move out before the folder goes.

## Locked decisions

- **Remove the whole feature** (you chose this over only dropping my STATE note).

## Assumptions (review these first)

- **No redirect.** `/:country/:profession/simulation*` falls through to the existing `**` wildcard and shows the 404
  page. `legacy-redirects.ts` gets no entry; there was never a public, indexed MilesVerse URL to preserve.
- **Commit type `chore`, no major bump.** `versioning.md` reserves a major for changed URLs, but the production
  site isn't on its live API yet, so nobody has these URLs bookmarked. If this ships after launch, use
  `feat(milesverse)!:` instead.
- **One PR.** It's about 6.5k deleted lines, far over the ~400 guide, but it's a single atomic deletion. The routes,
  folder, dependency and nav entry have to go together, or the build breaks. The hand-edited diff is about 60 lines.
- **History stays as written.** STATE.md log and tracker entries, `docs/refactor/PLAN.md`, `docs/refactor/reports/*`
  and older `prompts/*.md` record what was true then. Only live rules and live code change.
- **Orphan localStorage keys stay.** Returning users keep `mv_sessions` / `mv_pending`. They're harmless, so I'm
  adding no cleanup code.
- **Branch order.** The uncommitted "production → UAT API" change also touches `environment.ts` and STATE.md.
  Commit it on its own branch first; this branch then starts from `master`. The hunks don't overlap.

## Jira ticket

- **Summary:** `chore(milesverse): remove the MilesVerse simulation feature`
- **Issue type:** Task · **Component:** milesverse · **Estimate:** S (hand-edited diff), pure deletion otherwise
- **Branch:** `chore/MIL-XXX-remove-milesverse`. Create it from `master`, then `git branch -m` once the ticket exists.
- **Links:** `prompts/remove-milesverse.md`
- **Context:** MilesVerse is being dropped from the product. Its pages, SDK and config only add bundle weight and
  upkeep.
- **Current behaviour:** signed-in users see "Simulation (AI Role-play)" in the header. It links to
  `/:country/:profession/simulation`, plus subject, briefing and report pages backed by `@milesverse/sdk` and
  `*.milesverse.ai`.
- **Expected behaviour:** there's no Simulation nav entry, `/…/simulation*` shows the 404 page, and no MilesVerse
  code, config or dependency ships.
- **Acceptance criteria:**
  - `src/app/features/milesverse/` no longer exists.
  - `@milesverse/sdk` is gone from `package.json`, `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
  - No `MILESVERSE_*` key is left in `src/environments/`.
  - `git grep -i milesverse -- src package.json pnpm-workspace.yaml` returns nothing.
  - The header has no Simulation entry, and `/us/cpa/simulation` renders the 404 page.
  - `pnpm lint`, `pnpm format`, `pnpm build:prod` and `pnpm check:structure` are green (state the environment).
    `build:prod` should show one known CSS budget warning, not two, because `briefing-session.css` goes.
- **Risks / open questions:**
  - Does Supabase `seo_pages` hold a `simulation` row? If it does, delete it from the admin SEO console so the
    sitemap doesn't list a 404.
  - Does the MilesVerse backend need telling?

## Endpoint map

No Django or Supabase contract changes. What stops being called:

- the MilesVerse API (`api.milesverse.ai` / `uat.milesverse.ai`) via `@milesverse/sdk`
- the Anam JS SDK from `esm.sh`, which was imported through `new Function`
- `i.pravatar.cc` avatars

## Steps

### 1. Delete the feature

- `rm -r src/app/features/milesverse/` (17 files, 6,517 lines).
- `src/app/features/features.routes.ts`: delete the four `simulation*` route blocks and the two-line
  "Simulations require a logged-in user" comment above them.

### 2. Nav and i18n

- `src/app/layout/header/nav.config.ts`: delete the `nav.simulation` entry.
- `src/i18n/{en,ar,fr,de,es}.json`: delete `nav.simulation` and `nav.simulationSub`. They're used only by that
  entry.

### 3. Engagement dialog (stale, not breaking)

- `src/app/shared/services/engagement-dialog.ts`:
  - change `IMMERSIVE_ROUTE` to `/\/ai-labs(\/|\?|$)/`
  - reword the doc comment above it to cover AI Labs only
  - drop "/ simulation" from the comment near line 168

### 4. Environment

- Delete the `MILESVERSE_API_URL` + `MILESVERSE_SSO` block, with its comments, from `environment.ts`,
  `environment.development.ts` and `environment.local.ts`. The SSO tokens are all empty, so no secret leaves
  history.
- `SSO_SUPPORT_API_KEY` and `AUTH.*` stay; they belong to Miles Accounts.

### 5. Dependency

- `pnpm remove @milesverse/sdk`. This updates `package.json` and the lockfile. The SDK has no transitive deps.
- `pnpm-workspace.yaml`: delete `minimumReleaseAgeExclude:` and its only entry.

### 6. Structure baseline

- Run `node scripts/check-structure.mjs --prune`. It drops the five milesverse `componentStylesheets` entries and
  the two `inlineStyles` entries; only removals.

### 7. Live docs

- `AGENTS.md`:
  - §4.5: drop `@milesverse/sdk` from the heavy-library list.
  - §9 baseline: "two known component-CSS budget warnings" becomes one (`ai-labs.css`), re-measured.
- `docs/engineering/git-workflow.md:102` and `docs/engineering/git-playbook.md:117`: drop `milesverse` from the
  scope list.
- `docs/refactor/STATE.md`: add a "Now" entry and a step-log line, and drop the MilesVerse item from the
  UAT-API entry's open list.

### Not touched (yours or CI)

- `docs/refactor/PROMPT.md:34, 216` and the root `PROMPT.md` copy mention `@milesverse/sdk` and "the `milesverse`
  service". These are owner-only, so edit them if you want them current.
- `.github/workflows/pr-title.yml:73` holds `#   milesverse` inside a commented-out scope list. It's a CI gate file,
  so I leave it.

## Files touched

- **Deleted:** `src/app/features/milesverse/**` (17 files)
- **Edited:**
  - `src/app/features/features.routes.ts`
  - `src/app/layout/header/nav.config.ts`
  - `src/app/shared/services/engagement-dialog.ts`
  - `src/i18n/{en,ar,fr,de,es}.json`
  - `src/environments/{environment,environment.development,environment.local}.ts`
  - `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
  - `structure-baseline.json`
  - `AGENTS.md`
  - `docs/engineering/git-workflow.md`, `docs/engineering/git-playbook.md`
  - `docs/refactor/STATE.md`

## Security

The change removes code; it adds none.

- It drops a runtime `new Function('return import("https://esm.sh/…")')` third-party import.
- It drops a third-party avatar host.
- It drops a dormant SSO token slot.

There are no new endpoints, secrets or guards.

## Checks

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm format:fix
pnpm check:structure
pnpm build:prod
```

After the build, `grep -rl -i "milesverse\|esm.sh/@anam" dist/miles-masterclass-v3` must return nothing.

## How to verify

1. Run `pnpm start` (4101).
2. Open `http://localhost:4101/us/cpa/simulation` and `…/simulation/report`. Both render the 404 page, with no
   console errors.
3. `IMMERSIVE_ROUTE` can't be seen in the browser today, because `EngagementDialog.start()` has no polling loop and
   opens nothing. The regex change is checked by reading it.
4. Check the header. The signed-out nav is unchanged. The Simulation entry lived only in `LOGGED_IN_NAV`, so its
   removal shows in `nav.config.ts`; a signed-in check is optional.

## Risks

- **`seo_pages` and the sitemap:** if a `simulation` row exists, the sitemap lists a 404 until you delete the row.
- **Bundle numbers move down.** Lazy chunks disappear and the initial bundle is unaffected (the routes were lazy).
  If anything compares against `docs/refactor/baseline/`, its bundle snapshot will differ. That's expected, and it's
  yours to re-record.
