import type { Preview } from '@storybook/angular';
import { applicationConfig } from '@storybook/angular';
import { themes } from 'storybook/theming';
import { TOAST_COMPONENT } from '@core/services/notification/notification';
import { Toast } from '@shared/ui/toast/toast';

const preview: Preview = {
  // The app's composition root names the toast `NotificationService` renders (app.config.ts); every
  // story that reaches the service needs the same, or it fails with NG0201.
  decorators: [applicationConfig({ providers: [{ provide: TOAST_COMPONENT, useValue: Toast }] })],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: 'rgb(14, 14, 14)' },
        { name: 'card', value: 'rgb(56, 66, 76)' },
        { name: 'light', value: '#ffffff' },
      ],
    },
    layout: 'centered',
    docs: {
      theme: themes.dark,
    },
  },
  initialGlobals: {
    theme: 'dark',
  },
};

export default preview;
