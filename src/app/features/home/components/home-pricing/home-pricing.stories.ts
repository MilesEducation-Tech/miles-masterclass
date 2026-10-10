import {
  applicationConfig,
  argsToTemplate,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { provideRouter } from '@angular/router';
import { Utils } from '@shared/services/utils';
import { MOCK_HOME_PRICE_US, MOCK_HOME_PRICE_YEARLY_DISCOUNT } from '@testing/mocks/home.mock';
import { MockUtils } from '@testing/mocks/services.mock';
import { HomePricing } from './home-pricing';

const meta: Meta<HomePricing> = {
  title: 'Home/HomePricing',
  component: HomePricing,
  tags: ['autodocs'],
  decorators: [
    applicationConfig({ providers: [provideRouter([])] }),
    moduleMetadata({ providers: [{ provide: Utils, useClass: MockUtils }] }),
  ],
  parameters: { layout: 'padded' },
  render: (args) => ({
    props: args,
    template: `<div style="max-width: 1200px;"><app-home-pricing ${argsToTemplate(args)} /></div>`,
  }),
};
export default meta;

type Story = StoryObj<HomePricing>;

/** The home page today: no plan read yet, so no figures. */
export const WithoutPrice: Story = { args: { price: null } };

export const MonthlyAndYearly: Story = { args: { price: MOCK_HOME_PRICE_US } };

export const DiscountedYearly: Story = { args: { price: MOCK_HOME_PRICE_YEARLY_DISCOUNT } };
