import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { RouterModule } from '@angular/router';
import { Header } from './header';
import { Auth } from '../../shared/core/services/auth/auth';
import { Logger } from '../../shared/core/services/logger/logger';
import { signal } from '@angular/core';

const noop = (): void => undefined;

class MockAuth {
  readonly isLoggedIn = signal(false);
  readonly currentUser = signal(null);
  readonly clearAuth = noop;
}

class MockAuthLoggedIn {
  readonly isLoggedIn = signal(true);
  readonly currentUser = signal({
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    is_beta_access: true,
  });
  readonly clearAuth = noop;
}

class MockLogger {
  readonly error = noop;
  readonly warn = noop;
  readonly info = noop;
}

const meta: Meta<Header> = {
  title: 'Layout/Header',
  component: Header,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    moduleMetadata({
      imports: [RouterModule.forRoot([], { initialNavigation: 'disabled' as any })],
      providers: [
        { provide: Auth, useClass: MockAuth },
        { provide: Logger, useClass: MockLogger },
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj<Header>;

export const GuestUser: Story = {};

export const LoggedInUser: Story = {
  decorators: [
    moduleMetadata({
      providers: [{ provide: Auth, useClass: MockAuthLoggedIn }],
    }),
  ],
};

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
