import { isPlatformBrowser } from '@angular/common';
import {
  DOCUMENT,
  InjectionToken,
  PLATFORM_ID,
  REQUEST,
  Service,
  TransferState,
  inject,
  makeStateKey,
} from '@angular/core';
import { environment } from '@env/environment';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  RTL_LANGUAGES,
  SUPPORTED_LANGUAGES,
} from '../../constants/languages';
import type { Language, TextDirection } from '../../models/language.model';
import { parseAcceptLanguage, pickLanguage, toLanguage } from '../../utils/language';
import { Storage } from '../storage/storage';

/**
 * The languages this build may resolve to (`environment.I18N.languages`). A token so specs can
 * enable languages the test environment doesn't. Filtering through `SUPPORTED_LANGUAGES` types the
 * list and drops a typo in an environment file instead of letting it through.
 */
export const ENABLED_LANGUAGES = new InjectionToken<readonly Language[]>('ENABLED_LANGUAGES', {
  providedIn: 'root',
  factory: () =>
    SUPPORTED_LANGUAGES.filter((l) =>
      (environment.I18N.languages as readonly string[]).includes(l),
    ),
});

/** The server's answer, handed to the browser so hydration renders the same language. */
const LANGUAGE_KEY = makeStateKey<string>('language');

/**
 * The visitor's language: the one answer the API header, `LOCALE_ID` and `<html lang dir>` read.
 *
 * Resolved ONCE per page load. Switching language reloads the page, because `LOCALE_ID` (read by
 * every `currency` / `date` / `number` pipe) cannot change after bootstrap, and a reload also
 * refetches every Django response in the new language. So `current` is a plain value, not a signal.
 *
 * Precedence:
 * - Server: `lang` cookie → `Accept-Language` (q-ordered) → `en`, then saved to `TransferState`.
 * - Browser: the server's answer from `TransferState` (every server-rendered page) → `lang` cookie
 *   → `navigator.languages` → `en`. The last three only matter on client-rendered routes
 *   (`auth/**`, `payment/**`, admin), which have no server render to inherit from.
 *
 * The country plays no part: any language can be used in any country.
 */
@Service()
export class LanguageContext {
  private readonly enabled = inject(ENABLED_LANGUAGES);
  private readonly request = inject(REQUEST, { optional: true });
  private readonly storage = inject(Storage);
  private readonly transferState = inject(TransferState);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);

  readonly current: Language = this.resolve();

  readonly dir: TextDirection = RTL_LANGUAGES.includes(this.current) ? 'rtl' : 'ltr';

  private resolve(): Language {
    const cookie = toLanguage(this.storage.getCookie(LANGUAGE_COOKIE), this.enabled);

    if (!this.isBrowser) {
      const language =
        cookie ??
        pickLanguage(
          parseAcceptLanguage(this.request?.headers.get('accept-language')),
          this.enabled,
        ) ??
        DEFAULT_LANGUAGE;
      this.transferState.set(LANGUAGE_KEY, language);
      return language;
    }

    return (
      toLanguage(this.transferState.get(LANGUAGE_KEY, null), this.enabled) ??
      cookie ??
      pickLanguage(this.document.defaultView?.navigator.languages ?? [], this.enabled) ??
      DEFAULT_LANGUAGE
    );
  }
}
