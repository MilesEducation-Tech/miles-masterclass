import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMagnifyingGlass } from '@ng-icons/heroicons/outline';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { InstructorCard } from '@shared/components/cards/instructor-card/instructor-card';
import { InstructorListItem } from '@core/models/library.model';
import { Utils } from '@core/services/utils/utils';
import { InstructorFacade } from './shared/services/instructor-facade/instructor-facade';
import { PartnerContentList } from '@features/partners/shared/components/partner-content-list/partner-content-list';

@Component({
  selector: 'app-instructor',
  imports: [InstructorCard, NgIcon, PartnerContentList],
  providers: [provideIcons({ heroMagnifyingGlass })],
  templateUrl: './instructor.html',
  styleUrl: './instructor.css',
})
export class Instructor {
  readonly facade = inject(InstructorFacade);
  private readonly utils = inject(Utils);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Raw value driven by the search input (no debounce). */
  readonly searchInput = signal('');

  readonly sentinel = viewChild<ElementRef<HTMLDivElement>>('sentinel');

  constructor() {
    // IntersectionObserver pagination.
    effect((onCleanup) => {
      const el = this.sentinel()?.nativeElement;
      if (!el || !this.isBrowser) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            this.facade.loadNextInstructorPage();
          }
        },
        { rootMargin: '300px' },
      );
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });

    // Debounce keystrokes before they reach the facade. `distinctUntilChanged`
    // skips re-fires when the trimmed value hasn't actually changed (e.g. user
    // toggles spaces). The facade resets pagination + clears items on each
    // search change, so this keeps the request volume sane while typing.
    toObservable(this.searchInput)
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.facade.setSearchKey(value));
  }

  onSearchInput(event: Event) {
    this.searchInput.set((event.target as HTMLInputElement).value);
  }

  clearSearch() {
    this.searchInput.set('');
  }

  onInstructorClick(i: InstructorListItem) {
    const slug = this.utils.slugify(`${i?.first_name} ${i?.last_name}`);
    const basePath = `/${this.utils.getRouteParams().country}/${this.utils.getRouteParams().profession}`;
    this.router.navigate([`${basePath}/instructor`, i.id, slug]);
  }
}
