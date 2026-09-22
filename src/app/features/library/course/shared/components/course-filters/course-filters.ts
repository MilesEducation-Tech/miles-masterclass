import {
  NgpAccordion,
  NgpAccordionContent,
  NgpAccordionItem,
  NgpAccordionTrigger,
} from 'ng-primitives/accordion';
import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronDown } from '@ng-icons/heroicons/outline';
import { CheckboxList } from '../../../../../../shared/components/ui/checkbox-list/checkbox-list';
import {
  CourseFilterGroup,
  CourseFilterKey,
  CourseFilterSelection,
} from '../../../../../../shared/core/models/library-filters.model';

@Component({
  selector: 'app-course-filters',
  imports: [
    NgpAccordion,
    NgpAccordionItem,
    NgpAccordionTrigger,
    NgpAccordionContent,
    CheckboxList,
    NgIcon,
  ],
  providers: [provideIcons({ heroChevronDown })],
  templateUrl: './course-filters.html',
  styleUrl: './course-filters.css',
})
export class CourseFilters {
  readonly groups = input.required<readonly CourseFilterGroup[]>();
  readonly selection = input.required<CourseFilterSelection>();
  readonly selectionChange = output<CourseFilterSelection>();
  readonly clear = output<void>();

  readonly hasActiveFilters = computed(() => {
    const sel = this.selection();
    return (Object.keys(sel) as CourseFilterKey[]).some((k) => sel[k].length > 0);
  });

  selectedFor(key: CourseFilterKey): readonly (string | number)[] {
    return this.selection()[key];
  }

  update(key: CourseFilterKey, values: readonly (string | number)[]) {
    this.selectionChange.emit({ ...this.selection(), [key]: values });
  }

  onClear() {
    this.clear.emit();
  }
}
