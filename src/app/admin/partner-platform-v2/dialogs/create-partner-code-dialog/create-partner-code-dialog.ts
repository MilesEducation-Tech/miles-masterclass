import { Component, OnInit, signal } from '@angular/core';
import { FormField as AngularFormField, form, required, validate } from '@angular/forms/signals';
import { DialogRef } from '@core/services/dialog/dialog';
import { Button } from '@shared/ui/button/button';
import { Forms } from '@shared/ui/forms/forms';
import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';
import { AriaSelect } from '@shared/ui/aria/aria-select/aria-select';
import { AriaSelectOption } from '@core/models/aria.model';
import {
  CreatePartnerCodeRequest,
  Firm,
  Network,
  PartnerFirmRef,
  PartnerNetworkRef,
} from '@admin/core/models/partner-platform.model';

export interface CreatePartnerCodeDialogData {
  /** Active networks the code can be scoped to. */
  networks: Network[];
  /** Active firms the code can be scoped to (member or standalone). */
  firms: Firm[];
  /**
   * Pin the scope to the caller's own network/firm (the panel-side CTA) — the
   * scope select then holds exactly that one option, pre-selected.
   */
  pinned?: { network?: PartnerNetworkRef | null; firm?: PartnerFirmRef | null };
}

/**
 * Scope encoded as one select value: '' = global, 'network:<id>' or
 * 'firm:<id>' — a code is scoped to a network OR a firm, never both.
 */
type ScopeValue = string;

/** Numeric input surfaces as a string from the native input — model it as such. */
interface PartnerCodeFormModel {
  code: string;
  discounted_price: string;
  scope: ScopeValue;
  auto_subscribe: boolean;
  description: string;
  stripe_price_id: string;
  /** `datetime-local` value; converted to ISO on submit. */
  valid_to: string;
}

/**
 * Create a partner code (plan/price template) scoped to a network, a firm, or
 * global — the super-admin "create coupon" step. Resolves with a
 * `CreatePartnerCodeRequest` on submit, or `undefined` on cancel.
 */
@Component({
  selector: 'app-create-partner-code-dialog',
  imports: [AngularFormField, Forms, AriaInput, AriaSelect, Button],
  templateUrl: './create-partner-code-dialog.html',
})
export class CreatePartnerCodeDialog implements OnInit {
  dialogRef!: DialogRef<CreatePartnerCodeDialog, CreatePartnerCodeRequest | undefined>;
  data!: CreatePartnerCodeDialogData;

  protected readonly scopeOptions = signal<AriaSelectOption<ScopeValue>[]>([]);

  private readonly model = signal<PartnerCodeFormModel>({
    code: '',
    discounted_price: '',
    scope: '',
    auto_subscribe: false,
    description: '',
    stripe_price_id: '',
    valid_to: '',
  });

  protected readonly form = form<PartnerCodeFormModel>(this.model, (s) => {
    required(s.code, { message: 'Code is required' });
    validate(s.discounted_price, ({ value }) => {
      const n = Number(value());
      return value().trim() !== '' && Number.isFinite(n) && n >= 0
        ? null
        : { kind: 'min', message: 'Enter a price of 0 or more' };
    });
  });

  ngOnInit(): void {
    const pinned = this.data?.pinned;
    const pin = pinned?.network
      ? { value: `network:${pinned.network.id}`, label: `Network — ${pinned.network.name}` }
      : pinned?.firm
        ? { value: `firm:${pinned.firm.id}`, label: `Firm — ${pinned.firm.name}` }
        : null;
    if (pin) {
      this.scopeOptions.set([pin]);
      this.model.update((m) => ({ ...m, scope: pin.value }));
      return;
    }
    this.scopeOptions.set([
      { value: '', label: 'Global (all networks)' },
      ...(this.data?.networks ?? []).map((n) => ({
        value: `network:${n.id}`,
        label: `Network — ${n.name}`,
      })),
      ...(this.data?.firms ?? []).map((f) => ({
        value: `firm:${f.id}`,
        label: `Firm — ${f.name}`,
      })),
    ]);
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected submit(): void {
    if (this.form().invalid()) return;
    const v = this.model();
    const [kind, id] = v.scope.split(':');
    const payload: CreatePartnerCodeRequest = {
      code: v.code.trim(),
      discounted_price: Number(v.discounted_price),
      // Network OR firm, never both; neither = global.
      ...(kind === 'network' ? { network: Number(id) } : {}),
      ...(kind === 'firm' ? { firm: Number(id) } : {}),
      auto_subscribe: v.auto_subscribe,
      ...(v.description.trim() ? { description: v.description.trim() } : {}),
      ...(v.stripe_price_id.trim() ? { stripe_price_id: v.stripe_price_id.trim() } : {}),
      // Expiry for DIRECT (non-seat) redemption — seats minted from the plan are unaffected.
      ...(v.valid_to ? { valid_to: new Date(v.valid_to).toISOString() } : {}),
    };
    this.dialogRef.close(payload);
  }
}
