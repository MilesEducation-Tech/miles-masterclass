import {
  AccordionContent,
  AccordionGroup,
  AccordionPanel,
  AccordionTrigger,
} from '@angular/aria/accordion';
import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronDown } from '@ng-icons/heroicons/outline';
import { CheckboxList } from '../../../../../../shared/components/ui/checkbox-list/checkbox-list';

@Component({
  selector: 'app-course-filters',
  imports: [
    AccordionGroup,
    AccordionTrigger,
    AccordionPanel,
    AccordionContent,
    CheckboxList,
    NgIcon,
  ],
  providers: [provideIcons({ heroChevronDown })],
  templateUrl: './course-filters.html',
  styleUrl: './course-filters.css',
})
export class CourseFilters {
  readonly groups = input.required<readonly any[]>();
  readonly selection = input.required<any>();
  readonly selectionChange = output<any>();
  readonly clear = output<void>();

  readonly hasActiveFilters = computed(() => {
    const sel = this.selection();
    return (Object.keys(sel) as any[]).some((k) => sel[k].length > 0);
  });

  selectedFor(key: any): readonly (string | number)[] {
    return this.selection()[key];
  }

  update(key: any, values: readonly (string | number)[]) {
    this.selectionChange.emit({ ...this.selection(), [key]: values });
  }

  onClear() {
    this.clear.emit();
  }
}
