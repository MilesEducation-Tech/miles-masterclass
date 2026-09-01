import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Backward } from '../../shared/components/backward/backward';
import { Horizontal } from '../../shared/components/cards/horizontal/horizontal';
import { Hover } from '../../shared/components/cards/hover/hover';
import { Vertical } from '../../shared/components/cards/vertical/vertical';
import { ErrorState } from '../../shared/components/ui/error-state/error-state';
import { PageLoading } from '../../shared/components/ui/page-loading/page-loading';
import { TabStrip } from '../../shared/components/ui/tab-strip/tab-strip';
import { VideoJs, VideoSource } from '../../shared/components/video-js/video-js';
import { Analytics } from '../../shared/core/services/analytics/analytics';
import { ApiClient } from '../../shared/core/services/api-client/api-client';
import { CAIRA } from '../../shared/core/http/caira.endpoints';
import { cairaError } from '../../shared/core/http/caira-error';
import { CairaFailure, CairaUuid } from '../../shared/core/models/caira/envelope.model';
import { CourseCard } from '../../shared/core/models/caira/masterclass.model';
import {
  InstructorDetailResponse,
  InstructorProfile,
  toInstructorProfile,
} from '../../shared/core/models/caira/course-detail.model';
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
  /** CAIRA instructor ids are UUIDs — the old numeric `transform` is gone. */
  readonly instructorId = input<CairaUuid>('');

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

  private readonly api = inject(ApiClient);
  private readonly analytics = inject(Analytics);

  protected readonly activeTab = signal<TabId>('masterclass');

  /**
   * #16 · `GET caira/masterclass/instructor/<uuid>/`.
   *
   * The only **un-enveloped** response in the API — the serializer's dict is
   * the whole body, with no `status` and no `data` wrapper. Its field names are
   * defined outside the documented module, so `toInstructorProfile` reads both
   * naming conventions and flattens `social_media_links`; see the mapper.
   *
   * Keyed on the id alone — see `CourseDetail` for why an `isAuthenticated()`
   * gate was removed here too. A 403 renders the error state and is visible in
   * the network tab; a request that never fires is neither.
   */
  private readonly instructorResource = httpResource<InstructorDetailResponse | undefined>(
    () => {
      const id = this.instructorId();
      return id ? this.api.absoluteUrl(CAIRA.instructorDetail(id)) : undefined;
    },
    { defaultValue: undefined },
  );

  protected readonly instructor = computed<InstructorProfile | null>(() => {
    // `error()` first — an errored resource throws from `value()`. See `CourseDetail`.
    if (this.instructorResource.error()) return null;
    const body = this.instructorResource.value();
    return body ? toInstructorProfile(body) : null;
  });
  protected readonly isInstructorLoading = this.instructorResource.isLoading;
  protected readonly instructorError = computed<CairaFailure | null>(() => {
    const err = this.instructorResource.error();
    return err ? cairaError(err) : null;
  });

  /** #16 needs a JWT, so signed-out is the common failure — name it (G-24). */
  protected readonly errorMessage = computed(() =>
    this.instructorError()?.kind === 'auth'
      ? 'Sign in to view this instructor profile.'
      : 'We hit a snag fetching this profile. Try again in a moment.',
  );

  /**
   * ponytail: **no endpoint.** The old API had `instructor/<id>/courses/`;
   * CAIRA has no per-instructor course listing — the only instructor→courses
   * data it exposes is `instructor_related_courses` inside a *course's* detail
   * payload (#4), which needs a course you already know. The three tabs
   * therefore render their empty states. Tracked in the gap register.
   */
  protected readonly relatedCourses = computed<CourseCard[]>(() => []);
  protected readonly isRelatedCoursesLoading = computed(() => false);

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

  /**
   * Last instructor `view_instructor` was sent for. A field rather than a
   * `let` captured in the effect closure — AGENTS.md §8, and a closure variable
   * is invisible to anything debugging a duplicate event.
   */
  private sentInstructorId: CairaUuid | null = null;

  constructor() {
    // The only effect on this page, and it is analytics — it reports state, it
    // does not propagate it. Guarded against the resource re-emitting for the
    // same instructor.
    effect(() => {
      const ins = this.instructor();
      if (!ins?.id || this.sentInstructorId === ins.id) return;
      this.sentInstructorId = ins.id;
      this.analytics.trackEvent('view_instructor', {
        instructor_id: ins.id,
        instructor_name: [ins.first_name, ins.last_name].filter(Boolean).join(' ').trim(),
      });
    });
  }

  onTabChange(label: string) {
    const tab = this.labelToTab[label];
    if (tab) this.activeTab.set(tab);
  }

  reload() {
    this.instructorResource.reload();
  }
}
