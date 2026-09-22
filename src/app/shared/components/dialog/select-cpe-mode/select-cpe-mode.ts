import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogRef } from '@core/services/dialog/dialog';
import { Button } from '../../ui/button/button';

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
  imports: [Button, FormsModule],
  templateUrl: './select-cpe-mode.html',
  styleUrl: './select-cpe-mode.css',
  host: {
    class: 'block',
  },
})
export class SelectCpeMode {
  dialogRef!: DialogRef<SelectCpeMode, { cpe_mode_status: boolean }>;
  data!: SelectCpeModeData;

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
