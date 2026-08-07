import { Component, computed } from '@angular/core';

import { Button } from '../../ui/button/button';
import { DialogRef } from '../../../core/services/dialog/dialog';
import {
  WebinarRegistrationForm,
  WebinarRegistrationFormValue,
} from '../../../../features/offerings/webinar/shared/components/webinar-registration-form/webinar-registration-form';
import { nextSessionOf } from '../../../../features/offerings/webinar/shared/utils/webinar-status';

export interface WebinarRegistrationDialogData {
  webinar: any;
  /**
   * Notified after the registration form successfully completes (direct enroll,
   * already enrolled, or OTP verified). The list item / facade can use this to
   * flip the local `registered_webinar.added` flag optimistically.
   */
  onRegistered?: (payload: WebinarRegistrationFormValue, webinar: any) => void;
}

/**
 * Pre-login registration dialog opened from list items (e.g.
 * `PremiereListItem`) when a guest clicks "Book Now". Wraps the same
 * `<app-webinar-registration-form>` the hero uses, so the entire REGISTER →
 * OTP → DONE state machine and Log-in CTA swap come along for free.
 */
@Component({
  selector: 'app-webinar-registration-dialog',
  imports: [Button, WebinarRegistrationForm],
  templateUrl: './webinar-registration-dialog.html',
  styleUrl: './webinar-registration-dialog.css',
})
export class WebinarRegistrationDialog {
  dialogRef!: DialogRef<WebinarRegistrationDialog, 'registered' | 'closed'>;
  data!: WebinarRegistrationDialogData;

  protected readonly webinar = computed(() => this.data.webinar);
  protected readonly nextSession = computed(() => nextSessionOf(this.webinar()));

  protected close(): void {
    this.dialogRef.close('closed');
  }

  protected onRegistered(payload: WebinarRegistrationFormValue): void {
    this.data.onRegistered?.(payload, this.webinar());
    this.dialogRef.close('registered');
  }
}
