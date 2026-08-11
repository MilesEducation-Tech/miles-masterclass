import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CourseChapterList } from './course-chapter-list';

describe('CourseChapterList', () => {
  let component: CourseChapterList;
  let fixture: ComponentFixture<CourseChapterList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseChapterList],
    }).compileComponents();

    fixture = TestBed.createComponent(CourseChapterList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
