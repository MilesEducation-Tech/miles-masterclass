import { TestBed } from '@angular/core/testing';

import { ChapterFacade } from './chapter-facade';

describe('ChapterFacade', () => {
  let service: ChapterFacade;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChapterFacade);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
