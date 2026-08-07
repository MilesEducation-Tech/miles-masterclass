import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Backward } from './backward';
import { Router, ActivatedRoute } from '@angular/router';
import { MockRouter } from '../__mocks__/services.mock';

const meta: Meta<Backward> = {
  title: 'Components/Backward',
  component: Backward,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      providers: [
        { provide: Router, useClass: MockRouter },
        { provide: ActivatedRoute, useValue: { snapshot: {} } },
      ],
    }),
  ],
  argTypes: {
    label: { control: 'text', description: 'Button label text' },
    fallback: { control: 'text', description: 'Fallback route if no history' },
    routePath: { control: 'text', description: 'Explicit route path (overrides history)' },
  },
};

export default meta;
type Story = StoryObj<Backward>;

export const Default: Story = {
  args: {
    label: 'Back',
    fallback: '/',
  },
};

export const CustomLabel: Story = {
  args: {
    label: 'Back to Courses',
    fallback: '/courses',
  },
};

export const WithRoutePath: Story = {
  args: {
    label: 'Back to Dashboard',
    routePath: '/dashboard',
  },
};

export const BackToHome: Story = {
  args: {
    label: 'Home',
    fallback: '/',
  },
};
