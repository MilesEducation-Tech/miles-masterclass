import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, take } from 'rxjs';
import { AriaInput } from '../../shared/components/ui/aria/aria-input/aria-input';
import { Button } from '../../shared/components/ui/button/button';
import { Dialog } from '../../shared/core/services/dialog/dialog';
import {
  BlockStatusDialog,
  BlockStatusDialogData,
  BlockStatusDialogResult,
} from '../../shared/components/dialog/block-status-dialog/block-status-dialog';
import { parseNextPage } from '../../shared/utils/parse-next-page';
import { UsersTable } from './shared/components/users-table/users-table';

const STATUS_TABS: { value: any; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'blocked', label: 'Blocked' },
];

@Component({
  selector: 'app-admin-users',
  imports: [AriaInput, Button, UsersTable],
  templateUrl: './users.html',
  styleUrl: './users.css',
  host: { class: 'block w-full' },
})
export class Users {
  // ponytail: PartnerUsersFacade was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  protected readonly facade: any = {
    blockedStatus: signal<any[]>([]),
    error: signal<any>(null),
    exportCsv: signal<any>(null),
    isLoading: signal<any>(null),
    pagination: signal<any>(null),
    setBlockedStatus: (..._args: any[]): any => null,
    setBlockStatus: (..._args: any[]): any => null,
    setPage: (..._args: any[]): any => null,
    setSearch: (..._args: any[]): any => null,
    users: signal<any[]>([]),
  };
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusTabs = STATUS_TABS;
  /** Raw search input — debounced before reaching the facade. */
  protected readonly searchInput = signal('');

  // Non-null URL = a page exists in that direction (a prev URL pointing at
  // page 1 omits the ?page= param, so don't gate on parsing it).
  protected readonly hasNextPage = computed(() => this.facade.pagination()?.next_page != null);
  protected readonly hasPrevPage = computed(() => this.facade.pagination()?.previous_page != null);

  protected readonly currentPage = computed(
    () => this.facade.pagination()?.current_page_number ?? 1,
  );
  protected readonly totalCount = computed(() => this.facade.pagination()?.total_count ?? 0);

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

  protected isActiveTab(value: any): boolean {
    return this.facade.blockedStatus() === value;
  }

  protected selectStatus(value: any): void {
    this.facade.setBlockedStatus(value);
  }

  protected goPrev(): void {
    const prev = parseNextPage(this.facade.pagination()?.previous_page);
    if (prev !== null) this.facade.setPage(prev);
    else this.facade.setPage(Math.max(1, this.currentPage() - 1));
  }

  protected goNext(): void {
    const next = parseNextPage(this.facade.pagination()?.next_page);
    if (next !== null) this.facade.setPage(next);
    else this.facade.setPage(this.currentPage() + 1);
  }

  protected onBlockToggle(user: any): void {
    const action: BlockStatusDialogData['action'] = user.is_blocked ? 'unblock' : 'block';

    const ref = this.dialog.open<BlockStatusDialog, BlockStatusDialogResult>(BlockStatusDialog, {
      data: {
        action,
        userName: user.name,
        userEmail: user.email,
      } satisfies BlockStatusDialogData,
      maxWidth: '480px',
      ariaLabel: action === 'block' ? 'Block user' : 'Unblock user',
    });

    ref.afterClosed$.pipe(take(1)).subscribe(async (result) => {
      if (!result?.confirmed) return;
      await this.facade.setBlockStatus({
        user,
        isBlocked: action === 'block',
        reason: result.reason,
      });
    });
  }
}
