import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { Dialog } from '@core/services/dialog/dialog';
import { CertificateDownloadDialog } from '@shared/dialogs/certificate-download-dialog/certificate-download-dialog';
import { CertificateTarget } from '@features/tracker/cpe/models/cpe-credit.model';
import { TrackerDialogOrchestrator } from './tracker-dialog-orchestrator';

describe('TrackerDialogOrchestrator', () => {
  let service: TrackerDialogOrchestrator;
  let openSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    openSpy = vi.fn().mockReturnValue({ afterClosed: of(undefined) });
    TestBed.configureTestingModule({
      providers: [
        { provide: NgpDialogManager, useValue: { open: openSpy } },
        // CpeComplianceDialog is still on the hand-rolled service until its batch.
        { provide: Dialog, useValue: { open: vi.fn() } },
      ],
    });
    service = TestBed.inject(TrackerDialogOrchestrator);
  });

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  it('passes the certificate target straight through to the dialog', () => {
    const target: CertificateTarget = {
      courseId: 44,
      courseType: 'masterclass',
      courseTitle: 'AI Enablement for Accounting Firms',
      badge: { id: 6072, acceptUrl: 'https://credly/x', name: 'AI Systems Ethics' },
    };

    service.openCertificateDownloadDialog(target);

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [component, config] = openSpy.mock.calls[0];
    expect(component).toBe(CertificateDownloadDialog);
    expect(config.data).toEqual({
      courseId: 44,
      courseType: 'masterclass',
      courseTitle: 'AI Enablement for Accounting Firms',
      badge: target.badge,
    });
  });
});
