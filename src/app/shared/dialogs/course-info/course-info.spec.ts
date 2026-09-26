import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { CourseInfo } from './course-info';
import { provideMockDialogRef, stubDialogShell } from '@testing/mocks/dialog-ref.mock';
import { MOCK_CONTENT_ABOUT } from '@testing/mocks/content.mock';

describe('CourseInfo', () => {
  let component: CourseInfo;
  let fixture: ComponentFixture<CourseInfo>;

  beforeEach(async () => {
    stubDialogShell(CourseInfo);
    await TestBed.configureTestingModule({
      imports: [CourseInfo],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockDialogRef(MOCK_CONTENT_ABOUT),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CourseInfo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
