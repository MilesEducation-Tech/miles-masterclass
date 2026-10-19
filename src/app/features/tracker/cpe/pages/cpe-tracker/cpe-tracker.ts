import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import {
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
  CPE_COURSE_TYPE_TOKENS,
  CPE_CREDITS_PATH,
  CPE_LEDGER_OPTIONS,
  CPE_PAGE_SIZE,
  CPE_SUMMARY_PATH,
  CpeCourseChoice,
  CpeCreditWire,
  CpeLedger,
  CpeRowAction,
  EMPTY_CREDITS_PAGE,
  parseCpeCredits,
  parseCpeSummary,
  primaryStateBoard,
} from '@features/tracker/cpe/models/cpe-credit.model';
import { CreditsSummary } from '@core/models/cpe-tracker.model';
import { apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Utils } from '@shared/services/utils';

import { AriaSelectOption } from '@core/models/aria.model';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { withPreviousValue } from '@core/utils/with-previous-value';
import { localeLink } from '@features/tracker/utils/tracker-links';
import { BadgeFilterChips } from '@features/tracker/components/badge-filter-chips/badge-filter-chips';
import { PortfolioSummary } from '@features/tracker/cpe/components/portfolio-summary/portfolio-summary';
import { TrackerTable } from '@features/tracker/cpe/components/tracker-table/tracker-table';
import type { CertificateDownload } from '@features/tracker/cpe/services/certificate-download';
import { NotificationService } from '@core/services/notification/notification';
import { TrackerDialogOrchestrator } from '@features/tracker/cpe/services/tracker-dialog-orchestrator';
import { courseCommands, feedbackCommands } from '@features/tracker/cpe/utils/credit-row';
import { Field } from '@shared/ui/field/field';
import { NgpLabel } from 'ng-primitives/form-field';
import { Select } from '@shared/ui/select/select';

const YEAR_SPAN = 5;

/**
 * "Your CPE Portfolio" — Figma `51200-36347`.
 *
 * Reads `web-api/v1/cpe-tracker/` directly; there is no facade, and no shared state to scope to the
 * route. The CAIRA badge swiper that used to sit above this page is gone — badges live on
 * `/caira-tracker` now.
 *
 * Both reads gate on the **boolean** `isAuthenticated()`, never the token string: a request
 * function tracks every signal it reads, so reading the token would re-fire both resources on
 * every rotation. The route is `authGuard`-ed as well, which is what keeps a signed-out visitor
 * from seeing a shell and two 401s.
 */
@Component({
  selector: 'app-cpe-tracker',
  imports: [
    BadgeFilterChips,
    ErrorState,
    NgIcon,
    PortfolioSummary,
    RouterLink,
    TrackerTable,
    Field,
    NgpLabel,
    Select,
  ],
  providers: [provideIcons({ lucideArrowLeft })],
  templateUrl: './cpe-tracker.html',
})
export class CpeTracker {
  private readonly utils = inject(Utils);
  private readonly auth = inject(AuthSession);
  private readonly router = inject(Router);
  // Lazy (PROMPT.md §4.5): only used after a download click. Prefetched on idle
  // because downloading is this page's main action.
  private readonly certificates = injectAsync(
    () =>
      import('@features/tracker/cpe/services/certificate-download').then(
        (m) => m.CertificateDownload,
      ),
    { prefetch: onIdle },
  );
  private readonly notification = inject(NotificationService);
  private readonly dialogs = inject(TrackerDialogOrchestrator);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly trackerHome = localeLink('caira-tracker');
  protected readonly ledgerOptions = CPE_LEDGER_OPTIONS;

  protected readonly courseTypeOptions: readonly AriaSelectOption<CpeCourseChoice>[] =
    CPE_COURSE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

  private readonly currentYear = new Date().getFullYear();
  protected readonly yearOptions: readonly AriaSelectOption<number>[] = Array.from(
    { length: YEAR_SPAN },
    (_, i) => ({ value: this.currentYear - i, label: String(this.currentYear - i) }),
  );

  // ---- Filters -----------------------------------------------------------

  protected readonly ledger = linkedSignal<CpeLedger>(() => 'caira');
  protected readonly courseType = linkedSignal<CpeCourseChoice>(() => 'all');
  protected readonly year = linkedSignal<number>(() => this.currentYear);

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
  private readonly summaryResource = httpResource(
    () =>
      this.isBrowser && this.auth.isAuthenticated()
        ? { url: apiUrl(CPE_SUMMARY_PATH), params: { year: this.year() } }
        : undefined,
    { parse: parseCpeSummary },
  );

  /** Guarded: `value()` throws on an errored resource. */
  private readonly summary = computed(() =>
    this.summaryResource.hasValue() ? this.summaryResource.value() : null,
  );
  protected readonly isSummaryLoading = computed(() => this.summaryResource.isLoading());

  protected readonly creditsEarned = computed(() => {
    const s = this.summary();
    if (!s) return 0;
    return this.ledger() === 'caira' ? s.caira_credits_earned : s.others_credits_earned;
  });

  // ---- Credit list -------------------------------------------------------

  private readonly listResource = httpResource(
    () => {
      if (!this.isBrowser || !this.auth.isAuthenticated()) return undefined;

      // Every key is validated server-side and an unknown one is a 400, so the parameter map is
      // built explicitly rather than spread from the filter state.
      const params: Record<string, string | number> = {
        ledger: this.ledger(),
        year: this.year(),
        page: this.page(),
        page_size: CPE_PAGE_SIZE,
      };
      const tokens = CPE_COURSE_TYPE_TOKENS[this.courseType()];
      if (tokens.length) params['course_type'] = tokens.join(',');
      return { url: apiUrl(CPE_CREDITS_PATH), params };
    },
    { defaultValue: EMPTY_CREDITS_PAGE, parse: parseCpeCredits },
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

  protected readonly rows = computed(() => this.listPage()?.results ?? []);
  protected readonly isListLoading = computed(() => this.list.isLoading());
  protected readonly hasListError = computed(() => !!this.list.error());
  protected readonly currentPage = computed(() => this.page());

  private readonly totalRows = computed(() => this.listPage()?.count ?? 0);

  protected readonly totalPages = computed(() => this.listPage()?.total_pages ?? 1);

  protected readonly pageWindow = computed(() => {
    const total = this.totalRows();
    const count = this.rows().length;
    if (!count) return { from: 0, to: 0, total };
    const from = (this.page() - 1) * CPE_PAGE_SIZE + 1;
    return { from, to: from + count - 1, total };
  });

  // ---- Filter handlers ---------------------------------------------------

  protected onLedger(value: string | null): void {
    this.ledger.set((value ?? 'caira') as CpeLedger);
  }

  protected onCourseType(value: CpeCourseChoice | null): void {
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
    const commands = courseCommands(row, this.localePrefix);
    if (commands) this.router.navigate(commands);
  }

  protected onRowAction({ row, action }: { row: CpeCreditWire; action: CpeRowAction }): void {
    switch (action) {
      case 'feedback': {
        const commands = feedbackCommands(row, this.localePrefix);
        if (commands) {
          this.router.navigate(commands, { queryParams: { redirect: this.router.url } });
        }
        return;
      }
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
   * The gauge's requirement comes from the learner's own state board now, replacing the hard-coded
   * 40. `required` stays `null` when no board is configured — the dialog says so rather than
   * dividing by a number nobody chose.
   */
  protected openCompliance(): void {
    const summary = this.summary();
    if (!summary) return;

    const board = primaryStateBoard(summary);
    // A board's progress counts its whole reporting period, which may span more years than the one
    // the selector shows; without a board there is only the selected year's total.
    const earned = board?.period?.credits_earned ?? summary.credits_earned.total_credit_earned;
    const credits: CreditsSummary = {
      total: summary.credits_earned.total_credit_earned,
      earned,
      required: board?.required_credits ?? null,
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
        stateBoardName: board?.name,
        period: board?.period
          ? { start_year: board.period.start_year, end_year: board.period.end_year }
          : undefined,
      })
      .subscribe();
  }
}
