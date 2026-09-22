import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CourseAbout } from './course-about';
import { MOCK_CONTENT_ABOUT } from '@testing/mocks/content.mock';

describe('CourseAbout', () => {
  let component: CourseAbout;
  let fixture: ComponentFixture<CourseAbout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseAbout],
    }).compileComponents();

    fixture = TestBed.createComponent(CourseAbout);
    fixture.componentRef.setInput('card', MOCK_CONTENT_ABOUT);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
