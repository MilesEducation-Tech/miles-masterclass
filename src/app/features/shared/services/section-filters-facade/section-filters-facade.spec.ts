import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { SectionFiltersFacade } from './section-filters-facade';

const URL = `${environment.BASE_API_URL}v2/filters/`;

describe('SectionFiltersFacade', () => {
  let facade: SectionFiltersFacade;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), SectionFiltersFacade],
    });
    facade = TestBed.inject(SectionFiltersFacade);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('returns normalized filter data on a non-empty response', () => {
    let captured: any = 'pending';
    facade.fetch('masterclass', 'popular').subscribe((v) => (captured = v));

    const req = httpMock.expectOne(
      (r) =>
        r.url === URL &&
        r.params.get('course_type') === 'masterclass' &&
        r.params.get('section') === 'popular',
    );
    req.flush({
      status_code: 200,
      message: 'ok',
      data: {
        instructors: [{ id: 1, name: 'A' }],
        categories: [],
        fields_of_study: [],
        additional_categories: [],
        caira_levels: [],
        cpe_credits: [{ key: 'gt_5', label: 'Greater than 5' }],
      },
    });

    expect(captured).toEqual({
      instructors: [{ id: 1, name: 'A' }],
      categories: [],
      fields_of_study: [],
      additional_categories: [],
      caira_levels: [],
      cpe_credits: [{ key: 'gt_5', label: 'Greater than 5' }],
      tracks: undefined,
    });
  });

  it('returns null when every group in the response is empty', () => {
    let captured: any = 'pending';
    facade.fetch('podcast', 'recommended').subscribe((v) => (captured = v));

    const req = httpMock.expectOne((r) => r.url === URL);
    req.flush({
      status_code: 200,
      data: {
        instructors: [],
        categories: [],
        fields_of_study: [],
        additional_categories: [],
        caira_levels: [],
        cpe_credits: [],
      },
    });

    expect(captured).toBeNull();
  });

  it('returns null on HTTP error without surfacing it', () => {
    let captured: any = 'pending';
    let errored = false;
    facade.fetch('masterclass', 'complimentary').subscribe({
      next: (v) => (captured = v),
      error: () => (errored = true),
    });

    const req = httpMock.expectOne((r) => r.url === URL);
    req.flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

    expect(captured).toBeNull();
    expect(errored).toBe(false);
  });

  it('includes track_id when section is track', () => {
    facade.fetch('nano_learning', 'track', 42).subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === URL &&
        r.params.get('course_type') === 'nano_learning' &&
        r.params.get('section') === 'track' &&
        r.params.get('track_id') === '42',
    );
    req.flush({ data: { instructors: [{ id: 1, name: 'A' }] } });
  });

  it('caches: a second fetch for the same key does not hit the network', () => {
    let firstResult: any = 'pending';
    let secondResult: any = 'pending';

    facade.fetch('masterclass', 'popular').subscribe((v) => (firstResult = v));
    const req = httpMock.expectOne((r) => r.url === URL);
    req.flush({ data: { instructors: [{ id: 1, name: 'A' }] } });

    facade.fetch('masterclass', 'popular').subscribe((v) => (secondResult = v));
    httpMock.expectNone((r) => r.url === URL); // cache hit

    expect(firstResult?.instructors).toEqual([{ id: 1, name: 'A' }]);
    expect(secondResult).toEqual(firstResult);
  });

  it('cache is scoped per (courseType, section, trackId)', () => {
    facade.fetch('masterclass', 'popular').subscribe();
    httpMock
      .expectOne((r) => r.url === URL)
      .flush({ data: { instructors: [{ id: 1, name: 'A' }] } });

    facade.fetch('podcast', 'popular').subscribe();
    httpMock
      .expectOne((r) => r.url === URL)
      .flush({ data: { instructors: [{ id: 2, name: 'B' }] } });

    facade.fetch('masterclass', 'track', 7).subscribe();
    httpMock
      .expectOne((r) => r.url === URL && r.params.get('track_id') === '7')
      .flush({ data: { instructors: [{ id: 3, name: 'C' }] } });
  });

  it('clear() invalidates the cache so a follow-up fetch re-hits the network', () => {
    facade.fetch('masterclass', 'popular').subscribe();
    httpMock
      .expectOne((r) => r.url === URL)
      .flush({ data: { instructors: [{ id: 1, name: 'A' }] } });

    facade.clear();

    facade.fetch('masterclass', 'popular').subscribe();
    httpMock
      .expectOne((r) => r.url === URL)
      .flush({ data: { instructors: [{ id: 2, name: 'B' }] } });
  });

  it('clear(courseType) only evicts that course type', () => {
    facade.fetch('masterclass', 'popular').subscribe();
    httpMock
      .expectOne((r) => r.url === URL)
      .flush({ data: { instructors: [{ id: 1, name: 'A' }] } });
    facade.fetch('podcast', 'popular').subscribe();
    httpMock
      .expectOne((r) => r.url === URL)
      .flush({ data: { instructors: [{ id: 2, name: 'B' }] } });

    facade.clear('masterclass');

    // masterclass evicted → re-fetches
    facade.fetch('masterclass', 'popular').subscribe();
    httpMock
      .expectOne((r) => r.url === URL)
      .flush({ data: { instructors: [{ id: 3, name: 'C' }] } });

    // podcast still cached → no network call
    facade.fetch('podcast', 'popular').subscribe();
    httpMock.expectNone((r) => r.url === URL);
  });
});
