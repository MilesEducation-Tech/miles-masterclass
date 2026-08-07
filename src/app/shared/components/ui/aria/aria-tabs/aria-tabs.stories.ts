import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { AriaTabs } from './aria-tabs';
import { AriaTabList } from './aria-tab-list';
import { AriaTab } from './aria-tab';
import { AriaTabPanel } from './aria-tab-panel';

const meta: Meta<AriaTabs> = {
  title: 'UI/Aria/Tabs',
  component: AriaTabs,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [AriaTabs, AriaTabList, AriaTab, AriaTabPanel],
    }),
  ],
};

export default meta;
type Story = StoryObj<AriaTabs>;

export const Basic: Story = {
  render: () => ({
    template: `
      <app-aria-tabs>
        <app-aria-tab-list selectedTab="overview">
          <button appAriaTab value="overview" type="button">Overview</button>
          <button appAriaTab value="details" type="button">Details</button>
          <button appAriaTab value="reviews" type="button">Reviews</button>
        </app-aria-tab-list>

        <app-aria-tab-panel value="overview">
          <p>Overview content — high-level summary.</p>
        </app-aria-tab-panel>
        <app-aria-tab-panel value="details">
          <p>Detailed content — full specifications.</p>
        </app-aria-tab-panel>
        <app-aria-tab-panel value="reviews">
          <p>Reviews content — what users are saying.</p>
        </app-aria-tab-panel>
      </app-aria-tabs>
    `,
  }),
};

export const Vertical: Story = {
  render: () => ({
    template: `
      <app-aria-tabs class="flex gap-6">
        <app-aria-tab-list orientation="vertical" selectedTab="profile" class="flex-col rounded-md">
          <button appAriaTab value="profile" type="button">Profile</button>
          <button appAriaTab value="billing" type="button">Billing</button>
          <button appAriaTab value="notifications" type="button">Notifications</button>
        </app-aria-tab-list>

        <div class="flex-1">
          <app-aria-tab-panel value="profile">Profile settings.</app-aria-tab-panel>
          <app-aria-tab-panel value="billing">Billing details.</app-aria-tab-panel>
          <app-aria-tab-panel value="notifications">Notification preferences.</app-aria-tab-panel>
        </div>
      </app-aria-tabs>
    `,
  }),
};

export const WithDisabled: Story = {
  render: () => ({
    template: `
      <app-aria-tabs>
        <app-aria-tab-list selectedTab="a">
          <button appAriaTab value="a" type="button">First</button>
          <button appAriaTab value="b" type="button" [disabled]="true">Disabled</button>
          <button appAriaTab value="c" type="button">Third</button>
        </app-aria-tab-list>

        <app-aria-tab-panel value="a">First panel.</app-aria-tab-panel>
        <app-aria-tab-panel value="b">Disabled panel.</app-aria-tab-panel>
        <app-aria-tab-panel value="c">Third panel.</app-aria-tab-panel>
      </app-aria-tabs>
    `,
  }),
};
