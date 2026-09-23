import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { FinalAssessmentFacade } from './final-assessment-facade';

describe('FinalAssessmentFacade', () => {
  let service: FinalAssessmentFacade;

  beforeEach(() => {
    // Route-scoped, not `providedIn: 'root'` — it is listed in a route's
    // `providers`, so a spec has to provide it by hand.
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        FinalAssessmentFacade,
      ],
    });
    service = TestBed.inject(FinalAssessmentFacade);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
