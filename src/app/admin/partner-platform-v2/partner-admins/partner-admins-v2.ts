import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '../../../shared/components/ui/button/button';
import { Spinner } from '../../../shared/components/ui/spinner/spinner';
import { PartnerAdmin } from '../../partner-platform/shared/models/partner-platform.model';
import { PartnerSuperAdminFacade } from '../../partner-platform/shared/services/partner-superadmin-facade';

/**
 * Partner Platform v2 — Partner Admins (`/admin/partner-v2/partner-admins`).
 * Every Django `PartnerAdmin` row: role, scope, capabilities, status — from
 * `GET /superadmin/partner-admins/`.
 *
 * ponytail: creation deep-links to Admin Users (`?provision=1`) instead of a
 * dialog here — provisioning grants access to paid content and deliberately
 * stays on its one existing, permission-gated surface.
 */
@Component({
  selector: 'app-partner-admins-v2',
  imports: [Button, Spinner, RouterLink],
  templateUrl: './partner-admins-v2.html',
  host: { class: 'block w-full' },
})
export class PartnerAdminsV2 {
  protected readonly facade = inject(PartnerSuperAdminFacade);

  protected scopeLabel(admin: PartnerAdmin): string {
    if (admin.network) return `Network — ${admin.network.name}`;
    if (admin.firm) return `Firm — ${admin.firm.name}`;
    return admin.role === 'super' ? 'Everything' : '—';
  }
}
