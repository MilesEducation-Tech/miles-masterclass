import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroChevronDoubleLeft,
  heroChevronDoubleRight,
  heroChevronLeft,
  heroChevronRight,
} from '@ng-icons/heroicons/outline';
import {
  injectPaginationState,
  NgpPagination,
  NgpPaginationButton,
  NgpPaginationFirst,
  NgpPaginationLast,
  NgpPaginationNext,
  NgpPaginationPrevious,
} from 'ng-primitives/pagination';

const BUTTON =
  'inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-sm text-foreground outline-none data-hover:bg-muted data-press:bg-secondary data-selected:bg-primary data-selected:text-primary-foreground data-focus-visible:outline-2 data-focus-visible:outline-solid data-focus-visible:outline-offset-2 data-focus-visible:outline-ring data-disabled:cursor-not-allowed data-disabled:opacity-50';

/**
 * Page navigation driven by `page` / `pageChange`; not a form control. The primitive makes the
 * host a `navigation` landmark, so `ariaLabel` names it (two on a page must differ).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-pagination',
  hostDirectives: [
    {
      directive: NgpPagination,
      inputs: [
        'ngpPaginationPage:page',
        'ngpPaginationPageCount:pageCount',
        'ngpPaginationDisabled:disabled',
      ],
      outputs: ['ngpPaginationPageChange:pageChange'],
    },
  ],
  imports: [
    NgpPaginationButton,
    NgpPaginationFirst,
    NgpPaginationLast,
    NgpPaginationNext,
    NgpPaginationPrevious,
    NgIcon,
  ],
  providers: [
    provideIcons({
      heroChevronDoubleLeft,
      heroChevronDoubleRight,
      heroChevronLeft,
      heroChevronRight,
    }),
  ],
  host: { class: 'block', '[attr.aria-label]': 'ariaLabel()' },
  template: `
    <ul class="flex items-center gap-1">
      <li>
        <button ngpPaginationFirst type="button" [class]="buttonClass" aria-label="First page">
          <ng-icon name="heroChevronDoubleLeft" class="rtl:-scale-x-100" aria-hidden="true" />
        </button>
      </li>

      <li>
        <button
          ngpPaginationPrevious
          type="button"
          [class]="buttonClass"
          aria-label="Previous page"
        >
          <ng-icon name="heroChevronLeft" class="rtl:-scale-x-100" aria-hidden="true" />
        </button>
      </li>

      @for (page of pages(); track page) {
        <li>
          <button
            ngpPaginationButton
            type="button"
            [ngpPaginationButtonPage]="page"
            [class]="buttonClass"
            [attr.aria-label]="'Page ' + page"
          >
            {{ page }}
          </button>
        </li>
      }

      <li>
        <button ngpPaginationNext type="button" [class]="buttonClass" aria-label="Next page">
          <ng-icon name="heroChevronRight" class="rtl:-scale-x-100" aria-hidden="true" />
        </button>
      </li>

      <li>
        <button ngpPaginationLast type="button" [class]="buttonClass" aria-label="Last page">
          <ng-icon name="heroChevronDoubleRight" class="rtl:-scale-x-100" aria-hidden="true" />
        </button>
      </li>
    </ul>
  `,
})
export class Pagination {
  /** The landmark's accessible name. */
  readonly ariaLabel = input('Pagination');

  /** Access the pagination state */
  protected readonly state = injectPaginationState();

  /** Get the pages as an array we can iterate over */
  protected readonly pages = computed(() =>
    Array.from({ length: this.state().pageCount() }).map((_, i) => i + 1),
  );

  protected readonly buttonClass = BUTTON;
}
