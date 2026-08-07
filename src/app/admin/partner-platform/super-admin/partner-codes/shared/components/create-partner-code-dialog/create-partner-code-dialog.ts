import { Component, OnInit, signal } from '@angular/core';
import { FormField as AngularFormField, form, required, validate } from '@angular/forms/signals';
import { DialogRef } from '../../../../../../../shared/core/services/dialog/dialog';
import { Button } from '../../../../../../../shared/components/ui/button/button';
import { Forms } from '../../../../../../../shared/components/ui/forms/forms';
import { AriaInput } from '../../../../../../../shared/components/ui/aria/aria-input/aria-input';
import { AriaSelect } from '../../../../../../../shared/components/ui/aria/aria-select/aria-select';
import { AriaSelectOption } from '../../../../../../../shared/core/models/aria.model';
import {
  CreatePartnerCodeRequest,
  Network,
  SuperFirm,
} from '../../../../../shared/models/partner-platform.model';

export interface CreatePartnerCodeDialogData {
  /** Active networks the code can be scoped to. */
  networks: Network[];
  /** Active firms the code can be scoped to (member or standalone). */
  firms: SuperFirm[];
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
      ...(kind === 'network' ? { partner_network_id: Number(id) } : {}),
      ...(kind === 'firm' ? { partner_firm_id: Number(id) } : {}),
      auto_subscribe: v.auto_subscribe,
      ...(v.description.trim() ? { description: v.description.trim() } : {}),
    };
    this.dialogRef.close(payload);
  }
}
