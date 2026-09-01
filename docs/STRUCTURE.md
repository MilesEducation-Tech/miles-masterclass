# Project structure

**Status:** Active · Supersedes the eight repo skills deleted in `c31f69d`

`AGENTS.md` says _what the rules are_. This file says _what the shapes are_ — where a file goes, what
a feature folder contains, and the step-by-step recipe for binding an endpoint. Where the two
disagree, `AGENTS.md` wins and this file is wrong; open a PR against it.

## Why this exists

Commit `c31f69d "old skills removed"` deleted `angular-conventions`, `core-services`,
`ui-components`, `routing-and-guards`, `tech-stack`, `masterclass`, `cpe-tracker`, `media-players`
and 14 others. `AGENTS.md` §10 still lists them and `prompts/README.md` still tells authors to read
them; both point at paths that 404. For months, every new feature has been written against whatever
neighbouring file the author happened to open. That is why the codebase carries four different stub
shapes, four feature-folder layouts, and two undocumented homes for mappers.

Those skills are recoverable — `git show c31f69d^:.claude/skills/<name>/SKILL.md` — but **four of
their rules must never be restored**, because they now contradict `AGENTS.md`: _"OnPush always"_,
_"Components call facades"_, the `<Feature>Facade` naming table, and unwrapping `CommonResponse<T>`.
This file is deliberately **one document, not eight**. Eight drifted apart once.

---

## 1. Settled decisions

These were open questions with two defensible answers each. They are now closed. Changing one needs
a new ADR (`docs/adr/README.md`: never rewrite a decision, supersede it).

| #   | Decision               | Ruling                                                                                                                                                                                                                                                                                                                          |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Mapper home**        | **API→domain** mappers live beside the types they map, in `shared/core/models/caira/<domain>.model.ts`. **Domain→display** mappers live in `features/<f>/shared/mappers/`. Two different jobs: one is a wire contract, one is a view concern.                                                                                   |
| 2   | **Service scope**      | Feature state is **route-scoped**: `@Service({ autoProvided: false })` + a `providers: []` entry on the owning route. App-wide `@Service()` only when several unrelated route trees read it _or_ a broadcast must land in one instance — and the reason goes in the class docblock. Per ADR-0002.                               |
| 3   | **Feature folder**     | `features/<f>/<f>.ts` + `<f>.routes.ts` + `shared/{components,pages,services,mappers,utils,constants}/`.                                                                                                                                                                                                                        |
| 4   | **Blocked features**   | **No stub facades.** See §5.                                                                                                                                                                                                                                                                                                    |
| 5   | **Commits**            | Conventional Commits — `type(scope): subject`.                                                                                                                                                                                                                                                                                  |
| 6   | **Auth-gating a read** | Do **not** gate an `httpResource` URL on `Auth.isAuthenticated()`. Let the request fire and let `authInterceptor` refresh-and-replay. Gating bypasses that and makes failures invisible — the reasoning is written out at `course-detail.ts:88-101`. `cpe.ts` and `feature-facade.ts` predate this ruling and are listed in §7. |

---

## 2. Layering — who may import whom

| Layer                                | May import                                             | Never                                                             |
| ------------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------- |
| `shared/core/models/**`              | other models                                           | Angular DI, `@angular/common/http` (see `caira-error.ts` for why) |
| `shared/core/http/**`                | `shared/core/models/**`                                | anything stateful — these are pure                                |
| `shared/core/services/**`            | `shared/core/{models,http,services}`, `environments`   | **anything under `features/`**                                    |
| `shared/components/**`               | `shared/core/**`, `shared/components/**`               | **anything under `features/`**                                    |
| `features/<f>/**/services`           | `shared/core/**`, sibling services in the same feature | another feature                                                   |
| `features/<f>/**/{components,pages}` | its own feature's services, `shared/**`                | `HttpClient`                                                      |

`ApiClient` is the only holder of `HttpClient` (documented exception: `blog-api.ts`, which talks to
WordPress, not CAIRA).

**Route files own DI scope.** `providers: [X]` on a route is the only mechanism for a route-scoped
service. Moving one to app-wide forks its state.

---

## 3. Binding an endpoint — the recipe

This is what `CourseDetail`, `ChapterProgress`, `FeatureFacade` and `Cpe` already do. Follow it in
order; every step has a file it belongs in.

1. **Path** → add `CAIRA.<name>` to `shared/core/http/caira.endpoints.ts` with a
   `/** #N · METHOD · auth · notes */` docblock. A fixed path is a const; a keyed one is
   `(id: CairaUuid) => …`. Trailing slashes are load-bearing — a 301 from `APPEND_SLASH` drops a POST
   body. **Never a string literal at a call site.**
2. **Wire type** → one interface per response in `shared/core/models/caira/<domain>.model.ts`,
   composed from `envelope.model.ts`. There is no `CommonResponse<T>`; CAIRA has six envelopes.
3. **View model + mapper** → in the same file: the shape templates read, and a pure `toX()` that
   converts wire → view. **Mappers are the only place CAIRA field names appear.** Alternate response
   branches get a type guard (`isResetRequired`).
4. **Spec** → `*.model.spec.ts` beside it. Mappers are pure, so they test without booting Angular.
5. **Scope** → decision 2 above. State it in one line of the class docblock.
6. **Reactive root** → a signal the service reads _itself_: a route param, the auth flag, or a parent
   service's signal. Never an `input()` copied in by an `effect()`.
7. **Reads** → `httpResource<TResponse | undefined>(() => <url or undefined>, { defaultValue: undefined })`.
   Return `undefined` to skip the request — the only valid reason to skip is "no id yet".
   Paginated rails use the `courseFeed()` factory instead of a new resource.
8. **Guard the error** → every derivation starts `res.error() ? <neutral> : toX(res.value())`. An
   errored `httpResource` **throws from `value()`**; an unguarded read turns a 403 into a white
   screen. Neutral means `[]`, `0`, `null` — never a throw path.
9. **Surface the failure** → `readonly xError = computed(() => { const e = res.error(); return e ? cairaError(e) : null; })`,
   **and give the template an `@if` branch for it.** Today several services build this and no
   template reads it, which is why a 403 on #4 shows a skeleton forever.
10. **Writes** → `ApiClient.post/put/delete`, typed, `.pipe(takeUntilDestroyed(this.destroyRef))`.
    Check non-error branches _before_ any other key. Classify with `cairaError()`; let
    `kind === 'domain'` fall through as a UI state, not an error.
11. **After a write** → `resource.reload()`, or patch a `linkedSignal` **from the server's answer**.
    Never from a locally-guessed value.
12. **Expose signals only** — `computed()` for derived, `linkedSignal()` for the one field a write
    patches, plain methods for commands. Never `loadX()` + a `data` signal + an `effect()` joining
    them.
13. **Consumers** — pages and feature components `inject()` the service and read it in the template.
    **Leaf/presentational components take typed `input()`s with safe defaults** and emit `output()`s
    back up; they never inject the service. `video-chapter.ts` is the reference.

---

## 4. Feature folder

```
features/<feature>/
├── <feature>.ts            # list page / shell
├── <feature>.routes.ts     # routes + `providers: []` for route-scoped services
└── shared/
    ├── components/<name>/  # .ts .html .css .spec.ts .stories.ts — co-located
    ├── pages/<name>/
    ├── services/<name>/
    ├── mappers/            # domain → display only (decision 1)
    ├── utils/
    └── constants/
```

- A component used by **two** features moves to `shared/components/`. One feature, it stays put.
- **Dialogs always live in `shared/components/dialog/`** — even a single-use one.
- **Domain types live in `shared/core/models/`.** Feature-local only when nothing else uses them, and
  then say so in the file's docblock.

### Naming

| Thing           | Rule                                                                      |
| --------------- | ------------------------------------------------------------------------- |
| Files           | `kebab-case.ts/.html/.css`, co-located                                    |
| Component class | `PascalCase`, **no `Component` suffix** — `Toast`, not `ToastComponent`   |
| Service class   | `PascalCase`, **no `Service` suffix**, and **no `*.service.ts` filename** |
| Selector        | `app-kebab-case`                                                          |
| Guard           | `<name>Guard`, functional, in `shared/core/guards/`                       |
| Never           | anything named `*Facade`                                                  |

---

## 5. Blocked features — no stub facades

When CAIRA has no endpoint yet, the wrong answer is a placeholder object. The repo accumulated 61 of
them in four shapes (`: any = {}`, `: any = null`, `() => null`, `signal<any>(null)`), producing 17
runtime `TypeError`s and 24 buttons that silently do nothing. A dead checkout button is worse than a
missing one.

**The rule, in order of preference:**

1. **Bind the real endpoint** if one exists. Check `caira.endpoints.ts` before assuming it doesn't.
2. **Remove the control.** No endpoint means no button. Delete the markup and record the reason as a
   G-number in `docs/CAIRA_GAPS.md`.
3. **Disable it visibly**, if the control must stay for layout or navigation reasons — with
   `[disabled]` and `aria-disabled`, never a click handler that no-ops.
4. **Only if a code path must remain callable**, fail loudly: log, notify, return a typed empty.
   `certificate-download-dialog.ts`'s `fetchCertificates` is the worked example in-repo.

**Never write `null as any`.** It exists only to satisfy `readonly x = this.facade.x` aliasing, and
it is the single highest-yield defect class in this codebase — 13 occurrences, 5 of them fatal on
first render.

---

## 6. Angular rules that bite

Full list in `AGENTS.md` §8. The ones with live violations:

| Rule                                                            | Violations today     |
| --------------------------------------------------------------- | -------------------- |
| Never `standalone: true`                                        | 5                    |
| Never `ChangeDetectionStrategy.OnPush`                          | 0 — keep it that way |
| Never `ngOnDestroy` — use `DestroyRef` + `takeUntilDestroyed()` | 1                    |
| Never `@HostBinding` / `@HostListener` — use the `host` object  | 2                    |
| `DOCUMENT` from `@angular/core`, not `@angular/common`          | 11                   |
| No `ngClass` / `ngStyle`                                        | 14                   |
| Template-driven `ngModel` not for new work                      | 7                    |
| No `any` — use `unknown`, then narrow                           | 456                  |
| `shared/**` must not import `features/**`                       | 8                    |

Convert as you touch a file. Do not sweep — `AGENTS.md` §8: "No changes outside the task's scope."

---

## 7. Known deviations

An exception nobody wrote down is indistinguishable from a mistake. These are accepted:

| Deviation                                                                                                                       | Why                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FeatureFacade` keeps its name                                                                                                  | Legacy. The pattern inside is current (`@Service()` + `httpResource`); only the name is wrong, and renaming it touches every rail consumer. Do not copy the name. |
| `FeatureFacade` is app-wide despite holding feature state                                                                       | `Utils.applyBookmarkChange` / `refreshPersonalized` broadcast into it; a route-scoped fork would strand the broadcast.                                            |
| `blog-api.ts` injects `HttpClient` directly                                                                                     | Talks to the WordPress REST API, not CAIRA. `ApiClient` prepends `BASE_API_URL`.                                                                                  |
| `blog.model.ts`, `firm-inquiry.model.ts`, `ai-labs.model.ts`, `webinar-registration.model.ts` sit outside `shared/core/models/` | External-system or single-feature contracts.                                                                                                                      |
| Admin dialogs outside `shared/components/dialog/`                                                                               | The admin tree is a separate app surface; its components are never reused by the learner app.                                                                     |
| `cpe.ts` / `feature-facade.ts` gate reads on `isAuthenticated()`                                                                | Predate decision 6. Migrate when next touched.                                                                                                                    |

---

## 8. Baselines

Enforcement ratchets: a count may fall, never rise. The numbers live in `docs/baselines.json` and are
**measured by `scripts/check-structure.mjs`, which is their only source of truth** — do not hand-edit
them from a grep, or the ratchet will fire on a counting difference rather than a real regression.
After fixing a batch:

```bash
node scripts/check-structure.mjs --update   # then commit the diff with the fix
```

The script counts a deliberate superset in two places, so its numbers run higher than a careful
hand-audit: `stubFacades` (78) also catches local `const x: any = {}` variables, and `explicitAny`
(550) counts occurrences rather than lines. A superset is the right choice for a ratchet — it can
only ever be too strict, never too lenient. The hand-audited figure for genuine stub _facades_ is
**61 fields across 55 files**, of which 17 crash, 24 fail silently, 8 are dormant and 4 render empty.

`failingTests` is owned by the test run, not the script; `--update` carries it through untouched.

---

## 9. Before you ship

```bash
pnpm verify   # lint && check:structure && build:prod
```

`build:prod` is the hard gate and must stay green. `pnpm lint` is green across all 887 files today —
keep it there. `pnpm check:structure` enforces §8.

**`pnpm test` is deliberately not in `verify` yet.** The suite has a known-red baseline of 91
failures, so wiring it in as-is would make `verify` permanently fail and train everyone to ignore it.
Run it separately and do not let the count grow:

```bash
pnpm test --watch=false   # 483 passing / 91 failing, all harness debt
```

All 91 are test-harness problems, not product bugs — 76 × NG0950 (a required `input()` read before
it is set), 52 × NG0201 (missing TestBed providers), the rest stale mocks. It joins `verify` behind a
count ratchet once that debt is paid down.

**After any DI or decorator change, boot the app.** ADR-0001: "DI errors are runtime, not
compile-time. Any future bulk change to decorators must be validated by booting the app, not by a
green `build:prod`."

Dev server is **port 4101** (`pnpm start`). The deleted skills said 4100; they were wrong.
