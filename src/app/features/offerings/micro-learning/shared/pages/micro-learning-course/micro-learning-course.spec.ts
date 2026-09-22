import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { MicroLearningCourse } from './micro-learning-course';
import { MicroLearningCourseFacade } from '../../../../shared/services/micro-learning-course-facade/micro-learning-course-facade';
import { ChapterFacade } from '../../../../shared/services/chapter-facade/chapter-facade';

describe('MicroLearningCourse', () => {
  let component: MicroLearningCourse;
  let fixture: ComponentFixture<MicroLearningCourse>;

  beforeEach(async () => {
    // The previous hand-written facade stub drifted: the component now reads
    // `scrollToIdRequest`, which the stub never had. Both facades are
    // route-scoped (`micro-learning.ts` lists them in the route's `providers`),
    // so the spec provides the real ones behind the testing HTTP backend —
    // that cannot go stale.
    await TestBed.configureTestingModule({
      imports: [MicroLearningCourse],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MicroLearningCourseFacade,
        ChapterFacade,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MicroLearningCourse);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
