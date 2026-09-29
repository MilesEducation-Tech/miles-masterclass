import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';
import { Meter } from './meter';

const meta: Meta<Meter> = {
  title: 'UI/Meter',
  component: Meter,
  tags: ['autodocs'],
  argTypes: { value: { control: { type: 'range', min: 0, max: 100 } }, label: { control: 'text' } },
  args: { value: 64, label: 'Compliance period' },
  render: (args) => ({
    props: args,
    template: `<div class="w-80"><app-meter ${argsToTemplate(args)} /></div>`,
  }),
};

export default meta;
type Story = StoryObj<Meter>;

export const Default: Story = {};
