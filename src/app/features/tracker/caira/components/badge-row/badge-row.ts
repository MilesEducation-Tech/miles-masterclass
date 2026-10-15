import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CourseBadgeCard } from '@features/tracker/caira/components/course-badge-card/course-badge-card';
import { WebinarBadgeCard } from '@features/tracker/caira/components/webinar-badge-card/webinar-badge-card';
import {
  BadgeSection,
  MasterclassBadge,
  WebinarBadge,
} from '@features/tracker/caira/models/caira-badge-page.model';
import { trackerLinks } from '@features/tracker/utils/tracker-links';

/** The two sections that render as a rail. The ladder has the hero instead. */
export type BadgeRowSection = Exclude<BadgeSection, 'level_badges'>;

/**
 * One heading + "View All" + horizontally scrolling rail of badges on the tracker home.
 *
 * Pure presentation: the page passes the badges in and handles the CTA. Each row used to own
 * its own request — four rows, four requests — but `badges/page/` returns every section at
 * once, so there is nothing left to fetch per row.
 *
 * `section` picks which list renders; the other input is simply ignored, which keeps each card
 * component on a single concrete type instead of widening its input to a union.
 *
 * The rail is CSS scroll-snap, not Swiper: the initial bundle sits within a few kB of its
 * 2 MB budget and `no-scrollbar` is already a project utility.
 */
@Component({
  selector: 'app-badge-row',
  imports: [CourseBadgeCard, WebinarBadgeCard, RouterLink],
  templateUrl: './badge-row.html',
  host: { class: 'block' },
})
export class BadgeRow {
  readonly heading = input.required<string>();
  readonly section = input.required<BadgeRowSection>();
  /** Route for "View All", relative to the tracker (e.g. `course-badges`). */
  readonly viewAllLink = input.required<string>();
  readonly isLoading = input(false);
  readonly webinarBadges = input<WebinarBadge[]>([]);
  readonly courseBadges = input<MasterclassBadge[]>([]);

  /** A course card's CTA. The page decides what it does; webinar cards navigate themselves. */
  readonly activate = output<MasterclassBadge>();

  private readonly links = trackerLinks();

  protected readonly isWebinar = computed(() => this.section() === 'webinar_badges');

  protected readonly viewAllCommands = computed(() => [...this.links.home(), this.viewAllLink()]);

  protected readonly webinarItems = computed(() => (this.isWebinar() ? this.webinarBadges() : []));
  protected readonly courseItems = computed(() => (this.isWebinar() ? [] : this.courseBadges()));

  private readonly itemCount = computed(
    () => this.webinarItems().length + this.courseItems().length,
  );

  /**
   * A row with no badges is left out of the DOM entirely rather than rendering a heading over
   * an empty rail. A failed fetch counts as "no data" too — the page above owns the visible
   * error state, so a broken endpoint costs the user a section, not a double error.
   */
  protected readonly isHidden = computed(() => !this.isLoading() && !this.itemCount());

  /**
   * The heading and "View All" wait for data. Announcing "Webinar Badges" before knowing
   * whether any exist means the heading can vanish a moment later.
   */
  protected readonly showHeading = computed(() => this.itemCount() > 0);
}
