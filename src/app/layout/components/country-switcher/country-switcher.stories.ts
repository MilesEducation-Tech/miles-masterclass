import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig } from '@storybook/angular';
import { signal } from '@angular/core';
import type { CountryCode } from '@core/models/route-params.model';
import { CountryContext } from '@core/services/country-context/country-context';
import { LanguageContext } from '@core/services/language-context/language-context';
import { provideTranslocoTesting } from '@testing/transloco';
import { CountrySwitcher } from './country-switcher';

const context = (current: CountryCode, language: string) => [
  // Stories never navigate the canvas.
  { provide: CountryContext, useValue: { current: signal(current), use: () => undefined } },
  { provide: LanguageContext, useValue: { current: language } },
];

const meta: Meta<CountrySwitcher> = {
  title: 'Layout/CountrySwitcher',
  component: CountrySwitcher,
  tags: ['autodocs'],
  decorators: [
    applicationConfig({ providers: [provideTranslocoTesting(), ...context('us', 'en')] }),
  ],
};

export default meta;
type Story = StoryObj<CountrySwitcher>;

export const UnitedStates: Story = {};

/** Names come from `Intl.DisplayNames`, so they follow the visitor's language for free. */
export const IndiaInFrench: Story = {
  decorators: [applicationConfig({ providers: context('in', 'fr') })],
};
