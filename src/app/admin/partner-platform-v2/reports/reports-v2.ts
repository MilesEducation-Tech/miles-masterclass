import { Component, EnvironmentInjector, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AriaInput } from '@shared/ui/aria/aria-input/aria-input';
import { Button } from '@shared/ui/button/button';
import { Dialog } from '@core/services/dialog/dialog';
import { StatCard } from '@admin/partner-platform/shared/components/stat-card/stat-card';
import { PartnerAdminMe } from '@admin/partner-platform/shared/services/partner-admin-me';
import { PartnerNetworkFacade } from '@admin/partner-platform/shared/services/partner-network-facade';
import { PartnerSuperAdminFacade } from '@admin/partner-platform/shared/services/partner-superadmin-facade';
import {
  PartnerReportPreviewDialog,
  PartnerReportPreviewDialogData,
} from '@admin/partner-platform/reports/dialogs/partner-report-preview-dialog/partner-report-preview-dialog';
import {
  ReportItemsDialog,
  ReportItemsDialogData,
} from '@admin/partner-platform/reports/shared/components/report-items-dialog/report-items-dialog';
import { CertificateDownloadProgress } from '@admin/partner-platform/reports/shared/components/certificate-download-progress/certificate-download-progress';
import { ReportUsersTable } from '@admin/partner-platform/reports/shared/components/report-users-table/report-users-table';
import {
  ReportSubject,
  ReportUserRow,
} from '@admin/partner-platform/reports/shared/models/partner-report.model';
import { PartnerReportFacade } from '@admin/partner-platform/reports/shared/services/partner-report-facade';
import { TabStrip } from '@shared/ui/tab-strip/tab-strip';
import { AriaSelect } from '@shared/ui/aria/aria-select/aria-select';
import { AriaSelectOption } from '@core/models/aria.model';

const SUBJECT_TABS: { value: ReportSubject; label: string }[] = [
  { value: 'courses', label: 'Courses' },
  { value: 'webinars', label: 'Webinars' },
  { value: 'group_live', label: 'Group Live' },
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
  imports: [
    AriaInput,
    Button,
    StatCard,
    ReportUsersTable,
    TabStrip,
    AriaSelect,
    CertificateDownloadProgress,
  ],
  templateUrl: './reports-v2.html',
  host: { class: 'block w-full' },
})
export class ReportsV2 {
  protected readonly facade = inject(PartnerReportFacade);
  protected readonly me = inject(PartnerAdminMe);
  private readonly superFacade = inject(PartnerSuperAdminFacade);
  private readonly networkFacade = inject(PartnerNetworkFacade);
  private readonly dialog = inject(Dialog);
  // Dialogs are built by the root Dialog service; hand it this page's injector
  // so the route-scoped facade resolves instead of a NullInjectorError.
  private readonly envInjector = inject(EnvironmentInjector);
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

  /**
   * Email domains for the report subtitle ("@acme.com roster"). Supers read
   * them off the loaded firms; a network admin off the panel firms list; a firm
   * admin has no domain source (`PartnerFirmRef` is id + name) — clause omitted.
   */
  protected readonly previewDomains = computed<string[]>(() => {
    let firms: { email_domains: string[] }[] = [];
    if (this.facade.isSuper()) {
      const networkId = this.facade.scopeNetworkId();
      const firmId = this.facade.scopeFirmId();
      firms =
        networkId != null
          ? this.superFacade.firmsForNetwork(networkId)
          : this.superFacade.firms().filter((f) => f.id === firmId);
    } else if (this.me.isNetworkAdmin()) {
      firms = this.networkFacade.firms();
    }
    return [...new Set(firms.flatMap((f) => f.email_domains).filter(Boolean))].sort();
  });

  /** The printable "Partner Learning Report" for the current scope + dates. */
  protected openPreview(): void {
    this.dialog.open<PartnerReportPreviewDialog>(PartnerReportPreviewDialog, {
      data: {
        partnerName: this.title(),
        domains: this.previewDomains(),
      } satisfies PartnerReportPreviewDialogData,
      environmentInjector: this.envInjector,
      width: '1040px',
      maxWidth: '95vw',
      ariaLabel: 'Partner learning report',
    });
  }

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

  /** app-tab-strip speaks labels; map them back to the filter values. */
  protected readonly tabLabels = SUBJECT_TABS.map((t) => t.label);
  protected readonly activeTabLabel = computed(
    () => SUBJECT_TABS.find((t) => this.isActiveTab(t.value))?.label ?? null,
  );
  protected onTabChange(label: string): void {
    const tab = SUBJECT_TABS.find((t) => t.label === label);
    if (tab) this.selectSubject(tab.value);
  }

  protected isActiveTab(value: ReportSubject): boolean {
    return this.facade.subject() === value;
  }

  protected selectSubject(value: ReportSubject): void {
    this.facade.setSubject(value);
  }

  /** `page_size` accepts up to 200 — a few sensible steps. */
  protected readonly pageSizes = [30, 50, 100, 200];

  protected readonly pageSizeOptions: AriaSelectOption<number>[] = this.pageSizes.map((n) => ({
    value: n,
    label: String(n),
  }));

  protected onPageSizeChange(size: number | null): void {
    if (size) this.facade.setPageSize(size);
  }

  /** One flat list: `n:<id>` networks first, then `f:<id>` firms. */
  protected readonly scopeOptions = computed<AriaSelectOption<string>[]>(() => [
    ...this.networks().map((n) => ({ value: `n:${n.id}`, label: `Network — ${n.name}` })),
    ...this.firms().map((f) => ({ value: `f:${f.id}`, label: `Firm — ${f.name}` })),
  ]);

  protected onScopeChange(raw: string | null): void {
    raw ??= '';
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

  protected downloadCertificates(row: ReportUserRow): void {
    void this.facade.downloadUserCertificates(row.user_id, row.name);
  }

  /** Every certificate in scope, both subjects, zipped firm → course → user. */
  protected downloadAllCertificates(): void {
    void this.facade.downloadAllCertificates(this.title());
  }

  protected openItems(row: ReportUserRow): void {
    this.dialog.open<ReportItemsDialog>(ReportItemsDialog, {
      data: {
        userId: row.user_id,
        userName: row.name,
        subject: this.facade.subject(),
      } satisfies ReportItemsDialogData,
      environmentInjector: this.envInjector,
      maxWidth: '720px',
      ariaLabel: `Report details for ${row.name}`,
    });
  }
}
