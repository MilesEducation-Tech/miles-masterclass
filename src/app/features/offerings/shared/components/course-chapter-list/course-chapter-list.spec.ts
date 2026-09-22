import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MasterclassFacade } from '../../services/masterclass-facade/masterclass-facade';

import { CourseChapterList } from './course-chapter-list';

describe('CourseChapterList', () => {
  let component: CourseChapterList;
  let fixture: ComponentFixture<CourseChapterList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseChapterList],
      providers: [
        // Route-scoped, not `providedIn: 'root'` — it is listed in a route's
        // `providers`, so a spec has to provide it by hand.
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MasterclassFacade,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CourseChapterList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
