import { Component, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMagnifyingGlass } from '@ng-icons/heroicons/outline';
import { PartnerContentList } from '@shared/components/partner-content-list/partner-content-list';

/**
 * `/library/instructor-library`. The retired `instructor/` read is gone; the
 * list is bound to `all-instructors-page/` next (MIL-95), so until then the
 * page shows its heading, the search box and the empty state.
 */
@Component({
  selector: 'app-instructor',
  imports: [NgIcon, PartnerContentList],
  providers: [provideIcons({ heroMagnifyingGlass })],
  templateUrl: './instructor.html',
})
export class Instructor {
  /** Raw value driven by the search input (no debounce). */
  protected readonly searchInput = signal('');

  protected onSearchInput(event: Event): void {
    this.searchInput.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.searchInput.set('');
  }
}
