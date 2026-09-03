import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiClient } from '../../../../../shared/core/services/api-client/api-client';
import { Logger } from '../../../../../shared/core/services/logger/logger';
import { NotificationService } from '../../../../../shared/core/services/notification/notification';
import { Auth } from '../../../../../shared/core/services/auth/auth';
import { Utils } from '../../../../../shared/core/services/utils/utils';
import { CertificateDownload } from '../certificate-download/certificate-download';
import { TrackerDialogOrchestrator } from '../tracker-dialog-orchestrator/tracker-dialog-orchestrator';
import {
  BadgeItem,
  CPE_TRACKER_ROUTES,
  RawReportRow,
  RawStatistics,
} from '../../../../../shared/core/models/cpe-tracker.model';
import { CpeTrackerFacade } from './cpe-tracker-facade';

function makeBadge(overrides: Partial<BadgeItem> = {}): BadgeItem {
  return {
    id: 1,
    name: 'CAIRA — Level 1',
    sub_text: 'Foundations',
    description: 'desc',
    image_url: 'https://cdn/badge.png',
    level: 'Level 1',
    level_rank: 1,
    required_credits: 30,
    earned_credits: 30,
    progress_percentage: 100,
    status: 'unlocked',
    is_claimed: false,
    is_claimable: true,
    is_coming_soon: false,
    ...overrides,
  };
}

function makeStatistics(overrides: Partial<RawStatistics> = {}): RawStatistics {
  return {
    user_state_board: [],
    overall_credits_earned: 10,
    overall_upcoming_credits: 5,
    credits_earned: {
      total_credit_earned: 10,
      course_credits: { account_credits: 6, ethics: 4, others: 0 },
      study_credits: { webinar: 0, self_study: 10, nano_learning: 0 },
    },
    upcoming_credits: {
      total_credit_earned: 5,
      course_credits: { account_credits: 2, ethics: 0, others: 3 },
      study_credits: { webinar: 0, self_study: 5, nano_learning: 0 },
    },
    ...overrides,
  };
}

function makeReport(overrides: Partial<RawReportRow> = {}): RawReportRow {
  return {
    id: 1,
    course_details: {
      master_class_name: 'Accounting Essentials',
      horizontal_thumbnail: null,
      instructor_name: 'Test Instructor',
      type: 'masterclass',
      all_classes_completed: true,
      user_assessment: {
        status: 'Exam_Passed',
        session_id: 99,
        exam_passes_date: '2026-01-10',
      },
      fields_of_study: [{ id: 1, name: 'Accounting', cpe_credits: 2 }],
    },
    user_feedback_details: { user_feedback_submitted: true, user_rating: 5 },
    webinar_details: null,
    transcation_type: 'self_study',
    total_credits: 2,
    completed_date: null,
    status: true,
    created_at: '2026-01-10T10:00:00Z',
    master_class: 101,
    nano_learning: null,
    chapter: null,
    course: 1,
    webinar_session: null,
    user_enrollment: null,
    user: 1,
    updated_by: null,
    ...overrides,
  } as RawReportRow;
}

describe('CpeTrackerFacade', () => {
  let facade: CpeTrackerFacade;
  let apiGet: ReturnType<typeof vi.fn>;
  let routerNavigate: ReturnType<typeof vi.fn>;
  let authCurrentPlan: ReturnType<typeof vi.fn>;
  let openClaimUpsell: ReturnType<typeof vi.fn>;
  let openBadgeInfo: ReturnType<typeof vi.fn>;
  let windowOpen: ReturnType<typeof vi.fn> & ((...args: unknown[]) => void);

  beforeEach(() => {
    apiGet = vi.fn();
    routerNavigate = vi.fn();
    authCurrentPlan = vi.fn(() => null);
    openClaimUpsell = vi.fn(() => of({ action: 'close', result: false }));
    openBadgeInfo = vi.fn(() => of({ result: false }));
    windowOpen = vi.fn() as ReturnType<typeof vi.fn> & ((...args: unknown[]) => void);
    vi.spyOn(window, 'open').mockImplementation((...args: unknown[]) => {
      windowOpen(...args);
      return null;
    });

    const api = { get: apiGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        CpeTrackerFacade,
        { provide: ApiClient, useValue: api },
        { provide: Logger, useValue: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } },
        {
          provide: NotificationService,
          useValue: { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() },
        },
        { provide: Auth, useValue: { currentPlan: authCurrentPlan } },
        {
          provide: Utils,
          useValue: {
            country: () => 'in',
            profession: () => 'accounting',
            claimBadge: (id: number) =>
              (apiGet as unknown as (url: string) => unknown)(`user-badges/${id}/claim/`),
            claimAcceptUrl: (res: { data?: { credly_accept_url?: string | null } } | null) =>
              res?.data?.credly_accept_url ?? null,
          },
        },
        { provide: Router, useValue: { navigate: routerNavigate } },
        {
          provide: CertificateDownload,
          useValue: { downloadNasba: vi.fn(), downloadAllCertificates: vi.fn() },
        },
        {
          provide: TrackerDialogOrchestrator,
          useValue: {
            openCompliance: vi.fn(() => of({ result: false })),
            openBadgeInfo,
            openClaimUpsell,
          },
        },
      ],
    });
    facade = TestBed.inject(CpeTrackerFacade);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes the current-year default and five-year option window', () => {
    const current = new Date().getFullYear();
    expect(facade.selectedYear()).toBe(current);
    expect(facade.yearOptions()).toEqual([
      current,
      current - 1,
      current - 2,
      current - 3,
      current - 4,
    ]);
  });

  it('derives credits and study-mode details from raw statistics', () => {
    apiGet.mockImplementation((path: string) => {
      if (path === CPE_TRACKER_ROUTES.getStatistics.path) {
        return of({ data: makeStatistics() });
      }
      if (path === CPE_TRACKER_ROUTES.getReport.path) {
        return of({ data: [makeReport()] });
      }
      return of({ data: [] });
    });

    facade.loadAll();

    expect(facade.credits()?.earned).toBe(10);
    expect(facade.studyModeDetails().map((s) => [s.name, s.credits])).toEqual([
      ['Accounting', 6],
      ['Ethics', 4],
      ['Others', 0],
    ]);
    expect(facade.isLoadingStatistics()).toBe(false);
    expect(facade.isLoadingReport()).toBe(false);
  });

  it('credits/studyModes re-derive when creditMode flips without refetching statistics', () => {
    apiGet.mockImplementation((path: string) => {
      if (path === CPE_TRACKER_ROUTES.getStatistics.path) {
        return of({ data: makeStatistics() });
      }
      return of({ data: [] });
    });

    facade.loadAll();
    expect(facade.credits()?.earned).toBe(10);

    apiGet.mockClear();
    apiGet.mockReturnValue(of({ data: [] }));
    facade.setCreditMode(false);

    expect(facade.credits()?.earned).toBe(5);
    expect(facade.studyModeDetails().map((s) => s.credits)).toEqual([2, 0, 3]);
  });

  it('setYear short-circuits when the year matches the current selection', () => {
    apiGet.mockReturnValue(of({ data: [] }));
    facade.loadAll();
    apiGet.mockClear();

    facade.setYear(facade.selectedYear());

    expect(apiGet).not.toHaveBeenCalled();
  });

  it('setYear triggers a fresh statistics + report fetch for the new year', () => {
    apiGet.mockReturnValue(of({ data: [] }));
    facade.loadAll();
    apiGet.mockClear();

    facade.setYear(2022);

    expect(facade.selectedYear()).toBe(2022);
    const statsCall = apiGet.mock.calls.find(
      ([path]) => path === CPE_TRACKER_ROUTES.getStatistics.path,
    );
    const reportCall = apiGet.mock.calls.find(
      ([path]) => path === CPE_TRACKER_ROUTES.getReport.path,
    );
    expect(statsCall?.[1]?.params).toMatchObject({ year: 2022 });
    expect(reportCall?.[1]?.params).toMatchObject({ year: 2022, status: true });
  });

  it('setCreditMode only refetches the report and passes the status boolean', () => {
    apiGet.mockReturnValue(of({ data: [] }));
    facade.loadAll();
    apiGet.mockClear();

    facade.setCreditMode(false);

    const statsCalls = apiGet.mock.calls.filter(
      ([path]) => path === CPE_TRACKER_ROUTES.getStatistics.path,
    );
    const reportCalls = apiGet.mock.calls.filter(
      ([path]) => path === CPE_TRACKER_ROUTES.getReport.path,
    );
    expect(statsCalls).toHaveLength(0);
    expect(reportCalls).toHaveLength(1);
    expect(reportCalls[0][1]?.params).toMatchObject({ status: false });
  });

  it('filteredReport narrows rows by study-mode filter', () => {
    apiGet.mockImplementation((path: string) => {
      if (path === CPE_TRACKER_ROUTES.getStatistics.path) {
        return of({ data: makeStatistics() });
      }
      if (path === CPE_TRACKER_ROUTES.getReport.path) {
        return of({
          data: [
            makeReport({
              id: 1,
              master_class: 101,
              course_details: {
                ...makeReport().course_details,
                fields_of_study: [{ id: 1, name: 'Accounting', cpe_credits: 2 }],
              },
            }),
            makeReport({
              id: 2,
              master_class: 102,
              course_details: {
                ...makeReport().course_details,
                fields_of_study: [{ id: 2, name: 'Ethics', cpe_credits: 1 }],
              },
            }),
            makeReport({
              id: 3,
              master_class: 103,
              course_details: {
                ...makeReport().course_details,
                fields_of_study: [{ id: 3, name: 'Taxes', cpe_credits: 1.5 }],
              },
            }),
          ],
        });
      }
      return of({ data: [] });
    });

    facade.loadAll();

    facade.setStudyFilter('Ethics');
    expect(facade.filteredReport().map((r) => r.id)).toEqual([2]);

    facade.setStudyFilter('Others');
    expect(facade.filteredReport().map((r) => r.id)).toEqual([3]);

    facade.setStudyFilter('All');
    expect(facade.filteredReport()).toHaveLength(3);
  });

  it('swallows API errors and leaves signals in a safe empty state', () => {
    apiGet.mockReturnValue(throwError(() => new Error('boom')));

    facade.loadAll();

    expect(facade.statistics()).toBeNull();
    expect(facade.report()).toEqual([]);
    expect(facade.badges()).toEqual([]);
    expect(facade.isLoadingReport()).toBe(false);
  });

  it('delegates download + dialog intents to the respective collaborators', () => {
    const certs = TestBed.inject(CertificateDownload) as unknown as {
      downloadNasba: ReturnType<typeof vi.fn>;
      downloadAllCertificates: ReturnType<typeof vi.fn>;
    };
    const dialogs = TestBed.inject(TrackerDialogOrchestrator) as unknown as {
      openBadgeInfo: ReturnType<typeof vi.fn>;
      openCompliance: ReturnType<typeof vi.fn>;
    };

    facade.downloadNasba();
    expect(certs.downloadNasba).toHaveBeenCalledTimes(1);

    facade.downloadAllCertificates();
    expect(certs.downloadAllCertificates).toHaveBeenCalledWith(facade.selectedYear());

    facade.openBadgeInfo();
    expect(dialogs.openBadgeInfo).toHaveBeenCalledTimes(1);

    facade.openCompliance();
    expect(dialogs.openCompliance).not.toHaveBeenCalled();
  });

  describe('claimBadge', () => {
    it('no active plan → opens upsell; on confirm navigates to payment/plan', () => {
      authCurrentPlan.mockReturnValue(null);
      openClaimUpsell.mockReturnValue(of({ action: 'confirm', result: true }));

      facade.claimBadge(makeBadge());

      expect(openClaimUpsell).toHaveBeenCalledTimes(1);
      expect(routerNavigate).toHaveBeenCalledWith(['/', 'in', 'accounting', 'payment', 'plan']);
      expect(apiGet).not.toHaveBeenCalled();
    });

    it('no active plan → close action does NOT navigate', () => {
      authCurrentPlan.mockReturnValue(null);
      openClaimUpsell.mockReturnValue(of({ action: 'close', result: false }));

      facade.claimBadge(makeBadge());

      expect(routerNavigate).not.toHaveBeenCalled();
    });

    it('with active plan → hits claim API and opens credly_accept_url in a new tab', () => {
      authCurrentPlan.mockReturnValue({ id: 1, subscription_status: 'Active' });
      apiGet.mockReturnValue(of({ data: { credly_accept_url: 'https://credly/badge/abc' } }));

      facade.claimBadge(makeBadge({ id: 42 }));

      expect(apiGet).toHaveBeenCalledWith('user-badges/42/claim/');
      expect(windowOpen).toHaveBeenCalledWith(
        'https://credly/badge/abc',
        '_blank',
        'noopener,noreferrer',
      );
    });

    it('with active plan and no credly_accept_url → toasts the failure', () => {
      authCurrentPlan.mockReturnValue({ id: 1, subscription_status: 'Active' });
      apiGet.mockReturnValue(of({ data: { credly_accept_url: null } }));
      const notify = TestBed.inject(NotificationService) as unknown as {
        error: ReturnType<typeof vi.fn>;
      };

      facade.claimBadge(makeBadge());

      expect(notify.error).toHaveBeenCalledWith(
        'Claim failed',
        expect.stringContaining('Something went wrong'),
      );
      expect(windowOpen).not.toHaveBeenCalled();
    });

    it('with active plan and HTTP error → toasts the failure', () => {
      authCurrentPlan.mockReturnValue({ id: 1, subscription_status: 'Active' });
      apiGet.mockReturnValue(throwError(() => new Error('500')));
      const notify = TestBed.inject(NotificationService) as unknown as {
        error: ReturnType<typeof vi.fn>;
      };

      facade.claimBadge(makeBadge());

      expect(notify.error).toHaveBeenCalled();
    });
  });

  describe('shareBadge', () => {
    it('opens the LinkedIn share URL in a new tab', () => {
      facade.shareBadge(makeBadge({ name: 'AI Ready' }));

      expect(windowOpen).toHaveBeenCalledTimes(1);
      const [url] = windowOpen.mock.calls[0];
      expect(url).toContain('linkedin.com/sharing/share-offsite/');
      expect(url).toContain(encodeURIComponent('I just earned the AI Ready'));
    });
  });

  describe('openBadgeInfo dispatching', () => {
    it('claim action from the dialog re-enters claimBadge with the badge', () => {
      const badge = makeBadge({ id: 99, is_claimable: true });
      authCurrentPlan.mockReturnValue({ id: 1, subscription_status: 'Active' });
      openBadgeInfo.mockReturnValue(of({ action: 'claim', result: true, data: badge }));
      apiGet.mockReturnValue(of({ data: { credly_accept_url: 'https://credly/x' } }));

      facade.openBadgeInfo();

      expect(apiGet).toHaveBeenCalledWith('user-badges/99/claim/');
      expect(windowOpen).toHaveBeenCalledWith('https://credly/x', '_blank', 'noopener,noreferrer');
    });

    it('share action from the dialog re-enters shareBadge', () => {
      const badge = makeBadge({ id: 99, is_claimed: true });
      openBadgeInfo.mockReturnValue(of({ action: 'share', result: true, data: badge }));

      facade.openBadgeInfo();

      expect(windowOpen).toHaveBeenCalledTimes(1);
      expect(windowOpen.mock.calls[0][0]).toContain('linkedin.com');
    });

    it('close action from the dialog is a no-op', () => {
      openBadgeInfo.mockReturnValue(of({ action: 'close', result: false }));

      facade.openBadgeInfo();

      expect(apiGet).not.toHaveBeenCalled();
      expect(windowOpen).not.toHaveBeenCalled();
    });
  });
});
