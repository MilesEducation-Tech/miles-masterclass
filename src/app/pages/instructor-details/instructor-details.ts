import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  PLATFORM_ID,
  resource,
  signal,
} from '@angular/core';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { Backward } from '../../shared/components/backward/backward';
import { Horizontal } from '../../shared/components/cards/horizontal/horizontal';
import { Hover } from '../../shared/components/cards/hover/hover';
import { Vertical } from '../../shared/components/cards/vertical/vertical';
import { ErrorState } from '../../shared/components/ui/error-state/error-state';
import { PageLoading } from '../../shared/components/ui/page-loading/page-loading';
import { TabStrip } from '../../shared/components/ui/tab-strip/tab-strip';
import { VideoJs, VideoSource } from '../../shared/components/video-js/video-js';
import { Analytics } from '../../shared/core/services/analytics/analytics';
import { InstructorHero } from './components/instructor-hero/instructor-hero';
import { Square } from '../../shared/components/cards/square/square';

/** The three course tabs this page renders — UI vocabulary, not a wire shape. */
type TabId = 'masterclass' | 'podcast' | 'micro-learning';

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
  styleUrl: './instructor-details.css',
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

  // ponytail: ApiClient was deleted with the Django strip. This placeholder

  // keeps the template bindings compiling and renders the empty state.

  // Swap in the new backend's service — the template needs no changes.

  private readonly api: any = {


  };
  private readonly analytics = inject(Analytics);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly activeTab = signal<TabId>('masterclass');

  private readonly instructorResource = resource<any, any>({
    params: () => {
      const id = this.instructorId();
      if (!this.isBrowser || !id) return undefined;
      return { id };
    },
    loader: ({ params, abortSignal }) =>
      firstValueFrom(
        this.api
          .get(`instructor/${params.id}/`)
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
      ),
  });

  protected readonly instructor = computed(() => this.instructorResource.value()?.data ?? null);
  protected readonly isInstructorLoading = computed(() => this.instructorResource.isLoading());
  protected readonly instructorError = computed(() => this.instructorResource.error());

  // Single fetch — response groups courses into `{ masterclass, nano }`. The
  // `masterclass` bucket further mixes Masterclass and Podcast items, told
  // apart by each item's `course_type` field ("Audio"/"podcast" → Podcast,
  // everything else → Masterclass). Tab switching is a client-side filter.
  private readonly relatedCoursesResource = resource<any, any>({
    params: () => {
      const id = this.instructorId();
      if (!this.isBrowser || !id) return undefined;
      return { id };
    },
    loader: ({ params, abortSignal }) =>
      firstValueFrom(
        this.api
          .get(`instructor/${params.id}/courses/`, {
            params: { page: 1 },
          })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
      ),
  });

  private readonly isPodcast = (c: any): boolean => {
    const ct = (c.course_type ?? '').toLowerCase();
    return ct === 'audio' || ct === 'podcast';
  };

  private readonly masterclassItems = computed<any[]>(() => {
    const items = this.relatedCoursesResource.value()?.data?.masterclass ?? [];
    return items.filter((c: any) => c.course_type.toLowerCase() === 'video');
  });

  private readonly podcastItems = computed<any[]>(() => {
    const items = this.relatedCoursesResource.value()?.data?.masterclass ?? [];
    return items.filter((c: any) => this.isPodcast(c));
  });

  private readonly microLearningItems = computed<any[]>(
    () => this.relatedCoursesResource.value()?.data?.nano ?? [],
  );

  protected readonly relatedCourses = computed<any[]>(() => {
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
