import { JsonPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import type { Meta, StoryObj } from '@storybook/angular';
import { NgpDescription, NgpLabel } from 'ng-primitives/form-field';
import { Field } from '../field/field';
import { Switch } from './switch';

@Component({
  selector: 'app-switch-demo',
  imports: [Field, Switch, FormField, NgpLabel, NgpDescription, JsonPipe],
  template: `
    <div class="flex w-80 flex-col gap-4">
      <app-field class="flex-row items-center justify-between gap-3">
        <div class="flex flex-col">
          <span ngpLabel>Email updates</span>
          <p ngpDescription>Course reminders and new releases.</p>
        </div>
        <app-switch [formField]="f.updates" />
      </app-field>
      <app-field class="flex-row items-center justify-between gap-3">
        <span ngpLabel>Locked</span>
        <app-switch [checked]="true" [disabled]="true" />
      </app-field>
      <p class="text-xs text-muted-foreground">Model: {{ model() | json }}</p>
    </div>
  `,
})
class SwitchDemo {
  readonly model = signal({ updates: false });
  readonly f = form(this.model);
}

const meta: Meta<SwitchDemo> = {
  title: 'UI/Switch',
  component: SwitchDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<SwitchDemo>;

export const SignalForm: Story = {};
