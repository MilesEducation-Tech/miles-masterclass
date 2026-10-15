import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  effect,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMagnifyingGlass } from '@ng-icons/heroicons/outline';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PartnerContentList } from '@shared/components/partner-content-list/partner-content-list';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { InstructorCard } from '@features/library/instructor/components/instructor-card/instructor-card';
import { InstructorFacade } from '@features/library/instructor/services/instructor-facade';

@Component({
  selector: 'app-instructor',
  imports: [InstructorCard, ErrorState, NgIcon, PartnerContentList],
  providers: [provideIcons({ heroMagnifyingGlass })],
  templateUrl: './instructor.html',
})
export class Instructor {
  protected readonly facade = inject(InstructorFacade);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Raw value of the search box (no debounce). Seeded from the facade, which
   * outlives the page, so coming Back shows the term the list is filtered by.
   */
  protected readonly searchInput = signal(this.facade.search());

  private readonly sentinel = viewChild<ElementRef<HTMLDivElement>>('sentinel');

  constructor() {
    // IntersectionObserver pagination, as the course library. The sentinel is
    // re-rendered after every page, and observing a fresh element reports its
    // state at once, so a short page that leaves it in view still loads the next.
    effect((onCleanup) => {
      const el = this.sentinel()?.nativeElement;
      if (!el || !this.isBrowser) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            this.facade.loadNextPage();
          }
        },
        { rootMargin: '300px' },
      );
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });

    // Debounce keystrokes before they reach the facade, which starts the list
    // over from page 1 on every new term.
    toObservable(this.searchInput)
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => this.facade.setSearch(value));
  }

  protected onSearchInput(event: Event): void {
    this.searchInput.set((event.target as HTMLInputElement).value);
  }

  /** Clears at once, without waiting out the debounce. */
  protected clearSearch(): void {
    this.searchInput.set('');
    this.facade.setSearch('');
  }
}
