import { JsonPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import type { Meta, StoryObj } from '@storybook/angular';
import { NgpError, NgpLabel } from 'ng-primitives/form-field';
import { Field } from '../field/field';
import { RadioGroup } from './radio-group';
import { RadioItem } from './radio-item';

@Component({
  selector: 'app-radio-group-demo',
  imports: [Field, RadioGroup, RadioItem, FormField, NgpLabel, NgpError, JsonPipe],
  template: `
    <div class="flex w-80 flex-col gap-4">
      <app-field>
        <span ngpLabel>Billing cycle</span>
        <app-radio-group [formField]="f.plan" [orientation]="orientation()">
          <app-radio-item value="monthly">Monthly</app-radio-item>
          <app-radio-item value="yearly">Yearly, two months free</app-radio-item>
          <app-radio-item value="firm" [disabled]="true">Firm sponsored</app-radio-item>
        </app-radio-group>
        <p ngpError ngpErrorValidator="required">Choose a billing cycle.</p>
      </app-field>
      <p class="text-xs text-muted-foreground">Model: {{ model() | json }}</p>
    </div>
  `,
})
class RadioGroupDemo {
  readonly orientation = signal<'vertical' | 'horizontal'>('vertical');
  readonly model = signal<{ plan: string | null }>({ plan: null });
  readonly f = form(this.model, (s) => {
    required(s.plan);
  });
}

const meta: Meta<RadioGroupDemo> = {
  title: 'UI/RadioGroup',
  component: RadioGroupDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<RadioGroupDemo>;

/** Arrow keys move between items; Tab leaves the group and shows the required error. */
export const SignalForm: Story = {};
