# Masterclass page: tracks and course-about rebind (MIL-23)

Status: **approved 2026-10-05 with D1–D4 as recommended. PR1 and PR2 are implemented (uncommitted);
PR3 (about-course) and PR4 (bookmark) are not started.**

**Where the build differs from the plan below:**

- **The hero section is kept exactly as it was** (your instruction, 2026-10-05), overriding D2 for the
  hero only.
  - Same markup, still on `FeatureFacade.getResource('popular', 'masterclass')`.
  - That feed (`v2/dashboard/?filter=popular`) 404s on UAT, so the hero is empty there, exactly as on
    `master`.
  - Because the hero is the first viewport again, every track rail stays
    `@defer (on viewport; prefetch on idle)` as before, and no card takes image `priority`.
  - The other removed rails stay removed.
- **Constants files** follow the repo's `constants/<name>.ts` naming:
  - `constants/masterclass.ts` (endpoints, PR1)
  - `constants/masterclass-nav.ts` (sidenav, PR2), so PR1 and PR2 touch disjoint files
- **`openTrailer`** went into the facade in PR1, for the same reason.
- **The `CategoriesList` widening** moved to PR2, next to its first consumer. It is a named
  `CategoryListItem` type in `core/models/course.model.ts`, because types live in models.
- **The sidenav label** stays "Tracker" (today's copy), not "Tracks".
- **Card click** is a real `<a [routerLink]>` with the same classes, instead of `div role="button"`.
  It is crawlable, and it opens in a new tab.
- **The CPE pill** is on the horizontal layout only, like the shared `app-horizontal`. The vertical
  design never had one.
- **Server-rendered HTML** carries the hero and the tracks' placeholders, as before. The tracks' data is
  in the transfer state, so the browser makes no second request.
- **Size:**
  - PR1 is 610 lines, 327 of them spec and mock, plus this plan.
  - PR2 is +492 / −319.
  - Both are over ~400, mostly in tests.

## Assumptions (read these first)

- **A1. Which Postman collection.** `postman/Merged_Masterclass_Backend_All_APIs.postman_collection.json`
  (generated 2026-09-30, 158 requests).
  - You placed it in the repo on 2026-10-05, with its three `*.postman_environment.json` files.
  - It is byte-identical to the copy in `~/Downloads/Merged Masterclass App/` ("Postman B" below).
  - It replaces the 2026-09-25 YAML export. That deletion is uncommitted, in the working tree, and is
    yours to commit.
- **A2. What "remove all types, models, API calls and logic" covers.** It covers the masterclass page
  (`pages/masterclass/`) and anything only that page uses.
  - The root `FeatureFacade`, `Content`, `ContentAbout`, `Track` and `TRACK_ROUTES` stay.
  - Every `getResource` key the page uses is also used by podcast, micro-learning or home (checked
    2026-10-05), so deleting them would break those pages.
  - The page simply stops importing them.
- **A3. Live UAT wins over Postman** wherever the two differ (see "Contract" below). Both were checked on
  2026-10-05.
- **A4. Order comes from the API.** Tracks render in the order the response gives them; the client does
  not re-sort. A track with zero courses is skipped, because the API sends empty tracks.
- **A5. About uses `slug`.** The info button calls `about-course/?slug=`, not `?course_id=`. The route
  accepts either; the slug is on the card and is readable in logs.
- **A6. Angular skill.** The official `angular-developer` skill (angular/skills) is **not installed**:
  - not on claude.ai (only `api-bind` and `mcp-bridge-tools`);
  - no Angular plugin;
  - not in the repo's `.agents/skills/` (vitest, supabase);
  - not under `~/.agents` or `~/.claude/skills`.

  This plan applies its rules, read from the source (see "What I read"). Installing it is a separate
  `chore(skills)` change that you run, because it symlinks into `.claude/skills/`.

## Goal

Rebuild `/:country/:profession_type/masterclass` on two live web APIs. Keep the design, and drop every old
type, model and API call the page uses.

1. **Tracks.** `GET web-api/v1/masterclass/home-page/?login_type=pre_login|post_login` returns tracks,
   each with its courses inline.
   - The page loops over them and renders one section per track.
   - Each section has a heading (track `name`), a sub-heading (`description`), and a carousel of that
     track's courses.
2. **Course info.** The "i" button on a card calls `GET web-api/v1/masterclass/about-course/?slug=…`.
   - It opens the course-info dialog, whose course-about body renders that response.

**Rules for the build:**

- Reads are `httpResource` in a facade.
- No mutation is in scope, so this adds no `ApiClient` call. Bookmark toggling is out of scope; see D3.
- Type-safe end to end:
  - typed models;
  - a runtime `parse` guard at the trust boundary, so a drifted body lands in `error()`, not on screen;
  - typed component inputs, with no `any`.

**Out of scope, one line each:**

- **Homepage tracks:** same API, follow-up F1.
- **Course detail page:** F3.
- **Bookmarks, AI Kit, carousel filters:** D3.
- **The page's other rails:** D2.

## What I read

- **`AGENTS.md`, `CLAUDE.md`**, and the review-rule memories:
  - alias imports
  - pipes over computed formatters
  - `ngSrc`
  - types in `models/`, config in `constants/`
  - reuse components
  - no host class bindings
  - no preview code
- **Skills named in `AGENTS.md` §10** (`angular-conventions`, `ui-components`, `masterclass`,
  `core-services`): these **do not exist** in this repo. `.claude/skills/` holds only
  `release` and `refactor-*`.
- **Official Angular skill** (`angular/skills`, `angular-developer`), read from source:
  - Files: `SKILL.md` and `references/http-client.md`, `resource.md`, `testing-fundamentals.md`.
  - Rules taken from it:
    - `httpResource` for reads, `HttpClient` (here `ApiClient`) for mutations;
    - return `undefined` to skip a request;
    - guard `value()` with `hasValue()`;
    - `parse` for runtime validation;
    - `reload()` to retry;
    - "act, wait, assert" with `await fixture.whenStable()` in tests;
    - run the build after generating.
  - Where it disagrees with `AGENTS.md`, `AGENTS.md` wins:
    - `@angular/aria` is lint-banned here;
    - `@Service()` replaces `providedIn: 'root'`.
- **Code:**
  - The page: `masterclass.ts`, `masterclass.html`, the spec, `masterclass.routes.ts`, `app.routes.server.ts`
    (the page is under the `**` Server render).
  - Shared consumers: the shared cards `vertical`, `horizontal`, `carousel`, `categories-list` and
    `caira-credly-badge`, the `course-info` dialog, `course-about`, and `Utils.openCourseInfoDialog` /
    `openVideoDialog`.
  - The root `FeatureFacade` and its key usage across pages.
  - Repo precedent for a `web-api` read: `webinar-facade.ts` and `webinar.model.ts` (`WEBINAR_ENDPOINTS`,
    `parseMainPage`, `loginType`, `withPreviousValue`).
- **Contract:**
  - The in-repo collection (A1): folder "04. Masterclass - Learning Flow (web)", which has 23 routes,
    among them `home-page`, `about-course` and `bookmark`.
  - Anonymous live calls to UAT on 2026-10-05.
  - A backend-repo survey. The merged backend's source is not on this machine;
    `miles-masterclass-backend` is the legacy `api/v2` codebase.

## Contract (live UAT, 2026-10-05, anonymous)

### `GET web-api/v1/masterclass/home-page/`

- **Auth:** `AllowAny`. `login_type` is required and strict (any other query key is a 400
  `invalid_query`).
- **Anonymous `post_login`:** 401 `authentication_required`.
- **Bad or expired token:** 403, as on every route of this backend.
- **200 envelope:** `{ success: true, message: "Home page loaded.", data }`.
- **`data`, `pre_login`:** `{ login_type, tracks[], coming_soon[] }`.
- **`data`, `post_login`** (Postman B capture) adds `highlight_courses`, `in_progress_courses` and
  `completed_courses`.
- **Track:** `{ id: uuid, slug, name, description, image_url (null), priority, courses[] }`.
  - UAT has 4 tracks: 21, 34, 0 and 13 courses.
  - No per-track pagination; all courses are inline.
- **Course card** (22 keys):
  - `id: uuid`, `slug`, `title`, `short_description`, `description`
  - `thumbnails{horizontal, vertical, square}`
  - `trailer_url`, `web_background_video_url`, `sample_video_url`, `course_navigation_video_url`
  - `total_duration` (a string, e.g. "2 hour 20 minutes")
  - `delivery_method`, `program_level`, `subject{id, name}`
  - `fields_of_study[{id: uuid, name, cpe_credit}]`, `total_cpe_credits`
  - `has_individual_badge`
  - `has_additional_resources{has_exercise_files, has_ai_kit, has_ai_labs, has_tools}`
  - `included_for_caira`, `is_bookmarked`, `bookmark_id`
  - `first_chapter{id, slug, name}`

### `GET web-api/v1/masterclass/about-course/?slug=` (or `?course_id=`)

- **Auth:** `AllowAny`.
- **404:** `{ code: "not_found" }`.
- **200:** `{ success: true, message: "Course loaded.", data }`. `data` holds the card keys plus:
  - `exam_rules`, `prerequisite_education`, `advance_preparation`
  - `certificate_expiry_years`, `certifying_organisation`
  - `miscellaneous_data{…}`
  - `learning_objectives[{id, title, description, order}]`
  - `instructors[{id, name, designation, bio, square_image_url, horizontal_image_url, video_url}]`
  - `skills[]`, `topics[{id, name, image_url}]`, `tags[{id, name}]`
  - `chapter_count`

### Where live UAT and Postman B differ

These differences are why the parser checks only the fields the UI reads:

|                        | Postman B (09-30)          | Live UAT (10-05)                                    |
| ---------------------- | -------------------------- | --------------------------------------------------- |
| Envelope               | `status: "success"`        | `success: true`                                     |
| Field-of-study credits | `cpe_credits`              | `cpe_credit`                                        |
| About-only keys        | `glossary_text`, `tools[]` | `miscellaneous_data`; no `glossary_text` or `tools` |

So drift in a field the page does not render can't break it, and drift in a field it does render fails
loudly into the error state.

## Decisions to confirm

**D1. Which components render the new shape.** Recommended: **feature-owned, typed to the new API.**

The shared `Vertical`/`Horizontal` cards (used on 7 pages), the shared `CourseInfo` dialog, and
`CourseAbout` (used on 5 screens) are all bound to the old `Content` / `ContentAbout` shapes. The cards
also make their own HTTP calls (`FeatureFacade.getAbout`, `toggleBookmarkCourse`). Retyping them in place
breaks home, library, partners, uae-caira, podcast, micro-learning, webinar-details and the masterclass
detail page.

- **Recommended:**
  - New `components/masterclass-course-card` (one component with a `vertical | horizontal` layout input).
    - Its markup is taken class-for-class from the shared cards.
    - It reuses `Button`, `CategoriesList`, `CairaCredlyBadge` and `NgOptimizedImage`.
    - It injects no service and emits outputs.
  - Also new: `dialogs/masterclass-course-info-dialog` and `components/masterclass-course-about`, mirroring
    the shared dialog → about structure the brief names.
  - The shared ones stay as they are for the pages still on the old API.
  - This respects the reviewer's "no unnecessary components": these carry a different contract, and they
    take the HTTP out of a presentational component.
- **Alternative:**
  - First, a refactor PR that moves the shared cards and about to a source-neutral view model plus outputs,
    touching every consumer: about 600+ lines and 8 features.
  - Then this feature on top of it.
  - Cleaner long term, but not this ticket. F1 does it naturally: when home moves to the same API, the
    feature card gets promoted to `shared/` and the model to `core/models/`.

**D2. The page's other sections are removed** (recommended). _Superseded for the hero: it is kept
unchanged, as noted at the top._

- the hero slider (`popular`)
- Continue Watching
- Recommended
- Complimentary
- Because You Watched
- My List
- Completed
- Coming Soon

On UAT every one of them is already empty, because their routes 404. The one visible change is that the
hero slider (today a skeleton or empty) goes. The first track becomes the first viewport.

The same response carries `coming_soon` (both login types) and `highlight_courses`,
`in_progress_courses` and `completed_courses` (`post_login`). F2 can rebind the hero, Continue Watching,
Completed and Coming Soon from it with no new request. Their item shapes are unknown (empty in every
capture), so they can't be typed yet.

**D3. Card actions:**

| Action                   | Today                   | In this ticket                                                                                                                                                                                               |
| ------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Card click               | old route               | **Keep.** `routerLink` to `:courseId/:courseTitle` with the course `id` (uuid) and `slug`. The route exists; the detail page itself is still on the old API (F3).                                            |
| Trailer                  | `Utils.openVideoDialog` | **Keep.** No API call; `trailer_url` exists.                                                                                                                                                                 |
| "i"                      | old `getAbout`          | **Rebind** to `about-course` (the goal).                                                                                                                                                                     |
| Bookmark                 | old toggle API          | **Hide in PR1–3.** The web toggle exists (`POST web-api/v1/masterclass/bookmark/<id>/`, sign-in only; Postman couldn't resolve its body), but the brief didn't ask for it. Ready as PR4 (F4) if you want it. |
| AI Kit                   | `additional-resources`  | **Hide.** That route is gone; `has_ai_kit` alone opens nothing.                                                                                                                                              |
| Carousel filter          | `v2/filters/`           | **Off** (`filterEnabled: false`). Masterclass filters exist only under `app-api/` (forbidden). Client-mode extraction reads old fields (`course_category_details`, `instructor_details`).                    |
| Instructor link in about | old instructor page     | **Plain text.** The instructor page is on old numeric ids.                                                                                                                                                   |

**D4. The PR split** (it is over ~400 lines): **three stacked PRs.** See "Phases".

## Locked decisions (from the rules, not up for choice)

- **Facade:** `MasterclassHomeFacade` is `@Service({ autoProvided: false })`, listed in `providers` on the
  `''` route in `masterclass.routes.ts`. It is route-scoped like `WebinarFacade`.
- **Reads:**
  - Both are `httpResource` fields in that facade, with a `parse` guard each.
  - Lists get a `defaultValue`.
  - The HTTP transfer cache stays at its default, so the server-rendered `pre_login` response is reused by
    the browser.
- **Login type:**
  - `loginType` comes from the boolean `AuthSession.isAuthenticated()`, never from the token.
  - `post_login` is skipped on the server, because the learner token lives in the browser. This copies
    `WebinarFacade`.
  - Sign-in therefore refetches automatically, and `withPreviousValue` holds the rails through the
    refetch.
- **Endpoints** are absolute (`${BASE_API_URL}web-api/v1/masterclass/…`) in `constants/`, the same way as
  `WEBINAR_ENDPOINTS`. `slug` is passed through `params` (encoded), never spliced into a path.
- **Code conventions:**
  - Types live in `models/`, config (endpoints, sidenav items) in `constants/`.
  - `@alias` imports everywhere, including inside the feature.
  - `ngSrc` on every image; an empty URL counts as missing (`ngSrc=""` throws NG02952).
  - The first cards of the first track take `priority` (LCP).
  - No `[innerHTML]`. API text renders by interpolation; multi-line text such as `exam_rules` uses
    `whitespace-pre-line`.
  - Credits render `total_cpe_credits` as the API sends it. Nothing is summed in the client.
  - `total_duration` is already a display string and renders as-is. No pipe needed.
  - `@defer`:
    - The first track renders eagerly, because it is now above the fold.
    - Tracks 2..n stay `@defer (on viewport; prefetch on idle)` with the existing sized placeholders.
    - The rail markup is written once in an `<ng-template>`.
    - The dialog loads with a dynamic `import()`.
  - Fix in passing: today `id="masterclass-tracks"` repeats on every track (duplicate ids). It becomes one
    wrapper `<section>`.
- **Out of bounds:** no `app-api/`, no `any`, no `eslint-disable`, and no change to `changeDetection`.

## Target architecture

```
features/offerings/masterclass/
  masterclass.routes.ts                       providers: [MasterclassHomeFacade] on ''
  constants/masterclass.constants.ts          MASTERCLASS_ENDPOINTS, MASTERCLASS_SECTION_NAV
  models/masterclass-home.model.ts            types + parseHomePage (PR1), parseAboutCourse (PR3)
  models/masterclass-home.model.spec.ts
  services/masterclass-home-facade.ts         homePage resource (PR1); about resource + openCourseInfo (PR3)
  services/masterclass-home-facade.spec.ts
  components/masterclass-course-card/         PR2: layout vertical|horizontal, outputs info/trailer
  components/masterclass-course-about/        PR3: renders MasterclassAboutCourse
  dialogs/masterclass-course-info-dialog/     PR3: header from the card, body = course-about
  pages/masterclass/                          PR2: rewritten; injects only the facade
```

**Data flow:**

```
AuthSession.isAuthenticated() ──► facade.loginType ──► homePage httpResource ──parse──► tracks()
page @for (track of facade.tracks()) ──► <app-carousel [cards]="track.courses">
   └► <app-masterclass-course-card [course] [layout]="even ? 'vertical' : 'horizontal'"
                                   (info)="facade.openCourseInfo($event)" (trailer)="facade.openTrailer($event)">
facade.openCourseInfo(course) ──► aboutSlug.set(course.slug) ──► about httpResource ──parse──► dialog body
                              └► import() dialog ──► NgpDialogManager.open(…, { data: course, injector })
```

**Model sketch** (final names and nullability are taken from the live fixture):

```ts
export type MasterclassLoginType = 'pre_login' | 'post_login';
export type MasterclassCardLayout = 'vertical' | 'horizontal';

export interface MasterclassThumbnails {
  horizontal: string | null;
  vertical: string | null;
  square: string | null;
}
export interface MasterclassFieldOfStudy {
  id: string;
  name: string;
  cpe_credit: number;
}

/** Only the keys the page reads; the parser checks exactly these. */
export interface MasterclassCourse {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  thumbnails: MasterclassThumbnails;
  trailer_url: string | null;
  fields_of_study: MasterclassFieldOfStudy[];
  total_cpe_credits: number;
  has_individual_badge: boolean;
  included_for_caira: boolean;
}
export interface MasterclassTrack {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priority: number;
  courses: MasterclassCourse[];
}
export interface MasterclassHomePage {
  login_type: MasterclassLoginType;
  tracks: MasterclassTrack[];
}

// PR3
export interface MasterclassInstructor {
  id: string;
  name: string;
  designation: string | null;
  bio: string | null;
  horizontal_image_url: string | null;
  square_image_url: string | null;
}
export interface MasterclassLearningObjective {
  id: string;
  title: string;
  description: string | null;
  order: number;
}
export interface MasterclassTopic {
  id: string;
  name: string;
}
export interface MasterclassAboutCourse extends MasterclassCourse {
  description: string | null;
  total_duration: string | null;
  delivery_method: string | null;
  program_level: string | null;
  prerequisite_education: string | null;
  advance_preparation: string | null;
  exam_rules: string | null;
  chapter_count: number;
  learning_objectives: MasterclassLearningObjective[];
  instructors: MasterclassInstructor[];
  topics: MasterclassTopic[];
}
```

**Parser guards:**

- `isObject`, `isStr` and similar, written in the model file. This follows the `webinar.model.ts`
  precedent; features can't import each other.
- Promoting both copies to `core/utils/` is F5, its own refactor.
- `parseHomePage` unwraps `data` and checks `login_type`, `tracks` and every course. It throws a
  named error (`[masterclass] home-page response does not match the contract.`).

**Facade surface (public):**

- `loginType`
- `tracks` (non-empty tracks, API order)
- `isLoading`
- `loadError`
- `reload()`
- PR3 adds: `about` (resource), `openCourseInfo(course)`, `openTrailer(course)`, `share(course)`

The page binds only these.

**Sidenav:**

- `MASTERCLASS_SECTION_NAV` in constants holds Home (`masterclass-home`, the page wrapper), Tracks
  (`masterclass-tracks`) and FAQ (`masterclass-faq`).
- The page `computed` sets Tracks `visible` from `tracks().length`.
- The old entries for the removed rails go (D2).

**`CategoriesList`:** the input widens from `FieldOfStudy[]` to a structural
`readonly { id: string | number; name: string; cpe_credits?: number | null }[]`.

- Type-only.
- It reads only `id`, `name` and `cpe_credits`.
- The old `FieldOfStudy` still satisfies it, so all seven callers compile unchanged.
- This is the one edit to `shared/`.

## Endpoint map

| Page need      | Old call (all 404 on UAT)                                                 | New call                                        | Notes                                          |
| -------------- | ------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- |
| Track sections | `tracks/`, then `v2/tracks/:id/courses/` per track (browser-only fan-out) | `web-api/v1/masterclass/home-page/?login_type=` | One request, server-rendered for `pre_login`   |
| Card "i"       | `getAbout(id:number, type)`                                               | `web-api/v1/masterclass/about-course/?slug=`    | `AllowAny`; on click only                      |
| Track filters  | `v2/filters/`                                                             | none                                            | Off (D3)                                       |
| Hero / rails   | `v2/dashboard/`, `v2/masterclass/*` (with auth)                           | none in scope                                   | Removed (D2); F2                               |
| Bookmark       | `toggleBookmarkCourse`                                                    | `POST web-api/v1/masterclass/bookmark/<id>/`    | Hidden in PR1–3 (D3); PR4 via `ApiClient` (F4) |

## Phases (three stacked PRs, each green on its own)

Split: PR1 → PR2 → PR3.

### PR1: data layer

- **Branch:** `feat/MIL-23-homepage-masterclassPage-tracksRebinding` (current).
- **Size:** about 380 lines.
- **Contents:**
  - `constants/masterclass.constants.ts`
  - `models/masterclass-home.model.ts` (home-page types and `parseHomePage`) plus its spec
  - `services/masterclass-home-facade.ts` (home-page resource only) plus its spec
  - the `CategoriesList` input widening
- The facade is not yet wired into a page; its spec proves the behaviour.

### PR2: the page

- **Branch:** `feat/MIL-23-masterclass-tracks-page`, stacked on PR1.
- **Size:** about 350 added and 200 removed.
- **Contents:**
  - `components/masterclass-course-card` (ts/html/spec)
  - the page rewritten (ts/html/spec)
  - the route `providers`
- The old page code goes: the 9 `getResource` fields, two headings `computed`s, `filterConfig` and
  `S3_BUCKET_URL`.
- The "i" output is wired to a facade method that, in PR2, is not yet rendered. **Alternative:** hold the
  info button back until PR3, which is cleaner for review. I'll take that unless you say otherwise.

### PR3: course info

- **Branch:** `feat/MIL-23-masterclass-course-about`, stacked on PR2.
- **Size:** about 420 lines. If it overshoots, I'll split the about component's spec into its own commit
  and report it.
- **Contents:**
  - about types and `parseAboutCourse` plus spec cases
  - the facade's `about` resource, `openCourseInfo`, `openTrailer` and `share`, plus spec cases
  - `dialogs/masterclass-course-info-dialog` and `components/masterclass-course-about` (ts/html/spec)
  - the card's "i" button turned on
- **The dialog:**
  - **Header**, from the card already in hand, so it paints immediately:
    - title, horizontal thumbnail, short description
    - Watch Now (`routerLink`)
    - Share (`Utils.openShareDialog` through the facade)
    - Close
  - **Body**, from `about`:
    - description
    - learning objectives, sorted by `order`
    - instructors: name, designation, bio, image
    - duration, chapters, CPE plus fields of study, delivery method, program level
    - prerequisites, advance preparation, exam rules, topics
  - **States:** a skeleton while `isLoading()`, and an error line with Retry (`about.reload()`) on
    `error()`.
- **Not rendered**, because the API doesn't send them:
  - created, updated and reviewed dates
  - learning pathway
  - question count

After each PR: STATE.md entry, gates, and a commit message (Summary + Description). You commit and push
each one; I don't.

## Files touched

| File                                                                                | PR   | Change                         |
| ----------------------------------------------------------------------------------- | ---- | ------------------------------ |
| `features/offerings/masterclass/constants/masterclass.constants.ts`                 | 1    | new                            |
| `features/offerings/masterclass/models/masterclass-home.model.ts` (+ `.spec.ts`)    | 1, 3 | new                            |
| `features/offerings/masterclass/services/masterclass-home-facade.ts` (+ `.spec.ts`) | 1, 3 | new                            |
| `shared/components/categories-list/categories-list.ts`                              | 1    | input type widened (type-only) |
| `features/offerings/masterclass/components/masterclass-course-card/*`               | 2, 3 | new                            |
| `features/offerings/masterclass/pages/masterclass/masterclass.{ts,html,spec.ts}`    | 2    | rewritten                      |
| `features/offerings/masterclass/masterclass.routes.ts`                              | 2    | `providers` on `''`            |
| `features/offerings/masterclass/components/masterclass-course-about/*`              | 3    | new                            |
| `features/offerings/masterclass/dialogs/masterclass-course-info-dialog/*`           | 3    | new                            |
| `docs/refactor/STATE.md`                                                            | each | "Now" + step log               |

**Not touched:**

- `core/services/feature-facade/*`
- `core/models/{track,course,feature}.model.ts`
- the shared cards, `CourseInfo`, `CourseAbout`
- home, podcast, micro-learning
- `.claude/`, `scripts/refactor/`, `docs/refactor/PROMPT.md`, baselines

## Security

- **Both reads are anonymous by design** (`AllowAny`). `post_login` sends the learner bearer through
  `appInterceptor`; no header is attached by hand.
- **No `app-api/`.** The lint rule enforces it, and the plan never needs it.
- **Inputs:** `slug` comes only from API data and travels as an encoded query param. No user-typed input
  reaches either call.
- **No `[innerHTML]`.** API strings, including `description`, `bio` and `exam_rules`, render as text, so
  CMS markup can't inject.
- **SSR:**
  - `post_login` never runs on the server.
  - No `window`/`document` in the new code; the trailer goes through `Utils`, which already guards.
- **No secrets** are involved.

## Acceptance criteria

1. Anonymous `/us/cpa/masterclass` makes exactly one page-data call:
   `GET …/web-api/v1/masterclass/home-page/?login_type=pre_login`.
   - It comes from the server render, and the browser reuses it (no second request).
   - Nothing calls `tracks/`, `v2/…` or `app-api/`.
2. One section per track with courses, in API order. On UAT today that is three:
   - "AI Mindset, Skillset & Toolset" (21)
   - "Applied AI Across Functions" (34)
   - "Firm-Wide AI Operating Model" (13)

   "Human Skills in the Age of AI" (0 courses) is not rendered.

3. Each section shows the track `name` as heading and `description` as sub-heading. Cards alternate
   vertical (even) and horizontal (odd), matching today's design class-for-class. Visual parity at 375,
   768 and 1440 px, with every intentional difference listed (D2, D3).
4. Each card shows:
   - artwork (vertical or horizontal thumbnail)
   - title, short description, fields of study
   - the CAIRA/Credly badge
   - `total_cpe_credits` CPE
   - Trailer, which opens the video dialog with `trailer_url`
5. Clicking a card navigates to `…/masterclass/<uuid>/<slug>`.
6. (PR3) "i" opens the dialog at once with the card header. It then makes exactly one
   `GET …/about-course/?slug=<slug>` and fills the body.
   - For "Microsoft Copilot: Dawn of the Intelligent System" the body shows 8 learning objectives,
     instructor Chris Stegh, "2 hour 20 minutes", 8 chapters and 2 CPE.
   - Reopening the same course makes no second request.
   - A failed call shows the error line with a working Retry.
7. Signing in switches the request to `login_type=post_login` without blanking the rails.
8. A body that fails `parse` shows the page error state with Retry. It doesn't render partially, and the
   console has no unhandled error.
9. The sidenav lists Home, Tracks and FAQ, and each one scrolls to a real element. No duplicate `id`s on
   the page.
10. No `any`, no relative cross-folder imports, no `<img [src]>`, and no `eslint-disable`.

## Checks to run (report real output and the environment)

```bash
pnpm lint
pnpm format
pnpm ng test --watch=false
pnpm build:prod
pnpm check:structure
```

- **Server:** run `pnpm build && pnpm serve:ssr:miles-masterclass-v3`, then:
  ```bash
  curl -s http://localhost:4000/us/cpa/masterclass | grep -c 'AI Mindset, Skillset'
  ```
  This proves the first track is in the server HTML.
- **Bundle:**
  - The new components sit in the masterclass lazy chunk, and the dialog is in its own chunk.
  - The initial bundle should not move; I'll report the before and after from `build:prod`.

**Specs** use `provideHttpClientTesting` + `HttpTestingController` and let resources settle with
`await fixture.whenStable()` / `TestBed.tick()`.

- **Model:**
  - accepts a trimmed copy of the live fixture;
  - rejects a missing `data`, a numeric course `id`, and a missing `tracks`.
- **Facade:**
  - anonymous → `pre_login`;
  - signed in → `post_login`;
  - server with a signed-in user → no request;
  - empty tracks dropped and API order kept;
  - error → `loadError`.
  - (PR3) no about request until `openCourseInfo`, then `?slug=`; the same slug twice → one request.
- **Card:**
  - picks the thumbnail for the layout;
  - an empty thumbnail → no `<img>`;
  - "i" emits the course.
- **Page:** a flushed response renders the right headings and sub-headings, and skips the empty track.
- **Dialog (PR3):** the header paints before the flush, the body after; Retry re-requests.

## How to verify (you, in the browser)

1. Start the dev server:
   ```bash
   pnpm start
   ```
2. Open `http://localhost:4101/us/cpa/masterclass`.
3. In DevTools → Network, filter `masterclass`. You should see only the `home-page/?login_type=pre_login`
   call.
4. Check criteria 2–5 on the page.
5. (PR3) Click "i" on the first card, then confirm criterion 6.
6. Sign in and reload. The request becomes `post_login`. I can't do this step: it needs the real SSO.
7. Resize to 375, 768 and 1440 px.

## Risks

- **Contract drift.** UAT and Postman already disagree (the envelope and `cpe_credit`).
  - Mitigation: the parser checks only the fields the page reads, and fails into a visible error state,
    never a half-rendered page.
- **`post_login` is unverified by me.** I can't sign in. Postman B's capture shows the same track shape,
  but 7 tracks, 4 of them empty, with tied priorities. The empty-track skip covers that.
- **The detail page is still broken.** Card click lands on a page that reads the old API by numeric id. It
  is already broken on UAT; F3 fixes it.
- **Visible removals (D2).** The hero slider leaves the page. Make sure that's acceptable before PR2.
- **A course in two tracks** (4 of 64 on UAT) renders in both. `track course.id` is unique within each
  carousel, so this is fine.
- **The `CategoriesList` widening** is the only shared edit. It is type-only, and all seven callers are
  checked by the build.

## Follow-ups (not in MIL-23 unless you say so)

- **F1. Home.** Homepage tracks onto the same `home-page` response. That is when the model moves to
  `core/models/` and the card to `shared/components/cards/` (two features use them).
- **F2. Other rails.** Hero, Continue Watching, Completed and Coming Soon from `highlight_courses`,
  `in_progress_courses`, `completed_courses` and `coming_soon`.
  - Needs: item shapes from the backend, and whether `pre_login` gets a hero list.
- **F3. Course detail page.** Public detail by `slug` from `about-course`; the signed-in part from
  `course-detail/<uuid>/`.
- **F4. Bookmarks.** The toggle route is known: `POST web-api/v1/masterclass/bookmark/<course_id>/`.
  - `IsAuthenticated`; a toggle. 200 `{status, message, bookmarked}`, 404 "Course not found.".
  - **Request:** bearer inherited from the collection, `Accept: application/json` only, no query params,
    and **no body** (confirmed in the collection JSON and the Postman UI, 2026-10-05). The course id
    travels in the path.
  - The docs say "Body template could not be resolved from the code", so an empty body is the best
    reading, not proof.
  - The 200's `bookmarked` is also unresolved (`<existing_bookmark.active>`, presumably a boolean).
  - One signed-in send settles both: send twice, expect `true` then `false`.
  - Through `ApiClient.call()`, then update the course's `is_bookmarked` on the home-page resource in
    place (no refetch).
  - About 120 lines, as a stacked PR4.
  - No web route lists bookmarks (for a "My List" rail).
- **F5. Type guards.** Promote the duplicated guards (webinar and masterclass models) to
  `core/utils/type-guards.ts`.
- **Still open from MIL-13:** webinar `duration_minutes` vs UAT `duration_seconds`.
