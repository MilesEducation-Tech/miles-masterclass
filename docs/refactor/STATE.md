# Refactor state

Cross-session handoff. Claude updates "Now", the trackers, open questions and the step log.
The user owns the "Decisions" section.

Status legend: ⬜ not started · 🟡 in progress · ✅ done (verified, reported) · ⛔ blocked · ⏸ awaiting decision

## Now

- 🔧 **2026-09-25, NON-REFACTOR HOTFIX — Vercel deploy was failing, no refactor phase moved, no `src/`
  change.** The deploy aborted with `Node.js version v24.14.1 detected. The Angular CLI requires a
minimum Node.js version of v22.22.3 or v24.15.0 or v26.0.0` (exit 3). Read `node_modules/@angular/cli/bin/ng.js:58-73`:
  the check is a **hard abort with no env override** — only majors 23/25 get a warning-and-continue.
  Cause: nothing in the repo pinned Node (no `engines`, no `.nvmrc`), so Vercel used its default 24.x,
  whose image sits at **24.14.1 — one patch below the CLI floor**. Vercel only lets you choose a
  **major** and picks the patch itself (docs confirmed), so `24.x` cannot fix this; Node 22's latest is
  **22.23.3**, well past the 22.22.3 floor. **Fix: `engines.node: "22.x"` in `package.json`** (overrides
  the dashboard setting) **+ `node -v` echoed at the top of `vercel.sh`** so the next deploy log proves
  the patch instead of us guessing. ⚠️ **Unverified from inside the repo:** Vercel's exact 22.x patch —
  only a deploy shows it. If it lands below 22.22.3, the fallback is installing Node inside `vercel.sh`.
  `.github/workflows/ci.yml` uses `node-version: 22`, which resolves to latest 22, so **CI was never
  affected**. ❓ **Left for the user:** the failing log line was `pnpm run lint`, but `vercel.json`'s
  `buildCommand` is `sh vercel.sh` and never lints — something outside `vercel.json` (a dashboard Build
  Command override?) is running lint on Vercel. Flagged, not touched.

- 📌 **2026-09-24/25, SEPARATE TRACK — NOT REFACTOR WORK. Phase 9's state below is UNCHANGED.**
  A session was spent planning the **engineering enforcement harness** (git workflow / GitHub setup /
  versioning), written to [`prompts/engineering-enforcement-harness.md`](../../prompts/engineering-enforcement-harness.md).
  Nothing under `src/` was touched and no refactor phase moved. Recorded here only because the stop gate
  fires on any file change, and because **one measurement in it contradicts `AGENTS.md` and matters to
  this refactor**: all five gates are GREEN today — `lint` 0, `ng test --watch=false` 0
  (**163 files / 554 passed + 1 skipped**, matching Phase 9's recorded numbers exactly), `format` 0,
  `build:prod` 0, `build-storybook` 0. `AGENTS.md` §9's "lint and test are already red from
  pre-existing debt" is **stale** and is queued for correction in that plan's Phase 6.
  ⚠️ Those verification runs regenerated `public/version.json` + `core/version/app-version.ts`; the guard
  hook blocks me from restoring them, so the user was asked to `git checkout --` both.
  **Two decisions the user locked there (2026-09-24):** keep `master` (docs get corrected, no rename),
  and gitignore the two build-generated files behind `pretest`/`prelint` hooks.
  **2026-09-25 — that plan's PHASE 0 IS WRITTEN (uncommitted):** `docs/engineering/{git-workflow,github-setup,versioning}.md`,
  1,119 lines, which **fixes the two dangling `docs/engineering/*` links in `CLAUDE.md`** (verified: both now
  resolve). Corrections applied vs the source docs: `main`→`master` throughout, `@ms-sachin-singh`→
  `@me-sachin-singh` (the docs were wrong, `.github/CODEOWNERS` was right), duplicate §10 renumbered to
  §10/§11, and the `APP_BUILD` `--define` passage rewritten to document the `app-version.ts` mechanism that
  actually ships. Every not-yet-wired item is marked `TODO` so the docs don't describe fiction as fact.
  Prettier clean. **No `src/` change, so lint/test/build were not re-run for this — nothing they cover moved.**

- 🏁 **PHASE 9 (data layer) IS DONE AND CLOSES ✅ — all five steps (0–4).** Report:
  [phase-09-core-shared](reports/phase-09-core-shared.md).
  `reviewer` **PASS twice, zero violations** (once over steps 0–3, once over the step-4 diff, the second
  verified against the installed Angular 22.0.8 source rather than from memory).
  Tests **163 files / 554 passed + 1 skipped** (baseline 160/519).
  **UNCOMMITTED: 16 files — 12 modified, 4 new.** Commit message in §5 of the report.
  Exclude `public/version.json` + `core/version/app-version.ts` (build-generated, already restored).
- ⏸ **`verifier` 7/8 GREEN — `ssr smoke` IS RED, AND IT IS A STALE BASELINE, NOT THIS WORK.**
  Steps 0–3 alone reached all 8 green; the red appeared on the step-4 run, so it was chased rather than
  accepted. Two routes differ from `baseline/ssr.json`: `partners/cpacanada` renders the **real** CPA
  Canada SEO copy where the baseline holds the generic brand fallback, and `masterclass/154/...` renders
  `{{title}} | Master Class | Miles Masterclass` where the baseline holds bare `{{title}}`.
  ⚠️ **MY FIRST HYPOTHESIS WAS WRONG AND IS RECORDED AS SUCH.** I guessed a timeout race in
  `SeoManager.loadFromSupabase` (`TIMEOUT_SERVER_MS = 4500`, with a brand-default fallback — mechanically
  real). It is **not** that: the failure is **deterministic**, identical across 3 harness runs and 5
  direct `curl`s of the built server. Four facts settle attribution:
  **(1)** both diffs go the wrong way for a regression — the renders contain _more_ correct SEO data, and
  a regression loses data rather than inventing correct partner copy;
  **(2)** `git diff 07afb23..HEAD` over `core/services/seo`, `shared/utils/seo`, `features/partners`,
  `features/offerings/masterclass` and `app.ts` is **EMPTY** — the baseline was recorded at `07afb23` and
  the SEO code is byte-identical to the code that produced it;
  **(3)** nothing in this phase's diff is reachable from the SEO path (grep-confirmed, all 7 files);
  **(4)** `{{title}}` is still unresolved, i.e. the documented pre-existing course-API condition.
  **So `ssr.json` captured a render in which two Supabase `seo_pages` rows had not resolved.** What I
  could not establish from inside the repo is _when_ those rows were last edited — a data question.
- ✅ **PHASE 9 CLOSES ✅ ON YOUR DECISION (2026-09-24), with `ssr smoke` red.** Recorded plainly so the
  next reader is not misled: PROMPT.md §6 asks for a full green run and this phase does **not** have one.
  You closed it ✅ anyway because the single red gate is a **stale recorded baseline**, not a defect —
  proven four ways (§2 of the report). This is the deliberate opposite of the Phase 7 call, where the red
  was a real, unexempted lint violation. **The distinction is the evidence, not the colour of the gate.**
- ⏸ **STILL OPEN, and NOT closed by the ✅ above: re-record BOTH baselines.** `bundle.json` predates the
  blog removal (phantom −13 KB); `ssr.json` predates two Supabase `seo_pages` rows resolving. Only you
  can record them. **Every future phase will keep reporting a phantom bundle win and a red `ssr smoke`
  until you do**, and the next genuine SSR regression will be indistinguishable from this known noise.
- 📉 **THE BUNDLE'S −13 KB GZIP IS NOT THIS PHASE'S — do not credit it to Phase 9.** The harness reports
  initial gzip 102.3 → 89.2 KB (−12.8%) against the recorded baseline, which is far too large for a
  data-layer change. Attributed with a clean `git worktree` build of `HEAD` measured by one identical
  script: **`HEAD` = 454.7 KB raw / 88.1 KB gzip; working tree = 454.6 / 88.0. My delta is −0.1 KB.**
  The whole drop belongs to the other session's commits, overwhelmingly the blog removal — `styles.css`
  went ~380 → 298.4 KB raw, and its content hash `styles-L2LIUX2D.css` is **identical** between `HEAD`
  and my tree, which proves I did not touch it. `main.js` is 91.6 KB in both.
  (Superseded by the combined baseline decision above — it now covers `ssr.json` too.)

- 🟡 **PHASE 9 (data layer) — scope `core/services` + `shared/services`
  (+ `shared/components`, `shared/dialogs`), on your decision, NOT `features/blog`.**
  Plan: `~/.claude/plans/9-moonlit-lecun.md`. **Baseline re-taken at `890e52d`: `lint` exit 0,
  `test` 160 files / 519 passed + 1 skipped.**
  ⚠️ **HEAD MOVED MID-PLANNING.** Four commits landed on this branch from another session
  (`49fc0a8` onboarding gate, `42dabf8` `shared/ui/select`, `6b4adff` profile-questionnaire rebuild,
  `890e52d` blog removal). All committed, tree clean, nothing stranded — but the baseline was
  re-measured and **all nine Phase 9 target paths were re-diffed against the new HEAD and come back
  untouched**. `account-api.ts:43,47` and `auth-session.ts:85` were re-read rather than trusted:
  the boolean-gate idiom this phase copies survives `6b4adff` intact.
- 🔎 **THE FINDING THAT RESHAPED THE PHASE: `shared/services/**` has ZERO `httpResource`
  candidates**, and the tracker rows that own the real work did not exist.
  Its five HTTP calls are three POSTs and two GETs, and **both GETs are click-triggered one-shots**:
  `claimBadge()` is a side-effecting claim wearing a GET (three consumer shapes — raw Observable,
  `firstValueFrom`, `.subscribe`), and `openAdditionalResources()` **is** the click, existing only to
  open a dialog on completion. Converting either would claim badges on render and re-open dialogs on
  refetch. Meanwhile `caira-level-stack:139` and `surround-carousel:129` — in `shared/components`,
  which had **no row at all** — are already `resource()` wrapping `firstValueFrom(api.get(...))`,
  precisely what PLAN.md §5 calls "the direct `httpResource` conversions". Hence the two new rows.
- 🚨 **`FeatureResource` hardcodes `isAuthenticated` to `false` (`feature-facade.ts:109`), so every
  `{requiresAuth: true}` resource returns `[]` WITHOUT ISSUING A REQUEST.** That is seven carousel
  keys dead today — `inprogress`, `lastViewed`, `bookmark`, `completed`, `recommended`,
  `complimentary`, `becauseYouWatched` — across masterclass, podcast and micro-learning. Roughly half
  the GET surface of the file. **Your decision: re-wire it to `AuthSession.isAuthenticated()`**, which
  becomes the `httpResource` request-function gate. **This is a visible behaviour change and the
  phase's main QA risk.** `footer-overlay.ts:100` hardcodes `isLoggedIn = signal(false)` the same way
  and must be checked, not assumed separate.
- ⚠️ **`CartStore` conversion carries a specific deadlock trap, recorded so it is not rediscovered.**
  `payment-guard.ts:40` reads `loading()` **synchronously** (`if (!facade.loading()) return
checkCartState()`), and **`httpResource().isLoading()` is `false` before the request fires** — a
  naive swap makes the guard read "not started" as "finished", which is exactly the deadlock
  `cart-store.ts:38`'s own comment warns about. **The fix is `status()`, not `isLoading()`**: it
  distinguishes `idle` from `loading`, which the boolean cannot. `cartResolver`'s wait must filter on
  `'resolved' || 'error'` — omitting `'error'` hangs route activation forever on a failed cart.
- ⚠️ **Three spec files change MEANING, not just shape.** `surround-carousel.spec.ts` (160 lines)
  mocks `ApiClient` and asserts endpoint + params — `httpResource` goes through `HttpClient`/
  `HttpBackend`, so that mock stops observing anything and must move to `HttpTestingController`.
  `caira-level-stack.spec.ts` (22 lines) provides **no HTTP at all** and passes only because the
  resource errors and `hasValue()` swallows it, so it currently tests `FALLBACK_LEVELS` and nothing
  else. `feature-facade.spec.ts` is a 16-line smoke test — a 724-line file with 21 importers and 29
  `getResource()` call sites has **zero** HTTP coverage.

- 🔎 **STEP 1 FINDING 1 — `defaultValue` does NOT make `value()` safe. It still THROWS in the error
  state.** This is the single most important thing to carry into steps 2–4. A `defaultValue` covers
  `idle` and `loading` only; on an errored resource `value()` throws, so
  `computed(() => res.value()?.data ?? [])` **throws inside the template** on a 500 — a straight
  regression against the `catchError(() => of([]))` it replaces. **Every converted read needs BOTH a
  `defaultValue` and a `hasValue()` guard.** I shipped the unguarded version first and the new spec
  caught it; `caira-level-stack` already carries both, which now reads as deliberate rather than
  redundant. PROMPT.md §4.2 says "guard every `.value()` read with `.hasValue()`" and it means it
  even when a default is set.
- 🔎 **STEP 1 FINDING 2 — the repo's spec settle idiom is INSUFFICIENT for asserting a flushed
  value.** `account-api.spec.ts` uses `void res.value(); TestBed.tick();` and that is fine _there_
  because it only ever asserts request counts and `hasValue() === false`. `TestBed.tick()` is
  synchronous while a resource applies its response on a microtask, so a tick-only settle sees the
  `defaultValue` and never the flushed payload — five of my seven tests failed on exactly that before
  the cause was found. **The settle that works is `await TestBed.inject(ApplicationRef).whenStable()`**
  (there is no `TestBed.whenStable()` in 22.0.8 — it does not compile). Proven with a throwaway probe
  spec before trusting it. Use this in steps 2–4 and in the `FeatureFacade` tests.

- 🔎 **STEP 4 FINDING 1 — I SHIPPED A REAL DEFECT AND THE NEW TESTS CAUGHT IT: you cannot accumulate
  by mutating a Map inside a signal computation, because a computation is LAZY.** The first draft filed
  each settled page into the existing `pages` Map from inside the `items` computation. Two tests failed:
  if nothing read `items()` between page 1 settling and page 2 arriving, page 1 was **never folded in
  and was silently lost**. Rewritten to accumulate through the computation's own `previous` value —
  page 1 replaces, later pages append — which has no such hole and **deletes the `pages` Map and
  `flattenPages()` outright**, because `patchItems`/`prependItem` writes simply _are_ `previous.value`.
  Net: simpler and more correct than what it replaced. One standing constraint: a non-first page must
  never be re-requested for the same page number or its rows would append twice; nothing does, since
  every refetch path resets to page 1 first.
- 🔎 **STEP 4 FINDING 2 — `refresh()` needs two different mechanisms and one of them is a trap.**
  A resource refetches only when its request OBJECT changes, so the old `refreshTrigger` counter would
  be _tracked and then ignored_ by a request function — it cannot force a refetch. The non-track path
  calls `reload()` instead, and **only when the page did not actually change**, because a real page
  change already produces a different request and doing both would fire two requests per refresh.
  The track path keeps the counter, since its `combineLatest` does re-emit on it.
- 🐛 **STEP 4 FINDING 3 — a faithfulness gap I nearly shipped: an errored resource must count as
  SETTLED WITH NO ROWS, and must clear `paginationData`.** The old pipeline's
  `catchError(() => of({ data: [], pagination: undefined, ... }))` cleared pagination on failure.
  Treating an error as "not settled" instead leaves the previous pagination in place, and a stale
  `next_page` means an infinite-scroll container **keeps asking for the page that just failed**.
  Caught by re-reading my own diff, not by a gate; now explicit in `listSnapshot` and pinned by a test.
- 🐛 **STEP 4 FINDING 4 — MY OWN STEP-2 TEST STUB WAS LEAKING GLOBALLY and only step 4 exposed it.**
  `caira-level-stack.spec.ts` called `vi.stubGlobal('matchMedia', ...)` with no restore.
  `vi.stubGlobal` writes `globalThis`, which outlives the file, and `core/services/viewport` is also
  backed by `matchMedia` — a stub answering `matches: false` to every query makes `Viewport` resolve to
  `mobile`, which broke `section-nav.spec.ts`'s header-docking test. It passed in steps 2 and 3 purely
  by execution order; changing `feature-facade.ts` reshuffled that order and surfaced it. Fixed with
  `afterEach(() => vi.unstubAllGlobals())` and a comment naming the trap. **Suite re-run twice to
  confirm stability, not once.** Lesson for the remaining phases: a global stub in any spec is a
  cross-file hazard, and a green suite is not proof it is absent.

### Phase 9 steps

- [x] **Step 0 — tracker repair (docs only).** Added `shared/components` + `shared/dialogs` rows;
      **removed the `features/blog` row** (the module is gone as of `890e52d`, so PLAN.md §13 row 2
      and PLAN.md §5's `blog-api.ts` claim are both stale); marked the four in-scope rows 🟡.
- [x] **Step 1 — `JobSectors` → `httpResource` + a new 7-test spec.** `toSignal` +
      `map`/`catchError`/`shareReplay` + `Logger` collapsed to one resource with a `defaultValue`;
      `ApiClient` dropped entirely (`apiUrl` is a free function, so the injection was dead).
      `sectorOptions`/`rolesFor`/`resolveIds` byte-identical, so the one consumer
      (`profile-completion-dialog`) is untouched. Gates: tests **161 files / 526 passed + 1 skipped**
      (+1 file, +7 tests), `tsc --noEmit` 0, `lint` 0, `format` clean.
      🔎 **Two findings worth more than the conversion, both caught by the new tests:** see the two
      bullets under "Now".
- [x] **Step 2 — `shared/components` rendered reads: 3 conversions, 3 specs, all green.**
      2a `caira-level-stack`, 2b `surround-carousel`, 2c `course-related-section` related read only.
      Each dropped a `resource()` + `firstValueFrom` + `takeUntil(abortSignal)` + `ApiClient`
      injection for one `httpResource`; 2c additionally **deleted an `effect()` + `.subscribe()` +
      `signal.set()`**, which is the §4.2 pattern this phase exists for.
      ⚠️ **`shared/dialogs` turned out to have nothing to convert** — `ai-lab-agent-dialog` is
      blocked on `this.data` being assigned after construction, `certificate-download-dialog` is
      POST + blob, `profile-completion-dialog` is PATCH. So the new `shared/dialogs` tracker row is
      correct to exist but has no Phase 9 work; it is marked ✅-by-vacuity at close, not skipped.
      **`course-related-section.ts:131` (instructor `forkJoin` fan-out) deliberately NOT converted**
      — one `httpResource` is one request and N is only known at runtime. `catchError`/`of`/
      `takeUntilDestroyed`/`Logger`/`ApiClient` all remain in that file _because_ of it.
      Tests **162 files / 534 passed + 1 skipped**; `tsc` 0, `lint` 0, `format` clean.
      🔎 **Three spec lessons, all of which cost a red run first:**
      (1) **Never `await whenStable()` before flushing** — with a real `HttpClient` the pending
      request means the app never stabilises and the await hangs to timeout. `caira-level-stack`'s
      old suite could only await freely because it had **no `HttpClient` at all**.
      (2) `surround-carousel`'s `ApiClient` mock **stopped observing anything** the moment the read
      became an `httpResource`; every assertion would still have passed. Ported to
      `HttpTestingController` with `match(() => true)`, which proves exactly one request was made
      rather than trusting a predicate that can quietly match zero.
      (3) Counting rendered `app-horizontal`/slide elements counts **zero** regardless of data —
      `app-carousel` fills itself via swiper + `ng-template`, neither of which runs in jsdom. Assert
      on what the carousel is _handed_ instead.
- [x] **Step 3 — `CartStore` → `httpResource`, + an 8-test spec it never had.**
      `cartData` is a `linkedSignal` over the resource (writable, because
      `PaymentFacade.setCartData()` pushes coupon/checkout responses in with no refetch);
      `loading`/`error`/`cartFetched` are `computed()` off it. Tests **163 files / 542 passed**,
      `tsc` 0, `lint` 0, `format` clean.
      🚨 **THE GATE IS LOAD-BEARING — do not "simplify" it away.** An `httpResource` whose request
      function returns a URL is in the **`loading` state from construction** (measured with a probe,
      not assumed). An ungated cart resource would therefore fire an **authenticated `mybucket`
      request the moment anything injected `CartStore`** — which includes `Utils` (64 importers) and
      `footer-overlay`, i.e. **every page in the app**. A private `wanted` signal keeps the request
      function returning `undefined` (idle, no request) until a caller actually asks, which is
      exactly what the old imperative `loadMyBucket()` did.
      ✅ **The resolver needed NO rewrite, and that is a measured result rather than a hope.** Two
      facts make the existing `toObservable(loading).pipe(filter(l => !l), take(1))` faithful:
      `reload()` flips status to `reloading` **synchronously**, and opening the `wanted` gate flips
      `loading` to `true` **synchronously** too (`immediately-after-first-call:loading=true`). So the
      resolver cannot sample a stale settled state and wave a deep link through with an unloaded
      cart. The reasoning is recorded at the call site; the plan's fear that `isLoading()` would be
      `false` before the request fired was **wrong**, and only a probe could have shown that.
      🚨 **UNPLANNED FINDING, caught by `tsc` and worth the whole step: `PaymentFacade.loading` and
      `.error` were NEVER cart-only.** The facade _writes_ them for `proceedToPayment()` and
      `loadOrderById()` — operations with nothing to do with the cart bucket. Once `CartStore`'s half
      became derived (read-only), 8 assignments failed to compile. Fixed by giving the facade its own
      `opLoading`/`opError` and **OR-ing them with the cart's**, which preserves today's behaviour
      exactly: `paymentGuard`/`cartResolver` wait on `loading`, so today they also wait out a checkout
      POST. Deriving `loading` from the cart alone would have silently stopped that — a behaviour
      change smuggled in by a refactor. If that wait is unwanted, it is a separate decision.
      ⚠️ **Still needs your manual QA — the gates cannot see checkout.** Add to cart → drawer →
      `/payment/cart` → `/billing` → `/review`, and a **hard refresh directly on `/payment/billing`**.
- [ ] **Step 4 — `FeatureFacade`:** 4a re-wire `requiresAuth`, 4b convert the non-track list read,
      4c leave the track fan-out and `getAbout()` on RxJS, 4d `runInInjectionContext` + keep the SSR
      skip, 4e tests after (your decision).
- [x] **Step 4 — `FeatureFacade` DONE.** 422 lines changed in the facade + 295 in its spec.
      4a `requiresAuth` re-wired to `AuthSession.isAuthenticated()`; 4b the non-track list read is an
      `httpResource`; 4c the track fan-out and `getAbout()` stay on RxJS; 4d `runInInjectionContext`
      with the existing `Injector`, SSR skip preserved; 4e **11 `HttpTestingController` tests** where
      there was previously only `expect(service).toBeTruthy()`.
      Tests **163 files / 552 passed + 1 skipped**, `lint` 0, `tsc` 0, `format` clean.
      🚨 **THE BEHAVIOUR CHANGE IS BIGGER THAN "7 KEYS": 15 LIVE `getResource({requiresAuth:true})`
      CALL SITES** — masterclass 6, podcast 6, micro-learning 3 — all of which issued **no request at
      all** before this step. They now fetch for signed-in users. `footer-overlay`'s 16th call site
      stays dead behind its own hardcoded flag (see below). **This is the phase's main QA risk.**
      ✅ **`isLoading`, `items`, `paginationData`, `metadata` are `linkedSignal`, NOT `computed`** —
      they had to stay writable: `applyBookmarkChange()` calls `items.update()` across every loaded
      listing, `adjustBookmarkCount()` writes `paginationData`, and the track pipeline drives all four
      by hand.
      ⚠️ **`footer-overlay.ts:100` is NOT the same problem and was deliberately left alone.** Its
      `isLoggedIn = signal(false)` reads the **removed `Auth` service**, not `AuthSession`, and its
      sibling `subscribed` has no available source at all — re-wiring one without the other would
      change what the overlay renders. That belongs to the `layout` row, not a data-layer phase.
- [x] **Close:** `reviewer` PASS twice (steps 0–3, then the step-4 diff against the installed Angular
      source), report written, STATE.md updated, commit message in §5 of the report. `verifier` 7/8 —
      `ssr smoke` red and **proven** stale: deterministic across 3 harness runs + 5 direct `curl`s, both
      diffs in the _more-correct_ direction, and `git diff 07afb23..HEAD` over the SEO path EMPTY.
      Bundle delta attributed by a clean `HEAD` worktree build, not assumed.
      **Next: `/refactor-phase 9 library` — `features/library` is the next Phase 9 row.**

- 🐛 **OFF-PHASE (2026-09-24, part 6): A11Y HOLE FOUND BY READING THE PRIMITIVES' SOURCE —
  `NgpSelect` is the ONE control primitive that does NOT call `ngpFormControl`.**
  `ngpInput`, `ngpTextarea` and `ngpCheckbox` all do, so inside an `ngpFormField` they pick up
  `aria-labelledby` and `aria-describedby` for free. A select does not: **dropped into a form field
  it announces with NO ACCESSIBLE NAME**, and a `<label for>` cannot rescue it because the trigger
  is a `div` — `for` only binds to a labelable element. The repo's own `aria-multiselect` patches
  this by hand (`[attr.aria-labelledby]`), which is the tell that it has always been missing.
  - `Select` now reads `injectFormFieldState({ optional: true })` and binds `aria-labelledby` /
    `aria-describedby` from the field's registered labels and descriptions. Optional on purpose —
    the control still works standalone, and then naming it is the caller's job.
  - `profile.html` now picks the label ELEMENT by control kind: a real `<label ngpLabel [attr.for]>`
    for the native ones (input/textarea/number/date) and a plain `<span ngpLabel>` for the widget
    ones (select, checkbox), so nothing claims an association the DOM would not honour.
  - A host-component spec proves it: `role="combobox"`, `aria-labelledby="intent-label"`,
    `aria-describedby="intent-help"`. 160 files / **519 tests** pass, build green, eslint clean.
  - Considered and rejected: moving `ngpSelect` onto the component's host element via the
    `ngpSelect()` composable + `ngpFormControl()`, which is the library's "reusable component"
    pattern. It would have bought the same naming plus `data-invalid`/`data-touched`, but
    `ngpFormControl` also binds `aria-invalid` from `controlStatus()`, and `controlStatus()` only
    understands `NgControl` — **it knows nothing about signal forms** — so it would have fought this
    control's own `aria-invalid` binding for an attribute it can never populate. Noted here so the
    next person does not "fix" it that way.

- 📌 **OFF-PHASE (2026-09-24, part 5): the select is now ONE REUSABLE CONTROL —
  `shared/ui/select/` (`Select`, `app-select`) — and TWO REAL DEFECTS behind "options not coming
  properly" are fixed, both of them already documented in this repo's own code.**
  - 🐛 **The prune race.** `ngpSelect` PRUNES any value it cannot find among the rendered options and
    emits the pruned result. On a server-driven form the options come from `questions/` and the value
    from `profile/` — two resources — so a seeded answer that arrives first emits back as `null`/`[]`
    and **silently erases itself**. `aria-multiselect.ts:113` carries the same guard with the same
    comment; my inline markup had none. Now carried over, with a test.
  - 🐛 **Duplicate option values.** `@for (... track option.value)` THROWS NG0955 on a repeated key,
    which takes the whole dropdown down — `dedupeAriaOptions` exists in `core/models/aria.model.ts`
    for exactly this. `Select` dedupes (first wins), with a test.
  - ⚠️ **`required()` DOES NOT FIRE ON AN EMPTY ARRAY.** Read from the installed runtime, not
    assumed: `isEmpty` is `'' | false | null | undefined | NaN`, so `[]` is NOT empty to it. Every
    multi-value field therefore needs `required()` for the REQUIRED metadata (that is what puts
    `aria-required` on the control through `[formField]`) **plus** an explicit `validate()` that
    actually fires. Both are in `profile.ts` now with the reason written next to them.
  - Also learned the hard way, recorded so the next spec does not lose an hour: **jsdom's selector
    engine is case-SENSITIVE about attribute names** (`[ngpSelectOption]` matches nothing; use
    `[ngpselectoption]`), and the **portal lands on a macrotask** — `whenStable()` is not enough, the
    test must `setTimeout` before it can see the options.
  - **8 tests in `select.spec.ts` prove it against the real DOM**: options render in order, a click
    commits a LIST, labels show (single and multi), duplicates drop, a seeded value survives a prune,
    a rendered value can still be deselected, touched flips on close. Stories cover single, multiple,
    preselected, disabled, empty and a signal-forms demo.
  - `profile.html` now uses `<app-select [formField]="field.choices" />` for both select kinds; the
    inline `ngpSelect` markup is gone. `build:prod` green, eslint clean, 160 files / 518 tests pass.
  - ⚠️ **STILL NOT SEEN IN A BROWSER.** The Browser pane refuses `localhost:6006` and the launch
    config it would need is harness-owned, so the visual check is the user's:
    `pnpm storybook` then **UI/Select**. Everything above is proven by the DOM in tests, not by eye.

- 📌 **OFF-PHASE (2026-09-24, part 4): the profile form's controls are now RAW ng-primitives — the
  `app-aria-*` wrappers are gone from this page** (`profile.html` rewritten, `profile.ts` imports
  swapped). `NgpFormField`/`NgpLabel`/`NgpDescription` + `NgpInput`, `NgpTextarea`, `NgpCheckbox`,
  `NgpSelect`(+`Dropdown`/`Option`/`Portal`), plain Tailwind, no floating labels, no `app-forms`
  wrapper (a plain `<form (submit)>`).
  **SCOPE: this page only. 52 other files still use `shared/ui/aria/*` and were NOT touched** —
  ripping those out repo-wide is its own change, not a rider on the questionnaire work.
  ⚠️ **ng-primitives 0.131.0 has NO signal-forms integration** — no `FormValueControl`, nothing that
  accepts `[formField]` (checked the installed types, not the docs mirror). So the binding splits in
  two, deliberately: native elements (`ngpInput`, `ngpTextarea`) take `[formField]` straight from
  `@angular/forms/signals`, while `NgpSelect` and `NgpCheckbox` bind to the field's own
  `WritableSignal` — `[(ngpSelectValue)]="field.choices().value"`. That works because `FieldState.value`
  IS writable; it is the documented hand-off point, not a workaround.
  Model slots renamed `value`/`values` → `text`/`choices` so the template reads `field.text().value`
  instead of the unreadable `field.value().value`; **a single-select now shares the `choices` slot**
  with multi (one key, `ngpSelectMultiple` off), which also collapsed two serializer branches into one.
  ⚠️ **`label-has-associated-control` fired and was fixed properly, NOT disabled**: `NgpLabel` does set
  `for` (and `aria-labelledby`) at runtime — `attrBinding(element, 'for', htmlFor)` in the installed
  source — but the linter cannot see it, so every control now carries `[id]="question.code"` and the
  label binds the same id. The association is now true both statically and at runtime.
  Verified the three non-obvious Tailwind classes actually emitted into the built CSS
  (`w-(--ngp-select-width)`, `z-1001`, `data-hover:` variants) rather than silently compiling to nothing.
  `build:prod` green, eslint clean, `pnpm test` 159 files / 509 passed + 1 skipped.
  **NOT verified in a browser: this page needs a live session and the API, so the rendering and the
  dropdown behaviour are unproven.**

- ⚠️ **NOT MINE, FLAGGED NOT TOUCHED: the whole `features/blog` tree (35 files) is DELETED in the
  working tree and the `blog-test` route + its eager `BlogLayout` import are gone from
  `app.routes.ts`.** This appeared DURING the 2026-09-24 off-phase session, between two `git status`
  runs, and none of it is my edit — likely a concurrent session starting Phase 9 (blog). I have not
  restored or committed any of it. **Phase 9 starts from a tree that already lost blog; decide
  whether that is intended before committing anything.**
  It also explains a bundle number: initial total is now **1.92 MB, under the 2.00 MB budget**, down
  from 2.06 MB — that drop is the blog removal (the eager `BlogLayout` import), NOT the auth work.

- 📌 **OFF-PHASE (2026-09-24, part 3): the profile/onboarding form is now SERVER-DRIVEN END TO END
  and built on signal forms.** `profile.{ts,html}` rewritten, `profile.spec.ts` added (6 new tests).
  **Every field comes from `GET questions/` and nothing else** — the hardcoded identity block
  (first/last name, email, phone, city, location) is GONE, which also settles the duplicate-field
  problem logged in part 1: the questionnaire already serves `first_name` / `last_name` / `email` as
  questions. `user_details/` is no longer a second form; it only SEEDS blanks (so a learner whose
  name the SSO knows is not asked twice) and takes back the four codes that are also writable columns.
  Model is one row per question with three typed slots (`value` / `values` / `flag`) rather than one
  `AnswerValue` union — a field binds to a CONTROL, and a multiselect needs `string[]` while a
  checkbox needs `boolean`, so a union would need a cast at every binding.
  Schema is `applyEach` over the array, and **every rule joins back to its question through the row's
  own `code`, not the item index** — `index` exists only on the ITEM context, not on its children
  (the compiler caught this), and the code survives re-ordering anyway.
  `is_required` → `required`/`validate`; `parent_question` → `hidden`, which matters because **a
  hidden field does not contribute to its parent's validity** — a required question the learner
  cannot see therefore cannot block submit. Nothing is required on `flag`: `false` IS an answer.
  Dirty tracking is now `form().dirty()`, replacing the hand-rolled JSON diff.
  `pnpm test` 159 files / **509 passed** + 1 skipped; `build:prod` green; eslint clean on the
  changed trees.

- 📌 **OFF-PHASE (2026-09-24, part 2): the onboarding GATE now runs on `is_onboarding_completed`,
  the only access restriction taken off `GET user_details/`** (the user supplied a real payload for
  that route too). 4 more files: `auth-session.{ts,spec.ts}`, `account-api.ts`, `profile.ts`.
  `AuthSession` keeps `isOnboardingCompleted` and `isProfileCompleted` as `boolean | null` signals —
  `isProfileCompleted` is CARRIED, NOT GATED ON, by the user's decision, for a future rule.
  `needsOnboarding` is now `isAuthenticated() && isOnboardingCompleted() === false`: **only a known
  `false` redirects**, because `null` (nobody has said yet) must not bounce a learner who finished
  onboarding months ago and merely lost the `userData` cookie. Three specs pin exactly that
  (503 passing now, was 500).
  The flags are SEEDED from the session's `profile_status` so a reload gates before any request goes
  out, then overwritten by the row — `AccountApi` pushes them in an `effect`, because `AuthSession`
  cannot read the row itself (`AccountApi` injects it, so reading back would be a DI cycle).
  `profile.ts` also pushes the milestones off the `PATCH profile/` response before navigating, so the
  redirect cannot race the row reload and re-trigger `onboardingGuard`.
  `onboardingGuard` itself is UNCHANGED and rule 4 still holds — this is the milestone, never the
  token's `miles.onboarding_required` claim.
  **The real `user_details/` payload also corrected the model: `id` is a UUID STRING, not a number;
  `middle_name` and `tags` come back `null`.**
  Bundle: initial overage 56.63 → 57.44 kB, so **+0.81 kB, mine** — `AuthSession`/`AccountApi` are in
  the initial chunk. Budget was already exceeded before this change.

- 📌 **OFF-PHASE (2026-09-24): the onboarding/profile questionnaire was retyped against a REAL
  `GET questions/` payload the user supplied.** Not a refactor phase, not part of Phase 8's change
  set — 3 files, on top of the uncommitted Phase 8 work: `core/models/account.model.ts`,
  `features/auth/pages/profile/profile.{ts,html}`.
  The `Question` interface had been guessed from contract prose (the route is 403 without a token and
  the collection ships no examples) and was **wrong on every field that matters**: `question` not
  `label`, `answer_format` not `type`, `section` is `''` not `null`, options are
  `{ text, value: string[] }` not `{ id, label, value }`, plus `id`, `help_text`, `placeholder`,
  `validation`, `parent_question`, `parent_answer_value`. `controlOf`'s substring guessing is now an
  exact `answer_format` switch, and the old ponytail comment saying "tighten this the first time a
  live payload is available" is discharged.
  **Option values are LISTS even for `single_select`**, so a select answer PATCHes back verbatim
  (`user_intent: ["licensed_accountant"]`); the aria controls take a joined key and the option is
  **looked up** by it, never split.
  Two judgement calls flagged to the user, both unconfirmed: (1) `first_name`/`last_name`/`email`
  arrive as questions AND are rendered by the identity block, so they render once and are submitted
  as answers from the user row — without that, two REQUIRED onboarding questions could never be
  answered and the milestone would never advance; (2) `parent_question` gating is implemented from
  inferred semantics (every sample value is `null`), and an unresolvable parent SHOWS the child so a
  wrong read cannot make a question unanswerable.
  `build:prod` green, `pnpm test` 158/500+1 (baseline match), eslint clean on the changed files.
  Bundle budget warning is pre-existing — **verified by stash-building HEAD: identical 56.63 kB
  overage**, so this change moved nothing.

- 🏁 **PHASE 8 (services) IS DONE AND CLOSES ✅.** Report: [phase-08](reports/phase-08.md).
  **`pnpm lint` is fully green** — all 8 Phase 7 boundary violations cleared, so §6's "full green run"
  is reachable and the ⛔ recorded earlier no longer applies.
  `verifier` **GREEN** (6/8, both reds pre-existing); `reviewer` **PASS, zero violations**.
  **UNCOMMITTED: 100 files — 82 modified, 16 renamed, 2 deleted.**
  One session, whole repo, on your scope decision.
  Plan: `~/.claude/plans/8-optimized-pond.md`. Part B's "one feature per session" cadence does **not**
  work for this phase and the tracker proves it: `core/services` (26 files) and `shared/services` (3)
  have **no Part B tracker row at all** — 29 of 60 files, 48% of the work, owned by no session — and
  bullet 4's lint rule is repo-wide, so per-feature would leave it unenforceable until session 12.
  All 12 Phase-8 cells close together. **Phase 14 must fix the tracker table.**
- **Three of PROMPT.md §5 Phase 8's four bullets are already no-ops**, verified against the tree, not
  taken from PLAN.md's Phase-0 claims: zero constructor-parameter DI; zero class-based interceptors or
  guards (3 `HttpInterceptorFn`, 24 functional guards/resolvers). The work is bullet 2 (60 files) and
  bullet 4 (the lint rule).
- **Baselines taken before any edit: `lint` exactly 8 errors / 0 warnings; `test` 158 files / 500
  passed + 1 skipped.** Phase 8 can clear none of the 8 — they are Phase 10/11 work — so `lint` stays
  red and §6's "full green run" is unreachable again, same as Phase 7.

- ✅ **60 services converted, zero `@Injectable` left, zero kept exceptions.** 44 `providedIn:'root'`
  → `@Service()`, 16 bare → `@Service({ autoProvided: false })`. Repo now has 70 `@Service`
  decorators (60 new + 10 pre-existing). **Verified equivalent from the installed 22.0.8 runtime, not
  from memory:** `ɵɵdefineService` sets `providedIn: autoProvided === false ? null : 'root'`.
- ⚠️ **The 16 scoped conversions were the only silent failure mode in this phase** — a scoped facade
  wrongly left as bare `@Service()` becomes a root singleton and NOTHING throws; it would only surface
  as a dialog seeing the wrong facade instance through `Dialog`'s `EnvironmentInjector` hand-off
  (9 call sites). Closed two ways: the conversion was **shape-driven** so the groups could not
  cross-contaminate, and the exact 16-file list was pinned before the edit and diffed after —
  **exact match**. `reviewer` independently confirmed 1:1 mapping with zero mismatches.
- ✅ **No logic changed anywhere.** Diffing every added line in `src/**/*.ts` against "import member or
  `@Service` decorator?" leaves **exactly one** line repo-wide: a stale comment corrected on purpose.
- ✅ **Lint rule landed and was PROVEN, not assumed** — canary took lint **8 → 9 → 8**, the error hit
  column 10 (the `Injectable` specifier), and a `Service` import in the **same statement** stayed
  silent, so the rule is specifier-scoped. **The allowlist is deliberately EMPTY** — the audit found
  zero `InjectionToken`, zero `multi: true`, zero non-root `providedIn`, so there is nothing to
  exempt. The config comment names what would earn an exception.
- ✅ **Step 0 cleared the Part A naming debt: 16 renames + 2 deletions.** `import-auditor` found 150
  references / 30 load-bearing specifiers; the rewrite changed **exactly 30** — that match is the
  proof the sweep was complete. All 16 landed as git `R`, history intact. **No `.guard.ts`,
  `.pipe.ts`, `.directive.ts`, `.service.ts` or `.component.ts` file remains in `src/`.**
  Targets came from the installed `@schematics/angular` 22.0.8 (`typeSeparator` defaults to `"-"` for
  guards/pipes; directives and services have **no** `type` default), not from taste.
- **Bundle is effectively unchanged: 12 files / 504.4 KB raw / 101.7 KB gzip.** Gzip identical to the
  post-webinar state; raw is 0.2 KB _smaller_ (the two deleted files). The conversion compiles to the
  same `providedIn`, so there was no reason for it to move — and it didn't.
- ⚠️ **`public/version.json` and `core/version/app-version.ts` were RESTORED to HEAD, not committed**
  (build churn from running the gates). `reviewer` flagged them because it read the diff before the
  restore; they are not in the final change set.
- 🐛 **Three things logged, not fixed** (PROMPT.md §7), all in §3 of the report: the 4 admin v1 pages
  that would throw `NullInjectorError` if their commented routes were re-enabled;
  `assessment-result-dialog.ts:34`, the last `@Inject(PLATFORM_ID)` constructor param in the repo;
  and — worth a decision — **AGENTS.md §6 line 149 tells you to scaffold with the Angular CLI's
  generate command, while PROMPT.md §7 bans schematics outright. Both cannot be followed;
  Phase 14 must resolve it.**
- ⚠️ **THE PART B TRACKER IS DEFECTIVE AND WILL BITE PHASES 9, 11 AND 12.** It has no row for
  `core/services` (26 files) or `shared/services` (3), so on a strict per-feature reading that code is
  owned by no session. It was 48% of Phase 8's work, and `utils.ts`, `engagement-dialog.ts` and
  `update-checker.ts` all have real Phase 9/11/12 work in them. **Add the two rows before Phase 9.**
- **Next: `/refactor-phase 9 blog` — data layer, first feature top-to-bottom in the Part B tracker.**
  PLAN.md §5 sizes Phase 9 at **37 `resource()` usages** wrapping `firstValueFrom(api.get(...))`,
  ~95 reads → `httpResource` and ~60 mutations staying on `HttpClient`.

- ⛔ **PHASE 8 CLOSES ⛔, NOT ✅ — and it CANNOT BE COMMITTED as things stand.** Both follow from the
  same 8 Phase 7 lint errors, and the second one is a consequence I failed to predict in the plan.
  - **Status:** PROMPT.md §6 defines done as "the verifier reports a full green run". `lint` is red,
    so Phase 8 closes the same way Phase 7 did. The work itself is complete and verified — 0
    `@Injectable` left, `reviewer` PASS, 6/8 gates green, both reds pre-existing.
  - **Commit blocker:** `.husky/pre-commit` runs `lint-staged`, which runs **`eslint --fix` on staged
    `*.{ts,html}`**. **Four of the six files carrying the 8 violations are in Phase 8's staged set** —
    `notification.ts`, `masterclass-facade.ts`, `micro-learning-course-facade.ts`, `utils.ts` — because
    all four held an `@Injectable`. `eslint --fix` exits **1** on them (reproduced directly; a clean
    Phase 8 file exits 0), so the hook rejects the commit.
  - ⚠️ **Phase 7's report said the hook "is NOT blocked" — that was true FOR PHASE 7 ONLY**, because
    that phase touched no violating file. **Phase 8 cannot avoid them**: converting every service in
    the repo necessarily touches the services that carry the residue. **Every remaining Part B phase
    that touches one of those 6 files hits this same wall**, so this needs settling once, not per phase.
  - **`--no-verify` is banned** (AGENTS.md §9) and the rule must not be weakened, so neither is an
    option. **See the Phase 8 commit-blocker decision below.**

- 🔬 **OPTION 2 CHOSEN (fix the 8 violations now) — ANALYSIS DONE, EXECUTION NOT STARTED.**
  Awaiting one design call (below). No source file has been modified for option 2; the tree is still
  exactly the verified Phase 8 change set.
- 🚨 **THE FINDING THAT CHANGES PHASE 11'S PLAN: a dynamic `import()` does NOT clear a boundaries
  violation.** `shared/services/utils.ts:765` is **already** `await import('@features/payment/...')`
  and lint flags it anyway — `boundaries/dependency-nodes` includes `dynamic-import` by default, which
  Phase 7 proved with a canary and recorded above. **Consequence: PROMPT.md §4.5's `injectAsync` /
  lazy-`import()` technique, which PLAN.md and STATE.md both name as the fix for the seven
  `PaymentFacade` edges, would NOT have fixed them.** Deferring an import is not inverting it. Phase 11
  needs a real inversion whatever happens here, so this analysis is not wasted if option 2 is dropped.
- **The 8 violations are three different problems, not one:**
  - **A — `notification.ts` → `@shared/ui/toast/toast` (1 violation). Easy.** It needs the
    `ToastComponent` _class_ to hand to `NgpToastManager.show()`, plus the `ToastContext` _type_.
    Fix: an injection token in `core/`, provided at `app.config.ts`; move `ToastContext` into
    `core/models/notification.model.ts` beside `ToastOptions`/`ToastPosition`/`ToastType`, and let the
    shared toast import it from core (`shared → core` is legal). ~30 lines, no behaviour change.
  - **B — read-only cart state (3 violations).** `masterclass-facade:29` and
    `micro-learning-course-facade:40` use **only** `payment.cartItemRemoved()`; `footer-overlay:22`
    uses **only** `payment.cartData()` + `payment.loadMyBucket()`. Fix: a `CartStore` in
    `core/services/`, owning the cart signals **and** the fetch — legal, because `ApiClient` is core —
    with `PaymentFacade` delegating to it. **No bundle risk**: nothing eagerly instantiates payment,
    so the payment chunk stays lazy.
  - **C — payment UI reached from `shared/` (4 violations). The real knot.**
- ⚠️ **Why C is hard, and why the obvious fixes are net-zero or worse:**
  - `Utils.openCartDrawer()` (utils.ts:762) is a **near-verbatim duplicate** of
    `PaymentFacade.openCartDrawer()` (payment-facade.ts:621) — same dialog, same options, plus a
    `loadMyBucket({force:true})` line. It is **not dead**: `Utils.addCourseToCart()` calls it twice.
  - `Utils.addCourseToCart()` is **course** add-to-cart (PaymentFacade's `addToCart` is for
    subscription plans — different thing) and has **3 callers, all in `features/offerings`**
    (`masterclass-course-hero:96`, `podcast-course-hero:113`, `micro-learning-course-facade:694`).
    **Moving these two methods into `PaymentFacade` trades 2 `shared → feature` violations for 3
    `feature → feature` ones.** Net worse.
  - `subscription-dialog` needs `PlanSelectionCard` as a **template** import (`imports: [...]`), so
    **no token can hide it** — the dialog itself has to move into `features/payment/`. But its only
    two openers are `shared/services/engagement-dialog.ts:245` and `shared/services/utils.ts:430`,
    both shared, so moving it stands two new `shared → feature` edges back up. This is the same
    net-zero trap the Phase 4 decision already recorded for this dialog.
- 💡 **One design resolves all three, and it hinges on a fact worth keeping:**
  **`app.config.ts` is element `app-root` (`pattern: 'src/app'`), and there is NO policy with
  `from: app-root`** — with `default: 'allow'`, the composition root is the one place legally allowed
  to name a feature. The config comment says this is deliberate.
  So: a **loader-token registry in `core/`** — `() => Promise<Type<unknown>>` tokens for the three
  components that core/shared/layout open programmatically (`ToastComponent`, `CartDrawerDialog`,
  `SubscriptionDialog`) — provided in `app.config.ts`, where the dynamic `import()` actually lives.
  **Lazy chunks are preserved and the initial bundle does not move**, because a dynamic import inside
  `app.config.ts` still splits.
- ⏸ **DECISION NEEDED before execution — this is why nothing has been written yet.** The registry is a
  **new pattern that PROMPT.md §3 and §4 do not describe**, and carving cart state into `core/` is
  Phase 10's and Phase 11's design decision being taken early, inside a services phase, by me.
  Size: 2 new core files, ~4 `app.config.ts` providers, edits to all 6 violating files,
  `SubscriptionDialog` moved, its 2 openers rewired, plus specs.
  - **(a) Proceed with the full design** — clears all 8, Phase 8 closes ✅ and commits cleanly.
  - **(b) A and B only** — clears 4 of 8 with no new pattern and no contested design; C's 4 violations
    stay for Phase 11 with this analysis recorded. Phase 8 still cannot commit.
  - **(c) Drop option 2**, revert to the scoped `warn` override (option 1) or leave uncommitted.

- ✅ **OPTION 2, PARTS A AND B DONE (your call: "A and B only"). LINT 8 → 3.** Five of the eight
  Phase 7 boundary violations are gone, by real inversion — not by deferral, which does not work here.
  - **A — `core → shared` cleared.** `ToastContext` moved into `core/models/notification.model.ts`
    (beside `ToastType`, which the shared toast already imported from core), and `NotificationService`
    now resolves the toast component through a new **`TOAST_COMPONENT`** injection token, bound in
    `app.config.ts`. That file is element `app-root`, and the boundaries config has **no policy with
    `from: app-root`** — so the composition root is the one place legally allowed to name both sides.
  - **B — 4 `PaymentFacade` edges cleared** by a new **`core/services/cart/cart-store.ts`**.
    `CartStore` owns the cart signals (`cartData`, `cartItemRemoved`, `loading`, `error`,
    `cartFetched`), `setCartData()` and `loadMyBucket()`. It can, because everything it needs is
    already core: `CartDetails` and the `PAYMENT_ROUTES` API registry both live in
    `core/models/payment.model.ts`, and `ApiClient`/`Logger` are core services.
    `PaymentFacade` **aliases** those signals under their original names — same signal objects, not
    copies — so all ~30 internal uses and every payment page, guard and resolver are untouched.
    Rewired to `CartStore`: `masterclass-facade`, `micro-learning-course-facade`, `footer-overlay`,
    and `shared/services/utils.ts`.
- ⚠️ **The token broke 60 spec files and the fix is worth knowing.** `NotificationService` is injected
  transitively by most facades, so every one of those suites died with
  `NG0201: No provider found for InjectionToken TOAST_COMPONENT`. Fixed by binding the token in
  `src/test-setup.ts` — the same component `app.config.ts` binds, so a spec that shows a toast still
  exercises the real path. **This supplies a dependency; it silences nothing.** Any future app-wide
  token needs the same two bindings, app and test.
- 🎯 **THE COMMIT IS NOW BLOCKED BY EXACTLY ONE LINE: `shared/services/utils.ts:767`,** the dynamic
  `import('@features/payment/dialogs/cart-drawer-dialog/cart-drawer-dialog')` inside
  `Utils.openCartDrawer()`. Proven by running what the hook runs (`eslint --fix` over the 87 staged
  `.ts`/`.html` files): **1 problem, 1 error.**
  **`subscription-dialog.ts` is NOT staged** — Phase 8 never touched it, since it holds no
  `@Injectable` — so its 2 remaining violations never reach the pre-commit hook. They are a Phase 11
  item and block nothing today.
- ⏸ **The C decision is now much smaller than when it was declined.** It was "2 new core files,
  `SubscriptionDialog` moved, 2 openers rewired, ~6 files"; what actually stands between Phase 8 and a
  clean commit is **one call site** — a single `InjectionToken<() => Promise<Type<unknown>>>` in core
  bound in `app.config.ts` (~15 lines), the same shape `TOAST_COMPONENT` already uses and proved.
  Still the user's call, because it is still the registry pattern PROMPT.md does not describe.

- ~~(superseded)~~ **MY EARLIER “recurrence” CLAIM HERE WAS WRONG — see “OPEN QUESTION −1 IS SOLVED” below.**
  `docs/refactor/baseline/bundle.json` and `ssr.json` are **dirty in the working tree again** after
  this session's full `verify.mjs` runs. They are **unstaged** (` M`), so they will not be committed,
  but they must be restored before the next session:

  ```
  git restore docs/refactor/baseline/
  ```

  **I did not and cannot write them** — the Bash guard fences that directory as user-owned, and it
  blocked me even from reading their diff. `verifier` states it did not write them either: its
  invocation was plain `node scripts/refactor/verify.mjs` with no `--record`/`--record-baseline`.
  **New evidence this round, which is stronger than last time:** the two baseline files' mtimes
  (08:28:01 / 08:28:04) **predate `verifier`'s own gate-log writes** (08:28:14 / 08:28:16) from the
  same run — so they were written during the run, before its logging, not by a separate recording run
  on another day. Phase 7 recorded "baselines stayed clean after the full run, so open question −1 did
  not recur"; that is no longer a safe conclusion, and the earlier verdict that "an ordinary run does
  NOT rewrite it" should be treated as unproven rather than settled.

- ⚠️ **Consequence: this session's `bundle report` and `ssr smoke` PASSES compare against a moving
  target, so read the manual numbers instead.** The run's own "+0.0%" is meaningless because the
  on-disk baseline had already been replaced with this run's own figures. `verifier` re-measured
  against the last **committed** baseline (`git show HEAD:docs/refactor/baseline/bundle.json`):
  - **Initial bundle 12 files, 501.5 KB → 506.6 KB raw, 101.5 → 102.3 KB gzip = +5.1 KB raw /
    +0.8 KB gzip (+0.79%)**, under the 3% threshold. That covers Phase 8 (~+0.2 KB, all Tailwind
    tokens from the webinar work) plus `CartStore` and the toast-token wiring, which are genuinely new
    eager code in `core/`.
  - **SSR: 3 of 4 routes byte-match the committed baseline**; only the known masterclass route differs,
    in exactly the documented course-API-unreachable way. No other route regressed.
- ✅ **The CartStore extraction did NOT pull payment into the initial bundle — checked, not assumed.**
  `verifier` grepped all 11 files `index.csr.html` references for the literal selectors
  `cart-drawer-dialog` and `plan-selection-card` (selectors are string literals, so minification does
  not mangle them): **zero hits in the initial set**; both appear only in lazy chunks
  `chunk-3EFTVJVD.js`, `chunk-6IPXEJTN.js`, `chunk-PDZRRTBC.js`.

- ✅ **OPEN QUESTION −1 IS SOLVED, AND MY EARLIER “RECURRENCE” NOTE WAS WRONG — read this, not that.**
  Cause, from `verify.mjs` itself: **the gate loop does not abort on failure.** It records each gate's
  result and continues, and `bundle report` / `ssr smoke` carry `needs: 'build (prod)'` — **not** a
  dependency on `lint`. So under `--record-baseline` they still run with `--record` and **write the
  baselines even though `lint` failed earlier in the same run**; the process then exits 1 only because
  `summary.ok` is false.
  **So an ordinary `verify.mjs` run never rewrote anything. A `--record-baseline` run did — exactly
  what the ORIGINAL open-question −1 note guessed ("most likely an explicit recording run"), and what
  Phase 7 concluded ("an ordinary run does NOT rewrite it"). Both were right; I muddied a settled
  question.** My mtime argument only showed the files were written near the run, not by which run.
- ❌ **RETRACTED: do NOT run `git restore docs/refactor/baseline/`.** I gave that instruction one turn
  earlier believing the files had been corrupted by a stray write. They were not — they are **your
  deliberate recording**, and restoring them would throw it away. The on-disk `bundle.json` is stamped
  `2026-09-24T03:16:26.593Z` with `initial: 12 files / 506.6 KB raw / 102.3 KB gzip`, which matches
  the current post-A+B build exactly. **The record succeeded.**
- ⚠️ **`--record-baseline` will keep exiting 1 until `lint` is fully green.** It is not failing to
  record — it records, then reports a red gate. A green recording run therefore needs **all three**
  remaining violations gone, not just the one that blocks the pre-commit hook: the hook only lints
  _staged_ files (and `subscription-dialog.ts` is not staged), but `pnpm lint` is repo-wide.
  **That means the full option-2 part C after all:**
  - `utils.ts:767` — dynamic `cart-drawer-dialog` import → a loader token.
  - `subscription-dialog.ts:5` — `PaymentFacade`.
  - `subscription-dialog.ts:6` — `PlanSelectionCard`, a **template** import, so no token can hide it:
    the dialog itself has to move into `features/payment/dialogs/`, which then needs loader tokens for
    its two shared openers (`engagement-dialog.ts:245`, `utils.ts:430`).

- ✅ **`utils.ts:767` CLEARED — THE PRE-COMMIT HOOK NOW PASSES. LINT 8 → 2.**
  `CART_DRAWER_DIALOG`, an `InjectionToken<() => Promise<Type<unknown>>>`, added to
  `core/services/cart/cart-store.ts` (no new file — it is cart code and that is the cart's core home),
  bound in `app.config.ts`. `Utils.openCartDrawer()` now calls the token instead of naming the payment
  dialog. **The `import()` moved to `app.config.ts`, so the drawer stays in its lazy chunk.**
  Proven by running exactly what the hook runs — `eslint --fix` over the staged `.ts`/`.html` files —
  which now reports no problems.
- ⚠️ **The same token cost 56 spec failures until it was bound in `src/test-setup.ts` too.** Identical
  to `TOAST_COMPONENT`: `NG0201` the moment anything injects `Utils`. **This is now a rule, not a
  coincidence — every app-wide token needs TWO bindings, `app.config.ts` and `test-setup.ts`.**
  The test binding is the real loader, not a stub: it is a function, so nothing is imported until
  something actually opens the drawer, and the path stays faithful.
- 🎯 **2 violations remain, both in `shared/dialogs/subscription-dialog/subscription-dialog.ts`
  (`:5` PaymentFacade, `:6` PlanSelectionCard). They block a GREEN baseline-recording run, and
  nothing else** — the file is not staged (Phase 8 never touched it; it holds no `@Injectable`), so
  the pre-commit hook does not see it. The distinction that matters: **the hook lints only STAGED
  files; `pnpm lint` is repo-wide.**
  `PlanSelectionCard` is a **template** import (`imports: [...]`), so no token can hide it — clearing
  these two means **moving the dialog into `features/payment/dialogs/`** and giving its two shared
  openers (`engagement-dialog.ts:245`, `utils.ts:430`) a loader token, the same shape now proven
  twice.

- 🏁 **ALL 8 PHASE 7 BOUNDARY VIOLATIONS ARE CLEARED. `pnpm lint` PRINTS "All files pass linting."**
  First fully green lint since the rule landed in Phase 7. `pnpm lint` exits **0**, so a
  baseline-recording run will now reach `ALL GATES GREEN` instead of exiting 1 on the lint gate.
  Phase 8 therefore closes **✅**, not ⛔ — PROMPT.md §6's "full green run" is reachable again.
- ✅ **The last two went by moving the component, not by hiding it.**
  `SubscriptionDialog` moved `shared/dialogs/` → **`features/payment/dialogs/`** (`git mv`, 3 files,
  history kept). It had to move rather than take a token, because it renders `PlanSelectionCard` as a
  **template** import (`imports: [...]`) and a template import cannot be resolved through a token.
  Its two openers — `shared/services/utils.ts:433` and `shared/services/engagement-dialog.ts:245` —
  now resolve it through `SUBSCRIPTION_DIALOG`.
- 📁 **The loader tokens now have ONE home: `core/services/dialog/feature-dialog-tokens.ts`.**
  `CART_DRAWER_DIALOG` was moved out of `cart-store.ts` into it, so both live together and Phase 11
  has an obvious place to add more. The file's header documents the whole pattern, including the
  reason it exists (deferring an import does not satisfy `boundaries/dependencies`).
- ⚠️ **THE RULE, now proven three times: every app-wide token needs TWO bindings —
  `app.config.ts` AND `src/test-setup.ts`.** `TOAST_COMPONENT` cost 60 spec failures and
  `CART_DRAWER_DIALOG` cost 56 before each was bound in the test setup; `SUBSCRIPTION_DIALOG` was
  bound in both from the start and cost nothing. The test bindings use the **real** loaders, not
  stubs: they are functions, so nothing is imported until something actually opens the dialog.
- ⚠️ **One genuine behavioural nuance, from making the opens async.**
  `EngagementDialog` sets `this.openRef` inside `afterClosed()`, which now runs **after** the lazy
  chunk resolves rather than synchronously. So in the brief window between requesting the dialog and
  the chunk arriving, `openRef` is `null`, and a navigation into a suppressed route during that window
  would not auto-close the dialog that is about to appear. The returned stream is unchanged — it still
  emits once and completes on close. `Utils.requireCpeModeAccess()` keeps its synchronous `boolean`
  signature: the open is fired and deliberately not awaited.

### Steps

- [x] **Step 0 — Part A naming cleanup: 2 deletions + 16 renames.** Drop the v19 type suffixes.
      Targets settled by the installed `@schematics/angular` 22.0.8, not by taste: guards and pipes use
      `typeSeparator` default `"-"` (`x-guard.ts`, `x-pipe.ts`); directives and services have **no**
      `type` default, so they lose the suffix entirely. The repo's already-correct files
      (`can-deactivate-exam-guard.ts`, `duration-pipe.ts`, `safe-html-pipe.ts`) already match.
      `import-auditor`: **150 references, 30 load-bearing import specifiers.**
- [x] **Step 1 — `core/` + `shared/`: 29 files** (26 + 3), all root → `@Service()`.
- [x] **Step 2 — `features/`: 18 files** (12 root + 6 scoped). _Planned 19; the split between this
      row and Step 3 was one off in the estimate — the total is 60 either way._
- [x] **Step 3 — `admin/`: 13 files** (3 root + 10 scoped). _Planned 12; see Step 2._
- [x] **Step 4 — the lint rule + canary proof.**
- [x] **Close:** `verifier` GREEN, `reviewer` PASS, report written, STATE.md updated,
      commit message in §5 of [phase-08](reports/phase-08.md).

- 🏁 **OFF-PHASE FEATURE WORK DONE AND VERIFIED — branch `feat/webinar`, not a refactor phase.**
  `reviewer` **PASS, zero structural violations**; `verifier` **GREEN** (7 of 8 gates green, `lint`
  red only with the 8 known Phase 7 errors, `ssr smoke` red only on the pre-existing route below).
  **UNCOMMITTED: 42 new files, 28 tracked modifications/deletions.**
  The webinar design + API binding from `feat/webinar-implementation` was ported onto master's
  post-Phase-7 structure. **That branch was NOT merged and must not be** — its merge base is
  `555cab6` (`feature/zoom-sdk`) on the _"strip app to admin-only"_ lineage, while master went the
  opposite way (`98532b5 Revert Of the latest miles-masterclass code from V3` → CAIRA auth →
  phases 1–7). Merging it would re-apply the strip and revert the refactor. 41 files were
  re-created by hand instead, laid out to §3 (`components/ pages/ services/ models/ utils/`, no
  `shared/` layer, `@core`/`@shared`/`@env` aliases).
- **Part A structure held: lint is still EXACTLY the 8 known Phase 7 errors, no 9th.** The port
  adds no boundary edge — the module imports only `@core`, `@shared`, `@env` and itself.
  Unit tests 154 files green (152 on master + the 2 ported specs).
- ⚠️ **Two gate deviations are PRE-EXISTING, proven by a `master` worktree build, not assumed.**
  (1) `ssr smoke` fails on `/us/accounting/masterclass/154/adulting-in-business`; clean master
  serves byte-identical output (`<title>{{title}}</title>`, 1 ld+json) because this machine cannot
  reach the course API. (2) The course-feedback page throws 2 `uncaughtException`s under a dead
  API; master's own masterclass feedback route throws the same two.
- ⚠️ **Initial bundle +3,593 bytes raw (+0.2 KB gzip), and it is ALL CSS.** Measured file-by-file
  against a master build: `styles.css` 376,177 → 379,940 (+3,763, the new Tailwind v4 theme tokens
  and the utilities the webinar templates use), JS **−170** bytes, `main.js` byte-identical.
  **Zero JS growth — the 3.6 MB Zoom SDK is lazy-only**, in the `embedded` chunk.
  Phase 14 note: this is the first change to make the initial bundle non-byte-identical to
  baseline since Phase 5, and Tailwind v4's single global sheet makes that unavoidable for any
  feature that introduces a token.
- ✅ **FINAL GATES, post-hardening: no red is attributable to this work.**
  `unit tests` **156 files / 490 passed + 1 skipped**; `lint` red with **exactly the 8** known
  Phase 7 errors, 0 warnings; `build local`/`build prod`/`storybook`/`format`/`bundle report` green;
  `tsc -p tsconfig.json --noEmit` exits 0. `ssr smoke` red on the one pre-existing masterclass
  route only. Bundle initial **12 files / 504.6 KB raw / 101.7 KB gzip** (+0.2 KB gzip vs baseline,
  all of it the Tailwind tokens in `styles.css`).
- ⚠️ **`verifier` MISREPORTED the typecheck failure — do not trust that line in its transcript.**
  It called the first run's `TS2304: Cannot find name 'WebinarLoc'` "a stale build-cache flake, not
  a real code defect". It was a real defect: the interface genuinely was not in the file. The agent
  ran WHILE I was fixing it, so its second run passed, and the line numbers it offered as proof
  (143/218/254 vs the original 210/246) shifted precisely BECAUSE the fix inserted those lines.
  The stop gate's typecheck caught the same error independently. Nothing was flaky.

- 🏁 **PHASE A OF THE WEBINAR FLOW PLAN IS DONE** (plan: `prompts/webinar-flow-completion.md`,
  written after auditing the module against the user's described flow AND `EVENTS_API_CONTRACT_V1`).
  Verdict on arrival: **~60% aligned — shape right, nothing to re-architect.**
  - **Join window 50 → 15 minutes** across all three environments, with the spec fixtures moved
    (12:10 → 12:45 boundaries). The prod comment that called this a "fallback" was corrected:
    `join_opens_at` appears **0 times** in the contract, so this value IS the rule and it is
    computed in the browser — `ServerClock` bounds the skew, but ask the backend for the field.
  - **Sign-in gate on Register.** A signed-out visitor correctly sees "Register Now" (`pre_login`
    carries no `registration` block), and used to POST straight to a 401. Now `UtilsDialog` (reused,
    not a new component) → `/auth/login?redirect=<current url>`, the same parameter `authGuard`
    uses. **Four specs pin it**, including "does NOT call the API when signed out".
  - **Countdown now targets the SESSION START, not the join-open moment**, and gained a long form:
    "This webinar starts in 4 days and 3 hours" on the hero, compact `4d 03h` in a card strip.
  - **`all-bookings` deleted outright** — endpoint, resource, `bookingsByWebinarId`, `BookingRow`,
    `booking.model.ts`, and both component inputs. It is app-api-only and the user has banned that
    surface, so it could never fire. **This removed a rendered design element**: the
    "110/120 Minutes | 7 out of 8 Poll Questions Answered" line, which is the answer to "what did
    the learner miss". `webinar-card.ts` and the facade both carry a comment naming the exact four
    fields that restore it.
- ✅ **PHASE B DONE — the `app-api/` ban is now enforced by lint, not by memory.**
  `eslint.config.mjs` gained a `no-restricted-syntax` rule; AGENTS.md §6 gained a line beside the
  Django / Supabase / Partner-Platform split.
  **TWO selectors are required, and this is the part worth remembering:** `Literal` catches a plain
  string, but our endpoint registries build URLs as `` `${ROOT}app-api/...` `` — a template literal.
  A `Literal`-only rule would have passed every real case while looking like it worked.
  `TemplateElement[value.raw=/app-api\//]` covers that half.
  **Proven with a canary before being trusted**, following the Phase 7 precedent: a temporary file
  holding both shapes plus a `web-api` control took lint 8 → 10, the control stayed silent, and
  deleting it returned to exactly 8. Comments naming the endpoint do NOT trip it — comments are not
  AST nodes, so the explanatory notes in `webinar-card.ts` and `webinar-facade.ts` survive.
  Gates after: tests **158 / 500**, lint exactly 8, `tsc --noEmit` clean, format clean.

- 🔒 **Zoom hosting config implemented, from the official Angular sample + Zoom's own docs.**
  Our `ZoomMeetingClient` was compared against `zoom/meetingsdk-angular-sample`'s
  **`app-new.component.ts`** (the Component View variant — the default `app.component.ts` is Client
  View and is NOT what we use). **Every `init()`/`join()` option matches.** Two deliberate
  differences, both ours and both correct: we `import()` the SDK dynamically (static would put
  3.6 MB in `main` and fail the budget) and we inject no `NgZone` (the app is zoneless). `zak` is
  correctly omitted — it authorises STARTING as host, and learners join as attendees.
  Two `vercel.json` changes, the parts a localhost sample cannot show:
  - **`Permissions-Policy: camera=()` → `camera=(self)`.** The old value disabled the camera
    outright, so an attendee promoted to panelist could not turn on video. Changed the GLOBAL value
    rather than adding a scoped override **on purpose**: Vercel documents that `source` matches the
    incoming pathname but is SILENT on which rule wins when two matching rules set the same header
    key, and a scoped override would have depended on that. `camera=(self)` is the browser's own
    default when the header is absent and grants nothing to third parties.
  - **COOP `same-origin` + COEP `credentialless`, scoped to
    `/:country/:profession/webinar/:id/live`.** Enables `SharedArrayBuffer`, which Zoom requires for
    Gallery View, Virtual Background, 720p and Chrome tab audio. **`require-corp` would have broken
    the site** — it demands CORP on every cross-origin subresource, and CloudFront images, Google
    Fonts, GTM, Clarity and Calendly send none. `credentialless` strips credentials from no-cors
    loads instead; all those assets are public, and CORS API calls keep their `Authorization`.
    New header keys, so no precedence question. Safari ignores `credentialless` and degrades to
    today's behaviour, which is the intended fallback.
  - **CSP needed no change** — verified against the SDK: `'unsafe-eval'` for the WASM media layer,
    `connect-src https: wss:`, `worker-src blob:`, `blob:` on `media-src`/`img-src`.
  - **NOT testable locally** — `pnpm serve:ssr` does not read `vercel.json`. Verify after deploy
    with `curl -sI …/live` and `crossOriginIsolated === true` in the console.
- ⚠️ **Pre-existing defect found while checking for duplicate header keys (NOT fixed, spun out).**
  `vercel.json` has two rules that both match `/sw.js` and both set `Cache-Control` — the static
  asset rule (`immutable`, one year) and `/sw.js`'s own (`no-cache`). Which wins is the same
  undocumented behaviour described above. If the immutable one wins, the service worker can never
  update and the `update-checker` flow breaks with it. Needs verification against the DEPLOYED site.

- ❓ **"Why is there React code in an Angular repo?" — answered, and the answer is load-bearing.**
  Zoom's Meeting SDK Component View IS a React app internally. `@zoom/meetingsdk` declares
  `react`/`react-dom`/`redux`/`react-redux` as PEER dependencies; pnpm installs
  `react@18.3.1` + `react-dom@18.3.1` into `node_modules/.pnpm/` and deliberately does NOT hoist
  them, so the SDK can reach React and our code cannot. React is correctly absent from
  `package.json` — it is not our dependency.
  The four `allowedCommonJsDependencies` entries in `angular.json` exist because the SDK ships a
  **UMD (CommonJS)** bundle that `require()`s all three. **Tested, not assumed:** removing them
  takes `build:prod` from **3 warnings to 6** (`Module 'react' … is not ESM`). Restored; back to 3.
  Zero React reaches the initial bundle — it is all inside the lazy webinar chunk, and `main.js`
  measured byte-identical to master.
  **Consequence for Q3:** if the backend never ships the Meeting SDK endpoints, dropping
  `@zoom/meetingsdk` removes React, Redux and ~3.6 MB from the project outright.
- ⚠️ **Mid-investigation correction, caught by the build:** I stated react "isn't installed" after
  checking only the top level of `node_modules`. Wrong — pnpm's strict isolation puts peer deps in
  the store, not the root. Check `node_modules/.pnpm/` before concluding a package is absent.

- 🧹 **Module slimmed on a measured audit, not a hunch** ("do we need all these services?").
  **Answer: the four services stay; `utils/` was the bloated half.** `WebinarRegistration` is
  injected by the routes AND both pages, not just the facade, and folding it in makes a 680-line
  facade; `MeetingSession` (lease integrity) and `ZoomMeetingClient` (SDK rendering) must stay
  apart, because merging them couples CPE-bearing attendance to a vendor SDK.
  - **`zoom-join-params.ts` deleted — 73 lines, ZERO importers.** It parsed `tk` out of `join_url`
    as a fallback, but `toJoinParams` reads the signature response directly and nothing ever wired
    it up. The model comment that pointed at it now states the real position: no `registrant_token`
    from the backend (Q6) means the SDK path has no token at all.
  - **`ServerClock` was a `@Service` sitting in `utils/` — a §3 misplacement `reviewer` and I both
    missed**, in a file mixing one DI service with eight pure functions. Split into
    `services/server-clock.ts` (ticker + clock-skew) and `utils/session-time.ts` (pure, no Angular,
    TestBed-free). 8 importers rewired; most only ever wanted the pure half.
    **Lesson: `reviewer` checks folder SHAPE, not whether a DI class is in the right folder.**
  - `webinar-icons.ts` (one SVG, one consumer, no core equivalent) folded into `brand-assets.ts`.
  - Net 49 → 48 files, ~90 lines of dead and duplicated code gone.
- ⚠️ **I introduced a 9th lint error during the split and lint caught it.** The new service imported
  `parseIso` unused — because `syncFrom` was hand-rolling `Date.parse` + `Number.isNaN`, which IS
  `parseIso`. Fixed by using the helper and deleting the duplicate, not by dropping the import.
  Back to exactly 8.
- ⏸ **One deletion left on your decision: `webinar-preview.ts`, 256 lines**, the largest remaining
  util — a dev-only stand-in feed with one importer, which its own comment says exists only because
  UAT had no future-dated webinar. If UAT has data now it is the biggest remaining cut; if not it is
  the only way to view the hero and upcoming rail. Not removed unilaterally.
- ✅ Gates after the slim: **158 files / 500 passed + 1 skipped**, lint exactly 8, `tsc --noEmit`
  clean, format clean.
- 📄 **`docs/WEBINAR_API_QUESTIONS.md` added** — the eight backend questions with checkable evidence
  (Q1 attendance-pending, Q2 duration/poll fields on a web route, Q3 Meeting SDK + lease routes,
  Q4 feedback/certificate/badge, Q5 `join_opens_at`, Q6 `registrant_token`, Q7 `product` vs
  `subject`, Q8 enrolment filtering). **Q1–Q4 block the flow.** Q3 carries a trap worth repeating:
  `attendance-session/release` on tab close can only be a `sendBeacon`, which cannot set headers and
  cannot preflight a JSON body — if the backend designs it as a normal authenticated POST, every
  closed tab leaks a lease until TTL.

- ⚠️ **Two of my own defects were caught by tooling, not by me, in this pass.** A too-greedy slice
  deleted the `detailsPage` endpoint along with `allBookings` (caught by the build); and
  `formatCountdownLong` rendered "1 minute and 0 seconds", contradicting its own doc comment
  (caught by the test I wrote for it — the test was right, the implementation was wrong).
- ✅ Gates after Phase A: **tests 158 files / 500 passed + 1 skipped**, lint exactly 8,
  `tsc --noEmit` clean, format clean, `build:prod` green with the 3 documented budget warnings.
- **Phases B–E remain blocked or unscheduled** — see §6 of the plan. Four of the user's described
  steps cannot be finished without backend work: attendance-pending is not expressible
  (`attended_status` is not on the card and `""` shares a bucket with genuine absence), "what you
  missed" has no web-surface source, the Meeting SDK has no endpoints, and webinar
  feedback/certificate/badge routes are unconfirmed.

- ⚠️ **A silent edit miss, caught by the stop gate's typecheck, not by me.** The `WebinarLoc`
  interface `src/seo.ts` now needs was inserted with an UNASSERTED `str.replace` — the anchor did
  not match, so the type never landed while every other edit in that pass did. `pnpm build`,
  `pnpm lint` and `pnpm test` all stayed GREEN through it, because the sitemap generator is
  compiled separately from the app graph; only `tsc -p tsconfig.json --noEmit` saw it.
  **Lesson for the remaining phases: `build` is not a typecheck of `src/*.ts` outside `src/app/`,
  and every scripted edit asserts its anchor.** Fixed; typecheck now exits 0.

- 🔒 **HARDENING PASS DONE, driven by `postman/` (the contract), not by reading the code alone.**
  `EVENTS_API_CONTRACT_V1` settled three things the ported comments got wrong:
  1. **The Zoom lease layer does not exist.** 118 requests, ZERO `attendance-session/*` and ZERO
     `meeting-sdk-signature` (`sdk` and `meeting` have 0 occurrences anywhere in the collection),
     and `join_opens_at` / `registrant_token` have 0 too. `/live` was built against plan A1.
     **Gated behind `environment.WEBINAR.liveEnabled` (false)**: `canMatch` keeps the route and
     the 3.6 MB SDK chunk unreachable, and `resolveJoinTarget` sends Join to the registrant's
     `join_url` instead — which is what the contract actually returns. Flipping one boolean is
     the whole cutover.
  2. **A per-webinar endpoint DOES exist** — `web-api/v1/events/webinar-details-page/?webinar_id=`,
     **AllowAny**. The ported comment claiming "v1 has no per-webinar route" was wrong, and the
     detail page was reading only the feed, so a deep link or a crawler got "we could not find
     that webinar" for a webinar that exists. Now bound, with 404 / error / loading told apart.
  3. **`all-bookings` moved to `app-api/` on 2026-09-17** and "the web twin is not built" — so its
     404 is expected, not a bug. Left calling `web-api/` **on your decision**, with the contract
     note recorded at the endpoint so the next reader does not re-investigate it.
- 🐛 **Four defects fixed, one of them a token leak.** `resolveStatusUrl` followed a server-issued
  absolute `status_url` verbatim, and since `ApiClient` forwards absolutes untouched while
  `appInterceptor` attaches the learner bearer, a foreign origin in that field would have sent the
  token off-platform (AGENTS.md §7). Now origin-pinned, with a spec that asserts the refusal. Also:
  `MeetingSession.acquire` leaked the lease + heartbeat when `claimLease` succeeded but
  `mintSignature` failed; `teardown()` used the header-less beacon where an authenticated POST
  works; the registration poll ran for up to 45s after the page was destroyed.
- 🔍 **SEO finished, and it found two more of my own gaps.** `webinar/` added to
  `DYNAMIC_SLUG_PREFIXES`; the detail page emits title/description/canonical/OG/Twitter and
  schema.org **`Event`** (not `Course` — `setupCourseSeo` is slug-driven and would assert wrong
  data), `noindex` on a confirmed 404, and a brand fallback so the page is never bare. Reuses
  `routeUrlToCanonicalUrl`, so webinar URLs collapse to the canonical locale like every other page.
  **`src/seo.ts` was emitting sitemap webinar URLs from the legacy `webinar/filter/` feed with
  INTEGER ids in the two-segment form** — after this port those 302 to a page that 404s. Repointed
  at the Events feed, UUIDs, one segment, matching the canonical.
- ✅ Tests **156 files / 490 passed** (was 154/480): new specs cover the join gate and the
  origin pin. Lint still exactly 8.
- 🧹 **`reviewer` surfaced one stale comment, now corrected.**
  `offerings/dialogs/webinar-registration-dialog/webinar-registration-dialog.ts` named
  `PremiereListItem`, which this port deleted. The dialog has **zero importers on master too** —
  it was already orphaned before the rebuild — so the comment now says so rather than pretending
  it has a caller. Deleting it and its dead dependency tree (`WebinarRegistrationForm`,
  `UpcomingPremiere`) is queued as separate work; it is not this port's job.
- **Three things the port had to fix that were not in the plan:**
  1. The detail URL went from `webinar/:courseId/:courseTitle` to `webinar/:id`, but the CPE
     tracker (`courseCommands`), the CAIRA badge actions, `features.routes.ts` and
     `src/legacy-redirects.ts` all still build the 2-segment form. Fixed at the root with ONE
     `:id/:courseTitle` → `:id` redirect route instead of editing four callers.
  2. **A bare path in `app.routes.server.ts` does NOT cover its children** — the file says so
     itself for `caira-tracker`. Master's `webinar` → Client entry would therefore have left
     `/live` server-rendering the Zoom SDK. Now only `webinar/*/live` is Client.
  3. Master's blanket `webinar` → Client was **removed**: `WebinarFacade` fetches the anonymous
     `pre_login` feed ON THE SERVER by design, and the old entry was a leftover from the dead
     placeholder page. The list went from a 5.7 KB CSR shell to 217 KB of server-rendered markup.
     **This is an SEO posture change to a live page — flag it to the user, it is reversible in
     one entry.**
- **Nothing is committed.** Exclude `public/version.json` and `core/version/app-version.ts`
  (build-generated, open question 6).
- **Part B is unaffected: `/refactor-phase 8` (services) is still next.** The five ported services
  already use `@Service({ autoProvided: false })`, so Phase 8 inherits them in its target shape.

- 🏁 **PHASE 7 (boundaries) IS DONE — and closes ⛔, not ✅, on your decision.** Report:
  [phase-07](reports/phase-07.md). `reviewer` **PASS, zero violations**.
  **7 of 8 gates green; `lint` is red with exactly 8 known
  violations and nothing else.** You chose to leave them at `error` unexempted rather than carry
  them as temporary warnings, so PROMPT.md §6's "full green run" is unreachable this phase.
  Bundle **byte-identical to baseline** (12 files / 501.5 KB raw / 101.5 KB gzip, 271 lazy chunks);
  SSR matched all 4 routes; **baselines stayed clean** after the full run, so open question −1 did
  not recur. **Part A ends here.**
- ✅ **The dynamic-import worry is closed.** The Phase 5 note warned Phase 7's config "must cover
  dynamic imports or it will report seven and silently miss two". `boundaries/dependency-nodes`
  includes `dynamic-import` by default and **both** dynamic violations were reported; proven with
  a targeted canary before any result was trusted. Caveat for Phase 11: only **string-literal**
  dynamic imports are analysed — `import(someVar)` is invisible to the rule.
- ⚠️ **The planned `Notification` move was DROPPED on evidence, so the residue is 8, not 7.**
  My pre-phase grep said "36 importers, zero in `core/`" — **wrong**, it matched only the alias
  form. `import-auditor` found two **relative** importers inside core:
  `core/services/network/network.ts:3` and `core/services/partner-code/partner-code.ts:5`. Both are
  core singletons that cannot move, so relocating `Notification` would have turned **1 violation
  into 2**. **Consequence: `notification.ts:3` has no move-only fix** — finding 1 below now has an
  owner (Phase 10, toast migration) but needs a real dependency inversion, not a `git mv`.
- ✅ **The pre-commit hook is NOT blocked.** `eslint --fix` over exactly this phase's changed files
  exits 0, because dropping the `Notification` move means **no violating file is touched**. No
  `--no-verify` needed and nothing was weakened.
- **Phase 7 is UNCOMMITTED.** Commit message in §5 of [phase-07](reports/phase-07.md). Exclude
  `public/version.json` and `core/version/app-version.ts` (build-generated, open question 6).
- **Next: Part B. `/refactor-phase 8` (services), first feature top-to-bottom in the Part B tracker.**
  Before that, three Part B items this phase pinned down: `notification.ts:3` → **Phase 10**;
  the seven `PaymentFacade` edges → **Phase 11** (they need lazy injection; no move clears them);
  and **enable `boundaries/no-unknown-dependencies` once Phase 11 turns lint green**, because
  until then the 8 errors _are_ the resolver canary and a green lint is the anomaly.

- 🏁 **PHASE 6 (admin) IS COMPLETE.** All four steps done in one session, **8/8 gates green**,
  `reviewer` **PASS, zero violations**. Report: [phase-06](reports/phase-06.md).
  **143 files changed: 136 renames (all rename-detected, no lost history) + 7 modified-only.**
  **No `shared/` folder remains anywhere under `src/app/admin/`** — `admin/shared/` (16 files) plus
  12 internal feature layers, now zero. **`partner-platform-v2 → partner-platform` edges: 39 → 0.**
  Every routed component is in `pages/`; `admin/core/` is the §3 shape
  (`directives/ guards/ interceptors/ models/ services/ utils/`); `admin/auth/pages/` holds the four
  auth pages. 70 cross-directory relative imports inside `admin/` were aliased.
  **This went beyond PLAN.md's Phase 6 row, on your decision** — PLAN.md named 3 dialogs, but
  `reports-v2` imports **7** modules out of v1's `reports/` subtree, so extracting only the three
  would have left `v2 → v1` alive and the cutover still blocked.
- ⚠️ **Two bundle claims corrected by measurement, both benign.** The first `verifier` run reported a
  bundle regression; it was a **measurement mismatch** — it compared Angular's budget figure
  (2.08 MB, the whole eager module graph) against the harness baseline (501.5 KB, which the harness
  defines as _only_ the JS/CSS referenced by `index.html`). Measured the harness way the build is
  **byte-identical to baseline** (12 files / 501.5 KB raw / 101.5 KB gzip), and lazy is 0.8 KB
  _smaller_ at the same 271 chunks. The `2.00 MB` budget warning and the two CSS budget warnings were
  reproduced on a clean build of `HEAD` and are **pre-existing**.
  **Phase 14 note:** both numbers are real and measure different things — open question 0 calls
  AGENTS.md §9 stale, but AGENTS.md is right about the _budget_ metric and the bundle report is right
  about the `index.html` metric. Explain the two, don't just swap the number.
- ✅ **[CORRECTED 2026-09-23] Phase 6 IS committed** (`8e7255c`, merged at `2debbf4`); the working
  tree was clean at the start of Phase 7. The note below was stale.
  ~~**Phase 6 is UNCOMMITTED.**~~ Commit message in §5 of [phase-06](reports/phase-06.md). Exclude
  `public/version.json` and `core/version/app-version.ts` (build-generated, open question 6), and
  **delete the untracked stray harness cache directory rather than committing it** — it is my
  artefact (report §3 item 4) and I am guard-blocked from removing it.
- **Decisions waiting on you, before or with Phase 7:** the **v1 cutover** (now a self-contained
  deletion — 12 files, 8 commented route blocks, plus the `-v2` rename); whether Phase 7 bans
  `admin/<x> → admin/<y>` (**[CORRECTED by Phase 7: 18 live edges, not 7]**, all partner-v2 into route-dead siblings — the pre-phase
  estimate of 8 was one too many, it wrongly counted a directive that now resolves to `admin/core/`);
  and the still-unticked `app.config.ts:23` question.

- 🏁 **PHASE 5 IS COMPLETE and COMMITTED** (`9b8b1ad`, merged at `c6fa152`). Eight sessions, all
  green, all reported. **Zero `shared/` layers remain under `src/app/features/`** (14 → 0);
  `features → features` edges 23 → 2. Report index in the Part A tracker row below.
- ⚠️ **Nine banned edges survive Phase 5 outside `features/`:** `core → shared` **2** ·
  `shared → features` **4** · `layout → features` **1** · `features → features` **2**.
  **Six are `PaymentFacade`.** **Two are dynamic `import()` (`utils.ts:767`, `update-checker.ts:84`)
  — Phase 7's lint config must cover dynamic imports or it will report seven and silently miss two.**
- **Skipped deliberately in Phase 5, available as small follow-ups:** the three placement push-downs
  (`audio-chapter` → `podcast/`, `chapter-quiz` → `micro-learning/`,
  `micro-learning-course-facade` → `micro-learning/`). None is a violation where it sits.
- **Next: `/refactor-phase 7` (boundaries) — the last phase of Part A.**

## Part A tracker

| Phase | Scope           | Status | Report                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Committed                                                                                              |
| ----- | --------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 0     | Audit & plan    | ✅     | [phase-00](reports/phase-00.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |                                                                                                        |
| 1     | Hygiene         | ✅     | [phase-01](reports/phase-01.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |                                                                                                        |
| 2     | Path aliases    | ✅     | [phase-02](reports/phase-02.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |                                                                                                        |
| 3     | Core            | ✅     | [phase-03](reports/phase-03.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |                                                                                                        |
| 4     | Shared & layout | ✅     | [phase-04](reports/phase-04.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |                                                                                                        |
| 5     | Features        | ✅     | `page-not-found` ✅ [phase-05-page-not-found](reports/phase-05-page-not-found.md) · `legal`+`compliance` ✅ [phase-05-legal](reports/phase-05-legal.md) · `connect-us`+`Faq` ✅ [phase-05-connect-us](reports/phase-05-connect-us.md) · `uae-caira` ✅ [phase-05-uae-caira](reports/phase-05-uae-caira.md) · magnet promotion ✅ [phase-05-magnet-promotion](reports/phase-05-magnet-promotion.md) · **dissolve `pages/` ✅** [phase-05-pages-dissolve](reports/phase-05-pages-dissolve.md) · **`auth` ✅** [phase-05-auth](reports/phase-05-auth.md) · **`library` ✅** [phase-05-library](reports/phase-05-library.md) · **`home` ✅** [phase-05-home](reports/phase-05-home.md) · **`tracker` ✅** [phase-05-tracker](reports/phase-05-tracker.md) · **`partners` ✅** [phase-05-partners](reports/phase-05-partners.md) · **`payment` ✅** [phase-05-payment](reports/phase-05-payment.md) · **`offerings` ✅** [phase-05-offerings](reports/phase-05-offerings.md) — **ZERO `shared/` layers left under `features/`**; `features → features` edges 23 → 2; `features → features` down to **2 lines**; last cycle dissolved, sequenced in [PHASE-05-REMAINING.md](PHASE-05-REMAINING.md) | `1462e72`, `d12ae67`, `9961f69`, `15335f5`; `e71cb0f`, `9b0be7c`, `abb3d1b`; **offerings uncommitted** |
| 6     | Admin           | ✅     | [phase-06](reports/phase-06.md) — `admin/shared/` + 12 internal `shared/` layers → **0**; `v2 → v1` edges **39 → 0**; all routed components in `pages/`; 136 renames, 8/8 green, reviewer PASS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **uncommitted**                                                                                        |     |
| 7     | Boundaries      | ✅     | [phase-07](reports/phase-07.md) — **closed ⛔ → ✅ on 2026-09-24: Phase 8 cleared all 8 residual violations, so lint is green and the phase's own definition of done is now met.** Originally: boundaries encoded at `error`; **7/8 gates green, lint red with exactly 8 known violations by your decision**; 1 rename, 3 files of violations fixed; dynamic imports proven covered                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | **uncommitted**                                                                                        |

## Part B tracker

Filled by Phase 0 from PLAN.md §13. Each cell holds a status. **Run features top to bottom** —
ordered smallest/lowest-risk first so the pattern is proven before it reaches `offerings`.
Names are the **post-Part-A** folder names (so `features/tracker` = today's caira-tracker + cpe-tracker).
**`core/services` and `shared/services` were ADDED after Phase 8** (2026-09-24): the original table had
no row for them, so 29 files — 48% of Phase 8's work — were owned by no session. They carry real
Phase 9 and 11 work too (`utils.ts`, `engagement-dialog.ts`, `update-checker.ts`), so they are not a
Phase-8-only artefact. Phase 12 is `—` for both: neither folder holds a component or a `.css` file.
`—` = not applicable to that phase.

**`shared/components` and `shared/dialogs` were ADDED at the start of Phase 9** (2026-09-24), the
third and fourth rows the Phase 0 table never had. They are where the phase's cleanest `httpResource`
conversions actually live — `caira-level-stack` and `surround-carousel` are already
`resource()` wrapping `firstValueFrom(api.get(...))`, which PLAN.md §5 itself calls "the direct
`httpResource` conversions" — while `shared/services/**` turned out to have **zero** candidates.
Without these rows that code was owned by no session, exactly as `core/services` was in Phase 8.

**`features/blog` was REMOVED from this table at the start of Phase 9** (2026-09-24), not skipped:
`src/app/features/blog/` no longer exists. The module was deleted in `890e52d` ("blog section
removed"), so PLAN.md §13's row 2 (_"`features/blog`, 31 files, self-contained, own HTTP client"_) and
PLAN.md §5's claim that `features/blog/services/blog-api.ts` is one of only two files injecting
`HttpClient` directly are **both stale**. Recorded rather than silently dropped so the next session
knows it was checked. ⚠️ **Blog residue survives the module and is NOT Phase 9's job** (dead code:
list only, PROMPT.md §7): `layout/blog-layout/` + its spec, blog entries in `app.routes.ts`,
`src/seo.ts`, `src/server.ts`, `src/legacy-redirects.spec.ts`, `shared/utils/seo/seo-route-slug.ts`,
`layout/footer.ts`, `core/services/analytics/analytics.ts`, and a `BLOG` key in all three
`environment*.ts`. Deleting it is a Part A-shaped cleanup and needs its own approval.

| Feature / area                 | 8 Services | 9 Data | 10 UI | 11 Defer+Lazy  | 12 Tailwind |
| ------------------------------ | ---------- | ------ | ----- | -------------- | ----------- |
| `shared/ui` (primitives)       | —          | —      | ⬜    | —              | ⬜          |
| `core/services`                | ✅         | ✅     | —     | ⬜             | —           |
| `shared/services`              | ✅         | ✅     | —     | ⬜             | —           |
| `shared/components`            | ✅         | ✅     | —     | ⬜             | ⬜          |
| `shared/dialogs`               | ✅         | ✅     | —     | ⬜             | ⬜          |
| `features/library`             | ✅         | ⬜     | —     | ⬜             | ⬜          |
| `features/tracker` (caira+cpe) | ✅         | ⬜     | —     | ⬜             | ⬜          |
| `features/auth`                | ✅         | ⬜     | —     | ⬜             | ⬜          |
| `layout`                       | ✅         | ⬜     | ⬜    | — (above fold) | ⬜          |
| `features/home`                | ✅         | ⬜     | —     | ⬜             | ⬜          |
| `features/partners`            | ✅         | ⬜     | —     | ⬜             | ⬜          |
| `features/payment`             | ✅         | ⬜     | —     | ⬜             | ⬜          |
| `features/offerings`           | ✅         | ⬜     | —     | ⬜             | ⬜          |
| `admin/*` (non-partner)        | ✅         | ⬜     | —     | ⬜             | ⬜          |
| `admin/partner-platform(-v2)`  | ✅         | ⬜     | —     | ⬜             | ⬜          |

Phase 11 also has two **one-off, first-session** items that are not per-feature:
enable `provideClientHydration(withIncrementalHydration())`, and move
`@import 'video.js/dist/video-js.css'` out of the global `styles.css`.
Phase 12's first session moves design tokens into `@theme`.

| Phase | Scope                         | Status | Report |
| ----- | ----------------------------- | ------ | ------ |
| 13    | Partner landing consolidation | ⏸      |        |
| 14    | Documentation                 | ⬜     |        |

## Decisions (owner: user)

Settled for Phase 9 by the user 2026-09-24, AFTER execution:

- [x] **Phase 9 closes ✅ despite `ssr smoke` being red.** PROMPT.md §6 defines done as "the verifier
      reports a full green run", and this phase has 7 of 8. Closed ✅ on the grounds that the red is a
      **stale recorded baseline** rather than a defect: the failure is deterministic (3 harness runs, 5
      direct `curl`s), both route diffs render _more_ correct SEO data than the record,
      `git diff 07afb23..HEAD` over the whole SEO path is **empty**, and nothing in the change set is
      reachable from that path. ⚠️ **This is a deliberate departure from the Phase 7 precedent**, where
      the same "one red gate" situation was closed ⛔ — the difference is that Phase 7's red was a real
      unexempted lint violation, while this one is a measurement artefact. **Recorded so that "Phase 9
      closed ✅ with a red gate" is never cited as a precedent for closing over an unexplained red.**
      The baseline re-record remains open and is tracked separately in "Now".

Settled for Phase 9 by the user 2026-09-24, before execution:

- [x] **Phase 9 / scope: `core/services` + `shared/services` FIRST, not `features/blog`.** These are
      the two rows the tracker lists above `features/blog`. I recommended `features/blog` and flagged
      that these are app-wide singletons whose consumers live in tracker rows that have not run —
      a mistake here breaks the app rather than one page, and per-feature verification is not
      available. The user chose these anyway; the risk is accepted and recorded in the report.
      _(Moot for blog either way: `src/app/features/blog/` was deleted in `890e52d`.)_
- [x] **Phase 9 / `FeatureFacade` IS IN SCOPE — redesign it, not just the easy conversions.**
      I recommended against it in one session: 724 lines, 21 importers, 29 `getResource()` call
      sites, a page accumulator, a runtime-N `forkJoin` fan-out, and a 16-line smoke test for
      coverage. The user chose to include it. Only the **non-track list read** converts; the track
      branch and `getAbout()` stay on RxJS with comments saying why.
- [x] **Phase 9 / `requiresAuth` gets RE-WIRED to `AuthSession.isAuthenticated()`.** It is
      hardcoded `false` today, so seven carousel keys never fetch at all. The options were: log it
      per PROMPT.md §7 (my recommendation — "log bugs, don't fix them"), re-wire it, or delete the
      option. The user chose to re-wire. ⚠️ **This is a deliberate, visible behaviour change**:
      carousels that are silently empty today will start rendering data, so the visual and SSR diff
      for this phase is expected to be non-trivial. That is the intent, not a regression.
- [x] **Phase 9 / `CartStore` IS CONVERTED and `cartResolver` rewritten.** I recommended deferring
      it to the `features/payment` row, where its resolver, guard and pages can be verified together;
      exploration additionally surfaced five concrete objections, the sharpest being that
      `payment-guard.ts:40` reads `loading()` synchronously while `httpResource().isLoading()` is
      `false` before the request fires. The user chose to convert now. The fix is to key the guard and
      resolver on **`status()`**, which distinguishes `idle` from `loading`; `'error'` must be in the
      resolver's filter or a failed cart hangs navigation. **Checkout cannot be proven by the gates
      and needs the user's manual QA**, including a hard refresh on `/payment/billing`.
- [x] **Phase 9 / `FeatureFacade` tests come AFTER the redesign, not before.** I recommended
      characterization tests first, since they are the only thing that could catch a behaviour
      changed by accident on a 21-importer file with no existing coverage. The user chose
      redesign-first. Consequence, stated plainly: the new tests prove the new code does what the new
      code does. The manual QA list carries that weight instead.

Open for Phase 8 — raised 2026-09-24, after execution:

- [ ] **Phase 8 / THE COMMIT BLOCKER — needs your call before Phase 8 can land.**
      `.husky/pre-commit` → `lint-staged` → `eslint --fix` exits 1 on the 4 staged files that carry
      Phase 7's residual violations, so the commit is rejected. Reproduced directly, not inferred.
      **This is not a Phase 8 defect** — Phase 8 introduced no new violation; lint is still exactly 8.
      It is Phase 7's residue meeting a phase that necessarily touches those files, and it will recur
      in **every** remaining Part B phase that edits one of the 6.
      Options, in the order I'd recommend them: 1. **Reverse the Phase 7 "unexempted" decision: a scoped `warn` override for exactly those 6
      files.** ⭐ **Recommended.** PROMPT.md §5 Phase 7 explicitly provides for this — "Violations
      that Part B will fix may be temporary warnings only if the user approves in STATE.md" — and
      there is still an **unticked decision line for precisely this** further down this section.
      So it is the spec's own sanctioned mechanism, **not** weakening a gate: the rule stays at
      `error` everywhere else, and `ng lint` sets no `maxWarnings`, so warnings exit 0 and both the
      hook and `pnpm lint` go green. Each of the 6 entries names its owning phase (10 or 11) so the
      block shrinks to nothing as Part B proceeds, rather than becoming permanent. 2. **Fix the 8 violations now.** Correct but out of order: `notification.ts` needs a real
      dependency inversion (Phase 10, toast migration) and the 7 `PaymentFacade` edges need lazy
      injection (Phase 11). Your Phase 7 decision deliberately deferred both. Large, and it drags
      Phase 10/11 design work into a services phase. 3. **Leave Phase 8 uncommitted until Phase 10/11 clear the residue.** Keeps every rule intact
      and changes no config, but strands ~100 verified files for two phases and means Phases 9-11
      are built on an uncommitted base.
      **`--no-verify` is NOT on this list** — AGENTS.md §9 bans it and I will not use it.

Settled for Phase 8 by the user 2026-09-24, before execution:

- [x] **Phase 8 / scope: ONE SESSION, WHOLE REPO — not twelve per-feature sessions.** The Part B
      tracker's 12 Phase-8 cells are not executable as written: `core/services` (26 files) and
      `shared/services` (3) have no row, so 48% of the work is owned by no session, and bullet 4's lint
      rule is repo-wide and could only land in session 12. All 12 cells close together.
      **Phase 14 must fix the tracker table**, not leave it silently overtaken.
- [x] **Phase 8 / Part A naming cleanup pulled in: drop the v19 type suffixes, 16 renames.**
      `location.service.ts` violates PROMPT.md §1 outright; the guards/pipes/directives are the same
      family. Run as **Step 0, before any decorator edit**, so the Part A move and the Part B rewrite
      stay separable in the diff and `git mv` keeps the history — PROMPT.md's "never mix the two".
      ⚠️ **My question understated this as "7 guard files" from truncated `find` output. The real
      family is 16 source files + 2 sibling specs.** The approval was for "the whole naming family",
      which is what is being executed.
- [x] **Phase 8 / DELETE two dead files — APPROVED by the user 2026-09-24.** This is the deletion
      approval PROMPT.md §7 requires. A narrow exception to the standing "dead code: list only" rule,
      for these two files only: - `core/guards/cpa-landing-match.guard.ts` (`cpaLandingMatchGuard`) — residue from the
      `cpa-landing` cluster deleted in Phase 5 under its own recorded approval; the guard was missed.
      Zero routes wire it up. Confirmed dead by `import-auditor` AND by PLAN.md:488 and
      [phase-05-auth](reports/phase-05-auth.md):122, which both already called it dead. - `core/directives/html-to-pdf.directive.ts` (`HtmlToPdfDirective`, `[appHtmlToPdf]`) — the dead
      half of the "html-to-pdf service + directive" duplicate PLAN.md §2 flagged. Zero importers;
      already called dead by [phase-03](reports/phase-03.md):168 and PLAN.md:185,485.
      **Both deletions are orphan-free, checked:** the guard imports only `@angular/core` and
      `@angular/router`; `html-to-pdf.model.ts` keeps two other consumers (the live service and its own
      spec). Deleting rather than renaming also avoids creating a second `html-to-pdf.ts` basename.

Settled for Phase 7 by the user 2026-09-23, before execution:

- [x] **Phase 7 / the residual violations stay at `error`, UNEXEMPTED.** No per-file `warn` block, no
      `eslint-disable`, no `allow` carve-out. **Consequence accepted in advance: `pnpm lint` fails and
      Phase 7 closes ⛔.** Eight violations remain — seven are `PaymentFacade` and one is
      `Notification → @shared/ui/toast`. **No move clears any of them:** promoting `PaymentFacade` to
      `core/` drags `coupon-dialog` (`payment-facade.ts:39`), `cart-drawer-dialog` (`:625`) and
      `cart-item` in behind it, i.e. the payment domain into core, which the Phase 5 analysis rejected
      on a 13-internal-vs-2-external count. Reversing this decision later is a self-contained config
      block; nothing depends on it.
- [x] **Phase 7 / `admin/<x> → admin/<y>` is NOT banned.** §3 says "admin imports only from core,
      shared, and itself", which permits it. Implemented as a **single `admin` element**, so all
      **18** such edges (not the 7 Phase 6 recorded — the 11 `v1 partner-platform → v2` edges were
      never counted) are intra-element and free. **Re-banning is a one-line change** —
      `pattern: "src/app/admin/*", capture: ["adminFeature"]` — and `eslint.config.mjs` says so at the
      call site.
- [x] **Phase 7 / a `layout → features|admin` ban was ADDED, extending §3.** §3 states outbound rules
      for core, shared, features, admin and testing but is **silent on `layout`**. A literal
      transcription would not have reported `footer-overlay.ts:22`, which STATE.md has counted as a
      banned edge since Phase 5. **Phase 14 must add the layout rule to AGENTS.md §3** so the spec and
      the linter agree.
- [x] **Phase 7 / the class/style directive usages were fixed now, not deferred to Phase 12.**
      2 files, 6 lines, `[class]` binding for an identical class string. Zero usages remain repo-wide,
      so the ban ships at `error` with no exemption.

Settled for Phase 6 by the user 2026-09-23, before execution (all four change the shape of the work):

- [x] **Phase 6 / v1 extraction scope: EMPTY v1 OF EVERYTHING LIVE.** PLAN.md named only 3 dialogs;
      the audit found `reports-v2.ts` imports **7 modules** from v1's `reports/` subtree, plus
      `stat-card` and `allocation-picker`. So: `partner-platform/shared/{models,services}` →
      `admin/core/`; the live `reports/` subtree + `stat-card` + `allocation-picker` + the 3 dialogs
      → `partner-platform-v2/`. v1 keeps only its 5 route-dead pages + `network-firms-dialog` (the
      one dialog with no v2 consumer). **`v2 → v1` edges 39 → 0**; the residual `v1 → v2` edges all
      vanish in one commit at cutover.
- [x] **Phase 6 / `deprecation-banner` → app-level `shared/components/`.** §3 gives `admin/` no
      `shared/`, and the banner has 8 importers across 4 admin features. `admin → shared` is legal;
      same placement rule Phase 4/5 used for `app-download-dialog` and `faq-content`. All 8 consumers
      are route-dead, so it gets deleted with them at cutover.
- [x] **Phase 6 / `users`, `seat-tracker`, `user-onboarding` stay where they are.** Each has a
      route-dead page plus live children consumed **only** by partner-v2 (8 `admin/<x> → admin/<y>`
      edges). Restructure them in place; **log the 8 edges as a Phase 7 decision** rather than fold
      them into v2 ahead of the cutover call.
- [x] **Phase 6 / `admin.routes.ts` stays intact** — no per-feature route-table extraction, despite
      the Phase 5 precedent of 8 extractions. It is 347 lines and the only route file under `admin/`.

- [x] **Phase 5 / DELETE the `cpa-landing` + `Tracks` dead cluster — APPROVED by the user 2026-09-23.**
      This is the deletion approval PROMPT.md §7 requires ("don't delete feature code without approval
      recorded in STATE.md"). **A narrow exception to the standing "dead code: list only, do not
      delete" rule, for this cluster only.** 8 files: `features/cpa-landing/` (6) and
      `features/shared/services/tracks/` (2). Evidence: `cpa-landing` has **zero** references anywhere
      outside itself (no route, no import, no selector usage), and `cpa-caira-section.ts:30` is the
      **only** injector of `Tracks` in the repo — `Tracks` is provided at `features.routes.ts:21` but
      nothing reachable injects it. Knock-on: `features/shared/` disappears, so the `@features/shared`
      path segment is retired, and `features.routes.ts:5` + `:21` lose the `Tracks` import and provider.
      **The other 11 dead files are NOT covered** and still follow the standing rule —
      `blog/pages/blog-list/` (3), `partners/shared/pages/ascpa/` (4),
      `offerings/shared/components/document-chapter/` (4). Executed in session 1.

- [x] **Phase 5 / routed components: shells stay at the feature root — SETTLED by the user
      2026-09-23.** §3 says "routed components always live in `pages/`"; this scopes it. The test is
      mechanical — **does the component contain a `<router-outlet/>`?** — and it splits the 16
      offenders cleanly **4 / 12**.
      **Shells (stay at feature root, beside their `.routes.ts`):** `auth/auth.ts`,
      `features/library/library.ts`, `features/payment/payment.ts`, and
      `payment/shared/components/overview-wrapper/` (11 lines, pure outlet).
      **Pages (move to `pages/`):** `home`, `badge`, `course`, `instructor`, `caira-tracker`,
      `course-badges`, `webinar-badges`, `cpe-tracker`, `masterclass`, `podcast`, `webinar`,
      `micro-learning` — all 12 have no `<router-outlet/>` and 3-16 `inject`/`signal`/`computed`/
      `effect` calls each.
      ⚠️ **One sub-case left to the `payment` session:** `overview-wrapper` is a _nested_ shell (the
      layout for a child route at `payment.routes.ts:80`), not the feature's top shell, so "feature
      root" is ambiguous for it. Recommendation: leave it in `payment/components/` after the flatten
      rather than invent a `layouts/` bucket §3 does not define.

- [x] **PLAN.md approved (Phase 0)** — approved by the user 2026-09-22.
- [x] Baseline recorded on untouched code — done 2026-09-22 (see the course-route caveat, Q8)
- [ ] Phase 6: v1 partner platform removal and v2 → `partner-platform` rename.
      **Phase 0 finding:** v1 is not removable as a unit. Its routed pages are dead (routes commented
      out in `admin.routes.ts`), but `partner-platform/shared/` is the live models/services layer for
      v2 (39 edges) and 6 other admin features (17 edges), and v2 imports 3 dialogs out of v1's dead
      pages. Phase 6 extracts that layer to `admin/core/` first; removal is a later decision.
- [ ] Phase 7: temporary warnings allowed for violations Part B will fix. **Expected list:** the
      `Utils` → shared-dialog imports that Phase 11 converts to dynamic `import()`.
- [ ] Phase 10: CDK usages. **Phase 0 finding: only 2 exist** — `CdkTrapFocus` (`layout/header`) and
      `BreakpointObserver` (`how-to-claim-credly-badge`). ng-primitives has no equivalent for either.
      **Recommendation: keep both**, migrate neither.
- [ ] Phase 13: consolidate partner landing pages (yes/no). **Phase 0 finding: strongly supported** —
      `ctcpa` vs `dscpa` differ by 8 hunks, all name/id swaps; 10 of 12 pages collapse into one
      config-driven page. See PLAN.md §10.
- [x] ~~Components with explicit `ChangeDetectionStrategy.Eager`~~ — **NOT APPLICABLE.** All 18
      explicit `changeDetection:` lines in `src/` are `OnPush`; there are zero `Eager` and zero
      `Default`. Closed by Phase 0.

New decisions raised by Phase 4 — **five PLAN.md Phase 4 rows were refused**, on the same test
Phase 3 used: execute the rows that clear a boundary violation, refuse the ones that create one.
Each needs your call before the phase that would own it.

- [ ] **`app-download-dialog` must NOT go to `features/home/`.** Its importers are `features/home`
      **and** `features/offerings` — two features, so §3's placement rule puts it in `shared/`.
      Recommendation: **strike the row**; it is shared UI.
- [ ] **`certificate-download-dialog` must NOT go to the tracker.** Importers are
      `features/cpe-tracker`, `features/library` and `Utils` — again two features.
      Recommendation: **strike the row.**
- [ ] **`subscription-dialog` → `features/payment/` is net zero, so it was not done.** Its only two
      importers are `Utils` and `EngagementDialog`, both of which now live in `shared/services/`.
      Moving the dialog would trade its 2 outbound `→ features/payment` edges for 2 new inbound
      `shared → features` edges, and the new ones are **static** where nothing improves.
      Recommendation: **defer to Phase 11**, which converts those two services' dialog imports to
      dynamic `import()` and unblocks the move properly.
- [ ] **`faq-content` → `shared/components/` was NOT done — PLAN.md §2 finding 2 is wrong about it.**
      The finding claims 16 importers "across offerings, blog, home, partners, uae-caira, connect-us
      and pages/shared", which is what justified promoting it to `shared/`. The real count is **5**,
      and every one is inside `pages/faq` (3) or `pages/shared` (2, the legal-doc/legal-section
      components). The 12 `features/* → pages/faq` edges PLAN.md §2 counts are imports of the routed
      **`pages/faq/faq`** page component, not of `faq-content`. Both actual consumers become Phase 5
      features (`features/faq`, `features/legal`). Recommendation: **strike the row** and let Phase 5
      decide, since after that phase the import may not cross a feature boundary at all.
- [ ] **`{cpe-tracker,caira-badge,badge}.model.ts` stay in `core/models/` — closing the Phase 3 row.**
      Phase 3 deferred these here on the theory that their dialogs were the blocker. They are not.
      `cpe-compliance-dialog` and `caira-badge-info-dialog` did move out this phase, and the models
      still cannot follow, because the real blockers are shared **cards** that §3 keeps in
      `shared/components/`: `cards/badge-{card,course-card,level-card}`, `cards/badge-hero-card`, and
      `caira-level-stack`. `shared → core` is legal and `shared → features` is not, so leaving the
      models in core is the boundary-correct outcome, not a compromise.
      Recommendation: **strike all three rows permanently** — they are core models.

Also settled by Phase 4, no action needed:

- [x] **`admin-rbac.model.ts` moved to `admin/core/`** as the Phase 3 row recommended, together with
      `edit-admin-roles-dialog`. 13 specifiers repointed; `core/models/admin/` no longer exists.
- [ ] **Correction to the Phase 3 claim that Phase 4 closes the last `core → features` edge.**
      It does not. Moving `utils.ts` into `shared/services/` **relabels** that edge `shared → features`,
      which §3 bans just as firmly. `utils.ts` still imports `PaymentFacade` statically (line 48) and
      `cart-drawer-dialog` dynamically (line 767). This is a **Phase 11** item — and note that
      promoting `PaymentFacade` into `core/` the way `FeatureFacade` was promoted in Phase 3 is the
      wrong fix here: it would pull the payment domain into core. **Confirm you are content for this
      edge to survive Part A.**

New decisions raised by Phase 3 — **PLAN.md §3's Phase 3 push-down table is partly wrong.**
The `import-auditor` sweep (35 files, 128 references) found that 6 of its rows would create a new
boundary violation instead of clearing one. I executed the rows that are safe and stopped on these.
Each needs your call before the phase that owns it:

- [ ] **`models/seo.models.ts` + `services/seo/supabase-seo.ts` must NOT go to `admin/seo/`.**
      PLAN.md sends them there, but `core/services/seo/seo-manager.ts` imports both, and
      `shared/utils/seo/course-seo-{config,setup}.ts` import `SeoConfig`. That is the SEO render path
      for **every page on the site**, not an admin path — the move would force `core → admin` and
      `shared → admin`. Recommendation: **strike these two rows from the plan**; they are core.
- [ ] **`models/form.model.ts` is not an offerings model.** PLAN.md sends it to `features/offerings/`,
      but it holds the generic `SelectOption` / `AutoCompleteOption` types used by
      `core/services/job-sectors`, `shared/components/ui/autocomplete`, `shared/components/enquiry-form`
      and `shared/components/dialog/firm-sponsorship-dialog`. Recommendation: **strike the row**; it is core.
- [ ] **`models/video-player.model.ts` + `constants/video-player.ts` cannot go to `features/offerings/`.**
      `shared/components/{video-js,audio-js}` both import **and re-export** `VideoState`/`PlayerMode`,
      so every consumer of those players would transitively depend on `features/offerings`. PROMPT.md §3
      explicitly lists `video-js` under `shared/components/`. Recommendation: **strike the rows**; they are core.
- [ ] **`models/{cpe-tracker,caira-badge,badge}.model.ts` are blocked by shared UI, not by core.**
      Six `shared/components` cards/dialogs (`badge-hero-card`, `badge-info-dialog`,
      `badge-claim-upsell-dialog`, `cpe-compliance-dialog`, `caira-level-stack`,
      `caira-badge-info-dialog`) and three `shared/components/cards/badge-*` import them directly.
      PLAN.md §3 **Phase 4** already moves feature-specific dialogs to their owners. Recommendation:
      **move these three models in Phase 4/5, after their dialogs move** — not in Phase 3.
- [ ] **`models/admin/admin-rbac.model.ts` is blocked the same way**, by
      `shared/components/dialog/edit-admin-roles-dialog`. PLAN.md §3 Phase 4 (line 216) already assigns
      that dialog to `admin/`. Recommendation: **move the model in Phase 4 with its dialog.**
      Consequence today: `core/models/admin/` holds exactly one file.
- [ ] **Phase 3 added a move PLAN.md does not list: `core/interceptors/admin-token/` → `admin/core/interceptors/`.**
      It was mandatory — that interceptor imports `AdminAuth`, `AuditLog` and `AuditCategory` directly,
      so moving those three to `admin/core/` without it would have inverted the layering to `core → admin`.
      PROMPT.md §3 lists interceptors under `admin/core/`, so this is the spec-correct home, but note it is
      still registered globally in `app.config.ts` (`withInterceptors`), which now imports from `@admin/`.
      **Confirm you are happy with the composition root reaching into `admin/`.**
- [ ] **Phase 3 deferred PLAN.md's faq / legal / milesverse / faculty / auth push-downs (12 files) to Phase 5.**
      Every consumer still lives in `src/app/pages/**` or `src/app/auth/`, and none of the destination
      feature folders exist yet. Doing them now would create five near-empty feature folders and split each
      feature across two phases. Recommendation: **accept** — Phase 5 moves each feature's pages and its
      constants/models/services in one session.

New decisions raised by Phase 0:

- [x] **Phase 5: dissolve `pages/` — DONE 2026-09-23, the folder is deleted.** Every destination was
      settled: `instructor-details` → `features/library/instructor/` (user's call, overrides PLAN.md),
      `faculty` → its own feature, `ai-labs`/`milesverse`/`how-to-claim-credly-badge` per PLAN.md, and
      `pages/shared` had already dissolved with `legal`. Original:
      Phase 5: dissolve `pages/` per PLAN.md §3 (the target structure has no top-level `pages/`;
      the destination of each page folder is the judgement call).
      **Still unticked, and `page-not-found` was run against it anyway — deliberately, for that
      feature only.** Its destination is not a judgement call: PROMPT.md §5 mandates
      `app/pages/*` → `features/` outright, and PLAN.md §3's Phase 5 table names this exact folder's
      destination in an already-approved plan. **Tick this before the features where the destination
      genuinely is a judgement call:** `faq` (and whether `faq-content` follows it), the three legal
      folders (`privacy-policy`, `terms-of-service`, `compliance` + `pages/shared/components/legal-*`),
      `instructor-details` vs `faculty` (PLAN.md sends them to two different features), and
      `pages/shared` itself.
- [x] **Phase 5 / `compliance` placement — REVERSED by the user 2026-09-22 and confirmed.**
      It lives at **`features/legal/pages/compliance/`**, per PLAN.md's grouping, not the separate
      `features/compliance/` that commit `d12ae67` created. The zero-shared-code finding still stands
      as a fact; it simply was not the deciding factor. Report corrected.
- [x] **Phase 5 / `legal` — SETTLED by the user 2026-09-22, all three calls. Executed; see
      [phase-05-legal](reports/phase-05-legal.md).** Outcome: (1) `compliance` → its **own**
      `features/compliance/`; (2) `faq-content` → `shared/components/` ✅ done; (3) `faq.model.ts` →
      `features/faq/models/` **accepted but deferred to the `faq` session** (`features/faq/` does not
      exist yet). ⚠️ **(2) and (3) are jointly inconsistent with §3** — see the `faq` item below.
      Original analysis kept for reference: 1. **Does `compliance` join `features/legal/`?** It shares **zero** code with the other two legal
      pages (verified: no shared component, model, constant or util). Options: (a) **own
      `features/compliance/`** — recommended, it is a security-documentation PDF viewer, not a legal
      document page; (b) `features/legal/pages/compliance/` per PLAN.md, accepting that the grouping
      is topical only. 2. **`faq-content` → `shared/components/faq-content/`?** Now **provable**: its consumers are
      `legal-doc` + `legal-section` (→ `features/legal`) and `faq-item` (→ `features/faq`) — two
      top-level features, so §3's placement rule promotes it to `shared/`. **Recommendation: yes.**
      This closes the Phase 4 deferral, whose premise ("the import may not cross a feature boundary
      after Phase 5") is now disproved. Note PLAN.md §2 finding 2's importer count (16) stays wrong;
      the real count is 3 non-spec. Right destination, wrong reasoning. 3. **`core/models/faq.model.ts` stays in `core/` — strike PLAN.md §3's Phase 3 row.**
      `richContent`/`FAQContent` feed **both** the legal constants and the faq components, so
      sending it to `features/faq/models/` would create `features/legal → features/faq`. Same class
      of error as the six Phase 3 rows already refused. **Recommendation: strike the row.**
      Consequence: `core/constants/{privacy-policy,terms-of-service}.ts` and
      `core/models/legal-doc.model.ts` may still move down into `features/legal/`, because
      `features/legal → @core/models/faq.model` is a legal direction.
- [x] **Phase 5 / `Faq` component — SETTLED 2026-09-22: option (a), promoted to
      `shared/components/faq/`. Executed; see [phase-05-connect-us](reports/phase-05-connect-us.md).**
      All 13 banned edges cleared outright. Knock-on: `pages/faq/` is empty and deleted, so there is
      **no `features/faq/`**. Original analysis kept for reference:
      **Blocks `connect-us`, and 13 import sites in total.** Raised 2026-09-22 by the `connect-us`
      audit. `Faq` is the routed `/faq` page **and** an embeddable section — `faq.ts:14` has a
      `standalone` input that exists purely for embedding. **13 files import it**, spanning **7
      top-level features**: `offerings` (6), `blog` (3), `home`, `partners`, plus `connect-us` and
      `uae-caira` which become features this phase. §3's two rules conflict here: the placement rule
      says promote to `shared/`; "routed components always live in `pages/`" says keep it in the
      feature. - **(a) Promote the whole component to `shared/components/faq/`.** A pure move, zero logic
      change, clears all 13 edges at once, and directly follows the placement rule — the same
      reasoning already approved for `faq-content`. Cost: a routed component lives in `shared/`, so
      `features.ts` would route `component: Faq` out of `@shared/`. **Recommended.** - **(b) Keep it in `features/faq/pages/faq/` and accept 13 `features → features` edges**, all
      covered by a Phase 7 temporary-warning exemption. Cheapest now, largest permanent residue, and
      it makes `features/faq` a dependency of most of the app. - **(c) Split it: a shared `faq` widget plus a thin routed page that wraps it.** The correct end
      state, but it is a **logic change**, which Part A forbids — so this is Part B (Phase 10/12)
      work and `connect-us` would stay blocked until then. Not recommended for now.
- [x] **Phase 5 / `faq` — DISSOLVED 2026-09-22, not resolved.** Promoting `Faq` to `shared/` empties
      `pages/faq/`, so **`features/faq/` does not exist** and the decision to move `faq.model.ts` there
      has no destination. `faq.model.ts` and `constants/faq.ts` stay in `core/` — the originally
      recommended outcome — and PLAN.md §3's Phase 3 row for them is permanently moot. Original:
      `shared/components/faq-content` imports `FAQContent` from `faq.model`. Moving `faq.model.ts` into
      `features/faq/models/` turns that into **`shared → features`**, which §3 bans outright — a
      stricter ban than the `features → features` edge decision 3 accepted, and not fixable by a move.
      Options: (a) **`import type` + a Phase 7 temporary-warning exemption** — the type is erased at
      runtime, so the edge is compile-time only (recommended, smallest change); (b) move **only**
      `FAQContent` / `richContent` into `shared/` and leave the rest of `faq.model.ts` in the feature;
      (c) revert decision 3 and keep `faq.model.ts` in `core/`. `faq.model.ts` is untouched today.
- [x] **Phase 5: the cross-feature "magnet" components — SETTLED 2026-09-22, user chose option (a):
      promote ALL SIX. Executed as SEVEN;** see
      [phase-05-magnet-promotion](reports/phase-05-magnet-promotion.md).
      5 components → `shared/components/`, and **both icon files → `core/constants/`** (plain SVG
      string constants, zero imports; §3 sends non-UI to `core/` and gives `shared/` no `models/`).
      The seventh, `partner-icons.ts`, was **not on the list but mandatory** — `partner-content-list`
      imported it, so promoting without it would have created the very `shared → features` edge the
      step removes. ⚠️ **Phase 0's separate `home/components/offerings/*` item (claimed 14 importers)
      is still open and still unverified — PLAN.md's counts have been wrong twice; re-derive it.**
      Original analysis kept for reference:
      Raised by Phase 0, **now blocking nothing but growing**: the `uae-caira` move (2026-09-22)
      converted 6 of these from unclassified `pages → features` edges into §3-banned
      `features → features` edges. PLAN.md §3 wants them resolved **in Phase 5**.
      **Counts re-derived from the import graph** (PLAN.md's have been wrong twice):

      | Component (current home) | own feature | external features | total |
                                                                                                                                                                                                                          | --- | --- | --- | --- |
                                                                                                                                                                                                                          | `partners/shared/components/partner-content-list` | 11 | offerings (3), home, library, uae-caira | **5** |
                                                                                                                                                                                                                          | `partners/shared/components/caira-steps-grid` | 1 | uae-caira | 2 |
                                                                                                                                                                                                                          | `partners/shared/components/caira-feature-grid` | 1 | uae-caira | 2 |
                                                                                                                                                                                                                          | `partners/shared/models/caira-step-icons` | 1 | uae-caira | 2 |
                                                                                                                                                                                                                          | `home/components/app-download` | 1 | uae-caira | 2 |
                                                                                                                                                                                                                          | `offerings/webinar/shared/components/webinar-registration-form` | 2 | uae-caira | 2 |

                                                                                                                                                                                                                          All six meet §3's "2+ top-level features → promote to `shared/`" bar, and Phase 4 set the
                                                                                                                                                                                                                          precedent by keeping `app-download-dialog` in `shared/` on exactly a 2-feature count.
                                                                                                                                                                                                                          **`partner-content-list` is the strong case at 5 features; the other five are 2-feature only
                                                                                                                                                                                                                          because `uae-caira` exists.** Note Phase 0's separate `home/components/offerings/*` item
                                                                                                                                                                                                                          (14 importers) is still open and unverified — treat its count with the same suspicion.
                                                                                                                                                                                                                          - **(a) Promote all six.** Follows §3 and PLAN.md literally; clears every edge. ~20 files across
                                                                                                                                                                                                                            partners (11 pages), offerings, home, library.
                                                                                                                                                                                                                          - **(b) Promote only `partner-content-list`**, leave the other five for Phase 7's
                                                                                                                                                                                                                            temporary-warning list. Smallest diff that fixes the real magnet. **Recommended.**
                                                                                                                                                                                                                          - **(c) Make `uae-caira` a sub-feature of `partners`.** Four of the six edges point into
                                                                                                                                                                                                                            `partners/shared/`, and `partners` already owns `caira-landing`, so this dissolves them
                                                                                                                                                                                                                            structurally. Contradicts PLAN.md's explicit `pages/uae-caira/ → features/uae-caira/` mapping,
                                                                                                                                                                                                                            so it needs an explicit override.

- [ ] **`features/shared/services/tracks/` has no home in the target structure.** Raised 2026-09-23.
      It sits at the `features/` root, which §3 does not contain. Importers are
      `features.routes.ts:5` (route `providers`) and
      `cpa-landing/shared/components/cpa-caira-section.ts:9` — **one feature plus a route config**, so
      §3's "2+ features → promote" bar is not met. Options: (a) push down to
      `features/cpa-landing/services/tracks.ts`, which is the literal placement rule but leaves a
      route table at the `features/` root importing out of a feature; (b) promote to
      `core/services/tracks/` as a non-UI singleton. Needed before `app/pages/`'s sibling folder can
      be called done.

- [ ] Phase 11: how to fix the **839 KB gzip** `constant/location-min.ts` chunk — serve from the API
      (`v2/locations/autocomplete/` already exists) or `await import()` behind the country field.
      Biggest single perf win in the audit.

Decisions the user already settled in-session on 2026-09-22 (recorded, no action needed):

- [x] Trackers: **merge** `caira-tracker` + `cpe-tracker` → `features/tracker/{caira,cpe}/` in
      Phase 5, breaking their circular dependency.
- [x] Dead code: **list only, do not delete.** Consequence: `constant/location.ts` (25 MB,
      969,250 lines, zero importers) gets `git mv`'d in Phase 3 and stays in the ESLint ignore list.
- [x] `Utils` service: **move to `shared/services/utils.ts`** in Phase 4, not into `core/`.

## Findings from the Phase 5 `pages/` dissolution (logged, not fixed — PROMPT.md §7)

0. **`home/components/offerings/*` — the count is RESOLVED, third PLAN.md miscount.** Re-derived
   2026-09-23. PLAN.md §3 claims "14 importers from `features/partners`". It is **14 import LINES
   across 7 files, and all 7 are in `partners`** — one external feature, not fourteen importers.
   `offerings.ts` (the `Offering` type) and `offerings.config.ts` (`PARTNER_OFFERINGS`,
   `MGI_PARTNER_OFFERINGS`, `CPA_CANADA_OFFERINGS`) are each imported by
   `ctcpa`, `mgi-world`, `dscpa`, `allinial-global`, `cpa-canada`, `mgi-north-america`, `hawaii`.
   It still clears §3's "2+ top-level features" bar (`home` + `partners`), so promotion to `shared/`
   is still right — but it is an ordinary 2-feature magnet like `app-download` was, **not** the
   headline case PLAN.md makes it sound. Do it in the `partners` session, where all 7 consumers live.

1. ⚠️ **A `core → shared` edge exists and predates this session.**
   `core/services/notification/notification.ts:3` imports `@shared/ui/toast/toast`. §3 bans it
   outright. It arrived in Phase 4 (`7b3c7cc`) and nothing this session touched it. **Phase 7's
   boundary rules will flag it**, and unlike the `shared → features` residue there is no Phase 11 plan
   for it — the fix is either moving the toast component or inverting the dependency.
2. **All three environment files set `redirectPath: '/auth/ai-labs-callback'`, but no
   `ai-labs-callback` route exists anywhere in `src/`.** `authRoutes` has `login` and `profile` only.
   Dead config or a broken OAuth callback. Recorded specifically so it is not later blamed on the
   ai-labs move.
3. **`instructor-details.css` is 0 bytes but still carries a `styleUrl`** (`instructor-details.ts:62`)
   — Phase 12, joining `page-not-found.css` and `connect-us.css`.
4. **Dead exports:** `milesverse.model.ts:104,113` (`scenarioImage`, `subjectImage`) are imported
   nowhere; `AiLabReportQuestion` and `AiLabFlowCheck` in `core/models/ai-lab-assessment.model.ts` are
   exported but never imported by name.
5. **`MOCK_WORKFLOWS` is mock data now living in `core/models/`, not `src/app/testing/`.** Phase 1's
   mock rule does not apply — it is imported by production code, because `AiLabSubmission` is itself a
   documented stand-in until the backend endpoint exists. Revisit when that endpoint lands.
6. **`payment/shared/service/payment-facade/payment-facade.ts` is 857 lines**, the largest single file
   in `features/`. Noted for the session that does the `service/` → `services/` rename: the rename is
   trivial, that file is not.

## Findings from Phase 2 (logged, not fixed — PROMPT.md §7)

1. **Six component `.css` files use `@reference '../../../../styles/styles.css'`.** TS path aliases do
   not cover CSS — Tailwind resolves these on disk — so they break when those components move in
   **Phase 4**. PLAN.md does not cover them.
2. **Phase 3's reference-update checklist**, beyond the move itself. None are alias problems; all are
   hardcoded `src/app/shared/core/...` paths in the same blast radius:
   - `tsconfig.json` **and** `.storybook/tsconfig.json` — the `@core/*` target
   - `tsconfig.spec.json` — explicit `include` of `"src/app/shared/core/constant/icon.ts"`
   - `eslint.config.mjs` — `ignores` entries for `constant/location.ts` and `location-min.ts`
   - `angular.json` — the `fileReplacements` pair for
     `src/app/shared/core/interceptors/dev/dev-interceptors.ts`
   - `scripts/generate-version.mjs:42` — **writes** `src/app/shared/core/version/app-version.ts`
     (harness-owned; the user edits this one)

## Findings from spec repair (logged, not fixed — PROMPT.md §7)

These are environment and product observations the repair surfaced. None changed production code.

1. **`environment.production` is `false` during `ng test`.** The unit-test builder resolves
   `environment.development.ts` (UAT API URL) — confirmed by probe. Anything gated on
   `environment.production` is therefore **dead code under test by default**; `SalesforceLead.create`
   had three assertions passing vacuously against a method that had already returned. `vi.mock` is
   rejected outright for relative imports by the Angular unit-test system, so that spec flips the
   flag on the shared object and restores it in `afterAll`. Worth deciding whether the test target
   should point at the production configuration instead.
2. **Zoneless TestBed changes how host specs must be written.** Reassigning a plain field on a test
   host and calling `detectChanges()` no longer marks the view dirty, so the binding keeps its old
   value and the test asserts stale DOM without failing loudly. `section-nav.spec.ts` was doing
   exactly this. Test hosts need **signal** inputs. Any spec written before this is suspect.
3. **Two jsdom gaps are now polyfilled centrally in `src/test-setup.ts`:** no `IntersectionObserver`
   (constructed unguarded inside `afterNextRender` by section-nav, the three library pagination
   pages and the tracker badge lists — it threw on a timer and Vitest blamed unrelated suites), and
   no `Blob.prototype.text` (so `partnerBlobErrorMessage()` always fell into its catch and its test
   asserted the fallback string instead of the path it names).
4. **`video-list-wrapper`: the `videoList` default of `[]` is unreachable.** The template
   dereferences `activeVideo().videoSrc` with no guard, so rendering it with the default throws.
   Every real call site passes a list. Either the default should go or the template should guard.
5. **`badge-info-dialog` close button lost its specific accessible name.** It now renders the shared
   `<app-button variant="close">`, whose `aria-label` is hard-coded to `'Close'`; the spec was still
   looking for `'Close badge dialog'`. A generic "Close" is a small a11y regression on a dialog.
6. **`footer-overlay.isAllowedRoute` is NOT a product bug** — closes open question 5. The spec
   contradicted itself: one test asserted descendants match, the next asserted a `masterclass`
   descendant must not. Prefix matching is intended; `CONTINUE_CARD_ROUTES` + `isExactRoute` exist
   precisely to narrow the Continue Learning card alone. The expectation was corrected, not the code.
7. **`section-nav` docking in jsdom** — confirms open question 4. `getBoundingClientRect()` is
   all-zeros, so `rect.top (0) <= TRIGGER_OFFSET (80)` and the service always reports
   `showInHeader`, hiding the inline nav. The render tests opt out via `shareWithHeader`; the
   docking rule now has its own two tests instead of silently breaking the other six.
8. **`micro-learning-course.spec.ts` had a drifted hand-written facade stub** (missing
   `scrollToIdRequest`). Replaced with the real route-scoped facades behind the testing HTTP
   backend, which cannot go stale. Other specs with hand-written facade stubs carry the same risk.

## Findings from Phase 5 (logged, not fixed — PROMPT.md §7)

1. **`page-not-found.css` is 0 bytes but still carries a `styleUrl`.** Kept deliberately — deleting
   emptied CSS is PROMPT.md §4.6, a **Phase 12** item. Recorded so Phase 12 need not rediscover it.
2. **`page-not-found.html`'s "Return Home" control is a `<button role="link" routerLink="/">`.**
   `routerLink` on a `<button>` does navigate, but the element is not a real link: no `href`, no
   middle-click, no open-in-new-tab, no copy-link-address, and link semantics are asserted via `role`
   instead of being native. An `<a routerLink="/">` with the same classes would be correct.
   Pre-existing; untouched by this phase.

## Findings from the Phase 5 `legal` audit (logged, not fixed — PROMPT.md §7)

1. **`/compliance` is registered twice, at inconsistent scopes, and has no locale-scoped page route.**
   `app.routes.ts:25` mounts it **top-level** (`/compliance`, outside `:country/:profession_type`), and
   `features.ts:77` mounts it **only** under the mobile-webview subtree
   (`/:c/:p/mobile/compliance`). There is no `/:c/:p/compliance`. `footer.ts:168` links to the
   unscoped `/compliance`, and `legacy-redirects.spec.ts:188` asserts `/compliance` is deliberately not
   a legacy path — so the current shape looks intentional, but it is the only page in the app that
   works this way. Worth confirming before Phase 13/14 documents the route map.
2. **`pages/shared/` holds exactly two components** — `legal-doc` and `legal-section`, nothing else.
   No services, no barrel. Moving the legal feature therefore dissolves `pages/shared/` completely,
   which is one of the four folders the "dissolve `pages/`" decision names.
3. **Name collision already handled, do not "tidy" it:** `legal-section.ts` exports a **component**
   named `LegalSection`, while `@core/models/legal-doc.model.ts` exports an **interface** of the same
   name. The component file imports the interface aliased as `LegalSectionModel` (`legal-section.ts:2`).
   Renaming either during the move would be a logic-adjacent change Part A forbids.
4. **`legal-doc` has no spec and `legal-section` has no spec.** Both are untested; `privacy-policy`,
   `terms-of-service` and `compliance` each have one. Not a refactor blocker — noted because Part B
   Phase 9/10 will touch these.
5. **19 URL-string references to `privacy-policy` / `terms-of-service` / `compliance` exist and must
   not be touched by any move** — `src/seo.ts:77-78` (`STATIC_PATHS`, the prerender/sitemap list),
   `core/models/seo.constants.ts:95-96`, a seeded Supabase `seo_pages` row
   (`supabase/migrations/20260427000000_seo_pages.sql:157`), `legacy-redirects.ts:67-68` + its spec,
   `layout/footer/footer.ts:164,168,172`, `auth/.../login.ts:39-40`,
   `features/payment/.../invoice.ts:65`, `shared/components/enquiry-form/enquiry-form.html:44,48`,
   `pages/faculty/faculty.html:259,265`, `shared/components/consent-banner/consent-banner.html:20`
   (a hardcoded absolute `/us/accounting/privacy-policy`), and an inline `<a href="/privacy-policy">`
   inside `core/constants/terms-of-service.ts:26`. All key off the **URL**, not the file path.

## Findings from the Phase 5 `connect-us` audit (logged, not fixed — PROMPT.md §7)

1. **STATE.md carry-over (c) was wrong and is now corrected.** It claimed the `features/* → pages/faq`
   edges "clear when `pages/faq` becomes `features/faq`". They **relabel** to `features/* → features/faq`,
   which §3 bans identically — the same relabeling error as the Phase 3 `utils.ts` claim that Phase 4
   corrected. No edge is cleared by that move; only a decision on `Faq`'s home clears them.
2. **`connect-us` is almost nothing of its own.** The whole component is
   `<app-enquiry-form [enquiry_type]="…" /> <app-faq />` inside one container div, with a single
   `enquiryType` input. Once `Faq`'s home is settled the move is ~4 files and one import line.
3. **`connect-us.css` is empty (0 bytes) but still carries a `styleUrl`** — same Phase 12 item as
   `page-not-found.css`.
4. **`connect-us` has no story and no inbound import besides its own spec.** Its only registration is
   the lazy `loadComponent` at `features.ts:91-93` — it is the first Phase 5 feature that is genuinely
   lazy-loaded, unlike `page-not-found` and the legal pages, which are all eager.
5. **URL strings that must not change:** `seo.ts:79` (`STATIC_PATHS`), `legacy-redirects.ts:189`
   (`/accounting/help-desk` → `/{c}/{p}/connect-us`), `legacy-redirects.spec.ts:31,164`, and
   `features/payment/shared/pages/plan/plan.ts:285` which navigates to `/${country}/${profession}/connect-us`.
   All key off the URL segment, not the file path.
6. **False positive worth recording so nobody chases it:**
   `pages/how-to-claim-credly-badge/how-to-claim-credly-badge.html:36` contains
   `scrollToSection('connect-us')` inside a **commented-out** button — a dead in-page anchor id, not a
   route or a component reference.

## Open questions (from Claude)

-1. **[RESOLVED 2026-09-23 — restored on the user's instruction; did NOT recur.]** The recorded
baseline was overwritten at some point on 2026-09-23. `git restore` put both files back (`at` =
`2026-09-22T13:14:25.980Z`, lazy = 10254.9 / 3042.3). **The next full `verify.mjs` run — the auth
session, 8/8 green — left that directory completely clean**, checked immediately afterwards, so an
ordinary run does NOT rewrite it and my first diagnosis was wrong. The overwrite most likely came
from an explicit recording run earlier that day. **Cause unconfirmed, so keep checking that
directory's git status after every full verifier run** until it is understood. Original report:
Discovered 2026-09-23. `docs/refactor/baseline/bundle.json` and `ssr.json` are both dirty in the
working tree. `bundle.json`'s `at` stamp moved from `2026-09-22T13:14:25.980Z` to
`2026-09-23T06:00:54.440Z`, and its `lazy` figures moved from **10254.9 / 3042.3** to
**10256.7 / 3043** — exactly the _current_ post-refactor numbers the verifier reported as the
delta. **The baseline now equals the present state, so it no longer measures anything.**
`ssr.json`'s change is only a stripped trailing newline, but it came from the same run.
I did not and cannot write these — they are guard-fenced as user-owned, and PROMPT.md section 2.3
reserves baseline recording to you. Left untouched deliberately.
**Fix before the next session:** `git restore docs/refactor/baseline/`
Left uncorrected, every remaining Phase 5 session and all of Part B would compare against a
baseline that already contains this phase's changes, and a real bundle regression could pass the
gate silently. Also worth checking whether `scripts/refactor/verify.mjs` rewrites the baseline on
an ordinary run rather than only when explicitly asked — if it does, this recurs every session.

0. **NEW (Phase 0) — bugs found, logged not fixed** (spec §7). Full list in
   `reports/phase-00.md` §3. The ones worth acting on outside the refactor:
   `--radius-4xl` is used at `styles.css:297,303,308` but never defined; the 8 `@ng-icons/*` packages
   are in `devDependencies` while production code imports them via `configuration/ng-icon.ts`;
   `lenis` is an unused dependency; `app.config.ts` wires a dev-only mock interceptor into the
   production root injector (Phase 1 fixes that one). Two AGENTS.md §9 statements are stale —
   `pnpm start` uses port **4101** not 4100, and the initial bundle is **501.9 KB**, not "near its
   2.00 MB budget". Phase 14 should correct both.
1. ~~**Branch.**~~ **RESOLVED 2026-09-22.** We are on `refactor/structure-1` with a clean working
   tree, so Phase 1 is free to move source once the test gate is green.
2. ~~**Storybook gate.**~~ **RESOLVED 2026-09-22.** User chose restore. `git checkout 8271fa4^ -- .storybook`
   brought back main/preview/manager/tsconfig×2/typings; `pnpm build-storybook` completes successfully.
   Config-only, nothing under `src/`.
3. ~~**Unit tests.**~~ **RESOLVED 2026-09-22** — `prompts/spec-repair.md` approved and executed;
   `ng test` is 0 failed and the full verifier is 8/8 green. Original analysis kept below for
   reference; the live group counts turned out to differ (see "Now").
   _Historical:_ Implementation prompt written to `prompts/spec-repair.md` (AGENTS.md §1 step 5).
   Root causes now traced; 58 of 79 are mechanical:
   - 16 × missing `provideRouter([])` / `ActivatedRoute`
   - 16 × `NG0950` required input never set (`setInput` + `__mocks__/content.mock.ts`)
   - 13 × route-scoped facades not in the spec's `providers` (`MasterclassFacade` 6, `ChapterFacade` 4,
     `FinalAssessmentFacade` 2, `Tracks` 1)
   - 7 × dialog specs missing their data/ref token
   - 3 × specs making **real network calls** to `https://uat-api.milescaira.com` (library badge/course/
     instructor) — need `provideHttpClientTesting()`
   - 2 × `IntersectionObserver` undefined → new `src/test-setup.ts` wired via `angular.json`
   - ~22 × genuine assertion failures, judged individually
4. ~~**`section-nav.spec.ts` (7 failures)**~~ **RESOLVED 2026-09-22.** Confirmed, plus a second
   cause the original diagnosis missed: zoneless change detection meant the host's plain `mode`
   field never reached the binding, so the sidenav tests were asserting against an inline render.
   See findings 2 and 7 above. Original note kept below. `shareWithHeader` defaults
   `true`; `afterNextRender` → `registerNav` → `checkNavPosition()` reads `getBoundingClientRect()`,
   all-zeros in jsdom, so `0 ≤ TRIGGER_OFFSET (80)` sets `showInHeader = true` and the inline
   `@if (!shareWithHeader() || !showInHeader())` renders nothing. Probe confirmed: same host renders
   full markup in `sidenav` mode, four empty `<!--container-->` comments in `inline`. Spec fix
   (`[shareWithHeader]="false"`), not a component change.
5. ~~**Suspected real bug**~~ **RESOLVED 2026-09-22 — it was NOT a product bug.** The spec
   contradicted itself; prefix matching is the intended design. See finding 6 above. No production
   fix was needed, so "0 failed" was reachable without you approving any. Original note below.
   "rejects routes outside the allowlist" expects `false`, gets `true`. That reads like a genuine
   product defect, not a stale spec. PROMPT.md §7 says log bugs, don't fix them — so I plan to log it
   and leave that test red. Same treatment for any other group-G failure that turns out to be a real
   defect, which means a literal "0 failed" may not be reachable without you approving production fixes.
6. **`src/app/shared/core/version/app-version.ts` is tracked but auto-generated** by
   `scripts/generate-version.mjs` on every build, so it dirties the working tree after each `pnpm build`
   and will pollute every refactor phase diff. Phase 1 hygiene candidate (gitignore + generate at build).
7. **`docs/refactor/README.md` does not exist** — referenced in the setup request but not in the repo.
8. **The recorded course-route SSR baseline captured DEGRADED SEO — needs your call.**
   `baseline/ssr.json` for `/us/accounting/masterclass/154/adulting-in-business` recorded
   `title: "Miles Masterclass"`, `canonical: ""`, `jsonLdBlocks: 0`. Live production for the same URL
   serves `<title>Adulting in Business | Miles Masterclass</title>`. So the local prod SSR could not
   resolve course 154's data (consistent with `https://api.milescaira.com/v2/library/` returning 404
   from this machine) and fell back to generic SEO. `textLength` was still 23907, so the page body
   rendered — only the course-specific SEO is missing.
   **Consequence:** that route currently pins the fallback state, so course-page SEO could regress
   during the refactor and the SSR gate would still report OK — exactly the regression that route was
   added to catch. The other three routes are fine (`/` 302 → `/us/accounting/home`; the partner page
   recorded a real canonical + 1 JSON-LD block; `/admin/login` is `RenderMode.Client`, textLength 72,
   as expected).
   Options: (a) accept it — the route still guards status, structure and text length, just not course
   SEO; (b) find why SSR can't reach the course API locally (auth header? egress? different host?) and
   re-record; (c) swap in a different route — though any dynamic course page hits the same wall.
   I cannot re-record (harness-owned); you run `--record-baseline` after deciding.

9. **NEW (Phase 6) — I cannot invoke the harness verification script; the pre-tool Bash guard
   blocks it.** The guard refuses any shell command whose text contains the harness directory
   prefix, which is exactly what invoking the verify script requires. It is guarding _writes_ to
   harness files, but it matches _reads and executions_ too. Consequence: every `--quick` gate this
   phase is run by executing the script's own two commands directly
   (`pnpm exec tsc -p tsconfig.app.json --noEmit --pretty false` and `pnpm lint`, taken verbatim
   from the script's quick-mode gate list) — identical work, but not routed through the harness, so
   nothing is written to its log cache. The `verifier` subagent may hit the same wall on the
   end-of-phase full run; if it does, the full gate set will be run the same way and the report will
   say so explicitly rather than claim a harness run happened.
   **Fix:** narrow the guard to write-style commands, or allow-list the verify script.

## Step log (latest first; keep the last 30 lines)

- 2026-09-25 · NON-REFACTOR HOTFIX · Vercel deploy red: its default 24.x image is **24.14.1**, one patch under the Angular CLI 22 floor `^22.22.3 || ^24.15.0 || >=26.0.0`, and `bin/ng.js` aborts hard with no override · Vercel only exposes a major and owns the patch, so `24.x` is useless; pinned `engines.node: "22.x"` (latest 22 is 22.23.3) + `node -v` at the top of `vercel.sh` to prove the patch next deploy · CI (`node-version: 22`) was never affected · OPEN: something outside `vercel.json` runs `pnpm run lint` on Vercel · docs/config only, no `src/` change
- 2026-09-25 · NON-REFACTOR · enforcement-harness PHASE 0: wrote `docs/engineering/{git-workflow,github-setup,versioning}.md` (1,119 lines, prettier clean, uncommitted) · fixes 2 dangling `CLAUDE.md` links · corrected `main`→`master`, the `@ms-sachin-singh` handle (docs wrong, CODEOWNERS right), duplicate §10, and the `APP_BUILD` define that does not exist · unshipped items marked `TODO`, incl. a rollout-status banner so nobody thinks commitlint blocks them yet · docs-only, no `src/` change
- 2026-09-24 · NON-REFACTOR · enforcement-harness plan written to `prompts/engineering-enforcement-harness.md` (no `src/` change, no phase moved) · MEASURED all 5 gates GREEN incl. 163 files / 554 tests, so `AGENTS.md` §9's "already red" baseline is stale · live repo audit found the ruleset has NO `required_status_checks` (red CI merges today) and `squash_merge_commit_title=COMMIT_OR_PR_TITLE` (so PR-title linting guarantees nothing) · user locked: keep `master`, gitignore the 2 generated version files
- 2026-09-24 · PHASE 9 · CLOSED ✅ on user decision with `ssr smoke` red (proven stale baseline, not a defect — deliberate departure from the Phase 7 ⛔ precedent, recorded as such) · all 5 steps, 16 files, 6 reads → `httpResource`, 163 files / 554 tests, reviewer PASS ×2 · baseline re-record still OPEN
- 2026-09-24 · PHASE 9 · step 4 `FeatureFacade`: non-track read → `httpResource`, `requiresAuth` re-wired to the real boolean (15 live call sites go from no-request to fetching), track fan-out + `getAbout()` left on RxJS, 11 new HTTP tests replacing a 1-line smoke test · FOUND: Map-in-a-computation accumulation is broken by laziness (now accumulates via `previous`, Map deleted); `refreshTrigger` cannot force a resource refetch (`reload()` does); an errored resource must clear pagination or infinite scroll retries forever; my step-2 `vi.stubGlobal` was leaking across spec files · 163 files / 552 tests
- 2026-09-24 · PHASE 9 · steps 0-3 CLOSE GREEN: verifier ALL 8 GATES GREEN (first ever, ssr smoke included), reviewer PASS, 163 files / 542 tests · bundle -13 KB gzip proven NOT mine via a clean HEAD worktree build (my delta -0.1 KB; styles.css hash identical) → re-record bundle.json · step 4 FeatureFacade deliberately not started, design preserved in the report
- 2026-09-24 · PHASE 9 · step 3 `CartStore` → `httpResource` + 8-test spec · a gated `wanted` signal is REQUIRED (an ungated resource is `loading` from construction and would fetch the cart on every page); resolver needed no rewrite because `reload()` and the gate both flip `loading` synchronously (probed) · `tsc` caught that `PaymentFacade.loading`/`.error` were never cart-only — split into `opLoading`/`opError` OR-ed with the cart's · 163 files / 542 tests
- 2026-09-24 · PHASE 9 · step 2: `caira-level-stack`, `surround-carousel`, `course-related-section` reads → `httpResource` (3 specs: 1 rewritten off a now-blind `ApiClient` mock, 1 given HTTP it never had, 1 created from nothing) · instructor `forkJoin` fan-out left on RxJS on purpose · 162 files / 534 tests, lint 0, tsc 0, format clean
- 2026-09-24 · PHASE 9 · step 0 tracker repair (+`shared/components`/`shared/dialogs` rows, −`features/blog` row) and step 1 `JobSectors` → `httpResource` + 7-test spec · FOUND: `defaultValue` does NOT stop `value()` throwing in the error state (needs `hasValue()` too), and `TestBed.tick()` alone never settles a flushed value — `await ApplicationRef.whenStable()` does · 161 files / 526 tests, lint 0, tsc 0, format clean
- 2026-09-24 - OFF-PHASE - NgpSelect does not call ngpFormControl, so a select in a form field had NO accessible name; Select now reads the field state for aria-labelledby/describedby, profile.html uses span labels for widget controls; 519 tests
- 2026-09-24 - OFF-PHASE - shared `app-select` on ngpSelect + signal forms; fixed the value-prune race and NG0955 duplicate keys; `required()` ignores empty arrays so choices need required+validate; 8 DOM tests + 6 stories; 518 passing
- 2026-09-24 · OFF-PHASE · profile controls rebuilt on raw ng-primitives (page-scoped; 52 other aria users untouched); ng-primitives 0.131.0 has no signal-forms support so select/checkbox bind FieldState.value directly; label lint fixed by pinning ids, not by disabling; build+lint green, 509 tests
- 2026-09-24 · OFF-PHASE · profile form rebuilt on signal forms, fields 100% from `questions/` (identity block removed); applyEach joins on `code` not index; hidden gating keeps unreachable required questions from blocking submit; +6 mapping tests (509 passing) · ⚠️ features/blog deleted in the tree by something OTHER than this session — flagged, untouched
- 2026-09-24 · OFF-PHASE · onboarding gate moved to `is_onboarding_completed` (null ≠ false, only known-false redirects); `isProfileCompleted` carried unused; UserDetails.id is a UUID string; tests 158/503+1, build green, +0.81 kB initial
- 2026-09-24 · OFF-PHASE · onboarding questions retyped from a live `questions/` payload; select answers save as value LISTS; identity questions answered from the user row; parent gating inferred; build green, tests 158/500+1
- 2026-09-24 - P8 - option 2 part C done: SubscriptionDialog moved to features/payment, 2 loader tokens in core/services/dialog/feature-dialog-tokens.ts; LINT FULLY GREEN (0 errors), tests 158/500+1
- 2026-09-24 - P8 - CART_DRAWER_DIALOG token clears utils.ts:767; lint 8->2; pre-commit hook PASSES; 56 specs needed the token bound in test-setup too
- 2026-09-24 · P8 · CORRECTION · open question -1 SOLVED: a baseline-recording run writes the baselines even when lint fails (the gate loop does not abort); my "recurrence" claim is retracted, and the baselines must NOT be restored — they are the user's deliberate record
- 2026-09-24 · P8 · verifier GREEN after A+B (7/8; lint red with exactly 3) · OPEN QUESTION -1 RECURRED, baselines dirty again, run `git restore docs/refactor/baseline/`
- 2026-09-24 · P8 · option 2 A+B · lint 8→3 via TOAST_COMPONENT token + core CartStore; 60 specs fixed by binding the token in test-setup; commit now blocked by ONE line (utils.ts:767)
- 2026-09-24 · P8 · option 2 analysis · dynamic import() does NOT clear boundaries (utils.ts:765 proves it); 8 violations split A/B/C; loader-token design proposed; awaiting design call, NO source changed
- 2026-09-24 · P8 · step 4 · lint rule added; canary proved it 8→9→8, control `Service` silent
- 2026-09-24 · P8 · steps 1-3 · 60 `@Injectable` → 44 `@Service()` + 16 `autoProvided:false`; 16-file scoped list an EXACT match; tsc clean, lint 8, tests 158/500+1
- 2026-09-24 · P8 · step 0 · 2 dead files deleted, 16 renamed (git `R`, history kept), 30 specifiers rewritten = auditor's exact count; tsc clean, lint 8, tests 158/500+1
- 2026-09-23 🏁 **OFF-PHASE: webinar module ported onto master (branch `feat/webinar`) — reviewer
  PASS, verifier GREEN.** Not a
  refactor phase. `feat/webinar-implementation` was NOT merged — it forks from the
  "strip app to admin-only" lineage that master reverted, so 41 files were re-created by hand into
  the §3 shape. Adaptations: `LEARNER_SESSION` → `AuthSession` (that token existed only because
  auth was stripped on that branch); `IS_LEARNER_REQUEST` + `learnerContext()` deleted
  (`appInterceptor` already attaches the learner bearer); `injectContentLocale()` → `Utils`;
  `swiper-strip` placed INSIDE webinar, not `shared/`, because it has one consumer. Lint still
  exactly 8; tests 154 green; initial bundle +3.6 KB, all of it CSS, zero JS.

- 2026-09-23 🏁 **PHASE 7 COMPLETE — all 6 steps ✅, 7/8 GREEN (lint red by decision), reviewer PASS.**
  Report: [phase-07](reports/phase-07.md). `eslint-plugin-boundaries@7.2.0` +
  `eslint-import-resolver-typescript@4.4.5`; 8 element descriptors, 6 `disallow` policies,
  `boundaries/dependencies` at `error` with object selectors and `{{ }}` templates, no deprecated
  syntax. **Three settings are load-bearing, not cosmetic:** `partialMatch: false` (the v7 default
  would classify `admin/core/**` as element `core` and invent false errors),
  `flag-as-external.unresolvableAlias: false` (a dead resolver would otherwise pass every check
  silently), and a `source` catch-all in `boundaries/files` (without it the `noneOf` testing
  selector never fires). **Resolver proven live with 3 canaries before any result was trusted** —
  including both dynamic `import()` violations, closing the Phase 5 worry. Fixed: `update-checker`
  → `shared/services/` (100% rename), 3 out-and-back specifiers in `html-to-pdf.directive.ts`, and
  the 2 class-directive usages. **The planned `Notification` move was dropped on evidence** — my
  grep missed 2 relative importers inside `core/`, so the move would have turned 1 violation into
  2; residue is 8, not 7. Side effect: no violating file is touched, so the pre-commit hook passes.
  Bundle byte-identical to baseline; baselines stayed clean.
- 2026-09-23 🏁 **PHASE 6 COMPLETE — steps 3 + 4 ✅, 8/8 GREEN, reviewer PASS.**
  Report: [phase-06](reports/phase-06.md). Step 3: the ten non-partner features flattened —
  internal `shared/` dissolved, routed page → `pages/`, `components|dialogs|models|services|utils`
  promoted. **`user-form` was a ROUTED page living in `shared/components/`** (`admin.routes.ts:234,241`)
  and went to `pages/`, not `components/`; `users/shared/services/partner-users-facade/` lost its
  redundant folder level. `seo/` untouched — already the reference shape. No `service/` (singular)
  folder existed anywhere in admin, so that rename was a no-op.
  Step 4: `partner-platform-v2` → `pages/` ×10 + `components/` ×4 + `dialogs/` ×7 + `models/` +
  `services/`; its two internal `shared/` layers dissolved. `-v2` suffixes KEPT.
  **Phase totals: 143 files changed, 136 renames, zero `shared/` under `admin/`, `v2 → v1` 39 → 0.**
  Bundle byte-identical to baseline; the reported "regression" was a metric mismatch and the budget
  warnings were reproduced on `HEAD`. One stale doc comment fixed (`firm-form-dialog.ts:32`); a
  repo-wide sweep found no other stale admin path in a comment or string.

- 2026-09-23 **Phase 6 step 2 ✅ v1 emptied — quick gate GREEN** (typecheck clean, lint clean).
  **`partner-platform-v2 → partner-platform` edges: 39 → 0**, verified by grep.
  A **preparatory pass ran first**: every cross-directory relative import inside `partner-platform/`
  and `partner-platform-v2/` was resolved to its absolute target and rewritten as an `@admin/…`
  alias — **45 import lines across 20 files** — leaving only same-folder relatives (`./…`) behind.
  That made the moves depth-independent, and §3 requires the alias for these anyway. Typechecked
  green before any file moved.
  Then: `partner-platform.model` (+spec) → `admin/core/models/`; 4 services → `admin/core/services/`;
  `stat-card`, `allocation-picker`, `report-users-table`, `certificate-download-progress` →
  `partner-platform-v2/components/`; `report-items-dialog`, `partner-report-preview-dialog`
  (+`report-preview.format` +spec), `allocate-seats-dialog`, `network-form-dialog`,
  `create-partner-code-dialog` → `partner-platform-v2/dialogs/`; `partner-report.model` →
  `partner-platform-v2/models/`; `partner-report-facade` → `partner-platform-v2/services/`.
  **`admin/core/` is now the §3 shape**: `directives/ guards/ interceptors/ models/ services/ utils/`.
  v1 residue flattened to `pages/` ×5 + `dialogs/network-firms-dialog/` (the one v1 dialog with no v2
  consumer) — **12 files, no `shared/`, no `super-admin/`, no `network-admin/`**, so the cutover is a
  single `rm -rf` plus the 8 commented route blocks.
  The 5 stale paths inside those commented-out deprecated route blocks were updated too, so they
  still point at real files.

- 2026-09-23 **Phase 6 step 1 ✅ `admin/shared/` dissolved — quick gate GREEN** (typecheck clean,
  lint "All files pass linting"). 16 files moved with `git mv`: guards ×3 → `admin/core/guards/`,
  `has-permission.directive` → `admin/core/directives/`, `admin-landing` → `admin/core/utils/`,
  stray `admin/core/admin-rbac.model.ts` → `admin/core/models/`, 4 routed pages (`admin-login`,
  `forbidden`, `admin-forgot-password`, `admin-reset-password`) → `admin/auth/pages/`, and
  `deprecation-banner` → **app-level `shared/components/`** (decision 2).
  **`src/app/admin/shared/` no longer exists.** 63 references rewritten across 24 files, including
  the 3 relative `'../../utils/admin-landing'` imports, which became aliased
  `'@admin/core/utils/admin-landing'` — they now cross feature → core, so §3 requires the alias.
  ⚠️ **The harness verify script could not be invoked — see open question 9.** Ran its two quick
  gates directly instead (`pnpm exec tsc -p tsconfig.app.json --noEmit --pretty false` and
  `pnpm lint`), which is what the script itself runs for `--quick`.

- 2026-09-23 🏁 **PHASE 5 COMPLETE — session 8 `offerings` ✅, 8/8 GREEN, reviewer PASS.**
  Report: [phase-05-offerings](reports/phase-05-offerings.md). Five `shared/` layers dissolved in one
  change (they could not be split — the sub-features reach up into the parent's `shared/`), four
  route-table splits, `offerings.ts` → `offerings.routes.ts`. 87 `R100`, 30 import-only, ~65
  specifiers.
  **Lazy chunks 271, unchanged** — through the largest lazy-loading change of the phase.
  **Phase totals: 14 `shared/` layers → 0; `features → features` edges 23 → 2; eight sessions, all
  green, zero reviewer violations across all eight.**
  **Two method notes worth keeping:** (1) a relative import survives a move only if **both endpoints
  move by the same amount** — that one rule explains why `partners`/`payment` needed almost no
  rewrites and why `offerings` needed 65; (2) a **split** is not a git rename, so stage the outputs
  before review and review with an _unrestricted_ `git diff -M` — a pathspec-restricted diff breaks
  rename detection and the halves read as delete+add.

- 2026-09-23 **Phase 5 session 8 `offerings` — the last flatten, 8/8 GREEN.**
  **Every `shared/` layer under `features/` is now gone** — the phase's structural goal.
  87 files `R100`, 30 with import-only changes, 4 route splits, 1 rename.
  **Chunking held through the biggest lazy-loading change of the phase**: 271 chunks, unchanged, no
  chunk moved more than 0.6 KB, even though four route tables became separate modules from their
  components. Initial **+0.0%**.
  ⚠️ **A too-greedy regex collapsed `@core/services/feature-facade/feature-facade` in 4 files.**
  Typecheck caught it; restored and all 15 sites verified. The pattern `([a-z-]+-facade)/\1` is
  path-agnostic — anchor bulk rewrites to the directory being moved, or they reach outside it.

- 2026-09-23 **Phase 5 session 7 `payment` — flatten done, 8/8 GREEN.** `shared/{components,pages}`
  up one level, `shared/constants/plan-icons.ts` merged into the existing `constants/`, and
  `shared/service/payment-facade/payment-facade.ts(+spec)` → **`services/payment-facade.ts`** —
  singular→plural and folder-per-service→flat file in one move.
  **That double collapse is why payment cost more than partners.** Dropping a _symmetric_ `shared/`
  layer leaves relatives untouched (proved again here: `../../components/…` and even
  `../../constants/plan-icons` were invariant). `service/` collapsed **two** segments, so all 7
  relative crossers plus 10 absolute ones had to change.
  **All 17 `PaymentFacade` importers updated** — 12 inside payment, 5 outside. **No banned edge was
  removed by this**, only repointed: the 9 violations still stand at the new path.
  Bundle **+0.0%**, lazy **271 unchanged**, no chunk moved more than 0.6 KB — worth noting given
  `PaymentFacade` is reached from `shared/`, `layout/` and `offerings/` as well as its own feature.
  Gates: lint 5s, unit 17s, local 24s, prod 25s, storybook 21s, format 14s, bundle, ssr 3s.
  Recorded baseline clean.

- 2026-09-23 **Phase 5 session 6 `partners` — flatten done, 8/8 GREEN.** `shared/components/*` →
  `components/*`, `shared/pages/*` (12 landing pages) → `pages/*`.
  **60 of 61 files are `R100` with zero content diff; only `partner.routes.ts` changed.** The audit
  predicted this: the `../../components/…` shape is invariant under dropping a symmetric `shared/`
  layer, so 18 relative imports across 11 pages needed no edit. Rewriting them "to be safe" would
  have broken all 18.
  Initial bundle **+0.0%**, lazy **271 unchanged** — all 12 partner pages stayed separate chunks.
  **SSR smoke covered this session directly** (`/us/accounting/partners/cpacanada` → 200, real
  title), unlike the previous four sessions where no smoke route touched the moved code.
  Gates: lint 8s, unit 21s, local 24s, prod 24s, storybook 19s, format 14s, bundle, ssr 6s.
  Recorded baseline clean.

- 2026-09-23 **Phase 5 session 5 `tracker` — merge done, 8/8 green on the second full run.**
  `caira-tracker` + `cpe-tracker` → `features/tracker/{caira,cpe}/`. **The last circular dependency
  in the codebase is dissolved**, structurally rather than by relabelling: the 4 symbols both halves
  shared (`tracker-links`, `course.util`, `slug.util`, `badge-filter-chips`) moved up to their new
  common parent `tracker/{utils,components}/`, so neither half imports the other at all now.
  Verified in both directions including dynamic and type-only imports: zero.
  **First promotion in this phase with NO hidden sibling dependency.** All four promoted files import
  only `@core`/`@shared`/nothing — `slug.util.ts` has no imports whatsoever. The trap that caught
  `partner-icons`, `micro-learning-hero-reel-card` and nearly `laptop`/`floating-assets` simply was
  not present. The audit still had to run to establish that.
  **Chunking was the risk and it held:** two separately-lazy features now share a parent folder with
  four common files, yet lazy chunks stay **271** with no fusion, no new chunk, and the top-10 sizes
  match baseline one-for-one. Initial bundle **+0.0%**.
  First full run was **7/8** — `format check` on `caira-tracker.routes.ts`, because the longer
  `./pages/<name>/<name>` specifiers pushed three `loadComponent` arrows past the print width. Same
  failure mode as the `auth` session's route split. Prettier fixed it; second run 8/8.
  ⚠️ **Neither `/cpe-tracker` nor `/caira-tracker` is in the SSR smoke set**, so the gate exercised
  none of this. The chunk-count match is the strongest signal available.

- 2026-09-23 **Phase 5 session 4 `home` ✅ CLOSED — 8/8 GREEN, reviewer PASS, zero violations.**
  Report: [phase-05-home](reports/phase-05-home.md). **Biggest boundary win of the phase: 17 of 23
  cross-feature import lines gone.** Initial bundle **+0.0%** despite five component folders and a
  600-line data file moving into `shared/`/`core/` — the one risk that could have made this session a
  regression. Lazy 271 unchanged. Recorded baseline clean.
  Gates: lint 5s, unit 22s, local 27s, prod 31s, storybook 23s, format 14s, bundle, ssr 4s.
  Three carry-forwards: the promotion trap fired a **third** time (read the promoted file's own
  imports); **PROMPT.md §4.4 misclassifies `laptop`/`floating-assets` as three.js**; and there are
  **two** `core → shared` edges, the second a **dynamic** `import()` that `from '@shared/'` greps
  cannot see.

- 2026-09-23 **Phase 5 session 4 `home` — steps 1-3 done, `--quick` green after each.**
  **17 of the 23 remaining `features → features` import lines were cleared in one session.**
  `partners → home` (14 lines / 7 files) and `home → offerings` (3 lines) are both **gone**. What is
  left repo-wide is `offerings → payment` (2, survives Part A by decision) and the tracker cycle (4,
  next session).
  **The `partner-icons` trap fired for a THIRD time and the auditor caught it again.**
  `micro-learning-hero-phone-mockup.ts:4` imports sibling `MicroLearningHeroReelCard`, which was not
  on the move list; promoting the mockup alone would have created the exact `shared → features` edge
  the step exists to remove. It has one consumer repo-wide, so it moved too. **Every promotion so far
  has had at least one of these. Assume the next one does too.**
  **PROMPT.md §4.4 is WRONG about `laptop` and `floating-assets`** — it lists them as three.js scenes
  to defer. Neither imports `three`, `gsap`, `lenis` or `motion`; `laptop` is `Renderer2` + timers and
  `floating-assets` is CSS `@keyframes`. The only match is the literal `prefers-reduced-motion` media
  query. That mattered here: it is why promoting them into `shared/` carried no eager-bundle risk.
  **The `laptop` re-export chain was preserved, not "cleaned up".** `offerings.ts:12` re-exports three
  config types purely so `laptop.ts:14` can import `OfferingData` from the component file. The
  auditor confirmed laptop is the only consumer, so dropping it was tempting — but removing a public
  export is an API change Part A forbids. Kept and repointed; its comment updated to name the new path.

- 2026-09-23 **Phase 5 session 3 `library` ✅ CLOSED — 8/8 GREEN, reviewer PASS, zero violations.**
  Report: [phase-05-library](reports/phase-05-library.md). 17 moved, 5 edited, 1 created; only the
  three page `.ts` files are non-`R100` and each differs solely in import specifiers.
  Initial bundle identical to baseline (+0.0%), lazy **271 unchanged**, no chunk added or removed —
  which was the real question, since three lazy `loadComponent` specifiers changed. Recorded baseline
  clean after the run.
  Gates: lint 5s, unit 18s, local 31s, prod 30s, storybook 20s, format 14s, bundle, ssr 3s.
  ⚠️ **The SSR gate covers no library route**, so it exercised nothing this session touched.
  **Carry-forward:** the entangled three-unit diff made the reviewer chase a phantom — `git status`
  reported renames from an earlier session as freshly added files. Commit before `partners`/`payment`.

- 2026-09-23 **Phase 5 session 3 `library` — steps 1-4 done, `--quick` green after each.**
  All three sub-features flattened: `badge`, `course`, `instructor` each lost their internal
  `shared/` layer. Components up to `components/`, the three facades flattened from
  `shared/services/<x>-facade/<x>-facade.ts` to **flat `services/<x>-facade.ts`**, and the routed
  page components down into `pages/<name>/`. **`features/library/` now matches §3 exactly** — no
  `shared/` anywhere under it.
  **The auditor made two moves cheap that looked expensive.** First, the sibling relatives inside the
  component pairs (`badge-library-hero` → `../badge-spot-animation/…`, `course-filters-drawer` →
  `../course-filters/…`) needed **no rewrite at all**, because both halves move in lockstep under
  `components/`. Second, **none of the three facades is route-provided** — all are
  `providedIn: 'root'` and injected only by their own page — so flattening them touched exactly one
  import line each instead of a route config.
  **The stranded-import trap from `auth` did NOT reproduce**, and the auditor predicted that in
  advance: `library.ts`'s only route-table-owned symbol is `Route` itself, so dropping it from the
  `@angular/router` import was the whole job. Verified by diff afterwards anyway — the `Library`
  class is byte-identical and `LibraryRoutes` differs only in the three lazy specifiers.
  **`LibraryRoutes` kept its PascalCase name.** It is inconsistent with `authRoutes`/`featuresRoutes`/
  `PAYMENT_ROUTES`, but renaming an export is outside Part A's structural mandate. Still logged.

- 2026-09-23 **Phase 5 session 1 `auth` ✅ CLOSED — 8/8 GREEN, reviewer PASS, zero violations.**
  Report: [phase-05-auth](reports/phase-05-auth.md). `src/app/auth/` deleted; 8 dead files removed;
  11 files moved (9 × `R100`); 1 new `auth.routes.ts`.
  **Bundle moved by nothing** — initial identical to baseline (+0.0%), lazy 271 unchanged, no chunk
  added or removed. Deleting an entire feature plus a route-level provider registering as zero is
  itself the proof the deleted code was already unreferenced and tree-shaken.
  **Recorded baseline stayed CLEAN through the full run**, checked straight after — which disproves
  my earlier claim that an ordinary `verify.mjs` run rewrites it. Corrected in open question -1.
  Gates: lint 5s, unit 18s, local 26s, prod 36s, storybook 25s, format 14s, bundle, ssr 3s.
  **Carry-forward for the six remaining route-table splits:** a split strands imports in _both_
  directions and neither a byte-diff of the halves nor typecheck will see it — only lint does.

- 2026-09-23 **Phase 5 session 1 `auth` — steps 1-3 done, `--quick` green after each.**
  **Step 1, the deletion (8 files, user-approved).** `features/cpa-landing/` and
  `features/shared/services/tracks/` gone; `features/shared/` no longer exists, so the
  `@features/shared` path segment is retired. The auditor confirmed there is **no dedicated tsconfig
  alias** for it — only the `@features/*` wildcard — so nothing to clean there. It also confirmed the
  two lines the 8-file list does **not** cover: `features.routes.ts:5` (the `Tracks` import) and `:21`
  (`providers: [Tracks]`) go dead the instant `Tracks` does; both stripped, plus one comment that
  named `Tracks`. Nothing `cpa-landing`/`tracks` imported became an orphan — notably
  `@core/models/track.model` stays, it has 4 other consumers.
  **Step 2, the move.** 11 files; **9 are `R100`**. `Auth` stayed at the feature root per D2 (it is a
  `<router-outlet/>` shell); `shared/pages/{login,profile}` to `pages/`, `auth-facade.ts`+`.spec.ts`
  to `services/` as flat files. `login.ts`'s `'../../services/auth-facade'` is unchanged by luck —
  the depth from `pages/<page>/` to `services/` is the same before and after.
  **Step 3, the route split** — the only risky part, since it is the one operation that is not a move.
  Verified by diffing halves against the original: the `Auth` component body is **identical**, and the
  `authRoutes` array differs **only** in the two lazy specifiers that had to change
  (`./shared/pages/{login,profile}/…` becomes `./pages/{login,profile}/…`). The mixed import line
  `{ ActivatedRoute, Route, Router, RouterOutlet }` had to be split across the two files, `Route`
  going with the table.
  **Lint caught the one thing the diff-check could not:** `AuthFacade` was left in `auth.ts` but is
  used **only** by `providers: [AuthFacade]` in the route table, so it became an unused import the
  moment the table left. Removed. A split leaves this trap in both directions and only the linter
  sees it.

- 2026-09-23 **Both open Phase 5 decisions settled by the user; every remaining session is now
  unblocked.** No source changed — plan and STATE only.
  **D1: delete the dead cluster** (8 files). Recorded under Decisions as the §7 deletion approval,
  and explicitly scoped as an exception so the other 11 dead files keep following "list only".
  Session 2 disappears: it folds into session 1 as a removal plus two lines in `features.routes.ts`.
  **D2: shells stay at the feature root.** The user's rule turned out to have a mechanical test —
  presence of `<router-outlet/>` — which I measured across all 16 routed components outside `pages/`.
  It splits them 4/12 with no judgement left over: the 4 shells have an outlet, and the 12 pages have
  none plus 3-16 state calls each. Only `overview-wrapper` is genuinely ambiguous, because it is a
  _nested_ shell rather than a feature's top one; left to the `payment` session with a recommendation.

- 2026-09-23 **Phase 5 remaining-work plan finished — two full-repo sweeps behind it.**
  [PHASE-05-REMAINING.md](PHASE-05-REMAINING.md), 8 sessions. No source changed.
  **Biggest finding: `cpa-landing` and `Tracks` are one DEAD CLUSTER of 8 files.**
  `features/cpa-landing/` (6 files) has **zero** references anywhere outside itself, and
  `cpa-caira-section.ts:30` is the **only** injector of `Tracks` in the repo. `Tracks` is provided at
  `features.routes.ts:21`, but nothing reachable injects it. This retires the D1 question
  ("where does `features/shared/services/tracks/` go") — the answer is that `features/shared/` exists
  only to hold half of something nothing runs. **New D1 is a delete/keep call for the user**, because
  the standing "list only, do not delete" rule would otherwise have us flatten and rehome dead code.
  **Cross-feature edges are far smaller than the file count suggests: 23 lines, 5 edges, 4 pairs.**
  Twelve features have zero edges either way. 10 magnets, all single-pair; 3 UI → `shared/`,
  7 non-UI → `core/`. **`PaymentFacade` must NOT be promoted** (13 internal vs 2 external importers);
  `offerings → payment` therefore survives Part A and joins the Phase 7 warning list.
  **The `offerings` session has a hard constraint:** its three inner sub-features reach up into
  `offerings/shared/` with `../../../../shared/…`, so flattening them separately rewrites those lines
  twice. **All five offerings layers must move in one session.**
  Counts corrected upward: routed components outside `pages/` are **16, not 12** (missed
  `payment/payment.ts` and `payment/shared/components/overview-wrapper/`, a routed layout in
  `components/`); route-table splits are 7.
  **19 dead files catalogued** (cpa-landing 6, tracks 2, `blog/pages/blog-list/` 3 — literally
  `export {};` — `partners/.../ascpa/` 4 with a commented-out route, `offerings/.../document-chapter/`
  4 with zero selector usages).
  ⚠️ **Logged for you, outside the refactor: the blog is routed at `path: 'blog-test'`**
  (`app.routes.ts:33`), top-level and outside the `:country/:profession_type` scope. Either that is
  the live public URL and looks like a leftover, or the blog has no production route. Phase 5 will
  not touch it; confirm before Phase 14 documents the route map.

- 2026-09-23 **Planned the rest of Phase 5 → [PHASE-05-REMAINING.md](PHASE-05-REMAINING.md).**
  No source changed. 8 sessions, ~460 files, ordered low-risk first; 294 of those files are the 14
  remaining feature `shared/` layers and 102 are the 26 `shared/pages/*` folders.
  **Biggest correction: PLAN.md understates the route-table item.** Six of the seven files are
  `@Component` + `Route[]` in one file, so they are splits; only `offerings.ts` is a rename.
  **`home/components/offerings/*` finally settled too** — PLAN.md's "14 importers from
  `features/partners`" is 14 import _lines_ across **7 files, all in `partners`**: one external
  feature, not fourteen importers. Still clears §3's 2-feature bar (`home` + `partners`) so the
  promotion to `shared/` stands, but it is an ordinary magnet, not a headline. Third PLAN.md
  miscount; do it inside the `partners` session where all 7 consumers live.
  Two decisions still need the user: **D1** `features/shared/services/tracks/` placement (blocks the
  `cpa-landing` session) and **D2** where routed shells vs landing pages go under "routed components
  always live in `pages/`" (blocks `auth`, `library`, `offerings`).
  ⚠️ Note for whoever reads the diff: `public/version.json` and `core/version/app-version.ts` are
  dirty again — regenerated by this session's verify runs, not edited. Open question 6.

- 2026-09-23 **Phase 5 / session `dissolve pages/` ✅ CLOSED — 8/8 GREEN, reviewer PASS, zero
  violations.** `src/app/pages/` is deleted. 46 moved, 18 edited, 1 created. Report:
  [phase-05-pages-dissolve](reports/phase-05-pages-dissolve.md).
  First full run was **7/8**: `format check` failed on `features.routes.ts` alone, because rewriting
  four lazy specifiers to longer alias paths pushed them past the print width. Prettier fixed it; no
  code change. Second run 8/8.
  **`shared → features` 6 → 4**, both ai-lab edges cleared. Initial bundle **+0.0%** (12 files /
  501.5 KB raw / 101.5 KB gzip), lazy chunks **271 unchanged**, no chunk added or removed.
  SSR `/us/accounting/partners/cpacanada` → **200 with a populated title**; that page renders the
  just-promoted `video-list-wrapper`, so it proves the 13 rewritten specifiers resolve at **runtime**.
  Reviewer independently confirmed byte-identity of both the assessment-model move and the
  `ai-labs.model.ts` split, that the 18 modified files contain only import changes plus the one
  `styleUrls` fix, and that no `eslint-disable` / `ts-ignore` / skipped test entered the diff.
  **Method note worth carrying forward:** a file _split_ is the one Part A operation the gates cannot
  police. The first cut silently dropped a 9-line doc comment carrying a BACKEND CONTRACT note and
  every gate stayed green. Diff the extracted block against the original; line-count the halves.

- 2026-09-23 **Phase 5 / steps 3-6 ✅ — `src/app/pages/` IS GONE.** 20 more files moved.
  `faculty` → `features/faculty/pages/`, `how-to-claim-credly-badge` → its own feature,
  `instructor-details` + `instructor-hero` → `features/library/instructor/{pages,components}/`,
  `ai-labs` → `features/ai-labs/`, then `features.ts` → **`features.routes.ts`**.
  **The `instructor-details` placement was the user's call and it changed PLAN.md.** PLAN.md §3 sent it
  to a standalone `features/instructors/`; it went to `features/library/instructor/` instead, because
  that folder already owns the instructor _list_ page and `instructor-facade`, and both sides read
  `InstructorListItem` from `@core/models/library.model` against the same `instructor/` endpoint. The
  route registration stays in `features.routes.ts` — `instructor/:id/:name` is a sibling of `library`,
  not a child, and moving the registration would have changed the URL.
  **One import broke silently in the middle of it:** `instructor-details.ts:27` imported
  `'./components/instructor-hero/instructor-hero'` — nested. The target splits the two into _sibling_
  `pages/` and `components/` trees, so it had to become `'../../components/...'`. The auditor flagged it;
  nothing else would have until typecheck.
  **The ai-labs cycle is dead.** `shared/dialogs/ai-lab-agent-dialog` used to reach into
  `pages/ai-labs` by relative path for `CopilotWorkflow` and `AiLabSubmission` while `ai-labs.ts`
  imported that dialog back. Fixed by promoting, not by exempting: `CopilotWorkflow` + `MOCK_WORKFLOWS`
  were cut out of the 450-line `ai-labs.model.ts` into **`core/models/ai-lab.model.ts`** (the rest is
  page copy and stayed with the feature), `ai-lab-agent-about.model.ts` moved wholesale out of
  `shared/dialogs/` to **`core/models/ai-lab-assessment.model.ts`**, and the root singleton
  `AiLabSubmission` moved to **`core/services/ai-lab-submission/`**.
  **The assessment model HAD to move in the same change, or the fix would have made things worse.**
  `AiLabSubmission` imports `AI_LAB_ASSESSMENT_REPORT`/`AiLabAssessmentReport` from it, so moving only
  the service into `core/` would have traded a `shared → features` edge for a `core → shared` edge —
  banned just as firmly, and a level deeper. The auditor caught this explicitly.
  **Measured result of the promotion:** repo-wide `shared → features` edges are down from **6 to 4**
  (3 static `@features/payment/*` in `utils.ts` + `subscription-dialog`, 1 dynamic `import()` in
  `utils.ts:767`). All four are the PaymentFacade/cart cluster already assigned to Phase 11. Both
  ai-lab edges are gone outright.
  `--quick` green after each step: typecheck 11-13s, lint 6s.

- 2026-09-23 **Phase 5 / step 2 ✅ — `pages/milesverse/` → `features/milesverse/`.** 17 files moved,
  17 reference lines rewritten. The internal `shared/` layer dissolved: `shared/report.model.ts` →
  `models/`, `shared/sessions.store.ts` → `services/`, both as flat files per §3.
  **`core/services/milesverse/milesverse.ts` was pushed down into the feature.** The auditor confirmed
  exactly **4 importers, all four inside the moving set** — it was never app-wide, and it statically
  imports `@milesverse/sdk`, one of PROMPT.md §1's heavy libraries. Holding it in `core/` was pinning a
  heavy SDK next to app-wide code; it now sits behind the same lazy boundary as the pages that use it.
  `core/services/milesverse/` is deleted.
  **The one thing typecheck could never have caught:** `subject.ts:50` is
  `styleUrls: ['../milesverse.css', './subject.css']` — the only component in the set that reaches out
  of its own folder for a stylesheet. After the move `../milesverse.css` had to become
  `'../milesverse/milesverse.css'`. Nothing type-checks a `styleUrls` string; it would have failed at
  `build:prod` in step 7 with no hint that a move in step 2 caused it. Found by the auditor, not by a gate.
  Everything else was clean: zero hits in `angular.json`, `tsconfig*`, `.storybook/`, `src/styles/`
  Tailwind sources, `seo.ts`, `legacy-redirects.ts`, `vercel.*`; zero specs; zero stories; no relative
  `@reference`/`url()` in any of the 5 CSS files; and the only inbound references were the 4 lazy
  `loadComponent` lines in `features.ts`.
  `--quick` green: typecheck 10s, lint 5s.

- 2026-09-23 **Phase 5 / step 1 ✅ — magnet promotion #2: `video-list-wrapper` + `plan-scrolling-gallery`
  → `shared/components/`.** 7 files `git mv`'d, 13 import specifiers rewritten. `import-auditor` found
  **50 referencing hits across 15 consumer files** and, importantly, **zero** in `angular.json`,
  `tsconfig*.json`, `.storybook/**`, `src/styles/**`, `vercel.*` or any `*.stories.ts` — both components
  resolve purely through the generic `@features/*` / `@shared/*` aliases. Only the 13 **import lines**
  changed; the 14 template `<app-video-list-wrapper>` / `<app-plan-scrolling-gallery>` usages and the
  `imports: [...]` array entries are selector/symbol references and were untouched.
  **Both were clean of the `partner-icons` trap** that turned the last magnet promotion from six moves
  into seven: `video-list-wrapper` imports only `@shared/components/video-poster` and
  `plan-scrolling-gallery` only `@angular/core`, so neither dragged a sibling out of its feature.
  Neither `.css` has a relative `@reference`, so the Phase 2 CSS finding did not bite.
  Done **before** the `faculty` and `how-to-claim-credly-badge` moves deliberately, so those two land
  in `features/` with zero banned edges rather than creating two and clearing them after.
  `--quick` green: typecheck 10s, lint 6s.

- 2026-09-23 **`auth` simplification pass (still outside the refactor, still uncommitted): −171 lines.**
  Replaced a hand-rolled identify chain — `validIdentifier` + `settledIdentifier` + `httpResource` +
  `currentIdentity` + an `effect`/`setTimeout`/`untracked` debounce — with one `validateHttp` async
  validator on the identifier field, which owns the debounce, the cancellation and the gating. Also
  deleted nine dead flow signals (`isIdentifying`, `canUsePassword`, `showPasswordFirst`, `otpMethod`,
  `maskedDestination`, `supportEmailParts`, `expectedDeliveryNote`, `isDevLogin`, `loginType`), three
  unread `AuthModel` fields, and two unused `AuthSession` members. One real bug found on the way:
  gating `when` on `state.invalid()` is a **computation cycle**, because the validator feeds that
  signal — it now gates on the value only. 444 tests green; the debounce assertion still fails if the
  debounce is set to 0, so it is not vacuous.

- 2026-09-23 **Feature work on `auth`, outside the refactor (uncommitted).** `auth-identify/` now
  fires on valid identifier input, debounced, and the login form is driven by the returned `methods`.
  Recorded here only because it changes files Phase 5 has yet to move — see the ⚠️ bullet under
  "Now". Three things worth carrying forward: the previous code matched `methods.includes('otp')`,
  which the API **never** sends (`email_otp` / `phone_otp` / `password` / `saml`), so every login was
  dead — fixed; `debounced()` from `@angular/core` was tried and **removed**, because it returns a
  lazy `Resource` that never activates when read only from inside another resource's request function
  (an `effect` replaced it); and password sign-in is **gated off**, because the backend proxies no
  password route — a one-route backend ask, written up in `docs/AUTH_API.md` §7.

- 2026-09-22 **Phase 5 magnet promotion ✅ — 16 files moved, 26 import sites, 8/8 GREEN, reviewer
  PASS with zero violations.** Resolves the cross-feature-edge decision the `uae-caira` move raised;
  user chose **option (a), all six**. Largest single step of Phase 5 so far.
  **Six became seven, and the audit is the only reason.** `partner-content-list.ts:4` imported
  `iconXPartner` from a sibling `partner-icons.ts` that was **not on the list** and would have stayed
  in `features/partners/shared/models/` — promoting the component without it would have created
  precisely the **`shared → features`** edge the step exists to eliminate. So `partner-icons.ts` moved
  too; its 4 other importers (`for-firms-panel`, `corporate`, `illinois`, `bkn`) stay in partners and
  now import `@core/constants/partner-icons`, a legal direction. `features/partners/shared/models/` is
  now **deleted**.
  **The two promotions that looked riskiest were the two cleanest.** `webinar-registration-form`, four
  levels deep inside `features/offerings/webinar/shared/components/`, imports only `@shared/ui/*` and
  `@core/*` — nothing from offerings. `app-download` imports only `@core/constants/icon` and
  `@core/models/footer.model`. Neither had any outbound feature dependency.
  **Both icon files → `core/constants/`, not `shared/`:** plain SVG string constants with zero imports
  and no Angular metadata, so §3's non-UI rule sends them to `core/`; `core/constants/icon.ts` is
  already exactly that shape, and §3 gives `shared/` no `models/` bucket to land in.
  **No new boundary violation:** a repo-wide sweep returns only the **six pre-existing**
  `shared → features` edges from Phase 4 (`subscription-dialog` ×2, `ai-lab-agent-dialog` ×2,
  `utils.ts` ×2); none of the five promoted components appears. `core/` clean.
  Gates: lint 5s, unit 16s, local 23s, prod 26s, storybook 23s, format 15s, bundle, ssr 4s.
  **The step's real risk — pulling 5 components out of lazy feature chunks into the eager initial
  bundle — did NOT materialise:** initial identical to baseline at 12 files / 501.5 KB raw / 101.5 KB
  gzip (**+0.0%**), lazy chunk count **271 unchanged**, largest lazy unchanged in size.
  `/us/accounting/partners/cpacanada` → **200 with a real populated title**; that page exercises the
  moved `partner-content-list` and both relocated icon constants, so it is the strongest evidence the
  26 rewrites resolve at **runtime**, not merely at typecheck. Reviewer verified 15 of 16 moves are
  `R100`, the sole exception `partner-content-list.ts` at `R096` whose only diff is the one import that
  had to change, and that **no selector and no template markup changed**.
  **Two items logged, not fixed:** `app-download.ts:32` has `getIcon(...): any` (AGENTS.md §8 bans
  `any`) — pre-existing, but now more visible in `shared/`; and `webinar-registration-form` is a
  **design-only shell** with inert `submit`/`verifyOtp`/`resendOtp`/`goToLogin`, which promoting to
  `shared/` makes look like a finished reusable primitive. That second one is the most likely to
  mislead someone later.
  ⚠️ **Four units of work now sit uncommitted in one entangled diff** (`uae-caira.ts` is touched by
  three of them). Splitting by path is no longer practical — **one commit recommended**, message in
  the report §5.
  ⚠️ **Widest visual blast radius yet:** `partner-content-list` renders on 11 partner landing pages
  plus home, library, and 3 offerings pages. QA list in the report §4.

- 2026-09-22 **Phase 5 `uae-caira` ✅ — 9 moved + 1 deleted, 8/8 GREEN, reviewer PASS with zero
  violations.** First feature with a real internal `shared/` layer to dissolve, and the first to delete
  a file. Layer gone: components up to `components/`, and the facade **flattened** from
  `shared/services/uae-caira-facade/uae-caira-facade.ts` to `services/uae-caira-facade.ts`, per §3's
  "services and models are flat files".
  **The duplicate pipe was merged, not moved.** `pages/uae-caira/shared/pipes/local-time-zone.pipe.ts`
  deleted — it differs from `shared/pipes/local-time-zone/local-time-zone.pipe.ts` by **one word in a
  doc comment**; same class, same `@Pipe({name:'localTimeZone'})`, byte-identical `transform`. Both
  consumers repointed. Plan-sanctioned (PLAN.md "duplicates to merge"; `phase-00.md:121-122` says
  "Merge in Phase 3/5"), and the reviewer independently confirmed both the equivalence and that it is
  **not** §7 feature-code deletion. Phase 3 could not do it because both consumers still lived in
  `pages/`.
  **Tiny move thanks to the audit: only 2 inbound references repo-wide** — `features.ts:4` (facade in
  `providers`) and `:39` (lazy `loadComponent`). Zero specs, zero stories, zero config hits. 5 internal
  relatives rewritten; the 6 cross-feature imports were already aliased and are byte-identical to the
  pre-move file, which the reviewer verified — **no new edge introduced.**
  **Nothing URL-facing changed and nothing could:** the route is `path: 'home'` gated by
  `uaeCairaMatchGuard` (`ae` + `accounting`), sharing the `home` string with the default `Home` and
  `CpaLanding`; the URL comes from `features.ts` + the guard, both outside the moved folder, and the
  guard has no diff.
  Gates: lint 5s, unit 16s, local 23s, prod 23s, storybook 20s, format 13s, bundle, ssr 3s. Initial
  bundle **+0.0%**, lazy chunk count **271 unchanged**. Lazy total moved −0.4 KB raw / −0.3 KB gzip,
  directionally consistent with the pipe dedup but **classified as noise by the verifier and not
  claimed as a saving** — the deleted pipe sat in a lazy chunk and the shared one replaces it there, so
  a near-wash is expected either way.
  ⚠️ **`/ae/accounting/home` is not in the SSR smoke list**, so the gate does not cover this feature's
  own route — green means the other four did not regress, nothing more. QA list in the report §4; the
  timezone label is the merged pipe's only visible output.
  🔶 **Left as a decision, deliberately:** the move reclassifies 6 pre-existing edges into §3-banned
  `features/uae-caira → features/{home,offerings,partners}`. Unlike `connect-us`'s `Faq` import there is
  **no build-level problem forcing a fix**, so they were reported rather than fixed. Exact importer
  counts re-derived and written into Decisions with three options; `partner-content-list` is the only
  5-feature magnet, the other five are 2-feature purely because `uae-caira` exists.
  ⚠️ **Committed nothing — two features now sit uncommitted in one entangled diff** (`uae-caira.ts` was
  already modified by the `connect-us` session's `Faq` rewrite). The user chose to continue past the
  commit gate; flagged at the time and again here.

- 2026-09-22 **Phase 5 `connect-us` + the `Faq` promotion ✅ — 12 R100 renames, 8/8 GREEN, reviewer
  PASS with zero violations, lazy chunk count held at 271.** Started ⏸ blocked: `connect-us` is a
  2-line composite (`<app-enquiry-form>` + `<app-faq />`) importing the **routed FAQ page** from
  `'../faq/faq'`, so moving it would have produced `'../../../../pages/faq/faq'` — a relative import
  crossing top-level folders, forbidden by §3, with **no `@pages/*` alias** (Phase 2 left `pages/`
  un-aliased by design). Creating a violation instead of clearing one is the Phase 3/4 refusal test, so
  nothing moved until the user decided.
  **⚠️ Corrected a wrong claim this file had carried since Phase 4:** the `features/* → pages/faq`
  edges do **not** "clear when `pages/faq` becomes `features/faq`" — they **relabel** to
  `features/* → features/faq`, banned identically. Exactly the Phase 3 `utils.ts` error Phase 4 had to
  correct. Same mistake, two different files, twice — **worth watching for a third.**
  Counts re-derived from the import graph rather than trusted from PLAN.md (wrong twice already):
  **13 importers of the routed `Faq` across 7 top-level features** — offerings 6, blog 3, home,
  partners, plus `connect-us` and `uae-caira` — and `features.ts:6`, the legitimate route registration.
  Root cause: `faq.ts:14`'s `standalone = input<boolean>(true)`, an input that exists **only** so the
  routed page can be embedded as a widget. User chose §3's placement rule over §3's "routed components
  live in `pages/`" → **`shared/components/faq/`**, with `faq-item` beside it. The audit had confirmed
  it was safe: neither component imports anything from `features/*` or `pages/*`, so no
  `shared → features` edge is created, and `AccordionMode` is consumed only by its own sibling.
  **`pages/faq/` is now deleted — fully emptied** (`faq-content` had already left in the `legal`
  session). **Consequence: there is no `features/faq/` and never will be**, which **dissolves** the
  open `shared → features` item — the `faq.model.ts → features/faq/models/` decision has no
  destination, so `faq.model.ts` and `constants/faq.ts` stay in `core/`, the originally recommended
  outcome. Nothing outstanding.
  One Prettier reflow: the `@features/…` alias pushed `connect-us`'s `loadComponent` line past the
  100-char `printWidth` — same mechanism as Phases 3 and 4, and again only that one file was formatted.
  `connect-us` stays **lazy**, the first Phase 5 feature that genuinely is.
  Also handled: the user's out-of-band `compliance` move to `features/legal/pages/compliance/` (plain
  `mv`, not `git mv`) — left alone, verified byte-identical to `HEAD`, confirmed intentional, and the
  `phase-05-legal` report corrected in five places. It rides in this commit as delete + untracked.
  Gates: lint 5s, unit 16s, local 23s, prod 29s, storybook 23s, format 14s, bundle, ssr 4s. Bundle
  **+0.0%**, and the phase's specific risk — that promoting a component out of a lazy route tree
  reshuffles chunks — did **not** materialise: 271 → 271, largest lazy unchanged in size and rank, only
  its content hash moved. Reviewer separately confirmed zero relative `Faq` crossings remain, both
  route registrations survive, and the `faq` / `mobile/faq` / `connect-us` path strings are
  byte-unchanged. **`src/app/pages/` is down to 7 folders.**
  ⚠️ **First session with real visual blast radius — `Faq` renders on 13 pages.** The gates prove it
  compiles and SSRs, not that it renders. QA list in the report §4.

- 2026-09-22 **Phase 5 `connect-us` ⏸ BLOCKED — read-only audit only, ZERO source changes.**
  Preconditions passed (tree clean, `legal` committed at `d12ae67`, destination spec-named in the same
  PLAN.md row as `page-not-found`), but the `import-auditor` found that moving it would **create** a §3
  violation rather than clear one — the test Phases 3 and 4 used to refuse PLAN.md rows.
  **`connect-us` is a 2-line composite: `<app-enquiry-form>` + `<app-faq />`.** It imports `Faq`, the
  **routed FAQ page**, from `'../faq/faq'`. Moving it to `features/connect-us/pages/connect-us/` while
  `Faq` stays at `pages/faq/` turns that into `'../../../../pages/faq/faq'` — a relative import crossing
  top-level folders, forbidden by §3, and **no `@pages/*` alias exists** (Phase 2 left `pages/`
  un-aliased by design).
  **⚠️ Corrected a wrong claim this file has been carrying: carry-over (c).** It said the
  `features/* → pages/faq` edges "clear when `pages/faq` becomes `features/faq`". **They do not — they
  relabel to `features/* → features/faq`, banned identically.** Precisely the Phase 3 `utils.ts`
  error ("closes the last `core → features` edge" → actually relabels it `shared → features`) that
  Phase 4 had to correct. Counts re-derived from the import graph rather than trusted from PLAN.md,
  whose figures have now been wrong twice: **13 files import the routed `Faq`**, spanning **7
  top-level features** — offerings (6), blog (3), home, partners, plus `connect-us` and `uae-caira`
  which become features this phase — plus `features.ts:6`, the legitimate route registration.
  **Root cause: `Faq` is deliberately dual-purpose.** `faq.ts:14` declares
  `standalone = input<boolean>(true)`, an input that exists only so the routed page can be embedded as
  a section widget. §3's placement rule (2+ features → promote to `shared/`) and §3's "routed
  components always live in `pages/`" point in opposite directions for this one component, so it is a
  user decision, not a judgement I should make silently. Three options recorded under Decisions;
  **(a) promote to `shared/components/faq/`** is recommended — a pure move, zero logic change, clears
  all 13 edges, and the same reasoning the user already approved for `faq-content`.
  `connect-us` is a ~4-file move the moment that lands.

- 2026-09-22 **Phase 5 `legal` + `compliance` ✅ — 25 renames, 3 decisions settled, 8/8 GREEN,
  reviewer PASS with zero violations.** Started ⏸ blocked (the `"dissolve pages/"` decision was
  unticked and `legal` is one of the three features reserved for it), so a **read-only**
  `import-auditor` sweep over 8 symbols / **74 reference lines** ran before anything moved. It
  contradicted PLAN.md twice, and the user settled all three calls on that evidence.
  **(1) `compliance` shares ZERO code** with privacy-policy/terms-of-service — only `@angular/core`,
  `@angular/platform-browser`, `@env/environment`, its own local `ComplianceDocument` interface, and it
  never renders `<app-legal-doc>`. PLAN.md grouped it topically. → its **own `features/compliance/`**.
  **(2) `legal-doc.ts:18` + `legal-section.ts:3` both imported `faq-content`** out of `pages/faq/`, so
  `features/legal → features/faq`. Its 3 non-spec consumers span **two** top-level features → §3 forces
  `shared/components/`. **Closes the Phase 4 deferral, whose premise ("after Phase 5 the import may not
  cross a feature boundary at all") is disproved.** PLAN.md §2 finding 2: right destination, wrong
  reasoning — 16 claimed importers, 3 real.
  **(3) `faq.model.ts` → `features/faq/models/`: user chose PLAN.md's row over my recommendation to
  strike it.** Recorded, **not executed** — `features/faq/` does not exist, and moving into a
  non-existent feature folder is the exact error Phase 3 avoided. It is the `faq` session's job.
  **⚠️ Decisions 2 and 3 are jointly inconsistent with §3, flagged to the user BEFORE building:**
  `shared/components/faq-content` needs `FAQContent`, so once `faq.model` lands in `features/faq/` the
  edge becomes **`shared → features`** — a harder ban than the `features → features` edge decision 3
  accepted, and unfixable by a move. Three options recorded under Decisions.
  Steps: faq-content promoted (4 files, 3 refs); `features/legal/{pages,components,constants,models}/`
  built from 4 sources (17 files) **dissolving `pages/shared/` entirely** — it held nothing but
  legal-doc and legal-section, so the emptied dirs were `rmdir`'d; compliance moved (4 files).
  Import fix-ups worth noting: the two legal constants' `'../models/faq.model'` and
  `'../models/route-params.model'` had to become `@core/...` (those models did **not** move), while
  `'../models/legal-doc.model'` stayed valid **by accident of depth** — `constants/` and `models/` are
  siblings in the new feature, so the same string resolves to the right file. Intra-feature imports
  were left relative per §3; everything crossing a top-level folder aliased.
  Gates: lint 5s, unit 19s, local 27s, prod 33s, storybook 23s, format 15s, bundle, ssr 4s.
  **Bundle byte-identical for the third phase running** — 501.5 KB raw / 101.5 KB gzip (+0.0%), 271
  lazy chunks, largest 3418.2/839.1 gz. `reviewer` verified via `git diff -M100% --stat` that all 25
  moves are **0-insertion / 0-deletion**, that no `features → features` / `shared → features` /
  `core → features` edge exists, that the `LegalSection` component vs `LegalSectionModel` interface
  aliasing survived untouched, and — the check that mattered most — that **every route path string is
  unchanged**, so `seo.ts` `STATIC_PATHS`, the legacy redirects and the footer links are unaffected.
  `src/app/pages/` is down to **9** folders. Build churn restored with `git checkout HEAD --`.

- 2026-09-22 **Phase 5 `legal` ⏸ BLOCKED — read-only audit only, ZERO source changes.** Working tree
  was clean and `page-not-found` committed (`1462e72`), so the only failing precondition is the
  unticked "dissolve `pages/`" decision — and `legal` is one of the three features the previous session
  explicitly reserved for it. Rather than stop empty-handed I ran the `import-auditor` over all 8
  candidate symbols (the 3 pages, `legal-doc`, `legal-section`, both `resolve*` constants and
  `legal-doc.model.ts`): **74 distinct reference lines**, so the decision can now be made on evidence
  instead of on PLAN.md's grouping.
  **Three findings, and two of them contradict PLAN.md.** (a) **`compliance` shares zero code** with
  privacy-policy/terms-of-service — its only imports are `@angular/core`,
  `@angular/platform-browser`, `@env/environment`; it has its own local `ComplianceDocument` interface
  and never renders `<app-legal-doc>`. PLAN.md groups it under `features/legal/` topically, not
  structurally. (b) **`legal-doc.ts:18` and `legal-section.ts:3` both import `faq-content`**, so
  `features/legal → features/faq` — banned by §3. `faq-content`'s three non-spec consumers are those
  two plus `faq-item`, i.e. **two top-level features**, so §3 forces it into `shared/components/`.
  **This disproves the Phase 4 deferral's premise** ("after Phase 5 the import may not cross a feature
  boundary at all" — it does). PLAN.md §2 finding 2 lands on the right destination via a wrong
  importer count (16 claimed, 3 real). (c) **`core/models/faq.model.ts` must stay in `core/`** —
  `richContent`/`FAQContent` feed the two legal constants and `legal-doc.model.ts` (→ legal) **and**
  faq-content/faq-item (→ faq), so PLAN.md §3's Phase 3 row sending it to `features/faq/models/` is
  wrong, the same class of error as the six Phase 3 rows already refused.
  **Why I did not just do `legal` and defer the rest:** findings (b) and (c) are decisions about
  **faq's** files. Moving legal under a guess would strand `features/faq` and force a redo.
  Five further observations logged above, including that `pages/shared/` holds _only_ these two
  components (so legal's move dissolves it entirely), that `/compliance` is mounted top-level **and**
  mobile-only with no locale-scoped route, and the 19 URL strings that must not be touched.

- 2026-09-22 **Phase 5 `page-not-found` ✅ — 4 files to `features/`, 1 import, 8/8 GREEN, reviewer
  PASS with zero findings.** The smallest feature in the phase, run first on purpose to prove the
  Phase 5 pattern before it reaches a route table or a `shared/` layer. `git mv
pages/page-not-found` → `features/page-not-found/pages/page-not-found` — all 4 files recorded as
  renames at **100% similarity**, no content hunks anywhere. The single reference,
  `app.routes.ts:5`, went from the relative `'./pages/page-not-found/page-not-found'` to
  `'@features/page-not-found/pages/page-not-found/page-not-found'` (§3 requires an alias once the
  import crosses a top-level folder).
  **The `import-auditor` is again what kept this to one line.** 0 lazy route references, 0 usages of
  the `app-page-not-found` selector, 0 stories, 0 hits across `angular.json`, `tsconfig*.json`,
  `.storybook/*`, `eslint.config.mjs`, `vercel.json`; and all 4 of the component's own imports are
  **package** imports, so nothing broke in the outbound direction either. It also pinned down the
  three `page-not-found` mentions that are **URL strings, not file paths** and must not move —
  `app.routes.ts` (eager `component:` at `page-not-found` **and** `maintenance`, plus
  `{ path: '**', redirectTo: 'page-not-found' }`), `analytics.ts:79` `NON_LOCALE_PREFIXES`, and
  `seo-route-slug.ts` `NON_LOCALE_ROOTS`.
  **Three scope calls, all upheld by the reviewer.** (a) Nested under `pages/` rather than flattened —
  §3 says routed components _always_ live in `pages/`, and PLAN.md's `pages/x/ → features/x/` rows are
  abbreviated shorthand (the `faq` row reads the same way and unquestionably keeps `faq/pages/faq`);
  "flatten single-file folders" governs services/models, which §3 makes flat files, not component
  folders. (b) **No routes file** — the component is eager at two paths and is not one of the four
  route tables §5 extracts; adding one would change loading behaviour. (c) Empty 0-byte
  `page-not-found.css` kept — §4.6 is Phase 12.
  Gates: lint 5s, unit 16s, local build 22s, prod build 23s, storybook 19s, format 13s, bundle, ssr 4s.
  **Bundle byte-identical** — initial 12 files / 501.5 KB raw / 101.5 KB gzip (+0.0%), 271 lazy
  chunks, largest lazy 3418.2 KB / 839.1 gz — every figure matching Phase 4, with the snapshot folder
  verified untouched. SSR OK on all 4 routes.
  **Two traps avoided worth recording.** The stale `.cache/last-verify.json` from Phase 4 reports the
  _identical_ 8/8 table (6/15/22/24/19/13/0/4s), so reading that file without checking its mtime would
  have "confirmed" a run that never happened — the fresh run is `at 2026-09-22T16:17:03Z`. And the
  harness guard rejects any command whose **text** contains `verify.mjs`'s path or the baseline flag —
  including a heredoc merely _quoting_ them in prose, which is how the report had to be written with
  the Write tool instead of `cat`.
  Build churn (`public/version.json`, `core/version/app-version.ts`) was regenerated by the verifier's
  builds and **restored with `git checkout HEAD --`, which the harness allowed this time** — so unlike
  Phase 4 the diff needs no manual cleanup before committing.
  ⚠️ Ran against the still-unticked "dissolve `pages/`" decision, deliberately and for this feature
  only — see Decisions for which features must wait for the tick.

- 2026-09-22 **Phase 4 steps 5+6 ✅ — `Utils`/`EngagementDialog` to `shared/services/`, 4 layouts to
  `layout/`. Full gate run 8/8 GREEN, bundle byte-identical.** `core → shared` finishes at **2 of the
  original 25** (`notification → @shared/ui/toast`, `update-checker → version-update-dialog`, the latter
  already a dynamic import) and `core → features|admin|layout` at **0**. Step 5 aliased 15 intra-core
  relatives in the two moved files and repointed 64 inbound specifiers. Step 6 needed only **3** edits —
  no lazy route string points at any layout; all four are eager `component:`/static imports, and
  `main-layout`/`blog-layout` already reached header and footer through `@layout/*`.
  **Format check was red again, same mechanism as Phase 3 but the opposite direction** — 2 files
  (`admin-users.ts`, `firm-form-dialog.ts`) whose `checkbox-list` import _shrank_ below the 100-char
  `printWidth` once `@shared/components/ui/` became `@shared/ui/`, so Prettier wanted it collapsed onto
  one line. Fixed on those 2 files only, never `format:fix` across `src/`.
  Gates: lint 6s, unit 15s, local build 22s, prod build 24s, storybook 19s, format 13s, bundle, ssr 4s.
  **The bundle gate is meaningful this time** (no record flag, verified: `git status` on the snapshot
  folder is empty): initial 12 files / 501.5 KB raw / 101.5 KB gzip, 271 lazy chunks, largest lazy
  3418.2 KB / 839.1 gz — every figure identical. 204 renames + 178 modified files and not one byte of
  bundle drift. SSR smoke OK on all 4 routes.
  **`reviewer` returned FAIL on two bookkeeping items, both now closed, neither a code defect:** the five
  refused PLAN.md rows were written into the session plan but never into this file's Decisions (added
  above — `faq-content` was the one it flagged as "undone and undocumented"; it is a deliberate refusal,
  because PLAN.md §2 finding 2's "16 importers" is wrong and the true count is 5), and steps 5–6 were
  complete in the tree but still ⬜ here. It also **corrected my boundary count**: `shared → features|pages`
  is **3 files / 6 import lines**, not 4 — I had counted before step 5 moved `utils.ts` into `shared/`.
  One stale doc path it found is fixed: `AGENTS.md:46` said `shared/components/ui`.
  Reviewer confirmed **zero logic change** across all 382 touched files — every hunk is an import
  specifier, dynamic `import()`, `@reference` path or doc comment; no `changeDetection`, template,
  selector, style or behaviour edit, and no disable/ignore/skip pragma introduced.

- 2026-09-22 **Phase 4 steps 3+4 ✅ — 14 dialogs pushed to owners, pipes and helpers swapped; gates green.**
  `shared → features|admin|pages` drops **16 → 4**, `core → shared` **25 → 14**. The 4 left are exactly the
  two deferred items (`subscription-dialog`'s 2 payment imports, `ai-lab-agent-dialog`'s 2 into `pages/ai-labs`).
  35 inbound specifiers rewritten across 27 files; 25 outbound `'../../ui/…'` relatives in the moved dialogs
  converted to `@shared/ui/…` (a relative path would have resolved to `features/<f>/ui/…` and broken).
  `admin-rbac.model.ts` moved to `admin/core/` with `edit-admin-roles-dialog`, 13 specifiers repointed —
  **`core/models/admin/` is now gone**, closing the Phase 3 note that it held exactly one file.
  Step 4: 3 pipes → `shared/pipes/` (no core consumer; all 14 importers are UI) and 5 pure helpers the other
  way → `core/utils/`, clearing all 8 `core → @shared/utils` edges. `total-cpe-credits.pipe.ts` needed its
  `'../../models/course.model'` aliased to `@core/…` on arrival.
  **Correction to this file's own Phase 3 claim, and to my Phase 4 plan.** Phase 3 recorded that moving
  `utils.ts` to `shared/services/` "closes" the last `core → features` edge. It does not — it **relabels** it
  `shared → features`, which the spec bans just as firmly. `utils.ts` imports `PaymentFacade` statically
  (line 48) and `cart-drawer-dialog` lazily (line 767, now pointing at `@features/payment/dialogs/`), and
  step 5 carries both into `shared/`. Moving the dialog still nets −1 (it cleared 2 of its own outbound
  payment edges), but the edge itself survives Phase 4 and belongs to **Phase 11**, when `Utils`' dialog
  coupling becomes dynamic. Promoting `PaymentFacade` to `core/` the way `FeatureFacade` was promoted is
  **not** the answer — it would drag the payment domain into core.

- 2026-09-22 **Phase 4 steps 1+2 ✅ — `ui/` and `dialog/` out of `shared/components/`; typecheck ×2 + lint green.**
  Run as ONE step, deliberately: 59 imports inside `dialog/*` point at `../../ui/...`, and those strings
  stay byte-for-byte valid only because both folders lose the same `components/` segment. Splitting the
  two moves would have broken all 59 in the intermediate state. 176 files, every one recorded as a rename.
  **The `import-auditor` is what made this safe, and it changed the plan.** My own grep found the 291
  alias specifiers (224 `ui` + 67 `dialog`) and concluded the rest was config — wrong. The auditor found
  **37 further relative imports that break**, none of which contain the literal `shared/components` and so
  matched no path-based grep: 9 from `dialogs/` out to non-moving siblings (`video-js`, `miles-slug`,
  `course-about`, `categories-list`, `cards/badge-hero-card`) which need a _deeper_ `../../components/…`;
  14 the other way, from `cards/`, `slider/`, `carousel/`, `enquiry-form/`, `caira-level-stack/` into
  `ui/` and `dialogs/`; and 14 into `shared/utils/` which need a _shallower_ path. Two directions of
  breakage inside the same files — `webinar-details-dialog.ts` has a surviving `../../ui/…` two lines
  above three that break. Fixed per-import, not per-file.
  Two traps worth recording: `toast.ts:6` used `'../../../../shared/utils/cn'` — an up-and-back-into-shared
  detour that worked only by depth accident, so the correct fix is `'../../utils/cn'`, not one fewer `../`;
  and `core/services/{utils,engagement-dialog,update-checker}` all import `'../dialog/dialog'`, which is
  the **`Dialog` overlay service** in `core/services/dialog/`, not this folder — excluded as a false positive.
  4 Tailwind `@reference` paths corrected 5 `../` → 4 (`course-info`, `webinar-details-dialog`,
  `ai-lab-agent-dialog` `.css`, and the inline block in `ui/progress/progress.ts:72`); all 8 `@reference`
  targets in `src/` were then resolved against the filesystem and every one lands on `src/styles/styles.css`.
  One stale doc-comment path fixed (`core/models/aria.model.ts:3`). Repo-wide grep for the old paths over
  `src`, `.storybook`, `angular.json`, `tsconfig*.json` and `eslint.config.mjs` returns **NONE**.

- 2026-09-22 **Phase 3 steps 3–4 ✅ — 17 files pushed out of core; 6 PLAN.md push-downs refused.**
  The `import-auditor` sweep over all 35 candidate files (128 referencing file:line entries) is what
  drove this: **most of PLAN.md §3's Phase 3 push-down table would have created new boundary
  violations rather than cleared them.** Moved to `admin/core/` (flat files, matching admin's existing
  convention): `admin-auth.model.ts`, `audit-log.model.ts`, `admin-auth.ts`, `audit-log.ts` — **plus
  `interceptors/admin-token-interceptor.ts`, which PLAN.md does not list.** That interceptor is the
  single root cause tying all three admin files to `core/`: it imports `AdminAuth`, `AuditLog` and
  `AuditCategory` directly, so moving them without it would have inverted the layering into
  `core → admin`. PROMPT.md §3 puts admin interceptors in `admin/core/` anyway, so it moved too;
  `app.config.ts` now wires it from `@admin/core/interceptors/…`. Also moved `seo-csv.ts` + spec →
  `admin/seo/utils/` (admin-only, clean). Then payment (`constants/payment.ts`,
  `constants/location-min.ts` + its `eslint.config.mjs` ignore, `guards/payment.guard.ts` — that guard
  already imported `@features/payment/…`, so the move **fixes** a live `core → features` violation),
  offerings (`assessment.model.ts`, `feedback-model.ts`, `micro-learning-course.model.ts`,
  `app-download-prompt.ts` + spec) and `cpe-credit.model.ts` + spec → `features/cpe-tracker/models/`
  (**not** PLAN.md's `features/tracker/`, which Phase 5 creates by merging the two trackers — moving
  into a folder that does not exist yet would have made every importer a cross-feature import).
  Typecheck ×2 + lint green after each step.
- 2026-09-22 **Phase 3 step 2 ✅ — the two shared facades merged into `core/services/`.**
  `git mv` of `features/shared/services/{feature-facade,section-filters-facade}` →
  `core/services/` (4 files, renames), 16 alias specifiers rewritten
  `@features/shared/services/...` → `@core/services/...`. Both facades were already
  **`@core/*`-only in their own imports** — zero feature dependencies — so this is a pure move that
  clears PLAN.md §2 finding 1's 15-importer violation with no logic change. `features/shared/` now
  holds only `services/tracks/`, which stays for Phase 5 (its 2 importers are `features/features.ts`
  and a `cpa-landing` component, both inside `features/`). Typecheck ×2 + lint green.
- 2026-09-22 **Phase 3 step 1 ✅ — core moved, aliases flipped, typecheck + lint green.**
  `git mv src/app/shared/core src/app/core` (126 files, all recorded as renames) and
  `git mv core/constant core/constants`. `@core/*` retargeted in `tsconfig.json` **and**
  `.storybook/tsconfig.json`. Five hardcoded-path consumers repointed (`tsconfig.spec.json` icon
  include, `eslint.config.mjs` ×2 `location*.ts` ignores, `angular.json` ×2 `fileReplacements`,
  `scripts/generate-version.mjs:42` write target) plus the three `src/*.ts` relatives
  (`legacy-redirects.ts`, `seo.ts`, `server.ts`) and one comment path in
  `testing/partner-mock/dev-interceptors.ts`. 35 `@core/constant/` specifiers across 33 files and
  7 intra-core `../constant/` relatives rewritten to `constants/`. A repo-wide grep for the old
  path over `src`, `.storybook`, `scripts`, `angular.json`, `tsconfig*.json` and `eslint.config.mjs`
  returns **NONE**. Gates: `tsc -p tsconfig.app.json` clean, `tsc -p tsconfig.spec.json` clean,
  `pnpm lint` "All files pass linting".
  **⚠️ Note for the user:** the harness Bash guard rejects every command whose text contains the
  verify script's path, so Claude cannot run the per-step `--quick` wrapper at all. Each step was
  gated by running its two underlying checks (typecheck + lint) directly instead. End-of-phase
  verification still goes through the `verifier` subagent, which is unaffected.

- 2026-09-22 **Phase 2 ✅ complete — aliases added and 1,464 imports converted; 8/8 green.**
  `tsconfig.json` gets the 7 aliases (no `baseUrl`, `./` targets, `moduleResolution` untouched);
  380 `.ts` files get alias specifiers. **Zero moves, zero logic change**, and the bundle report
  proves it — initial 501.5 KB raw / 101.5 KB gzip (−0.1% = compression noise), 271 lazy chunks,
  both unchanged. Four batches, each gated on `--quick` **plus** a `tsconfig.spec.json` typecheck the
  harness does not run; a `--dry` re-run of all four afterwards reports 0 remaining. **The find that
  justified the pilot step: Storybook does not inherit root `paths`** — `tsconfig-paths-webpack-plugin`
  rewrites only `baseUrl` across `extends` and anchors to the config it loads, so `./src/...` becomes
  `.storybook/src/...` and misses; `.storybook/tsconfig.json` now re-declares the block with
  `../src/...`. Because `--quick` typechecks only `tsconfig.app.json`, that failure would otherwise
  have surfaced only after 1,464 lines were already rewritten. Two deviations from PLAN.md §3, both
  user-approved beforehand: the codemod is in scope at all (the literal spec bullet is config-only,
  but the collapse of the Phase 3–6 diff is the whole reason this phase runs first), and `@core/*`
  points at today's `shared/core` rather than the not-yet-existing `src/app/core`. PLAN.md's
  "add `eslint-import-resolver-typescript`" was checked and **rejected for this phase** — nothing in
  the flat config resolves a specifier, so it belongs to Phase 7. 38 imports into
  `pages/`/`auth/`/`configuration/`/app-root stay relative by design. `fileReplacements` re-proven
  through `@env/*` with the Phase 1 needles.
- 2026-09-22 **Phase 1 steps 1–4 executed; closing gates in flight.** All four `--quick` checks green
  along the way. 15 `git mv`s, all recorded as **renames**. Headline: the Partner Platform mock no
  longer reaches production — `--must-not-contain "ACMEALLI-55AA11BB"` and `"partnerMock"` both pass
  where both previously matched, the server bundle greps clean by hand, and a `local` build still
  carries the fixtures so the dev flow is unbroken. 274 → 271 lazy chunks, −21 KB raw, initial
  −0.1% gzip. Two things the approved plan missed, both caught by the per-step typecheck: the moved
  mock files' **own** imports needed repointing (`../../core/models/…` → `../../shared/core/…`), and
  the two hero specs spec-repair added reach `content.mock` through a `shared/components/` prefix, so
  they fell outside the pattern that rewrote the other 26 import lines. Started with spec-repair
  still uncommitted (user instruction), so this diff sits on top of those 78 files and
  `testing/mocks/content.mock.ts` carries edits from both.
- 2026-09-22 **spec-repair executed — `ng test` 79 failed → 0, full verifier 8/8 GREEN.** Not a
  refactor phase; it is the prerequisite that unblocks Phase 1. ~75 `*.spec.ts` rewritten, new
  `src/test-setup.ts`, `angular.json` `test.options.setupFiles`, `tsconfig.spec.json` include,
  `MOCK_CONTENT_DETAILS` appended to the existing `__mocks__/content.mock.ts`. 427 passed / 1 skipped
  of 428; the 4 added tests replace assertions that could not stand (the `ng new` `<h1>` scaffold, a
  four-slide expectation against a one-item mock, an `isOpen` assertion for state aria-autocomplete
  handed to ng-primitives). **6 assertions removed, 10 added; no `.skip`, no `@ts-ignore`, no `any`,
  no silently dropped coverage.** Initial bundle +0.0% vs baseline. Eight findings logged above —
  the two that matter most for later phases: `environment.production` is **false** under `ng test`,
  and zoneless CD means plain-field test hosts assert stale DOM. Closed open questions 3, 4 and 5;
  question 5's "suspected real bug" was a self-contradictory spec, not a defect.
- 2026-09-22 **Phase 1 planned, NOT executed — precondition failed.** `ng test` is still red (79) and
  the verify script gates it by exit code, so the phase could not close green; the user chose to run
  `prompts/spec-repair.md` first. **No `src/` changes** — read-only audit plus this file. Ran
  `import-auditor` over all 7 files Phase 1 moves: 37 references total, every `__mocks__` consumer is
  a `.stories.ts` (zero production, zero spec), and the only production wiring point is
  `app.config.ts:24`. Confirmed against the built `dist/` that the partner mock **ships to production
  today**, in both the browser (`chunk-WULZM25R.js`, 15.7 KB) and server bundles. Settled two design
  points: the `fileReplacements` stub lives in production space at
  `shared/core/interceptors/dev/dev-interceptors.ts` — an `environment` flag was rejected because it
  keeps a static import of the interceptor, so the handlers chunk would still be emitted and the
  absence proof would fail; `ACMEALLI-55AA11BB` and `partnerMock` chosen as the bundle needles. Also
  confirmed: branch is `refactor/structure-1`, closing open question 1; and no `sass` dependency
  exists, so the `.scss` conversion removes nothing from `package.json`.
- 2026-09-22 **PLAN.md approved by the user.** Decision ticked. Phase 1 not started — it still needs
  the green unit-test gate and the branch switch. No `src/` changes.
- 2026-09-22 **Phase 0 ✅ complete.** Wrote `docs/refactor/PLAN.md` (13 sections) and
  `reports/phase-00.md`. **No `src/` changes** — read-only audit plus one throwaway import-graph
  script in the session scratchpad. Parsed all 708 non-spec `.ts` files: **~150 real boundary
  violations**. Headline findings: (a) the 3418 KB / **839 KB gzip** largest lazy chunk is
  `constant/location-min.ts`, used by one file, and its sibling `location.ts` (25 MB) has zero
  importers; (b) Phase 8 is near-mechanical — zero constructor injection, zero class-based
  guards/interceptors, zero `InjectionToken`/`useClass`/`useFactory`, so **no `@Injectable` needs
  keeping**; (c) admin partner-platform v1 is not removable as a unit — its `shared/` backs v2 and
  6 other admin features; (d) `feature-facade` is imported by `core`/`shared`/`layout`, so it is
  core, not feature code; (e) `pages/` is a second features root. Three spec bullets are already
  satisfied: no committed `.DS_Store`, no `baseUrl` to remove, no `@source`/Storybook globs to
  update. Closed the `ChangeDetectionStrategy.Eager` decision as **not applicable** (all 18 are
  `OnPush`). User settled 3 decisions in-session: merge the trackers, list-only dead code, move
  `Utils` to `shared/`. Filled the Part B tracker with 12 ordered rows.
- 2026-09-22 no-op: user asked for an empty test snapshot via `git`; refused by
  `.claude/hooks/guard-bash.mjs` ("Never commit"). Nothing was recorded, HEAD still `444d638`.
  No `src/` changes this session — the stop gate fired only because pre-existing dirty files
  (`.storybook/`, `app-version.ts`) are newer than this file.
- 2026-09-22 baselines recorded (user ran `verify.mjs --record-baseline`): 7/8 gates green, only unit
  tests red (79). `baseline/ssr.json` + `baseline/bundle.json` written. Storybook gate confirmed green
  inside the harness (22s), validating the `.storybook/` restore. SSR smoke passed against all four
  routes in `smoke-routes.json`. **Caveat found:** the course route's snapshot captured fallback SEO,
  not course SEO — see open question 8. No `src/` changes.
- 2026-09-22 spec-repair prep: wrote `prompts/spec-repair.md` (goal, locked decisions, 8 execution
  phases, acceptance criteria, risks). Traced all 79 failures to 7 root-cause groups; probed
  `section-nav` to prove its 7 failures are a jsdom `getBoundingClientRect()` artifact, not a component
  bug (throwaway probe spec deleted). Flagged `footer-overlay.isAllowedRoute` as a suspected real
  product bug to be logged, not fixed. **No `src/` changes** — awaiting approval to execute.
- 2026-09-22 storybook gate fixed: user approved restore; `git checkout 8271fa4^ -- .storybook`
  (main.ts, preview.ts, manager.ts, tsconfig.json, tsconfig.doc.json, typings.d.ts).
  `pnpm build-storybook` → "Storybook build completed successfully". Gate green. No `src/` changes.
  Noted `src/app/shared/core/version/app-version.ts` is regenerated by every build and dirties the tree.
- 2026-09-22 setup: harness verified complete (`.claude/settings.json`, 5 hooks, 3 agents, 3 skills,
  `scripts/refactor/{verify,ssr-smoke,bundle-report}.mjs`, `docs/refactor/{PROMPT,STATE,smoke-routes}`).
  `docs/refactor/README.md` does not exist in the repo. `chmod +x` applied to `.claude/hooks/*.mjs` and
  `scripts/refactor/*.mjs`. Added `docs/refactor/.cache/` to `.gitignore`. `src/server.ts` reads
  `process.env['PORT']` (default 4000) — OK for ssr-smoke. Filled `smoke-routes.json` with `/`,
  `/us/accounting/partners/cpacanada`, `/us/accounting/masterclass/154/adulting-in-business`,
  `/admin/login`; canonical locale prefix is `us/accounting` (seo.constants), not `us/cpa`, and the
  course id/slug comes from the live production sitemap. Typecheck clean; `verify.mjs --no-ssr` →
  2 red gates (see open questions). No `src/` changes.
