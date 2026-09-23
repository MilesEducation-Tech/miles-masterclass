import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { MasterclassFacade } from './masterclass-facade';

describe('MasterclassFacade', () => {
  let service: MasterclassFacade;

  beforeEach(() => {
    // Route-scoped, not `providedIn: 'root'` — it is listed in the course
    // route's `providers` (features.ts) so each course subtree gets its own
    // instance. A spec therefore has to provide it by hand.
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MasterclassFacade,
      ],
    });
    service = TestBed.inject(MasterclassFacade);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
