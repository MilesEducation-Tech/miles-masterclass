import { DatePipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { form, FormField, maxDate, required } from '@angular/forms/signals';
import type { Meta, StoryObj } from '@storybook/angular';
import { NgpError, NgpLabel } from 'ng-primitives/form-field';
import { Field } from '../field/field';
import { DatePicker } from './date-picker';

@Component({
  selector: 'app-date-picker-demo',
  imports: [Field, DatePicker, FormField, NgpLabel, NgpError, DatePipe],
  template: `
    <div class="flex flex-col gap-4">
      <app-field>
        <span ngpLabel>Exam date</span>
        <app-date-picker [formField]="f.when" />
        <p ngpError ngpErrorValidator="required">Pick a date.</p>
        <p ngpError ngpErrorValidator="maxDate">No later than today.</p>
      </app-field>
      <p class="text-xs text-muted-foreground">Model: {{ model().when | date: 'mediumDate' }}</p>
    </div>
  `,
})
class DatePickerDemo {
  readonly model = signal<{ when: Date | null }>({ when: null });
  readonly f = form(this.model, (s) => {
    required(s.when);
    maxDate(s.when, new Date());
  });
}

const meta: Meta<DatePickerDemo> = {
  title: 'UI/DatePicker',
  component: DatePickerDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<DatePickerDemo>;

/** Arrow keys move between days; the `maxDate` rule also becomes the calendar's `max`. */
export const SignalForm: Story = {};
