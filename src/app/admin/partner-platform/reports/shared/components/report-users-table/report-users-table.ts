import { DecimalPipe, formatNumber } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideDownload, lucideEye } from '@ng-icons/lucide';
import { Button } from '@shared/ui/button/button';
import { Spinner } from '@shared/ui/spinner/spinner';
import { ReportSubject, ReportUserRow } from '../../models/partner-report.model';

/**
 * The per-user report roll-up. Dumb: every value is an input, every action an
 * output — the page owns the facade. Columns switch on `subject`, since the
 * courses and webinars roll-ups share only their identity + credit fields.
 */
@Component({
  selector: 'app-report-users-table',
  imports: [DecimalPipe, NgIcon, Button, Spinner],
  providers: [provideIcons({ lucideDownload, lucideEye })],
  templateUrl: './report-users-table.html',
  styleUrl: './report-users-table.css',
  host: { class: 'block w-full' },
})
export class ReportUsersTable {
  readonly rows = input.required<ReportUserRow[]>();
  readonly subject = input.required<ReportSubject>();
  readonly isLoading = input<boolean>(false);
  /** Disables every row's certificate button while one zip is being built. */
  readonly isDownloading = input<boolean>(false);
  readonly currentPage = input<number>(1);
  readonly pageSize = input<number>(30);
  readonly totalCount = input<number>(0);
  readonly hasNext = input<boolean>(false);
  readonly hasPrev = input<boolean>(false);

  readonly viewItems = output<ReportUserRow>();
  /** Zip of this user's certificates for the subject (fetched on click), a folder per course. */
  readonly downloadCertificates = output<ReportUserRow>();
  readonly prevPage = output<void>();
  readonly nextPage = output<void>();

  protected readonly isCourses = computed(() => this.subject() === 'courses');
  protected readonly canPrev = computed(() => this.hasPrev() && !this.isLoading());
  protected readonly canNext = computed(() => this.hasNext() && !this.isLoading());

  /** Averages are absent for the other subject and can be null — render an em dash, not "0". */
  protected dec(value: number | null | undefined): string {
    return value == null ? '—' : formatNumber(value, 'en-US', '1.0-2');
  }

  protected readonly pageWindow = computed(() => {
    const rowsLen = this.rows().length;
    const total = this.totalCount();
    if (rowsLen === 0) return { from: 0, to: 0, total };
    const from = (this.currentPage() - 1) * this.pageSize() + 1;
    return { from, to: from + rowsLen - 1, total };
  });
}
