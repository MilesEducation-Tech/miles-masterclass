import { Component, inject, OnInit, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { injectDialogRef } from 'ng-primitives/dialog';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';
import { Button } from '../../ui/button/button';
import { NgIcon } from '@ng-icons/core';
import { heroLink, heroCheck } from '@ng-icons/heroicons/outline';
import { Logger } from '@core/services/logger/logger';

export interface ShareDialogData {
  url?: string;
}

@Component({
  selector: 'app-share-dialog',
  imports: [Button, DialogShell, NgIcon],
  templateUrl: './share-dialog.html',
})
export class ShareDialog implements OnInit {
  private readonly dialogRef = injectDialogRef<ShareDialogData>();
  protected readonly data = this.dialogRef.data;
  private readonly document = inject(DOCUMENT);
  private readonly logger = inject(Logger);

  readonly url = signal('');
  readonly copied = signal(false);
  readonly icons = signal({ link: heroLink, check: heroCheck });

  ngOnInit() {
    const targetUrl = this.data?.url || this.document.defaultView?.location.href || '';
    this.url.set(targetUrl);
  }

  close() {
    this.dialogRef.close();
  }

  async copy() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(this.url());
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      }
    } catch (err) {
      this.logger.error('Failed to copy', err);
    }
  }
}
