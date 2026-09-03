import { TestBed } from '@angular/core/testing';

import { CourseRouter } from './course-router';

describe('CourseRouter', () => {
  let service: CourseRouter;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CourseRouter);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
