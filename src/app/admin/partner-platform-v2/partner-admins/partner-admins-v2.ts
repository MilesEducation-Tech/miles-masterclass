import { Component, DestroyRef, EnvironmentInjector, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';
import { Button } from '@shared/components/ui/button/button';
import { Spinner } from '@shared/components/ui/spinner/spinner';
import { CreatePartnerAdminDialog } from '@shared/components/dialog/create-partner-admin-dialog/create-partner-admin-dialog';
import { Dialog } from '@core/services/dialog/dialog';
import { PartnerAdmin } from '@admin/partner-platform/shared/models/partner-platform.model';
import { PartnerSuperAdminFacade } from '@admin/partner-platform/shared/services/partner-superadmin-facade';

/**
 * Partner Platform v2 — Partner Admins (`/admin/partner-v2/partner-admins`).
 * Every Django `PartnerAdmin` row: role, scope, capabilities, status — from
 * `GET /superadmin/partner-admins/`. "Create partner admin" provisions the
 * Supabase login first, then posts the Django row with its uid.
 */
@Component({
  selector: 'app-partner-admins-v2',
  imports: [Button, Spinner],
  templateUrl: './partner-admins-v2.html',
  host: { class: 'block w-full' },
})
export class PartnerAdminsV2 {
  protected readonly facade = inject(PartnerSuperAdminFacade);
  private readonly dialog = inject(Dialog);
  // The dialog injects the route-scoped facade — hand it this page's injector.
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly destroyRef = inject(DestroyRef);

  protected scopeLabel(admin: PartnerAdmin): string {
    if (admin.network) return `Network — ${admin.network.name}`;
    if (admin.firm) return `Firm — ${admin.firm.name}`;
    return admin.role === 'super' ? 'Everything' : '—';
  }

  protected openCreate(): void {
    const ref = this.dialog.open<CreatePartnerAdminDialog, PartnerAdmin | undefined>(
      CreatePartnerAdminDialog,
      {
        environmentInjector: this.envInjector,
        maxWidth: '560px',
        ariaLabel: 'Create partner admin',
      },
    );
    // createPartnerAdmin() already reloads the list; nothing else to do on success.
    ref.afterClosed$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe();
  }
}
