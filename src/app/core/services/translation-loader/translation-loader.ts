import { isPlatformServer } from '@angular/common';
import { PLATFORM_ID, Service, TransferState, inject, makeStateKey } from '@angular/core';
import type { Translation, TranslocoLoader } from '@jsverse/transloco';
import type { Language } from '../../models/language.model';
import en from '../../../../i18n/en.json';

/**
 * Every non-English dictionary as a FIXED map of literal imports: each becomes its own lazy chunk,
 * downloaded only by visitors in that language, and nothing user-controlled can shape an import
 * path. Typed so that adding a language to `SUPPORTED_LANGUAGES` without a file fails the build.
 */
const LAZY_DICTIONARIES: Record<
  Exclude<Language, 'en'>,
  () => Promise<{ default: Translation }>
> = {
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

    const key = makeStateKey<Translation>(`i18n.${lang}`);
    const transferred = this.transferState.get(key, null);
    if (transferred) return transferred;

    const translation = (await load()).default;
    if (this.isServer) this.transferState.set(key, translation);
    return translation;
  }
}
