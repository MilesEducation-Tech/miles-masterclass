import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  injectAsync,
  linkedSignal,
  onIdle,
  PLATFORM_ID,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import {
  CPE_COURSE_TYPE_OPTIONS,
  CPE_LEDGER_OPTIONS,
  CpeCourseType,
  CpeCreditWire,
  CpeLedger,
  CpeRowAction,
  CpeSummaryWire,
  CpeTrackerResponse,
  toCertificateTarget,
} from '@features/tracker/cpe/models/cpe-credit.model';
import { CreditsSummary } from '@core/models/cpe-tracker.model';
import { apiUrl } from '@core/services/api-client/api-client';
import { Utils } from '@shared/services/utils';
import { AriaSelect } from '@shared/ui/aria/aria-select/aria-select';
import { AriaSelectOption } from '@core/models/aria.model';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { withPreviousValue } from '@shared/utils/with-previous-value';
import { localeLink } from '../../../utils/tracker-links';
import { BadgeFilterChips } from '../../../components/badge-filter-chips/badge-filter-chips';
import { PortfolioSummary } from '../../components/portfolio-summary/portfolio-summary';
import { TrackerTable } from '../../components/tracker-table/tracker-table';
import type { CertificateDownload } from '../../services/certificate-download';
import { NotificationService } from '@core/services/notification/notification';
import { TrackerDialogOrchestrator } from '../../services/tracker-dialog-orchestrator';
import { DEFAULT_CPE_REQUIREMENT } from '../../constants/cpe-tracker.constants';
import { courseCommands, feedbackCommands } from '../../utils/credit-row';

/** The API's page-size param is `page_count`, **not** `page_size`. */
const PAGE_COUNT = 15;
const YEAR_SPAN = 5;

const EMPTY_LIST: CpeTrackerResponse<CpeCreditWire[]> = { data: [] };

/** Course-type filter value, with a sentinel for "every type". */
type CourseTypeChoice = CpeCourseType | 'all';

/**
 * "Your CPE Portfolio" — Figma `51200-36347`.
 *
 * Reads the two v2 endpoints directly; there is no facade, and no shared state
 * to scope to the route. The CAIRA badge swiper that used to sit above this
 * page is gone — badges live on `/caira-tracker` now.
 */
@Component({
  selector: 'app-cpe-tracker',
  imports: [
    AriaSelect,
    BadgeFilterChips,
    ErrorState,
    NgIcon,
    PortfolioSummary,
    RouterLink,
    TrackerTable,
  ],
  providers: [provideIcons({ lucideArrowLeft })],
  templateUrl: './cpe-tracker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CpeTracker {
  private readonly utils = inject(Utils);
  private readonly router = inject(Router);
  // Lazy (PROMPT.md §4.5): only used after a download click. Prefetched on idle
  // because downloading is this page's main action.
  private readonly certificates = injectAsync(
    () => import('../../services/certificate-download').then((m) => m.CertificateDownload),
    { prefetch: onIdle },
  );
  private readonly notification = inject(NotificationService);
  private readonly dialogs = inject(TrackerDialogOrchestrator);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly trackerHome = localeLink('caira-tracker');
  protected readonly ledgerOptions = CPE_LEDGER_OPTIONS;

  /**
   * `AriaSelect` treats a `null` commit as listbox bookkeeping and drops it
   * (options pruned before async data lands, explicit-mode re-toggles), so the
   * "All" entry cannot carry `null` as its value or it would be unselectable.
   * `'all'` is the sentinel; `courseTypeParam` maps it back for the request.
   */
  protected readonly courseTypeOptions: readonly AriaSelectOption<CourseTypeChoice>[] =
    CPE_COURSE_TYPE_OPTIONS.map((o) => ({ value: o.value ?? 'all', label: o.label }));

  private readonly currentYear = new Date().getFullYear();
  protected readonly yearOptions: readonly AriaSelectOption<number>[] = Array.from(
    { length: YEAR_SPAN },
    (_, i) => ({ value: this.currentYear - i, label: String(this.currentYear - i) }),
  );

  // ---- Filters -----------------------------------------------------------

  protected readonly ledger = linkedSignal<CpeLedger>(() => 'caira');
  protected readonly courseType = linkedSignal<CourseTypeChoice>(() => 'all');
  protected readonly year = linkedSignal<number>(() => this.currentYear);

  /** `'all'` means "omit `course_type` from the request". */
  private readonly courseTypeParam = computed<CpeCourseType | null>(() => {
    const choice = this.courseType();
    return choice === 'all' ? null : choice;
  });

  /**
   * Resets whenever any filter moves. A `linkedSignal` rather than a `signal`
   * plus a reset `effect` — without it, changing a filter while on page 3 lands
   * the user on an empty page.
   */
  private readonly page = linkedSignal({
    source: () => [this.ledger(), this.courseType(), this.year()] as const,
    computation: () => 1,
  });

  // ---- Summary -----------------------------------------------------------

  /**
   * Keyed on `year` only. The payload carries *both* ledger totals precisely so
   * that flipping the CAIRA/Others tab doesn't refetch — don't add `ledger()`
   * to these params.
   */
  private readonly summaryResource = httpResource<CpeTrackerResponse<CpeSummaryWire>>(() =>
    this.isBrowser
      ? { url: apiUrl('v2/cpe-tracker/summary/'), params: { year: this.year() } }
      : undefined,
  );

  /** Guarded: `value()` throws on an errored resource. */
  private readonly summary = computed(() =>
    this.summaryResource.hasValue() ? (this.summaryResource.value()?.data ?? null) : null,
  );
  protected readonly isSummaryLoading = computed(() => this.summaryResource.isLoading());

  protected readonly creditsEarned = computed(() => {
    const s = this.summary();
    if (!s) return 0;
    return this.ledger() === 'caira' ? s.caira_credits_earned : s.others_credits_earned;
  });

  // ---- Credit list -------------------------------------------------------

  private readonly listResource = httpResource<CpeTrackerResponse<CpeCreditWire[]>>(
    () => {
      if (!this.isBrowser) return undefined;
      const params: Record<string, string | number> = {
        ledger: this.ledger(),
        year: this.year(),
        page: this.page(),
        page_count: PAGE_COUNT,
      };
      const courseType = this.courseTypeParam();
      if (courseType) params['course_type'] = courseType;
      return { url: apiUrl('v2/cpe-tracker/'), params };
    },
    { defaultValue: EMPTY_LIST },
  );

  /** Stale-while-revalidate, so paging never blanks the table mid-request. */
  private readonly list = withPreviousValue(this.listResource);

  /**
   * The loaded page, or `undefined`. Guarded: `value()` throws on an errored resource,
   * which took the table down before its own `hasListError` state could render.
   */
  private readonly listPage = computed(() =>
    this.list.hasValue() ? this.list.value() : undefined,
  );

  protected readonly rows = computed(() => this.listPage()?.data ?? []);
  protected readonly isListLoading = computed(() => this.list.isLoading());
  protected readonly hasListError = computed(() => !!this.list.error());
  protected readonly currentPage = computed(() => this.page());

  private readonly totalRows = computed(() => this.listPage()?.pagination_data?.total_count ?? 0);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalRows() / PAGE_COUNT)),
  );

  protected readonly pageWindow = computed(() => {
    const total = this.totalRows();
    const count = this.rows().length;
    if (!count) return { from: 0, to: 0, total };
    const from = (this.page() - 1) * PAGE_COUNT + 1;
    return { from, to: from + count - 1, total };
  });

  // ---- Filter handlers ---------------------------------------------------

  protected onLedger(value: string | null): void {
    this.ledger.set((value ?? 'caira') as CpeLedger);
  }

  protected onCourseType(value: CourseTypeChoice | null): void {
    if (value !== null) this.courseType.set(value);
  }

  protected onYear(value: number | null): void {
    if (value !== null) this.year.set(value);
  }

  protected setPage(delta: number): void {
    const next = this.page() + delta;
    if (next >= 1 && next <= this.totalPages()) this.page.set(next);
  }

  protected retry(): void {
    this.listResource.reload();
  }

  // ---- Row + card actions ------------------------------------------------

  private get localePrefix(): string {
    return `/${this.utils.country()}/${this.utils.profession()}`;
  }

  protected onTitleClick(row: CpeCreditWire): void {
    this.router.navigate(courseCommands(row, this.localePrefix));
  }

  protected onRowAction({ row, action }: { row: CpeCreditWire; action: CpeRowAction }): void {
    switch (action) {
      case 'download':
        void this.withCertificates((c) => c.downloadForRow(toCertificateTarget(row)));
        return;
      case 'feedback':
        this.router.navigate(feedbackCommands(row, this.localePrefix), {
          queryParams: { redirect: this.router.url },
        });
        return;
      case 'view_badge':
        if (row.badge?.accept_url) window.open(row.badge.accept_url, '_blank', 'noopener');
        return;
    }
  }

  protected downloadNasba(): void {
    void this.withCertificates((c) => c.downloadNasba());
  }

  protected downloadAll(): void {
    void this.withCertificates((c) => c.downloadAllCertificates(this.year()));
  }

  private async withCertificates(run: (service: CertificateDownload) => void): Promise<void> {
    let service: CertificateDownload;
    try {
      service = await this.certificates();
    } catch {
      this.notification.error(
        'Download unavailable',
        'Please check your connection and try again.',
      );
      return;
    }
    run(service);
  }

  /**
   * The gauge's earned side comes from v2; its denominator does not exist in any
   * API, and the board name comes off the user's profile rather than the credits
   * payload — see `DEFAULT_CPE_REQUIREMENT`.
   */
  protected openCompliance(): void {
    const summary = this.summary();
    if (!summary) return;

    const earned = summary.credits_earned.total_credit_earned;
    const credits: CreditsSummary = {
      total: earned,
      earned,
      required: DEFAULT_CPE_REQUIREMENT,
      pending: 0,
    };
    const fields = summary.credits_earned.course_credits;

    this.dialogs
      .openCompliance({
        year: this.year(),
        credits,
        fieldsOfStudy: [
          { id: 1, name: 'Accounting', credits: fields.account_credits },
          { id: 2, name: 'Ethics', credits: fields.ethics },
          { id: 3, name: 'Others', credits: fields.others },
        ],
        // ponytail: was the signed-in user's first state board.
        stateBoardName: undefined,
      })
      .subscribe();
  }
}
