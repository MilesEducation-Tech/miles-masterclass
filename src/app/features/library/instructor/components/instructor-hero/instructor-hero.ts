import { NgOptimizedImage } from '@angular/common';
import { Component, computed, input, linkedSignal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { svglFacebook, svglInstagram, svglLinkedin, svglYoutube } from '@ng-icons/svgl';
import { InstructorProfile } from '@features/library/instructor/models/instructor-library.model';
import { socialLinksOf } from '@features/library/instructor/utils/instructor-socials';

@Component({
  selector: 'app-instructor-hero',
  imports: [NgIcon, NgOptimizedImage],
  templateUrl: './instructor-hero.html',
  // Block, so the page's `space-y-*` margin applies below it.
  host: { class: 'block' },
  // The icons `INSTRUCTOR_SOCIAL_ICONS` names.
  viewProviders: [provideIcons({ svglLinkedin, svglFacebook, svglInstagram, svglYoutube })],
})
export class InstructorHero {
  readonly instructor = input.required<InstructorProfile>();

  /** The wide photo behind the header. An empty string counts as missing (NG02952). */
  protected readonly backdrop = computed(() => this.instructor().horizontal_image_url || null);

  /** The round photo: square first, then the portrait. */
  protected readonly photo = computed(
    () => this.instructor().square_image_url || this.instructor().vertical_image_url || null,
  );

  /**
   * Set when an image fails to load (half of UAT's photos answer 403 from their
   * bucket), so it is left out rather than shown broken. A new image clears it.
   */
  protected readonly backdropFailed = linkedSignal({
    source: this.backdrop,
    computation: () => false,
  });
  protected readonly photoFailed = linkedSignal({ source: this.photo, computation: () => false });

  protected readonly socials = computed(() => socialLinksOf(this.instructor().social_media));
}
