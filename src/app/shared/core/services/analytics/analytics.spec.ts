import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Analytics } from './analytics';

describe('Analytics', () => {
  let service: Analytics;

  beforeEach(() => {
    // Analytics injects Auth (→ ApiClient → HttpClient) and Consent, so the
    // test needs an HttpClient. Everything else is providedIn: 'root'.
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Analytics);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
