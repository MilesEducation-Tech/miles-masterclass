import { Component } from '@angular/core';
import { injectDialogRef } from 'ng-primitives/dialog';

import { Button } from '@shared/ui/button/button';
import { Dialog } from '@shared/ui/dialog/dialog';

export interface HtmlContentDialogData {
  title: string;
  htmlContent: string;
}

@Component({
  selector: 'app-html-content-dialog',
  imports: [Button, Dialog],
  templateUrl: './html-content-dialog.html',
  host: { class: 'block' },
})
export class HtmlContentDialog {
  private readonly dialogRef = injectDialogRef<HtmlContentDialogData>();
  protected readonly data = this.dialogRef.data;

  close(): void {
    this.dialogRef.close();
  }
}
