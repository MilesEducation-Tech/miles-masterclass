import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { svglFacebook, svglInstagram, svglLinkedin, svglYoutube } from '@ng-icons/svgl';
import { Utils } from '@shared/services/utils';
import { InstructorRow } from '@features/library/instructor/models/instructor-library.model';
import { socialLinksOf } from '@features/library/instructor/utils/instructor-socials';

/**
 * An instructor in the library grid: photo, name, job title and social chips.
 * The card is a plain link to the instructor page; the chips sit above it and
 * open the network in a new tab.
 */
@Component({
  selector: 'app-instructor-card',
  imports: [NgOptimizedImage, RouterLink, NgIcon],
  templateUrl: './instructor-card.html',
  // The icons `INSTRUCTOR_SOCIAL_ICONS` names.
  viewProviders: [provideIcons({ svglLinkedin, svglFacebook, svglInstagram, svglYoutube })],
})
export class InstructorCard {
  private readonly utils = inject(Utils);

  readonly instructor = input.required<InstructorRow>();
  /** Set on the first row, which is in the first viewport and holds the LCP image. */
  readonly priority = input(false);

  /**
   * Absolute, like `MasterclassCourseCard.courseLink`, so it resolves from any
   * page. The API has no slug; the name's is cosmetic, the id finds the instructor.
   */
  protected readonly link = computed(() => [
    '/',
    this.utils.country(),
    this.utils.profession(),
    'instructor',
    this.instructor().id,
    this.utils.slugify(this.instructor().name),
  ]);

  /**
   * The portrait photo first, as the 9:16 card is portrait. `null` when there is
   * none: an empty string counts as missing, because `ngSrc=""` throws NG02952.
   */
  protected readonly photo = computed<string | null>(() => {
    const i = this.instructor();
    return i.vertical_image_url || i.square_image_url || i.horizontal_image_url || null;
  });

  /**
   * Set when the photo fails to load, so the card shows the initials instead of
   * a broken image (half of UAT's photos answer 403 from their bucket). A new
   * photo clears it.
   */
  protected readonly photoFailed = linkedSignal({ source: this.photo, computation: () => false });

  protected readonly initials = computed(() =>
    this.instructor()
      .name.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join(''),
  );

  protected readonly socials = computed(() => socialLinksOf(this.instructor().social_media));
}
