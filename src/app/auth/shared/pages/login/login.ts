import { Component, DestroyRef, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '../../../../shared/components/ui/button/button';
import { Forms } from '../../../../shared/components/ui/forms/forms';
import { AriaInput } from '../../../../shared/components/ui/aria/aria-input/aria-input';
import { AuthFacade } from '../../services/auth-facade';
import { FormField as AngularFormField } from '@angular/forms/signals';
import { AriaAutocomplete } from '../../../../shared/components/ui/aria/aria-autocomplete/aria-autocomplete';
import { Otp } from '../../../../shared/components/ui/otp/otp';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { TabStrip } from '../../../../shared/components/ui/tab-strip/tab-strip';
import { Utils } from '../../../../shared/core/services/utils/utils';

@Component({
  selector: 'app-login',
  imports: [
    Forms,
    AriaInput,
    AriaAutocomplete,
    Otp,
    Button,
    AngularFormField,
    Spinner,
    TabStrip,
    RouterLink,
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  readonly authFacade = inject(AuthFacade);
  private readonly utils = inject(Utils);

  /** Country/profession-scoped routes for the consent policy links. */
  readonly legalLinks = computed(() => {
    const { country, profession } = this.utils.getRouteParams();
    const base = `/${country?.toLowerCase()}/${profession}`;
    return {
      terms: `${base}/terms-of-service`,
      privacy: `${base}/privacy-policy`,
    };
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.authFacade.clear());
  }

  onSubmit(): void {
    if (this.authFacade.isLoading()) return;
    if (this.authFacade.loginStep() === 'OTP') {
      if (this.authFacade.otpForm().invalid()) return;
      this.authFacade.verifyOtp();
    } else {
      if (this.authFacade.loginForm().invalid()) return;
      this.authFacade.submitLogin();
    }
  }
}
