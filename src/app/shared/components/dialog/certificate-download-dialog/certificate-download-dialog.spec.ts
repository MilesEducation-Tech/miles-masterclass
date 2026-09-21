import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CertificateDownloadDialog } from './certificate-download-dialog';

describe('CertificateDownloadDialog', () => {
  let component: CertificateDownloadDialog;
  let fixture: ComponentFixture<CertificateDownloadDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CertificateDownloadDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(CertificateDownloadDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
