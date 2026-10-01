import { registerLocaleData } from '@angular/common';
import {
  DOCUMENT,
  EnvironmentProviders,
  LOCALE_ID,
  inject,
  isDevMode,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { TranslocoService, provideTransloco } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '@core/constants/languages';
import type { Language } from '@core/models/language.model';
import { LanguageContext } from '@core/services/language-context/language-context';
import { TranslationLoader } from '@core/services/translation-loader/translation-loader';

/**
 * Angular locale data per non-English language, as a FIXED map of literal imports: each becomes its
 * own lazy chunk that only a visitor in that language downloads, and nothing user-controlled can
 * shape an import path. English needs no entry, since its data ships inside Angular.
 */
const LOCALE_DATA: Partial<Record<Language, () => Promise<{ default: unknown }>>> = {
  ar: () => import('@angular/common/locales/ar'),
  fr: () => import('@angular/common/locales/fr'),
  de: () => import('@angular/common/locales/de'),
  es: () => import('@angular/common/locales/es'),
};

/**
 * Applies the visitor's language (`LanguageContext`) to the whole app, on the server and in the
 * browser alike:
 * - `LOCALE_ID`, which every `currency` / `date` / `number` pipe formats with. English stays
 *   `en-US`, Angular's default, so English output is exactly what it was before.
 * - Angular's locale data for that language, loaded BEFORE the first render so no pipe ever formats
 *   with data that isn't registered yet.
 * - `<html lang>` (screen readers, hyphenation, search engines) and, for right-to-left languages,
 *   `<html dir="rtl">`. `dir` is left off for left-to-right, its default, so the English document
 *   is unchanged.
 * - Transloco, active in that language with its dictionary loaded before the first render, so no
 *   text ever renders as a raw key or flashes in English first. `reRenderOnLangChange` is off: the
 *   language only changes through a reload (`LanguageContext.use`), so nothing needs watching.
 */
export function provideLanguage(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideTransloco({
      config: {
        availableLangs: [...SUPPORTED_LANGUAGES],
        defaultLang: DEFAULT_LANGUAGE,
        reRenderOnLangChange: false,
        prodMode: !isDevMode(),
      },
      loader: TranslationLoader,
    }),
    {
      provide: LOCALE_ID,
      useFactory: () => {
        const language = inject(LanguageContext).current;
        return language === 'en' ? 'en-US' : language;
      },
    },
    provideAppInitializer(async () => {
      const { current, dir } = inject(LanguageContext);
      const transloco = inject(TranslocoService);
      const html = inject(DOCUMENT).documentElement;
      html.lang = current;
      if (dir === 'rtl') html.dir = dir;

      transloco.setActiveLang(current);
      const load = LOCALE_DATA[current];
      // In parallel: neither waits on the other, and the first render waits on both.
      await Promise.all([
        firstValueFrom(transloco.load(current)),
        load?.().then((data) => registerLocaleData(data.default)),
      ]);
    }),
  ]);
}
