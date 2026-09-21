import { TestBed } from '@angular/core/testing';

import { FinalAssessmentFacade } from './final-assessment-facade';

describe('FinalAssessmentFacade', () => {
  let service: FinalAssessmentFacade;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FinalAssessmentFacade);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
