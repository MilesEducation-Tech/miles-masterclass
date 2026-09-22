import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { CourseInfo } from './course-info';
import { MockDialogRef } from '../../../../testing/mocks/dialog.mock';
import { MOCK_CONTENT_ABOUT } from '../../../../testing/mocks/content.mock';

describe('CourseInfo', () => {
  let component: CourseInfo;
  let fixture: ComponentFixture<CourseInfo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseInfo],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CourseInfo);
    component = fixture.componentInstance;
    component.dialogRef = new MockDialogRef() as unknown as CourseInfo['dialogRef'];
    component.data = MOCK_CONTENT_ABOUT;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
