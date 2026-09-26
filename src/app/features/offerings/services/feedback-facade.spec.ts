import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { Analytics } from '@core/services/analytics/analytics';
import { Utils } from '@shared/services/utils';
import { FEEDBACK_ROUTES } from '@features/offerings/models/feedback-model';
import { FeedbackFacade } from './feedback-facade';

const CATEGORIES_URL = apiUrl(FEEDBACK_ROUTES.getFeedbackCategory.path);
const USER_FEEDBACK_URL = apiUrl(FEEDBACK_ROUTES.userFeedback.path);

describe('FeedbackFacade reads', () => {
  let facade: FeedbackFacade;
  let http: HttpTestingController;
  let courseType: string;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();
  // `whenStable()` never resolves while a request is pending, so a read that
  // CHAINS a request (user feedback waits on the course) is stepped with a
  // macrotask instead: the resource applies its response on a microtask.
  const applyResponses = async () => {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
  };
  const readAll = () => {
    void facade.categories();
    void facade.courseDetails();
    void facade.userFeedback();
    TestBed.tick();
  };

  beforeEach(() => {
    courseType = 'masterclass';
    TestBed.configureTestingModule({
      providers: [
        FeedbackFacade,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Utils, useValue: { getCourseType: () => courseType } },
        { provide: Analytics, useValue: { trackEvent: vi.fn() } },
      ],
    });
    facade = TestBed.inject(FeedbackFacade);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests nothing until a course is shown', () => {
    readAll();
    http.expectNone(() => true);
    expect(facade.categories()).toEqual([]);
    expect(facade.courseDetails()).toBeNull();
  });

  it('loads categories and the course, and skips user feedback when not submitted', async () => {
    facade.showCourse(7);
    readAll();
    http.expectOne(CATEGORIES_URL).flush({ data: [{ id: 1, feedback_category: 'Clarity' }] });
    const details = http.expectOne((r) => r.url === apiUrl('v2/masterclass/details/'));
    expect(details.request.params.get('id')).toBe('7');
    details.flush({ data: { id: 7, user_feedback_details: { user_feedback_submitted: false } } });
    await settle();
    TestBed.tick();

    expect(facade.categories()).toEqual([{ id: 1, feedback_category: 'Clarity' }]);
    expect(facade.feedbackSubmitted()).toBe(false);
    http.expectNone((r) => r.url === USER_FEEDBACK_URL);
  });

  it('reads back the learner feedback once the course says it was submitted', async () => {
    facade.showCourse(7);
    readAll();
    http.expectOne(CATEGORIES_URL).flush({ data: [] });
    http
      .expectOne((r) => r.url === apiUrl('v2/masterclass/details/'))
      .flush({ data: { id: 7, user_feedback_details: { user_feedback_submitted: true } } });
    await applyResponses();

    const req = http.expectOne((r) => r.url === USER_FEEDBACK_URL);
    expect(req.request.params.get('master_class__id')).toBe('7');
    req.flush({ data: [{ other_comments: 'Great', feedback_details: [] }] });
    await settle();

    expect(facade.feedbackSubmitted()).toBe(true);
    expect(facade.userFeedback()?.other_comments).toBe('Great');
  });

  it('uses the webinar details endpoint on the webinar feedback page', async () => {
    courseType = 'webinar';
    facade.showCourse(3);
    readAll();
    http.expectOne(CATEGORIES_URL).flush({ data: [] });
    http.expectOne((r) => r.url === apiUrl('webinar/details/')).flush({ data: { id: 3 } });
    await settle();

    expect(facade.courseDetails()?.id).toBe(3);
  });

  it('degrades to empty state when a read fails', async () => {
    facade.showCourse(7);
    readAll();
    http.expectOne(CATEGORIES_URL).flush(null, { status: 500, statusText: 'Boom' });
    http
      .expectOne((r) => r.url === apiUrl('v2/masterclass/details/'))
      .flush(null, { status: 500, statusText: 'Boom' });
    await settle();

    expect(facade.categories()).toEqual([]);
    expect(facade.courseDetails()).toBeNull();
    expect(facade.feedbackSubmitted()).toBe(false);
  });
});
