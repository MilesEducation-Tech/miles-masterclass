import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { Backward } from '@shared/components/backward/backward';
import { Horizontal } from '@shared/components/cards/horizontal/horizontal';
import { Hover } from '@shared/components/cards/hover/hover';
import { Vertical } from '@shared/components/cards/vertical/vertical';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { PageLoading } from '@shared/ui/page-loading/page-loading';
import { TabStrip } from '@shared/ui/tab-strip/tab-strip';
import { VideoJs } from '@shared/components/video-js/video-js';
import type { VideoSource } from '@core/models/video-player.model';
import { Content } from '@core/models/course.model';
import { FeatureApiResponse } from '@core/models/feature.model';
import { InstructorListItem } from '@core/models/library.model';
import { apiUrl } from '@core/services/api-client/api-client';
import { Analytics } from '@core/services/analytics/analytics';
import { InstructorHero } from '../../components/instructor-hero/instructor-hero';
import { Square } from '@shared/components/cards/square/square';

type ResponseBucket = 'masterclass' | 'nano';
type TabId = 'masterclass' | 'podcast' | 'micro-learning';

interface InstructorCoursesPaginationBucket {
  total_count: number;
  current_page_number: number;
  next_page: number | string | null;
  previous_page: number | string | null;
}

interface InstructorCoursesResponse {
  status_code: number;
  message: string;
  data: Record<ResponseBucket, Content[]>;
  pagination_data: Record<ResponseBucket, InstructorCoursesPaginationBucket>;
}

@Component({
  selector: 'app-instructor-details',
  imports: [
    Backward,
    Horizontal,
    Hover,
    Vertical,
    ErrorState,
    PageLoading,
    TabStrip,
    VideoJs,
    InstructorHero,
    Square,
  ],
  templateUrl: './instructor-details.html',
})
export class InstructorDetails {
  readonly instructorId = input(0, { transform: numberAttribute });

  protected readonly courseTypeTabs = ['Masterclass', 'Podcast', 'Micro Learning'] as const;

  private readonly labelToTab: Record<string, TabId> = {
    Masterclass: 'masterclass',
    Podcast: 'podcast',
    'Micro Learning': 'micro-learning',
  };

  private readonly tabToLabel: Record<TabId, string> = {
    masterclass: 'Masterclass',
    podcast: 'Podcast',
    'micro-learning': 'Micro Learning',
  };

  private readonly analytics = inject(Analytics);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly activeTab = signal<TabId>('masterclass');

  private readonly instructorResource = httpResource<FeatureApiResponse<InstructorListItem>>(() => {
    const id = this.instructorId();
    return this.isBrowser && id ? apiUrl(`instructor/${id}/`) : undefined;
  });

  /** Guarded: `value()` throws on an errored resource. */
  protected readonly instructor = computed(() =>
    this.instructorResource.hasValue() ? (this.instructorResource.value()?.data ?? null) : null,
  );
  protected readonly isInstructorLoading = computed(() => this.instructorResource.isLoading());
  protected readonly instructorError = computed(() => this.instructorResource.error());

  // Single fetch — response groups courses into `{ masterclass, nano }`. The
  // `masterclass` bucket further mixes Masterclass and Podcast items, told
  // apart by each item's `course_type` field ("Audio"/"podcast" → Podcast,
  // everything else → Masterclass). Tab switching is a client-side filter.
  private readonly relatedCoursesResource = httpResource<InstructorCoursesResponse>(() => {
    const id = this.instructorId();
    if (!this.isBrowser || !id) return undefined;
    return { url: apiUrl(`instructor/${id}/courses/`), params: { page: 1 } };
  });

  /** The grouped courses, or `undefined`. Guarded: `value()` throws on an errored resource. */
  private readonly relatedGroups = computed(() =>
    this.relatedCoursesResource.hasValue() ? this.relatedCoursesResource.value()?.data : undefined,
  );

  private readonly isPodcast = (c: Content): boolean => {
    const ct = (c.course_type ?? '').toLowerCase();
    return ct === 'audio' || ct === 'podcast';
  };

  private readonly masterclassItems = computed<Content[]>(() => {
    const items = this.relatedGroups()?.masterclass ?? [];
    return items.filter((c) => c.course_type.toLowerCase() === 'video');
  });

  private readonly podcastItems = computed<Content[]>(() => {
    const items = this.relatedGroups()?.masterclass ?? [];
    return items.filter((c) => this.isPodcast(c));
  });

  private readonly microLearningItems = computed<Content[]>(() => this.relatedGroups()?.nano ?? []);

  protected readonly relatedCourses = computed<Content[]>(() => {
    switch (this.activeTab()) {
      case 'masterclass':
        return this.masterclassItems();
      case 'podcast':
        return this.podcastItems();
      case 'micro-learning':
        return this.microLearningItems();
    }
  });

  protected readonly isRelatedCoursesLoading = computed(() =>
    this.relatedCoursesResource.isLoading(),
  );

  protected readonly currentTabLabel = computed(() => this.tabToLabel[this.activeTab()]);

  protected readonly promoVideoSource = computed<VideoSource[]>(() => {
    const url = this.instructor()?.promo_video;
    if (!url) return [];
    const isHls = url.toLowerCase().endsWith('.m3u8');
    return [{ src: url, type: isHls ? 'application/x-mpegURL' : 'video/mp4' }];
  });

  protected readonly promoVideoConfig = computed(() => ({
    controls: true,
    autoplay: false,
    fluid: true,
    responsive: true,
    preload: 'metadata' as const,
    poster: this.instructor()?.horizontal_thumbnail ?? undefined,
  }));

  constructor() {
    // Fire `view_instructor` once the instructor profile resolves (guard against
    // the resource re-emitting for the same instructor).
    let sentId = 0;
    effect(() => {
      const ins = this.instructor() as {
        id?: number;
        first_name?: string;
        last_name?: string;
        name?: string;
      } | null;
      if (!ins?.id || sentId === ins.id) return;
      sentId = ins.id;
      this.analytics.trackEvent('view_instructor', {
        instructor_id: ins.id,
        instructor_name:
          [ins.first_name, ins.last_name].filter(Boolean).join(' ').trim() || ins.name || '',
      });
    });
  }

  onTabChange(label: string) {
    const tab = this.labelToTab[label];
    if (tab) this.activeTab.set(tab);
  }

  reload() {
    this.instructorResource.reload();
    this.relatedCoursesResource.reload();
  }
}
