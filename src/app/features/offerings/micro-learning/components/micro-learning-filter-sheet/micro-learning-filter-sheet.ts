import { Component, computed, OnInit, signal } from '@angular/core';
import { injectDialogRef } from 'ng-primitives/dialog';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';
import { Button } from '@shared/ui/button/button';
import { cn } from '@shared/utils/cn';
import { MicroLearningFilterOption } from '@features/offerings/models/micro-learning-course.model';

export interface MicroLearningFilterSheetData {
  title: string;
  options: MicroLearningFilterOption[];
  visibleCount?: number;
}

export type MicroLearningFilterSheetResult = MicroLearningFilterOption[] | undefined;

const DEFAULT_VISIBLE_COUNT = 5;

@Component({
  selector: 'app-micro-learning-filter-sheet',
  imports: [Button, DialogShell],
  templateUrl: './micro-learning-filter-sheet.html',
  host: { class: 'block' },
})
export class MicroLearningFilterSheet implements OnInit {
  private readonly dialogRef = injectDialogRef<
    MicroLearningFilterSheetData,
    MicroLearningFilterSheetResult
  >();
  protected readonly data = this.dialogRef.data;

  readonly cn = cn;
  readonly options = signal<MicroLearningFilterOption[]>([]);
  readonly showAll = signal<boolean>(false);

  readonly visibleOptions = computed<MicroLearningFilterOption[]>(() => {
    const all = this.options();
    const limit = this.data?.visibleCount ?? DEFAULT_VISIBLE_COUNT;
    return this.showAll() ? all : all.slice(0, limit);
  });

  readonly hasMore = computed<boolean>(() => {
    const limit = this.data?.visibleCount ?? DEFAULT_VISIBLE_COUNT;
    return !this.showAll() && this.options().length > limit;
  });

  ngOnInit(): void {
    this.options.set(this.data.options.map((option) => ({ ...option })));
  }

  toggle(id: string): void {
    this.options.update((current) =>
      current.map((option) =>
        option.id === id ? { ...option, selected: !option.selected } : option,
      ),
    );
  }

  showMore(): void {
    this.showAll.set(true);
  }

  back(): void {
    this.dialogRef.close();
  }

  apply(): void {
    this.dialogRef.close(this.options());
  }
}
