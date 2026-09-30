import { JsonPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import type { Meta, StoryObj } from '@storybook/angular';
import { NgpError, NgpLabel } from 'ng-primitives/form-field';
import { Field } from '../field/field';
import { Select } from './select';

@Component({
  selector: 'app-select-demo',
  imports: [Field, Select, FormField, NgpLabel, NgpError, JsonPipe],
  template: `
    <div class="flex w-80 flex-col gap-4">
      <app-field>
        <span ngpLabel>Profession</span>
        <app-select [options]="professions" placeholder="Pick one" [formField]="f.profession" />
        <p ngpError ngpErrorValidator="required">Pick a profession.</p>
      </app-field>
      <app-field>
        <span ngpLabel>Interests (multiple)</span>
        <app-select
          [options]="topics"
          [multiple]="true"
          placeholder="Pick a few"
          [formField]="f.topics"
        />
      </app-field>
      <app-field>
        <span ngpLabel>Disabled</span>
        <app-select [options]="professions" [value]="'cpa'" [disabled]="true" />
      </app-field>
      <p class="text-xs text-muted-foreground">Model: {{ model() | json }}</p>
    </div>
  `,
})
class SelectDemo {
  readonly professions = ['CPA', 'CMA', 'EA', 'CIA'].map((p) => ({
    value: p.toLowerCase(),
    label: p,
  }));
  readonly topics = ['Tax', 'Audit', 'Ethics', 'Technology'].map((t) => ({
    value: t.toLowerCase(),
    label: t,
  }));
  readonly model = signal<{ profession: string; topics: string[] }>({ profession: '', topics: [] });
  readonly f = form(this.model, (s) => {
    required(s.profession);
  });
}

const meta: Meta<SelectDemo> = {
  title: 'UI/Select',
  component: SelectDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<SelectDemo>;

/** Space or Enter opens; arrow keys move; Escape closes. Tab away empty to see the error. */
export const SignalForm: Story = {};
