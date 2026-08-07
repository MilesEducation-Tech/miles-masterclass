import { httpResource } from '@angular/common/http';
import { Injector, Signal, computed, signal } from '@angular/core';
import { CairaFailure } from '../../../../shared/core/models/caira/envelope.model';
import { CourseCard } from '../../../../shared/core/models/caira/masterclass.model';
import { cairaError } from '../../../../shared/core/http/caira-error';

/**
 * Server clamp: `max(1, min(100, limit))`. Asking for more is not an error, it
 * just silently caps — so `hasMore` has to know about it or the UI offers a
 * "load more" that can never load more.
 */
const CAIRA_MAX_LIMIT = 100;
const DEFAULT_PAGE_SIZE = 12;

/**
 * The shape every course rail on the masterclass page binds to.
 *
 * Deliberately identical to the placeholder literal the strip left behind in
 * `masterclass.ts`, plus `metadata()` — which the component already called but
 * the placeholder never provided, so those two headings threw at runtime.
 */
export interface CourseFeed<TItem = CourseCard> {
  readonly items: Signal<TItem[]>;
  readonly isLoading: Signal<boolean>;
  readonly hasMore: Signal<boolean>;
  readonly error: Signal<CairaFailure | null>;
  readonly metadata: Signal<Record<string, unknown> | undefined>;
  /** Legacy hook for a webp variant the old API served. No CAIRA counterpart. */
  readonly webp: Signal<null>;
  loadNextPage(): void;
  loadNextTrackPage(trackId?: number): void;
  setFilters(next?: unknown): void;
  setTrackFilters(trackId?: number, next?: unknown): void;
  reload(): void;
}

export interface CourseFeedOptions<TBody, TItem = CourseCard> {
  /** Absolute URL, or `undefined` to skip the request entirely (auth-gated feeds). */
  url: () => string | undefined;
  /** Pull the cards and the full count out of whichever envelope this endpoint uses. */
  select: (body: TBody) => { items: TItem[]; total: number };
  injector: Injector;
  pageSize?: number;
}

/**
 * A paginated course rail backed by `httpResource`.
 *
 * **Pagination grows `limit` rather than accumulating pages client-side.**
 * CAIRA's list endpoints take `limit`/`page` and return the whole slice, so
 * asking for a bigger slice returns everything so far in one response. That
 * removes the page-accumulator `Map`, the merge logic, and — most usefully —
 * the `effect` that would otherwise write fetched pages into a signal, which is
 * exactly the state-propagating effect Angular tells you not to write. The cost
 * is refetching up to 100 rows on "load more", which for a course rail is
 * nothing.
 *
 * `httpResource` registers a `PendingTasks` entry (`_resource-chunk.mjs`), so
 * SSR waits for it. That is what keeps the masterclass listing crawlable
 * without any manual `PendingTasks.add()`.
 */
export function courseFeed<TBody, TItem = CourseCard>(
  opts: CourseFeedOptions<TBody, TItem>,
): CourseFeed<TItem> {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const limit = signal(pageSize);

  const resource = httpResource<TBody | undefined>(
    () => {
      const base = opts.url();
      if (!base) return undefined;
      const sep = base.includes('?') ? '&' : '?';
      // `page` is pinned to 1 on purpose: `limit` is the growing dimension.
      // Never send `offset` alongside — it overrides `page` server-side.
      return `${base}${sep}limit=${limit()}&page=1`;
    },
    { defaultValue: undefined, injector: opts.injector },
  );

  const selected = computed(() => {
    const body = resource.value();
    if (!body) return { items: [] as TItem[], total: 0 };
    try {
      return opts.select(body);
    } catch {
      // A shape we did not expect. An empty rail beats a white screen, and the
      // interceptor has already logged the response.
      return { items: [] as TItem[], total: 0 };
    }
  });

  return {
    items: computed(() => selected().items),
    isLoading: resource.isLoading,
    hasMore: computed(() => {
      const { items, total } = selected();
      return items.length < total && limit() < CAIRA_MAX_LIMIT;
    }),
    error: computed(() => {
      const err = resource.error();
      return err ? cairaError(err) : null;
    }),
    // No CAIRA endpoint returns rail metadata — the headings that used it
    // ("Complimentary Courses for X") have no data source. See the gap register.
    metadata: signal(undefined).asReadonly(),
    webp: signal(null).asReadonly(),

    loadNextPage: () => limit.update((n) => Math.min(CAIRA_MAX_LIMIT, n + pageSize)),

    // Per-track pagination and filtering have no CAIRA counterpart: there is no
    // track endpoint, and the catalog takes no filter params. Kept so the
    // carousel's outputs stay bound rather than removed from the template.
    loadNextTrackPage: () => undefined,
    setFilters: () => undefined,
    setTrackFilters: () => undefined,

    reload: () => void resource.reload(),
  };
}

/** A rail with no backing endpoint. Renders nothing — every section is `@if`-guarded. */
export function emptyCourseFeed<TItem = CourseCard>(): CourseFeed<TItem> {
  const none = signal<TItem[]>([]).asReadonly();
  return {
    items: none,
    isLoading: signal(false).asReadonly(),
    hasMore: signal(false).asReadonly(),
    error: signal<CairaFailure | null>(null).asReadonly(),
    metadata: signal(undefined).asReadonly(),
    webp: signal(null).asReadonly(),
    loadNextPage: () => undefined,
    loadNextTrackPage: () => undefined,
    setFilters: () => undefined,
    setTrackFilters: () => undefined,
    reload: () => undefined,
  };
}
