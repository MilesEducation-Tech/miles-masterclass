import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { FinalAssessmentFacade } from '../../services/final-assessment-facade';

import { FinalAssessmentReport } from './final-assessment-report';

describe('FinalAssessmentReport', () => {
  let component: FinalAssessmentReport;
  let fixture: ComponentFixture<FinalAssessmentReport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinalAssessmentReport],
      providers: [
        // Route-scoped, not `providedIn: 'root'` — it is listed in a route's
        // `providers`, so a spec has to provide it by hand.
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        FinalAssessmentFacade,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FinalAssessmentReport);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
