import { BlogPostView, WpMedia, WpPost } from '../models/blog.model';

/** Canonical HTTPS origin of the WordPress install (assets + links). */
const WP_SECURE_ORIGIN = 'https://wp.milesmasterclass.com';

/** The minimal set of named HTML entities WordPress titles/excerpts emit. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

function safeFromCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/**
 * Decode HTML entities without a DOM — works on both server (SSR) and browser.
 * Covers numeric (`&#8217;`, `&#x2019;`) and the common named entities WP uses.
 */
export function decodeHtmlEntities(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/&#(\d+);/g, (_, dec: string) => safeFromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(
      /&([a-z0-9]+);/gi,
      (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match,
    );
}

/** Strip tags and collapse whitespace into clean plain text. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Truncate at a word boundary with an ellipsis. */
export function truncate(text: string, max = 160): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

/** Rough reading-time estimate at ~200 words/min, floored at 1 minute. */
export function readingMinutes(html: string | null | undefined): number {
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Force any plain-HTTP or IP-based WordPress asset URL onto the HTTPS host so
 * images/avatars never trip mixed-content blocking when the app is on HTTPS.
 */
export function secureUrl(url: string | null | undefined): string {
  if (!url) return '';
  return url
    .replace(/^http:\/\/45\.55\.74\.171/i, WP_SECURE_ORIGIN)
    .replace(/^http:\/\//i, 'https://');
}

/** Long-form date, e.g. "June 5, 2026". */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Prefer a reasonably large rendition, falling back to the original. */
function pickFeaturedImage(media?: WpMedia): string {
  if (!media) return '';
  const sizes = media.media_details?.sizes;
  return (
    sizes?.['large']?.source_url ||
    sizes?.['medium_large']?.source_url ||
    sizes?.['full']?.source_url ||
    media.source_url ||
    ''
  );
}

/** Map a raw WP post (with `_embed` data) to the flattened render model. */
export function toBlogPostView(post: WpPost): BlogPostView {
  const embedded = post._embedded ?? {};
  const media = embedded['wp:featuredmedia']?.[0];
  const author = embedded.author?.[0];
  const categories = (embedded['wp:term'] ?? [])
    .flat()
    .filter((term) => term?.taxonomy === 'category')
    .map((term) => ({ id: term.id, name: decodeHtmlEntities(term.name), slug: term.slug }));

  const title = decodeHtmlEntities(post.title?.rendered ?? '');

  return {
    id: post.id,
    slug: post.slug,
    title,
    excerpt: truncate(stripHtml(post.excerpt?.rendered)),
    contentHtml: post.content?.rendered ?? '',
    isoDate: post.date,
    displayDate: formatDate(post.date),
    author: author?.name ?? 'Miles Masterclass',
    authorAvatar: secureUrl(author?.avatar_urls?.['96'] ?? author?.avatar_urls?.['48'] ?? ''),
    featuredImage: secureUrl(pickFeaturedImage(media)),
    featuredImageAlt: media?.alt_text || title,
    categories,
    readingMinutes: readingMinutes(post.content?.rendered),
  };
}
