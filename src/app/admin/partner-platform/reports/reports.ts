import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AriaInput } from '../../../shared/components/ui/aria/aria-input/aria-input';
import { Button } from '../../../shared/components/ui/button/button';
import { Dialog } from '../../../shared/core/services/dialog/dialog';
import { DeprecationBanner } from '../../shared/components/deprecation-banner/deprecation-banner';
import { StatCard } from '../shared/components/stat-card/stat-card';
import { PartnerAdminMe } from '../shared/services/partner-admin-me';
import { PartnerSuperAdminFacade } from '../shared/services/partner-superadmin-facade';
import {
  ReportItemsDialog,
  ReportItemsDialogData,
} from './shared/components/report-items-dialog/report-items-dialog';
import { ReportUsersTable } from './shared/components/report-users-table/report-users-table';
import { ReportSubject, ReportUserRow } from './shared/models/partner-report.model';
import { PartnerReportFacade } from './shared/services/partner-report-facade';

const SUBJECT_TABS: { value: ReportSubject; label: string }[] = [
  { value: 'courses', label: 'Courses' },
  { value: 'webinars', label: 'Webinars' },
  { value: 'group_live', label: 'Group Live' },
];

/** Two decimals, no trailing noise — the API sends raw floats. */
const round2 = (value: number | undefined): number => Math.round((value ?? 0) * 100) / 100;

/**
 * Partner Platform reports (`/admin/partner/reports`) — engagement stats for one
 * network or firm, per subject (courses / webinars). Super admins only.
 *
 * Both gates apply: the route needs the Supabase `partner:platform:manage` perm,
 * and every call needs a Django `PartnerAdmin` row with `role === 'super'` —
 * having one without the other renders the not-provisioned state rather than a
 * page that only produces 403s.
 */
@Component({
  selector: 'app-partner-reports',
  imports: [AriaInput, Button, StatCard, ReportUsersTable, DeprecationBanner],
  templateUrl: './reports.html',
  host: { class: 'block w-full' },
})
export class Reports {
  protected readonly facade = inject(PartnerReportFacade);
  protected readonly me = inject(PartnerAdminMe);
  private readonly superFacade = inject(PartnerSuperAdminFacade);
  private readonly dialog = inject(Dialog);
  private readonly route = inject(ActivatedRoute);

  protected readonly subjectTabs = SUBJECT_TABS;

  constructor() {
    // Deep-link support: the network detail page links here pre-scoped.
    const params = this.route.snapshot.queryParamMap;
    const networkId = Number(params.get('network'));
    const firmId = Number(params.get('firm'));
    if (networkId > 0) this.facade.selectNetwork(networkId);
    else if (firmId > 0) this.facade.selectFirm(firmId);
  }

  /** Scope title: whichever target is picked, else a prompt. */
  protected readonly title = computed(() => {
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
