import {
  NgpAccordion,
  NgpAccordionContent,
  NgpAccordionItem,
  NgpAccordionTrigger,
} from 'ng-primitives/accordion';
import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroCheck, heroChevronDown } from '@ng-icons/heroicons/outline';
import { NgpListbox, NgpListboxOption } from 'ng-primitives/listbox';

import {
  LibraryFilterGroup,
  LibraryFilterKey,
  LibraryFilterSelection,
} from '@features/library/course/models/course-library.model';

@Component({
  selector: 'app-course-filters',
  imports: [
    NgpAccordion,
    NgpAccordionItem,
    NgpAccordionTrigger,
    NgpAccordionContent,
    NgpListbox,
    NgpListboxOption,
    NgIcon,
  ],
  providers: [provideIcons({ heroCheck, heroChevronDown })],
  templateUrl: './course-filters.html',
})
export class CourseFilters {
  readonly groups = input.required<readonly LibraryFilterGroup[]>();
  readonly selection = input.required<LibraryFilterSelection>();
  readonly selectionChange = output<LibraryFilterSelection>();
  readonly clear = output<void>();

  readonly hasActiveFilters = computed(() => {
    const sel = this.selection();
    return Object.values(sel).some((values) => values.length > 0);
  });

  /** A fresh copy: the listbox primitive takes a mutable array. */
  selectedFor(key: LibraryFilterKey): string[] {
    return [...this.selection()[key]];
  }

  update(key: LibraryFilterKey, values: readonly string[]) {
    this.selectionChange.emit({ ...this.selection(), [key]: values });
  }

  onClear() {
    this.clear.emit();
  }
}
