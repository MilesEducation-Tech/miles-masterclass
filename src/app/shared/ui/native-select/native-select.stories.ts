import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';
import { NativeSelect } from './native-select';

type NativeSelectArgs = NativeSelect & { disabled: boolean };

const meta: Meta<NativeSelectArgs> = {
  title: 'UI/NativeSelect',
  component: NativeSelect,
  tags: ['autodocs'],
  argTypes: { disabled: { control: 'boolean' } },
  args: { disabled: false },
  render: (args) => ({
    props: args,
    template: `
      <div class="w-72">
        <select app-select aria-label="Country" ${argsToTemplate(args)}>
          <option value="">Choose…</option>
          <option value="us">United States</option>
          <option value="in">India</option>
          <option value="ae">United Arab Emirates</option>
        </select>
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<NativeSelectArgs>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true } };
