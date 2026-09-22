import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { Course } from './course';
import { LibraryFiltersData } from '../../../shared/core/models/library-filters.model';

/** Every list the `groups` computed maps over — an empty body would throw. */
const EMPTY_FILTERS: LibraryFiltersData = {
  instructors: [],
  categories: [],
  fields_of_study: [],
  additional_categories: [],
  caira_levels: [],
  cpe_credits: [],
  tracks: [],
};

describe('Course', () => {
  let component: Course;
  let fixture: ComponentFixture<Course>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Course],
      // Without the testing backend this spec made a REAL request to the UAT
      // API and failed on its 404. A unit test must never perform network I/O.
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Course);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // The facade's `resource()` loaders are promises; `whenStable()` never
    // settles until the testing backend answers them.
    const http = TestBed.inject(HttpTestingController);
    for (const request of http.match(() => true)) {
      const data = request.request.url.includes('library-filters') ? EMPTY_FILTERS : [];
      request.flush({ status_code: 200, data, message: 'ok' });
    }
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
