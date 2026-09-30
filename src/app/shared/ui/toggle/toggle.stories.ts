import { JsonPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import type { Meta, StoryObj } from '@storybook/angular';
import { NgpLabel } from 'ng-primitives/form-field';
import { Field } from '../field/field';
import { Toggle } from './toggle';

@Component({
  selector: 'app-toggle-demo',
  imports: [Field, Toggle, FormField, NgpLabel, JsonPipe],
  template: `
    <div class="flex w-80 flex-col gap-4">
      <app-field>
        <span ngpLabel>Show completed courses</span>
        <button app-toggle type="button" class="self-start" [formField]="f.showCompleted">
          Completed
        </button>
      </app-field>
      <button app-toggle type="button" class="self-start" [checked]="true" [disabled]="true">
        Pressed and disabled
      </button>
      <p class="text-xs text-muted-foreground">Model: {{ model() | json }}</p>
    </div>
  `,
})
class ToggleDemo {
  readonly model = signal({ showCompleted: false });
  readonly f = form(this.model);
}

const meta: Meta<ToggleDemo> = {
  title: 'UI/Toggle',
  component: ToggleDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<ToggleDemo>;

export const SignalForm: Story = {};
