import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { Carousel } from '../carousel/carousel';
import { Content } from '@core/models/course.model';
import { RELATED_CONTENT_ROUTES } from '@core/models/related-content.model';
import { CourseRelatedSection } from './course-related-section';

/**
 * This component had NO spec before Phase 9, and the related-content read moved
 * from an `effect()` + `.subscribe()` + `signal.set()` to an `httpResource`. These
 * cover the three things that change observably: the request is keyed on the
 * inputs, the current course is filtered out of its own related list, and a failed
 * fetch collapses the section instead of throwing.
 *
 * The instructor fan-out is deliberately NOT converted (one `httpResource` is one
 * request; N is only known at runtime), so it stays a `forkJoin` and these tests
 * simply flush whatever it asks for.
 */
describe('CourseRelatedSection', () => {
  let fixture: ComponentFixture<CourseRelatedSection>;
  let backend: HttpTestingController;

  const row = (id: number): Content =>
    ({ id, title: `Course ${id}`, thumbnail: '', course_type: 'masterclass' }) as Content;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseRelatedSection],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CourseRelatedSection);
    fixture.componentRef.setInput('courseId', 10);
    fixture.componentRef.setInput('courseType', 'masterclass');
    fixture.detectChanges();
  });

  const relatedReqs = (): HttpRequest<unknown>[] =>
    backend
      .match((r) => r.url.includes(RELATED_CONTENT_ROUTES.getRelatedContent.path))
      .map((t) => {
        const req = t.request;
        t.flush({ data: [], status: true, message: '' });
        return req;
      });

  /** Flush everything pending, then settle. A pending request never stabilises. */
  const flushRelated = async (rows: Content[]) => {
    const pending = backend.match((r) =>
      r.url.includes(RELATED_CONTENT_ROUTES.getRelatedContent.path),
    );
    expect(pending).toHaveLength(1);
    pending[0].flush({ data: rows, status: true, message: '' });
    await TestBed.inject(ApplicationRef).whenStable();
    fixture.detectChanges();
  };

  /**
   * Assert on what the carousel is HANDED, not on rendered slides: `app-carousel`
   * fills itself through swiper and an `ng-template`, neither of which runs in
   * jsdom, so counting `app-horizontal` elements counts zero however much data
   * arrived.
   */
  const relatedCarousel = () => fixture.debugElement.query(By.directive(Carousel));
  const cardCount = () => {
    const el = relatedCarousel();
    return el ? (el.componentInstance as Carousel).cards().length : 0;
  };

  it('requests related content keyed on the course id and type', () => {
    const reqs = relatedReqs();
    expect(reqs).toHaveLength(1);
    expect(reqs[0].method).toBe('GET');
    expect(reqs[0].params.get('id')).toBe('10');
    expect(reqs[0].params.get('type')).toBe('masterclass');
  });

  it('renders the related courses it receives', async () => {
    await flushRelated([row(1), row(2)]);
    expect(cardCount()).toBe(2);
  });

  /**
   * The API has been known to include the current course in its own related list.
   * This filter used to read `courseId()` inside a `.subscribe()` callback — i.e.
   * outside any reactive context; it is a `computed` now.
   */
  it('filters the current course out of its own related list', async () => {
    await flushRelated([row(10), row(1)]);
    expect(cardCount()).toBe(1);
  });

  /**
   * The `hasValue()` guard's reason for existing: `value()` throws on an errored
   * resource even with a `defaultValue`, and this sits on the course detail page.
   */
  it('collapses the section on error instead of throwing', async () => {
    const pending = backend.match((r) =>
      r.url.includes(RELATED_CONTENT_ROUTES.getRelatedContent.path),
    );
    pending[0].flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    await TestBed.inject(ApplicationRef).whenStable();
    fixture.detectChanges();

    expect(cardCount()).toBe(0);
    // Nothing renders, and the failure is observable rather than swallowed.
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Related Courses');
  });

  it('sends no request until the inputs are set', async () => {
    // A fresh fixture with no inputs: the request function returns undefined, so
    // the resource stays idle rather than firing a request it cannot key.
    const bare = TestBed.createComponent(CourseRelatedSection);
    bare.componentRef.setInput('courseId', 0);
    bare.componentRef.setInput('courseType', 'masterclass');
    bare.detectChanges();

    expect(
      backend.match(
        (r) =>
          r.url.includes(RELATED_CONTENT_ROUTES.getRelatedContent.path) &&
          r.params.get('id') === '0',
      ),
    ).toHaveLength(0);
  });
});
