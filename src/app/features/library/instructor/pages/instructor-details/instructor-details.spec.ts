import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@core/services/api-client/api-client';
import { Analytics } from '@core/services/analytics/analytics';

import { InstructorDetails } from './instructor-details';

describe('InstructorDetails', () => {
  let component: InstructorDetails;
  let fixture: ComponentFixture<InstructorDetails>;
  let http: HttpTestingController;
  let trackEvent: ReturnType<typeof vi.fn>;

  /** Test access to the page's protected, template-only signals. */
  const view = () =>
    component as unknown as {
      instructor(): { id: number } | null;
      relatedCourses(): { id: number }[];
      onTabChange(label: string): void;
    };

  beforeEach(async () => {
    trackEvent = vi.fn();
    await TestBed.configureTestingModule({
      imports: [InstructorDetails],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Analytics, useValue: { trackEvent } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InstructorDetails);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should create, and fetches nothing without an instructor id', async () => {
    await fixture.whenStable();
    expect(component).toBeTruthy();
    http.expectNone(() => true);
  });

  it('loads the instructor and groups their courses per tab', async () => {
    fixture.componentRef.setInput('instructorId', 7);
    fixture.detectChanges();
    http
      .expectOne(apiUrl('instructor/7/'))
      .flush({ data: { id: 7, first_name: 'Ada', last_name: 'L' } });
    const courses = http.expectOne((r) => r.url === apiUrl('instructor/7/courses/'));
    expect(courses.request.params.get('page')).toBe('1');
    courses.flush({
      data: {
        masterclass: [
          { id: 1, course_type: 'Video' },
          { id: 2, course_type: 'Audio' },
        ],
        nano: [{ id: 3, course_type: 'nano' }],
      },
    });
    await fixture.whenStable();

    expect(view().instructor()?.id).toBe(7);
    expect(
      view()
        .relatedCourses()
        .map((c) => c.id),
    ).toEqual([1]);
    view().onTabChange('Podcast');
    expect(
      view()
        .relatedCourses()
        .map((c) => c.id),
    ).toEqual([2]);
    view().onTabChange('Micro Learning');
    expect(
      view()
        .relatedCourses()
        .map((c) => c.id),
    ).toEqual([3]);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('view_instructor', {
      instructor_id: 7,
      instructor_name: 'Ada L',
    });
  });

  it('degrades to empty state when the reads fail, without throwing', async () => {
    fixture.componentRef.setInput('instructorId', 7);
    fixture.detectChanges();
    http.expectOne(apiUrl('instructor/7/')).flush(null, { status: 404, statusText: 'Not Found' });
    http
      .expectOne((r) => r.url === apiUrl('instructor/7/courses/'))
      .flush(null, { status: 500, statusText: 'Boom' });
    await fixture.whenStable();

    expect(view().instructor()).toBeNull();
    expect(view().relatedCourses()).toEqual([]);
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
