import { JsonPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import type { Meta, StoryObj } from '@storybook/angular';
import { NgpLabel } from 'ng-primitives/form-field';
import { Field } from '../field/field';
import { Search } from './search';

@Component({
  selector: 'app-search-demo',
  imports: [Field, Search, FormField, NgpLabel, JsonPipe],
  template: `
    <div class="flex w-80 flex-col gap-4">
      <app-field>
        <span ngpLabel>Find a course</span>
        <app-search placeholder="Search courses" [formField]="f.query" />
      </app-field>
      <p class="text-xs text-muted-foreground">Model: {{ model() | json }}</p>
    </div>
  `,
})
class SearchDemo {
  readonly model = signal({ query: '' });
  readonly f = form(this.model);
}

const meta: Meta<SearchDemo> = {
  title: 'UI/Search',
  component: SearchDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<SearchDemo>;

export const SignalForm: Story = {};
