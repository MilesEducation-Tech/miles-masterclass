import { httpResource } from '@angular/common/http';
import {
  computed,
  DestroyRef,
  inject,
  Injector,
  linkedSignal,
  PLATFORM_ID,
  runInInjectionContext,
  Service,
  signal,
  Signal,
} from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FeatureApiKey,
  FEATURE_ROUTES,
  FeatureApiResponse,
  PaginationData,
} from '@core/models/feature.model';
import { TRACK_ROUTES, TracksResponse, ContentResponse } from '@core/models/track.model';
import {
  appendFilterParams,
  CourseFilterSelection,
  EMPTY_COURSE_FILTERS,
  selectionsEqual,
} from '@core/models/library-filters.model';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { normalizeBookmarkField } from '@core/models/course.model';
import { switchMap, map, tap, catchError, startWith, groupBy, mergeMap } from 'rxjs/operators';
import { of, forkJoin, combineLatest, defer, Subject, EMPTY, Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

export interface FeatureResourceOptions {
  requiresAuth?: boolean;
}

export interface ResourceRequest {
  key: FeatureApiKey;
  type: string;
  page: number;
}

/** What one settled non-track list response contributes to the resource's state. */
interface ListSnapshot {
  page: number;
  data: any[];
  pagination: PaginationData | undefined;
  meta: Record<string, unknown> | undefined;
}

/**
 * Unwrap a list response into rows, pagination and leftover metadata.
 *
 * Hoisted out of the old `items$` `switchMap` so the `httpResource` path and the
 * track path cannot drift apart. Two shapes are in play and both are real: most
 * list endpoints return `{ data: Content[], pagination_data }`, while a few return
 * a bare array, and single-item endpoints (`lastViewed` → `v2/user/last_viewed/`)
 * return one `Content` object — wrapped here so consumers keep reading `items()[0]`.
 */
function unwrapListResponse(response: FeatureApiResponse<any[]> | any[] | null | undefined): {
  data: any[];
  pagination: PaginationData | undefined;
  meta: Record<string, unknown> | undefined;
} {
  const {
    data: rawData,
    pagination_data,
    ...rest
  } = Array.isArray(response)
    ? { data: response, pagination_data: undefined }
    : (response ?? { data: [], pagination_data: undefined });

  // Normalize each item's bookmark field so consumers only ever read
  // `added_bookmark`. Some list endpoints ship `is_bookmarked` instead; the
  // helper also walks `{content: []}` track-shaped items so nested courses get
  // the same treatment.
  const data = Array.isArray(rawData)
    ? rawData.map((item) => normalizeBookmarkField(item))
    : rawData
      ? [normalizeBookmarkField(rawData)]
      : [];

  return {
    data,
    pagination: pagination_data,
    meta: Object.keys(rest).length > 0 ? (rest as Record<string, unknown>) : undefined,
  };
}

export class FeatureResource {
  readonly page = signal(1);

  /**
   * `true` for `key === 'track'`, which is the ONE key that does not go through
   * `listResource`.
   *
   * The track branch fans out — one `tracks/` GET, then a `forkJoin` of one
   * content GET per track, with per-track pagination and per-track filter streams
   * keyed by `groupBy`/`mergeMap`. One `httpResource` is one request and N is only
   * known at runtime, so that branch keeps its RxJS pipeline. Everything else is a
   * single request and is a resource.
   */
  private readonly isTrack: boolean;

  /**
   * Filters applied to non-track listings. Setting via `setFilters()` resets
   * `page` to 1 and triggers `request$` to refetch with the serialized ids
   * folded into the query (e.g. `instructor_ids=1,2,3`).
   */
  readonly filters = signal<CourseFilterSelection>(EMPTY_COURSE_FILTERS);

  /**
   * Per-track filters for `key === 'track'`. Each entry is independent so a
   * filter applied on one track doesn't blow away another track's content.
   */
  readonly trackFilters = signal<ReadonlyMap<number, CourseFilterSelection>>(new Map());

  private trackStates = new Map<number, { nextPage: number | null }>();

  // Observable stream of pagination requests
  private readonly request$: import('rxjs').Observable<{
    key: FeatureApiKey;
    type: string;
    page: number;
    isAuthenticated: boolean;
    refresh: number;
    filters: CourseFilterSelection;
  }>;

  // Data stream with accumulation logic
  private readonly items$: import('rxjs').Observable<any[]>;
  private readonly refreshTrigger = signal(0);
  private readonly loadTrackSubject = new Subject<number>();
  /** Per-track filter-change refetch trigger. */
  private readonly trackFilterSubject = new Subject<number>();

  /**
   * The non-track list read.
   *
   * Returning `undefined` from the request function puts the resource in the idle
   * state and sends no request at all. That covers four cases, all of which the
   * old pipeline handled with an early `of({data: [], ...})`:
   *   - the track key, which owns its own pipeline;
   *   - the server, where this class has always fetched nothing (see the ctor);
   *   - a key with no route entry;
   *   - a `requiresAuth` resource with nobody signed in.
   *
   * `refreshTrigger` is deliberately NOT read here. A resource refetches when its
   * request OBJECT changes, so a counter that does not appear in the request would
   * be tracked and then ignored; `refresh()` calls `reload()` instead.
   */
  private readonly listResource;

  /**
   * One settled response, captured as a single value.
   *
   * `page` is captured HERE rather than read separately by each consumer, and that
   * is load-bearing: it keeps the page number and the rows that belong to it in one
   * atomic snapshot, so the accumulator can never file page 1's rows under page 2.
   * Measured rather than assumed — the instant `page` changes, the resource reports
   * `status: 'loading'` and `hasValue(): false`, because its status and value are
   * themselves pull-based `computed`s over the same request signal and the graph is
   * glitch-free. There is no window in which both are readable and disagree.
   */
  private readonly listSnapshot;

  /**
   * Accumulated rows.
   *
   * A `linkedSignal`, not a `computed`, because it has two external write paths
   * that must keep working: `FeatureFacade.applyBookmarkChange()` calls
   * `items.update()` to flip a bookmark flag across every loaded listing without a
   * round-trip, and the track pipeline sets it directly.
   *
   * Accumulation runs through the computation's own `previous` value: page 1
   * replaces, later pages append. That is deliberately NOT a side-effecting page
   * Map — an earlier draft filed rows into a `Map` from inside this computation and
   * it was wrong, because a computation is LAZY: if nothing read `items()` between
   * page 1 settling and page 2 arriving, page 1 never made it into the Map and was
   * lost. Accumulating through `previous` has no such hole, and it makes local
   * edits survive for free, since `patchItems`/`prependItem` writes ARE `previous`.
   *
   * One consequence worth knowing: a non-first page must not be re-requested for
   * the same page number, or its rows would append twice. Nothing does — every
   * refetch path (`refresh()`, `setFilters()`) resets to page 1 first.
   */
  readonly items = linkedSignal<ListSnapshot | 'unauthorized' | null, any[]>({
    source: () => this.listSnapshot(),
    computation: (snapshot, previous) => {
      // Signed out on a resource that requires auth: drop everything, exactly as
      // the old `requiresAuth && !isAuthenticated` branch did.
      if (snapshot === 'unauthorized') return [];

      // Idle or loading — hold what we already have. The old pipeline's
      // `startWith([])` supplied the same first render.
      if (snapshot === null) return previous?.value ?? [];

      // Page 1 replaces, later pages append. Accumulating through `previous`
      // rather than a Map is what makes `patchItems`/`prependItem` survive the
      // next page load for free: their writes ARE `previous.value`.
      return snapshot.page === 1 ? snapshot.data : [...(previous?.value ?? []), ...snapshot.data];
    },
  });

  /**
   * Pagination for the current listing. Writable because `adjustBookmarkCount()`
   * nudges `total_count` when a bookmark row is added or removed locally, so an
   * "X bookmarks" label stays honest without a refetch. A later real response
   * replaces it, which is what happened before this phase too.
   */
  readonly paginationData = linkedSignal<
    ListSnapshot | 'unauthorized' | null,
    PaginationData | undefined
  >({
    source: () => this.listSnapshot(),
    computation: (snapshot, previous) => {
      if (snapshot === 'unauthorized') return undefined;
      // Keep the previous pagination while a request is in flight, so a "load
      // more" control does not flicker to disabled mid-load.
      if (snapshot === null) return previous?.value;
      return snapshot.pagination;
    },
  });

  /** Leftover top-level response fields (e.g. section titles). Same lifetime as pagination. */
  readonly metadata = linkedSignal<
    ListSnapshot | 'unauthorized' | null,
    Record<string, unknown> | undefined
  >({
    source: () => this.listSnapshot(),
    computation: (snapshot, previous) => {
      if (snapshot === 'unauthorized') return undefined;
      if (snapshot === null) return previous?.value;
      return snapshot.meta ?? previous?.value;
    },
  });

  /**
   * Writable because the track pipeline still drives it by hand; for every other
   * key it tracks the resource, which covers both `loading` and `reloading`.
   */
  readonly isLoading = linkedSignal<boolean, boolean>({
    source: () => (this.isTrack ? false : this.listResource.isLoading()),
    computation: (loading) => loading,
  });

  constructor(
    private key: FeatureApiKey,
    private type: string,
    private api: ApiClient,
    private injector: Injector,
    private destroyRef: DestroyRef,
    private isBrowser: boolean,
    private isAuthenticated: Signal<boolean>,
    private options: FeatureResourceOptions = {},
  ) {
    this.isTrack = key === 'track';

    // `httpResource` has to be created in an injection context and this class is
    // instantiated with `new`, not injected — hence the explicit `Injector`.
    this.listResource = runInInjectionContext(this.injector, () =>
      httpResource<FeatureApiResponse<any[]>>(() => {
        if (!this.isBrowser || this.isTrack) return undefined;

        const route = FEATURE_ROUTES[this.key as keyof typeof FEATURE_ROUTES];
        if (!route) return undefined;
        if (this.options?.requiresAuth && !this.isAuthenticated()) return undefined;

        // Route defaults + dynamic params + applied filters. `lastViewed` is a
        // single global endpoint and takes no query params.
        const params: Record<string, any> = { ...(route.params || {}) };
        if (this.key !== 'lastViewed') {
          params['page'] = this.page();
          if (this.type && this.key !== 'premiere') {
            params['course_type'] = this.type;
          }
        }
        appendFilterParams(params, this.filters());

        return { url: apiUrl(route.path), params };
      }),
    );

    this.listSnapshot = computed<ListSnapshot | 'unauthorized' | null>(() => {
      if (this.isTrack || !this.isBrowser) return null;
      if (this.options?.requiresAuth && !this.isAuthenticated()) return 'unauthorized';

      // `lastViewed` takes no page param, so it is always page 1 however far another
      // listing has paged.
      const page = this.key === 'lastViewed' ? 1 : this.page();

      // A failure counts as SETTLED WITH NO ROWS, which is what the old
      // `catchError(() => of({ data: [], pagination: undefined, ... }))` produced.
      // Treating it as "not settled" instead would leave the previous pagination in
      // place, and a stale `next_page` means an infinite-scroll container keeps
      // asking for a page that just failed.
      if (this.listResource.error()) {
        return { page, data: [], pagination: undefined, meta: undefined };
      }
      if (!this.listResource.hasValue()) return null;

      const { data, pagination, meta } = unwrapListResponse(this.listResource.value());
      return { page, data, pagination, meta };
    });

    // The track pipeline below is the only remaining RxJS path, and it is skipped
    // on the server to avoid SSR task-tracking errors. `EMPTY` is
    // `Observable<never>`, so it is safely assignable to any `Observable<T>`.
    // Non-track keys never build it at all — their resource is the whole story.
    if (!this.isBrowser || !this.isTrack) {
      this.request$ = EMPTY;
      this.items$ = EMPTY;
      return;
    }

    // Unchanged from before this phase, other than `isAuthenticated` now being a
    // real signal instead of a hardcoded `false`. Note `filters` is in the stream
    // even though a track listing's own filters are per-track and travel through
    // `trackFilterSubject`: the top-level signal still re-requests page 1, which is
    // the behaviour that was here, so it stays.
    this.request$ = combineLatest([
      toObservable(this.page, { injector: this.injector }),
      toObservable(this.refreshTrigger, { injector: this.injector }),
      toObservable(this.filters, { injector: this.injector }),
    ]).pipe(
      map(([page, refresh, filters]) => ({
        key: this.key,
        type: this.type,
        page,
        isAuthenticated: this.isAuthenticated(),
        refresh,
        filters,
      })),
    );

    this.items$ = this.request$.pipe(
      switchMap(({ type, page, isAuthenticated }) => {
        this.isLoading.set(true);

        if (this.options?.requiresAuth && !isAuthenticated) {
          this.isLoading.set(false);
          this.paginationData.set(undefined);
          return of({ data: [], pagination: undefined, meta: undefined, page, isAuthenticated });
        }

        return this.loadTracks(page, type, isAuthenticated);
      }),
      tap(({ pagination, meta }) => {
        this.paginationData.set(pagination);
        if (meta) {
          this.metadata.set(meta as Record<string, unknown>);
        }
        this.isLoading.set(false);
      }),
      // Same accumulation rule as the resource path: page 1 replaces, later pages
      // append onto whatever `items` currently holds — which includes any local
      // `patchItems`/`prependItem` edit, so those survive a page load.
      map(({ data, page, isAuthenticated }) => {
        if (this.options?.requiresAuth && !isAuthenticated) return [];
        return page === 1 ? data : [...this.items(), ...data];
      }),
      startWith([]),
    );

    // ponytail: an effect here reset the page to 1 on auth-state change so a
    // new user/guest got fresh data. No auth state to watch any more.

    this.items$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.items.set(data);
    });

    // Handle track pagination with debounce/switchMap to prevent duplicate calls
    this.loadTrackSubject
      .pipe(
        groupBy((trackId) => trackId),
        mergeMap((group) =>
          group.pipe(
            switchMap((trackId) => {
              const state = this.trackStates.get(trackId);
              if (!state || !state.nextPage) return EMPTY;

              return this.getTrackContent(trackId, this.type, state.nextPage).pipe(
                map((response) => ({ trackId, response })),
                catchError(() => EMPTY),
              );
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ trackId, response }) => {
        this.updateTrackState(trackId, response);

        const incoming = (response.data || []).map((c) => normalizeBookmarkField(c));
        this.items.update((currentItems) => {
          return currentItems.map((item: any) => {
            if (item.ids && item.ids[0] === trackId) {
              return {
                ...item,
                content: [...item.content, ...incoming],
              };
            }
            return item;
          });
        });
      });

    // Per-track filter changes — refetch page 1 of the affected track only and
    // replace its `content` array (rather than appending, which is what
    // pagination does).
    this.trackFilterSubject
      .pipe(
        groupBy((trackId) => trackId),
        mergeMap((group) =>
          group.pipe(
            switchMap((trackId) =>
              this.getTrackContent(trackId, this.type, 1).pipe(
                map((response) => ({ trackId, response })),
                catchError(() => EMPTY),
              ),
            ),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ trackId, response }) => {
        this.updateTrackState(trackId, response);

        const incoming = (response.data || []).map((c) => normalizeBookmarkField(c));
        this.items.update((currentItems) =>
          currentItems.map((item: any) =>
            item.ids && item.ids[0] === trackId ? { ...item, content: incoming } : item,
          ),
        );
      });
  }

  /**
   * Re-fetch page 1.
   *
   * The two branches force a refetch differently and both are needed. The track
   * pipeline is a `combineLatest`, so bumping a counter re-emits it. A resource
   * refetches only when its request OBJECT changes, so a counter would be tracked
   * and then ignored — it calls `reload()` instead. `reload()` is only needed when
   * the page did not actually change, because a real page change already produces
   * a different request; calling both would fire two requests for one refresh.
   */
  refresh() {
    const wasFirstPage = this.page() === 1;
    this.page.set(1);

    if (this.isTrack) {
      this.refreshTrigger.update((v) => v + 1);
      return;
    }
    if (wasFirstPage) this.listResource.reload();
  }

  loadNextPage() {
    const next = this.paginationData()?.next_page;
    if (next == null) return;
    const nextPage = typeof next === 'number' ? next : this.extractPage(next);
    if (nextPage != null) {
      this.page.set(nextPage);
    }
  }

  /**
   * Apply a reference-preserving transform (map/filter) to the accumulated rows.
   * The transform MUST return the same array reference when it changes nothing.
   * Returns whether anything changed.
   *
   * There is no separate page accumulator to keep in step any more: `items`
   * accumulates through its own previous value, so a write here IS what the next
   * page appends onto, and the edit survives without extra bookkeeping.
   */
  patchItems(transform: (rows: any[]) => any[]): boolean {
    const current = this.items();
    const next = transform(current);
    if (next === current) return false;
    this.items.set(next);
    return true;
  }

  /** Prepend a row (and re-publish `items`). */
  prependItem(item: any): void {
    this.items.update((rows) => [item, ...rows]);
  }

  loadNextTrackPage(trackId: number) {
    this.loadTrackSubject.next(trackId);
  }

  /**
   * Apply filters to a non-track listing resource. Resets pagination to page 1
   * so the filtered response replaces the accumulator cleanly.
   */
  setFilters(next: CourseFilterSelection) {
    this.page.set(1);
    this.filters.set(next);
  }

  /**
   * Apply filters scoped to a single track within the `track` resource. Other
   * tracks remain unaffected. Triggers a refetch of *only* that track's content.
   * No-ops when the new selection is set-equal to the current one for `trackId`.
   */
  setTrackFilters(trackId: number, next: CourseFilterSelection) {
    const current = this.trackFilters();
    const existing = current.get(trackId);
    if (selectionsEqual(existing, next)) return;
    const updated = new Map(current);
    updated.set(trackId, next);
    this.trackFilters.set(updated);
    this.trackFilterSubject.next(trackId);
  }

  private loadTracks(page: number, type: string, isAuthenticated: boolean) {
    return this.api
      .get<TracksResponse>(TRACK_ROUTES.tracks.path, {
        params: { page: page.toString() },
      })
      .pipe(
        switchMap((trackResponse) => {
          const tracks = trackResponse.results || [];
          if (!tracks.length) {
            return of({
              data: [],
              pagination: this.mapTrackPagination(trackResponse, page),
              meta: undefined,
              page,
              isAuthenticated,
            });
          }

          const contentRequests = tracks.map((track) =>
            this.getTrackContent(track.id, type, 1).pipe(
              tap((response) => this.updateTrackState(track.id, response)), // Init state
              map((response) => ({
                title: track.name,
                category: track.name,
                description: track.description,
                icon: '',
                params: `track_${track.id}`,
                cardName: 'TrackV1' as const,
                content: (response.data || []).map((c) => normalizeBookmarkField(c)),
                ids: [track.id],
              })),
            ),
          );

          return forkJoin(contentRequests).pipe(
            map((tracksWithContent) => ({
              data: tracksWithContent,
              pagination: this.mapTrackPagination(trackResponse, page),
              meta: undefined,
              page,
              isAuthenticated,
            })),
          );
        }),
        catchError(() =>
          of({ data: [], pagination: undefined, meta: undefined, page, isAuthenticated }),
        ),
      );
  }

  /**
   * Fetches one track's content. Wrapped in `defer` so the `trackFilters`
   * signal is read at *subscription* time — this matters when `loadTracks`
   * builds a `forkJoin` of per-track requests and a `setTrackFilters` call
   * lands between construction and subscription. Reading at subscription
   * guarantees the HTTP call always reflects the latest filter state.
   */
  private getTrackContent(trackId: number, courseType: string, page: number) {
    const path = TRACK_ROUTES.trackContent.path.replace(':id', trackId.toString());
    return defer(() => {
      const params: Record<string, string | number> = {
        course_type: courseType,
        page: page.toString(),
      };
      appendFilterParams(params, this.trackFilters().get(trackId));
      return this.api.get<ContentResponse>(path, { params });
    });
  }

  private updateTrackState(trackId: number, response: ContentResponse) {
    const nextVal = response.pagination_data?.next_page || response.next;

    let next: number | null = null;
    if (typeof nextVal === 'string') {
      next = this.extractPage(nextVal);
    } else if (typeof nextVal === 'number') {
      next = nextVal;
    }

    this.trackStates.set(trackId, { nextPage: next });
  }

  private extractPage(url: string): number | null {
    try {
      const u = new URL(url);
      const p = u.searchParams.get('page');
      return p ? parseInt(p, 10) : null;
    } catch {
      return null;
    }
  }

  private mapTrackPagination(response: TracksResponse, currentPage: number): PaginationData {
    // Determine next page from 'next' URL
    const next_page = response.next ? this.extractPage(response.next) : null;

    return {
      current_page: currentPage,
      next_page: next_page,
      prev_page: null,
      total_pages: Math.ceil(response.count / 10),
      total_count: response.count,
    };
  }
}

/** Read the effective bookmark state from either field shape. */
function isItemBookmarked(item: any): boolean {
  return (item?.added_bookmark ?? item?.is_bookmarked) === true;
}

/**
 * Shallow-clone `item` with both bookmark fields set to `value`. `added_bookmark`
 * is the canonical field every card reads; `is_bookmarked` is only written when
 * the source object already carried it, so we don't sprinkle the alternate field
 * onto shapes that never had it.
 */
function withBookmarkFlag<T extends Record<string, any>>(item: T, value: boolean): T {
  const next: any = { ...item, added_bookmark: value };
  if ('is_bookmarked' in item) next.is_bookmarked = value;
  return next;
}

/**
 * Collapse the per-page `course_type` strings into one bookmark family so a
 * toggle keyed `micro_learning` lines up with the `nano_learning` bookmark
 * listing, and `video` lines up with `masterclass`.
 */
function bookmarkTypeFamily(type: string): string {
  switch (type) {
    case 'video':
    case 'masterclass':
      return 'masterclass';
    case 'micro_learning':
    case 'nano_learning':
      return 'micro';
    default:
      return type;
  }
}

/**
 * The `about` endpoint's nano-learning serializer ships `fields_of_study` as
 * bare ids (`[45]`) instead of the `{ id, name, cpe_credits }` objects every
 * other course type returns. Drop the degenerate list so callers spreading the
 * about payload over a card keep the card's real one, and `totalCpeCredits`
 * falls back to `class_credits` instead of summing `undefined` to 0.
 * ponytail: remove once the backend serializer is fixed.
 */
function dropIdOnlyFieldsOfStudy<T>(data: T): T {
  const fields = (data as { fields_of_study?: unknown })?.fields_of_study;
  if (!Array.isArray(fields) || fields.every((f) => typeof f === 'object' && f !== null)) {
    return data;
  }
  const rest = { ...(data as Record<string, unknown>) };
  delete rest['fields_of_study'];
  return rest as T;
}

@Service()
export class FeatureFacade {
  private resources = new Map<string, FeatureResource>();
  private readonly api = inject(ApiClient);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * The BOOLEAN, never the token string. Every resource in the app gates on this
   * for the same reason: a request function tracks every signal it reads, so
   * gating on the token would re-fire every listing in the application on each
   * rotation. See `auth-session.ts`.
   */
  private readonly auth = inject(AuthSession);

  // Keys whose result depends on the user's profile (sector, job_role, watch history).
  // Used by `refreshPersonalized` when profile data changes mid-session.
  private static readonly PERSONALIZED_KEYS = new Set<FeatureApiKey>([
    'recommended',
    'becauseYouWatched',
    'inprogress',
  ]);

  getResource(
    key: FeatureApiKey,
    type: string,
    options: FeatureResourceOptions = {},
  ): FeatureResource {
    // Cache key is intentionally `${key}-${type}` only. Filter state lives on
    // the resource instance, so two pages that share the same key+type (e.g.
    // home and masterclass both holding `track-masterclass`) will share filter
    // state. That's acceptable today because each FeatureApiKey corresponds
    // to one conceptual carousel per course type. If a future page needs an
    // isolated copy, extend the cache key with a caller-supplied scope.
    const cacheKey = `${key}-${type}`;
    if (!this.resources.has(cacheKey)) {
      this.resources.set(
        cacheKey,
        new FeatureResource(
          key,
          type,
          this.api,
          this.injector,
          this.destroyRef,
          this.isBrowser,
          this.auth.isAuthenticated,
          options,
        ),
      );
    } else {
      // Trigger background refresh on a genuine revisit, but NOT while a fetch
      // is already in flight: a second concurrent consumer of the same resource
      // (e.g. footer-overlay grabbing 'inprogress' while the offering page's
      // initial load is still pending) would otherwise call refresh() and abort
      // that in-flight request via the items$ switchMap — surfacing as a
      // cancelled + immediately-refired recently_viewed call.
      const cached = this.resources.get(cacheKey)!;
      if (!cached.isLoading()) cached.refresh();
    }
    return this.resources.get(cacheKey)!;
  }

  /**
   * Refresh personalized resources cached for a given course type. Called after
   * profile data that drives recommendations changes (e.g. sector/job_role
   * captured via the engagement dialog).
   */
  refreshPersonalized(type: string): void {
    for (const [cacheKey, resource] of this.resources) {
      const { key, type: t } = this.splitCacheKey(cacheKey);
      if (t === type && FeatureFacade.PERSONALIZED_KEYS.has(key)) {
        resource.refresh();
      }
    }
  }

  /** Split a `${key}-${type}` cache key back into its parts. */
  private splitCacheKey(cacheKey: string): { key: FeatureApiKey; type: string } {
    const dash = cacheKey.indexOf('-');
    if (dash < 0) return { key: cacheKey as FeatureApiKey, type: '' };
    return {
      key: cacheKey.slice(0, dash) as FeatureApiKey,
      type: cacheKey.slice(dash + 1),
    };
  }

  getAbout<T = unknown>(id: number, type = 'masterclass'): Observable<{ data: T }> {
    const url = FEATURE_ROUTES.about.path.replace(':id', id.toString());
    const params = type ? { course_type: type } : undefined;
    return this.api
      .get<{ data: T }>(url, { params })
      .pipe(
        map((res) =>
          res ? { ...res, data: dropIdOnlyFieldsOfStudy(normalizeBookmarkField(res.data)) } : res,
        ),
      );
  }

  /**
   * Broadcast a bookmark toggle to every cached resource so all visible lists
   * stay in sync without an extra round-trip.
   *
   * Pass 1 patches every non-bookmark listing in place, keeping both bookmark
   * fields consistent:
   *   - Flat lists (`popular`, `recommended`, etc.) — items are `Content`
   *     objects; flip the bookmark flag on the matching id.
   *   - Track lists — items wrap their courses in `{ ids, content: Content[] }`;
   *     map into `content[]` and flip there.
   * While patching, it captures the freshest copy of the toggled course per
   * type-family so pass 2 can build the bookmark row locally.
   *
   * Pass 2 reconciles the dedicated bookmark listings (key `bookmark`) without
   * re-fetching: an un-bookmark drops the row; a bookmark prepends a synthesized
   * row cloned from the captured source. It only falls back to a server refresh
   * when the course isn't in any loaded listing (e.g. toggled from a details
   * page), so there's no in-memory copy to surface.
   *
   * @param courseType the toggled course's API type (e.g. `masterclass`,
   *   `podcast`, `micro_learning`); scopes which bookmark listing receives the
   *   add/remove. When omitted, every bookmark listing is considered.
   */
  applyBookmarkChange(courseId: number, isBookmarked: boolean, courseType?: string): void {
    const targetFamily = courseType ? bookmarkTypeFamily(courseType) : undefined;

    // Freshest snapshot of the toggled course, keyed by type-family, captured
    // while patching the listings below and reused to synthesize the bookmark row.
    const sourceByFamily = new Map<string, any>();

    // Pass 1 — patch non-bookmark listings in place + capture a source snapshot.
    for (const [cacheKey, resource] of this.resources) {
      const { key, type } = this.splitCacheKey(cacheKey);
      if (key === 'bookmark') continue;

      const family = bookmarkTypeFamily(type);

      resource.items.update((items) => {
        let changed = false;
        const next = items.map((item: any) => {
          if (Array.isArray(item?.content)) {
            let contentChanged = false;
            const nextContent = item.content.map((c: any) => {
              if (c?.id !== courseId) return c;
              if (!sourceByFamily.has(family)) sourceByFamily.set(family, c);
              if (isItemBookmarked(c) === isBookmarked) return c;
              contentChanged = true;
              return withBookmarkFlag(c, isBookmarked);
            });
            if (contentChanged) {
              changed = true;
              return { ...item, content: nextContent };
            }
            return item;
          }
          if (item?.id !== courseId) return item;
          if (!sourceByFamily.has(family)) sourceByFamily.set(family, item);
          if (isItemBookmarked(item) === isBookmarked) return item;
          changed = true;
          return withBookmarkFlag(item, isBookmarked);
        });
        return changed ? next : items;
      });
    }

    // Pass 2 — reconcile the dedicated bookmark listings locally. Mutations go
    // through `patchItems`/`prependItem` so they edit the resource's page
    // accumulator and survive a later pagination flatten.
    for (const [cacheKey, resource] of this.resources) {
      const { key, type } = this.splitCacheKey(cacheKey);
      if (key !== 'bookmark') continue;

      const family = bookmarkTypeFamily(type);
      if (targetFamily && family !== targetFamily) continue;

      if (!isBookmarked) {
        const removed = resource.patchItems((rows) => {
          const next = rows.filter((it: any) => it?.id !== courseId);
          return next.length === rows.length ? rows : next;
        });
        if (removed) this.adjustBookmarkCount(resource, -1);
        continue;
      }

      // Bookmark added — if it's already listed, just normalize a stale flag
      // (no count delta); otherwise prepend a row synthesized from the source.
      const present = resource.items().some((it: any) => it?.id === courseId);
      if (present) {
        resource.patchItems((rows) => {
          let changed = false;
          const next = rows.map((it: any) => {
            if (it?.id === courseId && !isItemBookmarked(it)) {
              changed = true;
              return withBookmarkFlag(it, true);
            }
            return it;
          });
          return changed ? next : rows;
        });
        continue;
      }

      const source = sourceByFamily.get(family);
      if (!source) {
        // Not in any loaded listing — no in-memory copy to surface.
        resource.refresh();
        continue;
      }
      resource.prependItem(withBookmarkFlag(source, true));
      this.adjustBookmarkCount(resource, 1);
    }
  }

  /** Nudge a bookmark listing's total count so any "X bookmarks" label stays honest. */
  private adjustBookmarkCount(resource: FeatureResource, delta: number): void {
    const pagination = resource.paginationData();
    if (!pagination || typeof pagination.total_count !== 'number') return;
    resource.paginationData.set({
      ...pagination,
      total_count: Math.max(0, pagination.total_count + delta),
    });
  }
}
