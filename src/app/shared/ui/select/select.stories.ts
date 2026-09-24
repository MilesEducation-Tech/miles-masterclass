import { Component, signal } from '@angular/core';
import { FormField, form, required, validate } from '@angular/forms/signals';
import type { Meta, StoryObj } from '@storybook/angular';

import { Select, SelectOption } from './select';

const OPTIONS: SelectOption[] = [
  { value: 'licensed_accountant', label: "I'm a licensed accountant, I need CPE/CPD credits" },
  { value: 'working_professional', label: "I'm a working professional, building AI skills" },
  { value: 'student', label: "I'm a student, building my accounting career" },
  { value: 'other', label: 'Something else', disabled: true },
];

const meta: Meta<Select> = {
  title: 'UI/Select',
  component: Select,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 420px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
};

export default meta;
type Story = StoryObj<Select>;

export const Single: Story = {
  args: { id: 'intent', options: OPTIONS, placeholder: 'What brings you here?' },
};

export const Multiple: Story = {
  args: { id: 'topics', options: OPTIONS, multiple: true, placeholder: 'Pick any that apply' },
};

export const Preselected: Story = {
  args: { id: 'preselected', options: OPTIONS, value: ['working_professional'] },
};

export const Disabled: Story = {
  args: { id: 'disabled', options: OPTIONS, disabled: true },
};

export const Empty: Story = {
  args: { id: 'empty', options: [] },
};

/**
 * The reason this component exists: `[formField]` binds it with no adapter.
 *
 * The demo is a real component because `form()` must run in an injection
 * context — a Storybook `render` function is not one, and calling it there
 * throws at runtime rather than at build time.
 */
@Component({
  selector: 'app-select-form-demo',
  imports: [Select, FormField],
  template: `
    <div class="flex w-105 flex-col gap-2">
      <app-select
        id="intent-form"
        [options]="options"
        placeholder="What brings you here?"
        [formField]="form.intent"
      />
      <p class="text-xs opacity-70">value: {{ model().intent.join(', ') || '(none)' }}</p>
      @if (form.intent().touched() && form.intent().errors().length) {
        <p class="text-xs text-red-400">{{ form.intent().errors()[0].message }}</p>
      }
    </div>
  `,
})
class SelectFormDemo {
  readonly options = OPTIONS;
  readonly model = signal({ intent: [] as string[] });
  readonly form = form(this.model, (path) => {
    // An empty ARRAY is not "empty" to the forms package, so the rule that
    // fires is an explicit one — see `profile.ts` for the same pair.
    required(path.intent);
    validate(path.intent, ({ value }) =>
      value().length === 0 ? { kind: 'required', message: 'Pick one to continue.' } : null,
    );
  });
}

export const WithSignalForm: Story = {
  render: () => ({
    template: '<app-select-form-demo />',
    moduleMetadata: { imports: [SelectFormDemo] },
  }),
};
