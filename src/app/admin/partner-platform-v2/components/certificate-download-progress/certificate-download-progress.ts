import { Component, computed, inject } from '@angular/core';
import { Button } from '@shared/ui/button/button';
import { Progress } from '@shared/ui/progress/progress';
import { PartnerReportFacade } from '@admin/partner-platform-v2/services/partner-report-facade';

/**
 * Live status of the running certificate download — phase, counters, a
 * determinate bar once the total is known, and Cancel. Reads the route-scoped
 * facade directly so the page and the drill-down dialog render the same job;
 * renders nothing while idle.
 */
@Component({
  selector: 'app-certificate-download-progress',
  imports: [Button, Progress],
  templateUrl: './certificate-download-progress.html',
  host: { class: 'block w-full' },
})
export class CertificateDownloadProgress {
  protected readonly facade = inject(PartnerReportFacade);
  protected readonly job = computed(() => this.facade.downloadProgress());

  protected readonly status = computed(() => {
    const job = this.job();
    if (!job) return '';
    switch (job.phase) {
      case 'listing':
        return 'Looking up certificates…';
      case 'fetching':
        return (
          `Fetching certificate ${Math.min(job.done + 1, job.total)} of ${job.total}` +
          (job.failed ? ` · ${job.failed} failed` : '')
        );
      case 'zipping':
        return `Building zip… ${Math.round(job.percent ?? 0)}%`;
      case 'saving':
        return 'Saving…';
    }
  });

  /** Fetching counts toward 90%, the zip build fills the last 10% — one bar, no resets. */
  protected readonly percent = computed(() => {
    const job = this.job();
    if (!job || job.phase === 'listing') return 0;
    if (job.phase === 'fetching') return job.total ? (job.done / job.total) * 90 : 0;
    if (job.phase === 'zipping') return 90 + ((job.percent ?? 0) / 100) * 10;
    return 100;
  });

  protected readonly indeterminate = computed(() => this.job()?.phase === 'listing');
}
