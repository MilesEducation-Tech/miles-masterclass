import { NgOptimizedImage } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { svglFacebook, svglInstagram, svglLinkedin, svglYoutube } from '@ng-icons/svgl';
import { InstructorListItem } from '@core/models/library.model';

@Component({
  selector: 'app-instructor-card',
  imports: [NgOptimizedImage, NgIcon],
  templateUrl: './instructor-card.html',
  viewProviders: [provideIcons({ svglLinkedin, svglFacebook, svglInstagram, svglYoutube })],
})
export class InstructorCard {
  instructor = input.required<InstructorListItem>();
  readonly cardClicked = output<InstructorListItem>();

  /**
   * Available social handles for the floating top-right chip strip on the
   * card. Filters out nulls so the template can `@if (socials().length)` and
   * iterate without further guards. Same ordering as `InstructorHero` so the
   * card and detail page stay visually consistent.
   */
  readonly socials = computed(() => {
    const i = this.instructor();
    return [
      { url: i.linkedin_link, icon: 'svglLinkedin', label: 'LinkedIn' },
      { url: i.youtube_link, icon: 'svglYoutube', label: 'YouTube' },
      { url: i.instagram_link, icon: 'svglInstagram', label: 'Instagram' },
      { url: i.facebook_link, icon: 'svglFacebook', label: 'Facebook' },
    ].filter((s): s is { url: string; icon: string; label: string } => !!s.url);
  });

  handleClick() {
    this.cardClicked.emit(this.instructor());
  }
}
