import { formatDate } from '@angular/common';
import {
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  injectAsync,
  signal,
  viewChild,
} from '@angular/core';
import { ReportPreviewBundle } from '@admin/partner-platform-v2/models/partner-report.model';
import { PartnerReportFacade } from '@admin/partner-platform-v2/services/partner-report-facade';
import { partnerErrorMessage, partnerLoadError } from '@admin/core/models/partner-platform.model';
import { injectDialogRef } from 'ng-primitives/dialog';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';
import { NotificationService } from '@core/services/notification/notification';
import { Button } from '@shared/ui/button/button';
import { Spinner } from '@shared/ui/spinner/spinner';
import { dash, executiveLede, reportingPeriodLabel } from './report-preview.format';

export interface PartnerReportPreviewDialogData {
  /** Network / firm name for the title. */
  partnerName: string;
  /** Roster email domains for the subtitle; empty = clause omitted. */
  domains: string[];
}

/**
 * The printable "Partner Learning Report": executive summary + Courses-by-user
 * + Webinars-by-user for the Reports page's current scope and dates, with a
 * PDF download. Styled in the learner-facing Masterclass theme (root tokens),
 * not the admin navy — the dialog is appended to <body>, outside
 * `.admin-theme`, so `var(--background)` etc. resolve to the public palette.
 * Reads through the route-scoped `PartnerReportFacade`, so open it with the
 * page's `EnvironmentInjector` as the dialog's `injector`.
 */
@Component({
  selector: 'app-partner-report-preview-dialog',
  imports: [Button, Spinner, DialogShell],
  templateUrl: './partner-report-preview-dialog.html',
  styleUrl: './partner-report-preview-dialog.css',
})
export class PartnerReportPreviewDialog implements OnInit {
  private readonly dialogRef = injectDialogRef<PartnerReportPreviewDialogData>();
  protected readonly data = this.dialogRef.data;

  private readonly facade = inject(PartnerReportFacade);
  private readonly notification = inject(NotificationService);
  // Lazy — jspdf + html2canvas-pro load only when someone actually downloads.
  private readonly pdfService = injectAsync(() =>
    import('@core/services/html-to-pdf/html-to-pdf').then((m) => m.HtmlToPdf),
  );

  /** The captured element — paints its own white background (see the CSS). */
  private readonly reportRoot = viewChild<ElementRef<HTMLElement>>('reportRoot');

  protected readonly bundle = signal<ReportPreviewBundle | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly exporting = signal(false);
  /** Loaded, but nothing may be fetched (super without a scope) — same copy as the page. */
  protected readonly needsScope = computed(
    () => !this.loading() && !this.error() && this.bundle() === null,
  );

  protected readonly period = computed(() => {
    const b = this.bundle();
    return b ? reportingPeriodLabel(b.dateFrom, b.dateTo, b.generatedAt) : '';
  });
  protected readonly generatedOn = computed(() => {
    const b = this.bundle();
    return b ? formatDate(b.generatedAt, 'MMM d, y', 'en-US') : '';
  });
  protected readonly lede = computed(() => {
    const b = this.bundle();
    return b ? executiveLede(this.data.partnerName, b.courses.summary, b.webinars.summary) : '';
  });
  protected readonly domainClause = computed(() =>
    this.data?.domains.length
      ? ` — ${this.data.domains.map((d) => `@${d}`).join(', ')} roster`
      : '',
  );

  protected readonly dash = dash;

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.bundle.set(await this.facade.loadPreviewBundle());
    } catch (err) {
      this.error.set(partnerLoadError(err, 'Failed to load the report.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected async downloadPdf(): Promise<void> {
    const el = this.reportRoot()?.nativeElement;
    if (!el || this.exporting()) return; // the service throws on a concurrent capture
    this.exporting.set(true);
    try {
      // Inter Tight is the app's own webfont (index.html); make sure it's in
      // before the raster so the PDF isn't set in a fallback face.
      await document.fonts?.load('600 16px "Inter Tight"').catch(() => undefined);
      const pdf = await this.pdfService();
      await pdf.convertToPdf(el, {
        filename: `partner-learning-report-${this.slug()}-${this.stamp()}.pdf`,
        // One page sized to the document — mirrors the HTML, never cuts a row.
        pageSize: 'Auto',
        imageQuality: 0.92,
        exclude: { classes: ['no-print'] },
      });
    } catch (err) {
      this.notification.error('PDF failed', partnerErrorMessage(err));
    } finally {
      this.exporting.set(false);
    }
  }

  private slug(): string {
    return (
      this.data.partnerName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'partner'
    );
  }

  private stamp(): string {
    return formatDate(this.bundle()?.generatedAt ?? new Date(), 'yyyyMMdd', 'en-US');
  }
}
