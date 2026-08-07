import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CourseResources } from './course-resources';

describe('CourseResources', () => {
  let component: CourseResources;
  let fixture: ComponentFixture<CourseResources>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseResources],
    }).compileComponents();

    fixture = TestBed.createComponent(CourseResources);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
