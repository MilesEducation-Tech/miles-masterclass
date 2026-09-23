/** Convert a display name to a URL-safe kebab-case slug. Single source for the whole feature. */
export function toSlug(value: string): string {
  return value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}
