import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { Analytics } from '@core/services/analytics/analytics';
import { Storage } from '@core/services/storage/storage';
import { Utils } from '@shared/services/utils';
import { ASSESSMENT_ROUTES } from '@features/offerings/models/assessment.model';

import { FinalAssessmentFacade } from './final-assessment-facade';

const DETAILS_URL = apiUrl('v2/masterclass/details/');
const QUESTIONS_URL = apiUrl(ASSESSMENT_ROUTES.getFinalAssessmentQuestions.path);
const CACHE_KEY = 'final_assessment_questions_12';

describe('FinalAssessmentFacade', () => {
  let service: FinalAssessmentFacade;
  let http: HttpTestingController;
  let local: Map<string, unknown>;
  let trackEvent: ReturnType<typeof vi.fn>;

  // `whenStable()` never resolves while a request is pending, and the questions
  // read chains on the details read, so steps between the two use a macrotask.
  const applyResponses = async () => {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
  };

  beforeEach(() => {
    local = new Map();
    trackEvent = vi.fn();
    // Route-scoped, not `providedIn: 'root'` — it is listed in a route's
    // `providers`, so a spec has to provide it by hand.
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        FinalAssessmentFacade,
        { provide: Utils, useValue: { getCourseDetailsSegment: () => 'masterclass' } },
        { provide: Analytics, useValue: { trackEvent } },
        {
          provide: Storage,
          useValue: {
            getLocal: (key: string) => local.get(key) ?? null,
            setLocal: (key: string, value: unknown) => local.set(key, value),
            removeLocal: (key: string) => local.delete(key),
          },
        },
      ],
    });
    service = TestBed.inject(FinalAssessmentFacade);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const open = (status?: string) => {
    service.courseId.set('12');
    service.sessionId.set('34');
    void service.questions();
    void service.isLoading();
    TestBed.tick();
    const req = http.expectOne((r) => r.url === DETAILS_URL);
    expect(req.request.params.get('id')).toBe('12');
    req.flush({
      data: { id: 12, course_type: 'masterclass', user_assessment_details: { status } },
    });
  };

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('requests nothing until a course is set', () => {
    void service.questions();
    TestBed.tick();
    http.expectNone(() => true);
  });

  it('fetches a fresh attempt, caches it, and reports the start', async () => {
    open('In_Progress');
    await applyResponses();
    const req = http.expectOne((r) => r.url === QUESTIONS_URL);
    expect(req.request.params.get('session_id')).toBe('34');
    expect(req.request.params.get('masterclass_id')).toBe('12');
    req.flush({ data: [{ id: 1, question: 'Q1' }] });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(service.questions()).toEqual([{ id: 1, question: 'Q1' }]);
    expect(local.get(CACHE_KEY)).toEqual([{ id: 1, question: 'Q1' }]);
    expect(service.isAssessmentPassed()).toBe(false);
    expect(service.isLoading()).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith('assessment_start', {
      course_id: 12,
      session_id: 34,
      course_type: 'masterclass',
    });
  });

  it('resumes a cached attempt without fetching questions', async () => {
    local.set(CACHE_KEY, [{ id: 9, question: 'Cached', user_selected_option: 'b' }]);
    open('In_Progress');
    await applyResponses();

    http.expectNone((r) => r.url === QUESTIONS_URL);
    expect(service.questions()).toEqual([{ id: 9, question: 'Cached', user_selected_option: 'b' }]);
  });

  it('shows no exam, and reports no start, once the course is passed', async () => {
    open('Exam_Passed');
    await applyResponses();

    http.expectNone((r) => r.url === QUESTIONS_URL);
    expect(service.isAssessmentPassed()).toBe(true);
    expect(service.questions()).toEqual([]);
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
