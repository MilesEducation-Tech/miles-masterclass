import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { RouterModule } from '@angular/router';
import { Header } from './header';
import { Logger } from '@core/services/logger/logger';

const noop = (): void => undefined;

class MockLogger {
  readonly error = noop;
  readonly warn = noop;
  readonly info = noop;
}

// ponytail: the `LoggedInUser` story provided a mock `Auth` service. There is
// no session layer to mock any more — the header holds its signed-out state in
// plain signals — so only the guest variants remain.
const meta: Meta<Header> = {
  title: 'Layout/Header',
  component: Header,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    moduleMetadata({
      imports: [RouterModule.forRoot([], { initialNavigation: 'disabled' as any })],
      providers: [{ provide: Logger, useClass: MockLogger }],
    }),
  ],
};

export default meta;
type Story = StoryObj<Header>;

export const GuestUser: Story = {};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: 'tablet' },
  },
};
