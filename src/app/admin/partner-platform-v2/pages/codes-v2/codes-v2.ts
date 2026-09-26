import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';
import { Button } from '@shared/ui/button/button';
import { Spinner } from '@shared/ui/spinner/spinner';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { CreatePartnerCodeRequest, PartnerCode } from '@admin/core/models/partner-platform.model';
import { PartnerSuperAdminFacade } from '@admin/core/services/partner-superadmin-facade';
import {
  CreatePartnerCodeDialog,
  CreatePartnerCodeDialogData,
} from '@admin/partner-platform-v2/dialogs/create-partner-code-dialog/create-partner-code-dialog';

/**
 * Partner Platform v2 — Partner Codes (`/admin/partner-v2/codes`). The
 * plan/price templates seats are minted from; scoped to a network, a firm, or
 * global.
 */
@Component({
  selector: 'app-codes-v2',
  imports: [Button, Spinner, CurrencyPipe, DatePipe],
  templateUrl: './codes-v2.html',
  host: { class: 'block w-full' },
})
export class CodesV2 {
  protected readonly facade = inject(PartnerSuperAdminFacade);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly destroyRef = inject(DestroyRef);

  /** The API embeds the scope's name, so no id → name lookup is needed. */
  protected assignedLabel(code: PartnerCode): string {
    if (code.network) return `Network — ${code.network.name}`;
    if (code.firm) return `Firm — ${code.firm.name}`;
    return 'Global';
  }

  protected openCreate(): void {
    const ref = this.dialogs.open<
      CreatePartnerCodeDialogData,
      CreatePartnerCodeRequest | undefined
    >(CreatePartnerCodeDialog, {
      data: {
        networks: this.facade.activeNetworks(),
        firms: this.facade.firms().filter((f) => f.is_active),
      } satisfies CreatePartnerCodeDialogData,
    });
    ref.afterClosed.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result) void this.facade.createPartnerCode(result);
    });
  }
}
