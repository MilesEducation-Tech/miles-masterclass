import { Service, inject } from '@angular/core';
import { Observable, from, switchMap } from 'rxjs';
import { NgpDialogManager } from 'ng-primitives/dialog';
// Types only: each dialog loads with `import()` when opened (PROMPT.md §4.4).
import type {
  UtilsDialogData,
  DialogButton,
  UtilsDialogResult,
} from '@shared/dialogs/utils-dialog/utils-dialog';
import type { ComplianceDialogData } from '@features/tracker/cpe/dialogs/cpe-compliance-dialog/cpe-compliance-dialog';
import type { CertificateDialogData } from '@shared/dialogs/certificate-download-dialog/certificate-download-dialog';
import { CertificateTarget } from '@features/tracker/cpe/models/cpe-credit.model';

export interface DialogResult<T = unknown> {
  action?: DialogButton['action'];
  result: boolean;
  data?: T;
}

/**
 * Thin wrapper over `NgpDialogManager` that encapsulates every dialog the tracker opens.
 * Keeps all dialog copy + config in one place. Callers only know the
 * intent ("open the certificate dialog"), not the shared dialog behind it.
 *
 * Each dialog opens as soon as its chunk arrives, whether or not the caller
 * subscribes (the open sits in the promise, not in the stream), so fire-and-forget
 * callers behave as they did with the static import.
 */
@Service()
export class TrackerDialogOrchestrator {
  private readonly dialogs = inject(NgpDialogManager);

  /**
   * Per-row certificate dialog — the same one the masterclass / podcast /
   * micro-learning course-hero sections open. It fetches the certificate URL(s)
   * on download click and handles single-PDF vs. zipped-multi internally; the
   * share button surfaces the Credly accept URL when the row carries a badge.
   *
   * Takes a resolved `CertificateTarget` rather than a wire row, so this stays
   * independent of whichever API shape the tracker is reading this month.
   */
  openCertificateDownloadDialog(target: CertificateTarget): Observable<unknown> {
    const data: CertificateDialogData = {
      courseId: target.courseId,
      courseType: target.courseType,
      courseTitle: target.courseTitle,
      badge: target.badge,
    };

    return from(
      import('@shared/dialogs/certificate-download-dialog/certificate-download-dialog').then(
        ({ CertificateDownloadDialog }) => this.dialogs.open(CertificateDownloadDialog, { data }),
      ),
    ).pipe(switchMap((ref) => ref.afterClosed));
  }

  openDownloadRestricted(message: string): Observable<DialogResult | undefined> {
    const data: UtilsDialogData = {
      title: 'Download Restricted',
      containerClass: 'flex flex-col space-y-4 text-left',
      content: [{ type: 'text', value: message }],
      buttons: [
        { label: 'Close', variant: 'outline', action: 'close' },
        { label: 'Upgrade', variant: 'default', action: 'confirm' },
      ],
    };
    return from(
      import('@shared/dialogs/utils-dialog/utils-dialog').then(({ UtilsDialog }) =>
        this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
          data: { ...data, maxWidth: '100%' },
        }),
      ),
    ).pipe(switchMap((ref) => ref.afterClosed));
  }

  openCompliance(data: ComplianceDialogData): Observable<unknown> {
    return from(
      import('@features/tracker/cpe/dialogs/cpe-compliance-dialog/cpe-compliance-dialog').then(
        ({ CpeComplianceDialog }) => this.dialogs.open(CpeComplianceDialog, { data }),
      ),
    ).pipe(switchMap((ref) => ref.afterClosed));
  }
}
