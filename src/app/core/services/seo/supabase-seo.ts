import { inject, Injectable } from '@angular/core';
import { DEFAULT_SEO_PAGES } from '../../models/seo.constants';
import { createDefaultSeoPage, SeoPage } from '../../models/seo.models';
import { generateUUID } from '@shared/utils/uuid';
import { Logger } from '../logger/logger';
import { Supabase } from '../supabase/supabase';

const TABLE_NAME = 'seo_pages';
const STORAGE_BUCKET = 'seo-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
// SVG intentionally excluded — it can carry inline `<script>` and would
// execute when fetched and rendered inline from the public bucket.
const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif']);

@Injectable({ providedIn: 'root' })
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
        this.logger.warn(
          '[SupabaseSeo] Supabase client unavailable; SEO read/write/upload will no-op.',
          err,
        );
      }
      return null;
    }
  }

  /** Fetch all SEO pages, ordered by page_name. */
  async getAll(): Promise<SeoPage[]> {
    const client = await this.getClientSafe();
    if (!client) return [];

    const { data, error } = await client
      .from(TABLE_NAME)
      .select('*')
      .order('page_name', { ascending: true });

    if (error) {
      this.logger.error('[SupabaseSeo] Error fetching pages:', error.message);
      return [];
    }
    return (data as SeoPage[]) ?? [];
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

  /**
   * Create or update a page's SEO configuration. Strips `id` from the payload:
   * with `onConflict: 'page_slug'` the row is matched by slug and the existing
   * id is preserved. Including a stale id from the caller risks a PK conflict
   * on inserts.
   */
  async upsert(page: SeoPage): Promise<SeoPage | null> {
    const client = await this.getClientSafe();
    if (!client) return null;

    // Drop `id` from the payload: with onConflict='page_slug' the existing
    // row is matched by slug, and including a stale id risks a PK conflict
    // on inserts. Supabase preserves/auto-generates the id on its side.
    const payload: Omit<SeoPage, 'id'> & { updated_at: string } = (() => {
      const copy = { ...page, updated_at: new Date().toISOString() };
      delete (copy as Partial<SeoPage>).id;
      return copy as Omit<SeoPage, 'id'> & { updated_at: string };
    })();

    const { data, error } = await client
      .from(TABLE_NAME)
      .upsert(payload, { onConflict: 'page_slug' })
      .select()
      .single();

    if (error) {
      this.logger.error('[SupabaseSeo] Error upserting page:', error.message);
      return null;
    }
    return data as SeoPage;
  }

  /**
   * Batch create/update SEO pages, matched by `page_slug`. Mirrors `upsert`'s
   * id-strip + `updated_at` stamp + `onConflict` so overwriting existing slugs
   * behaves identically to a single-page save, in one round trip.
   * Returns the saved rows, or `null` on failure.
   */
  async bulkUpsert(pages: SeoPage[]): Promise<SeoPage[] | null> {
    const client = await this.getClientSafe();
    if (!client) return null;

    const now = new Date().toISOString();
    const payload = pages.map((page) => {
      const copy = { ...page, updated_at: now };
      delete (copy as Partial<SeoPage>).id;
      return copy as Omit<SeoPage, 'id'> & { updated_at: string };
    });

    const { data, error } = await client
      .from(TABLE_NAME)
      .upsert(payload, { onConflict: 'page_slug' })
      .select();

    if (error) {
      this.logger.error('[SupabaseSeo] Error bulk upserting pages:', error.message);
      return null;
    }
    return (data as SeoPage[]) ?? [];
  }

  /** Delete a page's SEO configuration by ID. */
  async deleteById(id: string): Promise<boolean> {
    const client = await this.getClientSafe();
    if (!client) return false;

    const { error } = await client.from(TABLE_NAME).delete().eq('id', id);

    if (error) {
      this.logger.error('[SupabaseSeo] Error deleting page:', error.message);
      return false;
    }
    return true;
  }

  /**
   * Seed default pages into Supabase if the table is empty. The check-then-
   * insert here is a TOCTOU race in theory; in practice this is admin-only
   * and the unique constraint on `page_slug` catches double-inserts.
   * Returns the seeded pages, an empty array if already seeded, or null on
   * failure.
   */
  async seedDefaults(): Promise<SeoPage[] | null> {
    const client = await this.getClientSafe();
    if (!client) return null;

    const existing = await this.getAll();
    if (existing.length > 0) return [];

    const pages = DEFAULT_SEO_PAGES.map((p) => createDefaultSeoPage(p.slug, p.name, p.type));

    const { data, error } = await client.from(TABLE_NAME).insert(pages).select();
    if (error) {
      this.logger.error('[SupabaseSeo] Error seeding defaults:', error.message);
      return null;
    }
    return data as SeoPage[];
  }

  /**
   * Upload an image to the SEO storage bucket. Validates type/size on the
   * client and uses a UUID-based filename so collisions are effectively
   * impossible. Returns the public URL on success.
   */
  async uploadImage(file: File): Promise<string | null> {
    const client = await this.getClientSafe();
    if (!client) return null;

    if (!file.type.startsWith('image/')) {
      this.logger.warn(`[SupabaseSeo] Rejected non-image upload: ${file.type}`);
      return null;
    }
    // SVG is XSS-prone — block by MIME and by extension so a renamed file
    // can't sneak through the bucket.
    if (file.type === 'image/svg+xml') {
      this.logger.warn('[SupabaseSeo] Rejected SVG upload — SVG can carry inline scripts.');
      return null;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.logger.warn(
        `[SupabaseSeo] Rejected oversized upload (${file.size} > ${MAX_IMAGE_BYTES} bytes).`,
      );
      return null;
    }

    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      this.logger.warn(`[SupabaseSeo] Rejected upload with disallowed extension: .${ext}`);
      return null;
    }
    const filePath = `seo/${generateUUID()}.${ext}`;

    const { error } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, { upsert: false, contentType: file.type });

    if (error) {
      this.logger.error('[SupabaseSeo] Error uploading image:', error.message);
      return null;
    }

    const { data: publicUrlData } = client.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
    return publicUrlData.publicUrl;
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
