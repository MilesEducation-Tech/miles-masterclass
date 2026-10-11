# Highlight, levels and AI Labs APIs; removal of non-Postman calls

Approved 2026-10-11. Six PRs, one ticket and one branch each, every branch one commit on `master`
(`ca87d50`). No PR depends on another; they merge in any order (the only shared file,
`masterclass-home.model.ts`, takes far-apart hunks from PRs 1 and 2).

| PR  | Branch                                    | Commit / PR title                                                                   |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | `feat/MIL-55-highlight-hero-ai-labs-ring` | `feat(shared): feed the masterclass hero and the AI Labs ring from web-api`         |
| 2   | `feat/MIL-56-home-webinar-caira-levels`   | `feat(home): show the highlight webinar and the CAIRA levels from web-api`          |
| 3   | `fix/MIL-57-sitemap-web-api`              | `fix(seo): list webinars from the paginated feed and drop the legacy catalog reads` |
| 4   | `chore/MIL-58-remove-utm-capture`         | `chore(core): remove the UTM capture that posts to a retired route`                 |
| 5   | `refactor/MIL-59-remove-mybucket`         | `refactor(payment): remove the user/cart/mybucket read`                             |
| 6   | `docs/MIL-60-legacy-api-roadmap`          | `docs(core): map every legacy API call to its web-api twin`                         |

## Decisions (user, 2026-10-11)

- **D1.** The webinar landing is unchanged. Its hero already resolves
  `highlight_webinars[0] ?? upcoming_webinars[0]` from `webinar-main-page/`, which is curated per login
  state and carries `registration`. `highlight-webinars/` is pre-login only.
- **D2.** The CAIRA stack shows only when `levels/` returns rows. `levels/` is sign-in only, so guests
  get no section and no sidenav entry.
- **D3.** Removal scope: the global calls, plus home, `/masterclass` and `/webinar`. Every other feature
  goes to `docs/LEGACY_API_ROADMAP.md`.
- **D4.** `user/cart/mybucket/` is removed now. The cart is empty on a fresh load until the commerce
  rebind lands.

### Departures from the approved plan

- **The AI Labs ring moved from the home PR to PR 1.** It shares `parseCoursePage` with the hero, so
  neither PR depends on the other.
- **The ring always sends `login_type=pre_login`.** That branch ignores the token, the ring reads
  nothing per-user, and sign-in doesn't refetch.
- **The stack's input is `ladder`, not `levels`.** The existing `levels` computed (used by the template
  and GSAP) keeps its name.
- **Slider thumbnails get `alt=""` and only the hero is `priority`.**
  - Thumbnail slides are `aria-hidden`, and 5 of the 10 pinned images are 403.
  - SSR preloads every `priority` image, so the hero alone keeps it.

## Live responses (UAT, 2026-10-11, signed out and signed in)

The types follow these. Every body is `{success, message, data}`.

- **`GET web-api/v1/events/highlight-webinars/?page_size=1`:**
  - `data: {highlight_webinars: Page}`, the same for both login states. Each row has 18 keys and no
    `fields_of_study`, `total_cpe_credits` or `registration`.
  - Live, `short_description`, `subject`, `subject_details`, `level_details` and `vertical_thumbnail`
    are null.
  - Count is 2, in editorial order (CPA 11:30 before CMA 08:30 on 2026-10-18).
- **`GET web-api/v1/masterclass/highlight/?all_courses.page_size=100`:**
  - `data` is the Page block itself (`slug: top_section_courses_web`, 10 rows).
  - Rows are byte-for-byte the `tracks-page/` card (22 keys), so `isCourse` holds.
  - Signed in, only `is_bookmarked` and `bookmark_id` are filled.
- **`GET web-api/v1/masterclass/ai-labs/?login_type=pre_login&page_size=8`:**
  - Same card, 2 rows.
  - `post_login` without a token is a 401 ("Sign in to load the post-login AI Labs rail.").
- **`GET web-api/v1/masterclass/levels/`:**
  - Guest: **401** (Postman says 403) with `data: null`.
  - Signed in: `data` is an array of 3 `{id, name, level_actual_name, level_number, description: null,
image_url, subject_id, subject_name: "CAIRA"}`.
- **`GET web-api/v1/masterclass/levels-progress/`** (not used yet): signed in,
  `data: {total_cpe_credits, levels: Page}` with status, progress and Credly keys.

## Jira tickets

### PR 1

**Summary:** `feat(shared): feed the masterclass hero and the AI Labs ring from web-api`
**Issue type:** Story · **Component / scope:** offerings, shared
**Links:** Postman `web-masterclass-highlight-v1`, `web-masterclass-ai-labs-v1` · this prompt

- **Context:**
  - The `/masterclass` hero reads `v2/dashboard/?filter=popular` (404) and is empty on UAT.
  - Its "Learn More" calls `v2/library/:id/about/` (404).
  - The home AI Labs ring reads `v2/tracks/7/courses/` (404), and its links point at a route that
    does not exist.
- **Expected:**
  - The hero shows the admin-pinned courses from `highlight/`, server-rendered.
  - "Learn More" opens the about-course dialog, and "Watch Now" opens `/masterclass/:uuid/:slug`.
  - The ring shows `ai-labs/` courses and links to `/masterclass/:uuid/:slug`.
- **Acceptance:**
  - [ ] No `v2/dashboard`, `v2/library` or `v2/tracks` request on `/masterclass` or home.
  - [ ] The hero is in the SSR HTML (`aria-roledescription="carousel"`) with exactly one preloaded image.
  - [ ] No hydration errors at 375.
  - [ ] `slider.ts` is off `LEGACY_ANY_FILES`.
  - [ ] Lint and `build:prod` are green.
- **Risks:** 5 of the 10 pinned artworks are 403 on GCS. The ring's artwork needs CORS on the S3 bucket.
  Both are backend asks.

### PR 2

**Summary:** `feat(home): show the highlight webinar and the CAIRA levels from web-api`
**Issue type:** Story · **Component / scope:** home
**Links:** Postman `web-events-highlight-webinars-v1`, `web-masterclass-levels-v1`

- **Context:** The home webinar ticket was never wired (it waited for this endpoint). The CAIRA stack
  reads `v2/caira-badges/` (404) and showed fallback copy.
- **Expected:**
  - The ticket shows the first highlight webinar, and both buttons open `/webinar/:uuid`.
  - Signed in, the CAIRA stack shows `levels/` (CAIRA rows only).
  - For guests, and when the read fails, there is no section and no sidenav entry.
- **Acceptance:**
  - [ ] Guest: the ticket shows, no `levels/` request is made, and there is no `#caira-levels`.
  - [ ] Signed in: three cards with the API titles and medals; signing out hides the section.
  - [ ] Lint, `build:prod` and `build-storybook` are green.

### PR 3

**Summary:** `fix(seo): list webinars from the paginated feed and drop the legacy catalog reads`
**Issue type:** Bug · **Component / scope:** seo

- **Context:**
  - `fetchWebinars` iterates a Page object, which throws; the `.catch` swallows it, so `/sitemap.xml`
    lists 0 webinars.
  - The `v2/library/` and `instructor/` reads both 404.
- **Expected:** The webinars are listed (each bucket at `page_size=100`), and the legacy reads are gone.
- **Acceptance:**
  - [ ] `curl /sitemap.xml | grep -c /webinar/` is greater than 0 (it was 0 on master).
  - [ ] Lint and `build:prod` are green.

### PR 4

**Summary:** `chore(core): remove the UTM capture that posts to a retired route`
**Issue type:** Tech debt · **Component / scope:** core

- **Context:** `utm/track_utm/` has no Postman twin and answers 404. Nothing else reads its cookie.
- **Acceptance:**
  - [ ] Loading with `?dXRt=x` sends no `utm/track_utm/` request.
  - [ ] Lint and `build:prod` are green.

### PR 5

**Summary:** `refactor(payment): remove the user/cart/mybucket read`
**Issue type:** Tech debt · **Component / scope:** payment

- **Context:** `user/cart/mybucket/` is not in Postman and answers 404. Its twin is
  `GET api/v1/commerce/cart/`, which comes with the commerce rebind.
- **Expected:**
  - No cart read anywhere.
  - The cart comes only from this session's own add/remove/coupon/checkout responses.
  - A fresh load shows an empty cart, and `/payment/billing` redirects to `/payment/cart`.
- **Acceptance:**
  - [ ] No `mybucket` request on any page.
  - [ ] The payment routes don't hang (the resolver is gone and the guard answers synchronously).
  - [ ] Lint, `build:prod` and `build-storybook` are green.
- **Risks:** A returning user's server cart is invisible until the commerce rebind. Accepted (D4).

### PR 6

**Summary:** `docs(core): map every legacy API call to its web-api twin`
**Issue type:** Task · **Component / scope:** core

- **Scope:** `docs/LEGACY_API_ROADMAP.md`, this prompt, and the STATE.md entry.
- **Acceptance:** [ ] `pnpm format` is green.
