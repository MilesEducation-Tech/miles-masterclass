# Phase 9 — Data layer · `admin/*` (non-partner)

Date: 2026-09-26 · Branch: `refactor/structure-10` · Run before Phase 10 admin, at your call (no waiver).

## 1. Summary

**Three Django facades moved to `httpResource`.** **Three SEO console pages lost their
`ngOnInit` → Promise → `signal.set` loaders.**

- Source is +186 / −171, nearly even.
- Specs are +498, in 5 new spec files with 18 tests.
- Most of the row was already on `resource()`: `admin-users`, `rbac` and `audit-log` read Supabase through
  `resource()`, which §4.2 accepts as it is.

| Step | File                                              | Change                                                                                                                                                                                                                                                                                                                                                   |
| ---- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1   | `leads/services/leads-facade`                     | List `resource()` + `firstValueFrom` → **`httpResource`** with the same `adminContext()`. The `rows` `linkedSignal` (in-place PATCH) and `withPreviousValue` are kept.                                                                                                                                                                                   |
| S2   | `user-report/services/user-report-facade`         | List → **`httpResource`**. The loader's reshape moved into `parse`; the current-page fallback is `untracked(pageNumber)`. `SKIP_AUTH_TOKEN` is kept.                                                                                                                                                                                                     |
| S3   | `user-onboarding/services/user-onboarding-facade` | Users list, partner codes, and the `list<T>()` reference factory → **`httpResource`**. The factory now returns a guarded `computed` list. The admin and public contexts are kept per endpoint.                                                                                                                                                           |
| S4   | `seo/pages/seo-dashboard`                         | → component **`resource()`** (supabase-js). The seed-if-empty write stays inside the load, with the same control flow. `pages` is a `linkedSignal`, because delete and toggle patch it. Retry = `reload()`. The manual `loading`/`loadError` signals are now `computed`.                                                                                 |
| S5   | `seo/pages/seo-bulk-upload`, `seo-editor`         | Bulk upload: existing slugs → `resource()` + a `computed` Set. Editor: a `resource()` keyed on the slug input, so it now also reloads when the slug changes. `page` is a `linkedSignal` (the preview edits it, a save replaces it). **The form is filled by an `effect` on the resource, once per load**, and never from the preview's writes to `page`. |

**Bug fixed along the way: 11 unguarded `value()` reads.** §4.2 asks for `hasValue()` guards, and without them a
failed load threw inside the page:

- leads `pagination`;
- user-report total, current page, has-prev and has-next;
- user-onboarding pagination, partner codes, and the four reference lists;
- the company typeahead.

A 403 on `/admin/leads` would have thrown from `pagination()` instead of showing the server's reason in the banner. The
leads spec pins that.

**Scope, as assumed in STATE.md and confirmed by the reviewer:**

- The partner services in `admin/core` (`partner-network-facade`, `partner-superadmin-facade`, `partner-admin-me`)
  and `users/partner-users-facade` are reachable only through `partner-v2` routes. They go with the
  **`admin/partner-platform(-v2)`** row.
- The one non-partner consumer, `admin-users`, only reads from `PartnerSuperAdminFacade`.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15: **8/8 green**.

| Gate            | Result                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| lint            | pass                                                                   |
| unit tests      | pass: 175 files, **641 passed** + 1 skipped (was 623)                  |
| build (local)   | pass                                                                   |
| build (prod)    | pass                                                                   |
| storybook build | pass                                                                   |
| format check    | pass                                                                   |
| bundle report   | pass: initial 88.7 KB gz, unchanged from the previous row              |
| ssr smoke       | pass: 4 of 4 routes; `/admin/login` 200 (admin is `RenderMode.Client`) |

- **`reviewer`: PASS, zero violations.** It checked:
  - every request's context against `HEAD` (`IS_ADMIN_REQUEST` or `SKIP_AUTH_TOKEN`, per endpoint);
  - the seed flow;
  - the editor's form-fill timing;
  - the scope split;
  - that the new tests bite.
- **Test that bites, checked:** the editor's "no re-fill while typing" test writes a _different_ title into `page`
  than the form holds, so filling the form from `page` would fail it.
- **Browser: not run.** Every admin page needs a Supabase admin sign-in, which is yours to do. The dev-server config
  also uses `npx` (see the offerings Phase 10 report).

## 3. Decisions needed / skipped / suspicious

- **No decision needed** to close this row.
- **Scope assumption, for you to confirm:** the four partner services (§1) are left to the
  `admin/partner-platform(-v2)` row. If you'd rather this row own everything under `admin/core`, it is about
  15 more `resource()` → `httpResource` swaps. Most are straightforward; two are Observable getters consumed by v1/v2
  pages.
- **Left on purpose:**
  - `AdminAuth`: session and `get_my_admin_profile` are on the guard path, and their return value drives sign-out.
  - The admin token interceptor, audit writes, and provisioning.
  - The CSV exports (downloads).
  - The company typeahead (a search). It is still `resource()` with the debounce in the page; its `value()` is now
    guarded.
  - `user-report`'s course-detail drill-down, which is a POST.
- **The SEO pages keep a component-level `resource()`** rather than a facade, following `audit-log`'s precedent in
  this same row.
- **Suspicious, logged:** on `/admin/admin-users`, `PartnerSuperAdminFacade` loads all four of its lists (networks,
  codes, firms, partner admins), but the page reads only networks and firms. Two wasted GETs per visit. That is a
  partner-row concern.
- **Pre-existing, unchanged:** the three dead (unrouted) pages `users/pages/users`, `seat-tracker` and
  `user-onboarding/pages/user-onboarding` still compile against these facades.

## 4. Visual QA list (admin sign-in)

1. **Leads:**
   - the list loads and pages;
   - search and the status filter go back to page 1;
   - changing a status updates the row with no reload;
   - as a non-super-admin, the 403 banner shows the server's reason, and the page does not break.
2. **User report:**
   - the list and pagination work;
   - search resets to page 1;
   - the course drill-down dialog works;
   - Export works.
3. **Partner v2 → Onboarding** (uses `UserOnboardingFacade`):
   - the users list, search and domain filter work;
   - the create/edit form's dropdowns (professions, courses, state boards, sectors → roles) fill in;
   - the partner code defaults to Creator;
   - the company typeahead works.
4. **SEO dashboard:**
   - the list, stats and search work;
   - delete and the active toggle update in place;
   - with the Supabase config broken, the error banner and Retry show.
5. **SEO editor:**
   - opening a page fills the form;
   - typing updates the preview and the score, and does not reset what you typed;
   - Save works;
   - an unknown slug opens a default page.
6. **SEO bulk upload:** the New/Overwrite badges match the existing rows.

## 5. Commit messages (two commits)

**1.** The three facades and their specs: `leads-facade`, `user-report-facade`, `user-onboarding-facade`

```
refactor(admin): move the leads, user-report and onboarding reads to httpResource

- LeadsFacade, UserReportFacade, UserOnboardingFacade: Django list reads
  resource() + firstValueFrom -> httpResource, same admin/public contexts
- guard 11 value() reads that threw on a failed load (a leads 403 no
  longer breaks the page)
- +11 spec tests

Phase 9 (data layer), admin/*.
```

**2.** The SEO pages and their specs (`seo-dashboard`, `seo-bulk-upload`, `seo-editor`), plus STATE.md and this report

```
refactor(seo): load the SEO console pages through resource()

- seo-dashboard: ngOnInit/Promise/set -> resource() (seed-if-empty kept),
  pages as a linkedSignal, Retry = reload()
- seo-editor: resource() keyed on the slug; the form fills once per load
  from the resource, never from the live preview's writes
- seo-bulk-upload: existing slugs as a computed over resource()
- +7 spec tests

Phase 9 (data layer), admin/*.
```
