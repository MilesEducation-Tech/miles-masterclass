import { Component, computed, OnInit, signal } from '@angular/core';
import { DialogRef } from '@core/services/dialog/dialog';
import { Button } from '@shared/components/ui/button/button';
import { cn } from '@shared/utils/cn';
import { MicroLearningFilterOption } from '@core/models/micro-learning-course.model';

export interface MicroLearningFilterSheetData {
  title: string;
  options: MicroLearningFilterOption[];
  visibleCount?: number;
}

export type MicroLearningFilterSheetResult = MicroLearningFilterOption[] | undefined;

const DEFAULT_VISIBLE_COUNT = 5;

@Component({
  selector: 'app-micro-learning-filter-sheet',
  imports: [Button],
  templateUrl: './micro-learning-filter-sheet.html',
  styleUrl: './micro-learning-filter-sheet.css',
})
export class MicroLearningFilterSheet implements OnInit {
  dialogRef!: DialogRef<MicroLearningFilterSheet, MicroLearningFilterSheetResult>;
  data!: MicroLearningFilterSheetData;

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
