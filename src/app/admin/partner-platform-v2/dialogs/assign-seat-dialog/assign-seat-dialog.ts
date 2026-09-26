import { Component, OnInit, computed, signal } from '@angular/core';
import { FormField as AngularFormField, form, validate } from '@angular/forms/signals';
import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';
import { AriaSelect } from '@shared/ui/aria/aria-select/aria-select';
import { Button } from '@shared/ui/button/button';
import { Forms } from '@shared/ui/forms/forms';
import { AriaSelectOption } from '@core/models/aria.model';
import { injectDialogRef } from 'ng-primitives/dialog';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';
import { Firm } from '@admin/core/models/partner-platform.model';

export interface AssignSeatDialogData {
  /** Member firms the pool seat can be moved onto. */
  firms: Firm[];
}

export interface AssignSeatResult {
  seatId: number;
  firmId: number;
}

/** Numeric input surfaces as a string from the native input — model it as such. */
interface AssignSeatFormModel {
  seat_id: string;
  firm_id: number | null;
}

/**
 * Move an unassigned network-pool seat onto a member firm —
 * `POST /superadmin/seats/<id>/assign-firm/`.
 *
 * ponytail: the seat is entered by ID — there is no superadmin seats-list
 * endpoint to pick from yet. Swap the input for a picker when
 * `GET /superadmin/seats/` exists.
 */
@Component({
  selector: 'app-assign-seat-dialog',
  imports: [AngularFormField, Forms, AriaInput, AriaSelect, Button, DialogShell],
  templateUrl: './assign-seat-dialog.html',
})
export class AssignSeatDialog implements OnInit {
  private readonly dialogRef = injectDialogRef<
    AssignSeatDialogData,
    AssignSeatResult | undefined
  >();
  protected readonly data = this.dialogRef.data;

  protected readonly firmOptions = signal<AriaSelectOption<number | null>[]>([]);
  private readonly model = signal<AssignSeatFormModel>({ seat_id: '', firm_id: null });

  protected readonly form = form<AssignSeatFormModel>(this.model, (s) => {
    validate(s.seat_id, ({ value }) => {
      const n = Number(value());
      return value().trim() !== '' && Number.isInteger(n) && n >= 1
        ? null
        : { kind: 'min', message: 'Enter the numeric seat ID' };
    });
    validate(s.firm_id, ({ value }) =>
      value() != null ? null : { kind: 'required', message: 'Pick the firm to assign it to' },
    );
  });

  protected readonly canSubmit = computed(() => !this.form().invalid());

  ngOnInit(): void {
    this.firmOptions.set(
      (this.data?.firms ?? [])
        .filter((f) => f.is_active)
        .map((f) => ({ value: f.id as number | null, label: f.name })),
    );
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected submit(): void {
    if (this.form().invalid()) return;
    const v = this.model();
    this.dialogRef.close({ seatId: Number(v.seat_id), firmId: v.firm_id! });
  }
}
