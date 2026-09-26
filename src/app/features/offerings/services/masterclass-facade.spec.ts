import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { Analytics } from '@core/services/analytics/analytics';
import { MASTERCLASS_ROUTES } from '@core/models/masterclass.model';

import { MasterclassFacade } from './masterclass-facade';

describe('MasterclassFacade', () => {
  let service: MasterclassFacade;
  let http: HttpTestingController;
  let trackEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    trackEvent = vi.fn();
    // Route-scoped, not `providedIn: 'root'` — it is listed in the course
    // route's `providers` (features.ts) so each course subtree gets its own
    // instance. A spec therefore has to provide it by hand.
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MasterclassFacade,
        { provide: Analytics, useValue: { trackEvent } },
      ],
    });
    service = TestBed.inject(MasterclassFacade);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('reports view_item once per load, not on a local edit', async () => {
    service.loadCourse({ id: 3, course_type: 'podcast' });
    void service.courseDetails();
    TestBed.tick();
    http
      .expectOne((r) => r.url === apiUrl('v2/podcast/details/'))
      .flush({ data: { id: 3, title: 'Tax', learning_objectives: '', chapter_wise_details: [] } });
    http
      .expectOne((r) => r.url === apiUrl(MASTERCLASS_ROUTES.getCourseChapter.path))
      .flush({ data: [] });
    await TestBed.inject(ApplicationRef).whenStable();

    const viewItem = () => trackEvent.mock.calls.filter(([name]) => name === 'view_item');
    expect(viewItem()).toEqual([
      ['view_item', { course_id: 3, course_name: 'Tax', course_type: 'podcast' }],
    ]);

    service.courseDetails.update((c) => (c ? { ...c, is_added_to_cart: false } : c));
    await TestBed.inject(ApplicationRef).whenStable();
    expect(viewItem()).toHaveLength(1);
  });
});
