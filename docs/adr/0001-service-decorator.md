# ADR-0001: Use the `@Service` decorator instead of `@Injectable`

**Status:** Accepted
**Date:** 2026-08-07
**Deciders:** Frontend lead
**Applies to:** every injectable class in `src/app`

## Context

The repo runs Angular **22.0.8**. Angular 22 ships a `@Service` decorator alongside `@Injectable`,
exported from `@angular/core` (`types/core.d.ts`, `declare const Service: ServiceDecorator`).

`@Injectable` carries a decade of accumulated surface — `providedIn: 'root' | 'platform' | 'any' |
Type`, `useClass`, `useFactory`, `useExisting`, `deps` — almost none of which this codebase uses. In
practice exactly two shapes appear across 36 services:

- `@Injectable({ providedIn: 'root' })` — 34 of them
- `@Injectable()` plus an entry in a route's `providers` array — 2 of them

`@Service` expresses both more directly, and picks the safer default:

```ts
@Service()                          // auto-provided singleton (the common case)
@Service({ autoProvided: false })   // opt out; must appear in a providers[] array
@Service({ factory: () => T })      // auto-provided from a factory
```

The pull for change is a live migration: the CAIRA API binding is rebuilding a data layer that
`241ce4f` deleted, so a large share of the app's services are being written or rewritten right now.
Choosing the decorator once, before P3–P7 add ~20 more services, is cheaper than converting later.

## Decision

Use `@Service` for every injectable class. `@Injectable` is not used in new code.

Mapping applied:

| Before                                       | After                               |
| -------------------------------------------- | ----------------------------------- |
| `@Injectable({ providedIn: 'root' })`        | `@Service()`                        |
| `@Injectable()` (route- or component-scoped) | `@Service({ autoProvided: false })` |

`@Injectable` remains legal Angular and is not deprecated by this ADR — it is simply not the house
style. Third-party code and generated code are unaffected.

## Options Considered

### Option A: Keep `@Injectable` everywhere

| Dimension        | Assessment                                                     |
| ---------------- | -------------------------------------------------------------- |
| Complexity       | Low — no change                                                |
| Cost             | Zero now; ~20 more files written in the old style during P3–P7 |
| Team familiarity | High                                                           |
| Risk             | None                                                           |

**Pros:** Zero work. Every Angular tutorial, Stack Overflow answer and the CLI's own
`ng generate service` still emit it.
**Cons:** Keeps the `providedIn: 'root'` incantation on 34 files where the intent is just "a
singleton". Diverges from where the framework is heading, and the gap widens with every new service.

### Option B: Adopt `@Service` (chosen)

| Dimension        | Assessment                                                 |
| ---------------- | ---------------------------------------------------------- |
| Complexity       | Low — mechanical, and the compiler catches a missed import |
| Cost             | One sweep of 36 files                                      |
| Team familiarity | Low initially; the API is smaller than what it replaces    |
| Risk             | Low, but **not compile-checked** — see Consequences        |

**Pros:** Singleton is the default rather than an option object. `autoProvided: false` states the
intent ("this is deliberately not global") where `@Injectable()` with empty parens states nothing.
Aligns with the framework direction while the codebase is already in flux.
**Cons:** `ng generate service` still scaffolds `@Injectable`, so the CLI fights the convention.
Newer than most documentation, including this repo's own skills files.

### Option C: Adopt `@Service` only in new code

| Dimension  | Assessment                              |
| ---------- | --------------------------------------- |
| Complexity | Low                                     |
| Cost       | Zero now, permanent inconsistency after |
| Risk       | Low                                     |

**Pros:** No sweep.
**Cons:** Two conventions side by side with no rule for which to use, which is worse than either
convention on its own. Rejected — the sweep is a single mechanical commit and removes the ambiguity.

## Trade-off Analysis

The only real cost is novelty: `@Service` is new enough that most documentation, and every
`ng generate service` invocation, will produce `@Injectable`. That is a friction cost on the team,
not a correctness cost.

Against it: the codebase is mid-migration and about 20 more services are coming. Converting 36 files
now is strictly cheaper than converting 56 later, and materially cheaper than living with two
conventions forever.

The decisive point is that the change is verifiable. `@Service` on a class Angular cannot provide is
a **runtime** failure, not a build failure — so "it compiled" proves nothing. The sweep was validated
by booting the SSR server and loading four routes including a route-scoped provider
(`AuthFacade`, `autoProvided: false`), with zero console errors after hydration. That is a
repeatable check, which makes the risk manageable rather than merely small.

## Consequences

**Easier**

- The common case is `@Service()` — no options object, no string literal to typo.
- Route-scoped services announce themselves. `@Service({ autoProvided: false })` cannot be misread
  as an oversight the way a bare `@Injectable()` can.

**Harder**

- `ng generate service` output must be edited by hand.
- Search results, LLM output and most Angular docs will suggest `@Injectable`.

**To revisit**

- If `@Service` changes shape or is withdrawn before Angular 23, this ADR is superseded and the sweep
  reverses just as mechanically.
- **DI errors are runtime, not compile-time.** Any future bulk change to decorators must be
  validated by booting the app, not by a green `build:prod`.

## Action Items

1. [x] Sweep 36 files from `@Injectable` to `@Service`, fixing the `@angular/core` import specifier.
2. [x] Verify: `pnpm lint` clean, `pnpm build:prod` green.
3. [x] Verify at runtime: SSR boot, four routes 200, zero console errors after hydration, including
       the two `autoProvided: false` services resolving from their `providers` arrays.
4. [x] Update `AGENTS.md` §8 and the `angular-conventions` / `core-services` skills, which still
       prescribe `@Injectable`.
5. [ ] Re-check after each Angular minor that `@Service` is still the recommended form.
