import { SUPPORTED_LANGUAGES } from '@core/constants/languages';
import ar from './ar.json';
import de from './de.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import authAr from './auth/ar.json';
import authDe from './auth/de.json';
import authEn from './auth/en.json';
import authEs from './auth/es.json';
import authFr from './auth/fr.json';

/**
 * A missing translation must fail CI, not show a raw key (`nav.masterClass`) to a learner. English is
 * the source of truth; every other file in a set must mirror it exactly.
 *
 * One set per dictionary: the root one (layout, in the initial bundle) and one per feature
 * (`src/i18n/<feature>/`, merged by its route's `featureTranslations` resolver). A feature that
 * adds a dictionary adds its set here.
 */
const SETS: Record<string, Record<string, unknown>> = {
  root: { en, ar, fr, de, es },
  auth: { en: authEn, ar: authAr, fr: authFr, de: authDe, es: authEs },
};

type Entry = [key: string, value: unknown];

function flatten(node: unknown, prefix = ''): Entry[] {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return [[prefix, node]];
  return Object.entries(node).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

/** `{{ count }}`-style interpolation names, which every translation must keep. */
const placeholders = (value: unknown): string[] =>
  [...String(value).matchAll(/{{\s*([\w.]+)\s*}}/g)].map((m) => m[1]).sort();

for (const [set, dictionaries] of Object.entries(SETS)) {
  describe(`${set} translation files`, () => {
    const english = new Map(flatten(dictionaries['en']));

    it('exist for exactly the supported languages', () => {
      expect(Object.keys(dictionaries).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
    });

    for (const [language, dictionary] of Object.entries(dictionaries)) {
      describe(language, () => {
        const entries = flatten(dictionary);

        it('has every English key and nothing else', () => {
          expect(entries.map(([key]) => key).sort()).toEqual([...english.keys()].sort());
        });

        it('has no empty or non-string value', () => {
          const bad = entries.filter(([, value]) => typeof value !== 'string' || !value.trim());
          expect(bad).toEqual([]);
        });

        it('keeps every placeholder', () => {
          const drift = entries.filter(
            ([key, value]) => placeholders(value).join() !== placeholders(english.get(key)).join(),
          );
          expect(drift).toEqual([]);
        });
      });
    }
  });
}
