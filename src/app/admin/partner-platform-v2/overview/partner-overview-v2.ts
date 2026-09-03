import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';
import { Button } from '../../../shared/components/ui/button/button';
import { Spinner } from '../../../shared/components/ui/spinner/spinner';
import { Dialog } from '../../../shared/core/services/dialog/dialog';
import { StatCard } from '../../partner-platform/shared/components/stat-card/stat-card';
import {
  CreatePartnerCodeRequest,
  PartnerCode,
} from '../../partner-platform/shared/models/partner-platform.model';
import { PartnerAdminMe } from '../../partner-platform/shared/services/partner-admin-me';
import { PartnerNetworkFacade } from '../../partner-platform/shared/services/partner-network-facade';
import { PartnerSuperAdminFacade } from '../../partner-platform/shared/services/partner-superadmin-facade';
import {
  CreatePartnerCodeDialog,
  CreatePartnerCodeDialogData,
} from '../../partner-platform/super-admin/partner-codes/shared/components/create-partner-code-dialog/create-partner-code-dialog';

/**
 * Partner Platform v2 — Overview (`/admin/partner-v2/overview`), the panel
 * landing for network + firm admins: seat stat cards (`GET /panel/dashboard/`)
 * and the partner codes this admin can mint from (`GET /panel/partner-codes/`).
 *
 * The create-code CTA follows `code:create:network` / `code:create:firm`.
 * ponytail: it posts to the superadmin partner-codes endpoint — the panel API
 * has no code-creation endpoint yet, so a Django network/firm role gets the
 * server's 403 message verbatim. Real fix: a backend `POST /panel/partner-codes/`.
 */
@Component({
  selector: 'app-partner-overview-v2',
  imports: [Button, Spinner, StatCard, CurrencyPipe],
  templateUrl: './partner-overview-v2.html',
  host: { class: 'block w-full' },
})
export class PartnerOverviewV2 {
  protected readonly facade = inject(PartnerNetworkFacade);
  protected readonly me = inject(PartnerAdminMe);
  private readonly superFacade = inject(PartnerSuperAdminFacade);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  /** Header title: the network name for a network admin, the firm name for a firm admin. */
  protected readonly title = computed(
    () => this.me.network()?.name ?? this.me.firm()?.name ?? 'Partner network',
  );

  protected readonly canCreateCode = computed(
    () => this.me.can('code:create:network') || this.me.can('code:create:firm'),
  );

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

  /** Create a code pinned to this admin's own scope. */
  protected openCreateCode(): void {
    const ref = this.dialog.open<CreatePartnerCodeDialog, CreatePartnerCodeRequest | undefined>(
      CreatePartnerCodeDialog,
      {
        data: {
          networks: [],
          firms: [],
          pinned: { network: this.me.network(), firm: this.me.firm() },
        } satisfies CreatePartnerCodeDialogData,
        maxWidth: '520px',
        ariaLabel: 'Create partner code',
      },
    );
    ref.afterClosed$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result) void this.superFacade.createPartnerCode(result);
    });
  }
}
