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
 * Arabic glyphs. None of the app's fonts (Inter, Inter Tight, Source Serif 4, JetBrains Mono) has an
 * Arabic subset, so without this Arabic falls back to whatever each OS has. Loaded only on Arabic
 * pages, so no other language's HTML or network changes.
 */
const ARABIC_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap';

function useArabicFont(doc: Document): void {
  // The server-rendered page already carries the link; only client-rendered routes add it here.
  if (!doc.getElementById('font-arabic')) {
    const link = doc.createElement('link');
    link.id = 'font-arabic';
    link.rel = 'stylesheet';
    link.href = ARABIC_FONT_HREF;
    doc.head.appendChild(link);
  }
  // Inter first: Latin text and digits keep it, and the browser falls through to Noto Sans Arabic
  // glyph by glyph for Arabic letters only.
  doc.documentElement.style.setProperty('--font-sans', "Inter, 'Noto Sans Arabic', sans-serif");
}

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
 * - For Arabic, a font that has Arabic glyphs (`useArabicFont`).
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
      const document = inject(DOCUMENT);
      const html = document.documentElement;
      html.lang = current;
      if (dir === 'rtl') html.dir = dir;
      if (current === 'ar') useArabicFont(document);

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
