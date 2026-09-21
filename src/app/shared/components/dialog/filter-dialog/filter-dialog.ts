import { Component, computed, OnInit, signal } from '@angular/core';
import { DialogRef } from '../../../core/services/dialog/dialog';
import { Button } from '../../ui/button/button';

@Component({
  selector: 'app-filter-dialog',
  imports: [Button],
  templateUrl: './filter-dialog.html',
  styleUrl: './filter-dialog.css',
})
export class FilterDialog implements OnInit {
  dialogRef!: DialogRef<FilterDialog>;
  data!: Record<string, any[]>;

  // Mapping for display labels. Covers both client-side keys (topics, experts,
  // cpe_credits, completion_date) and server-driven keys returned by
  // `GET /v2/filters/` (instructors, categories, fields_of_study, …).
  private labelMap: Record<string, string> = {
    // Client-side extraction keys
    topics: 'Field of Study',
    experts: 'Instructor',
    cpe_credits: 'Credit',
    completion_date: 'Completion Date',
    // API-driven groups
    instructors: 'Instructor',
    categories: 'Category',
    fields_of_study: 'Field of Study',
    additional_categories: 'Additional Category',
    caira_levels: 'CAIRA Level',
  };

  // Local state for filters
  filters = signal<Record<string, any[]>>({});

  ngOnInit(): void {
    // Deep copy initial data to avoid mutating parent state directly before apply
    this.filters.set(JSON.parse(JSON.stringify(this.data || {})));
  }

  filterKeys = computed(() => Object.keys(this.filters()));

  getLabel(key: string): string {
    return this.labelMap[key] || key.replace(/_/g, ' ');
  }

  toggleOption(category: string, optionId: string | number): void {
    this.filters.update((current) => {
      const updatedCategory = current[category].map((item: any) => {
        if (item.id === optionId) {
          return { ...item, selected: !item.selected };
        }
        return item;
      });
      return { ...current, [category]: updatedCategory };
    });
  }

  // Check if an option is selected
  isSelected(category: string, optionId: string | number): boolean {
    return this.filters()[category]?.find((item: any) => item.id === optionId)?.selected || false;
  }

  clearFilters(): void {
    const resetFilters: any = {};
    const current = this.filters();
    Object.keys(current).forEach((key) => {
      resetFilters[key] = current[key].map((item: any) => ({ ...item, selected: false }));
    });
    this.filters.set(resetFilters);
    this.dialogRef.close(resetFilters);
  }

  apply(): void {
    this.dialogRef.close(this.filters());
  }

  close(): void {
    this.dialogRef.close();
  }
}
