import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronRight } from '@ng-icons/lucide';
import { Button } from '../../../../../shared/components/ui/button/button';
import { Spinner } from '../../../../../shared/components/ui/spinner/spinner';
import { AdminAuth } from '../../../../../shared/core/services/admin-auth/admin-auth';
import { PERM } from '../../../../../shared/core/models/admin/admin-rbac.model';
import { FirmInquiry, LEAD_STATUSES, LeadStatus } from '../../models/firm-inquiry.model';

/** bg/fg CSS-var pair per status for the badge. */
const STATUS_STYLE: Record<LeadStatus, { bg: string; fg: string }> = {
  new: { bg: 'var(--mm-info-bg)', fg: 'var(--mm-info-fg)' },
  contacted: { bg: 'var(--mm-warn-bg)', fg: 'var(--mm-warn-fg)' },
  converted: { bg: 'var(--mm-success-bg)', fg: 'var(--mm-success-fg)' },
  closed: { bg: 'var(--mm-surface-2)', fg: 'var(--mm-fg-3)' },
};

@Component({
  selector: 'app-leads-table',
  imports: [DatePipe, Button, Spinner, NgIcon],
  providers: [provideIcons({ lucideChevronDown, lucideChevronRight })],
  templateUrl: './leads-table.html',
  styleUrl: './leads-table.css',
  host: { class: 'block w-full' },
})
export class LeadsTable {
  readonly rows = input.required<FirmInquiry[]>();
  readonly isLoading = input<boolean>(false);
  readonly currentPage = input<number>(1);
  readonly pageSize = input<number>(25);
  readonly totalCount = input<number>(0);
  readonly hasNext = input<boolean>(false);
  readonly hasPrev = input<boolean>(false);

  readonly statusChange = output<{ id: string; status: LeadStatus }>();
  readonly prevPage = output<void>();
  readonly nextPage = output<void>();

  private readonly auth = inject(AdminAuth);

  protected readonly statuses = LEAD_STATUSES;
  protected readonly statusStyle = STATUS_STYLE;
  protected readonly canWrite = computed(() => this.auth.hasPermission(PERM.LEADS_WRITE));

  /** Ids of rows whose notes detail panel is open. */
  private readonly expandedIds = signal<ReadonlySet<string>>(new Set());

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
    return (row.help_type ?? []).join(', ');
  }

  protected isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  protected toggleExpand(id: string): void {
    this.expandedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected onStatusChange(id: string, event: Event): void {
    this.statusChange.emit({ id, status: (event.target as HTMLSelectElement).value as LeadStatus });
  }
}
