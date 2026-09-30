import type { Meta, StoryObj } from '@storybook/angular';
import { Avatar } from './avatar';

const meta: Meta<Avatar> = {
  title: 'UI/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  render: () => ({
    moduleMetadata: { imports: [Avatar] },
    template: `
      <div class="flex items-center gap-4">
        <app-avatar image="https://i.pravatar.cc/80?img=12" fallback="AS" alt="Anita Shah" />
        <app-avatar fallback="RK" alt="Ravi Kumar" />
        <app-avatar image="https://example.invalid/missing.png" fallback="MM" alt="Broken image" />
        <app-avatar class="size-14 text-base" fallback="XL" alt="Larger" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<Avatar>;

/** Initials stay until the image loads, and remain when it fails. */
export const Default: Story = {};
