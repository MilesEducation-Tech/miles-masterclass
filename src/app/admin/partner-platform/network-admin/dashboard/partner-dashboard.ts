import { Component, computed, inject } from '@angular/core';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { DeprecationBanner } from '../../../shared/components/deprecation-banner/deprecation-banner';
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
  imports: [Spinner, StatCard, DeprecationBanner],
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
    // Accents use design-system tokens: pool metrics draw from the chart
    // palette; seat-status metrics reuse the tracker's status-chip colors
    // (available=info, shared=warn, expired=danger).
    // Only a network has a seat pool of its own, and the API says so by omitting
    // `total_seats`/`unallocated_seats` for a firm admin — so branch on the
    // field being present, not on the role.
    const poolCards =
      d.total_seats != null
        ? [
            { label: 'Total seats', value: d.total_seats, accent: 'var(--mm-fg-3)' },
            { label: 'Allocated', value: d.allocated_seats, accent: 'var(--chart-1)' },
            { label: 'Unallocated', value: d.unallocated_seats ?? 0, accent: 'var(--chart-5)' },
          ]
        : [{ label: 'Allocated', value: d.allocated_seats, accent: 'var(--chart-1)' }];
    return [
      ...poolCards,
      { label: 'Used', value: d.used_seats, accent: 'var(--chart-3)' },
      { label: 'Available', value: d.available_seats, accent: 'var(--mm-info)' },
      { label: 'Shared', value: d.shared_seats, accent: 'var(--mm-warn)' },
      { label: 'Expired', value: d.expired_seats, accent: 'var(--mm-danger)' },
    ];
  });
}
