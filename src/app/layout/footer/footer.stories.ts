import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { RouterModule } from '@angular/router';
import { Footer } from './footer';
import { Utils } from '../../shared/core/services/utils/utils';

class MockUtils {
  getRouteParams() {
    return { country: 'us', profession: 'cpa' };
  }
}

const meta: Meta<Footer> = {
  title: 'Layout/Footer',
  component: Footer,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    moduleMetadata({
      imports: [RouterModule.forRoot([], { initialNavigation: 'disabled' as any })],
      providers: [{ provide: Utils, useClass: MockUtils }],
    }),
  ],
};

export default meta;
type Story = StoryObj<Footer>;

export const Default: Story = {};

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
