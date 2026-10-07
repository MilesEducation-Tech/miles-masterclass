import { argsToTemplate, type Meta, type StoryObj } from '@storybook/angular';
import { MOCK_HOME_WEBINAR } from '@testing/mocks/home.mock';
import { HomeWebinarTicket } from './home-webinar-ticket';

const meta: Meta<HomeWebinarTicket> = {
  title: 'Home/HomeWebinarTicket',
  component: HomeWebinarTicket,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  render: (args) => ({
    props: args,
    template: `<div style="max-width: 1152px;"><app-home-webinar-ticket ${argsToTemplate(args)} /></div>`,
  }),
  argTypes: {
    register: { action: 'register' },
    knowMore: { action: 'knowMore' },
  },
};
export default meta;

type Story = StoryObj<HomeWebinarTicket>;

export const Highlighted: Story = { args: { webinar: MOCK_HOME_WEBINAR } };

/** No session scheduled: the date rows are left out. */
export const NoSession: Story = { args: { webinar: { ...MOCK_HOME_WEBINAR, sessionStart: null } } };

/** No artwork on the row: the design's banner (must exist on the bucket; it is 403 today). */
export const NoArtwork: Story = { args: { webinar: { ...MOCK_HOME_WEBINAR, banner: null } } };
