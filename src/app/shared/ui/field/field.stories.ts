import { JsonPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import type { Meta, StoryObj } from '@storybook/angular';
import { NgpDescription, NgpError, NgpLabel } from 'ng-primitives/form-field';
import { Button } from '../button/button';
import { Input } from '../input/input';
import { NativeSelect } from '../native-select/native-select';
import { Textarea } from '../textarea/textarea';
import { Field } from './field';

/** A signal form the way the app writes one: `form()` + schema, `[formField]` on each control. */
@Component({
  selector: 'app-field-demo',
  imports: [
    Field,
    Input,
    Textarea,
    NativeSelect,
    Button,
    FormField,
    NgpLabel,
    NgpDescription,
    NgpError,
    JsonPipe,
  ],
  template: `
    <form class="flex w-80 flex-col gap-5" (submit)="$event.preventDefault()">
      <app-field>
        <label ngpLabel for="demo-email">Email</label>
        <p ngpDescription>We never share it.</p>
        <input
          app-input
          id="demo-email"
          type="email"
          placeholder="you@firm.com"
          [formField]="f.email"
        />
        <p ngpError ngpErrorValidator="required">Email is required.</p>
      </app-field>

      <app-field>
        <label ngpLabel for="demo-country">Country</label>
        <select app-select id="demo-country" [formField]="f.country">
          <option value="">Choose…</option>
          <option value="us">United States</option>
          <option value="in">India</option>
        </select>
        <p ngpError ngpErrorValidator="required">Pick a country.</p>
      </app-field>

      <app-field>
        <label ngpLabel for="demo-notes">Notes</label>
        <textarea
          app-textarea
          id="demo-notes"
          placeholder="Anything else?"
          [formField]="f.notes"
        ></textarea>
      </app-field>

      <button app-button type="submit">Submit</button>
      <p class="text-xs text-muted-foreground">Model: {{ model() | json }}</p>
    </form>
  `,
})
class FieldDemo {
  readonly model = signal({ email: '', country: '', notes: '' });
  readonly f = form(this.model, (s) => {
    required(s.email);
    required(s.country);
    disabled(s.notes, ({ valueOf }) => valueOf(s.country) === '');
  });
}

const meta: Meta<FieldDemo> = {
  title: 'UI/Field',
  component: FieldDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<FieldDemo>;

/** Leave a required control empty to see the error appear on blur. Notes unlock once a country is chosen. */
export const SignalForm: Story = {};
