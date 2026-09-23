import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  linkedSignal,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Carousel } from '@shared/components/carousel/carousel';
import { Horizontal } from '@shared/components/cards/horizontal/horizontal';
import { Square } from '@shared/components/cards/square/square';
import { Vertical } from '@shared/components/cards/vertical/vertical';
import {
  SwiperConfig,
  swiperConfigEven,
  swiperConfigOdd,
  swiperConfigPodcast,
} from '@core/config/swiper.config';
import { Content } from '@core/models/course.model';
import { FeatureApiResponse } from '@core/models/feature.model';
import { ApiCourseType } from '@core/models/library-filters.model';
import { ContentResponse, TRACK_ROUTES, TracksResponse } from '@core/models/track.model';
import { ApiClient } from '@core/services/api-client/api-client';
import { parseNextPage } from '@core/utils/parse-next-page';

export type ContentType = 'MASTERCLASS' | 'PODCAST' | 'MICRO-LEARNING' | 'TRACKS';

export interface PartnershipContentInput {
  type: ContentType;
  heading: string | null;
  subheading?: string;
}

interface ContentSection {
  type: ContentType;
  heading: string;
  subheading?: string;
  cardType: 'masterclass' | 'podcast' | 'micro-learning';
  swiperConfig: SwiperConfig;
  items: Content[];
  currentPage: number;
  nextPage: number | null;
  isLoading: boolean;
  hasLoaded: boolean;
}

/** Per-track shape consumed by the template — title + description + paginated content. */
export interface TrackItem {
  id: number;
  title: string;
  description: string;
  content: Content[];
  nextPage: number | null;
  isLoading: boolean;
}

type TrackCourseType = 'masterclass' | 'podcast' | 'micro_learning';

const SECTION_PRESETS: Record<ContentType, Pick<ContentSection, 'cardType' | 'swiperConfig'>> = {
  MASTERCLASS: { cardType: 'masterclass', swiperConfig: swiperConfigEven },
  PODCAST: { cardType: 'podcast', swiperConfig: swiperConfigPodcast },
  'MICRO-LEARNING': { cardType: 'micro-learning', swiperConfig: swiperConfigOdd },
  TRACKS: { cardType: 'masterclass', swiperConfig: swiperConfigEven },
};

@Component({
  selector: 'app-partnership-content',
  imports: [Carousel, Horizontal, Square, Vertical],
  templateUrl: './partnership-content.html',
  styleUrl: './partnership-content.css',
})
export class PartnershipContent {
  private readonly http = inject(ApiClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  swiperConfigOdd = swiperConfigOdd;
  swiperConfigEven = swiperConfigEven;

  content = input.required<PartnershipContentInput[]>();
  /** Course type used to fetch each track's sub-content. Defaults to 'masterclass'. */
  readonly trackCourseType = input<TrackCourseType>('masterclass');

  /** Tracks (with sub-content) rendered when a TRACKS section is present. */
  readonly trackItems = signal<TrackItem[]>([]);
  /** True while the initial tracks list + per-track-page-1 fan-out is in flight. */
  readonly tracksIsLoading = signal(false);
  /** Course type the current `trackItems()` was loaded for. Forces refetch on change. */
  private loadedTracksFor: TrackCourseType | null = null;

  readonly contentList = linkedSignal<PartnershipContentInput[], ContentSection[]>({
    source: this.content,
    computation: (sections) =>
      sections.map((section) => ({
        type: section.type,
        heading: section.heading ?? '',
        subheading: section.subheading,
        ...SECTION_PRESETS[section.type],
        items: [] as Content[],
        currentPage: 0,
        nextPage: 1,
        isLoading: false,
        hasLoaded: false,
      })),
  });

  constructor() {
    // Loader for non-track sections (library calls).
    effect(() => {
      const sections = this.contentList();
      if (!this.isBrowser) return;

      untracked(() => {
        sections.forEach((section, index) => {
          if (section.type === 'TRACKS') return;
          if (!section.hasLoaded && !section.isLoading) {
            this.fetchPage(index, 1);
          }
        });
      });
    });

    // Loader for TRACKS — runs whenever the input contains a TRACKS section
    // and refetches if `trackCourseType` changes.
    effect(() => {
      const sections = this.content();
      const courseType = this.trackCourseType();
      if (!this.isBrowser) return;
      if (!sections.some((s) => s.type === 'TRACKS')) return;
      if (this.loadedTracksFor === courseType) return;

      this.loadedTracksFor = courseType;
      untracked(() => this.loadTracks(courseType));
    });
  }

  loadMore(index: number): void {
    const section = this.contentList()[index];
    if (!section || section.isLoading || section.nextPage === null) return;
    this.fetchPage(index, section.nextPage);
  }

  /** Append the next page of `content` to a single track. */
  loadMoreTrack(trackId: number): void {
    const track = this.trackItems().find((t) => t.id === trackId);
    if (!track || track.isLoading || track.nextPage === null) return;

    this.trackItems.update((list) =>
      list.map((t) => (t.id === trackId ? { ...t, isLoading: true } : t)),
    );

    this.fetchTrackContent(trackId, track.nextPage)
      .pipe(
        catchError(() => of<ContentResponse>({ status_code: 200, data: [] })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        const next = parseNextPage(response.pagination_data?.next_page ?? response.next);
        this.trackItems.update((list) =>
          list.map((t) =>
            t.id === trackId
              ? {
                  ...t,
                  content: [...t.content, ...(response.data ?? [])],
                  nextPage: next,
                  isLoading: false,
                }
              : t,
          ),
        );
      });
  }

  /**
   * Two-step fetch: GET `tracks/`, then `forkJoin` a content request for each
   * track (page 1). Assembles `TrackItem[]` and replaces the signal.
   */
  private loadTracks(courseType: TrackCourseType): void {
    this.tracksIsLoading.set(true);

    this.http
      .get<TracksResponse>(TRACK_ROUTES.tracks.path, { params: { page: 1 } })
      .pipe(
        switchMap((tracksResponse) => {
          const tracks = tracksResponse.results ?? [];
          if (!tracks.length) return of<TrackItem[]>([]);

          const requests = tracks.map((track) =>
            this.fetchTrackContent(track.id, 1, courseType).pipe(
              catchError(() => of<ContentResponse>({ status_code: 200, data: [] })),
              map((response): TrackItem => ({
                id: track.id,
                title: track.name,
                description: track.description,
                content: response.data ?? [],
                nextPage: parseNextPage(response.pagination_data?.next_page ?? response.next),
                isLoading: false,
              })),
            ),
          );

          return forkJoin(requests);
        }),
        catchError(() => of<TrackItem[]>([])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        this.trackItems.set(items);
        this.tracksIsLoading.set(false);
      });
  }

  private fetchTrackContent(
    trackId: number,
    page: number,
    courseType: TrackCourseType = this.trackCourseType(),
  ): Observable<ContentResponse> {
    const path = TRACK_ROUTES.trackContent.path.replace(':id', trackId.toString());
    return this.http.get<ContentResponse>(path, {
      params: { course_type: courseType, page },
    });
  }

  private fetchPage(index: number, page: number): void {
    const section = this.contentList()[index];

    this.contentList.update((list) => {
      const next = [...list];
      next[index] = { ...next[index], isLoading: true };
      return next;
    });

    this.fetchByType(section.type, page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        this.contentList.update((list) => {
          const next = [...list];
          const incoming = res.data ?? [];
          const merged = page === 1 ? incoming : [...next[index].items, ...incoming];
          next[index] = {
            ...next[index],
            items: merged,
            currentPage: page,
            nextPage: parseNextPage(res.pagination_data?.next_page),
            isLoading: false,
            hasLoaded: true,
          };
          return next;
        });
      });
  }

  private fetchByType(type: ContentType, page: number): Observable<FeatureApiResponse<Content[]>> {
    switch (type) {
      case 'MASTERCLASS':
        return this.fetchCourseLibrary('masterclass', page);
      case 'PODCAST':
        return this.fetchCourseLibrary('podcast', page);
      case 'MICRO-LEARNING':
        return this.fetchCourseLibrary('micro_learning', page);
      case 'TRACKS':
        // Tracks have their own two-step loader; the loader effect skips them
        // before reaching this branch.
        return of<FeatureApiResponse<Content[]>>({ data: [] });
    }
  }

  private fetchCourseLibrary(
    course_type: ApiCourseType,
    page: number,
  ): Observable<FeatureApiResponse<Content[]>> {
    return this.http
      .get<FeatureApiResponse<Content[]>>('v2/library/', {
        params: { course_type, page },
      })
      .pipe(catchError(() => of<FeatureApiResponse<Content[]>>({ data: [] })));
  }
}
