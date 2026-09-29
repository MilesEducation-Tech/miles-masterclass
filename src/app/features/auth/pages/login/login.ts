import { Component, DestroyRef, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '@shared/ui/button/button';

import { AuthFacade } from '../../services/auth-facade';
import { FormField as AngularFormField } from '@angular/forms/signals';

import { Spinner } from '@shared/ui/spinner/spinner';

import { Utils } from '@shared/services/utils';
import { Field } from '@shared/ui/field/field';
import { NgpLabel } from 'ng-primitives/form-field';
import { Input } from '@shared/ui/input/input';
import { Checkbox } from '@shared/ui/checkbox/checkbox';
import { Combobox } from '@shared/ui/combobox/combobox';
import { Tabs } from '@shared/ui/tabs/tabs';
import { Tab } from '@shared/ui/tabs/tab';
import { InputOtp } from '@shared/ui/input-otp/input-otp';

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
  ],
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
