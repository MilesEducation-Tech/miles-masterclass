import { DestroyRef, Service, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpContext } from '@angular/common/http';
import { Subject, from, of } from 'rxjs';
import { catchError, debounceTime, exhaustMap, switchMap, tap } from 'rxjs/operators';
import { ApiClient } from '@core/services/api-client/api-client';
import { NotificationService } from '@core/services/notification/notification';
import { Logger } from '@core/services/logger/logger';
import { CommonResponse, SKIP_ERROR_NOTIFICATION } from '@core/models/http.model';
import { BulkCertificateItem, CPE_TRACKER_ROUTES } from '@core/models/cpe-tracker.model';
import { CertificateTarget } from '@features/tracker/cpe/models/cpe-credit.model';
import { CertificateAccessPolicy } from './certificate-access-policy';
import { TrackerDialogOrchestrator } from './tracker-dialog-orchestrator';
import { DOWNLOAD_DEBOUNCE_MS } from '../constants/cpe-tracker.constants';
import {
  BlobDownloadItem,
  buildPdfFileName,
  downloadFiles,
  saveBlob,
} from '@shared/utils/blob-download';

/**
 * Certificate download operations:
 *   - NASBA template (xlsx blob).
 *   - Per-course certificate(s): fetch URLs from `user-assessment/download_certificate/`,
 *     download single PDF directly or zip multiple via JSZip.
 *   - Bulk year zip: fetch URLs from `user-assessment/download_bulk_certificate/`,
 *     same single/zip branching.
 *
 * Every entry point is serialized through a debounced exhaustMap stream to
 * avoid duplicate network calls when a user rapid-clicks. The actual
 * fetch+blob+save plumbing lives in `shared/utils/blob-download.ts` so the
 * dialog and the cpe-tracker service share one implementation.
 *
 * SSR-safe: any `window`/`fetch`/DOM access is guarded by `isPlatformBrowser`.
 */
@Service()
export class CertificateDownload {
  private readonly api = inject(ApiClient);
  private readonly notification = inject(NotificationService);
  private readonly logger = inject(Logger);
  private readonly dialogs = inject(TrackerDialogOrchestrator);
  private readonly accessPolicy = inject(CertificateAccessPolicy);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly nasbaTrigger = new Subject<void>();
  private readonly bulkTrigger = new Subject<{ year: number }>();

  constructor() {
    this.nasbaTrigger
      .pipe(
        debounceTime(DOWNLOAD_DEBOUNCE_MS),
        exhaustMap(() =>
          this.api
            .get<Blob>(CPE_TRACKER_ROUTES.downloadNasba.path, {
              responseType: 'blob',
              context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
            })
            .pipe(
              tap((blob) => saveBlob(blob, 'nasba-template.xlsx')),
              catchError((err) => {
                this.logger.error('CertificateDownload.nasba failed', err);
                this.notification.error('Download failed', 'Could not download NASBA template.');
                return of(null);
              }),
            ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.bulkTrigger
      .pipe(
        debounceTime(DOWNLOAD_DEBOUNCE_MS),
        exhaustMap(({ year }) =>
          this.api
            .post<CommonResponse<BulkCertificateItem[]>>(
              CPE_TRACKER_ROUTES.downloadAllCertificates.path,
              { year },
              { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) },
            )
            .pipe(
              switchMap((res) => {
                // Server returns a flat array; courses with multiple fields
                // of study show up as multiple rows with the same `id`.
                const items = (res?.data ?? []).filter((c) => !!c.certificate_url);
                if (items.length === 0) {
                  this.notification.info(
                    'Certificates',
                    'No certificates available for this year.',
                  );
                  return of(null);
                }
                const downloads: BlobDownloadItem[] = items.map((item) => ({
                  url: item.certificate_url,
                  suggestedName: buildPdfFileName(
                    item.title,
                    item.field_of_study_name,
                    `certificate-${item.id}`,
                  ),
                }));
                return from(downloadFiles(downloads, `certificates-${year}`)).pipe(
                  catchError((err) => {
                    this.logger.error('CertificateDownload.bulk save failed', err);
                    this.notification.error(
                      'Download failed',
                      'Could not bundle the certificates.',
                    );
                    return of(null);
                  }),
                );
              }),
              catchError((err) => {
                this.logger.error('CertificateDownload.bulk failed', err);
                this.notification.error(
                  'Download failed',
                  'Could not download certificates. Please try again later.',
                );
                return of(null);
              }),
            ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  downloadNasba(): void {
    this.nasbaTrigger.next();
  }

  downloadAllCertificates(year: number): void {
    // ponytail: the plan came from the removed session service; the policy
    // sees `null`, which is its no-subscription case.
    const decision = this.accessPolicy.decideBulk(null);
    if (decision !== 'allow') {
      this.dialogs
        .openDownloadRestricted(
          'Upgrade to an active subscription to download all of your certificates.',
        )
        .subscribe();
      return;
    }
    this.bulkTrigger.next({ year });
  }

  /**
   * Per-row certificate flow from the CPE tracker table.
   *
   * Mirrors the masterclass / podcast / micro-learning hero behavior: on
   * "allow", open the shared `CertificateDownloadDialog` (which handles its
   * own fetch + single-PDF / zipped-multi download + LinkedIn share button)
   * via the tracker orchestrator. On "upsellTrial", show the upgrade gate.
   *
   * Plan/access gating uses `accessPolicy.decide(plan)` — the per-row
   * variant, distinct from the bulk variant used by `downloadAllCertificates`.
   */
  downloadForRow(target: CertificateTarget): void {
    if (!this.isBrowser) return;
    // ponytail: see `downloadAllCertificates` — no plan to pass.
    const decision = this.accessPolicy.decide(null);
    if (decision !== 'allow') {
      this.dialogs
        .openDownloadRestricted('Upgrade to an active subscription to download this certificate.')
        .subscribe();
      return;
    }
    this.dialogs.openCertificateDownloadDialog(target);
  }
}
