import { TestBed } from '@angular/core/testing';

import { Tracks } from './tracks';

describe('Tracks', () => {
  let service: Tracks;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Tracks);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
