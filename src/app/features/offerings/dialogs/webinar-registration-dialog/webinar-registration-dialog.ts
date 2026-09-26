import { Component, computed } from '@angular/core';
import { injectDialogRef } from 'ng-primitives/dialog';

import { Button } from '@shared/ui/button/button';
import { DialogShell } from '@shared/ui/dialog-shell/dialog-shell';
import { UpcomingPremiere } from '@core/models/feature.model';
import {
  WebinarRegistrationForm,
  WebinarRegistrationFormValue,
} from '@shared/components/webinar-registration-form/webinar-registration-form';

export interface WebinarRegistrationDialogData {
  webinar: UpcomingPremiere;
  /**
   * Notified after the registration form successfully completes (direct enroll,
   * already enrolled, or OTP verified). The list item / facade can use this to
   * flip the local `registered_webinar.added` flag optimistically.
   */
  onRegistered?: (payload: WebinarRegistrationFormValue, webinar: UpcomingPremiere) => void;
}

/**
 * Pre-login registration dialog: a guest clicks "Book Now" and registers here.
 * Wraps the same `<app-webinar-registration-form>` the hero uses, so the entire
 * REGISTER → OTP → DONE state machine and Log-in CTA swap come along for free.
 *
 * ORPHANED — nothing imports it. It was already unreferenced before the webinar
 * rebuild (its caller, `PremiereListItem`, is gone with the design-only shell
 * that feature replaced), and the new module registers through
 * `WebinarRegistration` instead. Delete it, or wire it to the new flow; it is
 * left in place here only because removing it is not this port's job.
 */
@Component({
  selector: 'app-webinar-registration-dialog',
  imports: [Button, WebinarRegistrationForm, DialogShell],
  templateUrl: './webinar-registration-dialog.html',
  host: { class: 'block' },
})
export class WebinarRegistrationDialog {
  private readonly dialogRef = injectDialogRef<
    WebinarRegistrationDialogData,
    'registered' | 'closed'
  >();
  private readonly data = this.dialogRef.data;

  protected readonly webinar = computed(() => this.data.webinar);
  // ponytail: was `nextSessionOf()` from the removed webinar status utils.
  protected readonly nextSession = computed(() => this.webinar().webinar_dates?.[0] ?? null);

  protected close(): void {
    this.dialogRef.close('closed');
  }

  protected onRegistered(payload: WebinarRegistrationFormValue): void {
    this.data.onRegistered?.(payload, this.webinar());
    this.dialogRef.close('registered');
  }
}
