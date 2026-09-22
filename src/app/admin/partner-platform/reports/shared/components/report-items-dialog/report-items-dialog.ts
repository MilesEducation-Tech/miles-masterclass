import { DecimalPipe, formatNumber } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBookOpen, lucideDownload } from '@ng-icons/lucide';
import { Button } from '@shared/ui/button/button';
import { Spinner } from '@shared/ui/spinner/spinner';
import { DialogRef } from '@core/services/dialog/dialog';
import { ReportCertificate, ReportItemRow, ReportSubject } from '../../models/partner-report.model';
import { PartnerReportFacade } from '../../services/partner-report-facade';
import { TabStrip } from '@shared/ui/tab-strip/tab-strip';
import { CertificateDownloadProgress } from '../certificate-download-progress/certificate-download-progress';

export interface ReportItemsDialogData {
  userId: number;
  userName: string;
  subject: ReportSubject;
}

/**
 * Report drill-down: every course or webinar behind one user's roll-up row.
 *
 * `data` and `dialogRef` are property-injected by the `Dialog` service after
 * construction, so the fetch is kicked off in `ngOnInit` — they aren't readable
 * in a field initializer.
 */
@Component({
  selector: 'app-report-items-dialog',
  imports: [DecimalPipe, NgIcon, Button, Spinner, TabStrip, CertificateDownloadProgress],
  providers: [provideIcons({ lucideBookOpen, lucideDownload })],
  templateUrl: './report-items-dialog.html',
})
export class ReportItemsDialog implements OnInit {
  /** Set by the Dialog service immediately after construction. */
  dialogRef!: DialogRef<ReportItemsDialog>;
  data!: ReportItemsDialogData;

  protected readonly facade = inject(PartnerReportFacade);

  protected readonly items = signal<ReportItemRow[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');

  protected readonly isCourses = computed(() => this.data?.subject === 'courses');

  // ---- Delivery-type filter (courses only) ---------------------------------
  // Chip values come from `GET .../filters/`; no list endpoint accepts them as
  // query params, so the filtering is client-side over the loaded rows.

  protected readonly selectedType = signal('all');

  /** Delivery types worth a chip: offered by filters/ AND present in the rows. */
  protected readonly typeOptions = computed<string[]>(() => {
    if (!this.isCourses()) return [];
    const present = new Set(
      this.items()
        .map((i) => i.course_type?.toLowerCase() ?? '')
        .filter(Boolean),
    );
    const offered = this.facade.deliveryTypes().filter((t) => present.has(t.toLowerCase()));
    // Fall back to the distinct row values if filters/ and the rows disagree.
    const options = offered.length ? offered : [...present];
    return options.length > 1 ? options : [];
  });

  protected readonly visibleItems = computed<ReportItemRow[]>(() => {
    const type = this.selectedType();
    if (type === 'all') return this.items();
    return this.items().filter((i) => (i.course_type ?? '').toLowerCase() === type.toLowerCase());
  });

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    // Independent requests, independent failure states: a certificate hiccup
    // must not blank the course list, and vice versa.
    await Promise.all([this.loadItems(), this.loadCertificates()]);
  }

  private async loadItems(): Promise<void> {
    try {
      this.items.set(await this.facade.userItems(this.data.userId));
    } catch {
      this.errorMessage.set('Failed to load the details for this user.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Certificates come from their own endpoint; one fetch serves every per-item button and the footer zip. */
  protected async loadCertificates(): Promise<void> {
    this.certificatesLoading.set(true);
    this.certificatesError.set('');
    try {
      this.certificates.set(await this.facade.userCertificates(this.data.userId));
    } catch {
      this.certificatesError.set('Certificates could not be loaded.');
    } finally {
      this.certificatesLoading.set(false);
    }
  }

  /** Feedback is nullable — render an em dash rather than a misleading "0". */
  protected dec(value: number | null | undefined): string {
    return value == null ? '—' : formatNumber(value, 'en-US', '1.0-2');
  }

  /** Absent for webinars, and 0% is a real value — so null and 0 must read differently. */
  protected progress(value: number | null | undefined): string {
    return value == null ? '—' : `${formatNumber(value, 'en-US', '1.0-1')}%`;
  }

  /** app-tab-strip speaks labels — "All" plus one per delivery type present. */
  protected readonly tabLabels = computed(() => [
    'All',
    ...this.typeOptions().map((t) => this.badgeLabel(t)),
  ]);
  protected readonly activeTabLabel = computed(() =>
    this.selectedType() === 'all' ? 'All' : this.badgeLabel(this.selectedType()),
  );
  protected onTabChange(label: string): void {
    if (label === 'All') return this.selectedType.set('all');
    const type = this.typeOptions().find((t) => this.badgeLabel(t) === label);
    if (type) this.selectedType.set(type);
  }

  protected badgeLabel(courseType: string | undefined): string {
    const map: Record<string, string> = {
      masterclass: 'Masterclass',
      podcast: 'Podcast',
      nano_learning: 'Micro-learning',
      micro_learning: 'Micro-learning',
      webinar: 'Webinar',
    };
    return map[courseType?.toLowerCase() ?? ''] ?? courseType ?? 'Course';
  }

  protected exportItems(): void {
    void this.facade.exportCsv('user-items', this.data.userId);
  }

  // ---- Certificates ----------------------------------------------------------

  /** This user's downloadable certificates for the subject — the footer zips all of them. */
  protected readonly certificates = signal<ReportCertificate[]>([]);
  protected readonly certificatesLoading = signal(true);
  protected readonly certificatesError = signal('');

  /** Matched on the course id (webinar id under the webinars subject). */
  protected certificateFor(item: ReportItemRow): ReportCertificate | undefined {
    const id = this.isCourses() ? item.course_id : item.webinar_id;
    return this.certificates().find((c) => c.course_id === id);
  }

  /** One PDF, saved directly (never zipped). */
  protected downloadCertificate(item: ReportItemRow): void {
    const cert = this.certificateFor(item);
    if (cert) void this.facade.downloadCertificate(this.data.userName, cert);
  }

  protected downloadAllCertificates(): void {
    void this.facade.downloadCertificates(this.data.userName, this.certificates());
  }

  close(): void {
    this.dialogRef.close();
  }
}
