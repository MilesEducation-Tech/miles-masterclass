import { JsonPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import type { Meta, StoryObj } from '@storybook/angular';
import { NgpError, NgpLabel } from 'ng-primitives/form-field';
import { Field } from '../field/field';
import { Combobox } from './combobox';

@Component({
  selector: 'app-combobox-demo',
  imports: [Field, Combobox, FormField, NgpLabel, NgpError, JsonPipe],
  template: `
    <div class="flex w-80 flex-col gap-4">
      <app-field>
        <span ngpLabel>City</span>
        <app-combobox [options]="cities" placeholder="Type to search" [formField]="f.city" />
        <p ngpError ngpErrorValidator="required">Pick a city.</p>
      </app-field>
      <app-field>
        <span ngpLabel>Disabled</span>
        <app-combobox [options]="cities" [value]="'Dubai'" [disabled]="true" />
      </app-field>
      <p class="text-xs text-muted-foreground">Model: {{ model() | json }}</p>
    </div>
  `,
})
class ComboboxDemo {
  readonly cities = ['Mumbai', 'Pune', 'Bengaluru', 'Dubai', 'Abu Dhabi', 'New York'].map((c) => ({
    value: c,
    label: c,
  }));
  readonly model = signal<{ city: string | null }>({ city: null });
  readonly f = form(this.model, (s) => {
    required(s.city);
  });
}

const meta: Meta<ComboboxDemo> = {
  title: 'UI/Combobox',
  component: ComboboxDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<ComboboxDemo>;

export const SignalForm: Story = {};
