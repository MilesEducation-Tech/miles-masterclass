import { JsonPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import type { Meta, StoryObj } from '@storybook/angular';
import { NgpError, NgpLabel } from 'ng-primitives/form-field';
import { Field } from '../field/field';
import { InputOtp } from './input-otp';

@Component({
  selector: 'app-input-otp-demo',
  imports: [Field, InputOtp, FormField, NgpLabel, NgpError, JsonPipe],
  template: `
    <div class="flex flex-col gap-4">
      <app-field>
        <span ngpLabel>Enter the 6-digit code</span>
        <app-input-otp [formField]="f.code" (complete)="completed.set(completed() + 1)" />
        <p ngpError ngpErrorValidator="required">Please enter the code.</p>
      </app-field>
      <p class="text-xs text-muted-foreground">
        Model: {{ model() | json }} · completed {{ completed() }} time(s)
      </p>
    </div>
  `,
})
class InputOtpDemo {
  readonly completed = signal(0);
  readonly model = signal({ code: '' });
  readonly f = form(this.model, (s) => {
    required(s.code);
  });
}

const meta: Meta<InputOtpDemo> = {
  title: 'UI/InputOtp',
  component: InputOtpDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<InputOtpDemo>;

export const SignalForm: Story = {};
