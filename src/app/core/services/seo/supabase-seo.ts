import { inject, Service } from '@angular/core';
import { SeoPage } from '../../models/seo.models';
import { Logger } from '../logger/logger';
import { Supabase } from '../supabase/supabase';

const TABLE_NAME = 'seo_pages';

@Service()
export class SupabaseSeo {
  private readonly supabase = inject(Supabase);
  private readonly logger = inject(Logger);
  private clientWarned = false;

  /**
   * Returns the Supabase client, or `null` if it isn't configured. Logs once
   * the first time we hit the unconfigured path so devops have a single
   * breadcrumb in the console instead of either silence or per-call spam.
   * The underlying `Supabase.getClient()` is async because `@supabase/supabase-js`
   * is loaded via dynamic import to keep it out of the initial bundle.
   */
  private async getClientSafe() {
    try {
      return await this.supabase.getClient();
    } catch (err) {
      if (!this.clientWarned) {
        this.clientWarned = true;
        this.logger.warn('[SupabaseSeo] Supabase client unavailable; SEO reads will no-op.', err);
      }
      return null;
    }
  }

  /**
   * Fetch SEO config for a specific (active) page slug. A concrete
   * `page_slug` match always wins; otherwise we fall back to a row whose
   * `slug_pattern` structurally matches the URL — e.g.
   * `podcast/123/intro-to-tax` resolves to a row with
   * `slug_pattern = 'podcast/:courseId/:courseTitle'`.
   *
   * Both arms are fetched in a SINGLE round-trip via `.or()` and resolved in
   * JS. A sequential concrete-then-pattern lookup used to pay a
   * guaranteed-miss request on every course page (course URLs never carry a
   * concrete row), doubling SEO reads; collapsing them halves that. The
   * `slug_pattern` arm stays bounded by the URL's first segment so the query
   * remains index-friendly, with the precise structural match done in JS.
   *
   * `slug` is always slug-safe (`[a-z0-9-]` segments joined by `/`), so it
   * carries no `,`/`.`/`()` that would confuse PostgREST's `.or()` grammar.
   */
  async getBySlug(slug: string): Promise<SeoPage | null> {
    const client = await this.getClientSafe();
    if (!client) return null;

    const firstSegment = slug.split('/')[0];

    const { data, error } = await client
      .from(TABLE_NAME)
      .select('*')
      .eq('is_active', true)
      // Inside `.or()` the documented ilike wildcard is `*` (PostgREST maps it
      // to SQL `%`), unlike the standalone `.ilike()` helper which takes `%`.
      .or(`page_slug.eq.${slug},slug_pattern.ilike.${firstSegment}/*`);

    if (error) {
      this.logger.error('[SupabaseSeo] Error fetching page by slug:', error.message);
      return null;
    }

    const rows = (data ?? []) as SeoPage[];

    // Concrete match wins; the `.or()` may also have returned pattern rows.
    const concrete = rows.find((row) => row.page_slug === slug);
    if (concrete) return concrete;

    // Otherwise, the first row whose pattern structurally matches the URL.
    for (const row of rows) {
      if (row.slug_pattern && matchesSlugPattern(slug, row.slug_pattern)) {
        return row;
      }
    }
    return null;
  }
}

/**
 * Structural match between a URL slug and a stored pattern. `:`-prefixed
 * segments wildcard one segment each; literal segments must match exactly.
 *   matchesSlugPattern('podcast/190/intro', 'podcast/:id/:title') === true
 *   matchesSlugPattern('podcast/190',       'podcast/:id/:title') === false
 *   matchesSlugPattern('podcast/190/intro', 'masterclass/:id/:title') === false
 */
export function matchesSlugPattern(slug: string, pattern: string): boolean {
  const slugParts = slug.split('/').filter((s) => s);
  const patternParts = pattern.split('/').filter((s) => s);
  if (slugParts.length !== patternParts.length) return false;
  for (let i = 0; i < slugParts.length; i++) {
    const p = patternParts[i];
    if (p.startsWith(':')) continue;
    if (p !== slugParts[i]) return false;
  }
  return true;
}
