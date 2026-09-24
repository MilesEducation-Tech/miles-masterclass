import { isPlatformBrowser } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import {
  computed,
  effect,
  inject,
  Service,
  linkedSignal,
  PLATFORM_ID,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { FeatureApiResponse } from '@core/models/feature.model';
import { SKIP_AUTH_TOKEN } from '@core/models/http.model';
import { ApiClient } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { parseNextPage } from '@core/utils/parse-next-page';
import { withPreviousValue } from '@shared/utils/with-previous-value';
import {
  CourseDetail,
  CourseIds,
  USER_REPORT_ENDPOINTS,
  UserReportPage,
  UserReportRow,
} from '@admin/user-report/models/user-report.model';

const PAGE_SIZE = 30; // API default page size for this report

/**
 * Like the partner-admin reports, the `reports/user-report/` family does its own
 * auth on the Django side, so we suppress every interceptor-added
 * `Authorization` header. Sending an unrelated public-app or Supabase token
 * would just earn a 401.
 *
 * If this endpoint is later moved behind the admin Supabase token, swap this for
 * `new HttpContext().set(IS_ADMIN_REQUEST, true)` (see `http.model.ts`).
 */
function noAuthContext(): HttpContext {
  return new HttpContext().set(SKIP_AUTH_TOKEN, true);
}

/** Response shape for the course-detail drill-down endpoint. */
interface CourseDetailResponse {
  success?: boolean;
  status?: number | boolean;
  message?: string | null;
  data: CourseDetail[];
}

/**
 * Owns state for the admin Reports → User report page.
 *
 * Mirrors `PartnerUsersFacade`: signals + `resource` + stale-while-revalidate
 * (`withPreviousValue`), paginating one page at a time. Ported from the
 * CPE-Masterclass `user-reports` feature — adds server CSV export and a
 * per-bucket course-detail drill-down on top of the listing.
 */
// Route-scoped (see admin.routes.ts): the injector dies on navigation, which
// aborts in-flight resource() loads and stops this page's calls firing elsewhere.
@Service({ autoProvided: false })
export class UserReportFacade {
  private readonly api = inject(ApiClient);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // ---- Filter state --------------------------------------------------------

  readonly searchTerm = signal('');
  readonly pageNumber = signal(1);
  readonly pageSize = PAGE_SIZE;
  readonly isExporting = signal(false);

  // ---- Listing resource ----------------------------------------------------

  private readonly rawResource = resource({
    params: () => {
      if (!this.isBrowser) return undefined;
      return { page: this.pageNumber(), search: this.searchTerm() };
    },
    loader: async ({ params, abortSignal }): Promise<UserReportPage> => {
      const httpParams: Record<string, string | number> = { page: params.page };
      if (params.search) httpParams['search'] = params.search;

      const res = await firstValueFrom(
        this.api
          .get<FeatureApiResponse<UserReportRow[]>>(USER_REPORT_ENDPOINTS.list, {
            params: httpParams,
            context: noAuthContext(),
          })
          .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
        {
          defaultValue: { data: [] as UserReportRow[] } as FeatureApiResponse<UserReportRow[]>,
        },
      );

      const pagination = res.pagination_data;
      return {
        rows: res.data ?? [],
        total: pagination?.total_count ?? res.count ?? res.data?.length ?? 0,
        currentPage: pagination?.current_page ?? params.page,
        nextPage: parseNextPage(pagination?.next_page ?? res.next),
        prevPage: parseNextPage(pagination?.prev_page ?? res.previous),
      };
    },
  });

  private readonly listResource = withPreviousValue(this.rawResource);

  /** Local mirror so the table holds its rows through stale-while-revalidate. */
  readonly rows = linkedSignal({
    source: this.listResource.snapshot,
    computation: (snap, previous): UserReportRow[] => {
      if (snap.status !== 'resolved') return previous?.value ?? [];
      return snap.value?.rows ?? [];
    },
  });

  readonly totalCount = computed(() => this.listResource.value()?.total ?? 0);
  readonly currentPage = computed(
    () => this.listResource.value()?.currentPage ?? this.pageNumber(),
  );
  readonly isLoading = computed(() => this.listResource.isLoading());
  readonly error = computed(() => this.listResource.error());

  readonly hasPrev = computed(() => {
    const page = this.listResource.value();
    if (page) return page.prevPage !== null || page.currentPage > 1;
    return this.pageNumber() > 1;
  });
  readonly hasNext = computed(() => {
    const page = this.listResource.value();
    if (page) return page.nextPage !== null || page.currentPage * PAGE_SIZE < page.total;
    return false;
  });

  constructor() {
    // Reset to page 1 whenever the search changes — a result on page 3 with a
    // new term would otherwise load stale rows.
    effect(() => {
      this.searchTerm();
      untracked(() => {
        if (this.pageNumber() !== 1) this.pageNumber.set(1);
      });
    });
  }

  // ---- Filter setters ------------------------------------------------------

  setSearch(value: string): void {
    this.searchTerm.set(value.trim());
  }

  setPage(page: number): void {
    if (page < 1) return;
    this.pageNumber.set(page);
  }

  reload(): void {
    this.rawResource.reload();
  }

  // ---- Course-detail drill-down -------------------------------------------

  /**
   * Resolve the course list behind a metric bucket. Returns `[]` early when the
   * buckets are empty so callers can avoid a pointless round-trip.
   */
  async getCourseDetail(ids: CourseIds): Promise<CourseDetail[]> {
    const body: CourseIds = {
      masterclass_id: ids.masterclass_id ?? [],
      nano_learning_id: ids.nano_learning_id ?? [],
      podcast_id: ids.podcast_id ?? [],
    };

    const res = await firstValueFrom(
      this.api.post<CourseDetailResponse>(USER_REPORT_ENDPOINTS.courseDetail, body, {
        context: noAuthContext(),
      }),
    );
    return res?.data ?? [];
  }

  // ---- Server CSV export ---------------------------------------------------

  async exportCsv(): Promise<void> {
    if (!this.isBrowser || this.isExporting()) return;
    this.isExporting.set(true);
    try {
      const blob = await firstValueFrom(
        this.api.get<Blob>(USER_REPORT_ENDPOINTS.exportCsv, {
          responseType: 'blob',
          context: noAuthContext(),
        }),
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      this.notification.success('Export ready', 'Your user report CSV has been downloaded.');
    } catch (err) {
      this.logger.error('[UserReportFacade] exportCsv failed', err);
      this.notification.error(
        'Export failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      this.isExporting.set(false);
    }
  }
}
