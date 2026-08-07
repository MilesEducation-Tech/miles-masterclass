import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Utils } from '../../shared/core/services/utils/utils';
import { ReportRow } from '../../shared/core/models/cpe-tracker.model';
import { TrackerTableRow } from './shared/mappers/report-to-table';
import { CpeTracker } from './cpe-tracker';
import { CpeTrackerFacade } from './shared/services/cpe-tracker-facade/cpe-tracker-facade';

function makeRow(rawOverrides: Partial<ReportRow>): TrackerTableRow {
  const raw = {
    id: 99,
    master_class: 100,
    nano_learning: null,
    podcast: null,
    webinar_details: null,
    course_name: 'Some Course',
    transaction_type: 'masterclass',
    course_type: 'masterclass',
    field_of_study: [],
    all_classes_completed: true,
    ...rawOverrides,
  } as ReportRow;
  return {
    key: 'k',
    id: 100,
    courseName: 'Some Course',
    fieldsOfStudy: [],
    deliveryMethod: 'QAS Self Study',
    totalCredits: 0,
    completedAt: null,
    registeredAt: null,
    cairaLevel: null,
    actionKind: 'none',
    raw,
  };
}

describe('CpeTracker', () => {
  let navigate: ReturnType<typeof vi.fn> & ((...args: unknown[]) => void);

  beforeEach(async () => {
    navigate = vi.fn() as ReturnType<typeof vi.fn> & ((...args: unknown[]) => void);
    await TestBed.configureTestingModule({
      imports: [CpeTracker],
      providers: [
        CpeTrackerFacade,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Utils, useValue: { country: () => 'in', profession: () => 'accounting' } },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation((...args: unknown[]) => {
      navigate(...args);
      return Promise.resolve(true);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(CpeTracker);
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('onTitleClick', () => {
    function invokeWithRow(row: TrackerTableRow) {
      const fixture = TestBed.createComponent(CpeTracker);
      (
        fixture.componentInstance as unknown as { onTitleClick(r: TrackerTableRow): void }
      ).onTitleClick(row);
    }

    it('routes masterclass rows to /:country/:profession/masterclass/:id/:slug', () => {
      invokeWithRow(
        makeRow({
          course_type: 'masterclass',
          master_class: 100,
          course_name: 'Ethics 101',
        }),
      );
      expect(navigate).toHaveBeenCalledWith([
        '/',
        'in',
        'accounting',
        'masterclass',
        100,
        'ethics-101',
      ]);
    });

    it('routes podcast rows to /podcast/:id/:slug', () => {
      invokeWithRow(
        makeRow({
          course_type: 'podcast',
          master_class: 200,
          course_name: 'AI Talk',
        }),
      );
      expect(navigate).toHaveBeenCalledWith(['/', 'in', 'accounting', 'podcast', 200, 'ai-talk']);
    });

    it('routes nano_learning rows to /micro-learning/:id/:slug (kebab-case)', () => {
      invokeWithRow(
        makeRow({
          course_type: 'nano_learning',
          master_class: null,
          nano_learning: 28,
          course_name: 'AI is just ML',
        }),
      );
      expect(navigate).toHaveBeenCalledWith([
        '/',
        'in',
        'accounting',
        'micro-learning',
        28,
        'ai-is-just-ml',
      ]);
    });

    it('collapses premiere → /webinar/:id/:slug', () => {
      invokeWithRow(
        makeRow({
          course_type: 'premiere',
          master_class: null,
          nano_learning: null,
          webinar_details: { webinar_id: 140, webinar_name: 'AI-Ready CPA' },
          course_name: 'AI-Ready CPA',
        }),
      );
      expect(navigate).toHaveBeenCalledWith([
        '/',
        'in',
        'accounting',
        'webinar',
        140,
        'ai-ready-cpa',
      ]);
    });

    it('is a no-op when getCourseId resolves to null', () => {
      invokeWithRow(
        makeRow({
          course_type: 'masterclass',
          master_class: null,
          nano_learning: null,
          podcast: null,
          webinar_details: null,
        }),
      );
      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
