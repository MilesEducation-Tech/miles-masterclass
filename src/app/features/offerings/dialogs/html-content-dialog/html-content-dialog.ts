import { Component, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { injectDialogRef } from 'ng-primitives/dialog';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';
import { Button } from '@shared/ui/button/button';

export interface HtmlContentDialogData {
  title: string;
  htmlContent: string;
}

@Component({
  selector: 'app-html-content-dialog',
  imports: [Button, DialogShell],
  templateUrl: './html-content-dialog.html',
  styleUrl: './html-content-dialog.css',
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
