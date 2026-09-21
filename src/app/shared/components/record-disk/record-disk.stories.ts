import type { Meta, StoryObj } from '@storybook/angular';
import { RecordDisk } from './record-disk';

const meta: Meta<RecordDisk> = {
  title: 'Components/RecordDisk',
  component: RecordDisk,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 250px; height: 250px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
  argTypes: {
    coverImage: { control: 'text', description: 'Album cover image URL' },
    diskImage: { control: 'text', description: 'Center label image on the disk' },
    config: { control: 'object', description: 'Disk configuration options' },
  },
};

export default meta;
type Story = StoryObj<RecordDisk>;

export const Default: Story = {
  args: {
    coverImage: 'https://placehold.co/400x400/1a1a2e/ffffff?text=Album',
  },
};

export const WithDiskImage: Story = {
  args: {
    coverImage: 'https://placehold.co/400x400/2d1b69/ffffff?text=Cover',
    diskImage: 'https://placehold.co/200x200/0448AA/ffffff?text=Disk',
  },
};

export const Animating: Story = {
  args: {
    coverImage: 'https://placehold.co/400x400/1a1a2e/ffffff?text=Playing',
    config: { animate: true, slideOut: true },
  },
};

export const DiskOnly: Story = {
  args: {
    coverImage: 'https://placehold.co/400x400/0d3b66/ffffff?text=Disk',
    config: { diskOnly: true, animate: true },
  },
};

export const SlideLeft: Story = {
  args: {
    coverImage: 'https://placehold.co/400x400/4a1942/ffffff?text=Left',
    config: { animate: true, slideOut: true, direction: 'left' },
  },
};

export const SlowSpin: Story = {
  args: {
    coverImage: 'https://placehold.co/400x400/1b4332/ffffff?text=Slow',
    config: { animate: true, slideOut: true, spinDuration: '8s' },
  },
};
