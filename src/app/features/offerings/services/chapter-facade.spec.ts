import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { MASTERCLASS_ROUTES } from '@core/models/masterclass.model';

import { ChapterFacade } from './chapter-facade';

const DETAILS_URL = apiUrl('v2/masterclass/details/');
const CHAPTERS_URL = apiUrl(MASTERCLASS_ROUTES.getCourseChapter.path);

describe('ChapterFacade', () => {
  let service: ChapterFacade;
  let http: HttpTestingController;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();
  const read = () => {
    void service.courseDetails();
    void service.courseChapters();
    void service.loading();
    TestBed.tick();
  };
  const details = (id: number) => ({
    data: { id, learning_objectives: 'One\r\nTwo', chapter_wise_details: [] },
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        // Route-scoped, not `providedIn: 'root'` — it is listed in a route's
        // `providers`, so a spec has to provide it by hand.
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ChapterFacade,
        { provide: Logger, useValue: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } },
      ],
    });
    service = TestBed.inject(ChapterFacade);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('loads details and chapters together', async () => {
    service.loadCourse({ id: 5, course_type: 'masterclass' });
    read();
    expect(service.loading()).toBe(true);
    http.expectOne((r) => r.url === DETAILS_URL && r.params.get('id') === '5').flush(details(5));
    const chapters = http.expectOne((r) => r.url === CHAPTERS_URL);
    expect(chapters.request.params.get('course_type')).toBe('masterclass');
    chapters.flush({ data: [{ id: 1 }, { id: 2 }] });
    await settle();

    expect(service.courseDetails()?.learning_objective_list).toEqual(['One', 'Two']);
    expect(service.courseChapters().map((c) => c.id)).toEqual([1, 2]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('sets neither when one read fails, and reports the error', async () => {
    service.loadCourse({ id: 5, course_type: 'masterclass' });
    read();
    http.expectOne((r) => r.url === DETAILS_URL).flush(details(5));
    http
      .expectOne((r) => r.url === CHAPTERS_URL)
      .flush({ message: 'Nope' }, { status: 500, statusText: 'Boom' });
    await settle();

    expect(service.courseDetails()).toBeNull();
    expect(service.courseChapters()).toEqual([]);
    expect(service.error()).toBe('Nope');
  });

  it('keeps local edits until the next course loads, and clear() empties it', async () => {
    service.loadCourse({ id: 5, course_type: 'masterclass' });
    read();
    http.expectOne((r) => r.url === DETAILS_URL).flush(details(5));
    http.expectOne((r) => r.url === CHAPTERS_URL).flush({ data: [{ id: 1 }] });
    await settle();

    // Read like the page template does: a linkedSignal only "keeps the previous
    // value" if something has read that value.
    expect(service.courseDetails()?.id).toBe(5);
    service.courseChapters.update((cs) => cs.map((c) => ({ ...c, chapter_name: 'edited' })));
    expect(service.courseChapters()[0].chapter_name).toBe('edited');

    service.loadCourse({ id: 6, course_type: 'masterclass' });
    read();
    // Still showing course 5 while course 6 loads.
    expect(service.courseDetails()?.id).toBe(5);
    http.expectOne((r) => r.url === DETAILS_URL).flush(details(6));
    http.expectOne((r) => r.url === CHAPTERS_URL).flush({ data: [{ id: 9 }] });
    await settle();
    expect(service.courseDetails()?.id).toBe(6);
    expect(service.courseChapters()).toEqual([{ id: 9 }]);

    service.clear();
    expect(service.courseDetails()).toBeNull();
    expect(service.courseChapters()).toEqual([]);
  });
});
