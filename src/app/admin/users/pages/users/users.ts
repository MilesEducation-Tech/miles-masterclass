import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, take } from 'rxjs';
import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';
import { Button } from '@shared/ui/button/button';
import { NgpDialogManager } from 'ng-primitives/dialog';
import {
  BlockStatusDialog,
  BlockStatusDialogData,
  BlockStatusDialogResult,
} from '@shared/dialogs/block-status-dialog/block-status-dialog';
import { DeprecationBanner } from '@shared/components/deprecation-banner/deprecation-banner';
import { UsersTable } from '@admin/users/components/users-table/users-table';
import { PartnerAdminMe } from '@admin/core/services/partner-admin-me';
import { PartnerUsersFacade } from '@admin/users/services/partner-users-facade';
import { BlockedStatusFilter, PartnerPanelUser } from '@admin/core/models/partner-platform.model';

const STATUS_TABS: { value: BlockedStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'blocked', label: 'Blocked' },
];

@Component({
  selector: 'app-admin-users',
  imports: [AriaInput, Button, UsersTable, DeprecationBanner],
  templateUrl: './users.html',
  styleUrl: './users.css',
  host: { class: 'block w-full' },
})
export class Users {
  protected readonly facade = inject(PartnerUsersFacade);
  private readonly me = inject(PartnerAdminMe);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly destroyRef = inject(DestroyRef);

  /** Django capabilities gate these server-side — mirror them in the UI. */
  protected readonly canBlock = computed(() => this.me.can('user:block'));
  protected readonly canExport = computed(() => this.me.canReadReports());

  protected readonly statusTabs = STATUS_TABS;
  /** Raw search input — debounced before reaching the facade. */
  protected readonly searchInput = signal('');

  protected readonly hasNextPage = computed(() => this.facade.hasNext());
  protected readonly hasPrevPage = computed(() => this.facade.hasPrev());
  protected readonly currentPage = computed(() => this.facade.pagination().current_page_number);
  protected readonly totalCount = computed(() => this.facade.totalCount());

  constructor() {
    // Debounce keystrokes before they reach the facade (same pattern as the
    // Instructor library page).
    toObservable(this.searchInput)
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.facade.setSearch(value));
  }

  protected onSearchInput(event: Event): void {
    this.searchInput.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.searchInput.set('');
  }

  protected exportCsv(): void {
    void this.facade.exportCsv();
  }

  protected isActiveTab(value: BlockedStatusFilter): boolean {
    return this.facade.blockedStatus() === value;
  }

  protected selectStatus(value: BlockedStatusFilter): void {
    this.facade.setBlockedStatus(value);
  }

  // Pagination is page NUMBERS now, not URLs — no parsing needed.
  protected goPrev(): void {
    this.facade.setPage(this.facade.pagination().previous_page ?? this.currentPage() - 1);
  }

  protected goNext(): void {
    this.facade.setPage(this.facade.pagination().next_page ?? this.currentPage() + 1);
  }

  protected onBlockToggle(user: PartnerPanelUser): void {
    const action: BlockStatusDialogData['action'] = user.is_blocked ? 'unblock' : 'block';

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

    ref.afterClosed.pipe(take(1)).subscribe(async (result) => {
      if (!result?.confirmed) return;
      await this.facade.setBlockStatus(user, action === 'block', result.reason);
    });
  }
}
