# MIL-99: show the instructor page without sign-in

**Status:** revision 2, 2026-10-16, approved and implemented.

**Branch:** `fix/MIL-99-public-instructor-page`, cut from `master` `68a672d` (MIL-95, #150). One commit.

**What changed since revision 1:** verification found that `filter/` had also changed on 2026-10-15. It replaced
`course_type` with `content_type`, so the page's course tabs failed for everyone. The user chose to fix the tabs here
too (D3). The course library, which has the same break, gets its own bug.

## Jira

```
Bug  MIL-99  fix(library): show the instructor page without sign-in
```

## The bug

Signed-out visitors who open an instructor from the Instructor Library are sent to `/auth/login`.
Only signed-in users can see the page. The page should be public, as on production.

**Cause 1, the profile:** when MIL-95 bound the page, `instructor-detail/` was `IsAuthenticated`. So the route got
`canMatch: [authGuard]` until the backend opened the read (MIL-95 backend question Q1). The backend opened it on
2026-10-15, but it now also **requires `?login_type=`**. The page sends no `login_type`, so the read answers **400**.
The page most likely fails for signed-in users too ("Couldn't load instructor"). This could not be confirmed without
a real UAT token.

**Cause 2, the course tabs:** `filter/` no longer accepts `course_type`, so every tab answered **400** "Extra inputs
are not permitted". This happens signed in or out, so "Couldn't load courses" showed on every tab.

## Assumptions (read first)

1. **The profile stays a browser-only read.** The server render keeps showing "Loading instructor…". Reading
   the profile on the server, along with the page's title, meta and sitemap entry, belongs to the SEO ticket MIL-95
   deferred. Signed-out crawlers are no better off than before, except that the server now answers 200 where it
   used to answer a 302 to the sign-in page.
2. **The course tabs keep `filter/`, now with `content_type`.** It is `AllowAny`, and its cards still pass
   `isMasterclassCourse`. The detail answer's new `courses` list is not read here (see "Not in this fix").

## What it read

- **Postman export** (App 5, refreshed into `postman/` on 2026-10-16), request
  `web-masterclass-instructor-detail-v1`:
  - **Access:** `AllowAny` at the framework layer, with the gate inside the view.
  - **`login_type`:** `?login_type=pre_login|post_login`, required, "never inferred".
  - **`pre_login`:** served anonymously. A valid token sent with it is ignored.
  - **`post_login`:** 401 `authentication_required` without a valid token.
  - **A malformed token** is refused on both branches. A bad token is never quietly downgraded to the public page.
  - **Both answers carry the same keys.** The profile has no per-user field. Only the new `courses` cards differ:
    `is_bookmarked` / `bookmark_id` are filled on `post_login` only.
  - **Status codes:** 200 profile; 400 for a missing or invalid `login_type`, bad paging or an undeclared param; 401;
    404 for an unknown or inactive instructor; 500.
  - **`courses`:** new, a standard pagination block (default 6 rows, max 100, `?page=` or `?courses.page=`). It mixes
    every course type, and each row carries `course_type`.
- **Same export, request `web-masterclass-filter-v1`:**
  - **Filters:** every one is optional and comma-separated: `instructor`, `field_of_study`,
    `additional_category`, `level`, `cpe_credit`, `track`, `content_type`.
  - **Paging:** `page` / `page_size`, default 6, ceiling 100.
  - **Anything else is a 400** naming the parameter. That includes the old `course_type`.
  - **`content_type` values:**
    - `masterclass_course` and `ai_kit`
    - `podcast`
    - `reel`, with children `nano_learning` and `micro_learning`
  - **The answer:** still `data.courses.results`, plus `filters` and `applied`.
- **UAT probes, 2026-10-16, no token:**
  - `instructor-detail/`:
    - no `login_type` → 400 `invalid_query`, `login_type: Field required`
    - `pre_login` → 200
    - `post_login` → 401
  - `filter/`:
    - `course_type=…` → 400, `course_type: Extra inputs are not permitted`
    - `content_type=masterclass_course` → 200 with 64 courses, the same count the old `course_type=course` gave
    - `ai_kit` → 5 courses, all of them also in `masterclass_course`
    - `podcast`, `reel`, `micro_learning`, `nano_learning` → 0 courses each, on the whole catalogue
  - Adam Tahir: `content_type=masterclass_course&instructor=<uuid>` → his 1 course, which passes the card guard.
- **All 63 UAT instructors with `pre_login`:**
  - Every one answered 200 and passed the checks in `parseInstructorProfile`, so the parser needs no change.
  - 43 have rows in `courses`.
  - 70 of the image URLs are still on `storage.googleapis.com`; that is MIL-95 Q5 and still open.
- **Code:**
  - `features.routes.ts`: the route's `canMatch: [authGuard]`, and the guard's only import.
  - `instructor-details.ts`:
    - `profileResource` is gated on `isAuthenticated()` and sends no params.
    - The tabs send `course_type`.
  - `models/instructor-library.model.ts` and `constants/instructor-library.ts`:
    - the tab type is `'course' | 'podcast' | 'micro_learning'`
    - `INSTRUCTOR_DETAIL_URL`'s comment still says "Sign-in only"
  - `course-detail-facade.ts` and `masterclass-home-facade.ts`: the existing `login_type` pattern, which is a
    `computed` from the boolean `isAuthenticated()`.
  - `core/models/masterclass-home.model.ts`: `MasterclassLoginType` (`'pre_login' | 'post_login'`). The page
    already imports `MasterclassCourse` from this file.
  - `AuthSession.logout()` callers: sign-out does a full reload to `/`, so the page never sees `isAuthenticated`
    flip on sign-out.
  - `app.routes.server.ts`: the route renders on the server through `**`. No change.
  - `course/services/course-facade.ts`: the course library sends `course_type` to `filter/` too, so it is broken on
    UAT in the same way. It is not changed here.

## Locked decisions (approved 2026-10-16)

- **D1. Remove the sign-in guard from the route.** The read is public, so the route is too.
- **D2. Send `login_type` from the session's boolean:**
  - `post_login` when `isAuthenticated()`, `pre_login` otherwise, as on `course-detail/` and the masterclass home
    feed.
  - The type is the existing core `MasterclassLoginType`, so there is no fourth copy of the union.
  - **Considered, not chosen:** `pre_login` for everyone, as the course library does. The profile is identical
    either way, but D2 follows the endpoint's two-sided contract, and the bookmarks in `courses` need `post_login`
    if the page ever reads them.
- **D3. The course tabs send `content_type`** (user's call after verification):
  - Masterclass → `masterclass_course`, which already holds the AI Kit courses.
  - Podcast → `podcast`.
  - Micro Learning → `micro_learning`.

  The type and the tab field are renamed to the API's word (`InstructorContentType`, `contentType`), so the old
  vocabulary doesn't linger.

- **D4. SEO stays out** (Assumption 1).

## Endpoint map

| Read                        | Before                                | After                                             |
| --------------------------- | ------------------------------------- | ------------------------------------------------- |
| `instructor-detail/<uuid>/` | signed in only, no params (now a 400) | everyone, `?login_type=pre_login` or `post_login` |
| `filter/?instructor=<uuid>` | `course_type=<tab>` (now a 400)       | `content_type=<tab>`                              |

## Target change (one commit)

`fix(library): show the instructor page without sign-in`

1. **`src/app/features/features.routes.ts`**
   - Remove `canMatch: [authGuard]` and its comment from `instructor/:instructorId/:instructorName`.
   - Remove the `authGuard` import, which has no other user in the file.
2. **`src/app/features/library/instructor/pages/instructor-details/instructor-details.ts`**
   - Add a `loginType` `computed<MasterclassLoginType>`: `post_login` when `isAuthenticated()`, else `pre_login`.
     It carries the same "boolean, never the token" comment as `course-detail-facade.ts`.
   - In `profileResource`, drop the `isAuthenticated()` gate and send `params: { login_type }`. It stays
     browser-only and keeps `parse: parseInstructorProfile`.
   - The course read sends `content_type` instead of `course_type`, and the default tab is `masterclass_course`.
   - Update the class comment ("The route is sign-in only while …").
3. **`src/app/features/library/instructor/models/instructor-library.model.ts`**
   - Replace `InstructorCourseType` with
     `InstructorContentType = 'masterclass_course' | 'podcast' | 'micro_learning'`.
   - Rename `InstructorCourseTab.courseType` to `contentType`.
4. **`src/app/features/library/instructor/constants/instructor-library.ts`**
   - The tabs use the new values.
   - Comments on `INSTRUCTOR_DETAIL_URL` (`AllowAny` since 2026-10-15; `login_type` required; 400 / 401) and
     `INSTRUCTOR_COURSES_URL` (narrowed by `content_type`; the retired `course_type` is a 400).

4 files, +37 / −23. No new file, parser or template change.

## Security

- **Tokens:** the bearer still goes through `appInterceptor`. Nothing attaches it by hand.
- **`login_type`:** it comes from the boolean `isAuthenticated()`, never the token, so a token rotation doesn't
  refetch the profile.
- **A token the API refuses** lands in the error state with Try Again. It is never retried as `pre_login`: the
  backend refuses a malformed token on both branches by design, and the page must not hide that.
- **Instructor ids:** still checked against `INSTRUCTOR_ID_PATTERN` before they reach the URL. Old numeric links
  never call the API.
- **No new data reaches signed-out visitors** beyond what the backend now serves them: catalogue content with no
  per-user field.

## Acceptance criteria

1. **Signed out, library → instructor:**
   - The page shows the hero, About, socials, "Courses by …" and the tabs. There is no redirect to sign-in.
   - The profile request carries `login_type=pre_login` and no `Authorization` header.
2. **Signed out, direct load of `/us/accounting/instructor/<uuid>/<slug>`:** the server answers 200, not 302. The
   page shows "Loading instructor…", then the profile.
3. **Signed in:**
   - The profile request carries `login_type=post_login` and the bearer.
   - The page renders as it did after MIL-95.
4. **Signed out, the rest of the page:**
   - Each tab sends one `filter/` read with `content_type=<tab>&instructor=<uuid>`.
   - Each tab shows its cards or "No … courses yet."
   - Trailer and "i" open.
   - A card opens the course page.
5. **Unchanged:**
   - An old numeric link shows "Instructor not found" with no API request.
   - An unknown UUID shows "Couldn't load instructor" with Try Again (the API's 404).
   - Back returns to the page that opened the instructor page.
6. **No console errors** besides the known 403 photos (MIL-95 Q5).

## Checks

Run locally on macOS:

```bash
pnpm lint
pnpm format:fix
pnpm build:prod
```

Plus `node scripts/check-structure.mjs` (structure ratchet) and `tsc` via the build.

## How to verify (dev server on 4101, headless Playwright as for MIL-95)

1. **Signed out:**
   - Open `/us/accounting/library/instructor-library`, then click Adam Tahir.
   - Assert the URL stays on `/instructor/…` and the hero and About render.
   - Assert the `instructor-detail/` request has `login_type=pre_login` and no `Authorization` header.
   - Switch the tabs: each sends `content_type`. Open Trailer and "i".
2. **Server render:** `curl -s -o /dev/null -w "%{http_code}" http://localhost:4101/us/accounting/instructor/<uuid>/adam-tahir`
   returns 200, and the HTML carries "Loading instructor…".
3. **Signed in:**
   - Set a dummy `ACCESS_TOKEN` cookie and route `instructor-detail/`.
   - Assert the request asks for `login_type=post_login` and carries the bearer.
   - Fulfil it with the real `pre_login` body (the same keys, per the contract) and assert the page renders.
   - A real `post_login` 200 needs a real UAT sign-in: worth one manual check by someone signed in on UAT.
4. **Edge cases:** `/instructor/3665/…` shows "Instructor not found" with no request. An unknown UUID shows the
   error with Try Again.
5. **Back:** an instructor → Back → the library with its cards.

## Risks

- **The session flips while the page is open** (the token expires and the refresh fails): the profile refetches
  with the other `login_type`, and "Loading instructor…" shows briefly. Sign-out reloads to `/`, so it never
  reaches this. Accepted.
- **The detail answer now carries up to 6 course cards the page doesn't read** (a few KB). Accepted until the
  follow-up below.
- **The server render still has no profile**, so crawlers see "Loading instructor…". This is the SEO ticket, and
  still better than the 302 to sign-in they got before.
- **Podcast and Micro Learning are empty for every instructor on UAT** (0 in the whole catalogue). The empty
  state is all those tabs can show until content exists.

## Not in this fix

- **The course library on `filter/`** (`course/services/course-facade.ts`): it still sends `course_type`, so it
  answers 400 on UAT. It needs its own bug. Its tabs, filter sidebar and parser should be checked against the new
  `filters` / `applied` blocks.
- **SEO for the instructor page:** a server read of `pre_login`, the browser title, meta and the sitemap entry
  (`src/seo.ts` still skips instructor URLs).
- **Reading the courses from `instructor-detail/`'s `courses` instead of `filter/`.** It mixes course types and
  pages by 6, so the tabs would need splitting by type and paging. Worth a ticket only if `filter/` goes away.
- **Postman paths** in `docs/AUTH_API.md:5` and `docs/WEBINAR_API_QUESTIONS.md:5`, which still point at the old
  layout.
- **MIL-95 backend questions:** Q1 is answered by this change. Q5 (GCS photo 403s) and Q6 (promo video data) are
  still open.
