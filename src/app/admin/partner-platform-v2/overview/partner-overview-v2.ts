import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Button } from '../../../shared/components/ui/button/button';
import { Spinner } from '../../../shared/components/ui/spinner/spinner';
import { StatCard } from '../../partner-platform/shared/components/stat-card/stat-card';
import { Firm, PartnerCode } from '../../partner-platform/shared/models/partner-platform.model';
import { PartnerAdminMe } from '../../partner-platform/shared/services/partner-admin-me';
import { PartnerNetworkFacade } from '../../partner-platform/shared/services/partner-network-facade';

/**
 * Partner Platform v2 — Overview (`/admin/partner-v2/overview`), the panel
 * landing for network + firm admins: seat stat cards (`GET /panel/dashboard/`),
 * the partner codes this admin can mint from (`GET /panel/partner-codes/`) and,
 * for a network admin, the member firms (`GET /panel/firms/`).
 *
 * No create-code CTA: the panel API has no code-creation endpoint, so the old
 * button posted to the superadmin endpoint and 403'd for every panel admin.
 * Re-add it against `PartnerNetworkFacade` once `POST /panel/partner-codes/`
 * exists (gate on `code:create:network` / `code:create:firm`).
 */
@Component({
  selector: 'app-partner-overview-v2',
  imports: [Button, Spinner, StatCard, CurrencyPipe, DatePipe],
  templateUrl: './partner-overview-v2.html',
  host: { class: 'block w-full' },
})
export class PartnerOverviewV2 {
  protected readonly facade = inject(PartnerNetworkFacade);
  protected readonly me = inject(PartnerAdminMe);
  private readonly router = inject(Router);

  /** Header title: the network name for a network admin, the firm name for a firm admin. */
  protected readonly title = computed(
    () => this.me.network()?.name ?? this.me.firm()?.name ?? 'Partner network',
  );

  /** Drill into one member firm's seats — the tracker shares this route-scoped facade. */
  protected openSeats(firm: Firm): void {
    this.facade.selectFirm(firm.id);
    void this.router.navigate(['/admin/partner-v2/panel/tracker']);
  }

  protected readonly cards = computed(() => {
    const d = this.facade.dashboard();
    if (!d) return [];
    // Only a network has a seat pool of its own — the API says so by omitting
    // `total_seats`/`unallocated_seats` for a firm admin.
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

  protected scopeLabel(code: PartnerCode): string {
    if (code.network) return `Network — ${code.network.name}`;
    if (code.firm) return `Firm — ${code.firm.name}`;
    return 'Global';
  }
}
