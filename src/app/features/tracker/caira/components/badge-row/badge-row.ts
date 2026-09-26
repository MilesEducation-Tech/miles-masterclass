import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  PLATFORM_ID,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  BadgeCourseType,
  BadgeV2Response,
  CourseBadgeItem,
  WebinarBadgeItem,
} from '@core/models/caira-badge.model';
import { apiUrl } from '@core/services/api-client/api-client';
import { BadgeActions } from '../../services/badge-actions';
import { trackerLinks } from '../../../utils/tracker-links';
import { CourseBadgeCard } from '../course-badge-card/course-badge-card';
import { WebinarBadgeCard } from '../webinar-badge-card/webinar-badge-card';

type RowItem = CourseBadgeItem | WebinarBadgeItem;

const EMPTY: BadgeV2Response<RowItem[]> = { data: [] };

/**
 * One heading + "View All" + horizontally scrolling rail of badges on the
 * tracker home. Each row owns its own first-page fetch, so a slow row can't
 * blank the others — the reason there are four of these rather than one
 * component holding four resources.
 *
 * The rail is CSS scroll-snap, not Swiper: the initial bundle sits within a few
 * kB of its 2 MB budget and `no-scrollbar` is already a project utility.
 */
@Component({
  selector: 'app-badge-row',
  imports: [CourseBadgeCard, WebinarBadgeCard, RouterLink],
  templateUrl: './badge-row.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class BadgeRow {
  readonly heading = input.required<string>();
  readonly courseType = input.required<BadgeCourseType>();
  /** Route for "View All", relative to the tracker (e.g. `course-badges`). */
  readonly viewAllLink = input.required<string>();

  private readonly actions = inject(BadgeActions);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly links = trackerLinks();

  protected readonly isWebinar = computed(() => this.courseType() === 'webinar');

  protected readonly viewAllCommands = computed(() => [...this.links.home(), this.viewAllLink()]);

  protected readonly viewAllParams = computed(() =>
    this.isWebinar() ? {} : { course_type: this.courseType() },
  );

  private readonly rowResource = httpResource<BadgeV2Response<RowItem[]>>(
    () => {
      if (!this.isBrowser) return undefined;
      const courseType = this.courseType();
      return courseType === 'webinar'
        ? { url: apiUrl('v2/webinar-badges/') }
        : { url: apiUrl('v2/course-badges/'), params: { course_type: courseType } };
    },
    { defaultValue: EMPTY },
  );

  /** Guarded: `value()` throws on an errored resource, and a failed fetch must read as "no data". */
  protected readonly items = computed(() =>
    this.rowResource.hasValue() ? (this.rowResource.value()?.data ?? []) : [],
  );
  protected readonly isLoading = computed(() => this.rowResource.isLoading());

  /**
   * A row with no badges is left out of the DOM entirely rather than rendering
   * a heading over an empty rail. A failed fetch counts as "no data" too, so a
   * broken endpoint costs the user a section, not a visible error.
   */
  protected readonly isHidden = computed(() => !this.isLoading() && !this.items().length);

  /**
   * The heading and "View All" wait for data. During loading the rail is bare
   * skeletons — announcing "Podcast Course Badges" before knowing whether any
   * exist means the heading can vanish a moment later.
   */
  protected readonly showHeading = computed(() => this.items().length > 0);

  // Two narrowing casts in one place so neither card component has to widen
  // its input to a union.
  protected readonly courseItems = computed(() =>
    this.isWebinar() ? [] : (this.items() as CourseBadgeItem[]),
  );
  protected readonly webinarItems = computed(() =>
    this.isWebinar() ? (this.items() as WebinarBadgeItem[]) : [],
  );

  protected async onCourse(card: CourseBadgeItem): Promise<void> {
    if (await this.actions.run(BadgeActions.fromCourse(card))) this.rowResource.reload();
  }

  protected async onWebinar(card: WebinarBadgeItem): Promise<void> {
    if (await this.actions.run(BadgeActions.fromWebinar(card))) this.rowResource.reload();
  }
}
