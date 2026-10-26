# Tickets: admin removal, review fixes, facade scoping, SEO (2026-10-23)

Seven tickets, each written to `docs/engineering/jira-ticket-template.md`, ready to paste into Jira.
After you create them, send me the `MIL-<n>` numbers and I'll implement one ticket per branch/PR, in order.

**Order:** T1 and T2 together (T2 must merge with or before T1). T3–T7 are independent.

## What the strict SEO check found

1. **`seo_pages` RLS lives only in an admin migration.**
   - `supabase/migrations/20260428000000_admin_rbac.sql:215-233` is the only file that enables RLS on
     `seo_pages`. If it's deleted, a database rebuilt from the repo leaves `seo_pages` writable with the
     public anon key, so anyone could deface SEO.
   - The live DB also has an admin audit trigger on `seo_pages` (`20260918000000_admin_audit_log.sql:294`),
     and its write policies call `has_admin_permission()`. Both break if the admin schema is dropped.
   - → T2.
2. **Old `/admin/*` URLs would redirect to home, not 404.**
   - Once the `admin` route is gone, `/admin/users` matches `:country/:profession_type`.
     `validateProfessionCountryGuard` sees an unknown profession and sends it to `/<cc>/accounting`,
     which is a soft-404.
   - → T1 keeps a short `admin/**` → 404 route (`data.notFound`), and drops `Disallow: /admin`.
3. **Course canonicals come from the request URL** (`shared/utils/seo/course-seo-setup.ts:89`).
   - `/us/accounting/masterclass/<id>/<any-text>` is a self-canonical, indexable duplicate.
   - Its early-paint title is read from `<any-text>`.
   - → T7.
4. **`getBySlug` puts the URL slug into a PostgREST `.or()`** (`core/services/seo/supabase-seo.ts:89`) without
   validating it. → T7.
5. **Correct today:**
   - `App` handles `data.notFound` before any slug lookup (`app.ts:97`).
   - Learners already read `seo_pages` anonymously.
   - The JSON-LD `<` escaping is in place.
   - Meta tags are cleaned up between routes.
   - The TransferState handoff and the SSR timeouts work.

---

## T1 — Remove the admin panel and everything only it used

**Summary:** `chore(admin): remove the admin panel and its dependencies`
**Issue type:** Task · **Component / scope:** admin · **Branch:** `chore/MIL-<n>-remove-admin`
**Links:** merges with T2

### Context

The admin panel is being taken out of the app for now: the SEO console, leads, RBAC, user reports, user
onboarding, Partner Platform v1/v2, the seat tracker and the audit log. Git history keeps it, so restoring
it means reverting this PR.

### Current behaviour

- `src/app/admin/` (144 files) is lazy-loaded at `/admin` (`app.routes.ts:19`).
- `adminTokenInterceptor` runs on every request (`app.config.ts:31,95`).
- The Supabase client persists an admin session (`core/services/supabase/supabase.ts:47-55`).
- Several shared and core pieces exist only for admin.

### Expected behaviour

- No admin code ships or is imported.
- Any `/admin` or `/admin/...` URL answers **404 with `noindex`**, on the server and in the browser.
- Learner pages and SEO reads behave as before.

### Scope

- **In — delete:**
  - `src/app/admin/`
  - `src/app/testing/partner-mock/`
  - `src/app/core/interceptors/dev/`
  - `shared/components/deprecation-banner/`, `shared/dialogs/block-status-dialog/` and
    `shared/dialogs/apply-partner-code-dialog/`. All three have zero non-admin importers.
  - The SEO-console writes in `supabase-seo.ts`: `getAll`, `upsert`, `bulkUpsert`, `deleteById`,
    `seedDefaults` and `uploadImage`. `getBySlug` stays.
  - `DEFAULT_SEO_PAGES`, `SeoDefaultPageDef` and `createDefaultSeoPage`.
  - `IS_ADMIN_REQUEST` and `SKIP_AUDIT_LOG` in `http.model.ts`, and their check in
    `app-interceptor.ts:54-58`.
  - `.admin-theme`, the admin palette, and any token that has no other user, in `src/styles/styles.css`.
  - `SUPABASE.SupabaseUser` in the 3 environment files.
- **In — edit:**
  - **Routes and config:**
    - `app.routes.ts`: an `admin` → `**` 404 route with `data: { notFound: true }`.
    - `app.config.ts`: drop both interceptors.
    - `angular.json`: drop the 2 `dev-interceptors` replacements.
    - `app.routes.server.ts`: drop `admin/**`.
  - **Redirects and robots:**
    - `src/legacy-redirects.ts:196-214`: drop the admin renames.
    - `src/seo.ts:65,294`: drop `Disallow: /admin`.
  - **Code that special-cases admin:**
    - `engagement-dialog.ts`: drop `ADMIN_ROUTE`.
    - `language-context.ts`: drop the `/admin` → `en` rule.
    - `seo-route-slug.ts` and `seo.constants.ts:89`: drop `'admin'`.
    - `supabase.ts`: a stateless client (no persisted session and no `storageKey`).
  - **Tooling:**
    - The `@admin/*` alias in `tsconfig.json` and `.storybook/tsconfig.json`.
    - `eslint.config.mjs`: drop the `admin` element and its rules. ⚠️ This is a lint-config edit; it only
      removes rules for the deleted folder.
  - **Docs and comments:**
    - Stale admin mentions in comments.
    - `AGENTS.md` §2, §3, §5, §6 (adding "`seo_pages` is edited in the Supabase dashboard"), §7 and §10.
    - `README.md:71`.
  - **Baseline:** `node scripts/check-structure.mjs --prune`.
- **Out:**
  - **Migrations:** → T2.
  - **Gates:** the `admin` commit scope in commitlint and `pr-title.yml`, and `scripts/check-structure.mjs`.
  - **Docs where "admin" means something else:** `docs/engineering/*`, which uses it for the GitHub admin
    role and in example commits.
  - **Marketing copy:** the "For Admins" cards on the partners pages.
  - **Yours to delete:** the `admin-panel` and `partner-platform` skills in `.claude/`.

### Acceptance criteria

- [ ] `grep -rn "@admin/\|IS_ADMIN_REQUEST\|admin-theme\|SupabaseUser\|adminToken" src` finds nothing.
- [ ] `curl -sI localhost:4000/admin` and `/admin/seo` return `404`, and the HTML carries `noindex`.
- [ ] `/robots.txt` has no `/admin` line, and `/sitemap.xml` is unchanged.
- [ ] `/us/accounting/masterclass` and a course page render their Supabase-row `<title>`, `og:*` and
      canonical in the SSR HTML.
- [ ] No `sb-*` or `PRODUCTION_SUPABASE_USER` key is written to localStorage on a learner page.
- [ ] There are no admin chunks, and the initial bundle is no larger than today.
- [ ] `pnpm lint`, `pnpm format` and `pnpm build:prod` are green (local macOS).

### How to verify

1. Run `pnpm start` (port 4101) and open the home page, `/us/accounting/masterclass`, a course page and
   `/us/accounting/payment/plan`. Then open `/admin/users`: it should show the 404 page.
2. Run `pnpm build && pnpm serve:ssr:miles-masterclass-v3`.
3. Curl the masterclass page and grep for `<title>|og:|canonical`.
4. Run `curl -sI` on `/admin/users`, and fetch `/robots.txt`.

### Risks / assumptions / open questions

- **SEO editing:** without the console, `seo_pages` rows and the OG images in the `seo-images` bucket can
  only be edited in the Supabase dashboard.
- **Ops tools:** Partner Platform, leads, RBAC and user reports are unavailable until admin returns.
- **Estimate:** L by file count (~144 deletions), but it's mechanical. About 150 lines are real edits.

---

## T2 — Delete admin migrations; give `seo_pages` its own RLS

**Summary:** `fix(seo): lock seo_pages writes in a standalone migration and drop admin migrations`
**Issue type:** Task · **Component / scope:** seo · **Branch:** `fix/MIL-<n>-seo-pages-rls`
**Links:** must merge with or before T1

### Context

16 of the 18 files in `supabase/migrations/` belong to admin, and they're being deleted. But RLS on
`seo_pages` is enabled only inside `20260428000000_admin_rbac.sql`.

### Current behaviour

- `admin_rbac.sql:215-233` holds:
  - RLS on `seo_pages`
  - `seo_public_read`
  - the insert, update and delete policies, all gated by `has_admin_permission()`
- `admin_audit_log.sql:294` adds the `seo_pages_audit` trigger.
- `seo_pages.sql` on its own creates the table with **no** RLS.

### Expected behaviour

- A database built from the repo has RLS **on** for `seo_pages`, with public `select` allowed and no
  insert, update or delete for `anon` or `authenticated` (service role only).
- Nothing on `seo_pages` depends on an admin function or table.

### Scope

- **In — delete:**
  - **RBAC and admin users:**
    - `admin_rbac`, `bootstrap_super_admin`, `partner_users_admin`
    - `admin_user_email_domains_id`, `provision_admin_user`, `prune_roles_delete_admin_user`
    - `admin_user_report_type`, `multi_role_admins`
  - **Leads:** `firm_inquiries` and `drop_firm_inquiries`.
  - **Auth:** `custom_access_token_hook`.
  - **Partner Platform:** `partner_platform_rbac`, `partner_tracker_perm`, `partner_two_roles`.
  - **Onboarding:** `user_onboarding_permission`.
  - **Audit log:** `admin_audit_log`.
- **In — keep:** `20260427000000_seo_pages.sql` and `20260508000000_seo_dynamic_slugs.sql`.
- **In — add:** `supabase/migrations/20261023000000_seo_pages_rls.sql`. It's idempotent and safe on the
  live DB:
  - `enable row level security`
  - (re)create `seo_public_read` (`for select using (true)`)
  - `drop policy if exists` for `seo_admin_write`, `seo_admin_update` and `seo_admin_delete`
  - `drop trigger if exists seo_pages_audit`
- **Out:**
  - **Applying it to the live project:** your call.
  - **Dropping the admin tables, functions or hook in the live DB:** a later ticket, after this migration
    has been applied.

### Acceptance criteria

- [ ] Only 3 files remain in `supabase/migrations/`.
- [ ] After `supabase db reset`, an anon-key `select` on `seo_pages` returns 200, and an anon-key `insert`
      is rejected by RLS.
- [ ] The new migration runs twice without error.
- [ ] Learner SEO reads still work (the same checks as T1).

### How to verify

1. Run `supabase db reset`.
2. With the anon key, `GET /rest/v1/seo_pages?select=page_slug&limit=1` returns 200.
3. With the anon key, `POST /rest/v1/seo_pages` returns 401 or 403.

### Risks / assumptions / open questions

- **Live DB until the migration is applied:** it keeps today's policies. They're secure, but they depend on
  `has_admin_permission()`, so don't drop the admin schema first.
- **Access-token hook:** confirm whether `custom_access_token_hook` is still enabled in Supabase Auth.
  Deleting its file doesn't disable it.
- **Estimate:** S

---

## T3 — Course feedback can't be submitted; XSS sink; tabnabbing

**Summary:** `fix(offerings): let learners submit course feedback and sanitize content dialogs`
**Issue type:** Bug · **Component / scope:** offerings · **Branch:** `fix/MIL-<n>-feedback-gate-and-html-sanitize`

### Context

Found in the code review. Submitting feedback on podcast, webinar and micro-learning is what issues the CPE
certificate, so this bug blocks certificates.

### Current behaviour

1. `features/offerings/pages/course-feedback/course-feedback.ts:46` has `currentUser = signal(null)`, which
   is inert. So the gate at :103 always opens "Complete Profile", and feedback is never sent.
2. `features/offerings/dialogs/html-content-dialog/html-content-dialog.ts:29` passes transcript and
   glossary HTML from the API through `bypassSecurityTrustHtml`. That's a stored-XSS sink, and the getter
   rebuilds it on every change detection.
3. `features/offerings/components/course-resources/course-resources.ts:92` calls `window.open(url, '_blank')`
   without `noopener`.

### Expected behaviour

1. The gate reads `AuthSession.isProfileCompleted()` (`core/services/auth-session/auth-session.ts:85`).
2. The HTML is bound with plain `[innerHTML]`, so Angular sanitizes it.
3. Resource links open with `'noopener'`.

### Scope

- **In:** the three files above.
- **Out:**
  - The bookmark guard → T4.
  - Restructuring the feedback facade → backlog.

### Acceptance criteria

- [ ] With a completed profile, podcast feedback sends the POST and shows the success state.
- [ ] With an incomplete profile, the "Complete Profile" dialog opens and no POST is sent.
- [ ] Transcript and glossary dialogs keep their formatting.
- [ ] A resource tab has `window.opener === null`.
- [ ] Gates green (local macOS).

### How to verify

1. Run `pnpm start` (port 4101) and sign in.
2. Open a podcast course's feedback page, submit, and check the request in the Network tab.
3. Open a chapter transcript and the glossary.

### Risks / assumptions / open questions

- **Lost formatting:** the sanitizer strips inline `style` attributes, so some transcript formatting may be
  lost. I'll compare before and after.
- **Estimate:** S

---

## T4 — Signed-out bookmark clicks send unauthenticated POSTs

**Summary:** `fix(shared): ask signed-out visitors to sign in before bookmarking`
**Issue type:** Bug · **Component / scope:** shared · **Branch:** `fix/MIL-<n>-bookmark-sign-in-guard`

### Context

The comment on `shared/services/utils.ts:627` `toggleBookmarkCourse` says the function is "guarded
centrally", but there is no guard. Its 7 callers rely on it:

- the hover, vertical and horizontal cards
- coming-soon
- course-info
- `podcast-course-hero`
- `micro-learning-course-facade`

### Current behaviour

When a signed-out visitor clicks a bookmark, the app POSTs `v2/user/toggle-bookmark/` with no token.

### Expected behaviour

When signed out, no request is sent. The existing sign-in prompt shows instead, and the function returns
`EMPTY`, so no caller changes.

### Scope

- **In:** `toggleBookmarkCourse` only.
- **Out:** everything else.

### Acceptance criteria

- [ ] Signed out, a bookmark click on a card, a course hero or a reel shows the prompt and sends no
      `toggle-bookmark` request.
- [ ] Signed in, it works as before.
- [ ] Gates green.

### How to verify

Run `pnpm start` and open a private window. Click a bookmark on a home card and on a course page, and
watch the Network tab.

### Risks / assumptions / open questions

- **Sign-in prompt:** I'll reuse the app's existing prompt. If there isn't one, it'll be a toast with a link
  to `/auth/login`.
- **Estimate:** S

---

## T5 — Remove a leaked API key and an SSN-shaped value from the client bundle

**Summary:** `chore(core): remove the unused activity API key and test SSN from environments`
**Issue type:** Tech debt (security) · **Component / scope:** core · **Branch:** `chore/MIL-<n>-remove-client-secrets`

### Context

AGENTS §7 allows only the public anon key and public IDs in the browser.

### Current behaviour

- `src/environments/environment*.ts` ships `MILES_ACTIVITY.apiKey`, a real AWS API-Gateway `x-api-key`, in
  every bundle. Its only reader, `core/services/miles-activity/`, has no importers.
- `PAYMENT_TEST_SSN`, a 9-digit SSN-shaped value, is in the production environment, and nothing reads it.

### Expected behaviour

Neither value is in the environments or the bundle, and the dead `MilesActivity` service is gone.

### Scope

- **In:** the 3 environment files and `core/services/miles-activity/`.
- **Out:** **rotating the key, which the backend must do.** The key has already shipped publicly.

### Acceptance criteria

- [ ] After `pnpm build:prod`, `grep -r "MILES_ACTIVITY\|PAYMENT_TEST_SSN" src dist/` finds nothing.
- [ ] Gates green.

### Risks / assumptions / open questions

- **Rotation:** who on the backend rotates the key?
- **Estimate:** S

---

## T6 — Scope facades to the routes that use them; remove dead facade code

**Summary:** `refactor(offerings): scope facades to their routes and remove dead members`
**Issue type:** Tech debt · **Component / scope:** offerings · **Branch:** `refactor/MIL-<n>-facade-scoping`

### Context

The facade audit (AGENTS §3) looked at 23 facades outside admin. 8 are used properly:

- the masterclass course tree: CourseDetail, FinalAssessment, CourseEvaluation, CourseCertificate,
  CourseChapter and CourseChapterQuiz
- LiveSession
- Payment

This ticket covers the cheap fixes; the structural ones are in the backlog.

### Current behaviour

- **`FeedbackFacade`** is provided 4 times. The provider in `course-feedback.ts:33` shadows the three route
  entries, which are dead: `webinar.routes.ts:102`, `podcast.routes.ts:41` and `micro-learning.routes.ts:33`.
- **`MasterclassFacade`** is provided above every offering (`features.routes.ts:164`), but only podcast uses
  it.
- **`AuthFacade`** sits on the auth shell (`auth.routes.ts:14`) but only login uses it. That's why
  `login.ts:55` has a `clear()`-on-destroy workaround.
- **Dead code:**
  - `masterclass-facade.ts:45`: `route`
  - `chapter-facade.ts:23`: `router`
  - `WebinarFacade.isRegistering()`
  - `SectionFiltersFacade.clear()`
  - the `isLockedElsewhere` input on webinar-hero and webinar-card, which nothing binds

### Expected behaviour

Each facade is provided once, on the narrowest route that uses it, and the dead members are removed.

### Acceptance criteria

- [ ] The podcast course and chapter pages work.
- [ ] Feedback works on webinar, micro-learning and podcast.
- [ ] Login OTP works, including after leaving and coming back (the state resets).
- [ ] Webinar register and join work.
- [ ] Gates green.

**Estimate:** S (~50 lines)

---

## T7 — Course canonicals and SEO slug hardening

**Summary:** `fix(seo): canonicalize course pages to one URL and validate the SEO slug`
**Issue type:** Bug · **Component / scope:** seo · **Branch:** `fix/MIL-<n>-course-canonical`

### Context

These are SEO findings 3 and 4 above.

### Current behaviour

- `course-seo-setup.ts:89` builds the canonical from the request URL. So
  `/us/accounting/masterclass/<id>/<anything>` is self-canonical and indexable, and its early-paint title is
  built from `<anything>`.
- The sitemap (`src/seo.ts:174-219`) emits the feed's `slug`, and its comment assumes the page canonical
  matches it.
- `supabase-seo.ts:89` puts the raw slug into a PostgREST `.or()`.

### Expected behaviour

- Once the course is known, every masterclass, podcast and micro-learning course page uses the canonical
  `/us/accounting/<type>/<id>/<the course's real slug>`, whatever title is in the URL.
- **Wrong slug in the URL:** either keep the page there with the correct canonical, or `replaceUrl` to the
  right slug. Decide which with the backend.
- `getBySlug` rejects a slug that doesn't match `^[a-z0-9-]+(/[a-z0-9-]+)*$` and returns `null`, which falls
  back to the default SEO.

### Scope

- **In:** `course-seo-setup.ts`, `course-seo-config.ts`, `supabase-seo.ts` (`getBySlug`) and the comment in
  `seo.ts`.
- **Out:** adding podcast and micro-learning to the sitemap.

### Acceptance criteria

- [ ] The SSR HTML for `/us/accounting/masterclass/<id>/wrong-title` has the same canonical and `og:url` as
      that course's sitemap URL.
- [ ] The sitemap URL stays self-canonical.
- [ ] A title segment containing `,` or `(` causes no Supabase error and gets the fallback SEO.
- [ ] Navigating between two course pages doesn't grow the `og:` meta count.
- [ ] Gates green, plus the SSR curl check.

### Risks / assumptions / open questions

- **No slug in `course-detail/`:** the endpoint doesn't return one (`course-detail.model.ts:10-15`). I need
  one of these:
  - **(a)** the backend adds `slug` to `course-detail/`, or
  - **(b)** confirmation that the feed's `slug` always equals `slugify(name)` (`shared/services/utils.ts:214`).
- **Sitemap source:** confirm that `masterclass/filter/?content_type=masterclass_course` still answers,
  since `filter/` changed in MIL-119.
- **Estimate:** S–M

---

## Backlog (not ticketed yet)

### Facades

- **Facades in core:** rename `MasterclassHomeFacade` → `MasterclassHomeApi` and `SectionFiltersFacade` →
  `SectionFiltersApi`.
- **Thin facades:** `MasterclassHighlightFacade`, `HomeFacade`, `UaeCairaFacade` and `FeedbackFacade`.
- **Inject-and-relay:**
  - webinar-hero and webinar-card. AGENTS §3 holds webinar-hero up as the reference example, but the code
    disagrees.
  - `video-chapter`
  - `podcast-course-hero`
  - the micro-learning reel card
- **Duplicated logic:** `ChapterFacade` duplicates `MasterclassFacade`.
- **Root facades holding page state:** `CourseFacade` and `BadgeFacade`.
- **HTTP or business rules in pages:**
  - faculty
  - ai-labs
  - partnership-content
  - micro-learning
  - cpe-tracker
  - badge
  - invoice:175
  - podcast-chapter

### Medium

- `learning_objectives.split` on null in the shared cards.
- A stale-response race in `course-related-section`.
- `laptop.ts` puts `!important` inside a value, and its timers are never cleared.
- `caira-level-stack` leaks gsap listeners.
- `certificate-access-policy`: `decide` and `decideBulk` disagree.
- `profile-completion-dialog` never reloads the user.
- Production runs at `LogLevel.DEBUG`.

### Low

- `DOCUMENT` is imported from `@angular/common` in 8 files.
- `update-checker` has no teardown.
- About 10 effects should be `computed` or `linkedSignal`.
- 73 `any`s.
- 278 relative imports.
- Dead components:
  - `footer-overlay`
  - `webinar-registration-dialog`
  - `micro-learning-episode-grid`
- 41 commented-out blocks.
