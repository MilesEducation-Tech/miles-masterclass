import { isPlatformBrowser } from '@angular/common';
import { HttpResponse } from '@angular/common/http';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { ApiClient } from '../../../../../shared/core/services/api-client/api-client';
import { Logger } from '../../../../../shared/core/services/logger/logger';
import { NotificationService } from '../../../../../shared/core/services/notification/notification';
import {
  BlobDownloadItem,
  buildPdfFileName,
  downloadFiles,
  DownloadProgress,
  FAILED_MANIFEST_NAME,
  isAbortError,
  fileNameFromContentDisposition,
  sanitizeFileName,
  saveBlob,
} from '../../../../../shared/utils/blob-download';
import {
  adminContext,
  EMPTY_PAGINATION,
  PartnerPagination,
  partnerBlobErrorMessage,
  partnerLoadError,
} from '../../../shared/models/partner-platform.model';
import { PartnerAdminMe } from '../../../shared/services/partner-admin-me';
import {
  ReportBase,
  ReportCertificate,
  ReportCertificatesResponse,
  ReportCertificateUser,
  ReportExportView,
  ReportFilters,
  ReportItemRow,
  ReportItemsResponse,
  ReportPreviewBundle,
  ReportPreviewSubject,
  ReportSubject,
  ReportSummary,
  ReportUserRow,
  ReportUsersResponse,
  reportUrl,
} from '../models/partner-report.model';

/** API default for the users list (max 200). */
const PAGE_SIZE = 30;

/** The shared base + scope + filter set every report call carries. */
interface ReportParams {
  base: ReportBase;
  subject: ReportSubject;
  dateFrom: string;
  dateTo: string;
  networkId: number | null;
  firmId: number | null;
}

/** What the progress strip renders: the job's label plus the helper's live counters. */
export interface CertificateDownloadProgress extends Omit<DownloadProgress, 'phase'> {
  label: string;
  /** `listing` = waiting on the certificates API, before any PDF is fetched. */
  phase: DownloadProgress['phase'] | 'listing';
}

/**
 * Partner Platform reports, both audiences:
 *
 *   - Django `super` admins call `partners/superadmin/report/…`, which requires
 *     exactly one of `network_id`/`firm_id` — nothing fetches until a scope is
 *     picked, so an unscoped admin never fires a 400.
 *   - Django `network`/`firm` admins call `partners/panel/report/…`, which is
 *     auto-scoped server-side and gated on `report:network:read` /
 *     `report:firm:read` — we never send a scope param there, and we don't
 *     fetch without the capability.
 *
 * Either way `PartnerAdminMe` is the fail-closed check: a Supabase admin with
 * the console perm but no Django row fetches nothing.
 */
// Route-scoped (see admin.routes.ts): the injector dies on navigation, which
// aborts in-flight resource() loads and stops this page's calls firing elsewhere.
@Injectable()
export class PartnerReportFacade {
  private readonly api = inject(ApiClient);
  private readonly me = inject(PartnerAdminMe);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Rows per page — the API accepts up to 200. */
  readonly pageSize = signal(PAGE_SIZE);

  setPageSize(size: number): void {
    this.pageSize.set(Math.min(200, Math.max(10, Math.trunc(size) || PAGE_SIZE)));
  }

  // ---- Filters -------------------------------------------------------------

  readonly subject = signal<ReportSubject>('courses');
  /** ISO `YYYY-MM-DD`, empty = unbounded. */
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly pageNumber = signal(1);

  /** Super-admin scope picker — exactly one of these, ignored for panel admins. */
  readonly scopeNetworkId = signal<number | null>(null);
  readonly scopeFirmId = signal<number | null>(null);

  /** Supers use the superadmin base + explicit scope; everyone else the panel base. */
  readonly isSuper = computed(() => this.me.role() === 'super');
  private readonly base = computed<ReportBase>(() => (this.isSuper() ? 'superadmin' : 'panel'));
  /** Supers must pick a target before anything can be fetched; panel admins are pre-scoped. */
  readonly needsScope = computed(
    () => this.isSuper() && this.scopeNetworkId() == null && this.scopeFirmId() == null,
  );

  selectNetwork(id: number | null): void {
    this.scopeNetworkId.set(id);
    this.scopeFirmId.set(null);
  }

  selectFirm(id: number | null): void {
    this.scopeFirmId.set(id);
    this.scopeNetworkId.set(null);
  }

  setSubject(value: ReportSubject): void {
    this.subject.set(value);
  }

  setPage(page: number): void {
    if (page < 1) return;
    this.pageNumber.set(page);
  }

  /** null while the report can't (or mustn't) be fetched — every resource keys off this. */
  private readonly reportParams = computed<ReportParams | null>(() => {
    if (!this.isBrowser || this.me.isLoading()) return null;
    if (this.isSuper()) {
      if (this.needsScope()) return null;
    } else {
      // Panel base: needs a partner-admin row with a report-read capability.
      if (!this.me.canReadReports()) return null;
    }
    return {
      base: this.base(),
      subject: this.subject(),
      dateFrom: this.dateFrom(),
      dateTo: this.dateTo(),
      // Scope params are a superadmin-only concept — the panel base is
      // auto-scoped and must never receive one.
      networkId: this.isSuper() ? this.scopeNetworkId() : null,
      firmId: this.isSuper() ? this.scopeFirmId() : null,
    };
  });

  /** Only the params the backend actually accepts, and only when set. */
  private buildHttpParams(p: ReportParams): Record<string, string | number> {
    const params: Record<string, string | number> = { subject: p.subject };
    if (p.dateFrom) params['date_from'] = p.dateFrom;
    if (p.dateTo) params['date_to'] = p.dateTo;
    if (p.networkId != null) params['network_id'] = p.networkId;
    if (p.firmId != null) params['firm_id'] = p.firmId;
    return params;
  }

  constructor() {
    // Leaving the page kills this route-scoped facade — take the download with it
    // rather than let orphaned fetches finish into a component that's gone.
    inject(DestroyRef).onDestroy(() => this.cancelDownload());

    // Any filter change invalidates the page cursor — a row on page 3 of the
    // old filter set is meaningless under the new one.
    effect(() => {
      this.subject();
      this.dateFrom();
      this.dateTo();
      this.scopeNetworkId();
      this.scopeFirmId();
      this.pageSize();
      untracked(() => {
        if (this.pageNumber() !== 1) this.pageNumber.set(1);
      });
    });
  }

  // ---- Summary (stat cards) ------------------------------------------------

  private readonly summaryResource = resource({
    params: () => this.reportParams() ?? undefined,
    loader: ({ params, abortSignal }) =>
      firstValueFrom(
        this.api
          .get<ReportSummary>(reportUrl(params.base, 'summary/'), {
            params: this.buildHttpParams(params),
            context: adminContext(),
          })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
      ),
  });

  readonly summary = computed<ReportSummary | undefined>(() => this.summaryResource.value());
  readonly summaryLoading = computed(() => this.summaryResource.isLoading());
  readonly summaryError = computed(() =>
    partnerLoadError(this.summaryResource.error(), 'Failed to load the report summary.'),
  );

  // ---- Per-user roll-up ----------------------------------------------------

  private readonly usersResource = resource({
    params: () => {
      const p = this.reportParams();
      return p ? { ...p, page: this.pageNumber(), pageSize: this.pageSize() } : undefined;
    },
    loader: ({ params, abortSignal }) =>
      firstValueFrom(
        this.api
          .get<ReportUsersResponse>(reportUrl(params.base, 'users/'), {
            params: {
              ...this.buildHttpParams(params),
              page: params.page,
              page_size: params.pageSize,
            },
            context: adminContext(),
          })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        {
          defaultValue: {
            users: [],
            pagination_data: EMPTY_PAGINATION,
          } as ReportUsersResponse,
        },
      ),
  });

  readonly users = computed<ReportUserRow[]>(() => this.usersResource.value()?.users ?? []);
  readonly usersLoading = computed(() => this.usersResource.isLoading());
  readonly usersError = computed(() =>
    partnerLoadError(this.usersResource.error(), 'Failed to load the user report.'),
  );

  private readonly pagination = computed<PartnerPagination>(
    () => this.usersResource.value()?.pagination_data ?? EMPTY_PAGINATION,
  );
  readonly totalCount = computed(() => this.pagination().total_count);
  readonly hasPrevPage = computed(() => this.pagination().previous_page != null);
  readonly hasNextPage = computed(() => this.pagination().next_page != null);

  reload(): void {
    this.summaryResource.reload();
    this.usersResource.reload();
  }

  // ---- Drill-down ----------------------------------------------------------

  /**
   * One row per course/webinar for a single user. Fetched on demand by the
   * drill-down dialog (once, in `ngOnInit`) rather than through a `resource()`.
   * Throws so the dialog can render its own error state.
   */
  async userItems(userId: number): Promise<ReportItemRow[]> {
    const p = this.reportParams();
    if (!p) return [];
    const res = await firstValueFrom(
      this.api.get<ReportItemsResponse>(reportUrl(p.base, 'user-items/'), {
        params: { ...this.buildHttpParams(p), user_id: userId },
        context: adminContext(),
      }),
    );
    return res?.items ?? [];
  }

  // ---- Printable preview ---------------------------------------------------

  /**
   * Both subjects at once — summary + EVERY users page — for the
   * "Partner Learning Report" preview. Builds its own param sets instead of
   * flipping the `subject` signal, which would reset the page and refetch its
   * resources. `null` when nothing may be fetched (super without a scope,
   * panel admin without report-read). Throws so the dialog can render an error.
   */
  async loadPreviewBundle(): Promise<ReportPreviewBundle | null> {
    const p = this.reportParams();
    if (!p) return null;

    const summary = (subject: ReportSubject) =>
      firstValueFrom(
        this.api.get<ReportSummary>(reportUrl(p.base, 'summary/'), {
          params: this.buildHttpParams({ ...p, subject }),
          context: adminContext(),
        }),
      );
    const allUsers = async (subject: ReportSubject): Promise<ReportUserRow[]> => {
      const rows: ReportUserRow[] = [];
      let page: number | null = 1;
      while (page != null) {
        const res: ReportUsersResponse = await firstValueFrom(
          this.api.get<ReportUsersResponse>(reportUrl(p.base, 'users/'), {
            params: { ...this.buildHttpParams({ ...p, subject }), page, page_size: 200 },
            context: adminContext(),
          }),
        );
        rows.push(...(res?.users ?? []));
        page = res?.pagination_data?.next_page ?? null;
      }
      return rows;
    };

    const [coursesSummary, webinarsSummary, coursesUsers, webinarsUsers] = await Promise.all([
      summary('courses'),
      summary('webinars'),
      allUsers('courses'),
      allUsers('webinars'),
    ]);
    const pack = (s: ReportSummary, users: ReportUserRow[]): ReportPreviewSubject => ({
      summary: s,
      users,
    });
    return {
      generatedAt: new Date().toISOString(),
      dateFrom: p.dateFrom,
      dateTo: p.dateTo,
      courses: pack(coursesSummary, coursesUsers),
      webinars: pack(webinarsSummary, webinarsUsers),
    };
  }

  // ---- Filters (static reference data) -------------------------------------

  private readonly filtersResource = resource({
    // No subject/scope params — only fetch once the caller may read reports.
    params: () => (this.reportParams() ? { base: this.reportParams()!.base } : undefined),
    loader: ({ params, abortSignal }) =>
      firstValueFrom(
        this.api
          .get<ReportFilters>(reportUrl(params.base, 'filters/'), { context: adminContext() })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        { defaultValue: { delivery_types: [], fields_of_study: [] } as ReportFilters },
      ),
  });

  /**
   * Delivery types (`masterclass`, `nano_learning`, `webinar`) — powers the
   * client-side `course_type` filter chips on the drill-down. No list endpoint
   * accepts these as query params, so filtering stays client-side.
   */
  readonly deliveryTypes = computed<string[]>(
    () => this.filtersResource.value()?.delivery_types ?? [],
  );

  // ---- Certificates --------------------------------------------------------
  // `certificates/` has no subject param; webinars arrive as course_type
  // "webinar". Per-user flows filter to the on-screen subject so the zip matches
  // the row's count; the page-level zip deliberately takes everything.
  //
  // These downloads are slow (one PDF fetch per certificate, then a zip build),
  // so they are treated as a first-class job: one at a time, progress
  // reported, cancellable, aborted on navigation, and guarded against the tab
  // closing mid-way. Partial failures ship as a zip + FAILED.txt, not a retry loop.

  /** Live state of the running certificate job; null when idle. */
  readonly downloadProgress = signal<CertificateDownloadProgress | null>(null);
  readonly isDownloading = computed(() => this.downloadProgress() !== null);
  private downloadAbort: AbortController | null = null;

  /** Stops the running job — in-flight fetches are aborted and nothing is saved. */
  cancelDownload(): void {
    this.downloadAbort?.abort(new DOMException('Download cancelled.', 'AbortError'));
  }

  private matchesSubject(cert: ReportCertificate): boolean {
    const isWebinar = cert.course_type?.toLowerCase() === 'webinar';
    return this.subject() === 'webinars' ? isWebinar : !isWebinar;
  }

  /** Scope (superadmin only) + the narrowing params. Abortable via `signal`. */
  private async fetchCertificates(
    extra: { user_id?: number; course_id?: number } = {},
    signal?: AbortSignal,
  ): Promise<ReportCertificatesResponse> {
    const p = this.reportParams();
    if (!p) return {};
    const params: Record<string, number> = { ...extra };
    // A user lookup needs no network/firm anchor; scope-wide calls do.
    if (extra.user_id == null) {
      if (p.networkId != null) params['network_id'] = p.networkId;
      if (p.firmId != null) params['firm_id'] = p.firmId;
    }
    let req = this.api.get<ReportCertificatesResponse>(reportUrl(p.base, 'certificates/'), {
      params,
      context: adminContext(),
    });
    if (signal) req = req.pipe(takeUntil(fromEvent(signal, 'abort')));
    const res = await firstValueFrom(req, { defaultValue: {} as ReportCertificatesResponse });
    if (signal?.aborted) throw signal.reason;
    return res ?? {};
  }

  /** One user's downloadable certificates for the current subject (the drill-down dialog). */
  async userCertificates(userId: number, signal?: AbortSignal): Promise<ReportCertificate[]> {
    const res = await this.fetchCertificates({ user_id: userId }, signal);
    return (res.certificates ?? []).filter((c) => c.certificate_url && this.matchesSubject(c));
  }

  /** Folder name = the course; falls back to the id so nothing lands at the zip root. */
  private courseFolder(cert: ReportCertificate): string {
    return sanitizeFileName(cert.course_name ?? '') || `Course ${cert.course_id}`;
  }

  /** `<Course>/<Course> - <User>.pdf`, optionally under a firm folder. */
  private zipEntry(userName: string, cert: ReportCertificate, firm?: string): BlobDownloadItem {
    const course = this.courseFolder(cert);
    const path = [firm && sanitizeFileName(firm), course].filter(Boolean).join('/');
    return {
      url: cert.certificate_url!,
      suggestedName: `${path}/${buildPdfFileName(course, userName, 'certificate')}`,
    };
  }

  /** One certificate, saved directly as `<Course> - <User>.pdf` (never zipped). */
  downloadCertificate(userName: string, cert: ReportCertificate): Promise<void> {
    if (!cert.certificate_url) return Promise.resolve();
    const file = buildPdfFileName(this.courseFolder(cert), userName, 'certificate');
    return this.runJob(file, (signal) =>
      this.save([{ url: cert.certificate_url!, suggestedName: file }], file, false, signal),
    );
  }

  /** Already-loaded certificates for one user, zipped with a folder per course. */
  downloadCertificates(userName: string, certs: ReportCertificate[]): Promise<void> {
    return this.runJob(`${userName}'s certificates`, (signal) =>
      this.saveUserZip(userName, certs, signal),
    );
  }

  /** Users-table column: fetch one user's certificates for this subject, then zip. */
  downloadUserCertificates(userId: number, userName: string): Promise<void> {
    return this.runJob(`${userName}'s certificates`, async (signal) =>
      this.saveUserZip(userName, await this.userCertificates(userId, signal), signal),
    );
  }

  /**
   * Page-level zip: every certificate in the current scope, both subjects.
   * Network → `<Firm>/<Course>/<Course> - <User>.pdf` (pool-seat users under
   * "Unassigned"); firm → `<Course>/<Course> - <User>.pdf`.
   */
  downloadAllCertificates(scopeName: string): Promise<void> {
    return this.runJob(`All certificates — ${scopeName}`, async (signal) => {
      const res = await this.fetchCertificates({}, signal);
      const entries = (users: ReportCertificateUser[], firm?: string) =>
        users.flatMap((u) =>
          u.certificates
            .filter((c) => c.certificate_url)
            .map((c) => this.zipEntry(u.name, c, firm)),
        );
      const items = [
        ...(res.firms ?? []).flatMap((f) => entries(f.users, f.firm_name)),
        ...entries(res.unassigned_users ?? [], res.firms ? 'Unassigned' : undefined),
        ...entries(res.users ?? []),
      ];
      await this.save(
        items,
        `certificates - ${sanitizeFileName(scopeName) || 'partner'}`,
        true,
        signal,
      );
    });
  }

  private saveUserZip(
    userName: string,
    certs: ReportCertificate[],
    signal: AbortSignal,
  ): Promise<void> {
    const items = certs.filter((c) => c.certificate_url).map((c) => this.zipEntry(userName, c));
    return this.save(items, `certificates - ${sanitizeFileName(userName) || 'user'}`, true, signal);
  }

  /** Fetch + zip + save with live progress; an empty set is a notice, not an error. */
  private async save(
    items: BlobDownloadItem[],
    baseName: string,
    zip: boolean,
    signal: AbortSignal,
  ): Promise<void> {
    if (!items.length) {
      this.notification.info('No certificates', 'Nothing downloadable for this selection.');
      return;
    }
    const result = await downloadFiles(items, baseName, {
      forceZip: zip,
      signal,
      // Partial delivery beats none for a zip; a single PDF is all-or-nothing.
      tolerateFailures: zip,
      onProgress: (progress) =>
        this.downloadProgress.update((job) => (job ? { ...job, ...progress } : job)),
    });
    if (result.failed.length) {
      // Sticky: the admin needs to open FAILED.txt, not watch a toast vanish.
      this.notification.info(
        'Download ready, with gaps',
        `${result.saved} of ${items.length} certificates downloaded. ` +
          `${result.failed.length} could not be fetched — see ${FAILED_MANIFEST_NAME} inside the zip.`,
        { duration: 0, closable: true },
      );
      return;
    }
    this.notification.success(
      'Download ready',
      zip
        ? `${result.saved} certificate${result.saved === 1 ? '' : 's'} zipped and downloaded.`
        : 'Your certificate has been downloaded.',
    );
  }

  /**
   * Runs one certificate job at a time. Sets up the progress signal, the
   * AbortController behind Cancel, and a beforeunload guard so the tab can't
   * silently close mid-download; tears them all down whatever the outcome.
   */
  private async runJob(label: string, work: (signal: AbortSignal) => Promise<void>): Promise<void> {
    if (!this.isBrowser || this.isDownloading()) return;
    const abort = new AbortController();
    this.downloadAbort = abort;
    this.downloadProgress.set({ label, phase: 'listing', done: 0, total: 0, failed: 0 });
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', guard);
    try {
      await work(abort.signal);
    } catch (err) {
      if (isAbortError(err) || abort.signal.aborted) {
        this.notification.info('Download cancelled', 'Nothing was saved.');
      } else {
        this.logger.error('[PartnerReportFacade] certificate download failed', err);
        this.notification.error(
          'Download failed',
          err instanceof Error && err.message
            ? err.message
            : 'The certificates could not be fetched.',
        );
      }
    } finally {
      window.removeEventListener('beforeunload', guard);
      this.downloadAbort = null;
      this.downloadProgress.set(null);
    }
  }

  // ---- CSV export ----------------------------------------------------------

  readonly isExporting = signal(false);

  /** `view=user-items` needs the user it drills into; `user-summary` exports the whole scope. */
  async exportCsv(view: ReportExportView, userId?: number): Promise<void> {
    const p = this.reportParams();
    if (!p || this.isExporting()) return;

    this.isExporting.set(true);
    try {
      const res = await firstValueFrom(
        this.api.get<HttpResponse<Blob>>(reportUrl(p.base, 'export-csv/'), {
          params: {
            ...this.buildHttpParams(p),
            view,
            ...(userId != null ? { user_id: userId } : {}),
          },
          responseType: 'blob',
          observe: 'response',
          context: adminContext(),
        }),
      );

      const blob = res.body;
      if (!blob) throw new Error('Empty CSV response.');

      saveBlob(
        blob,
        fileNameFromContentDisposition(
          res.headers.get('content-disposition'),
          `partner-report-${p.subject}-${view}.csv`,
        ),
      );
      this.notification.success('Export ready', 'Your report CSV has been downloaded.');
    } catch (err) {
      this.logger.error('[PartnerReportFacade] exportCsv failed', err);
      this.notification.error('Export failed', await partnerBlobErrorMessage(err));
    } finally {
      this.isExporting.set(false);
    }
  }
}
