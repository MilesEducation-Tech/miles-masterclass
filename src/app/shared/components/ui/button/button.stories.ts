import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';
import { Button } from './button';

const meta: Meta<Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link', 'close'],
      description: 'Visual style variant of the button',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: 'Size of the button',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
    },
    type: {
      control: 'select',
      options: ['button', 'submit', 'reset'],
      description: 'HTML button type attribute',
    },
  },
  render: (args) => ({
    props: args,
    template: `<div style="min-width: 200px; display: flex; justify-content: center;"><app-button ${argsToTemplate(args)}>Button Label</app-button></div>`,
  }),
};

export default meta;
type Story = StoryObj<Button>;

export const Default: Story = {
  args: {
    variant: 'default',
    size: 'default',
    disabled: false,
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    size: 'default',
  },
  render: (args) => ({
    props: args,
    template: `<div style="min-width: 200px; display: flex; justify-content: center;"><app-button ${argsToTemplate(args)}>Delete Item</app-button></div>`,
  }),
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    size: 'default',
  },
  render: (args) => ({
    props: args,
    template: `<div style="min-width: 200px; display: flex; justify-content: center;"><app-button ${argsToTemplate(args)}>Outline</app-button></div>`,
  }),
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    size: 'default',
  },
  render: (args) => ({
    props: args,
    template: `<div style="min-width: 200px; display: flex; justify-content: center;"><app-button ${argsToTemplate(args)}>Secondary</app-button></div>`,
  }),
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    size: 'default',
  },
  render: (args) => ({
    props: args,
    template: `<div style="min-width: 200px; display: flex; justify-content: center;"><app-button ${argsToTemplate(args)}>Ghost</app-button></div>`,
  }),
};

export const Link: Story = {
  args: {
    variant: 'link',
    size: 'default',
  },
  render: (args) => ({
    props: args,
    template: `<div style="min-width: 200px; display: flex; justify-content: center;"><app-button ${argsToTemplate(args)}>Link Style</app-button></div>`,
  }),
};

export const Close: Story = {
  args: {
    variant: 'close',
  },
};

export const Small: Story = {
  args: {
    variant: 'default',
    size: 'sm',
  },
  render: (args) => ({
    props: args,
    template: `<div style="min-width: 200px; display: flex; justify-content: center;"><app-button ${argsToTemplate(args)}>Small</app-button></div>`,
  }),
};

export const Large: Story = {
  args: {
    variant: 'default',
    size: 'lg',
  },
  render: (args) => ({
    props: args,
    template: `<div style="min-width: 200px; display: flex; justify-content: center;"><app-button ${argsToTemplate(args)}>Large Button</app-button></div>`,
  }),
};

export const Disabled: Story = {
  args: {
    variant: 'default',
    size: 'default',
    disabled: true,
  },
  render: (args) => ({
    props: args,
    template: `<div style="min-width: 200px; display: flex; justify-content: center;"><app-button ${argsToTemplate(args)}>Disabled</app-button></div>`,
  }),
};

export const AllVariants: Story = {
  render: () => ({
    template: `
      <div style="min-width: 600px;" class="flex flex-wrap gap-4 items-center">
        <app-button variant="default">Default</app-button>
        <app-button variant="destructive">Destructive</app-button>
        <app-button variant="outline">Outline</app-button>
        <app-button variant="secondary">Secondary</app-button>
        <app-button variant="ghost">Ghost</app-button>
        <app-button variant="link">Link</app-button>
        <app-button variant="close"></app-button>
      </div>
    `,
  }),
};

export const AllSizes: Story = {
  render: () => ({
    template: `
      <div style="min-width: 500px;" class="flex flex-wrap gap-4 items-center">
        <app-button size="sm">Small</app-button>
        <app-button size="default">Default</app-button>
        <app-button size="lg">Large</app-button>
        <app-button size="icon">+</app-button>
      </div>
    `,
  }),
};
