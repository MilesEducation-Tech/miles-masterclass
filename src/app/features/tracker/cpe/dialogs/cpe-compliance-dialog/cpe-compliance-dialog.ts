import { DecimalPipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { Button } from '@shared/ui/button/button';
import { injectDialogRef } from 'ng-primitives/dialog';

import { CreditsSummary, StudyModeBreakdown } from '@core/models/cpe-tracker.model';
import { Dialog } from '@shared/ui/dialog/dialog';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';

export interface ComplianceDialogData {
  year: number;
  credits: CreditsSummary;
  fieldsOfStudy: StudyModeBreakdown[];
  stateBoardName?: string;
  /** The board's real reporting window. Absent when no board is configured. */
  period?: { start_year: number; end_year: number };
}

interface FieldCard {
  id: number;
  name: string;
  earned: number;
  required: number | null;
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
  imports: [DecimalPipe, Button, Dialog, NgIcon],
  providers: [provideIcons({ heroXMark })],
  templateUrl: './cpe-compliance-dialog.html',
})
export class CpeComplianceDialog {
  private readonly dialogRef = injectDialogRef<ComplianceDialogData>();

  private readonly _data = signal<ComplianceDialogData | null>(this.dialogRef.data ?? null);

  protected readonly credits = computed(() => this._data()?.credits ?? null);
  protected readonly year = computed(() => this._data()?.year ?? new Date().getFullYear());
  protected readonly stateBoardName = computed(() => this._data()?.stateBoardName || 'State Board');

  /** Without a configured requirement there is no denominator, so there is no gauge to draw. */
  protected readonly hasRequirement = computed(() => (this.credits()?.required ?? null) !== null);

  /**
   * The board's own reporting window. The old `{{ year }} - {{ year + 1 }}` was a guess that
   * printed a two-year cycle for every learner, including boards that report annually.
   */
  protected readonly periodLabel = computed(() => {
    const period = this._data()?.period;
    if (!period) return String(this.year());
    return period.start_year === period.end_year
      ? String(period.start_year)
      : `${period.start_year} - ${period.end_year}`;
  });

  protected readonly percent = computed(() => {
    const c = this.credits();
    if (!c?.required) return 0;
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
      percent:
        required && required > 0 ? Math.min(100, Math.round((f.credits / required) * 100)) : 0,
      color: FIELD_CARD_COLORS[f.name] ?? '#94A3B8',
    }));
  });

  protected close(): void {
    this.dialogRef.close();
  }
}
