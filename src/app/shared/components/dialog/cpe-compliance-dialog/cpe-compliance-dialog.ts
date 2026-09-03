import { DecimalPipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { Button } from '../../ui/button/button';
import { DialogRef } from '../../../core/services/dialog/dialog';
import { CreditsSummary, StudyModeBreakdown } from '../../../core/models/cpe-tracker.model';

export interface ComplianceDialogData {
  year: number;
  credits: CreditsSummary;
  fieldsOfStudy: StudyModeBreakdown[];
  stateBoardName?: string;
}

interface FieldCard {
  id: number;
  name: string;
  earned: number;
  required: number;
  percent: number;
  color: string;
}

const FIELD_CARD_COLORS: Record<string, string> = {
  Accounting: '#5A6499',
  Ethics: '#F06B6D',
  Others: '#FCC046',
};

@Component({
  selector: 'app-cpe-compliance-dialog',
  imports: [DecimalPipe, Button],
  templateUrl: './cpe-compliance-dialog.html',
  styleUrl: './cpe-compliance-dialog.css',
})
export class CpeComplianceDialog {
  dialogRef!: DialogRef<CpeComplianceDialog>;

  private readonly _data = signal<ComplianceDialogData | null>(null);

  /** `data` is assigned by the `Dialog` service via `(componentRef.instance as any).data = …`. */
  set data(value: ComplianceDialogData) {
    this._data.set(value);
  }

  protected readonly credits = computed(() => this._data()?.credits ?? null);
  protected readonly year = computed(() => this._data()?.year ?? new Date().getFullYear());
  protected readonly stateBoardName = computed(() => this._data()?.stateBoardName || 'State Board');

  protected readonly percent = computed(() => {
    const c = this.credits();
    if (!c || c.required <= 0) return 0;
    return Math.min(100, Math.round((c.earned / c.required) * 100));
  });

  protected readonly cards = computed<FieldCard[]>(() => {
    const d = this._data();
    if (!d) return [];
    const required = d.credits.required;
    return d.fieldsOfStudy.map((f) => ({
      id: f.id,
      name: f.name,
      earned: f.credits,
      required,
      percent: required > 0 ? Math.min(100, Math.round((f.credits / required) * 100)) : 0,
      color: FIELD_CARD_COLORS[f.name] ?? '#94A3B8',
    }));
  });

  protected close(): void {
    this.dialogRef?.close();
  }
}
