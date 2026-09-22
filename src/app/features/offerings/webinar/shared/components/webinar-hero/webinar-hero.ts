import { Component, computed, input, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet, NgOptimizedImage } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';

import { Button } from '@shared/ui/button/button';
import { CategoriesList } from '@shared/components/categories-list/categories-list';
import { TotalCpeCreditsPipe } from '@shared/pipes/total-cpe-credits/total-cpe-credits.pipe';
import { UpcomingPremiere, WebinarCta, WebinarDate, WebinarTag } from '@core/models/feature.model';
import {
  WebinarRegistrationForm,
  WebinarRegistrationFormValue,
} from '../webinar-registration-form/webinar-registration-form';
import { heroVideoCameraSolid } from '@ng-icons/heroicons/solid';
import { phosphorShareFatFill } from '@ng-icons/phosphor-icons/fill';
import { CairaCredlyBadge } from '@shared/components/cards/caira-credly-badge/caira-credly-badge';
import { LocalTimeZonePipe } from '@shared/pipes/local-time-zone/local-time-zone.pipe';

/**
 * Zoom brand wordmark (Simple Icons, 24×24 viewBox). Stored as an SVG string so
 * `<ng-icon [svg]="zoomLogo">` can render it through the same pipeline the rest
 * of the app uses for custom marks. `currentColor` lets the surrounding
 * `text-accent` flow into the fill without a hardcoded brand colour.
 */
const ZOOM_LOGO = `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><title>Zoom</title><path d="M5.033 14.649H.743a.74.74 0 0 1-.686-.458.74.74 0 0 1 .16-.808L3.19 10.41H1.06A1.06 1.06 0 0 1 0 9.35h3.957c.301 0 .57.18.686.458a.74.74 0 0 1-.161.808L1.51 13.59h2.464c.585 0 1.06.475 1.06 1.06zM24 11.338c0-1.14-.927-2.066-2.066-2.066-.61 0-1.158.265-1.537.686a2.061 2.061 0 0 0-1.536-.686c-1.14 0-2.066.926-2.066 2.066v3.311a1.06 1.06 0 0 0 1.06-1.06v-2.251a1.004 1.004 0 0 1 2.013 0v2.251c0 .586.474 1.06 1.06 1.06v-3.311a1.004 1.004 0 0 1 2.012 0v2.251c0 .586.475 1.06 1.06 1.06zM16.265 12a2.728 2.728 0 1 1-5.457 0 2.728 2.728 0 0 1 5.457 0zm-1.06 0a1.669 1.669 0 1 0-3.338 0 1.669 1.669 0 0 0 3.338 0zm-4.82 0a2.728 2.728 0 1 1-5.458 0 2.728 2.728 0 0 1 5.457 0zm-1.06 0a1.669 1.669 0 1 0-3.338 0 1.669 1.669 0 0 0 3.338 0z"/></svg>`;

/**
 * ponytail: design-only shell. Enrolment, the auth gate, the share/join/
 * certificate actions and the `webinar-status` derivations were removed.
 * Everything that reads only from the `webinar` input is kept as real
 * presentation logic; everything that needed a service is now inert.
 * Re-wire by restoring WebinarFacade + `ctaFor`/`webinarTagFor`.
 */
@Component({
  selector: 'app-webinar-hero',
  imports: [
    Button,
    CategoriesList,
    DatePipe,
    NgIcon,
    NgTemplateOutlet,
    TotalCpeCreditsPipe,
    WebinarRegistrationForm,
    NgOptimizedImage,
    CairaCredlyBadge,
    LocalTimeZonePipe,
  ],
  templateUrl: './webinar-hero.html',
  styleUrl: './webinar-hero.css',
  providers: [provideIcons({ heroVideoCameraSolid, phosphorShareFatFill })],
})
export class WebinarHero {
  protected readonly zoomLogo = ZOOM_LOGO;
  readonly webinar = input.required<UpcomingPremiere>();
  /**
   * Hide the "Learn More" CTA in the auth-path card. Set `true` when the hero
   * is rendered on the webinar details page itself.
   */
  readonly hideLearnMore = input(false);

  protected readonly instructor = computed(() => this.webinar().instructor_details);

  /**
   * Display name list — primary instructor first, then co-instructors.
   * Filters out blanks so a half-populated co-instructor doesn't render
   * a stray " " in the byline.
   */
  protected readonly instructorNames = computed(() => {
    const lead = this.instructor();
    const others = lead?.other_instructors ?? [];
    return [lead, ...others]
      .filter((person) => person?.first_name || person?.last_name)
      .map((person) => `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim());
  });

  /**
   * Best available artwork, `null` when the webinar has none at all. Binding an
   * empty string to `src` makes the browser re-request the current page URL and
   * render a broken-image icon — so the template `@if`s on these.
   */
  protected readonly thumbnail = computed<string | null>(() => {
    const w = this.webinar();
    return w.horizontal_thumbnail || w.vertical_thumbnail || w.square_thumbnail || null;
  });

  /** Square-first variant for the md+ ticket image. */
  protected readonly squareThumbnail = computed<string | null>(() => {
    const w = this.webinar();
    return w.square_thumbnail || w.horizontal_thumbnail || w.vertical_thumbnail || null;
  });

  protected readonly nextSession = computed<WebinarDate | null>(
    () => this.webinar().webinar_dates?.[0] ?? null,
  );

  // ponytail: inert — these were derived from auth + webinar status.
  protected readonly isAuthed = signal(false);
  protected readonly tag = signal<WebinarTag>('upcoming');
  protected readonly cta = signal<WebinarCta>('book');
  protected readonly startsInLabel = signal<string | null>(null);
  protected readonly attendanceTag = signal<{ label: string; classes: string } | null>(null);
  protected readonly booking = signal(false);
  protected readonly ctaDisabled = signal(false);

  protected book(): void {
    // ponytail: inert
  }
  protected openDetails(): void {
    // ponytail: inert
  }
  protected share(): void {
    // ponytail: inert
  }
  protected onGuestRegistration(_payload: WebinarRegistrationFormValue): void {
    // ponytail: inert
  }
  protected joinLive(): void {
    // ponytail: inert
  }
  protected watchRecording(): void {
    // ponytail: inert
  }
  protected submitFeedback(): void {
    // ponytail: inert
  }
  protected downloadCertificate(): void {
    // ponytail: inert
  }
}
