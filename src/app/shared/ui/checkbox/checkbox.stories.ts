import { JsonPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import type { Meta, StoryObj } from '@storybook/angular';
import { NgpError, NgpLabel } from 'ng-primitives/form-field';
import { Field } from '../field/field';
import { Checkbox } from './checkbox';

@Component({
  selector: 'app-checkbox-demo',
  imports: [Field, Checkbox, FormField, NgpLabel, NgpError, JsonPipe],
  template: `
    <div class="flex w-80 flex-col gap-4">
      <app-field class="flex-row items-center gap-3">
        <app-checkbox [formField]="f.terms" />
        <span ngpLabel>I accept the terms</span>
        <p ngpError ngpErrorValidator="required" class="basis-full">You must accept the terms.</p>
      </app-field>
      <app-field class="flex-row items-center gap-3">
        <app-checkbox [formField]="f.newsletter" />
        <span ngpLabel>Send me the newsletter</span>
      </app-field>
      <app-field class="flex-row items-center gap-3">
        <app-checkbox [indeterminate]="true" />
        <span ngpLabel>Indeterminate (select-all style)</span>
      </app-field>
      <p class="text-xs text-muted-foreground">Model: {{ model() | json }}</p>
    </div>
  `,
})
class CheckboxDemo {
  readonly model = signal({ terms: false, newsletter: true });
  readonly f = form(this.model, (s) => {
    required(s.terms);
  });
}

const meta: Meta<CheckboxDemo> = {
  title: 'UI/Checkbox',
  component: CheckboxDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<CheckboxDemo>;

/** Tab to the first box and away again to see the required error. */
export const SignalForm: Story = {};
