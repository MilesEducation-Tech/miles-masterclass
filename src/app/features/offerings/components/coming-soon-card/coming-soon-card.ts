import { NgOptimizedImage } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { faSolidBell, faSolidCheck, faSolidPlay } from '@ng-icons/font-awesome/solid';
import { Button } from '@shared/ui/button/button';
import { MasterclassComingSoonCourse } from '@features/offerings/models/masterclass-library.model';
import { MasterclassLibraryFacade } from '@features/offerings/services/masterclass-library-facade';

/**
 * One Coming Soon teaser on an offering landing page, in the shared
 * `app-coming-soon` design: the rank in outline, the artwork, and Trailer and
 * Remind Me on hover or focus. A teaser is not a course yet, so it has no link,
 * bookmark or filter. It injects the page's `MasterclassLibraryFacade`, which
 * owns the rail, the reminders and the trailer dialog.
 */
@Component({
  selector: 'app-coming-soon-card',
  imports: [NgOptimizedImage, NgIcon, Button],
  templateUrl: './coming-soon-card.html',
  host: { class: 'w-full group/card flex flex-col overflow-hidden relative' },
})
export class ComingSoonCard {
  protected readonly library = inject(MasterclassLibraryFacade);

  readonly course = input.required<MasterclassComingSoonCourse>();
  /** Its place in the rail, from 0; the outline shows it from 1. */
  readonly index = input.required<number>();

  protected readonly playIcon = faSolidPlay;
  protected readonly bellIcon = faSolidBell;
  protected readonly checkIcon = faSolidCheck;
}
