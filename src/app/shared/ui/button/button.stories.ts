import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';
import { Button } from './button';

/** `disabled` is the ngpButton input the component exposes, not a class member. */
type ButtonArgs = Button & { disabled: boolean };

const meta: Meta<ButtonArgs> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'primary', 'secondary', 'destructive', 'outline', 'ghost', 'link'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'xl'] },
    disabled: { control: 'boolean' },
  },
  args: { variant: 'default', size: 'md', disabled: false },
  render: (args) => ({
    props: args,
    template: `<button app-button type="button" ${argsToTemplate(args)}>Button label</button>`,
  }),
};

export default meta;
type Story = StoryObj<ButtonArgs>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => ({
    template: `
      <div class="flex flex-wrap items-center gap-3">
        <button app-button type="button" variant="default">Default</button>
        <button app-button type="button" variant="primary">Primary</button>
        <button app-button type="button" variant="secondary">Secondary</button>
        <button app-button type="button" variant="destructive">Destructive</button>
        <button app-button type="button" variant="outline">Outline</button>
        <button app-button type="button" variant="ghost">Ghost</button>
        <button app-button type="button" variant="link">Link</button>
      </div>
    `,
  }),
};

export const Sizes: Story = {
  render: () => ({
    template: `
      <div class="flex flex-wrap items-center gap-3">
        <button app-button type="button" size="sm">Small</button>
        <button app-button type="button" size="md">Medium</button>
        <button app-button type="button" size="lg">Large</button>
        <button app-button type="button" size="xl">Extra large</button>
      </div>
    `,
  }),
};

export const Disabled: Story = {
  args: { disabled: true },
};
