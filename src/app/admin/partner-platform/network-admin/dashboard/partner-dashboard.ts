import { Component, computed, inject } from '@angular/core';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { StatCard } from '../../shared/components/stat-card/stat-card';
import { PartnerAdminMe } from '../../shared/services/partner-admin-me';
import { PartnerNetworkFacade } from '../../shared/services/partner-network-facade';

/**
 * Network-admin dashboard (`/admin/partner/dashboard`). Renders the seat +
 * coupon stat cards from `/partner-admin/dashboard/`. Falls back to a "not a
 * partner admin" state when `/me/` says the login isn't provisioned.
 */
@Component({
  selector: 'app-partner-dashboard',
  imports: [Spinner, StatCard],
  templateUrl: './partner-dashboard.html',
  host: { class: 'block w-full' },
})
export class PartnerDashboard {
  protected readonly facade = inject(PartnerNetworkFacade);
  protected readonly me = inject(PartnerAdminMe);

  /** Header title: the network name for a network admin, the firm name for a firm admin. */
  protected readonly title = computed(
    () => this.me.network()?.name ?? this.me.firm()?.name ?? 'Partner network',
  );

  protected readonly cards = computed(() => {
    const d = this.facade.dashboard();
    if (!d) return [];
    // Accents use design-system tokens: seat metrics draw from the chart
    // palette; coupon-status metrics reuse the same status colors as the
    // tracker's status chips (available=info, shared=warn, applied=success,
    // expired=danger).
    // The network dashboard adds a seat pool (total_seats/unallocated); the firm
    // dashboard omits it (a firm draws from the network's pool, it has none of its own).
    const seatCards =
      'network' in d
        ? [
            { label: 'Total seats', value: d.total_seats, accent: 'var(--mm-fg-3)' },
            { label: 'Allocated', value: d.allocated, accent: 'var(--chart-1)' },
            { label: 'Unallocated', value: d.unallocated, accent: 'var(--chart-5)' },
          ]
        : [{ label: 'Allocated', value: d.allocated, accent: 'var(--chart-1)' }];
    return [
      ...seatCards,
      { label: 'Used', value: d.used, accent: 'var(--chart-3)' },
      { label: 'Available', value: d.available, accent: 'var(--mm-info)' },
      { label: 'Shared', value: d.shared, accent: 'var(--mm-warn)' },
      { label: 'Applied', value: d.applied, accent: 'var(--mm-success)' },
      { label: 'Expired', value: d.expired, accent: 'var(--mm-danger)' },
    ];
  });
}
