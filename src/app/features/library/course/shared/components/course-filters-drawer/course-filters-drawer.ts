import { Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';
import { DialogRef } from '../../../../../../shared/core/services/dialog/dialog';
import { CourseFilters } from '../course-filters/course-filters';

export interface CourseFiltersDrawerData {
  /** Reactive accessors so the drawer reflects upstream state without a copy. */
  groups: () => readonly any[];
  selection: () => any;
  onChange: (next: any) => void;
  onClear: () => void;
}

/**
 * Mobile/right-drawer host for `<app-course-filters>`. Wires a header with a
 * close button and a sticky "Done" CTA so the panel reads like a proper sheet.
 */
@Component({
  selector: 'app-course-filters-drawer',
  imports: [CourseFilters, NgIcon],
  providers: [provideIcons({ heroXMark })],
  templateUrl: './course-filters-drawer.html',
  styleUrl: './course-filters-drawer.css',
})
export class CourseFiltersDrawer {
  // Assigned by the `Dialog` service after `createComponent` (see dialog.ts:227-229).
  dialogRef!: DialogRef<CourseFiltersDrawer>;
  data!: CourseFiltersDrawerData;

  close() {
    this.dialogRef.close();
  }

  onSelectionChange(next: any) {
    this.data.onChange(next);
  }

  onClear() {
    this.data.onClear();
  }
}
