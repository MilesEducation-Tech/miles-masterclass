import { DOCUMENT, PLATFORM_ID, REQUEST, TransferState, makeStateKey } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { Language } from '../../models/language.model';
import { Storage } from '../storage/storage';
import { ENABLED_LANGUAGES, LanguageContext } from './language-context';

const LANGUAGE_KEY = makeStateKey<string>('language');

interface Setup {
  platform: 'server' | 'browser';
  /** `Accept-Language` request header (server). */
  acceptLanguage?: string;
  /** `lang` cookie. */
  cookie?: string;
  /** What the server handed over (browser). */
  transferred?: string;
  enabled?: readonly Language[];
  /** Replaces `document` (only the switching cases need to observe `location.reload`). */
  document?: unknown;
}

const setCookie = vi.fn();

function setup({
  platform,
  acceptLanguage,
  cookie = '',
  transferred,
  enabled = ['en', 'ar', 'fr', 'de', 'es'],
  document,
}: Setup): LanguageContext {
  // Several cases build more than one context in a single test.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: platform },
      { provide: ENABLED_LANGUAGES, useValue: enabled },
      {
        provide: REQUEST,
        useValue:
          acceptLanguage === undefined
            ? null
            : { headers: new Headers({ 'accept-language': acceptLanguage }) },
      },
      {
        provide: Storage,
        useValue: { getCookie: (k: string) => (k === 'lang' ? cookie : ''), setCookie },
      },
      ...(document ? [{ provide: DOCUMENT, useValue: document }] : []),
    ],
  });
  if (transferred) TestBed.inject(TransferState).set(LANGUAGE_KEY, transferred);
  return TestBed.inject(LanguageContext);
}

describe('LanguageContext', () => {
  describe('on the server', () => {
    const server = (s: Omit<Setup, 'platform'>) => setup({ platform: 'server', ...s });

    it('takes the most preferred enabled language from Accept-Language', () => {
      expect(server({ acceptLanguage: 'fr-CA,fr;q=0.9,en;q=0.8' }).current).toBe('fr');
    });

    it('lets the switcher’s cookie beat the browser preference', () => {
      expect(server({ acceptLanguage: 'fr', cookie: 'de' }).current).toBe('de');
    });

    it('skips a cookie or preference this build has not enabled', () => {
      expect(server({ acceptLanguage: 'ar,fr;q=0.5', enabled: ['en', 'fr'] }).current).toBe('fr');
      expect(server({ acceptLanguage: 'es', cookie: 'xx' }).current).toBe('es');
    });

    it('falls back to English, which is also what a crawler gets', () => {
      expect(server({ acceptLanguage: 'ja,it;q=0.8' }).current).toBe('en');
      expect(server({}).current).toBe('en');
    });

    it('hands its answer to the browser for hydration', () => {
      server({ acceptLanguage: 'de' });
      expect(TestBed.inject(TransferState).get(LANGUAGE_KEY, null)).toBe('de');
    });

    it('marks Arabic right to left and the rest left to right', () => {
      expect(server({ acceptLanguage: 'ar-AE' }).dir).toBe('rtl');
      expect(server({ acceptLanguage: 'fr' }).dir).toBe('ltr');
    });
  });

  describe('in the browser', () => {
    let languages: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      languages = vi
        .spyOn(Navigator.prototype, 'languages', 'get')
        .mockReturnValue(['es-MX', 'en']);
    });
    afterEach(() => languages.mockRestore());

    const browser = (s: Omit<Setup, 'platform'>) => setup({ platform: 'browser', ...s });

    // The server-rendered DOM is in this language; picking another would break hydration.
    it('keeps the server’s answer over the cookie and the browser', () => {
      expect(browser({ transferred: 'de', cookie: 'fr' }).current).toBe('de');
    });

    it('resolves on its own on client-rendered routes: cookie, then navigator.languages', () => {
      expect(browser({ cookie: 'fr' }).current).toBe('fr');
      expect(browser({}).current).toBe('es');
    });

    it('falls back to English when the browser asks for nothing enabled', () => {
      languages.mockReturnValue(['ja', 'it']);
      expect(browser({}).current).toBe('en');
    });

    it('ignores a transferred value this build no longer enables', () => {
      expect(browser({ transferred: 'ar', enabled: ['en', 'es'] }).current).toBe('es');
    });
  });

  describe('switching', () => {
    const reload = vi.fn();
    const switching = (enabled: readonly Language[] = ['en', 'fr', 'de']) => {
      setCookie.mockClear();
      reload.mockClear();
      // The real document (TestBed needs it), seen through a proxy whose window can be observed:
      // jsdom's own `location.reload` can be neither spied on nor followed.
      const view = { navigator: { languages: [] }, location: { reload } };
      const document = new Proxy(window.document, {
        get: (target, key) => {
          if (key === 'defaultView') return view;
          const value: unknown = Reflect.get(target, key, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      return setup({ platform: 'browser', cookie: 'fr', enabled, document });
    };

    it('offers a switcher only when the build has more than one language', () => {
      expect(switching().canSwitch).toBe(true);
      expect(switching(['en']).canSwitch).toBe(false);
    });

    // A reload is what changes LOCALE_ID, the translations, <html lang dir> and Django's
    // responses together; the cookie is what the reloaded page resolves from.
    it('remembers the choice for a year and reloads', () => {
      switching().use('de');
      expect(setCookie).toHaveBeenCalledWith('lang', 'de', { expires: 365 });
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('does nothing for the current language or one this build does not offer', () => {
      const context = switching();
      context.use('fr');
      context.use('ar');
      expect(setCookie).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
    });
  });
});
