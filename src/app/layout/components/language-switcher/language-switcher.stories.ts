import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig } from '@storybook/angular';
import type { Language } from '@core/models/language.model';
import { LanguageContext } from '@core/services/language-context/language-context';
import { provideTranslocoTesting } from '@testing/transloco';
import { LanguageSwitcher } from './language-switcher';

const context = (current: Language, enabled: readonly Language[]) => ({
  current,
  enabled,
  // Stories never reload the canvas.
  use: () => undefined,
});

const meta: Meta<LanguageSwitcher> = {
  title: 'Layout/LanguageSwitcher',
  component: LanguageSwitcher,
  tags: ['autodocs'],
  decorators: [
    applicationConfig({
      providers: [
        provideTranslocoTesting(),
        { provide: LanguageContext, useValue: context('en', ['en', 'ar', 'fr', 'de', 'es']) },
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj<LanguageSwitcher>;

export const AllLanguages: Story = {};

export const UatLanguages: Story = {
  decorators: [
    applicationConfig({
      providers: [{ provide: LanguageContext, useValue: context('de', ['en', 'fr', 'de', 'es']) }],
    }),
  ],
};
