import { Component, DestroyRef, EnvironmentInjector, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { take } from 'rxjs';
import { Button } from '../../../shared/components/ui/button/button';
import { Spinner } from '../../../shared/components/ui/spinner/spinner';
import { Dialog } from '../../../shared/core/services/dialog/dialog';
import { Network } from '../../partner-platform/shared/models/partner-platform.model';
import { PartnerSuperAdminFacade } from '../../partner-platform/shared/services/partner-superadmin-facade';
import { AdminAuth } from '../../../shared/core/services/admin-auth/admin-auth';
import {
  NetworkFormDialog,
  NetworkFormDialogData,
  NetworkFormResult,
} from '../../partner-platform/super-admin/networks/shared/components/network-form-dialog/network-form-dialog';

/**
 * Partner Platform v2 — Networks (`/admin/partner-v2/networks`). Lists partner
 * networks; each row opens its detail hub, where firms, seats and reports live.
 */
@Component({
  selector: 'app-networks-v2',
  imports: [Button, Spinner],
  templateUrl: './networks-v2.html',
  host: { class: 'block w-full' },
})
export class NetworksV2 {
  protected readonly facade = inject(PartnerSuperAdminFacade);
  private readonly dialog = inject(Dialog);
  // Dialogs are built by the root Dialog service; hand it this page's injector
  // so the route-scoped facade resolves instead of a NullInjectorError.
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  /** Editing a network is super-admin only. */
  protected readonly canEdit = inject(AdminAuth).isSuperAdmin;

  protected openCreate(): void {
    this.openDialog();
  }

  protected openEdit(network: Network): void {
    this.openDialog(network);
  }

  protected openDetail(network: Network): void {
    void this.router.navigate(['/admin/partner-v2/superadmin/networks', network.id]);
  }

  private openDialog(network?: Network): void {
    const ref = this.dialog.open<NetworkFormDialog, NetworkFormResult | undefined>(
      NetworkFormDialog,
      {
        data: { network } satisfies NetworkFormDialogData,
        environmentInjector: this.envInjector,
        maxWidth: '520px',
        ariaLabel: network ? 'Edit network' : 'Create network',
      },
    );
    ref.afterClosed$
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(async (result) => {
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
        // Create, then land on the hub — firms, seats and admins are set up there.
        const created = await this.facade.createNetwork({
          name: result.name,
          // Blank = let the backend slugify the name.
          ...(result.slug ? { slug: result.slug } : {}),
          total_seats: result.total_seats,
        });
        if (created) this.openDetail(created);
      });
  }
}
