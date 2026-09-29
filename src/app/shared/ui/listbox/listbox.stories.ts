import { JsonPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import type { Meta, StoryObj } from '@storybook/angular';
import { NgpLabel } from 'ng-primitives/form-field';
import { Field } from '../field/field';
import { Listbox } from './listbox';
import { ListboxOption } from './listbox-option';

@Component({
  selector: 'app-listbox-demo',
  imports: [Field, Listbox, ListboxOption, FormField, NgpLabel, JsonPipe],
  template: `
    <div class="flex w-80 flex-col gap-4">
      <app-field>
        <span ngpLabel>Topics</span>
        <app-listbox mode="multiple" [formField]="f.topics">
          <app-listbox-option value="tax">Tax</app-listbox-option>
          <app-listbox-option value="audit">Audit</app-listbox-option>
          <app-listbox-option value="ethics">Ethics</app-listbox-option>
          <app-listbox-option value="tech" [disabled]="true">Technology (soon)</app-listbox-option>
        </app-listbox>
      </app-field>
      <p class="text-xs text-muted-foreground">Model: {{ model() | json }}</p>
    </div>
  `,
})
class ListboxDemo {
  readonly model = signal<{ topics: string[] }>({ topics: ['audit'] });
  readonly f = form(this.model);
}

const meta: Meta<ListboxDemo> = {
  title: 'UI/Listbox',
  component: ListboxDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<ListboxDemo>;

export const SignalForm: Story = {};
