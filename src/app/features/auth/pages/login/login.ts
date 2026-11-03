import { Component, DestroyRef, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormField as AngularFormField } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowLeft, heroDevicePhoneMobile, heroEnvelope } from '@ng-icons/heroicons/outline';
import { NgpLabel } from 'ng-primitives/form-field';

import { PasswordInput } from '@features/auth/components/password-input/password-input';
import { AuthFacade } from '@features/auth/services/auth-facade';
import { Utils } from '@shared/services/utils';
import { Button } from '@shared/ui/button/button';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { Combobox } from '@shared/ui/combobox/combobox';
import { Field } from '@shared/ui/field/field';
import { Input } from '@shared/ui/input/input';
import { InputOtp } from '@shared/ui/input-otp/input-otp';
import { Separator } from '@shared/ui/separator/separator';
import { Spinner } from '@shared/ui/spinner/spinner';
import { Tab } from '@shared/ui/tabs/tab';
import { Tabs } from '@shared/ui/tabs/tabs';

/**
 * `/auth/login`, and `/auth/signup` (`data: { signup: true }`): email and password, or the code flow
 * (`?method=phone|email`). Sign-up is the code flow with its own copy — the API creates an account
 * when a code is verified.
 */
@Component({
  selector: 'app-login',
  imports: [
    Button,
    AngularFormField,
    Spinner,
    RouterLink,
    Field,
    NgpLabel,
    Input,
    Checkbox,
    Combobox,
    Tabs,
    Tab,
    InputOtp,
    Separator,
    PasswordInput,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [provideIcons({ heroArrowLeft, heroDevicePhoneMobile, heroEnvelope })],
  templateUrl: './login.html',
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
    // The facade can't see this route's `data` (see `AuthFacade.start`), so the page hands it over.
    this.authFacade.start(inject(ActivatedRoute).snapshot.data['signup'] === true);
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
