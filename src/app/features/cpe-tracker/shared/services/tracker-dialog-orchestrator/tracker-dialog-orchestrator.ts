import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Dialog } from '../../../../../shared/core/services/dialog/dialog';
import {
  UtilsDialog,
  UtilsDialogData,
  DialogButton,
} from '../../../../../shared/components/dialog/utils-dialog/utils-dialog';
import {
  ComplianceDialogData,
  CpeComplianceDialog,
} from '../../../../../shared/components/dialog/cpe-compliance-dialog/cpe-compliance-dialog';
import {
  BadgeInfoDialog,
  BadgeInfoDialogResult,
} from '../../../../../shared/components/dialog/badge-info-dialog/badge-info-dialog';
import {
  BadgeClaimUpsellDialog,
  BadgeClaimUpsellDialogResult,
} from '../../../../../shared/components/dialog/badge-claim-upsell-dialog/badge-claim-upsell-dialog';
import {
  CertificateDialogData,
  CertificateDownloadDialog,
} from '../../../../../shared/components/dialog/certificate-download-dialog/certificate-download-dialog';
import { BadgeItem, ReportRow } from '../../../../../shared/core/models/cpe-tracker.model';
import { getCourseId, getCourseName } from '../../utils/course.util';

export interface DialogResult<T = unknown> {
  action?: DialogButton['action'];
  result: boolean;
  data?: T;
}

/**
 * Thin wrapper over `Dialog` that encapsulates every dialog the tracker opens.
 * Keeps all dialog copy + config in one place. Components and the facade only
 * know the intent ("open exam rules"), not the shared dialog used to render it.
 */
@Injectable({
  providedIn: 'root',
})
export class TrackerDialogOrchestrator {
  private readonly dialog = inject(Dialog);

  /**
   * Per-row certificate dialog — matches the dialog opened from the
   * masterclass / podcast / micro-learning course-hero sections. The dialog
   * fetches the certificate URL(s) on download click and handles single-PDF
   * vs. zipped-multi download internally; the share button surfaces the
   * Credly accept URL when one is available on the row's `user_badge`.
   *
   * Returns `null` when the row can't be mapped to a course id — callers can
   * skip silently. (Premiere/webinar rows with no `webinar_session_id` fall
   * into this bucket.)
   */
  openCertificateDownloadDialog(row: ReportRow): Observable<unknown> | null {
    const courseId = getCourseId(row);
    if (courseId == null) return null;

    const rawBadge = row.user_badge;
    // Show the share row whenever the row carries a user_badge — the dialog
    // claims on Share click when no `acceptUrl` is cached yet.
    const badge =
      rawBadge && (rawBadge.accept_url || rawBadge.id != null)
        ? {
            id: rawBadge.id ?? undefined,
            acceptUrl: rawBadge.accept_url ?? undefined,
            name: rawBadge.badge_name ?? undefined,
            image: rawBadge.badge_image ?? undefined,
            description: rawBadge.description ?? undefined,
          }
        : undefined;

    const data: CertificateDialogData = {
      courseId,
      // `transaction_type` already matches the backend's expected token
      // (`masterclass` / `podcast` / `nano_learning` / `webinar`).
      courseType: row.transaction_type,
      courseTitle: getCourseName(row),
      badge,
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

  /**
   * Subscription gate before badge claim. Shows the badge icon + a "Subscribe
   * Now" CTA; callers should route to `payment/plan` on a `confirm` result.
   */
  openClaimUpsell(badge: BadgeItem): Observable<BadgeClaimUpsellDialogResult | undefined> {
    return this.dialog.open<BadgeClaimUpsellDialog, BadgeClaimUpsellDialogResult>(
      BadgeClaimUpsellDialog,
      {
        maxWidth: '100%',
        panelClass: 'bg-transparent shadow-none',
        data: { badge },
      },
    ).afterClosed$;
  }

  /**
   * "View all" badge grid. Children emit per-card `claim`/`share` intents,
   * which the dialog forwards via `afterClosed$` with `data: BadgeItem`.
   */
  openBadgeInfo(badges: BadgeItem[]): Observable<BadgeInfoDialogResult | undefined> {
    return this.dialog.open<BadgeInfoDialog, BadgeInfoDialogResult>(BadgeInfoDialog, {
      maxWidth: '100%',
      panelClass: 'bg-transparent shadow-none',
      data: { badges },
    }).afterClosed$;
  }

  openCompliance(data: ComplianceDialogData): Observable<unknown> {
    return this.dialog.open<CpeComplianceDialog, unknown>(CpeComplianceDialog, {
      maxWidth: '100%',
      panelClass: 'bg-transparent shadow-none',
      data,
    }).afterClosed$;
  }
}
