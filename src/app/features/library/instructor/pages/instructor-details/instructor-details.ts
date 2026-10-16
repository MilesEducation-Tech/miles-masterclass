import { isPlatformBrowser } from '@angular/common';
import { HttpContext, httpResource } from '@angular/common/http';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { SKIP_LOADING } from '@core/models/http.model';
import {
  MasterclassCourse,
  MasterclassCourseInfoDialogData,
  MasterclassLoginType,
} from '@core/models/masterclass-home.model';
import type { VideoSource } from '@core/models/video-player.model';
import { Analytics } from '@core/services/analytics/analytics';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { MASTERCLASS_COURSE_INFO_DIALOG } from '@core/services/dialog/feature-dialog-tokens';
import { Backward } from '@shared/components/backward/backward';
import { MasterclassCourseCard } from '@shared/components/cards/masterclass-course-card/masterclass-course-card';
import { VideoJs } from '@shared/components/video-js/video-js';
import { Utils } from '@shared/services/utils';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { PageLoading } from '@shared/ui/page-loading/page-loading';
import { Tab } from '@shared/ui/tabs/tab';
import { Tabs } from '@shared/ui/tabs/tabs';
import { InstructorHero } from '@features/library/instructor/components/instructor-hero/instructor-hero';
import {
  INSTRUCTOR_COURSE_TABS,
  INSTRUCTOR_COURSES_PAGE_SIZE,
  INSTRUCTOR_COURSES_URL,
  INSTRUCTOR_DETAIL_URL,
  INSTRUCTOR_ID_PATTERN,
  INSTRUCTOR_PROMO_PLAYER,
  INSTRUCTOR_PROMO_TYPES,
} from '@features/library/instructor/constants/instructor-library';
import {
  InstructorContentType,
  InstructorProfile,
  parseInstructorCourses,
  parseInstructorProfile,
} from '@features/library/instructor/models/instructor-library.model';

/**
 * `/instructor/:instructorId/:instructorName`: the profile from
 * `instructor-detail/`, and "Courses by …" from `filter/?instructor=`, one read
 * per tab. No facade: nothing here is shared, so the reads live in the page, as
 * on `/masterclass`. Public: both reads serve signed-out visitors.
 */
@Component({
  selector: 'app-instructor-details',
  imports: [
    Backward,
    ErrorState,
    PageLoading,
    VideoJs,
    InstructorHero,
    MasterclassCourseCard,
    Tabs,
    Tab,
  ],
  templateUrl: './instructor-details.html',
})
export class InstructorDetails {
  private readonly auth = inject(AuthSession);
  private readonly analytics = inject(Analytics);
  private readonly utils = inject(Utils);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly courseInfoDialog = inject(MASTERCLASS_COURSE_INFO_DIALOG);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** The `:instructorId` route param. */
  readonly instructorId = input('');

  /** Where Back goes when no page of this site opened this one. */
  protected readonly backFallback = computed(() =>
    this.utils.localePath('library/instructor-library'),
  );

  /** The id when it is a UUID; an old numeric link never reaches the API. */
  private readonly id = computed(() =>
    INSTRUCTOR_ID_PATTERN.test(this.instructorId()) ? this.instructorId() : null,
  );
  protected readonly isOldLink = computed(() => this.id() === null);

  // ---- Profile -------------------------------------------------------------

  /** From the session's boolean, never the token, so a token rotation doesn't refetch. */
  private readonly loginType = computed<MasterclassLoginType>(() =>
    this.auth.isAuthenticated() ? 'post_login' : 'pre_login',
  );

  private readonly profileResource = httpResource<InstructorProfile>(
    () => {
      const id = this.id();
      if (!this.isBrowser || !id) return undefined;
      return {
        url: `${INSTRUCTOR_DETAIL_URL}${id}/`,
        // Required: without it the read is a 400, signed in or not.
        params: { login_type: this.loginType() },
      };
    },
    // The trust boundary: an answer that drifted from the contract lands in `error()`.
    { parse: parseInstructorProfile },
  );

  /** Guarded: `value()` throws on an errored resource. */
  protected readonly profile = computed(() =>
    this.profileResource.hasValue() ? this.profileResource.value() : null,
  );
  protected readonly profileError = computed(() => this.profileResource.error());

  /** "Courses by …": the first word of the name that is not a title such as "Dr.". */
  protected readonly firstName = computed(() => {
    const words = this.profile()?.name.split(/\s+/).filter(Boolean) ?? [];
    return words.find((word) => !word.endsWith('.')) ?? words[0] ?? '';
  });

  /** The promo, when `video_url` is a file the player can play; otherwise none. */
  protected readonly promoSources = computed<VideoSource[]>(() => {
    const url = this.profile()?.video_url;
    if (!url) return [];
    const extension = URL.parse(url)?.pathname.split('.').pop()?.toLowerCase() ?? '';
    const type = INSTRUCTOR_PROMO_TYPES[extension];
    return type ? [{ src: url, type }] : [];
  });

  protected readonly promoConfig = computed(() => ({
    ...INSTRUCTOR_PROMO_PLAYER,
    poster: this.profile()?.horizontal_image_url ?? undefined,
  }));

  // ---- Courses -------------------------------------------------------------

  protected readonly tabs = INSTRUCTOR_COURSE_TABS;
  protected readonly tabLabels = this.tabs.map((tab) => tab.label);
  protected readonly activeTab = signal<InstructorContentType>('masterclass_course');
  protected readonly activeLabel = computed(
    () => this.tabs.find((tab) => tab.contentType === this.activeTab())?.label ?? '',
  );

  private readonly coursesResource = httpResource<MasterclassCourse[]>(
    () => {
      const id = this.id();
      if (!this.isBrowser || !id) return undefined;
      return {
        url: INSTRUCTOR_COURSES_URL,
        params: {
          content_type: this.activeTab(),
          instructor: id,
          page_size: INSTRUCTOR_COURSES_PAGE_SIZE,
        },
        // The section shows its own "Loading…".
        context: new HttpContext().set(SKIP_LOADING, true),
      };
    },
    { parse: parseInstructorCourses },
  );

  /** Guarded: `value()` throws on an errored resource. */
  protected readonly courses = computed(() =>
    this.coursesResource.hasValue() ? this.coursesResource.value() : [],
  );
  protected readonly isCoursesLoading = computed(() => this.coursesResource.isLoading());
  protected readonly coursesError = computed(() => this.coursesResource.error());

  /** Changes only with the instructor, not when the same profile reloads. */
  private readonly profileId = computed(() => this.profile()?.id ?? null);

  constructor() {
    // `view_instructor` once per instructor shown.
    effect(() => {
      const id = this.profileId();
      if (!id) return;
      untracked(() =>
        this.analytics.trackEvent('view_instructor', {
          instructor_id: id,
          instructor_name: this.profile()?.name ?? '',
        }),
      );
    });
  }

  protected onTabChange(label: string): void {
    const tab = this.tabs.find((t) => t.label === label);
    if (tab) this.activeTab.set(tab.contentType);
  }

  protected reloadProfile(): void {
    this.profileResource.reload();
  }

  protected reloadCourses(): void {
    this.coursesResource.reload();
  }

  protected openTrailer(course: MasterclassCourse): void {
    void this.utils.openVideoDialog(course.horizontal_trailer_url, course.title);
  }

  /**
   * The "i" dialog, as on the course library: it belongs to the offerings
   * feature, so it comes through the token `app.config.ts` binds.
   */
  protected async openCourseInfo(course: MasterclassCourse): Promise<void> {
    this.dialogs.open<MasterclassCourseInfoDialogData>(await this.courseInfoDialog(), {
      data: { course },
    });
  }
}
