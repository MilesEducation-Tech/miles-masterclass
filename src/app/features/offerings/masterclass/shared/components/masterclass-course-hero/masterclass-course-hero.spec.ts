import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MasterclassFacade } from '../../../../shared/services/masterclass-facade/masterclass-facade';

import { MOCK_CONTENT_DETAILS } from '../../../../../../testing/mocks/content.mock';

import { MasterclassCourseHero } from './masterclass-course-hero';

describe('MasterclassCourseHero', () => {
  let component: MasterclassCourseHero;
  let fixture: ComponentFixture<MasterclassCourseHero>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MasterclassCourseHero],
      providers: [
        // Route-scoped, not `providedIn: 'root'` — it is listed in a route's
        // `providers`, so a spec has to provide it by hand.
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MasterclassFacade,
      ],
    }).compileComponents();

    // The hero template opens with `@let courseDetails = masterclass.courseDetails()!`
    // and dereferences it unguarded, so it only renders against a loaded
    // course. Seed the facade the way the course page does.
    TestBed.inject(MasterclassFacade).courseDetails.set(MOCK_CONTENT_DETAILS);

    fixture = TestBed.createComponent(MasterclassCourseHero);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
