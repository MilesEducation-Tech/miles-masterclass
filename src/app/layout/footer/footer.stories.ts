import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideTranslocoTesting } from '@testing/transloco';
import { RouterModule } from '@angular/router';
import { Footer } from './footer';
import { Utils } from '@shared/services/utils';

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
    applicationConfig({ providers: [provideTranslocoTesting()] }),
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
