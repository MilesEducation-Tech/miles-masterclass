# Facade audit — flows already rebound to the CAIRA UAT API

**Date:** 2026-10-15 · **Asked:** "check if the facade pattern is required or not, and if it is required, check if it's
been used properly" · **Scope:** auth + profile, home, masterclass (home / detail / chapter), CAIRA pages
(`uae-caira`), webinar. Everything else (payment, library, micro-learning, podcast, partners, legal, tracker,
admin) is out of scope by the user's instruction; library is the next rebind.

**Method:** a read-only subagent read every facade in scope, listed its consumers, and checked each against
AGENTS.md §3 (location, route scoping, "components display, facades decide"), §4.1 and §4.2. The lead session
verified the claims marked ✔ at the cited lines. No code was changed by this audit.

**Criteria used.** A facade is _warranted_ when a routed page's components share route-scoped state, business
rules and actions. It is _not_ warranted for a page with one resource and no rules, a component that only needs
inputs/outputs, or a pass-through around one core service. _Proper use_: `@Service({ autoProvided: false })`
listed in the route's `providers`; components inject it directly (the page does not relay inputs/outputs); no
HTTP, business `if`s, dialogs or navigation in components; reads are `httpResource` with `hasValue()` guards and
`isLoading()`/`error()` rendered; mutations via `ApiClient` then `.reload()`; nothing in `shared/` injects one.

## Verdicts

| Facade                                                           | Scope                                           | Warranted?                                                         | Verdict                              |
| ---------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| `features/auth/services/auth-facade.ts`                          | route (`/auth`)                                 | yes                                                                | OK                                   |
| `core/services/account-api`                                      | root                                            | yes, as a core API (not a facade)                                  | OK                                   |
| `core/services/onboarding-api` ✔                                 | root                                            | **no** — one consumer, page state on a singleton                   | fold into a `ProfileFacade`          |
| `features/home/services/home-facade.ts`                          | route (`home`)                                  | marginal — two reads, no actions                                   | decide: holder or facade             |
| `core/services/masterclass-home-facade`                          | root                                            | yes — one 216 KB read shared by home + masterclass                 | OK, two smells                       |
| `offerings/masterclass/services/masterclass-highlight-facade.ts` | route                                           | marginal — one resource, one rule                                  | OK                                   |
| `offerings/services/course-detail-facade.ts`                     | route + dialog providers                        | yes — the reference shape                                          | OK, one dead member                  |
| `offerings/services/chapter-facade.ts` ✔                         | route                                           | yes                                                                | **misused**: rules live in the page  |
| `offerings/services/masterclass-facade.ts` ✔                     | offerings root (one instance for all offerings) | **no** for masterclass — superseded by `CourseDetailFacade`        | scope it to podcast / micro-learning |
| `core/services/feature-facade`                                   | root                                            | not for these flows (zero in-scope pages)                          | out of scope; see cross-cutting      |
| `core/services/section-filters-facade`                           | root                                            | **no** — `ApiClient` pass-through + cache for one shared component | library rebind decides               |
| `features/uae-caira/services/uae-caira-facade.ts` ✔              | route (`home` canMatch)                         | marginal — one read                                                | **misused**: RxJS, no loading/error  |
| `offerings/webinar/services/webinar-facade.ts` ✔                 | route (webinar parent)                          | yes                                                                | **misused**: pages bypass it         |
| `offerings/webinar/services/live-session-facade.ts`              | route (`:id/live`)                              | yes                                                                | OK                                   |
| `offerings/webinar/services/guest-registration.ts`               | route                                           | yes (flow service)                                                 | OK; duplicates OTP logic             |

## Priority 1 — fix while these flows are open

1. **Profile page has no facade and needs one.** `features/auth/pages/profile/profile.ts` (534 lines) injects
   eight services and owns the questionnaire-selection rule (`:171` writes `OnboardingApi.form`, a signal on a
   root singleton ✔), save orchestration with milestone push + token refresh + navigation (`:403-460`), the
   leave dialog (`:477-505`) and error mapping (`:514-532`). → Route-scoped `features/auth/services/profile-facade.ts`
   absorbing `core/services/onboarding-api` (its only consumer is this page).
2. **Masterclass chapter: the page decides, the facade only fetches.** `masterclass-chapter.ts` holds the access
   gate (`:85-102`), next-chapter block (`:127-152`), report navigation (`:163-176`), CPE-upgrade dialog +
   `selectCpeMode` (`:178-226`), the 95 % / 5 % progress thresholds (`:257-277`) and quiz-report dedupe
   (`:74-78`). The template relays 9 inputs / 8 outputs into `app-video-chapter`, while `video-chapter.ts:66` ✔
   injects `MasterclassFacade` — a _different_ instance (provided at `features.routes.ts:158` ✔) that has no
   course loaded and works only because `fetchCourseContent` is stateless. → Move the rules into `ChapterFacade`;
   move transcript/glossary onto `ChapterFacade`; let `VideoChapter` inject `ChapterFacade` **or** stay
   inputs/outputs, not both. Delete the unused `router` in `chapter-facade.ts:30` ✔; type `reportItems: any[]`
   (`:215`); render `loading()`/`error()` in the chapter template.
3. **Webinar pages bypass the facade for registration and join.** `webinar-list.ts:29` and
   `webinar-detail.ts:38` inject `WebinarRegistration` directly ✔ while `WebinarFacade.isRegistering(id)`
   (`:326`) ✔ and `isEmpty` (`:170`) ✔ have no consumers. `onJoin` (join-target → navigate / `window.open` /
   toast) is duplicated in `webinar-list.ts:65-88` and `webinar-detail.ts:89-108`; `webinar-detail.ts:63-74`
   merges feed row + detail row + `eligible` in the page. → `join(id)`, `registeringIds`, `detailFor(id)` on the
   facade; delete the dead members and the page injections.
4. **CAIRA levels section hides loading and failure.** `uae-caira-facade.ts:42` ✔ is `toSignal(forkJoin(…))`
   with `catchError → []`, so `caira-levels-section.html:24-27` shows "coming soon" while loading and on error.
   It still reads legacy `v2/library/` ✔ (not CAIRA UAT). → `httpResource` (one per level or one `resource`),
   render `isLoading()`/`error()`, rebind the path.
5. **Profile-completion dialog is unreachable and writes a legacy route.** `shared/services/engagement-dialog.ts:155-163`
   `resolveNext()` always returns `null` ✔ (a ponytail stub), so `ProfileCompletionDialog` never opens; the
   dialog itself injects `ApiClient` and PATCHes `user/profile/update/` (reported at `:95`), contradicting
   `onboarding-api.ts:12-13` ("`PATCH profile/` is the only write"). → Delete the dialog, `JobSectors` and the
   `saveProfile` route, or rebind through `OnboardingApi.saveAnswers` when engagement dialogs come back.
6. **Legacy route entries still registered for masterclass.** `features/offerings/models/masterclass.model.ts`
   lists `v2/:course_type/details/` (`:67`), `v2/chapters/` (`:72`), `v2/user/myclassactivity/` (`:92`),
   `v2/user/toggle-bookmark/` (`:133`) and `v2/course-content/` (`:141`) ✔; `offerings/utils/course-load.ts`
   still resolves through them. If the chapter page is on the CAIRA web API, these are dead and should go; if
   not, the chapter page is not rebound yet.

## Priority 2 — tidy

- **Home.** Router navigation (`home.ts:94-102`) and dialog opening (`:105-118`) live in the page;
  `home.html:111-115` relays `facade.webinar()` as an input and re-emits two outputs. Either `HomeFacade` owns
  `openWebinar/openTrailer/openCourseInfo`, or it is declared a data-only holder in its doc comment. No
  `isLoading`/`error` surfaced (`home-facade.ts:72-79` logs only) — acceptable, say so.
- **MasterclassHomeFacade.** `fetchOnServer` (`:85`) is set from the `Masterclass` page constructor
  (`masterclass.ts:44`): a page flag on a root singleton. Harmless per request on the server, but read it from
  route `data` or document it as config. Living in `core/` is per the "2+ features → core" rule; consider a
  name without "facade" so the root-facade exception list stays at two.
- **CourseDetailFacade.** `isLoading` (`:217`) has zero consumers (the page uses the `@else` skeleton). Delete
  or render it.
- **MasterclassFacade.** `course-chapter-list.ts:34` and `course-resources.ts:23` still inject it though no
  masterclass page renders them; `course-resources.ts:82` has `resource: any` and `:92` a raw `window.open`
  (banned, §4). Podcast/micro-learning rebind territory.
- **SectionFiltersFacade.** Only consumer is `shared/components/carousel/carousel.ts:105`; `clear()` (`:75`) is
  dead; it hits legacy `v2/filters/` (`:54`) ✔ with a hand-rolled Observable cache (`:34-85`). Not a facade: fold
  into the carousel or a `shared/services` helper during the library rebind, and let `httpResource` replace the
  cache.
- **FeatureFacade.** Zero in-scope pages use it. Shared cards inject it (`cards/hover.ts:33`,
  `horizontal.ts:41`, `vertical.ts:30`) — `shared/` should stay inputs/outputs; `getAbout` is all they need. It
  is ~900 lines on the legacy-`any` list. Belongs to the micro-learning/podcast rebind.
- **OTP duplication.** Send / cooldown / ticker / failure mapping exists twice: `auth-facade.ts:124-168,474-503`
  and `guest-registration.ts:70-100,194-225`. The shared half belongs in core (`AuthSession` or
  `core/utils/otp-cooldown`).
- **Hybrid components.** `HomeWebinarTicket`, `WebinarHero` and `WebinarCard` take inputs, emit outputs _and_
  inject a facade (hero `:70,74`, card `:56,64`, for `loginType()`). Pick one shape per component.

## Also checked, no issues

`AuthFacade`, `LiveSessionFacade`, `GuestRegistration` in isolation; `MasterclassHighlightFacade`. All in-scope
reads except `UaeCairaFacade` are `httpResource` fields with `hasValue()` guards and boolean `isAuthenticated()`
gates (`account-api.ts:45`, `masterclass-home-facade.ts:71`, `course-detail-facade.ts:120`,
`webinar-facade.ts:76`). No feature imports another feature; home reaches the offerings dialog through the
`MASTERCLASS_COURSE_INFO_DIALOG` token (`app.config.ts`), which is the right way.

## Open questions

1. Is `MasterclassFacade` at the offerings root (`features.routes.ts:158`) intentional for podcast /
   micro-learning cross-page sharing, or a leftover? Treated here as a scoping finding for masterclass only.
2. `AuthFacade.validateHttp` POSTs `auth-identify/` through `apiUrl()` (`auth-facade.ts:317-335`) rather than
   `ApiClient.call()`. Interceptors still apply and it is a validator, not a mutation — acceptable?
3. Are the hybrid input + output + facade components (item above) the intended "feature component that looks
   shared" shape, or should they be normalised?
