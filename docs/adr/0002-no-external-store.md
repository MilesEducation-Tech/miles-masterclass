# ADR-0002: No external state store; signal services + `httpResource`

**Status:** Accepted
**Date:** 2026-08-07
**Deciders:** Frontend lead
**Applies to:** all feature state in `src/app`

## Context

`241ce4f` deleted 21 facades along with the Django data layer. The CAIRA API binding is rebuilding
them, so the state-management question is open in a way it normally would not be: roughly twenty
services are about to be written, and whatever pattern they use is the pattern for years.

NgRx **SignalStore** (`@ngrx/signals`) was raised as an alternative to the facade pattern, across the
whole project rather than just auth. It is a genuine candidate — signal-native, far lighter than
classic NgRx, and `withEntities` / `signalStoreFeature` map well onto list-heavy screens.

The remaining work is list-heavy, which is the strongest case for it:

| Phase                  | State shape                               |
| ---------------------- | ----------------------------------------- |
| P3 masterclass         | 8 paginated feeds + course detail         |
| P4 chapter progress    | per-chapter records                       |
| P6 CPE tracker, badges | tables, filters, pagination, level groups |
| P7 webinars            | three grouped lists                       |

Three things constrain the choice:

1. **`AGENTS.md:94`** — "NgRx, Akita, or any external store. `@ngrx/*` must not enter
   `package.json`." A pre-existing, explicit rule.
2. **Two skills prescribe the opposite of centralised state**, specifically and with reasons:
   - `library` — "Don't merge them into a 'LibraryFacade.'"
   - `cpe-tracker` — "Filtering and pagination are **entirely computed**. Never store a filtered
     copy — that's how a table ends up disagreeing with its own row count." And: "Three loading
     flags, three skeletons. Don't collapse them into one."
3. **Angular 22 covers the main case natively.** `httpResource` runs through the interceptor chain,
   aborts in-flight requests when params change, and exposes `value()` / `isLoading()` / `error()` /
   `status()` / `reload()` — the exact `loading`/`error`/`data` triple that made the old facades
   verbose. The bundle budget is 2 MB warn / 3 MB error and `tech-stack` says not to raise it.

## Decision

No external state library. Feature state stays in **route-scoped signal services** — `@Service({
autoProvided: false })` holding `signal` / `computed` — with `httpResource` for reactive reads and
`ApiClient` + `takeUntilDestroyed` for writes.

Where several features need the same list-with-pagination-and-filters shape, extract a **plain
factory function** returning `{ items, isLoading, hasMore, page, loadNextPage, setFilters }` rather
than reaching for `signalStoreFeature`. The deleted `FeatureResource` was already exactly this and
composed across eight feeds; the components' surviving placeholder literals are still shaped for it.

`AGENTS.md:94` stands as written.

## Options Considered

### Option A: NgRx SignalStore for all feature state

| Dimension        | Assessment                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Complexity       | Medium — new concepts: `signalStore`, `withState`, `withComputed`, `withMethods`, `withEntities`, `rxMethod`, `patchState` |
| Cost             | ~15–20 kB, plus rewriting 4 live services and every phase not yet built                                                    |
| Scalability      | Strong for shared normalised entities                                                                                      |
| Team familiarity | Unknown; not currently used anywhere in the repo                                                                           |

**Pros:** `withEntities` is real value for tracker tables and library lists. `signalStoreFeature`
composes shared slices properly. Redux DevTools. Less boilerplate than a hand-rolled state triple.
**Cons:** Contradicts three written rules. New dependency against a budget that must not rise.
`rxMethod` overlaps almost entirely with `httpResource`, which is already the plan of record. Mid-
migration adoption means rewriting the four services already built and verified.

### Option B: Signal services + `httpResource` (chosen)

| Dimension        | Assessment                                                         |
| ---------------- | ------------------------------------------------------------------ |
| Complexity       | Low — framework primitives only                                    |
| Cost             | Zero dependency; one factory function to write in P3               |
| Scalability      | Good for per-route state; weaker if genuinely shared state appears |
| Team familiarity | High — three live admin facades already do this                    |

**Pros:** No new dependency. Consistent with `AGENTS.md`, both skills, and the three surviving
Supabase facades. `httpResource` removes the boilerplate that motivated looking at a store.
Route-scoping means state cannot leak between courses — currently enforced by construction.
**Cons:** No entity adapter; a normalised cache would have to be hand-rolled if one is ever needed.
No DevTools time-travel. Shared cross-feature state would need deliberate design rather than coming
free.

### Option C: SignalStore only for the list-heavy phases (P3, P6, P7)

| Dimension  | Assessment                                                     |
| ---------- | -------------------------------------------------------------- |
| Complexity | High — two patterns, and a judgement call at every new service |
| Cost       | Dependency cost without the consistency benefit                |

**Pros:** Uses the tool where it is strongest.
**Cons:** "Which pattern does this service use?" becomes a question with no crisp answer. Rejected
for the same reason as ADR-0001 Option C: two conventions are worse than either one.

## Trade-off Analysis

This is closer than the summary suggests, and worth being honest about: the majority of remaining
work **is** list state, and that is precisely `withEntities`' sweet spot. Option A is not a bad
choice.

What decides it is the _lifetime_ of the state rather than its shape. `withEntities` earns its keep
on long-lived, shared, normalised caches that several screens read and mutate. Here every list is
fetched per route, rendered, and dropped on navigate — facades are route-scoped **by design**, so a
course cannot leak into the next one. An entity adapter over state that lives for one navigation is
machinery without a payload.

The second factor is that the boilerplate argument has already been answered. The old facades were
verbose because each hand-rolled `loading` / `error` / `data` plus a manual subscribe — and the
deleted `MasterclassFacade.loadCourse` shipped a `.subscribe()` with no `takeUntilDestroyed`, a real
leak that `angular-conventions` itself flags. `httpResource` fixes both, natively, and was already
adopted in the binding plan.

Third: adopting Option A means reversing an explicit written rule mid-migration. That is legitimate
if the rule is wrong — but the rule is not wrong here, it is aligned with the two skills that
independently reached the same conclusion for the two most list-heavy features in the app.

The remaining risk is that we hand-roll something that grows into a bad store. The mitigation is the
reversal threshold below, stated up front rather than discovered later.

## Consequences

**Easier**

- No dependency, no bundle cost, no version coupling to a library outside Angular's release train.
- One pattern across learner features and the admin panel.
- `httpResource` gives request cancellation on param change for free — the thing the old facades
  most often got wrong.

**Harder**

- No entity adapter. A normalised, shared cache is hand-rolled work if one is ever needed.
- No Redux DevTools. Debugging state is reading signals, not scrubbing a timeline.
- The shared list-state factory is ours to maintain and test.

**To revisit — any one of these reverses this ADR**

1. **Genuinely shared mutable state appears** — the same course object edited from the chapter
   player, the CPE tracker and the badge page at once, where "who owns this signal?" stops having an
   obvious answer.
2. **The hand-rolled list factory grows past ~150 lines** or sprouts a second incompatible variant.
   At that point we are writing a store badly and should adopt one written well.
3. **Debugging cost becomes visible** — time-travel would demonstrably have saved real hours.

If any fires, supersede this ADR, amend `AGENTS.md:94` explicitly rather than quietly, and update
the `library` and `cpe-tracker` skills in the same change.

## Action Items

1. [x] Keep `AGENTS.md:94` as written; do not add `@ngrx/*`.
2. [x] Record `httpResource` for reactive reads / `ApiClient` for writes in the binding plan
       (already Decision 7).
3. [ ] Build the shared list-state factory in **P3**, modelled on the deleted `FeatureResource`
       (`git show 405244f:src/app/features/shared/services/feature-facade/feature-facade.ts`), and
       reuse it in P6 and P7 rather than re-deriving it.
4. [ ] Add a line to the `angular-conventions` skill pointing at this ADR, so the next person asking
       "why not NgRx?" finds the reasoning instead of re-litigating it.
