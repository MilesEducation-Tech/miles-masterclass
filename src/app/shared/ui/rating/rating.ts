import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroStarSolid } from '@ng-icons/heroicons/solid';
import { NgpRating, NgpRatingItem } from 'ng-primitives/rating';

/**
 * Bound to signal forms through `value` / `valueChange` (a number; start the model at `0`).
 * Arrow keys, pointer and half steps are the primitive's. Name it with a `ngpLabel` in an `app-field`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-rating',
  hostDirectives: [
    {
      directive: NgpRating,
      inputs: [
        'ngpRatingValue:value',
        'ngpRatingCount:count',
        'ngpRatingAllowHalf:allowHalf',
        'ngpRatingDisabled:disabled',
        'ngpRatingReadonly:readonly',
        'ngpRatingClearable:clearable',
      ],
      outputs: ['ngpRatingValueChange:valueChange'],
    },
  ],
  imports: [NgIcon, NgpRatingItem],
  providers: [provideIcons({ heroStarSolid })],
  host: {
    class:
      'inline-flex gap-0.5 rounded-md text-2xl outline-none data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-ring data-disabled:cursor-not-allowed data-disabled:opacity-50 data-readonly:cursor-default',
    '(focusout)': 'touch.emit()',
  },
  template: `
    <span *ngpRatingItem="let star" class="relative inline-flex cursor-pointer">
      <ng-icon name="heroStarSolid" class="text-muted-foreground/40" aria-hidden="true" />
      <span
        class="absolute inset-y-0 left-0 overflow-hidden text-accent-premium"
        [style.width.%]="star.fraction * 100"
      >
        <ng-icon name="heroStarSolid" aria-hidden="true" />
      </span>
    </span>
  `,
})
export class Rating {
  /** Signal forms mark the field touched on this. */
  readonly touch = output<void>();
}
