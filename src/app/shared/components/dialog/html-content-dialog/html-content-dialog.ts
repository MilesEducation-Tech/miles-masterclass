import { Component, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DialogRef } from '../../../core/services/dialog/dialog';
import { Button } from '../../ui/button/button';

export interface HtmlContentDialogData {
  title: string;
  htmlContent: string;
}

@Component({
  selector: 'app-html-content-dialog',
  imports: [Button],
  templateUrl: './html-content-dialog.html',
  styleUrl: './html-content-dialog.css',
})
export class HtmlContentDialog {
  dialogRef!: DialogRef<HtmlContentDialog>;
  data!: HtmlContentDialogData;

  private readonly sanitizer = inject(DomSanitizer);

  get safeHtml(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.data.htmlContent);
  }

  close(): void {
    this.dialogRef.close();
  }
}
