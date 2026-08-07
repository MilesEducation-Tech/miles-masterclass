/**
 * Type definitions for the headless WordPress blog (WP REST API v2).
 * Only the fields the public blog actually consumes are typed; the WP payload
 * carries far more (Astra theme meta, `_links`, etc.) that we intentionally
 * ignore.
 */

/** WordPress wraps user-facing strings in a `{ rendered }` object. */
export interface WpRenderable {
  rendered: string;
  protected?: boolean;
}

/** A single post as returned by `/wp/v2/posts` (with `_embed`). */
export interface WpPost {
  id: number;
  date: string;
  modified: string;
  slug: string;
  link: string;
  status: string;
  title: WpRenderable;
  content: WpRenderable;
  excerpt: WpRenderable;
  author: number;
  featured_media: number;
  categories: number[];
  tags: number[];
  _embedded?: WpEmbedded;
}

export interface WpEmbedded {
  author?: WpAuthor[];
  'wp:featuredmedia'?: WpMedia[];
  /** Each taxonomy is its own array; categories + tags arrive together. */
  'wp:term'?: WpTerm[][];
}

export interface WpAuthor {
  id: number;
  name: string;
  description?: string;
  avatar_urls?: Record<string, string>;
}

export interface WpMediaSize {
  source_url: string;
  width: number;
  height: number;
}

export interface WpMedia {
  id: number;
  source_url: string;
  alt_text?: string;
  media_details?: {
    width?: number;
    height?: number;
    sizes?: Record<string, WpMediaSize>;
  };
}

export interface WpTerm {
  id: number;
  name: string;
  slug: string;
  taxonomy: string;
}

export interface WpCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
}

/** Result of a paged post listing — body plus WP's pagination headers. */
export interface BlogPostsResult {
  posts: WpPost[];
  total: number;
  totalPages: number;
}

/** Query params accepted by the blog listing. */
export interface BlogListQuery {
  page?: number;
  perPage?: number;
  search?: string;
  categoryId?: number | null;
  /** Post IDs to exclude (e.g. the current post when fetching related). */
  exclude?: number[];
}

/** Lightweight category reference used by the view-models. */
export interface BlogCategoryRef {
  id: number;
  name: string;
  slug: string;
}

/**
 * Flattened, render-ready view of a post. Components bind to this instead of
 * the raw `WpPost` so templates stay free of `_embedded` digging and entity
 * decoding.
 */
export interface BlogPostView {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  isoDate: string;
  displayDate: string;
  author: string;
  authorAvatar: string;
  featuredImage: string;
  featuredImageAlt: string;
  categories: BlogCategoryRef[];
  readingMinutes: number;
}
