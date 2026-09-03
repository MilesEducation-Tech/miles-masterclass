import { DestroyRef, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { ApiClient } from '../../../../../shared/core/services/api-client/api-client';
import { Logger } from '../../../../../shared/core/services/logger/logger';
import { NotificationService } from '../../../../../shared/core/services/notification/notification';
import { Auth } from '../../../../../shared/core/services/auth/auth';
import { Utils } from '../../../../../shared/core/services/utils/utils';
import { Analytics } from '../../../../../shared/core/services/analytics/analytics';
import {
  BadgeItem,
  CPE_TRACKER_ROUTES,
  RawReportRow,
  RawStatistics,
  RawUserBadge,
  ReportRow,
  StudyModeFilter,
} from '../../../../../shared/core/models/cpe-tracker.model';
import { reportToTable } from '../../mappers/report-to-table';
import {
  deriveCredits,
  deriveDeliveryModes,
  deriveFieldsOfStudy,
  resolveStateBoard,
  toBadgeItem,
  toReportRow,
} from '../../mappers/api-adapters';
import { CertificateDownload } from '../certificate-download/certificate-download';
import { TrackerDialogOrchestrator } from '../tracker-dialog-orchestrator/tracker-dialog-orchestrator';

@Injectable()
export class CpeTrackerFacade {
  private readonly api = inject(ApiClient);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly auth = inject(Auth);
  private readonly utils = inject(Utils);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly certificates = inject(CertificateDownload);
  private readonly dialogs = inject(TrackerDialogOrchestrator);
  private readonly analytics = inject(Analytics);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly currentYear = new Date().getFullYear();

  readonly selectedYear = signal<number>(this.currentYear);
  /** `true` = earned/completed view; `false` = upcoming view. */
  readonly creditMode = signal<boolean>(true);
  readonly studyFilter = signal<StudyModeFilter>('All');

  /** Raw statistics payload — kept untouched so mode-toggles re-derive for free. */
  readonly statistics = signal<RawStatistics | null>(null);
  readonly report = signal<ReportRow[]>([]);
  readonly badges = signal<BadgeItem[]>([]);

  readonly isLoadingStatistics = signal(false);
  readonly isLoadingReport = signal(false);
  readonly isLoadingBadges = signal(false);

  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);

  readonly credits = computed(() => deriveCredits(this.statistics(), this.creditMode()));
  readonly studyModeDetails = computed(() =>
    deriveFieldsOfStudy(this.statistics(), this.creditMode()),
  );
  readonly deliveryModeDetails = computed(() =>
    deriveDeliveryModes(this.statistics(), this.creditMode()),
  );
  readonly stateBoard = computed(() => resolveStateBoard(this.statistics()));

  readonly yearOptions = computed(() => {
    const start = this.currentYear - 4;
    return Array.from({ length: 5 }, (_, i) => start + i).reverse();
  });

  readonly filteredReport = computed(() => {
    const filter = this.studyFilter();
    const rows = this.report();
    if (filter === 'All') return rows;
    return rows.filter((row) =>
      row.field_of_study.some((field) => this.matchesStudyFilter(field.name, filter)),
    );
  });

  readonly tableRows = computed(() =>
    reportToTable(
      this.report(),
      this.studyModeDetails(),
      this.studyFilter(),
      this.creditMode() ? 'completed' : 'upcoming',
    ),
  );

  readonly totalRows = computed(() => this.tableRows().length);

  readonly totalPages = computed(() => {
    const size = Math.max(1, this.pageSize());
    return Math.max(1, Math.ceil(this.totalRows() / size));
  });

  readonly pagedTableRows = computed(() => {
    const size = Math.max(1, this.pageSize());
    const page = Math.min(Math.max(1, this.currentPage()), this.totalPages());
    const start = (page - 1) * size;
    return this.tableRows().slice(start, start + size);
  });

  readonly pageWindow = computed(() => {
    const size = Math.max(1, this.pageSize());
    const total = this.totalRows();
    const page = Math.min(Math.max(1, this.currentPage()), this.totalPages());
    if (total === 0) return { from: 0, to: 0, total };
    const from = (page - 1) * size + 1;
    const to = Math.min(page * size, total);
    return { from, to, total };
  });

  downloadNasba(): void {
    this.certificates.downloadNasba();
  }

  downloadAllCertificates(): void {
    this.certificates.downloadAllCertificates(this.selectedYear());
  }

  /**
   * Per-row certificate download invoked from the tracker table's "Download"
   * action — hits `user-assessment/download_certificate/`, not the bulk
   * endpoint, and downloads single PDF directly or zips multiple results.
   */
  downloadCertificateForRow(row: ReportRow): void {
    this.certificates.downloadForRow(row);
  }

  openCompliance(): void {
    const credits = this.credits();
    if (!credits) return;
    this.dialogs
      .openCompliance({
        year: this.selectedYear(),
        credits,
        fieldsOfStudy: this.studyModeDetails(),
        stateBoardName: this.stateBoard().name,
      })
      .subscribe();
  }

  openBadgeInfo(): void {
    this.dialogs
      .openBadgeInfo(this.badges())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        if (!res?.data) return;
        if (res.action === 'claim') this.claimBadge(res.data);
        if (res.action === 'share') this.shareBadge(res.data);
      });
  }

  /**
   * Claim a badge. Gated by `Auth.currentPlan()` — no plan opens the upsell
   * dialog and (on confirm) routes to `/:country/:profession/payment/plan`.
   * With an active plan, hits `user-badges/:id/claim/` and opens the returned
   * Credly URL in a new tab. Errors raise a toast.
   */
  claimBadge(badge: BadgeItem): void {
    if (!this.auth.currentPlan()) {
      this.dialogs
        .openClaimUpsell(badge)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((res) => {
          if (res?.action === 'confirm') this.navigateToPaymentPlan();
        });
      return;
    }

    this.utils
      .claimBadge(badge.id)
      .pipe(
        catchError((err) => {
          this.logger.error('CpeTrackerFacade.claimBadge failed', err);
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        const url = this.utils.claimAcceptUrl(res);
        if (res) {
          this.analytics.trackEvent('badge_claim', { badge_id: badge.id });
        }
        if (url && this.isBrowser) {
          window.open(url, '_blank', 'noopener,noreferrer');
          return;
        }
        this.notification.error(
          'Claim failed',
          'Something went wrong while claiming the badge. Please try again later.',
        );
      });
  }

  /**
   * Share-to-LinkedIn hand-off. Mirrors the badge library: an already-claimed
   * badge carries a Credly `accept_url` — route straight there (Credly hosts
   * the LinkedIn share). Otherwise fall through to the claim flow, which opens
   * the accept URL once the server mints it.
   */
  shareBadge(badge: BadgeItem): void {
    if (!this.isBrowser) return;
    if (badge.accept_url) {
      window.open(badge.accept_url, '_blank', 'noopener,noreferrer');
      return;
    }
    this.claimBadge(badge);
  }

  private navigateToPaymentPlan(): void {
    this.router.navigate(['/', this.utils.country(), this.utils.profession(), 'payment', 'plan']);
  }

  loadAll(): void {
    this.loadYearData(this.selectedYear(), this.creditMode());
    this.loadBadges();
  }

  setYear(year: number): void {
    if (year === this.selectedYear()) return;
    this.selectedYear.set(year);
    this.currentPage.set(1);
    this.loadYearData(year, this.creditMode());
  }

  setCreditMode(mode: boolean): void {
    if (mode === this.creditMode()) return;
    this.creditMode.set(mode);
    this.currentPage.set(1);
    // Statistics is a single payload with both earned + upcoming, so derived
    // signals update without a refetch. Only the report is server-filtered.
    this.loadReport(this.selectedYear(), mode);
  }

  setStudyFilter(filter: StudyModeFilter): void {
    this.studyFilter.set(filter);
    this.currentPage.set(1);
  }

  setPage(page: number): void {
    const clamped = Math.min(Math.max(1, page), this.totalPages());
    this.currentPage.set(clamped);
  }

  nextPage(): void {
    this.setPage(this.currentPage() + 1);
  }

  prevPage(): void {
    this.setPage(this.currentPage() - 1);
  }

  private loadYearData(year: number, mode: boolean): void {
    this.isLoadingStatistics.set(true);
    this.isLoadingReport.set(true);

    forkJoin({
      statistics: this.api
        .get<{ data: RawStatistics }>(CPE_TRACKER_ROUTES.getStatistics.path, {
          params: { year },
        })
        .pipe(
          map((res) => res.data ?? null),
          catchError((err) => {
            this.logger.error('CpeTrackerFacade.loadStatistics failed', err);
            return of<RawStatistics | null>(null);
          }),
        ),
      report: this.api
        .get<{ data: RawReportRow[] }>(CPE_TRACKER_ROUTES.getReport.path, {
          params: { year, status: mode },
        })
        .pipe(
          map((res) => (res.data ?? []).map(toReportRow)),
          catchError((err) => {
            this.logger.error('CpeTrackerFacade.loadReport failed', err);
            return of<ReportRow[]>([]);
          }),
        ),
    })
      .pipe(
        finalize(() => {
          this.isLoadingStatistics.set(false);
          this.isLoadingReport.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ statistics, report }) => {
        this.statistics.set(statistics);
        this.report.set(report);
      });
  }

  private loadReport(year: number, mode: boolean): void {
    this.isLoadingReport.set(true);
    this.api
      .get<{ data: RawReportRow[] }>(CPE_TRACKER_ROUTES.getReport.path, {
        params: { year, status: mode },
      })
      .pipe(
        map((res) => (res.data ?? []).map(toReportRow)),
        catchError((err) => {
          this.logger.error('CpeTrackerFacade.loadReport failed', err);
          return of<ReportRow[]>([]);
        }),
        finalize(() => this.isLoadingReport.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => this.report.set(rows));
  }

  private loadBadges(): void {
    this.isLoadingBadges.set(true);
    this.api
      .get<{ data: RawUserBadge[] }>(CPE_TRACKER_ROUTES.getUserBadges.path)
      .pipe(
        map((res) => (res.data ?? []).map(toBadgeItem)),
        catchError((err) => {
          this.logger.error('CpeTrackerFacade.loadBadges failed', err);
          return of<BadgeItem[]>([]);
        }),
        finalize(() => this.isLoadingBadges.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((badges) => this.badges.set(badges));
  }

  private matchesStudyFilter(fieldName: string, filter: StudyModeFilter): boolean {
    const lower = fieldName.toLowerCase();
    switch (filter) {
      case 'Accounting':
        return lower.includes('account');
      case 'Ethics':
        return lower.includes('ethic');
      case 'Others':
        return !lower.includes('account') && !lower.includes('ethic');
      default:
        return true;
    }
  }
}
