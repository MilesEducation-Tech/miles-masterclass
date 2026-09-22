import { TestBed } from '@angular/core/testing';

import { FeatureFacade } from './feature-facade';

describe('FeatureFacade', () => {
  let service: FeatureFacade;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FeatureFacade);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
