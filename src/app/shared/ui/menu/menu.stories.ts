import type { Meta, StoryObj } from '@storybook/angular';
import { NgpMenuTrigger } from 'ng-primitives/menu';
import { Button } from '../button/button';
import { Menu } from './menu';
import { MenuItem } from './menu-item';

const meta: Meta<Menu> = {
  title: 'UI/Menu',
  component: Menu,
  tags: ['autodocs'],
  render: () => ({
    moduleMetadata: { imports: [Button, Menu, MenuItem, NgpMenuTrigger] },
    template: `
      <button app-button type="button" variant="outline" [ngpMenuTrigger]="menu">Account</button>

      <ng-template #menu>
        <app-menu>
          <button app-menu-item>Profile</button>
          <button app-menu-item>Orders</button>
          <button app-menu-item>CPE tracker</button>
          <button app-menu-item class="text-destructive">Sign out</button>
        </app-menu>
      </ng-template>
    `,
  }),
};

export default meta;
type Story = StoryObj<Menu>;

/** Click or press Enter on the trigger; arrow keys move between items, Escape closes. */
export const Default: Story = {};
