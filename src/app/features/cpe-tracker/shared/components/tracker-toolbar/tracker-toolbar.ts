import { DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideDownload } from '@ng-icons/lucide';
import {
  CreditsSummary,
  StudyModeFilter,
} from '../../../../../shared/core/models/cpe-tracker.model';
import { Button } from '../../../../../shared/components/ui/button/button';

@Component({
  selector: 'app-tracker-toolbar',
  imports: [DecimalPipe, Button, NgIcon],
  providers: [provideIcons({ lucideChevronDown, lucideDownload })],
  templateUrl: './tracker-toolbar.html',
  styleUrl: './tracker-toolbar.css',
  host: { class: 'block w-full' },
})
export class TrackerToolbar {
  readonly selectedYear = input.required<number>();
  readonly yearOptions = input.required<number[]>();
  readonly credits = input<CreditsSummary | null>(null);
  readonly studyFilter = input.required<StudyModeFilter>();

  readonly yearChange = output<number>();
  readonly studyFilterChange = output<StudyModeFilter>();
  readonly openCompliance = output<void>();
  readonly downloadNasba = output<void>();
  readonly downloadAll = output<void>();

  protected readonly studyFilterOptions: StudyModeFilter[] = [
    'All',
    'Accounting',
    'Ethics',
    'Others',
  ];

  protected onYear(event: Event): void {
    this.yearChange.emit(Number((event.target as HTMLSelectElement).value));
  }

  protected onStudyFilter(event: Event): void {
    this.studyFilterChange.emit((event.target as HTMLSelectElement).value as StudyModeFilter);
  }
}
