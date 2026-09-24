import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Dialog } from '@core/services/dialog/dialog';
import {
  UtilsDialog,
  UtilsDialogData,
  DialogButton,
} from '@shared/dialogs/utils-dialog/utils-dialog';
import {
  ComplianceDialogData,
  CpeComplianceDialog,
} from '@features/tracker/cpe/dialogs/cpe-compliance-dialog/cpe-compliance-dialog';
import {
  CertificateDialogData,
  CertificateDownloadDialog,
} from '@shared/dialogs/certificate-download-dialog/certificate-download-dialog';
import { CertificateTarget } from '@features/tracker/cpe/models/cpe-credit.model';

export interface DialogResult<T = unknown> {
  action?: DialogButton['action'];
  result: boolean;
  data?: T;
}

/**
 * Thin wrapper over `Dialog` that encapsulates every dialog the tracker opens.
 * Keeps all dialog copy + config in one place. Callers only know the
 * intent ("open the certificate dialog"), not the shared dialog behind it.
 */
@Service()
export class TrackerDialogOrchestrator {
  private readonly dialog = inject(Dialog);

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

    return this.dialog.open<CertificateDownloadDialog, CertificateDialogData>(
      CertificateDownloadDialog,
      {
        maxWidth: '100%',
        enterAnimationDuration: '300ms',
        exitAnimationDuration: '300ms',
        data,
      },
    ).afterClosed$;
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
    return this.dialog.open<UtilsDialog, DialogResult>(UtilsDialog, { maxWidth: '100%', data })
      .afterClosed$;
  }

  openCompliance(data: ComplianceDialogData): Observable<unknown> {
    return this.dialog.open<CpeComplianceDialog, unknown>(CpeComplianceDialog, {
      maxWidth: '100%',
      panelClass: 'bg-transparent shadow-none',
      data,
    }).afterClosed$;
  }
}
