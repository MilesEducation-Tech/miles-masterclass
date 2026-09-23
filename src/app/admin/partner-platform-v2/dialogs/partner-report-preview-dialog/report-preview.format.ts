import { formatDate, formatNumber } from '@angular/common';
import { ReportSummary } from '@admin/partner-platform-v2/models/partner-report.model';

const LOCALE = 'en-US';
const day = (value: string | Date) => formatDate(value, 'MMM d, y', LOCALE);

/** "Jan 1 – Jun 30, 2026" · "From Jan 1, 2026" · "All-time through Sep 9, 2026". */
export function reportingPeriodLabel(from: string, to: string, now: string | Date): string {
  if (from && to) return `${day(from)} – ${day(to)}`;
  if (from) return `From ${day(from)}`;
  return `All-time through ${day(to || now)}`;
}

/** Nullable metric → em dash; the API sends raw floats, so two decimals max. */
export function dash(value: number | null | undefined): string {
  return value == null ? '—' : formatNumber(value, LOCALE, '1.0-2');
}

const plural = (n: number, one: string, many = `${one}s`) => `${dash(n)} ${n === 1 ? one : many}`;

/** The executive-summary paragraph, filled from the two summaries — no free prose. */
export function executiveLede(
  partner: string,
  courses: ReportSummary,
  webinars: ReportSummary,
): string {
  const completed = courses.total_courses_completed ?? 0;
  const sentences = [
    `Of ${partner}'s ${plural(courses.users_onboarded, 'onboarded user')}, ` +
      `${dash(courses.active_in_last_15_days)} ${courses.active_in_last_15_days === 1 ? 'has' : 'have'} logged in within the last 15 days.`,
    completed
      ? `${plural(completed, 'course has been completed', 'courses have been completed')}, ` +
        `earning ${plural(courses.total_cpe_credits_awarded, 'CPE credit')} and ` +
        `${plural(courses.total_certificates_awarded, 'certificate')}.`
      : 'No courses have been completed yet.',
    `Across webinars there ${webinars.total_registrations === 1 ? 'is' : 'are'} ` +
      `${plural(webinars.total_registrations ?? 0, 'registration')} and ` +
      `${plural(webinars.total_attendance ?? 0, 'attendance')} recorded for the reporting period.`,
  ];
  return sentences.join(' ');
}
