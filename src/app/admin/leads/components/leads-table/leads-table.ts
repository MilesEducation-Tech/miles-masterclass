import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronRight } from '@ng-icons/lucide';
import { Button } from '@shared/ui/button/button';
import { Spinner } from '@shared/ui/spinner/spinner';
import { AdminAuth } from '@admin/core/services/admin-auth';
import { PERM } from '@admin/core/models/admin-rbac.model';
import { FirmInquiry, LEAD_STATUSES, LeadStatus } from '@admin/leads/models/firm-inquiry.model';
import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';
import { AriaSelect } from '@shared/ui/aria/aria-select/aria-select';
import { AriaSelectOption } from '@core/models/aria.model';

/** bg/fg CSS-var pair per status for the badge. */
const STATUS_STYLE: Record<LeadStatus, { bg: string; fg: string }> = {
  new: { bg: 'var(--mm-info-bg)', fg: 'var(--mm-info-fg)' },
  contacted: { bg: 'var(--mm-warn-bg)', fg: 'var(--mm-warn-fg)' },
  converted: { bg: 'var(--mm-success-bg)', fg: 'var(--mm-success-fg)' },
  closed: { bg: 'var(--mm-surface-2)', fg: 'var(--mm-fg-3)' },
};

@Component({
  selector: 'app-leads-table',
  imports: [DatePipe, Button, Spinner, NgIcon, AriaInput, AriaSelect],
  providers: [provideIcons({ lucideChevronDown, lucideChevronRight })],
  templateUrl: './leads-table.html',
  styleUrl: './leads-table.css',
  host: { class: 'block w-full' },
})
export class LeadsTable {
  readonly rows = input.required<FirmInquiry[]>();
  readonly isLoading = input<boolean>(false);
  readonly currentPage = input<number>(1);
  readonly pageSize = input<number>(30);
  readonly totalCount = input<number>(0);
  readonly hasNext = input<boolean>(false);
  readonly hasPrev = input<boolean>(false);

  readonly statusChange = output<{ id: number; status: LeadStatus }>();
  readonly notesChange = output<{ id: number; notes: string }>();
  readonly prevPage = output<void>();
  readonly nextPage = output<void>();

  private readonly auth = inject(AdminAuth);

  protected readonly statusOptions: AriaSelectOption<LeadStatus>[] = LEAD_STATUSES.map((s) => ({
    value: s,
    label: s,
  }));
  protected readonly statusStyle = STATUS_STYLE;
  protected readonly canWrite = computed(() => this.auth.hasPermission(PERM.LEADS_WRITE));

  /** Ids of rows whose notes detail panel is open. */
  private readonly expandedIds = signal<ReadonlySet<number>>(new Set());

  protected readonly canPrev = computed(() => this.hasPrev() && !this.isLoading());
  protected readonly canNext = computed(() => this.hasNext() && !this.isLoading());

  protected readonly pageWindow = computed(() => {
    const len = this.rows().length;
    const total = this.totalCount();
    if (len === 0) return { from: 0, to: 0, total };
    const from = (this.currentPage() - 1) * this.pageSize() + 1;
    return { from, to: from + len - 1, total };
  });

  protected helpType(row: FirmInquiry): string {
    return row.help_type.join(', ');
  }

  protected isExpanded(id: number): boolean {
    return this.expandedIds().has(id);
  }

  protected toggleExpand(id: number): void {
    this.expandedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected onStatusChange(id: number, status: LeadStatus | null): void {
    if (status) this.statusChange.emit({ id, status });
  }

  /** `app-aria-input` emits `unknown` — coerce before it reaches the PATCH body. */
  protected onNotesSave(id: number, value: unknown): void {
    this.notesChange.emit({ id, notes: String(value ?? '') });
  }
}
