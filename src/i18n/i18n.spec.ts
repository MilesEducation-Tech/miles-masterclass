import { SUPPORTED_LANGUAGES } from '@core/constants/languages';
import ar from './ar.json';
import de from './de.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';

/**
 * A missing translation must fail CI, not show a raw key (`nav.masterClass`) to a learner. English is
 * the source of truth; every other file must mirror it exactly.
 */
const DICTIONARIES: Record<string, unknown> = { en, ar, fr, de, es };

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

const english = new Map(flatten(en));

describe('translation files', () => {
  it('exist for exactly the supported languages', () => {
    expect(Object.keys(DICTIONARIES).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
  });

  for (const [language, dictionary] of Object.entries(DICTIONARIES)) {
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
