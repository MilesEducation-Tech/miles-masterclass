import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { AriaMenubar } from './aria-menubar';
import { AriaMenu } from '../aria-menu/aria-menu';
import { AriaMenuTrigger } from '../aria-menu/aria-menu-trigger';
import { AriaMenuItem } from '../aria-menu/aria-menu-item';

const meta: Meta<AriaMenubar> = {
  title: 'UI/Aria/Menubar',
  component: AriaMenubar,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [AriaMenubar, AriaMenu, AriaMenuTrigger, AriaMenuItem],
    }),
  ],
};

export default meta;
type Story = StoryObj<AriaMenubar>;

export const Basic: Story = {
  render: () => ({
    template: `
      <div class="relative inline-flex flex-col">
        <app-aria-menubar>
          <button
            appAriaMenuTrigger
            [menu]="fileMenu.menu"
            type="button"
            class="px-3 py-1 text-sm rounded-md hover:bg-secondary"
          >
            File
          </button>
          <button
            appAriaMenuTrigger
            [menu]="editMenu.menu"
            type="button"
            class="px-3 py-1 text-sm rounded-md hover:bg-secondary"
          >
            Edit
          </button>
          <button
            appAriaMenuTrigger
            [menu]="viewMenu.menu"
            type="button"
            class="px-3 py-1 text-sm rounded-md hover:bg-secondary"
          >
            View
          </button>
        </app-aria-menubar>

        <app-aria-menu #fileMenu="appAriaMenu" class="absolute top-12 left-0 z-50">
          <button appAriaMenuItem value="new" type="button">New</button>
          <button appAriaMenuItem value="open" type="button">Open…</button>
          <button appAriaMenuItem value="save" type="button">Save</button>
        </app-aria-menu>
        <app-aria-menu #editMenu="appAriaMenu" class="absolute top-12 left-16 z-50">
          <button appAriaMenuItem value="cut" type="button">Cut</button>
          <button appAriaMenuItem value="copy" type="button">Copy</button>
          <button appAriaMenuItem value="paste" type="button">Paste</button>
        </app-aria-menu>
        <app-aria-menu #viewMenu="appAriaMenu" class="absolute top-12 left-32 z-50">
          <button appAriaMenuItem value="zoom-in" type="button">Zoom in</button>
          <button appAriaMenuItem value="zoom-out" type="button">Zoom out</button>
          <button appAriaMenuItem value="reset" type="button">Reset zoom</button>
        </app-aria-menu>
      </div>
    `,
  }),
};
