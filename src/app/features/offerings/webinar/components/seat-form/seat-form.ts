import { Component, computed, inject, input, signal } from '@angular/core';
import {
  FormField as AngularFormField,
  form,
  minLength,
  required,
  validate,
} from '@angular/forms/signals';
import { NgpLabel } from 'ng-primitives/form-field';
import { Button } from '@shared/ui/button/button';
import { Field } from '@shared/ui/field/field';
import { Input } from '@shared/ui/input/input';
import { InputOtp } from '@shared/ui/input-otp/input-otp';
import { Spinner } from '@shared/ui/spinner/spinner';
import {
  GuestRegistration,
  toOtpContact,
} from '@features/offerings/webinar/services/guest-registration';

interface IdentifyModel {
  identifier: string;
}

interface OtpModel {
  otp: string;
}

/**
 * The "Secure Your Seat" card in the guest hero — v3's inline registration
 * form, on this platform's contract: one identifier, one code, one seat.
 *
 * Reads and drives `GuestRegistration` directly rather than taking a dozen
 * inputs and outputs: the two are one feature, the service is route-scoped,
 * and every surface that renders this form wants the same flow.
 */
@Component({
  selector: 'app-seat-form',
  imports: [AngularFormField, Button, Field, Input, InputOtp, NgpLabel, Spinner],
  templateUrl: './seat-form.html',
})
export class SeatForm {
  readonly webinarId = input.required<string>();

  protected readonly flow = inject(GuestRegistration);

  private readonly identifyModel = signal<IdentifyModel>({ identifier: '' });
  private readonly otpModel = signal<OtpModel>({ otp: '' });

  protected readonly identifyForm = form<IdentifyModel>(this.identifyModel, (schema) => {
    required(schema.identifier, { message: 'Enter your email or phone number' });
    validate(schema.identifier, ({ value }) => {
      if (!value().trim()) return null;
      // The same parse the send uses, so the two cannot disagree.
      if (toOtpContact(value())) return null;
      return { kind: 'pattern', message: 'Enter a valid email or phone with country code' };
    });
  });

  protected readonly otpForm = form<OtpModel>(this.otpModel, (schema) => {
    required(schema.otp, { message: 'Enter the code' });
    minLength(schema.otp, this.flow.otpLength, { message: 'Enter the full code' });
  });

  protected readonly isOtpStep = computed(() => this.flow.step() === 'otp');

  protected readonly submitDisabled = computed(
    () =>
      this.flow.isLoading() ||
      (this.isOtpStep() ? this.otpForm().invalid() : this.identifyForm().invalid()),
  );

  protected onSubmit(): void {
    if (this.submitDisabled()) return;
    if (this.isOtpStep()) {
      void this.flow.verifyAndRegister(this.webinarId(), this.otpModel().otp);
    } else {
      void this.flow.sendCode(this.identifyModel().identifier);
    }
  }

  protected onEdit(): void {
    this.otpForm().reset();
    this.otpModel.set({ otp: '' });
    this.flow.edit();
  }
}
