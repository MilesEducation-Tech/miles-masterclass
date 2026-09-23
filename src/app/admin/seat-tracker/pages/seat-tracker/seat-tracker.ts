import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';
import { DeprecationBanner } from '@shared/components/deprecation-banner/deprecation-banner';
import { PartnerNetworkFacade } from '@admin/core/services/partner-network-facade';
import { PartnerAdminMe } from '@admin/core/services/partner-admin-me';
import { Seat, SeatStatusFilter } from '@admin/core/models/partner-platform.model';
import { SeatTrackerTable } from '@admin/seat-tracker/components/seat-tracker-table/seat-tracker-table';

const STATUS_TABS: { value: SeatStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'shared', label: 'Shared' },
  { value: 'applied', label: 'Applied' },
  { value: 'expired', label: 'Expired' },
];

/**
 * Partner Code Tracker (`/admin/partner-code-tracker`) for network + firm admins.
 * Lists seats from `GET /panel/seats/`: a network admin sees the whole network
 * (optionally drilled into one firm), a firm admin only their own firm. The
 * `seat:send` capability gates send/resend; anyone else sees it read-only.
 * (Super admins use the network detail page on the Networks page instead.)
 *
 * Read-only apart from sending. Firms are created by super admins via
 * `POST /superadmin/firms/` — the panel API has no firm-creation endpoint, so
 * there is nothing here for a network admin to self-serve with.
 */
@Component({
  selector: 'app-seat-tracker',
  imports: [AriaInput, SeatTrackerTable, DeprecationBanner],
  templateUrl: './seat-tracker.html',
  styleUrl: './seat-tracker.css',
  host: { class: 'block w-full' },
})
export class SeatTracker {
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

  protected isActiveTab(value: SeatStatusFilter): boolean {
    return this.facade.statusFilter() === value;
  }

  protected selectStatus(value: SeatStatusFilter): void {
    this.facade.setStatusFilter(value);
  }

  protected onSelectFirm(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    if (raw === '') {
      this.facade.selectFirm(null);
      return;
    }
    const id = Number(raw);
    if (!Number.isNaN(id)) this.facade.selectFirm(id);
  }

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
