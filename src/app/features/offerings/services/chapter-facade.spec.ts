import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { ChapterFacade } from './chapter-facade';

describe('ChapterFacade', () => {
  let service: ChapterFacade;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        // Route-scoped, not `providedIn: 'root'` — it is listed in a route's
        // `providers`, so a spec has to provide it by hand.
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ChapterFacade,
      ],
    });
    service = TestBed.inject(ChapterFacade);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
