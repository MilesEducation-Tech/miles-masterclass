---
name: angular-conventions
description: How components, services, signals, effects, facades and templates are written in Miles Masterclass v3 — Angular 22 standalone + signals + SSR conventions. Read before writing or editing any .ts or .html file in src/app.
---

# Angular conventions

The house style. Match the file you're editing; when the file is new, follow this.

## Components

```ts
@Component({
  selector: 'app-reel-card',
  imports: [NgIcon, ProgressBar], // standalone imports, no NgModule
  templateUrl: './reel-card.html',
  styleUrl: './reel-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReelCard {
  // inputs / outputs — signal-based
  readonly reel = input.required<MicroLearningReel>();
  readonly compact = input(false);
  readonly selected = output<string>();

  // template-only members are `protected readonly`
  protected readonly facade = inject(MicroLearningCourseFacade);

  protected readonly progress = computed(() => this.reel().watchedPercent ?? 0);
}
```

- **Standalone always.** No NgModules in new code.
- **`OnPush` always.** The app is zoneless by omission — signals are what triggers rendering.
- **`input()` / `output()`**, not `@Input()` / `@Output()`, in new code.
- **DI**: both `inject()` and constructor injection pass lint (`@angular-eslint/prefer-inject` is off). Match the surrounding file; prefer `inject()` for new files.
- Members read only by the template are **`protected readonly`**, not public — Angular v22 style guide.

## Templates

- `@if` / `@for` / `@switch` / `@defer`. Never `*ngIf` / `*ngFor`.
- `@for` requires `track` — track a stable id, never `$index` on a reorderable list.
- `@empty` on `@for` instead of a sibling `@if (list.length === 0)`.
- Call signals: `{{ progress() }}`. A signal without `()` renders the function.
- No business logic in templates. A ternary chain three deep belongs in a `computed`.
- Tailwind classes in the template; `tailwind-merge` + `clsx` when composing conditionally.

## State — signals

```ts
// writable state
readonly detailsList = signal<MicroLearningReel[]>([]);
readonly selectedReelId = signal<string | null>(null);

// derived — never a method, never duplicated state
readonly activeReel = computed(() =>
  this.detailsList().find(r => r.id === this.selectedReelId()) ?? null
);

// two-way derived from an input
readonly draftTitle = linkedSignal(() => this.course().title);
```

- Derive with `computed`. If two signals can disagree, one of them shouldn't exist.
- Never mutate a signal's value in place — `update(list => [...list, item])`.

## Effects

```ts
effect(() => {
  const id = this.selectedReelId(); // tracked
  if (id) untracked(() => this.trackActivity(id)); // side effect, untracked
});
```

- `effect()` over `ngOnInit` for reactive setup.
- Read tracked signals at the top; wrap side effects in `untracked()` so they don't create a dependency.
- Effects **do not track `let` variables**. To react to an observable, lift it first:
  ```ts
  private readonly url = toSignal(this.router.events.pipe(map(() => this.router.url)));
  ```
- Route-input effects can fire twice per navigation. Guard on the state you're about to set, or you get a duplicate fetch:
  ```ts
  if (this.selectedReelId() === id) return;
  ```

## Cleanup

`DestroyRef`, never `OnDestroy`.

```ts
constructor() {
  inject(DestroyRef).onDestroy(() => this.facade.clear());
}

// subscriptions
this.api.get<Reels>(url)
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(...);
```

Two files (`video-js.ts`, `audio-js.ts`) still implement both patterns — when you touch them, keep `DestroyRef` and delete the `OnDestroy` half.

## Request cancellation

Only `resource()`, `takeUntilDestroyed()` and `toSignal()` cancel an in-flight request on navigation. A plain `.subscribe()` leaks — the response lands after the component is gone. `withFetch()` + `AbortController` is what makes cancellation actually reach the network.

## HTTP

- Components call **facades**. Facades call **`ApiClient`**. Nobody calls `HttpClient` directly.
- Suppress the automatic error toast with the `SKIP_ERROR_NOTIFICATION` `HttpContext` flag.
- Unwrap `CommonResponse<T>` in the facade; components receive domain types.

## Facades

```ts
@Service({ autoProvided: false }) // route-scoped — NOT an app-wide singleton
export class SomeFacade {
  private readonly api = inject(ApiClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<Item[]>([]);
  readonly loading = signal(false);
  readonly hasItems = computed(() => this.items().length > 0);

  load(id: string): void {
    /* http → signals */
  }
  clear(): void {
    /* reset signals */
  }
}
```

Provide them in the **route config**, so two feature trees get independent instances:

```ts
{ path: 'micro-learning', providers: [MicroLearningCourseFacade], loadChildren: ... }
```

Plain `@Service()` (auto-provided) is reserved for genuinely app-wide services (`FeatureFacade`, `Auth`, `Utils`, `ApiClient`). Using it on a feature facade forks state in ways that are very hard to debug — see `FeatureFacade`'s comment in `features.ts` for what breaks.

## Services and state

- **`@Service`, not `@Injectable`** — Angular 22 ships it and it is the house style. `@Service()` for an app-wide singleton, `@Service({ autoProvided: false })` for anything provided in a route or component. See [ADR-0001](../../../docs/adr/0001-service-decorator.md).
  > DI failures are **runtime**, not compile-time. A green `build:prod` does not prove a decorator change works — boot the app.
- **No external state store.** NgRx SignalStore was evaluated and rejected; see [ADR-0002](../../../docs/adr/0002-no-external-store.md) for the reasoning and for the three conditions that would reverse it. Don't re-litigate it in a PR — amend the ADR.
- Reactive reads use **`httpResource`** (runs through the interceptors, cancels in-flight requests when params change). Writes use `ApiClient` + `takeUntilDestroyed`. A bare `.subscribe()` with neither leaks — the deleted `MasterclassFacade.loadCourse` did exactly that.
- A one-shot load that writes back into the signal it would key on must stay imperative. `Auth.fetchMyProfile` is the worked example: `setAuthenticated` bumps `authStateChanged`, so a resource keyed on auth state would re-fire on its own result.

## SSR safety

- No `window`, `document`, `localStorage`, `navigator` without `isPlatformBrowser(inject(PLATFORM_ID))`.
- Cookies go through `Storage` — on the server it parses them off the request.
- Import `DOCUMENT` from **`@angular/core`**, not `@angular/common` (deprecated re-export in v22).
- Hold SSR open for async work that must finish before serialization with `PendingTasks.add()` — and release it exactly once, including on the error path. See the `seo` skill.
- `withHttpTransferCacheOptions({ includeRequestsWithAuthHeaders: true })` in `app.config.ts` is non-default and load-bearing: authenticated course fetches from SSR are reused by the browser instead of re-issued. Don't remove it.

## Naming

| Thing              | Convention                                                                |
| ------------------ | ------------------------------------------------------------------------- |
| Files              | `kebab-case.ts` / `.html` / `.css`, co-located                            |
| Component class    | `PascalCase`, no `Component` suffix (`ReelCard`, not `ReelCardComponent`) |
| Selector           | `app-kebab-case`; attribute directives `camelCase`                        |
| Types / interfaces | `PascalCase`, in `shared/core/models/`                                    |
| Facade             | `<Feature>Facade` in `shared/services/<feature>-facade/`                  |
| Guard              | `<name>Guard` (functional), in `shared/core/guards/`                      |

## Testing

Vitest 4 + jsdom. Co-locate `*.spec.ts`. Test facade logic and pure utils; don't write shallow render tests that assert a class name. New logic with a branch, a loop or a money path leaves one runnable check behind.

## Anti-patterns

- A component injecting `HttpClient`.
- `providedIn: 'root'` on a feature facade.
- `OnDestroy` in new code.
- Duplicated state that a `computed` would derive.
- `any`, or `as any` to silence a model that should just be typed.
- A refactor bundled into a feature change.
