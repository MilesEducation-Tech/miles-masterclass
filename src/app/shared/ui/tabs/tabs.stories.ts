import type { Meta, StoryObj } from '@storybook/angular';
import { Tab } from './tab';
import { Tabs } from './tabs';

const meta: Meta<Tabs> = {
  title: 'UI/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  render: () => ({
    moduleMetadata: { imports: [Tabs, Tab] },
    template: `
      <app-tabs class="w-96" value="overview">
        <app-tab value="overview" label="Overview">
          <p class="text-sm text-muted-foreground">What the course covers and who it is for.</p>
        </app-tab>
        <app-tab value="chapters" label="Chapters">
          <p class="text-sm text-muted-foreground">Twelve chapters, each with a short quiz.</p>
        </app-tab>
        <app-tab value="reviews" label="Reviews">
          <p class="text-sm text-muted-foreground">4.8 from 212 learners.</p>
        </app-tab>
      </app-tabs>
    `,
  }),
};

export default meta;
type Story = StoryObj<Tabs>;

/** Arrow keys move between tabs; the panel follows the selected tab. */
export const Default: Story = {};
