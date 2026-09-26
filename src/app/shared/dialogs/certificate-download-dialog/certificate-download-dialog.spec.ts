import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { CertificateDownloadDialog } from './certificate-download-dialog';
import { provideMockDialogRef, stubDialogShell } from '@testing/mocks/dialog-ref.mock';

describe('CertificateDownloadDialog', () => {
  let component: CertificateDownloadDialog;
  let fixture: ComponentFixture<CertificateDownloadDialog>;

  beforeEach(async () => {
    stubDialogShell(CertificateDownloadDialog);
    await TestBed.configureTestingModule({
      imports: [CertificateDownloadDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockDialogRef({
          courseId: 101,
          courseType: 'masterclass',
          courseTitle: 'Advanced CPA Exam Strategies',
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CertificateDownloadDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
