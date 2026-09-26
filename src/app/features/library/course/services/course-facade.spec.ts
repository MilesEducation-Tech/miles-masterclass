import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { EMPTY_COURSE_FILTERS } from '@core/models/library-filters.model';
import { CourseFacade } from './course-facade';

const FILTERS_URL = apiUrl('v2/library-filters/');
const LIBRARY_URL = apiUrl('v2/library/');

describe('CourseFacade', () => {
  let facade: CourseFacade;
  let http: HttpTestingController;

  // Both reads fire as the facade is built. `whenStable()` waits on every pending
  // request, so each test answers both before settling.
  const settle = () => TestBed.inject(ApplicationRef).whenStable();
  const read = () => {
    void facade.libraryFilters();
    void facade.courseItems();
    void facade.coursePagination();
    TestBed.tick();
  };
  const page = (ids: number[], next: number | null) => ({
    data: ids.map((id) => ({ id })),
    pagination_data: { next_page: next },
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    facade = TestBed.inject(CourseFacade);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('survives a failed filters endpoint instead of throwing on every read', async () => {
    read();
    http.expectOne(FILTERS_URL).flush(null, { status: 404, statusText: 'Not Found' });
    http.expectOne((r) => r.url === LIBRARY_URL).flush(page([1], null));
    await settle();

    expect(() => facade.libraryFilters()).not.toThrow();
    expect(facade.libraryFilters()).toBeUndefined();
    expect(facade.courseItems().map((c) => c.id)).toEqual([1]);
  });

  it('sends multi-select filters comma-separated, and only the non-empty ones', async () => {
    facade.setCourseFilters({ ...EMPTY_COURSE_FILTERS, instructor_ids: [1361, 1522] } as never);
    read();
    http.expectOne(FILTERS_URL).flush({ data: {} });
    const req = http.expectOne((r) => r.url === LIBRARY_URL);
    expect(req.request.params.get('course_type')).toBe('masterclass');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('instructor_ids')).toBe('1361,1522');
    expect(req.request.params.has('category_ids')).toBe(false);
    req.flush(page([], null));
    await settle();
  });

  it('appends the next page, and a type change starts over at page 1', async () => {
    read();
    http.expectOne(FILTERS_URL).flush({ data: {} });
    http.expectOne((r) => r.url === LIBRARY_URL).flush(page([1, 2], 2));
    await settle();
    // Read like the template does: the accumulator appends to what it last produced.
    expect(facade.courseItems().map((c) => c.id)).toEqual([1, 2]);

    facade.loadNextCoursePage();
    read();
    http
      .expectOne((r) => r.url === LIBRARY_URL && r.params.get('page') === '2')
      .flush(page([3], null));
    await settle();
    expect(facade.courseItems().map((c) => c.id)).toEqual([1, 2, 3]);

    facade.selectCourseType('podcast' as never);
    read();
    // The type change fires once at the old page, then the reset effect moves to page 1
    // and the resource cancels the first request (as the old resource() aborted it).
    const reqs = http.match((r) => r.url === LIBRARY_URL);
    const req = reqs[reqs.length - 1];
    expect(reqs.slice(0, -1).every((r) => r.cancelled)).toBe(true);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('course_type')).toBe('podcast');
    req.flush(page([9], null));
    await settle();
    expect(facade.courseItems().map((c) => c.id)).toEqual([9]);
  });

  it('keeps pagination readable when the listing fails', async () => {
    read();
    http.expectOne(FILTERS_URL).flush({ data: {} });
    http.expectOne((r) => r.url === LIBRARY_URL).flush(null, { status: 500, statusText: 'Boom' });
    await settle();

    expect(facade.coursePagination()).toBeUndefined();
    expect(facade.courseError()).toBeTruthy();
    facade.loadNextCoursePage();
    TestBed.tick();
    http.expectNone((r) => r.url === LIBRARY_URL);
  });
});
