import { Component } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { injectDialogRef } from 'ng-primitives/dialog';
import { environment } from '@env/environment';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';
import { Button } from '../../ui/button/button';
import { ButtonVariant } from '@core/models/button.model';
import { appStoreIcon, googlePlayIcon } from '@core/constants/icon';

export interface DialogButton {
  label: string;
  variant?: ButtonVariant;
  action: 'confirm' | 'cancel' | 'close';
}

export interface UtilsDialogData {
  title?: string;
  containerClass?: string;
  content: HTMLContent[];
  buttons?: DialogButton[];
  /**
   * Subtitle for the Miles One app-download layout. When `subtitle` or
   * `footer` is set, the dialog renders the app-download design (store
   * badges + QR + phone mockup) instead of the typed `content[]` list.
   * Used by `CONTENT_MAP` in `auth.config.ts` for LMS-migration prompts.
   */
  subtitle?: string;
  /** Bottom-of-card caption shown below the phone mockup. */
  footer?: string;
  /**
   * Presentation — the per-call `width` / `maxWidth` / `ariaLabel` / `disableClose` config
   * the old `Dialog` service took. This one dialog serves every caller, so unlike the
   * others it can't own a single size; the caller passes it here.
   */
  width?: string;
  maxWidth?: string;
  /** Falls back to `title`, which the panel used to be labelled by. */
  ariaLabel?: string;
  /** `true` ignores Escape and backdrop clicks. */
  disableClose?: boolean;
}

export interface UtilsDialogResult {
  action?: DialogButton['action'];
  result: boolean;
  data?: any;
}

export type HTMLContent =
  | { type: 'text'; value: string }
  | { type: 'heading'; value: string; level: 1 | 2 | 3 | 4 }
  | { type: 'subtext'; value: string }
  | { type: 'description'; value: string }
  | { type: 'note'; value: string; variant?: 'info' | 'warning' | 'success' }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'image'; src: string; alt: string; caption?: string }
  | { type: 'code'; value: string; language?: string }
  | { type: 'clickable-list'; items: { label: string; value: any }[] }
  | {
      type: 'links';
      items: { label: string; href: string; description?: string }[];
    };

/**
 * Miles Masterclass apps — also brand-served as "Miles One" in copy. URLs are
 * mirrored from the footer / app-download component so a future move to a
 * dedicated Miles One listing is a one-line swap.
 */
const APP_STORE_URL = 'https://apps.apple.com/us/app/miles-one/id6504799221';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.miles.one';
@Component({
  selector: 'app-utils-dialog',
  imports: [Button, NgIcon, DialogShell],
  templateUrl: './utils-dialog.html',
  styleUrl: './utils-dialog.css',
})
export class UtilsDialog {
  private readonly dialogRef = injectDialogRef<UtilsDialogData, UtilsDialogResult>();
  protected readonly data = this.dialogRef.data;

  protected readonly APP_STORE_URL = APP_STORE_URL;
  protected readonly PLAY_STORE_URL = PLAY_STORE_URL;
  protected readonly S3_BUCKET_URL = environment.S3_BUCKET_URL;
  /** Shared brand SVGs reused from the footer + app-download component. */
  protected readonly appStoreIcon = appStoreIcon;
  protected readonly googlePlayIcon = googlePlayIcon;

  /**
   * Renders the Miles One app-download layout when either `subtitle` or
   * `footer` is set on the data. Existing callers that only set `content[]`
   * keep the original typed layout untouched.
   */
  protected readonly showAppDownload = !!(this.data.subtitle || this.data.footer);

  close(): void {
    this.dialogRef.close();
  }

  handleButtonClick(action: DialogButton['action']): void {
    switch (action) {
      case 'confirm':
        this.dialogRef.close({ action, result: true });
        break;
      case 'cancel':
        this.dialogRef.close({ action, result: true });
        break;
      case 'close':
      default:
        this.dialogRef.close({ result: false });
        break;
    }
  }

  handleItemClick(item: any): void {
    this.dialogRef.close({ result: false, data: item });
  }
}
