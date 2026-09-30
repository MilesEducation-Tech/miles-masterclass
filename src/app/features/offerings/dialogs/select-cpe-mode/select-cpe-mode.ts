import { Component, signal } from '@angular/core';
import { injectDialogRef } from 'ng-primitives/dialog';
import { NgpRadioGroup, NgpRadioIndicator, NgpRadioItem } from 'ng-primitives/radio';

import { Button } from '@shared/ui/button/button';
import { Dialog } from '@shared/ui/dialog/dialog';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';

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
  imports: [Button, NgpRadioGroup, NgpRadioIndicator, NgpRadioItem, Dialog, NgIcon],
  providers: [provideIcons({ heroXMark })],
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
