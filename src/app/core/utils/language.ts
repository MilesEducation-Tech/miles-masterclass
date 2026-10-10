import type { Language } from '../models/language.model';

/**
 * The `Language` a BCP 47 tag asks for, if it is one of `enabled`: only the primary subtag counts
 * (`fr-CA` → `fr`, `ar-AE` → `ar`), since translations are per language, not per region. Anything
 * else (unknown, disabled in this build, empty) is `undefined`, so callers fall through to their
 * next source.
 */
export function toLanguage(
  tag: string | null | undefined,
  enabled: readonly Language[],
): Language | undefined {
  const primary = tag?.trim().split(/[-_]/)[0].toLowerCase();
  return enabled.find((language) => language === primary);
}

/** The first of `tags` (most preferred first) that is enabled. */
export function pickLanguage(
  tags: readonly string[],
  enabled: readonly Language[],
): Language | undefined {
  for (const tag of tags) {
    const language = toLanguage(tag, enabled);
    if (language) return language;
  }
  return undefined;
}

/**
 * The tags of an `Accept-Language` header, most preferred first (`fr-CA,fr;q=0.9,en;q=0.8`).
 * Entries with `q=0` (explicitly not wanted), an unreadable `q`, or the `*` wildcard are dropped.
 * Equal weights keep the order they were sent in (`Array.prototype.sort` is stable).
 */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.split(';').map((s) => s.trim());
      const q = params.find((p) => p.startsWith('q='));
      return { tag, weight: q ? Number(q.slice(2)) : 1 };
    })
    .filter(({ tag, weight }) => tag && tag !== '*' && weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map(({ tag }) => tag);
}
