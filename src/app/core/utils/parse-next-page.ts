/**
 * Pagination payloads from the Miles Masterclass API surface `next_page` as
 * either a numeric page index, a full URL like `…?page=2`, or `null`. Pull the
 * page number out regardless of shape, returning `null` when there is no next
 * page (or the value can't be parsed).
 */
export function parseNextPage(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  try {
    const p = new URL(value).searchParams.get('page');
    return p ? parseInt(p, 10) : null;
  } catch {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }
}
