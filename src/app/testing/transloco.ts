import { EnvironmentProviders, importProvidersFrom } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../i18n/en.json';
import authEn from '../../i18n/auth/en.json';

/**
 * Transloco for specs and stories: the real English dictionary, loaded synchronously, so a
 * component renders the same text it does in the app and a spec can assert on it. Feature
 * dictionaries sit under their prefix, as their route resolvers (`featureTranslations`) merge them.
 */
export function provideTranslocoTesting(): EnvironmentProviders {
  return importProvidersFrom(
    TranslocoTestingModule.forRoot({
      langs: { en: { ...en, auth: authEn } },
      translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
      preloadLangs: true,
    }),
  );
}
