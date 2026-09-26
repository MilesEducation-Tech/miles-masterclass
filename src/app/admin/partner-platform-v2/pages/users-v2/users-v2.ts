import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, take } from 'rxjs';
import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';
import { Button } from '@shared/ui/button/button';
// Type-only: dialog components below load with `import()` when opened (PROMPT.md §4.4).
import type {
  BlockStatusDialogData,
  BlockStatusDialogResult,
} from '@shared/dialogs/block-status-dialog/block-status-dialog';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { BlockedStatusFilter, PartnerPanelUser } from '@admin/core/models/partner-platform.model';
import { PartnerAdminMe } from '@admin/core/services/partner-admin-me';
import { PartnerUsersFacade } from '@admin/users/services/partner-users-facade';
import { UsersTable } from '@admin/users/components/users-table/users-table';
import { TabStrip } from '@shared/ui/tab-strip/tab-strip';

const STATUS_TABS: { value: BlockedStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'blocked', label: 'Blocked' },
];

/**
 * Partner Platform v2 — Users (`/admin/partner-v2/users`). The learners who
 * redeemed a seat under the calling admin's network or firm, from
 * `GET /panel/users/`. Blocking needs `user:block`; the CSV export shares the
 * report-read gate.
 */
@Component({
  selector: 'app-users-v2',
  imports: [AriaInput, Button, UsersTable, TabStrip],
  templateUrl: './users-v2.html',
  host: { class: 'block w-full' },
})
export class UsersV2 {
  protected readonly facade = inject(PartnerUsersFacade);
  protected readonly me = inject(PartnerAdminMe);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusTabs = STATUS_TABS;
  /** Raw search input — debounced before reaching the facade. */
  protected readonly searchInput = signal('');

  /** Django capabilities gate these server-side — mirror them in the UI. */
  protected readonly canBlock = computed(() => this.me.can('user:block'));
  protected readonly canExport = computed(() => this.me.canReadReports());

  protected readonly hasNextPage = computed(() => this.facade.hasNext());
  protected readonly hasPrevPage = computed(() => this.facade.hasPrev());
  protected readonly currentPage = computed(() => this.facade.pagination().current_page_number);
  protected readonly totalCount = computed(() => this.facade.totalCount());

  constructor() {
    toObservable(this.searchInput)
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.facade.setSearch(value));
  }

  protected exportCsv(): void {
    void this.facade.exportCsv();
  }

  /** app-tab-strip speaks labels; map them back to the filter values. */
  protected readonly tabLabels = STATUS_TABS.map((t) => t.label);
  protected readonly activeTabLabel = computed(
    () => STATUS_TABS.find((t) => this.isActiveTab(t.value))?.label ?? null,
  );
  protected onTabChange(label: string): void {
    const tab = STATUS_TABS.find((t) => t.label === label);
    if (tab) this.selectStatus(tab.value);
  }

  protected isActiveTab(value: BlockedStatusFilter): boolean {
    return this.facade.blockedStatus() === value;
  }

  protected selectStatus(value: BlockedStatusFilter): void {
    this.facade.setBlockedStatus(value);
  }

  protected goPrev(): void {
    this.facade.setPage(this.facade.pagination().previous_page ?? this.currentPage() - 1);
  }

  protected goNext(): void {
    this.facade.setPage(this.facade.pagination().next_page ?? this.currentPage() + 1);
  }

  protected async onBlockToggle(user: PartnerPanelUser): Promise<void> {
    const action: BlockStatusDialogData['action'] = user.is_blocked ? 'unblock' : 'block';

    const { BlockStatusDialog } =
      await import('@shared/dialogs/block-status-dialog/block-status-dialog');
    const ref = this.dialogs.open<BlockStatusDialogData, BlockStatusDialogResult>(
      BlockStatusDialog,
      {
        data: {
          action,
          userName: user.name,
          userEmail: user.email,
        } satisfies BlockStatusDialogData,
      },
    );

    ref.afterClosed.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe(async (result) => {
      if (!result?.confirmed) return;
      await this.facade.setBlockStatus(user, action === 'block', result.reason);
    });
  }
}
