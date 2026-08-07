import { NgOptimizedImage } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { svglFacebook, svglInstagram, svglLinkedin, svglYoutube } from '@ng-icons/svgl';

@Component({
  selector: 'app-instructor-hero',
  imports: [NgIcon, NgOptimizedImage],
  templateUrl: './instructor-hero.html',
  viewProviders: [provideIcons({ svglLinkedin, svglFacebook, svglInstagram, svglYoutube })],
})
export class InstructorHero {
  readonly instructor = input.required<any>();

  readonly fullName = computed(() => {
    const i = this.instructor();
    return `${i.first_name} ${i.last_name}`.trim();
  });

  readonly socials = computed(() => {
    const i = this.instructor();
    return [
      { url: i.linkedin_link, icon: 'svglLinkedin', label: 'LinkedIn' },
      { url: i.youtube_link, icon: 'svglYoutube', label: 'YouTube' },
      { url: i.instagram_link, icon: 'svglInstagram', label: 'Instagram' },
      { url: i.facebook_link, icon: 'svglFacebook', label: 'Facebook' },
    ].filter((s): s is { url: string; icon: string; label: string } => !!s.url);
  });
}
