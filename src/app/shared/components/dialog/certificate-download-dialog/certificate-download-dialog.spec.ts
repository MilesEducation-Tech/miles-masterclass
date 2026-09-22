import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { CertificateDownloadDialog } from './certificate-download-dialog';
import { MockDialogRef } from '@testing/mocks/dialog.mock';

describe('CertificateDownloadDialog', () => {
  let component: CertificateDownloadDialog;
  let fixture: ComponentFixture<CertificateDownloadDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CertificateDownloadDialog],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CertificateDownloadDialog);
    component = fixture.componentInstance;
    component.dialogRef = new MockDialogRef() as unknown as CertificateDownloadDialog['dialogRef'];
    component.data = {
      courseId: 101,
      courseType: 'masterclass',
      courseTitle: 'Advanced CPA Exam Strategies',
    };
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
