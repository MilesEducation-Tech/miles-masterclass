import { TestBed } from '@angular/core/testing';

import { MasterclassFacade } from './masterclass-facade';

describe('MasterclassFacade', () => {
  let service: MasterclassFacade;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MasterclassFacade);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
