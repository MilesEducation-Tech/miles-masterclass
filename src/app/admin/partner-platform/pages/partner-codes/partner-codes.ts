import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';
import { Button } from '@shared/ui/button/button';
import { Spinner } from '@shared/ui/spinner/spinner';
import { DeprecationBanner } from '@shared/components/deprecation-banner/deprecation-banner';
import { Dialog } from '@core/services/dialog/dialog';
import { PartnerSuperAdminFacade } from '@admin/core/services/partner-superadmin-facade';
import { CreatePartnerCodeRequest, PartnerCode } from '@admin/core/models/partner-platform.model';
import {
  CreatePartnerCodeDialog,
  CreatePartnerCodeDialogData,
} from '@admin/partner-platform-v2/dialogs/create-partner-code-dialog/create-partner-code-dialog';

/**
 * Super-admin Partner Codes page (`/admin/partner/partner-codes`). Lists the
 * plan/price templates and lets a super admin create one scoped to a network,
 * a firm, or global — the upstream "create coupon" step.
 */
@Component({
  selector: 'app-partner-codes',
  imports: [Button, Spinner, CurrencyPipe, DeprecationBanner],
  templateUrl: './partner-codes.html',
  host: { class: 'block w-full' },
})
export class PartnerCodes {
  protected readonly facade = inject(PartnerSuperAdminFacade);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  /** The API embeds the scope's name, so no id → name lookup is needed. */
  protected assignedLabel(code: PartnerCode): string {
    if (code.network) return `Network — ${code.network.name}`;
    if (code.firm) return `Firm — ${code.firm.name}`;
    return 'Global';
  }

  protected openCreate(): void {
    const ref = this.dialog.open<CreatePartnerCodeDialog, CreatePartnerCodeRequest | undefined>(
      CreatePartnerCodeDialog,
      {
        data: {
          networks: this.facade.activeNetworks(),
          firms: this.facade.firms().filter((f) => f.is_active),
        } satisfies CreatePartnerCodeDialogData,
        maxWidth: '520px',
        ariaLabel: 'Create partner code',
      },
    );
    ref.afterClosed$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result) void this.facade.createPartnerCode(result);
    });
  }
}
