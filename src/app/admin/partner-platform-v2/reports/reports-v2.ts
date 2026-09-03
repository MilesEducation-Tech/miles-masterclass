import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AriaInput } from '../../../shared/components/ui/aria/aria-input/aria-input';
import { Button } from '../../../shared/components/ui/button/button';
import { Dialog } from '../../../shared/core/services/dialog/dialog';
import { StatCard } from '../../partner-platform/shared/components/stat-card/stat-card';
import { PartnerAdminMe } from '../../partner-platform/shared/services/partner-admin-me';
import { PartnerSuperAdminFacade } from '../../partner-platform/shared/services/partner-superadmin-facade';
import {
  ReportItemsDialog,
  ReportItemsDialogData,
} from '../../partner-platform/reports/shared/components/report-items-dialog/report-items-dialog';
import { ReportUsersTable } from '../../partner-platform/reports/shared/components/report-users-table/report-users-table';
import {
  ReportSubject,
  ReportUserRow,
} from '../../partner-platform/reports/shared/models/partner-report.model';
import { PartnerReportFacade } from '../../partner-platform/reports/shared/services/partner-report-facade';

const SUBJECT_TABS: { value: ReportSubject; label: string }[] = [
  { value: 'courses', label: 'Courses' },
  { value: 'webinars', label: 'Webinars' },
];

/** Two decimals, no trailing noise — the API sends raw floats. */
const round2 = (value: number | undefined): number => Math.round((value ?? 0) * 100) / 100;

/**
 * Partner Platform v2 — Reports (`/admin/partner-v2/reports`), both audiences:
 *
 *   - A Django `super` admin picks a scope and reads `superadmin/report/…`.
 *   - A network/firm admin with `report:network:read`/`report:firm:read` reads
 *     `panel/report/…`, auto-scoped — no picker.
 *
 * The facade decides the base; this page only decides what to show.
 */
@Component({
  selector: 'app-reports-v2',
  imports: [AriaInput, Button, StatCard, ReportUsersTable],
  templateUrl: './reports-v2.html',
  host: { class: 'block w-full' },
})
export class ReportsV2 {
  protected readonly facade = inject(PartnerReportFacade);
  protected readonly me = inject(PartnerAdminMe);
  private readonly superFacade = inject(PartnerSuperAdminFacade);
  private readonly dialog = inject(Dialog);
  private readonly route = inject(ActivatedRoute);

  protected readonly subjectTabs = SUBJECT_TABS;

  constructor() {
    // Deep-link support: the network detail hub links here pre-scoped.
    const params = this.route.snapshot.queryParamMap;
    const networkId = Number(params.get('network'));
    const firmId = Number(params.get('firm'));
    if (networkId > 0) this.facade.selectNetwork(networkId);
    else if (firmId > 0) this.facade.selectFirm(firmId);
  }

  /** Provisioned for reports at all? Supers via role, panel admins via capability. */
  protected readonly canViewReports = computed(
    () => this.facade.isSuper() || this.me.canReadReports(),
  );

  /** Scope title: the picked target for supers, the admin's own scope otherwise. */
  protected readonly title = computed(() => {
    if (!this.facade.isSuper()) {
      return this.me.network()?.name ?? this.me.firm()?.name ?? 'Partner network';
    }
    const networkId = this.facade.scopeNetworkId();
    if (networkId != null) {
      return this.superFacade.networks().find((n) => n.id === networkId)?.name ?? 'Network';
    }
    const firmId = this.facade.scopeFirmId();
    if (firmId != null) {
      return this.superFacade.firms().find((f) => f.id === firmId)?.name ?? 'Firm';
    }
    return 'All partners';
  });

  protected readonly networks = computed(() => this.superFacade.networks());
  protected readonly firms = computed(() => this.superFacade.firms());

  /** `n:<id>` / `f:<id>` so one select can pick either scope — the API takes exactly one. */
  protected readonly scopeValue = computed(() => {
    const networkId = this.facade.scopeNetworkId();
    if (networkId != null) return `n:${networkId}`;
    const firmId = this.facade.scopeFirmId();
    if (firmId != null) return `f:${firmId}`;
    return '';
  });

  protected readonly cards = computed(() => {
    const s = this.facade.summary();
    if (!s) return [];
    const shared = [
      { label: 'Users onboarded', value: s.users_onboarded, accent: 'var(--chart-1)' },
      { label: 'Active (last 15 days)', value: s.active_in_last_15_days, accent: 'var(--mm-info)' },
    ];
    const credits = [
      {
        label: 'CPE credits awarded',
        value: round2(s.total_cpe_credits_awarded),
        accent: 'var(--mm-success)',
      },
      {
        label: 'Avg CPE credits / user',
        value: round2(s.avg_cpe_credits_per_user),
        accent: 'var(--chart-3)',
      },
      {
        label: 'Certificates awarded',
        value: s.total_certificates_awarded,
        accent: 'var(--chart-5)',
      },
      { label: 'Partner codes', value: s.total_partner_codes, accent: 'var(--mm-fg-3)' },
    ];

    if (this.facade.subject() === 'courses') {
      return [
        ...shared,
        {
          label: 'Courses completed',
          value: s.total_courses_completed ?? 0,
          accent: 'var(--chart-1)',
        },
        {
          label: 'Avg courses / user',
          value: round2(s.avg_courses_completed_per_user),
          accent: 'var(--chart-3)',
        },
        {
          label: 'Avg feedback / course',
          value: round2(s.avg_feedback_per_course),
          accent: 'var(--mm-warn)',
        },
        ...credits,
      ];
    }

    return [
      ...shared,
      { label: 'Webinars run', value: s.webinars_registered_for ?? 0, accent: 'var(--chart-1)' },
      { label: 'Total registrations', value: s.total_registrations ?? 0, accent: 'var(--chart-3)' },
      {
        label: 'Avg registrations / webinar',
        value: round2(s.avg_registrations_per_webinar),
        accent: 'var(--mm-info)',
      },
      { label: 'Total attendance', value: s.total_attendance ?? 0, accent: 'var(--chart-5)' },
      {
        label: 'Avg attendance / webinar',
        value: round2(s.avg_attendance_per_webinar),
        accent: 'var(--mm-info)',
      },
      {
        label: 'Avg feedback / webinar',
        value: round2(s.avg_feedback_per_webinar),
        accent: 'var(--mm-warn)',
      },
      ...credits,
    ];
  });

  protected isActiveTab(value: ReportSubject): boolean {
    return this.facade.subject() === value;
  }

  protected selectSubject(value: ReportSubject): void {
    this.facade.setSubject(value);
  }

  protected onScopeChange(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    if (raw.startsWith('n:')) {
      this.facade.selectNetwork(Number(raw.slice(2)));
      return;
    }
    if (raw.startsWith('f:')) {
      this.facade.selectFirm(Number(raw.slice(2)));
      return;
    }
    this.facade.selectNetwork(null);
  }

  protected goPrev(): void {
    this.facade.setPage(this.facade.pageNumber() - 1);
  }

  protected goNext(): void {
    this.facade.setPage(this.facade.pageNumber() + 1);
  }

  protected exportSummary(): void {
    void this.facade.exportCsv('user-summary');
  }

  protected openItems(row: ReportUserRow): void {
    this.dialog.open<ReportItemsDialog>(ReportItemsDialog, {
      data: {
        userId: row.user_id,
        userName: row.name,
        subject: this.facade.subject(),
      } satisfies ReportItemsDialogData,
      maxWidth: '720px',
      ariaLabel: `Report details for ${row.name}`,
    });
  }
}
