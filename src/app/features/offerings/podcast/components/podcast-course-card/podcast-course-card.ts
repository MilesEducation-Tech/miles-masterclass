import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { faSolidPlay, faSolidRobot } from '@ng-icons/font-awesome/solid';
import { matBookmarkBorderRound, matBookmarkRound } from '@ng-icons/material-icons/round';
import { MasterclassCourse } from '@core/models/masterclass-home.model';
import { MasterclassBookmarks } from '@core/services/masterclass-bookmarks/masterclass-bookmarks';
import { CairaCredlyBadge } from '@shared/components/cards/caira-credly-badge/caira-credly-badge';
import { CategoriesList } from '@shared/components/categories-list/categories-list';
import { RecordDisk } from '@shared/components/record-disk/record-disk';
import { CourseAiKit } from '@shared/services/course-ai-kit';
import { Utils } from '@shared/services/utils';
import { Button } from '@shared/ui/button/button';
import { PODCAST_RECORD_DISK } from '@features/offerings/podcast/constants/podcast';

/**
 * One podcast on the podcast page's rails, from the web API's course card: the
 * square artwork with its CAIRA badge, and on hover or focus a slightly larger
 * panel with the record disk, the title, description, fields of study, credits,
 * Trailer, AI Kit (when the course has one) and the bookmark. The disk and the
 * title link to the course by its UUID and slug.
 *
 * The course-info ("i") button joins with the podcast course page's rebind,
 * when `CourseDetailFacade` serves podcasts.
 */
@Component({
  selector: 'app-podcast-course-card',
  imports: [
    NgOptimizedImage,
    RouterLink,
    NgIcon,
    Button,
    RecordDisk,
    CategoriesList,
    CairaCredlyBadge,
  ],
  templateUrl: './podcast-course-card.html',
  host: { class: 'group/podcast relative block w-full aspect-square' },
})
export class PodcastCourseCard {
  private readonly utils = inject(Utils);
  private readonly aiKit = inject(CourseAiKit);
  private readonly bookmarks = inject(MasterclassBookmarks);

  readonly course = input.required<MasterclassCourse>();
  /** Its place in the rail; the first four load their artwork eagerly. */
  readonly index = input.required<number>();

  protected readonly icons = {
    faSolidPlay,
    faSolidRobot,
    matBookmarkRound,
    matBookmarkBorderRound,
  };

  /** The disk spins only while the panel is hovered. */
  protected readonly hovering = signal(false);

  protected readonly disk = computed(() => ({ ...PODCAST_RECORD_DISK, animate: this.hovering() }));

  /** Square artwork first, as the podcast rails have always shown it. */
  protected readonly artwork = computed<string | null>(() => {
    const { square, horizontal, vertical } = this.course().thumbnails;
    return square ?? horizontal ?? vertical;
  });

  /** Absolute, so the link is right from any page that renders the card. */
  protected readonly courseLink = computed(() => [
    '/',
    this.utils.country(),
    this.utils.profession(),
    'podcast',
    this.course().id,
    this.course().slug,
  ]);

  protected readonly bookmarked = computed(() => this.bookmarks.isBookmarked(this.course()));

  /** The shared video dialog; it toasts "Trailer Not Found" for a course with none. */
  protected openTrailer(): void {
    const { horizontal_trailer_url, title } = this.course();
    void this.utils.openVideoDialog(horizontal_trailer_url, title);
  }

  /** The "Additional Resources" dialog: the AI Kit first, then the exercise files. */
  protected openAiKit(): void {
    this.aiKit.open(this.course());
  }

  /** Signed out, to sign-in and back; signed in, a toggle with a toast. */
  protected toggleBookmark(): void {
    this.bookmarks.toggle(this.course());
  }
}
