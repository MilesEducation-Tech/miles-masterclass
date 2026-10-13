import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BadgeSection, MasterclassBadge, WebinarBadge } from '../../models/caira-badge-page.model';
import { BadgeActions } from '../../services/badge-actions';
import { CairaBadgesFacade } from '../../services/caira-badges-facade';
import { trackerLinks } from '../../../utils/tracker-links';
import { CourseBadgeCard } from '../course-badge-card/course-badge-card';
import { WebinarBadgeCard } from '../webinar-badge-card/webinar-badge-card';

/** The two sections that render as a rail. The ladder has the hero instead. */
export type BadgeRowSection = Exclude<BadgeSection, 'level_badges'>;

/**
 * One heading + "View All" + horizontally scrolling rail of badges on the tracker home.
 *
 * It injects the tracker's facade rather than fetching. Each row used to own its own
 * request — four rows, four requests — but `badges/page/` returns every section at once, so
 * there is nothing left to fetch per row and nothing that can make one row lag another.
 *
 * The rail is CSS scroll-snap, not Swiper: the initial bundle sits within a few kB of its
 * 2 MB budget and `no-scrollbar` is already a project utility.
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
  readonly section = input.required<BadgeRowSection>();
  /** Route for "View All", relative to the tracker (e.g. `course-badges`). */
  readonly viewAllLink = input.required<string>();

  private readonly facade = inject(CairaBadgesFacade);
  private readonly actions = inject(BadgeActions);

  private readonly links = trackerLinks();

  protected readonly isWebinar = computed(() => this.section() === 'webinar_badges');

  protected readonly viewAllCommands = computed(() => [...this.links.home(), this.viewAllLink()]);

  protected readonly isLoading = this.facade.isLoading;

  // The rail renders whatever the facade holds, which is the first page unless the learner
  // has already scrolled the matching listing — the rail scrolls either way, so more rows
  // cost nothing. Each `computed` returns `[]` for the other section so neither card
  // component has to widen its input to a union.
  protected readonly webinarItems = computed<WebinarBadge[]>(() =>
    this.isWebinar() ? this.facade.webinarBadges() : [],
  );
  protected readonly courseItems = computed<MasterclassBadge[]>(() =>
    this.isWebinar() ? [] : this.facade.masterclassBadges(),
  );

  private readonly itemCount = computed(
    () => this.webinarItems().length + this.courseItems().length,
  );

  /**
   * A row with no badges is left out of the DOM entirely rather than rendering a heading
   * over an empty rail. A failed fetch counts as "no data" too — the page above owns the
   * visible error state, so a broken endpoint costs the user a section, not a double error.
   */
  protected readonly isHidden = computed(() => !this.isLoading() && !this.itemCount());

  /**
   * The heading and "View All" wait for data. Announcing "Webinar Badges" before knowing
   * whether any exist means the heading can vanish a moment later.
   */
  protected readonly showHeading = computed(() => this.itemCount() > 0);

  protected onCourse(card: MasterclassBadge): void {
    void this.actions.run(card);
  }
}
