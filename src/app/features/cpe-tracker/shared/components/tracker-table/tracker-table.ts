import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideAlignLeft,
  lucideCalendar,
  lucideCoins,
  lucideDownload,
  lucideLightbulb,
  lucideLink,
  lucideMonitor,
  lucideSparkles,
} from '@ng-icons/lucide';
import { TrackerTableRow } from '../../mappers/report-to-table';
import { CourseActionResolver } from '../../services/course-action-resolver/course-action-resolver';
import { Button } from '../../../../../shared/components/ui/button/button';
import { Spinner } from '../../../../../shared/components/ui/spinner/spinner';
import { CategoriesList } from '../../../../../shared/components/categories-list/categories-list';
import { DELIVERY_COLORS, FIELD_COLORS } from '../../constants/cpe-tracker.constants';

const ROW_ACCENT_SERIES: readonly string[] = [
  FIELD_COLORS.Accounting,
  FIELD_COLORS.Ethics,
  FIELD_COLORS.Others,
];

const ACTION_BUTTON_CLASS = 'min-w-[120px] gap-2 text-xs font-medium h-9 rounded-md px-4';

const BUTTON_THEME: Record<string, string> = {
  registered: `${ACTION_BUTTON_CLASS} bg-neutral-300 text-neutral-900 hover:bg-neutral-200`,
  resume: `${ACTION_BUTTON_CLASS} bg-white text-neutral-900 hover:bg-gray-100`,
  feedback: `${ACTION_BUTTON_CLASS} bg-amber-400 text-neutral-900 hover:bg-amber-300`,
  exam: `${ACTION_BUTTON_CLASS} bg-sky-400 text-white hover:bg-sky-300`,
  retake: `${ACTION_BUTTON_CLASS} bg-sky-400 text-white hover:bg-sky-300`,
  download: `${ACTION_BUTTON_CLASS} bg-white text-black hover:bg-white/90`,
  'view-details': `${ACTION_BUTTON_CLASS} bg-white/10 text-white hover:bg-white/20`,
  none: `${ACTION_BUTTON_CLASS} bg-transparent text-neutral-400`,
};

@Component({
  selector: 'app-tracker-table',
  imports: [DecimalPipe, DatePipe, Button, Spinner, NgIcon, CategoriesList],
  providers: [
    provideIcons({
      lucideCalendar,
      lucideAlignLeft,
      lucideSparkles,
      lucideMonitor,
      lucideLightbulb,
      lucideCoins,
      lucideLink,
      lucideDownload,
    }),
  ],
  templateUrl: './tracker-table.html',
  styleUrl: './tracker-table.css',
  host: { class: 'block w-full' },
})
export class TrackerTable {
  protected readonly actionResolver = inject(CourseActionResolver);

  readonly rows = input.required<TrackerTableRow[]>();
  readonly isLoading = input<boolean>(false);
  /**
   * Whether a row title links to its course.
   *
   * `false` for CAIRA badge rows: #23 carries no course id, so there is nothing
   * to navigate to and a link that does nothing is worse than plain text.
   */
  readonly titleNavigable = input<boolean>(true);
  readonly currentPage = input<number>(1);
  readonly totalPages = input<number>(1);
  readonly pageWindow = input<{ from: number; to: number; total: number }>({
    from: 0,
    to: 0,
    total: 0,
  });

  readonly rowAction = output<TrackerTableRow>();
  readonly titleClick = output<TrackerTableRow>();
  readonly prevPage = output<void>();
  readonly nextPage = output<void>();

  protected readonly canPrev = computed(() => this.currentPage() > 1);
  protected readonly canNext = computed(() => this.currentPage() < this.totalPages());

  protected onAction(row: TrackerTableRow): void {
    this.rowAction.emit(row);
  }

  protected onTitleClick(row: TrackerTableRow): void {
    if (row.id == null) return;
    this.titleClick.emit(row);
  }

  protected accentColor(row: TrackerTableRow, index: number): string {
    const field = row.fieldsOfStudy[0]?.name?.toLowerCase() ?? '';
    if (field.includes('account')) return FIELD_COLORS.Accounting;
    if (field.includes('ethic')) return FIELD_COLORS.Ethics;
    if (field) return FIELD_COLORS.Others;
    return ROW_ACCENT_SERIES[index % ROW_ACCENT_SERIES.length];
  }

  protected deliveryColor(method: string): string {
    return DELIVERY_COLORS[method as keyof typeof DELIVERY_COLORS] ?? DELIVERY_COLORS.default;
  }

  protected buttonTheme(kind: string): string {
    return BUTTON_THEME[kind] ?? BUTTON_THEME['none'];
  }
}
