import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CourseAbout } from './course-about';

describe('CourseAbout', () => {
  let component: CourseAbout;
  let fixture: ComponentFixture<CourseAbout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseAbout],
    }).compileComponents();

    fixture = TestBed.createComponent(CourseAbout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
