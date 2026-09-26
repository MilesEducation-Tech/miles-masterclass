import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { InstructorFacade } from './instructor-facade';

const URL = apiUrl('instructor/');

describe('InstructorFacade', () => {
  let facade: InstructorFacade;
  let http: HttpTestingController;
  const settle = () => TestBed.inject(ApplicationRef).whenStable();
  const read = () => {
    void facade.instructorItems();
    void facade.instructorPagination();
    TestBed.tick();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    facade = TestBed.inject(InstructorFacade);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists page 1 with no search param until a term is set', async () => {
    read();
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.has('search_key')).toBe(false);
    req.flush({ data: [{ id: 1 }], pagination_data: { next_page: 2 } });
    await settle();

    expect(facade.instructorItems().map((i) => i.id)).toEqual([1]);
  });

  it('a search starts over at page 1 with the trimmed term', async () => {
    read();
    http
      .expectOne((r) => r.url === URL)
      .flush({ data: [{ id: 1 }], pagination_data: { next_page: 2 } });
    await settle();
    void facade.instructorItems();
    facade.loadNextInstructorPage();
    read();
    http
      .expectOne((r) => r.url === URL && r.params.get('page') === '2')
      .flush({ data: [{ id: 2 }] });
    await settle();

    facade.setSearchKey('  ada ');
    read();
    const reqs = http.match((r) => r.url === URL);
    const req = reqs[reqs.length - 1];
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('search_key')).toBe('ada');
    req.flush({ data: [{ id: 9 }] });
    await settle();
    expect(facade.instructorItems().map((i) => i.id)).toEqual([9]);
  });

  it('keeps pagination readable when the list fails', async () => {
    read();
    http.expectOne((r) => r.url === URL).flush(null, { status: 500, statusText: 'Boom' });
    await settle();

    expect(facade.instructorPagination()).toBeUndefined();
    expect(facade.instructorError()).toBeTruthy();
  });
});
