import { isPlatformServer } from '@angular/common';
import { PLATFORM_ID, Service, TransferState, inject, makeStateKey } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { TranslocoService, type Translation, type TranslocoLoader } from '@jsverse/transloco';
import type { Language } from '../../models/language.model';
import { LanguageContext } from '../language-context/language-context';
import en from '../../../../i18n/en.json';

/**
 * Every non-English dictionary of one set (the root one, or a feature's) as a FIXED map of literal
 * imports: each becomes its own lazy chunk, downloaded only by visitors in that language, and
 * nothing user-controlled can shape an import path. Typed so that adding a language to
 * `SUPPORTED_LANGUAGES` without a file fails the build.
 */
export type LazyDictionaries = Record<
  Exclude<Language, 'en'>,
  () => Promise<{ default: Translation }>
>;

const LAZY_DICTIONARIES: LazyDictionaries = {
  ar: () => import('../../../../i18n/ar.json'),
  fr: () => import('../../../../i18n/fr.json'),
  de: () => import('../../../../i18n/de.json'),
  es: () => import('../../../../i18n/es.json'),
};

/**
 * Hands Transloco its dictionaries without a translation request wherever one can be avoided:
 * - English, the default and production's only language today, is bundled: no request, ever.
 * - Any other language is a lazy chunk. The server puts what it loaded into `TransferState`, so a
 *   server-rendered page hydrates without fetching it again; only client-rendered routes
 *   (`auth/**`, `payment/**`, admin) download the chunk, once.
 */
@Service()
export class TranslationLoader implements TranslocoLoader {
  private readonly transferState = inject(TransferState);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));

  async getTranslation(lang: string): Promise<Translation> {
    if (lang === 'en') return en;

    const load = LAZY_DICTIONARIES[lang as Exclude<Language, 'en'>];
    // Transloco only asks for languages it was configured with, all of which are in the map.
    if (!load) throw new Error(`No translations for "${lang}"`);
    return this.transferred(`i18n.${lang}`, load);
  }

  /** A feature's dictionary in a non-English language, through the same hand-over as the root one. */
  getFeatureTranslation(
    feature: string,
    lang: Exclude<Language, 'en'>,
    load: LazyDictionaries[Exclude<Language, 'en'>],
  ): Promise<Translation> {
    return this.transferred(`i18n.${feature}.${lang}`, load);
  }

  private async transferred(
    name: string,
    load: () => Promise<{ default: Translation }>,
  ): Promise<Translation> {
    const key = makeStateKey<Translation>(name);
    const transferred = this.transferState.get(key, null);
    if (transferred) return transferred;

    const translation = (await load()).default;
    if (this.isServer) this.transferState.set(key, translation);
    return translation;
  }
}

/**
 * A route resolver that merges one feature's dictionary into the active language under
 * `<feature>.*` (`src/i18n/auth/en.json` → `auth.login.sendOtp`), so the root dictionary in the
 * initial bundle stays layout-only and each feature's text loads with its route.
 *
 * A resolver rather than Transloco's scopes: scopes load from inside the pipe, after the component
 * has rendered, which renders empty text on the server and flashes in the browser. A resolver is part
 * of navigation, so SSR waits for it and nothing renders before it.
 * - English is passed in, statically imported by the feature's route file, so it ships inside the
 *   feature's lazy chunk and never waits on a request.
 * - Other languages come from `lazy` (the same fixed-map rules as the root dictionaries).
 *
 * `emitChange: false`: the language itself doesn't change, and the pipes that read these keys
 * render after this resolver, so there is nothing to re-render.
 */
export function featureTranslations(
  feature: string,
  english: Translation,
  lazy: LazyDictionaries,
): ResolveFn<true> {
  return async (): Promise<true> => {
    // Every inject() before the first await: the injection context ends there.
    const lang = inject(LanguageContext).current;
    const transloco = inject(TranslocoService);
    const loader = inject(TranslationLoader);

    const dictionary =
      lang === 'en' ? english : await loader.getFeatureTranslation(feature, lang, lazy[lang]);
    transloco.setTranslation({ [feature]: dictionary }, lang, { emitChange: false });
    return true;
  };
}
