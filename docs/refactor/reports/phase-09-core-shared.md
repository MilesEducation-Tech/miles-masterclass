# Phase 9 — Data layer: `core/services` + `shared/services`

Part B, second modernization phase. Scope set by the user (STATE.md "Decisions"): `core/services` +
`shared/services` rather than `features/blog`, and including the `CartStore` conversion.

**Status: all five steps (0–4) complete. CLOSES ✅ on the user's decision (2026-09-24).**

7 of 8 gates green. `ssr smoke` is red against a **stale recorded baseline** and is proven not
attributable to this work (§2), so PROMPT.md §6's "full green run" is not literally met — the user
closed the phase ✅ on that evidence rather than leaving it ⛔.

⚠️ **This is a deliberate departure from the Phase 7 precedent**, where the same one-red-gate situation
was closed ⛔. The difference is the nature of the red: Phase 7's was a real unexempted lint violation,
this one is a measurement artefact. Recorded so that "Phase 9 closed ✅ with a red gate" is never cited
as a precedent for closing over an unexplained red. **The baseline re-record remains open** (§3).

## 1. Summary

**16 files: 12 modified, 4 new** (+1,355 / −289, of which the report itself is one new file).
**Six GET reads converted to `httpResource`**, five new or rewritten specs, one facade flag split, one
tracker repair.

| Step | What changed                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0    | **Tracker repair (docs only).** Added the missing `shared/components` + `shared/dialogs` Part B rows; **removed the `features/blog` row** — that module no longer exists (deleted in `890e52d`), so PLAN.md §13 row 2 and PLAN.md §5's "`blog-api.ts` is one of only two files injecting `HttpClient`" are both stale. Recorded the 5 user decisions.                                                                                |
| 1    | **`JobSectors`** — `toSignal(api.get().pipe(map, catchError, shareReplay))` → one `httpResource` with a `defaultValue`. `ApiClient` and `Logger` injections dropped (`apiUrl` is a free function). Public API unchanged, so its one consumer is untouched. **New 7-test spec.**                                                                                                                                                      |
| 2    | **`caira-level-stack`, `surround-carousel`, `course-related-section`** — three rendered reads. Each dropped `resource()` + `firstValueFrom` + `takeUntil(abortSignal)` + an `ApiClient` injection. `course-related-section` additionally **deleted an `effect()` + `.subscribe()` + `signal.set()`**, which is precisely the pattern §4.2 exists to remove. **1 spec rewritten, 1 given HTTP it never had, 1 created from nothing.** |
| 3    | **`CartStore`** — the bucket read became an `httpResource`; `cartData` is a `linkedSignal` over it, `loading`/`error`/`cartFetched` are `computed()`. Consequential split in `PaymentFacade` (§1.3). **New 8-test spec.**                                                                                                                                                                                                            |
| 4    | **`FeatureFacade`** — the non-track list read became an `httpResource`; `requiresAuth` re-wired to the real `AuthSession.isAuthenticated()`; the track fan-out and `getAbout()` stay on RxJS. The page-Map accumulator is **deleted**. **13 tests replacing a one-line smoke test** (§1.4).                                                                                                                                          |

### 1.1 Three findings that mattered more than the conversions

**`defaultValue` does NOT make `value()` safe — it still throws in the error state.** A default covers
`idle` and `loading` only. I shipped `computed(() => res.value()?.data ?? [])` first and the new
`JobSectors` spec caught that a 500 would throw _inside the profile-completion dialog's template_ — a
straight regression against the `catchError(() => of([]))` it replaced. **Every converted read now
carries both a `defaultValue` and a `hasValue()` guard.** `caira-level-stack` already had both, which
now reads as deliberate rather than redundant. PROMPT.md §4.2 says to guard every `.value()` read and
it means it even when a default is set.

**The repo's spec settle idiom is insufficient for asserting a flushed value.** `account-api.spec.ts`
uses `void res.value(); TestBed.tick();`, which is fine _there_ because it only asserts request counts
and `hasValue() === false`. `TestBed.tick()` is synchronous while a resource applies its response on a
microtask, so a tick-only settle sees the `defaultValue` and never the payload — five of seven tests
failed on exactly this. The settle that works is **`await TestBed.inject(ApplicationRef).whenStable()`**
(there is no `TestBed.whenStable()` in 22.0.8 — it does not compile). Established with a throwaway
probe before being trusted. Corollary: **never await stability before flushing** — a pending request
never stabilises and the await hangs to timeout.

**An `httpResource` whose request function returns a URL is in the `loading` state from construction.**
Measured, not assumed. This is why `CartStore` needs its `wanted` gate: an ungated resource would have
fired an authenticated `mybucket` request the moment anything injected `CartStore` — which includes
`Utils` (64 importers) and `footer-overlay`, i.e. **every page in the app**.

### 1.2 The `CartStore` gate, and why the resolver needed no rewrite

The plan predicted a `cartResolver` rewrite keyed on `status()`, because `isLoading()` is `false` in the
idle state and the resolver waits for `loading` to go false. **That prediction was wrong, and only a
probe could show it.** Two measured facts make the existing resolver faithful as written:

- `reload()` flips the status to `reloading` **synchronously**;
- opening the `wanted` gate flips `loading` to `true` **synchronously** too
  (`immediately-after-first-call:loading=true`).

So the resolver cannot sample a stale settled state and wave a deep link through with an unloaded cart.
`payment-guard.ts` and the resolver's code are therefore **unchanged**; only the reasoning was recorded
at the call site. `reviewer` independently confirmed the synchronous behaviour from Angular's own
`_resource-chunk.mjs` (`state`/`status` are pull-based `linkedSignal`/`computed`, hence glitch-free).

### 1.3 The unplanned finding: `PaymentFacade.loading`/`.error` were never cart-only

`tsc` caught this, not review. The facade **writes** those signals for `proceedToPayment()` and
`loadOrderById()` — operations with nothing to do with the cart bucket. Once `CartStore`'s half became
derived (read-only), 8 assignments failed to compile.

Fixed by giving the facade its own `opLoading`/`opError` and **OR-ing them with the cart's**. The OR is
what preserves existing behaviour rather than quietly narrowing it: `paymentGuard`/`cartResolver` wait
on `loading`, so today they also wait out a checkout POST. Deriving `loading` from the cart alone would
have silently stopped that — a behaviour change smuggled in by a refactor. If that wait is unwanted it
is a separate, deliberate decision.

### 1.4 Step 4 — `FeatureFacade`, and the defect the new tests caught

**What converted:** the non-track list read only. Its trigger was already
`combineLatest([toObservable(page), toObservable(refreshTrigger), toObservable(filters)])`, which maps
1:1 onto a reactive request function. **What did not:** the `track` branch (one `tracks/` GET, then a
`forkJoin` of one content GET per track, plus per-track `groupBy`/`mergeMap`/`switchMap` streams — one
`httpResource` is one request and N is only known at runtime) and `getAbout()` (imperative, five
event-handler call sites consuming an Observable).

**`items`, `paginationData`, `metadata` and `isLoading` are `linkedSignal`, not `computed`,** and that
is forced rather than stylistic: `applyBookmarkChange()` calls `items.update()` across every loaded
listing to flip a bookmark with no round-trip, `adjustBookmarkCount()` writes `paginationData`, and the
surviving track pipeline drives all four by hand.

**The defect I shipped first, and the tests caught: you cannot accumulate by mutating a Map inside a
signal computation, because a computation is LAZY.** The first draft filed each settled page into the
existing `pages` Map from inside the `items` computation. Two tests failed, and the cause was not the
tests: if nothing read `items()` between page 1 settling and page 2 arriving, **page 1 was never folded
in and was silently lost**. Rewritten to accumulate through the computation's own `previous` value —
page 1 replaces, later pages append — which has no such hole and **deletes the `pages` Map and
`flattenPages()` outright**, because `patchItems`/`prependItem` writes simply _are_ `previous.value`.
The result is smaller and more correct than what it replaced. One standing constraint remains: a
non-first page must never be re-requested for the same page number, or its rows would append twice.
Nothing does — every refetch path resets to page 1 first, and a test pins that.

**`refresh()` needs two different mechanisms, and one is a trap.** A resource refetches only when its
request _object_ changes, so the old `refreshTrigger` counter would be tracked and then ignored by a
request function — it cannot force a refetch. The non-track path calls `reload()`, and only when the
page did not actually change, because a real page change already produces a different request and doing
both would fire two requests per refresh. The track path keeps the counter, since its `combineLatest`
does re-emit on it.

**A faithfulness gap caught by re-reading my own diff, not by a gate:** an errored resource must count
as _settled with no rows_ and must clear `paginationData`. The old `catchError(() => of({data: [],
pagination: undefined, …}))` did exactly that. Treating an error as "not settled" instead leaves the
previous pagination in place, and a stale `next_page` means an infinite-scroll container **keeps asking
for the page that just failed**. Now explicit in `listSnapshot` and pinned by a test.

🚨 **The approved behaviour change is bigger than the plan's "seven keys": there are 15 live
`getResource(..., { requiresAuth: true })` call sites** — masterclass 6, podcast 6, micro-learning 3 —
every one of which issued **no request at all** before this step, because `isAuthenticated` was
hardcoded `false`. They now fetch for signed-in users. **This is the phase's main QA risk** and the
reason §4's list leads with it.

⚠️ **`footer-overlay.ts:100` was deliberately left alone.** Its `isLoggedIn = signal(false)` reads the
**removed `Auth` service**, not `AuthSession`, and its sibling `subscribed` has no available source at
all — re-wiring one without the other would change what the overlay renders. That belongs to the
`layout` row, not a data-layer phase. Its `requiresAuth` call site therefore stays dormant.

### 1.5 A test-only bug of mine that only step 4 exposed

`caira-level-stack.spec.ts` (step 2) called `vi.stubGlobal('matchMedia', …)` with no restore.
`vi.stubGlobal` writes `globalThis`, which outlives the file, and `core/services/viewport` is **also**
backed by `matchMedia` — a stub answering `matches: false` to every query makes `Viewport` resolve to
`mobile`, which broke `section-nav.spec.ts`'s header-docking assertion. It passed in steps 2 and 3
purely by execution order; changing `feature-facade.ts` reshuffled that order and surfaced it. Fixed
with `afterEach(() => vi.unstubAllGlobals())`, and the suite was re-run twice to confirm stability
rather than once. **Lesson: a global stub in any spec is a cross-file hazard, and a green suite is not
proof one is absent.**

## 2. Verification

`verifier`: **7 of 8 gates green.** `ssr smoke` is red against a stale recorded baseline (below).

| Gate            | Result                                                                              |
| --------------- | ----------------------------------------------------------------------------------- |
| lint            | ✅ pass                                                                             |
| unit tests      | ✅ pass — **163 files / 554 passed + 1 skipped** (baseline 160 / 519 + 1)           |
| build (local)   | ✅ pass                                                                             |
| build (prod)    | ✅ pass (2 pre-existing CSS budget warnings: `ai-labs.css`, `briefing-session.css`) |
| storybook build | ✅ pass                                                                             |
| format check    | ✅ pass                                                                             |
| bundle report   | ✅ pass                                                                             |
| ssr smoke       | ❌ **fail on 2 routes — stale baseline, not this work (see below)**                 |

Steps 0–3 alone did reach **all 8 green**, including `ssr smoke` — the first such run of this refactor.
The red appeared only on the step-4 run, which is why it was chased rather than accepted.

`reviewer`: **PASS, zero spec violations**, run twice — once over steps 0–3 and once over the step-4
diff specifically. The second pass verified the risky claims against the installed Angular 22.0.8
source rather than from memory: that `computed()`/`linkedSignal()` are fully lazy (so the field-init
order is safe), that returning `undefined` from a request function issues no request at all, and that
an errored resource clears pagination.

### `ssr smoke` — red, and provably not this work

Two routes differ from `docs/refactor/baseline/ssr.json`:

| Route                                                 | Baseline                        | Now                                  |
| ----------------------------------------------------- | ------------------------------- | ------------------------------------ |
| `/us/accounting/partners/cpacanada`                   | generic brand title/description | the real CPA-Canada partner SEO copy |
| `/us/accounting/masterclass/154/adulting-in-business` | bare `{{title}}`                | `{{title}}                           | Master Class | Miles Masterclass` |

**My first hypothesis was wrong and is worth recording as such.** I guessed a timeout race in
`SeoManager.loadFromSupabase` (`TIMEOUT_SERVER_MS = 4500`, with a brand-default fallback), which is
mechanically real. It is not what is happening: the failure is **deterministic**, identical across
3 harness runs and 5 direct `curl`s of the built server. Four independent facts settle attribution:

1. **Both diffs go the wrong way for a regression.** The renders now contain _more_ correct SEO data
   than the baseline. A code regression loses data; it does not invent correct partner copy.
2. **`git diff 07afb23..HEAD` over the SEO path is empty.** The baseline was recorded at `07afb23`, and
   nothing in `core/services/seo`, `shared/utils/seo`, `features/partners`, `features/offerings/masterclass`
   or `app.ts` has changed since. The SEO code is byte-identical to the code that produced the baseline.
3. **Nothing in this phase's diff is reachable from the SEO path** — grep-confirmed for all seven
   changed source files.
4. `{{title}}` is still unresolved, which is the _already documented_ pre-existing
   course-API-unreachable condition on this machine; only the SEO suffix around it changed.

**Conclusion: the recorded `ssr.json` captured a render in which those two Supabase `seo_pages` rows had
not resolved.** It is stale in the same way `bundle.json` is. What I could not establish from inside the
repo is _when_ those rows were last edited in Supabase — that is a data question, and it would close the
loop completely.

### Bundle — the −13 KB is NOT mine, and that had to be measured

The harness reports initial gzip **102.3 → 89.2 KB (−12.8%)** against the recorded baseline. That is far
too large for a data-layer change, so it was attributed with a clean `git worktree` build of `HEAD`,
measured with one identical script so the numbers are comparable:

|                                                             | files | raw          | gzip        |
| ----------------------------------------------------------- | ----- | ------------ | ----------- |
| Recorded baseline (`bundle.json`, stamped 2026-09-24T03:16) | 12    | 506.6 KB     | 102.3 KB    |
| **`HEAD` (`890e52d`), none of my changes**                  | 12    | **454.7 KB** | **88.1 KB** |
| **Working tree (this phase)**                               | 12    | **454.6 KB** | **88.0 KB** |

**My delta is −0.1 KB raw / −0.1 KB gzip** — effectively byte-identical, marginally smaller from the
dropped injections and rxjs operators. The whole −13 KB belongs to the other session's commits,
overwhelmingly the blog removal: `styles.css` went from ~380 KB raw to 298.4 KB, and its content hash
(`styles-L2LIUX2D.css`) is **identical** between `HEAD` and my tree, which proves I did not touch it.
`main.js` is 91.6 KB in both.

⚠️ **`public/version.json` and `core/version/app-version.ts` were build-generated during the gate runs
and have been restored to HEAD**; they are not in the change set. `docs/refactor/baseline/` is untouched.

## 3. Decisions needed / skipped / suspicious

### Step 4 is DONE — nothing from the approved scope was left out

All five steps landed. The step-4 design that this section previously deferred is now implemented and
described in §1.4. Nothing in the user-approved scope remains outstanding.

What deliberately stays on RxJS, with the reason recorded at each call site: the `track` branch's
dependent fan-out, `getAbout()`, `SectionFiltersFacade`'s multi-key cache, the instructor `forkJoin` in
`course-related-section`, both debounced searches, the `update-checker` poll, and every mutation. The
full list is in the non-fits table below.

### Decision requested

1. **Re-record BOTH baselines** — `bundle.json` and `ssr.json` — at `890e52d` or later, after reviewing
   this change set. Only you can record them, and both are demonstrably stale:
   - `bundle.json` predates the blog removal, so it under-reports by ~13 KB gzip and will keep crediting
     every future phase with a win it did not earn.
   - `ssr.json` captured a render in which two Supabase `seo_pages` rows had not resolved, so the
     `ssr smoke` gate now fails on renders that are _more_ correct than the record. **Until it is
     re-recorded, Phase 9 cannot meet §6's "full green run"** even though the work is complete — the
     same position Phase 7 was in.
2. ~~**Does Phase 9 close ✅ or ⛔?**~~ **SETTLED: ✅** (user, 2026-09-24). See the status note at the
   top of this report for the reasoning and the precedent caveat.
3. **`shared/dialogs` has no Phase 9 work** — the new tracker row is correct to exist but is empty for
   this phase (`ai-lab-agent-dialog` is blocked, `certificate-download-dialog` is POST + blob,
   `profile-completion-dialog` is PATCH). Close that cell ✅-by-vacuity or leave it ⬜?
4. **The `requiresAuth` re-wire is live on 15 call sites** and changes what signed-in users see on four
   page types. It was approved before execution, but it is worth a conscious look before merge rather
   than discovering it in production — see §4.

### Logged, not fixed (PROMPT.md §7)

1. **`course-related-section`'s old effect double-fired** when `courseType()` changed without
   `courseId()`, and its `.filter(c => c.id !== this.courseId())` read `courseId()` inside a
   `.subscribe()` callback, outside any reactive context. The conversion removes both by construction —
   noted because it explains a behaviour difference rather than being a deliberate fix.
2. **`caira-level-stack.spec.ts` was passing vacuously.** It provided no `HttpClient` at all, so the
   resource errored on every run and `hasValue()` swallowed it; the suite only ever exercised
   `FALLBACK_LEVELS`. Now fixed, but the same shape may exist elsewhere.
3. **`surround-carousel.spec.ts`'s `ApiClient` mock went blind.** Once the read became an
   `httpResource` the mock observed nothing while every assertion still passed. **Any other spec that
   mocks `ApiClient` for a read will silently stop testing anything when that read is converted** —
   relevant to every remaining Phase 9 session.
4. **jsdom has no `window.matchMedia`**, which `caira-level-stack`'s gsap setup calls. It was logging an
   ERROR on every test run before this phase, invisibly. Stubbed in that spec only.
5. **`v2/caira-badges/` and `v2/filters/` are bare string literals**, not `*_ROUTES` registry entries.
   Left as-is: promoting them means touching the tracker's readers, which belongs to other rows.
6. **`appStatus` in `AccountApi` has no consumer** anywhere in `src/` outside its spec.

### Non-fits — reads that deliberately stay on RxJS

Confirmed against the code, not assumed. `shared/services/**` yielded **zero** `httpResource`
candidates, which is why the real conversions came from `shared/components`.

| Call site                                                           | Why it stays                                                                                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `utils.ts:555` `claimBadge`                                         | A GET that mutates (claims a badge); click-triggered; 3 consumer shapes                                                                                            |
| `utils.ts:792` `openAdditionalResources`                            | The request _is_ the click; a resource would re-open the dialog on refetch                                                                                         |
| `utils.ts` ×3 POST                                                  | Mutations                                                                                                                                                          |
| `SectionFiltersFacade.fetch()`                                      | Multi-key `Map<string, Observable>` cache with scoped eviction; one field cannot hold N keys                                                                       |
| `course-related-section.ts:131`                                     | `forkJoin` fan-out over N instructors                                                                                                                              |
| `global-search`, `location-autocomplete`                            | Debounced search — §4.2 says RxJS explicitly                                                                                                                       |
| `update-checker.ts:67`                                              | Polls on 4 triggers; raw `fetch`, `cache:'no-store'`, interceptor-bypass **by design**                                                                             |
| `html-to-pdf.ts:293`                                                | Blob read feeding canvas rasterisation                                                                                                                             |
| `certificate-download-dialog:250`                                   | POST + blob download + per-variant in-flight flags                                                                                                                 |
| `profile-completion-dialog:87`                                      | PATCH mutation                                                                                                                                                     |
| `salesforce-lead`, `enquiry`, `utm`, `partner-code`, `auth-session` | POST mutations                                                                                                                                                     |
| `ai-lab-agent-dialog:112`                                           | `this.data` is assigned _after_ construction, so a request function would read `undefined`. Needs `data` to become a signal first — a prerequisite, not this phase |
| `supabase-seo.ts` (8 sites)                                         | supabase-js, not `HttpClient`; `getAll` belongs to the `admin/seo` row, `getBySlug` is per-route with `TransferState` + AbortController + single-flight            |
| `miles-activity`                                                    | Inert — `send()` is a no-op since the session service was removed                                                                                                  |

## 4. Visual QA list

The gates cannot see any of this. Run `pnpm start` (port **4100**).

- **Home** — the CAIRA level stack renders its levels (not the static fallback), and the surround
  carousel renders its cards. Both moved to `httpResource`; both fail _silently_ to a fallback, so a
  regression here is invisible to every gate.
- **A masterclass or podcast course page** — the "Related Courses" carousel still renders, and the
  "More by &lt;Instructor&gt;" carousels still render (that half was deliberately left on `forkJoin`).
- **Profile-completion dialog** — sector and job-role dropdowns populate.
- **Checkout, the one that matters** (`CartStore`): add to cart → cart drawer → `/payment/cart` →
  `/billing` → `/review`, then **hard-refresh directly on `/payment/billing`**. That deep-link path is
  the only reason `cartResolver` exists, and no gate exercises it.
- **Cart totals after applying a coupon** — that exercises `setCartData()` writing through the
  `linkedSignal`.
- **An invoice page** (`/payment/invoice/:orderId`) — exercises the new `opLoading`/`opError` split.

🚨 **The big one, and the reason this list is not a formality — the 15 restored `requiresAuth`
listings.** These issued **no request at all** before this phase and now fetch for signed-in users.
Check each page **signed in AND signed out**:

| Page                     | Listings that were dead and are now live                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `/us/cpa/masterclass`    | Continue Watching, Bookmarks, Completed, Recommended, Complimentary, Because You Watched (6) |
| `/us/cpa/podcast`        | the same six                                                                                 |
| `/us/cpa/micro-learning` | three of them                                                                                |

- **Signed in:** these sections should now show data where they were previously empty or absent. Section
  visibility is driven by `items().length > 0`, so a page's whole layout can shift.
- **Signed out:** they must be empty and issue **no** network request at all (pinned by a test, but
  worth seeing in the Network tab).
- **"Load more" on any listing** — accumulation moved from a page Map to `linkedSignal`'s `previous`.
  Confirm pages append rather than replace, and that **no card appears twice** (a duplicate would mean a
  page got re-requested for the same page number).
- **Apply a filter, then clear it** — page must reset to 1 and the accumulator must be replaced, not
  appended to.
- **Bookmark from a card while several listings are on screen** — every visible copy should flip in
  lockstep, and the Bookmarks listing should gain/lose the row **with no network request**.

## 5. Commit message

```
refactor(core): migrate core and shared reads to httpResource

Phase 9. Six GET reads move from toSignal/resource/effect wrappers to
httpResource; mutations, debounced search, polling, blob downloads and the
runtime-N fan-outs stay on RxJS per the spec.

- JobSectors: toSignal + map/catchError/shareReplay -> one resource
- caira-level-stack, surround-carousel: resource + firstValueFrom -> resource
- course-related-section: drops an effect + subscribe + signal.set
- CartStore: linkedSignal over the resource, so PaymentFacade can still write
  the cart it gets back from a coupon or checkout response
- FeatureFacade: the non-track list read only; the track fan-out and getAbout()
  stay on RxJS because one httpResource is one request and N is runtime-known

FeatureFacade's requiresAuth was hardcoded false, so 15 getResource call sites
across masterclass, podcast and micro-learning issued no request at all. It now
gates on AuthSession.isAuthenticated(), the boolean, so those listings work --
a deliberate, approved behaviour change that needs visual QA.

Its page-Map accumulator is gone: items accumulates through linkedSignal's own
previous value, so patchItems/prependItem edits survive a page load for free.
The Map version was subtly broken -- a computation is lazy, so a page nobody
observed was never folded in.

CartStore keeps an explicit `wanted` gate: an httpResource with a URL is loading
from construction, so an ungated one would fetch the cart on every page that
injects it, Utils and footer-overlay included.

PaymentFacade.loading/.error turned out never to be cart-only -- it writes them
for proceedToPayment and loadOrderById -- so it keeps its own opLoading/opError
and ORs them with the cart's, preserving the wait paymentGuard and cartResolver
already had.

Every converted read guards value() with hasValue(): a defaultValue does not
stop value() throwing in the error state.

Tests: 163 files / 554 passing. Adds specs for JobSectors, CartStore and
course-related-section (none had one) and 13 for FeatureFacade (which had a
one-line smoke test); ports surround-carousel's ApiClient mock to
HttpTestingController, which had stopped observing anything; gives
caira-level-stack the HttpClient its suite never provided; and restores a
leaked vi.stubGlobal that was breaking section-nav by execution order.

Tracker: adds the shared/components and shared/dialogs Part B rows, removes the
features/blog row (that module no longer exists).
```

Exclude `public/version.json` and `src/app/core/version/app-version.ts` (build-generated) — already
restored to HEAD in this change set.
