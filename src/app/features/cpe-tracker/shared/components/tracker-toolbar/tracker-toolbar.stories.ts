import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';
import { TrackerToolbar } from './tracker-toolbar';

const meta: Meta<TrackerToolbar> = {
  title: 'CPE Tracker/Toolbar',
  component: TrackerToolbar,
  tags: ['autodocs'],
  render: (args) => ({
    props: args,
    template: `<div style="background: #000; padding: 24px; max-width: 1100px;"><app-tracker-toolbar ${argsToTemplate(args)}></app-tracker-toolbar></div>`,
  }),
};

export default meta;
type Story = StoryObj<TrackerToolbar>;

export const Default: Story = {
  args: {
    category: 'CAIRA',
    level: 'L1',
    contentType: 'Masterclass',
    contentTypeOptions: ['Masterclass', 'Webinar', 'Podcast'],
    credits: { earned: 95 },
  },
};

/** NON-CAIRA hides the level selector — those badges carry no level. */
export const NonCaira: Story = {
  args: {
    category: 'NON-CAIRA',
    level: 'L1',
    contentType: 'Webinar',
    contentTypeOptions: ['Webinar', 'Podcast'],
    credits: { earned: 12 },
  },
};

/** No badges under the current filter — the content-type select is disabled. */
export const NoCredits: Story = {
  args: {
    category: 'CAIRA',
    level: 'L3',
    contentType: 'Masterclass',
    contentTypeOptions: [],
    credits: null,
  },
};
