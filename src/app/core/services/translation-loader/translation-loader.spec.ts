import { PLATFORM_ID, TransferState, importProvidersFrom, makeStateKey } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { TranslocoService, TranslocoTestingModule, type Translation } from '@jsverse/transloco';
import type { Language } from '../../models/language.model';
import { LanguageContext } from '../language-context/language-context';
import { type LazyDictionaries, featureTranslations } from './translation-loader';

describe('featureTranslations', () => {
  const english: Translation = { title: 'Sign in' };
  const french: Translation = { title: 'Connexion' };
  let lazy: LazyDictionaries;

  function setUp(lang: Language, platform: 'server' | 'browser'): void {
    const load = vi.fn(async () => ({ default: french }));
    lazy = { ar: load, fr: load, de: load, es: load };
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platform },
        { provide: LanguageContext, useValue: { current: lang } },
        importProvidersFrom(
          TranslocoTestingModule.forRoot({
            langs: { en: { nav: 'Home' }, fr: { nav: 'Accueil' } },
            translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: lang },
            preloadLangs: true,
          }),
        ),
      ],
    });
  }

  const resolve = () =>
    TestBed.runInInjectionContext(() =>
      featureTranslations(
        'auth',
        english,
        lazy,
      )({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  const translate = (key: string, lang: Language) =>
    TestBed.inject(TranslocoService).translate(key, {}, lang);

  it('merges English under the feature prefix without loading anything', async () => {
    setUp('en', 'browser');
    await resolve();
    expect(translate('auth.title', 'en')).toBe('Sign in');
    expect(translate('nav', 'en')).toBe('Home');
    expect(lazy.fr).not.toHaveBeenCalled();
  });

  it('on the server, loads the language once and hands it to the browser', async () => {
    setUp('fr', 'server');
    await resolve();
    expect(translate('auth.title', 'fr')).toBe('Connexion');
    expect(translate('nav', 'fr')).toBe('Accueil');
    expect(lazy.fr).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(TransferState).get(makeStateKey('i18n.auth.fr'), null)).toEqual(french);
  });

  it('in the browser, uses what the server handed over instead of fetching it', async () => {
    setUp('fr', 'browser');
    TestBed.inject(TransferState).set(makeStateKey<Translation>('i18n.auth.fr'), french);
    await resolve();
    expect(translate('auth.title', 'fr')).toBe('Connexion');
    expect(lazy.fr).not.toHaveBeenCalled();
  });
});
