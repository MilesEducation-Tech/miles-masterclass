import type { Meta, StoryObj } from '@storybook/angular';
import { Toolbar } from './toolbar';
import { ToolbarButton } from './toolbar-button';

const meta: Meta<Toolbar> = {
  title: 'UI/Toolbar',
  component: Toolbar,
  tags: ['autodocs'],
  render: (args) => ({
    props: args,
    moduleMetadata: { imports: [Toolbar, ToolbarButton] },
    template: `
      <app-toolbar aria-label="Text formatting" [orientation]="orientation">
        <button app-toolbar-button>Bold</button>
        <button app-toolbar-button>Italic</button>
        <button app-toolbar-button>Underline</button>
        <button app-toolbar-button [disabled]="true">Strike</button>
      </app-toolbar>
    `,
  }),
  argTypes: { orientation: { control: 'select', options: ['horizontal', 'vertical'] } },
  args: { orientation: 'horizontal' },
};

export default meta;
type Story = StoryObj<Toolbar>;

/** One tab stop; arrow keys move between the buttons. */
export const Default: Story = {};
