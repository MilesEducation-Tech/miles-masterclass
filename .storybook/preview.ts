import type { Preview } from '@storybook/angular';
import { themes } from 'storybook/theming';

const preview: Preview = {
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
