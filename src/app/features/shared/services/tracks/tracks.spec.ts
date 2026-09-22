import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { Tracks } from './tracks';

describe('Tracks', () => {
  let service: Tracks;

  beforeEach(() => {
    // Route-scoped, not `providedIn: 'root'` — it is listed in the features
    // shell route's `providers` (features.ts), so a spec has to provide it by
    // hand.
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), Tracks],
    });
    service = TestBed.inject(Tracks);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
