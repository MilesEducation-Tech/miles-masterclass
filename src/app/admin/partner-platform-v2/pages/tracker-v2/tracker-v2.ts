import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { Seat, SeatStatusFilter } from '@admin/core/models/partner-platform.model';
import { PartnerAdminMe } from '@admin/core/services/partner-admin-me';
import { PartnerNetworkFacade } from '@admin/core/services/partner-network-facade';
import { SeatTrackerTable } from '@admin/seat-tracker/components/seat-tracker-table/seat-tracker-table';

import { AriaSelectOption } from '@core/models/aria.model';
import { Field } from '@shared/ui/field/field';
import { NgpLabel } from 'ng-primitives/form-field';
import { Input } from '@shared/ui/input/input';
import { Select } from '@shared/ui/select/select';
import { Tabs } from '@shared/ui/tabs/tabs';
import { Tab } from '@shared/ui/tabs/tab';

const STATUS_TABS: { value: SeatStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'shared', label: 'Shared' },
  { value: 'applied', label: 'Applied' },
  { value: 'expired', label: 'Expired' },
];

/**
 * Partner Platform v2 — Seat Tracker (`/admin/partner-v2/tracker`) for network
 * + firm admins. `GET /panel/seats/` scoped server-side; listing needs the
 * `seat:usage:read` capability (the facade won't even fetch without it) and
 * send/resend needs `seat:send`.
 */
@Component({
  selector: 'app-tracker-v2',
  imports: [SeatTrackerTable, Field, NgpLabel, Input, Select, Tabs, Tab],
  templateUrl: './tracker-v2.html',
  host: { class: 'block w-full' },
})
export class TrackerV2 {
  protected readonly facade = inject(PartnerNetworkFacade);
  protected readonly me = inject(PartnerAdminMe);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusTabs = STATUS_TABS;
  protected readonly searchInput = signal('');

  protected readonly currentPage = computed(() => this.facade.pageNumber());
  protected readonly totalCount = computed(() => this.facade.totalCount());

  /** Panel title: network name for a network admin, firm name for a firm admin. */
  protected readonly title = computed(
    () => this.me.network()?.name ?? this.me.firm()?.name ?? 'Partner network',
  );

  /** The list itself requires this capability — mirror the server's gate. */
  protected readonly canReadSeats = computed(() => this.me.can('seat:usage:read'));
  /** Send / resend is gated on the seat:send capability. */
  protected readonly canSend = computed(() => this.me.can('seat:send'));
  /** Show the per-row firm column only when not pinned to a single firm. */
  protected readonly showFirmColumn = computed(
    () => this.me.isNetworkAdmin() && this.facade.selectedFirmId() == null,
  );

  constructor() {
    toObservable(this.searchInput)
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.facade.setSearch(value));
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

  protected isActiveTab(value: SeatStatusFilter): boolean {
    return this.facade.statusFilter() === value;
  }

  protected selectStatus(value: SeatStatusFilter): void {
    this.facade.setStatusFilter(value);
  }

  /** `null` = every sub-company; the facade already drops a stale selection. */
  protected readonly firmOptions = computed<AriaSelectOption<number | null>[]>(() => [
    { value: null, label: 'All sub-companies' },
    ...this.facade.firms().map((f) => ({ value: f.id as number | null, label: f.name })),
  ]);

  protected goPrev(): void {
    this.facade.setPage(this.currentPage() - 1);
  }

  protected goNext(): void {
    this.facade.setPage(this.currentPage() + 1);
  }

  protected onShare(event: { seat: Seat; email: string }): void {
    void this.facade.sendSeat(event.seat, event.email);
  }

  protected onResend(seat: Seat): void {
    if (seat.sent_to_email) void this.facade.sendSeat(seat, seat.sent_to_email);
  }
}
