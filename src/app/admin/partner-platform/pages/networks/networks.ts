import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, take } from 'rxjs';
import { Button } from '@shared/ui/button/button';
import { Spinner } from '@shared/ui/spinner/spinner';
import { DeprecationBanner } from '@shared/components/deprecation-banner/deprecation-banner';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { PartnerSuperAdminFacade } from '@admin/core/services/partner-superadmin-facade';
import { Network } from '@admin/core/models/partner-platform.model';
import {
  NetworkFormDialog,
  NetworkFormDialogData,
  NetworkFormResult,
} from '@admin/partner-platform-v2/dialogs/network-form-dialog/network-form-dialog';
import {
  NetworkFirmsDialog,
  NetworkFirmsDialogData,
} from '@admin/partner-platform/dialogs/network-firms-dialog/network-firms-dialog';

/**
 * Super-admin Networks page (`/admin/partner/networks`). Lists partner networks
 * with their seat allocation and lets a super admin create / edit them.
 */
@Component({
  selector: 'app-partner-networks',
  imports: [Button, Spinner, DeprecationBanner],
  templateUrl: './networks.html',
  host: { class: 'block w-full' },
})
export class Networks {
  protected readonly facade = inject(PartnerSuperAdminFacade);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected openCreate(): void {
    this.openDialog();
  }

  protected openEdit(network: Network): void {
    this.openDialog(network);
  }

  /** Row action: manage / create member firms directly under this network. */
  protected openFirms(network: Network): void {
    const ref = this.dialogs.open<NetworkFirmsDialogData, number | undefined>(NetworkFirmsDialog, {
      data: { network } satisfies NetworkFirmsDialogData,
    });
    this.handleFirmCreated(ref.afterClosed);
  }

  /** Row action: open the super-admin coupon tracker for this network. */
  protected openTracker(network: Network): void {
    void this.router.navigate(['/admin/partner/networks', network.id, 'tracker']);
  }

  /** Header action: manage / create standalone companies (single company, no network). */
  protected openStandaloneFirms(): void {
    const ref = this.dialogs.open<NetworkFirmsDialogData, number | undefined>(NetworkFirmsDialog, {
      data: {} satisfies NetworkFirmsDialogData,
    });
    this.handleFirmCreated(ref.afterClosed);
  }

  /** Deep-link to admin provisioning for the newly created firm (mirrors network creation). */
  private handleFirmCreated(afterClosed$: Observable<number | undefined>): void {
    afterClosed$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((firmId) => {
      if (firmId == null) return;
      void this.router.navigate(['/admin/admin-users'], {
        queryParams: { firm: firmId, provision: 1 },
      });
    });
  }

  private openDialog(network?: Network): void {
    const ref = this.dialogs.open<NetworkFormDialogData, NetworkFormResult | undefined>(
      NetworkFormDialog,
      { data: { network } satisfies NetworkFormDialogData },
    );
    ref.afterClosed.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe(async (result) => {
      if (!result) return;
      if (network) {
        void this.facade.updateNetwork(network.id, {
          name: result.name,
          total_seats: result.total_seats,
          is_active: result.is_active,
          // Only send `allocations` when seats were actually picked — an empty
          // array would ask the backend to mint nothing.
          ...(result.allocations.length ? { allocations: result.allocations } : {}),
        });
        return;
      }
      // Create, then hand off to admin provisioning with the new network
      // pre-selected (the operator picks the role + creates the login there).
      const created = await this.facade.createNetwork({
        name: result.name,
        slug: result.slug,
        total_seats: result.total_seats,
      });
      if (created) {
        void this.router.navigate(['/admin/admin-users'], {
          queryParams: { network: created.id, provision: 1 },
        });
      }
    });
  }
}
