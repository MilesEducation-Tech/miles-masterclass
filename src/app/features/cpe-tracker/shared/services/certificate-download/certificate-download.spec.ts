import { TestBed } from '@angular/core/testing';

import { CertificateDownload } from './certificate-download';

describe('CertificateDownload', () => {
  let service: CertificateDownload;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CertificateDownload);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
