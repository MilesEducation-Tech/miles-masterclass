---
name: facade-pattern
description: 'Use when adding, changing or reviewing a facade, a page''s state, or where a read or mutation lives in this Angular repo. Triggers: a *-facade.ts file, httpResource / ApiClient / HttpClient in a component, a route''s providers, a page passing state down as inputs, "smart and dumb components", "should this be a facade", and the check-structure facade errors.'
metadata:
  author: miles-masterclass
  version: '1.0.0'
---

# Facade pattern

AGENTS.md §3 sets the boundary: **components display, facades decide.** This skill is how to apply it without
over-building. It applies to every agent and every person working in `src/app`. `scripts/check-structure.mjs`
enforces the parts a script can see (section 5); section 6 is the review for the rest.

A facade here is one service per routed page tree that holds that tree's state (signals, `httpResource`s) and its
actions (methods that call `ApiClient`, open dialogs, navigate). Pages and feature components inject it and read it
directly. It is not a wrapper per component and not a second layer over a core service.

## 1. Does this need a facade?

Answer in order and stop at the first match.

1. **The code is in `shared/`, `core/` or `layout/`.** No facade. A shared component takes inputs and emits outputs;
   a core service is a plain `@Service()`. Neither may import a facade.
2. **A core service already exposes the read** (`AccountApi`, `AuthSession`, `MasterclassHomeFacade`). The page
   injects that service. Do not write a facade that only forwards it.
3. **The page tree already has a facade.** Add the new state or action to it. One page tree, one facade.
4. **Two or more components, sibling routes or a dialog share state, rules or actions.** Create a facade.
5. **One page, one read, no rules.** A component still never does HTTP, so the read goes in a small route-scoped
   facade next to the page. Keep it to the resource and its guarded `computed`s; it grows only when the page does.

Never create a facade per component, per resource, or "for later".

## 2. Shape

Copy `features/offerings/services/course-detail-facade.ts` (route and dialog providers),
`features/offerings/webinar/services/live-session-facade.ts`, or `admin/leads/services/leads-facade.ts` (the
smallest complete admin slice).

- **File:** `features/<f>/services/<name>-facade.ts`, or `admin/<a>/services/`. Flat file, aliased imports.
- **Scope:** `@Service({ autoProvided: false })`, listed in the route's `providers` (a dialog opened outside that
  route lists it in its own `providers`). Sibling route trees get their own instances.
- **Root `@Service()`** only when state must outlive the route: a list whose filters and loaded pages survive a
  visit to a detail page and back (the library facades), or one read shared across features
  (`MasterclassHomeFacade`). Put a `// why:` comment on it. `PaymentFacade` and `FeatureFacade` are the standing
  exceptions.
- **Reads:** `httpResource` fields. The request function returns `undefined` until its inputs are ready, gates on the
  boolean `isAuthenticated()` (never the token), and `parse`s the body at the boundary so a drifted contract lands in
  `error()`. Lists get a `defaultValue`. Expose `hasValue()`-guarded `computed`s plus `isLoading` and `error`.
  `withPreviousValue` keeps the last answer through a refetch. Unwrap `{ success, message, data }` here.
- **Mutations:** methods on `ApiClient`, then `.reload()` or `.set()` the affected resource. Never `httpResource`.
- **Actions:** navigation, dialogs (dynamic `import()`), toasts and business rules are facade methods.
- **Page-only state** (which accordion is open, a debounce buffer) stays in the component.

## 3. Consumers

- **Pages and feature components inject the facade** and read its signals or call its methods. The page does not
  pass facade state down as inputs or re-emit children's outputs to call the facade.
- **List items are the exception:** a card in a `@for` takes its own row as an input (`webinar = input.required()`),
  and may inject the facade for actions on that row. The row is the only facade state it takes as an input.
- **A component never reads the same state from both** an input and the facade.
- **Shared components never inject a facade.** If a shared card needs data, the page passes it in.
- **No component bypasses its page's facade** to inject a service the facade already wraps.
- **No feature imports another feature's facade.** ESLint `boundaries` enforces it; a cross-feature dialog goes
  through a core token (`MASTERCLASS_COURSE_INFO_DIALOG`).

## 4. Anti-patterns found in this repo

Each is in `prompts/facade-audit.md` with file and line.

| Smell                                        | Example                                                                                                  | Fix                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| The page decides, the facade only fetches    | `masterclass-chapter.ts`: access gate, next chapter, CPE dialog, 95 % threshold                          | Move the rules into `ChapterFacade`                |
| Page state written into a root core service  | `profile.ts` sets `OnboardingApi.form`                                                                   | A route-scoped `ProfileFacade` that owns `form`    |
| Pages bypass the facade                      | webinar list and detail inject `WebinarRegistration`; `onJoin` written twice                             | `join(id)` and `registeringIds` on `WebinarFacade` |
| Two instances of one facade on one screen    | `MasterclassFacade` provided at the offerings root and injected by `VideoChapter` beside `ChapterFacade` | Provide it where it is used; one facade per tree   |
| Pass-through facade with a hand-rolled cache | `SectionFiltersFacade` (one `ApiClient` call, one consumer)                                              | Fold into the consumer; let `httpResource` cache   |
| Facade in core read by shared components     | `FeatureFacade` in the shared cards                                                                      | Pass the data in as an input                       |
| RxJS read that hides loading and failure     | `UaeCairaFacade`: `toSignal(forkJoin(…))` with `catchError(() => [])`                                    | `httpResource`, render `isLoading()` and `error()` |
| Dead members                                 | `WebinarFacade.isEmpty`, `CourseDetailFacade.isLoading`                                                  | Delete them                                        |

## 5. What the harness enforces

`scripts/check-structure.mjs` runs in the pre-commit hook and in CI (`pnpm lint`). Each rule is a ratchet against
`structure-baseline.json`: today's violations are listed there with a reason, anything new fails, and a fixed entry
must be pruned.

| Rule                            | Baseline key                     | Fails when                                                                                                                                |
| ------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Facade location                 | `misplacedFacades`               | a `*-facade.ts` sits outside `features/**/services/` or `admin/<area>/services/` (so not in `core/`, `shared/`, `layout/`, `admin/core/`) |
| Facade imports from shared code | `facadeImports`                  | a file in `shared/`, `core/` or `layout/` imports a `*-facade` module, including `import type` and `import()`                             |
| HTTP in a component             | `componentHttp` (count per file) | a `@Component` file calls `httpResource(`, `inject(HttpClient)` or `inject(ApiClient)`                                                    |
| Root facade without a reason    | `rootFacades`                    | a `*-facade.ts` uses `@Service()` and has no `// why:` comment                                                                            |

- **Fixed one?** Run `node scripts/check-structure.mjs --prune`, which only removes or lowers entries, and commit the
  smaller baseline.
- **A genuine exception?** Add a baseline entry with a reason. `CODEOWNERS` reviews that file. Never edit the script
  to let a case through.

## 6. Review checklist (what the script cannot see)

1. Is there exactly one facade for this page tree, and was a new one needed (section 1)?
2. Does any page or component hold a business `if`, a navigation or a dialog that belongs in the facade?
3. Does the page pass facade state to its children as inputs, or re-emit their outputs into the facade?
4. Does any component take an input and also read the same state from the facade?
5. Does a component inject a service the facade already wraps?
6. Is the facade's scope right: route `providers` by default, root only with a `// why:`?
7. Does every read render `isLoading()` and `error()`, and guard `value()` with `hasValue()`?
8. Does every public member have a consumer?
