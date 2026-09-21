// `@angular/common` (formatDate) pulls in partially-compiled injectables that
// need the JIT compiler present when this runs under plain vitest.
import '@angular/compiler';

import { describe, expect, it } from 'vitest';

import { ReportSummary } from '../../../../admin/partner-platform/reports/shared/models/partner-report.model';
import { dash, executiveLede, reportingPeriodLabel } from './report-preview.format';

/**
 * The report is a client-facing document: a wrong period label or a "0" where
 * the metric is unknown misreports the partner's engagement. Pin the three
 * pure formatters that decide that copy.
 */
describe('report preview formatting', () => {
  const now = '2026-09-09T10:00:00Z';

  it('labels the reporting period from the page filters', () => {
    expect(reportingPeriodLabel('2026-01-01', '2026-06-30', now)).toBe(
      'Jan 1, 2026 – Jun 30, 2026',
    );
    expect(reportingPeriodLabel('2026-01-01', '', now)).toBe('From Jan 1, 2026');
    expect(reportingPeriodLabel('', '2026-06-30', now)).toBe('All-time through Jun 30, 2026');
    expect(reportingPeriodLabel('', '', now)).toBe('All-time through Sep 9, 2026');
  });

  it('renders unknown metrics as an em dash, never 0', () => {
    expect(dash(undefined)).toBe('—');
    expect(dash(null)).toBe('—');
    expect(dash(0)).toBe('0');
    expect(dash(4.25)).toBe('4.25');
  });

  it('builds the executive lede from both summaries', () => {
    const base: ReportSummary = {
      users_onboarded: 7,
      active_in_last_15_days: 4,
      total_cpe_credits_awarded: 0,
      avg_cpe_credits_per_user: 0,
      total_certificates_awarded: 0,
      total_partner_codes: 1,
    };
    const lede = executiveLede(
      'Rehmann',
      { ...base, total_courses_completed: 0 },
      { ...base, total_registrations: 1, total_attendance: 0 },
    );
    expect(lede).toBe(
      "Of Rehmann's 7 onboarded users, 4 have logged in within the last 15 days. " +
        'No courses have been completed yet. ' +
        'Across webinars there is 1 registration and 0 attendances recorded for the reporting period.',
    );
  });
});
