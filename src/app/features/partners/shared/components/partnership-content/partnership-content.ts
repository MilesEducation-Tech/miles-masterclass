import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, inject, input, linkedSignal, PLATFORM_ID, signal } from '@angular/core';
import { Carousel } from '../../../../../shared/components/carousel/carousel';
import { Horizontal } from '../../../../../shared/components/cards/horizontal/horizontal';
import { Square } from '../../../../../shared/components/cards/square/square';
import { Vertical } from '../../../../../shared/components/cards/vertical/vertical';
import {
  SwiperConfig,
  swiperConfigEven,
  swiperConfigOdd,
  swiperConfigPodcast,
} from '../../../../../shared/core/config/swiper.config';

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
  items: any[];
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
  content: any[];
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
  // ponytail: ApiClient was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  private readonly http: any = {

  };
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
        items: [] as any[],
        currentPage: 0,
        nextPage: 1,
        isLoading: false,
        hasLoaded: false,
      })),
  });

  // ponytail: the library pagination fan-out and the two-step tracks loader
  // (GET tracks/ then a per-track content request) both went with the backend.
  // The page-merge helpers below are kept — they are presentation logic, not
  // transport. Reconnect by calling `appendPage` / `appendTrackPage` from the
  // new backend's paginated response and the carousels light up unchanged.

  loadMore(index: number): void {
    const section = this.contentList()[index];
    if (!section || section.isLoading || section.nextPage === null) return;
  }

  /** Append the next page of `content` to a single track. */
  loadMoreTrack(trackId: number): void {
    const track = this.trackItems().find((t) => t.id === trackId);
    if (!track || track.isLoading || track.nextPage === null) return;
  }

  /** Merge a page of section items into `contentList`, page 1 replacing the rest. */
  protected appendPage(index: number, page: number, items: any[], nextPage: number | null): void {
    this.contentList.update((list) => {
      const next = [...list];
      const merged = page === 1 ? items : [...next[index].items, ...items];
      next[index] = {
        ...next[index],
        items: merged,
        currentPage: page,
        nextPage,
        isLoading: false,
        hasLoaded: true,
      };
      return next;
    });
  }

  /** Append a page of course content onto one track's carousel. */
  protected appendTrackPage(trackId: number, items: any[], nextPage: number | null): void {
    this.trackItems.update((list) =>
      list.map((t) =>
        t.id === trackId
          ? { ...t, content: [...t.content, ...items], nextPage, isLoading: false }
          : t,
      ),
    );
  }
}
