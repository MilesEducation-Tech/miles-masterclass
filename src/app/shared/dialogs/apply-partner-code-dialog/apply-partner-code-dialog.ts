import { ChangeDetectionStrategy, Component, Signal, signal } from '@angular/core';
import { AriaSelectOption } from '@core/models/aria.model';
import { AriaAutocomplete } from '../../ui/aria/aria-autocomplete/aria-autocomplete';
import { Button } from '../../ui/button/button';
import { injectDialogRef } from 'ng-primitives/dialog';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';

export interface ApplyPartnerCodeDialogData {
  userEmail: string;
  /** Live options signal — the caller reloads the codes as the dialog opens. */
  options: Signal<AriaSelectOption<string>[]>;
}

export interface ApplyPartnerCodeDialogResult {
  code: string;
}

/**
 * Picks a partner code for a user. Pure UI — returns the chosen code; the
 * caller performs the update. `data` comes from `injectDialogRef()`, i.e. the
 * `data` the caller passed to `NgpDialogManager.open()`.
 */
@Component({
  selector: 'app-apply-partner-code-dialog',
  imports: [AriaAutocomplete, Button, DialogShell],
  templateUrl: './apply-partner-code-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplyPartnerCodeDialog {
  private readonly dialogRef = injectDialogRef<
    ApplyPartnerCodeDialogData,
    ApplyPartnerCodeDialogResult | undefined
  >();
  protected readonly data = this.dialogRef.data;

  protected readonly selected = signal<string | null>(null);

  protected close(): void {
    this.dialogRef.close();
  }

  protected submit(): void {
    const code = this.selected();
    if (!code) return;
    this.dialogRef.close({ code });
  }
}
