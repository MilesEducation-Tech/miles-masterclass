import type { Meta, StoryObj } from '@storybook/angular';
import { Forms } from './forms';

const meta: Meta<Forms> = {
  title: 'UI/Forms',
  component: Forms,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 400px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
  argTypes: {
    type: {
      control: 'select',
      options: ['signal', 'model', 'reactive'],
      description: 'Form submission strategy type',
    },
  },
};

export default meta;
type Story = StoryObj<Forms>;

export const SignalForm: Story = {
  args: {
    type: 'signal',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 400px;">
        <app-forms type="signal">
          <div class="flex flex-col gap-4 p-4 border border-border rounded-md">
            <p class="text-sm text-muted-foreground">Signal form wrapper — content projected inside</p>
            <input type="text" placeholder="Example input" class="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground" />
            <button type="submit" class="bg-primary text-accent-foreground px-4 py-2 rounded-md text-sm">Submit</button>
          </div>
        </app-forms>
      </div>
    `,
  }),
};

export const ModelForm: Story = {
  args: {
    type: 'model',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 400px;">
        <app-forms type="model">
          <div class="flex flex-col gap-4 p-4 border border-border rounded-md">
            <p class="text-sm text-muted-foreground">Model-driven form wrapper</p>
            <input type="email" placeholder="Email" class="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground" />
            <button type="submit" class="bg-primary text-accent-foreground px-4 py-2 rounded-md text-sm">Submit</button>
          </div>
        </app-forms>
      </div>
    `,
  }),
};
