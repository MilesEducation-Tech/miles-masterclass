import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';
import { Button } from '../../../../shared/components/ui/button/button';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { Dialog } from '../../../../shared/core/services/dialog/dialog';
import {
  CreatePartnerCodeDialog,
  CreatePartnerCodeDialogData,
} from './shared/components/create-partner-code-dialog/create-partner-code-dialog';

/**
 * Super-admin Partner Codes page (`/admin/partner/partner-codes`). Lists the
 * plan/price templates and lets a super admin create one scoped to a network,
 * a firm, or global — the upstream "create coupon" step.
 */
@Component({
  selector: 'app-partner-codes',
  imports: [Button, Spinner, CurrencyPipe],
  templateUrl: './partner-codes.html',
  host: { class: 'block w-full' },
})
export class PartnerCodes {
  // ponytail: PartnerSuperAdminFacade was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  protected readonly facade: any = {
    activeNetworks: signal<any[]>([]),
    createPartnerCode: (..._args: any[]): any => null,
    firms: signal<any[]>([]),
    networks: signal<any[]>([]),
    partnerCodes: signal<any[]>([]),
    partnerCodesError: signal<any>(null),
    partnerCodesLoading: signal<any>(null),
  };
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);

  /** id → name lookups for the "Assigned to" column. */
  private readonly networkNames = computed(
    () => new Map(this.facade.networks().map((n: any) => [n.id, n.name])),
  );
  private readonly firmNames = computed(
    () => new Map(this.facade.firms().map((f: any) => [f.id, f.name])),
  );

  protected assignedLabel(code: any): string {
    if (code.partner_network != null) {
      return `Network — ${this.networkNames().get(code.partner_network) ?? `#${code.partner_network}`}`;
    }
    if (code.partner_firm != null) {
      return `Firm — ${this.firmNames().get(code.partner_firm) ?? `#${code.partner_firm}`}`;
    }
    return 'Global';
  }

  protected openCreate(): void {
    const ref = this.dialog.open<CreatePartnerCodeDialog, any | undefined>(
      CreatePartnerCodeDialog,
      {
        data: {
          networks: this.facade.activeNetworks(),
          firms: this.facade.firms().filter((f: any) => f.is_active),
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
