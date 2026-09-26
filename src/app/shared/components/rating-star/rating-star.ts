import { Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroStar } from '@ng-icons/heroicons/outline';
import { heroStarSolid } from '@ng-icons/heroicons/solid';
import { NgpRating, NgpRatingItem } from 'ng-primitives/rating';

/**
 * Star rating built on `ngpRating`.
 *
 * The primitive owns the value, the hover preview, keyboard interaction and the
 * `role="slider"` ARIA wiring; this component only supplies the star markup and
 * the project's styling hooks. Partial stars come from the per-item `fraction`
 * (0–1), which replaces the old `getStarState` / `getPartialPercent` pair.
 *
 * The public API is unchanged from the hand-rolled version, so consumers keep
 * binding `[value]`, `[isReadonly]`, `[max]`, `size`, `containerClass` and
 * `starClass` exactly as before.
 */
@Component({
  selector: 'app-rating-star',
  imports: [NgIcon, NgpRating, NgpRatingItem],
  templateUrl: './rating-star.html',
  viewProviders: [provideIcons({ heroStar, heroStarSolid })],
  host: {
    class: 'inline-block w-full',
  },
})
export class RatingStar {
  value = input<number>(0);
  isReadonly = input<boolean>(false);
  max = input<number>(5);
  size = input<string>('1.5rem');
  containerClass = input<string>('flex items-center gap-1');
  starClass = input<string>('');

  /**
   * Accessible name for the rating. `ngpRating` exposes `role="slider"`, which
   * needs a name — the individual stars are no longer separate controls.
   */
  ariaLabel = input<string>('Rating');

  valueChange = output<number>();
}
