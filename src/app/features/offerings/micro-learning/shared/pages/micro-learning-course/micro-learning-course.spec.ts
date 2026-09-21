import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MicroLearningCourseFacade } from '../../../../shared/services/micro-learning-course-facade/micro-learning-course-facade';
import { MicroLearningCourse } from './micro-learning-course';

describe('MicroLearningCourse', () => {
  let component: MicroLearningCourse;
  let fixture: ComponentFixture<MicroLearningCourse>;

  const facadeStub = {
    courseDetails: signal(null),
    detailsList: signal([]),
    selectedReelId: signal(null),
    loading: signal(false),
    error: signal(null),
    nextCursor: signal(null),
    loadingMore: signal(false),
    initForCourse: vi.fn(),
    loadCourseDetails: vi.fn(),
    loadNextPage: vi.fn(),
    clear: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MicroLearningCourse],
      providers: [{ provide: MicroLearningCourseFacade, useValue: facadeStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(MicroLearningCourse);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
