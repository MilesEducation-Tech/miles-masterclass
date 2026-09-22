import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideAlignLeft,
  lucideCalendar,
  lucideCoins,
  lucideDownload,
  lucideLink,
  lucideMonitor,
  lucideSparkles,
} from '@ng-icons/lucide';
import {
  CPE_ACTION_UI,
  CpeCreditWire,
  CpeRowAction,
  cpeRowActions,
  DELIVERY_METHOD,
} from '@core/models/cpe-credit.model';
import { FieldOfStudy } from '@core/models/course.model';
import { Button } from '@shared/components/ui/button/button';
import { CategoriesList } from '@shared/components/categories-list/categories-list';
import { Spinner } from '@shared/components/ui/spinner/spinner';
import { cn } from '@shared/utils/cn';
import { DELIVERY_COLORS, FIELD_COLORS } from '../../constants/cpe-tracker.constants';

const ACTION_BUTTON_CLASS = 'min-w-[120px] gap-2 text-xs font-medium h-9 rounded-md px-4';

/** Row accent by leading field of study — the same three buckets the compliance gauge uses. */
function fieldAccent(fields: FieldOfStudy[]): string {
  const name = fields[0]?.name.toLowerCase() ?? '';
  if (name.includes('account')) return FIELD_COLORS.Accounting;
  if (name.includes('ethic')) return FIELD_COLORS.Ethics;
  return FIELD_COLORS.Others;
}

export interface TrackerRowView {
  raw: CpeCreditWire;
  accent: string;
  deliveryMethod: string;
  deliveryColor: string;
  actions: CpeRowAction[];
}

/**
 * The earned-credits report grid. Six columns, matching Figma `51200-36347` —
 * v1's "CAIRA Level" column is gone with the rest of the CAIRA surface, which
 * now lives on `/caira-tracker`.
 *
 * Purely presentational: it takes wire rows and emits intents. Deriving the row
 * view-model here rather than in the template keeps the markup free of function
 * calls per cell.
 */
@Component({
  selector: 'app-tracker-table',
  imports: [DecimalPipe, DatePipe, Button, CategoriesList, Spinner, NgIcon],
  providers: [
    provideIcons({
      lucideCalendar,
      lucideAlignLeft,
      lucideSparkles,
      lucideMonitor,
      lucideCoins,
      lucideLink,
      lucideDownload,
    }),
  ],
  templateUrl: './tracker-table.html',
  styleUrl: './tracker-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full' },
})
export class TrackerTable {
  readonly rows = input.required<CpeCreditWire[]>();
  readonly isLoading = input<boolean>(false);
  readonly currentPage = input<number>(1);
  readonly totalPages = input<number>(1);
  readonly pageWindow = input<{ from: number; to: number; total: number }>({
    from: 0,
    to: 0,
    total: 0,
  });

  readonly rowAction = output<{ row: CpeCreditWire; action: CpeRowAction }>();
  readonly titleClick = output<CpeCreditWire>();
  readonly prevPage = output<void>();
  readonly nextPage = output<void>();

  protected readonly actionUi = CPE_ACTION_UI;

  protected readonly viewRows = computed<TrackerRowView[]>(() =>
    this.rows().map((raw) => {
      const deliveryMethod = DELIVERY_METHOD[raw.course.course_type] ?? '—';
      return {
        raw,
        accent: fieldAccent(raw.course.fields_of_study),
        deliveryMethod,
        deliveryColor:
          DELIVERY_COLORS[deliveryMethod as keyof typeof DELIVERY_COLORS] ??
          DELIVERY_COLORS.default,
        actions: cpeRowActions(raw),
      };
    }),
  );

  protected readonly canPrev = computed(() => this.currentPage() > 1);
  protected readonly canNext = computed(() => this.currentPage() < this.totalPages());

  protected actionClass(action: CpeRowAction): string {
    return cn(ACTION_BUTTON_CLASS, CPE_ACTION_UI[action].theme);
  }

  protected onAction(row: CpeCreditWire, action: CpeRowAction): void {
    this.rowAction.emit({ row, action });
  }
}
