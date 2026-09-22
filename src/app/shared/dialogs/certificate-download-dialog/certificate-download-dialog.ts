import { Component, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, of } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroAcademicCap, heroCheckBadge, heroXMark } from '@ng-icons/heroicons/outline';
import { Button } from '../../ui/button/button';
import { DialogRef } from '@core/services/dialog/dialog';
import { ApiClient } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { DownloadCertificateItem, MASTERCLASS_ROUTES } from '@core/models/masterclass.model';
import { CommonResponse, RouteRequest } from '@core/models/http.model';
import { phosphorDownloadSimpleFill, phosphorShareFatFill } from '@ng-icons/phosphor-icons/fill';
import { BlobDownloadItem, buildPdfFileName, downloadFiles } from '../../utils/blob-download';
import { Analytics } from '@core/services/analytics/analytics';
import { Utils } from '@shared/services/utils';

/**
 * Rich badge payload sourced from `user_badge` on the course / webinar /
 * tracker row response. The share section renders whenever the row carries
 * a `user_badge` — either branch (`acceptUrl` known vs. `id`-only) gives the
 * Share button something to do:
 *   - `acceptUrl` set                 → button opens it directly.
 *   - `acceptUrl` undefined, `id` set → button calls `user-badges/:id/claim/`
 *                                       then opens the returned share URL.
 *
 * Callers should populate at minimum one of the two. Both `null` means the
 * server hasn't issued a badge for this user yet — skip passing `badge` at all.
 */
export interface DialogBadge {
  /** Credly accept URL when already known; falsy → claim on share click. */
  acceptUrl?: string;
  /** User badge id — used to call the claim endpoint when `acceptUrl` is unset. */
  id?: number;
  name?: string;
  image?: string;
  description?: string;
}

export interface CertificateDialogData {
  /** Required to call `user-assessment/download_certificate/` on download click. */
  courseId: number;
  /** Backend-facing course type, e.g. `masterclass` / `podcast` / `nano_learning` / `webinar`. */
  courseType: string;
  /** Used to build human-readable filenames for downloads (single PDF + zip entries). */
  courseTitle?: string;
  /**
   * Credly / LinkedIn shareable badge sourced from the response's `user_badge`
   * object. Surfaces image + name + description in the dialog alongside the
   * NASBA certificate, with a share CTA that opens `acceptUrl` in a new tab.
   */
  badge?: DialogBadge;
  /**
   * Webinar-specific filter — selects which certificate variant the backend
   * returns (`'nasba'`, `'miles'`, or `'both'`). Pulled from the webinar
   * payload's `certificate_type` field. Omit for masterclass / podcast.
   */
  certificateType?: 'nasba' | 'miles' | 'both';
}

type DownloadCertificateRequest = RouteRequest<typeof MASTERCLASS_ROUTES.downloadCertificate>;
type DownloadCertificateResponse = CommonResponse<DownloadCertificateItem[]>;

/** Sentinel returned by the catchError branch so subscribe() can distinguish API failure from empty data. */
const FETCH_ERRORED = Symbol('fetch_errored');
type FetchResult = DownloadCertificateItem[] | typeof FETCH_ERRORED;

/**
 * Which certificate variant a download click is for. The dialog can render
 * both rows (`certificateType: 'both'`) so the click target has to be passed
 * through the fetch + filter step so the right URL field is picked.
 */
type CertificateVariant = 'nasba' | 'miles';

@Component({
  selector: 'app-certificate-download-dialog',
  standalone: true,
  imports: [CommonModule, NgIcon, Button],
  templateUrl: './certificate-download-dialog.html',
  styleUrl: './certificate-download-dialog.css',
  viewProviders: [
    provideIcons({
      phosphorDownloadSimpleFill,
      phosphorShareFatFill,
      heroAcademicCap,
      heroCheckBadge,
      heroXMark,
    }),
  ],
})
export class CertificateDownloadDialog implements OnInit {
  dialogRef!: DialogRef<CertificateDownloadDialog>;
  data!: CertificateDialogData;

  private readonly api = inject(ApiClient);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly analytics = inject(Analytics);
  private readonly utils = inject(Utils);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /**
   * Per-variant in-flight flags. Two variants can be visible at once
   * (`certificateType: 'both'`) and a download click for one shouldn't
   * disable the other — each button reads its own signal so the user can
   * kick off Miles + NASBA fetches in parallel.
   */
  readonly downloadingNasba = signal(false);
  readonly downloadingMiles = signal(false);

  /**
   * Cached Credly share URL. Seeded from `data.badge.acceptUrl` at open;
   * populated post-claim when the badge had no URL upfront. Reading via a
   * signal so the template can react after an async claim resolves.
   */
  readonly acceptUrl = signal<string | null>(null);
  /** In-flight flag for the on-click claim path. */
  readonly sharing = signal(false);

  ngOnInit(): void {
    this.acceptUrl.set(this.data?.badge?.acceptUrl ?? null);
  }

  /** Returns the per-variant flag — keeps the template terse. */
  isDownloading(variant: CertificateVariant): boolean {
    return variant === 'nasba' ? this.downloadingNasba() : this.downloadingMiles();
  }

  private setDownloading(variant: CertificateVariant, value: boolean): void {
    if (variant === 'nasba') this.downloadingNasba.set(value);
    else this.downloadingMiles.set(value);
  }

  /**
   * Visibility rules for the NASBA section. Webinar callers set
   * `certificateType` to one of `'nasba' | 'miles' | 'both'`; everyone else
   * leaves it undefined, where NASBA is the default (and only) variant.
   */
  get showNasba(): boolean {
    const t = this.data.certificateType;
    return t === undefined || t === 'nasba' || t === 'both';
  }

  /** Visibility rules for the Miles section — only set explicitly for webinars. */
  get showMiles(): boolean {
    return this.data.certificateType === 'miles' || this.data.certificateType === 'both';
  }

  close(): void {
    this.dialogRef.close();
  }

  /**
   * Share-button handler.
   *
   *   - URL already cached → just open it.
   *   - Badge `id` known   → hit `user-badges/:id/claim/`, cache the resulting
   *                          `credly_accept_url`, then open it. Server is expected to
   *                          be idempotent so a repeat claim returns the same
   *                          URL — safe even after the auto-claim that fires
   *                          on dialog open in `Utils.triggerCredlyHandoff`.
   *   - Neither            → toast + bail (defensive; the template gates the
   *                          button on having one of the two anyway).
   */
  share(): void {
    if (!this.isBrowser) return;
    const cached = this.acceptUrl();
    if (cached) {
      window.open(cached, '_blank', 'noopener,noreferrer');
      return;
    }
    const id = this.data?.badge?.id;
    if (id == null) {
      this.notification.error('Share failed', 'Badge is not available to share yet.');
      return;
    }
    if (this.sharing()) return;
    this.sharing.set(true);
    this.utils
      .claimBadge(id)
      .pipe(
        catchError((err) => {
          this.logger.error('CertificateDownloadDialog.share claim failed', err);
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.sharing.set(false);
        const url = this.utils.claimAcceptUrl(res);
        if (!url) {
          this.notification.error('Share failed', 'Could not claim the badge right now.');
          return;
        }
        this.acceptUrl.set(url);
        window.open(url, '_blank', 'noopener,noreferrer');
      });
  }

  /**
   * Trigger certificate download for the given variant. The API is hit lazily
   * on click (not on dialog open) so a user who closes the dialog without
   * downloading never pays for the network call.
   *
   *   - 1 cert  → fetch as blob and download with the certificate's URL filename
   *   - >1 cert → fetch all in parallel, zip via JSZip (lazy import), download .zip
   *
   * API failure shows the error notification once; an empty response shows
   * the "No certificate" info notification once — never both.
   */
  download(variant: CertificateVariant = 'nasba'): void {
    if (!this.isBrowser) return;
    // Per-variant guard — only blocks the same variant being re-clicked while
    // its fetch is in flight. The other variant stays clickable.
    if (this.isDownloading(variant)) return;

    this.setDownloading(variant, true);
    this.fetchCertificates(variant).subscribe((result) => {
      if (result === FETCH_ERRORED) {
        // Notification already shown inside catchError; just clear loading.
        this.setDownloading(variant, false);
        return;
      }
      if (result.length === 0) {
        this.notification.info('Certificate', 'No certificate is available yet.');
        this.setDownloading(variant, false);
        return;
      }
      this.runDownload(result, variant).finally(() => this.setDownloading(variant, false));
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private fetchCertificates(variant: CertificateVariant): Observable<FetchResult> {
    // For webinar-style callers we send the explicit variant the user clicked;
    // for masterclass / podcast we keep the legacy behaviour of omitting
    // `certificate_type` so the backend's default response stays unchanged.
    const requestType = this.data.certificateType ? variant : undefined;
    const body: DownloadCertificateRequest = {
      course_id: this.data.courseId,
      course_type: this.data.courseType,
      ...(requestType ? { certificate_type: requestType } : {}),
    };

    return this.api
      .post<DownloadCertificateResponse>(MASTERCLASS_ROUTES.downloadCertificate.path, body)
      .pipe(
        // Filter out rows missing the URL for the requested variant — defensive
        // against partial backend responses (e.g. a row with miles only when
        // nasba was asked for).
        map<DownloadCertificateResponse, FetchResult>((res) =>
          (res?.data ?? []).filter((c) => !!pickUrl(c, variant)),
        ),
        catchError<FetchResult, Observable<FetchResult>>((err) => {
          this.logger.error('CertificateDownloadDialog.fetch failed', err);
          this.notification.error('Download failed', 'Could not load the certificate.');
          return of(FETCH_ERRORED);
        }),
        takeUntilDestroyed(this.destroyRef),
      );
  }

  private async runDownload(
    certs: DownloadCertificateItem[],
    variant: CertificateVariant,
  ): Promise<void> {
    const items: BlobDownloadItem[] = certs.map((cert) => ({
      url: pickUrl(cert, variant)!,
      suggestedName: buildPdfFileName(
        this.data.courseTitle,
        cert.field_of_study_name,
        `${variant}-certificate-${cert.certificate_id}`,
      ),
    }));
    try {
      await downloadFiles(items, this.zipBaseName(variant));
      this.analytics.trackEvent('certificate_download', {
        course_id: this.data.courseId,
        course_type: this.data.courseType,
        certificate_type: variant,
        count: certs.length,
      });
    } catch (err) {
      this.logger.error('CertificateDownloadDialog.runDownload failed', err);
      this.notification.error(
        'Download failed',
        certs.length === 1
          ? 'Could not download the certificate.'
          : 'Could not bundle the certificates.',
      );
    }
  }

  /** Zip filename stem — `{slugified-title}-{variant}` if available, else `{variant}-certificate-{courseId}`. */
  private zipBaseName(variant: CertificateVariant): string {
    const title = this.data.courseTitle?.trim();
    if (title) {
      return buildPdfFileName(title, null, `${variant}-certificate-${this.data.courseId}`).replace(
        /\.pdf$/,
        '',
      );
    }
    return `${variant}-certificate-${this.data.courseId}`;
  }
}

/** Pull the right URL field off a row based on which variant was clicked. */
function pickUrl(cert: DownloadCertificateItem, variant: CertificateVariant): string | undefined {
  return variant === 'miles' ? cert.miles_certificate_url : cert.nasba_certificate_url;
}
