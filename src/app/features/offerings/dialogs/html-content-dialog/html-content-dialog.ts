import { Component, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { injectDialogRef } from 'ng-primitives/dialog';

import { Button } from '@shared/ui/button/button';
import { Dialog } from '@shared/ui/dialog/dialog';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';

export interface HtmlContentDialogData {
  title: string;
  htmlContent: string;
}

@Component({
  selector: 'app-html-content-dialog',
  imports: [Button, Dialog, NgIcon],
  providers: [provideIcons({ heroXMark })],
  templateUrl: './html-content-dialog.html',
  host: { class: 'block' },
})
export class HtmlContentDialog {
  private readonly dialogRef = injectDialogRef<HtmlContentDialogData>();
  protected readonly data = this.dialogRef.data;

  private readonly sanitizer = inject(DomSanitizer);

  get safeHtml(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.data.htmlContent);
  }

  close(): void {
    this.dialogRef.close();
  }
}
