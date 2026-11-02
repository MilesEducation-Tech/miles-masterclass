import { Component } from '@angular/core';
import { injectDialogRef } from 'ng-primitives/dialog';

import {
  LibraryFilterGroup,
  LibraryFilterSelection,
} from '@features/library/course/models/course-library.model';
import { CourseFilters } from '@features/library/course/components/course-filters/course-filters';
import { Button } from '@shared/ui/button/button';
import { Dialog } from '@shared/ui/dialog/dialog';

export interface CourseFiltersDrawerData {
  /** Reactive accessors so the drawer reflects upstream state without a copy. */
  groups: () => readonly LibraryFilterGroup[];
  selection: () => LibraryFilterSelection;
  onChange: (next: LibraryFilterSelection) => void;
  onClear: () => void;
}

/**
 * Mobile/right-drawer host for `<app-course-filters>`. Wires a header with a
 * close button and a sticky "Done" CTA so the panel reads like a proper sheet.
 */
@Component({
  selector: 'app-course-filters-drawer',
  imports: [CourseFilters, Button, Dialog],
  templateUrl: './course-filters-drawer.html',
})
export class CourseFiltersDrawer {
  // Assigned by the `Dialog` service after `createComponent` (see dialog.ts:227-229).
  private readonly dialogRef = injectDialogRef<CourseFiltersDrawerData>();
  protected readonly data = this.dialogRef.data;

  close() {
    this.dialogRef.close();
  }

  onSelectionChange(next: LibraryFilterSelection) {
    this.data.onChange(next);
  }

  onClear() {
    this.data.onClear();
  }
}
