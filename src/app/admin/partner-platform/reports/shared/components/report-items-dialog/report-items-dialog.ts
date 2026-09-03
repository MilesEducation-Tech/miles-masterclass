import { DecimalPipe, formatNumber } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBookOpen } from '@ng-icons/lucide';
import { Button } from '../../../../../../shared/components/ui/button/button';
import { Spinner } from '../../../../../../shared/components/ui/spinner/spinner';
import { DialogRef } from '../../../../../../shared/core/services/dialog/dialog';
import { ReportItemRow, ReportSubject } from '../../models/partner-report.model';
import { PartnerReportFacade } from '../../services/partner-report-facade';

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
  imports: [DecimalPipe, NgIcon, Button, Spinner],
  providers: [provideIcons({ lucideBookOpen })],
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
    try {
      this.items.set(await this.facade.userItems(this.data.userId));
    } catch {
      this.errorMessage.set('Failed to load the details for this user.');
    } finally {
      this.isLoading.set(false);
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

  close(): void {
    this.dialogRef.close();
  }
}
