import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { AriaMenu } from './aria-menu';
import { AriaMenuTrigger } from './aria-menu-trigger';
import { AriaMenuItem } from './aria-menu-item';

const meta: Meta<AriaMenu> = {
  title: 'UI/Aria/Menu',
  component: AriaMenu,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [AriaMenu, AriaMenuTrigger, AriaMenuItem],
    }),
  ],
};

export default meta;
type Story = StoryObj<AriaMenu>;

export const Basic: Story = {
  render: () => ({
    template: `
      <div class="relative inline-block">
        <button
          appAriaMenuTrigger
          [menu]="m.menu"
          type="button"
          class="bg-primary text-accent-foreground px-4 py-2 text-sm"
        >
          Options
        </button>
        <app-aria-menu #m="appAriaMenu" class="absolute top-[calc(100%+8px)] left-0 mt-2 z-50">
          <button appAriaMenuItem value="star" type="button">Star</button>
          <button appAriaMenuItem value="edit" type="button">Edit</button>
          <button appAriaMenuItem value="delete" type="button">Delete</button>
        </app-aria-menu>
      </div>
    `,
  }),
};

export const WithSubmenu: Story = {
  render: () => ({
    template: `
      <div class="relative inline-block">
        <button
          appAriaMenuTrigger
          [menu]="root.menu"
          type="button"
          class="bg-primary text-accent-foreground px-4 py-2 text-sm rounded-md"
        >
          File
        </button>
        <app-aria-menu #root="appAriaMenu" class="absolute top-[calc(100%+8px)] left-0 mt-2 z-50">
          <button appAriaMenuItem value="new" type="button">New</button>
          <button appAriaMenuItem value="open" type="button">Open…</button>
          <button appAriaMenuItem value="more" [submenu]="sub.menu" type="button">More…</button>
        </app-aria-menu>

        <app-aria-menu #sub="appAriaMenu" class="absolute z-50">
          <button appAriaMenuItem value="export" type="button">Export</button>
          <button appAriaMenuItem value="archive" type="button">Archive</button>
        </app-aria-menu>
      </div>
    `,
  }),
};
