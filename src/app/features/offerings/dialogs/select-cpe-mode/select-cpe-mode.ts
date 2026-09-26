import { Component, signal } from '@angular/core';
import { injectDialogRef } from 'ng-primitives/dialog';
import { NgpRadioGroup, NgpRadioIndicator, NgpRadioItem } from 'ng-primitives/radio';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';
import { Button } from '@shared/ui/button/button';

/** Data passed to the SelectCpeMode dialog */
export interface SelectCpeModeData {
  type: 'Masterclass' | 'Podcast' | 'Micro Learning';
  format?: 'video' | 'audio';
  isFree?: boolean;
  activePlan?: unknown;
}

/** Result returned when dialog closes with confirmation */
export interface SelectCpeModeResult {
  cpe_mode_status: boolean;
}

@Component({
  selector: 'app-select-cpe-mode',
  imports: [Button, DialogShell, NgpRadioGroup, NgpRadioIndicator, NgpRadioItem],
  templateUrl: './select-cpe-mode.html',
  host: {
    class: 'block',
  },
})
export class SelectCpeMode {
  private readonly dialogRef = injectDialogRef<SelectCpeModeData, SelectCpeModeResult>();
  protected readonly data = this.dialogRef.data;

  readonly selectedMode = signal<boolean | null>(null);

  close(): void {
    this.dialogRef.close();
  }

  confirmSelection(): void {
    const mode = this.selectedMode();
    if (mode === null) return;

    const result: SelectCpeModeResult = {
      cpe_mode_status: mode,
    };
    this.dialogRef.close(result);
  }
}
