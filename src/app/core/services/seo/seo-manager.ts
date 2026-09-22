import { isPlatformServer } from '@angular/common';
import {
  DOCUMENT,
  inject,
  Injectable,
  makeStateKey,
  PLATFORM_ID,
  TransferState,
  type StateKey,
} from '@angular/core';
import { Meta, MetaDefinition, Title } from '@angular/platform-browser';
import { SeoConfig, SeoPage, seoPageToConfig } from '../../models/seo.models';
import { SupabaseSeo } from './supabase-seo';

/** Stable element ids/marker so we always target the SeoManager-owned nodes. */
const JSON_LD_ID = 'seo-jsonld';
const CANONICAL_REL = 'canonical';

/**
 * Supabase fetch budget. Browser stays tight so the user doesn't see a
 * lingering pre-row paint; server gets more headroom because the SSR render is
 * a one-shot — a missed row there is a missed crawler impression. 4.5s sits
 * well below Vercel's 10s SSR ceiling.
 */
const TIMEOUT_BROWSER_MS = 1500;
const TIMEOUT_SERVER_MS = 4500;

type ManagedTagSelector =
  { name: string; property?: undefined } | { property: string; name?: undefined };

/** Result of `loadFromSupabase`. Lets callers tell apart row-found vs fallback vs failure. */
export type SeoLoadStatus = 'row' | 'fallback' | 'failed';

@Injectable({ providedIn: 'root' })
export class SeoManager {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly supabaseSeo = inject(SupabaseSeo);
  private readonly transferState = inject(TransferState);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));

  private seoStateKey(slug: string): StateKey<SeoPage | null> {
    return makeStateKey<SeoPage | null>(`seo:${slug}`);
  }

  /**
   * Selectors for tags written by the previous `setSeo` call. We remove these
   * before applying the new set so route changes don't leak metadata between
   * pages (e.g. an `og:video` from page A persisting on page B).
   */
  private previousTags: ManagedTagSelector[] = [];

  /**
   * In-flight Supabase load controller. Aborted (and replaced) on every new
   * `loadFromSupabase` call so a slow earlier response can't clobber the tags
   * written by a later one (rapid A→B→A navigation).
   */
  private currentLoadController: AbortController | null = null;

  /**
   * Resolved SEO rows keyed by slug, memoized for the lifetime of this
   * instance. On the browser the instance lives for the whole SPA session, so
   * repeat visits to a slug never re-hit Supabase; on the server each SSR
   * render gets a fresh instance, so there's no cross-request leakage.
   *
   * A `null` value (no usable row) is cached too — that's the normal outcome
   * for a course page with no admin row, and caching it is what lets the
   * course page's two-phase setup avoid a second fetch. Trade-off: a transient
   * read error (which `getBySlug` also surfaces as `null`) is remembered as
   * "no custom row" until a full reload — acceptable since the fallback meta is
   * complete and SSR (the crawler-facing path) is unaffected. Bounded by
   * `ROW_MEMO_CAP`.
   */
  private readonly rowMemo = new Map<string, SeoPage | null>();
  private static readonly ROW_MEMO_CAP = 24;

  /**
   * In-flight Supabase fetches keyed by slug. Lets two near-simultaneous loads
   * of the same slug (the course page's URL-fallback then course-fallback
   * phases) share ONE network request instead of racing two.
   */
  private readonly inflightRows = new Map<string, Promise<SeoPage | null>>();

  setSeo(config: SeoConfig): void {
    // Wipe everything written by the previous call before applying the new
    // set. Anything not present in `config` is correctly removed.
    this.removePreviousTags();
    const tagsApplied: ManagedTagSelector[] = [];

    // 1. Title
    this.titleService.setTitle(config.title);

    // 2. Standard meta
    for (const tag of this.buildStandardTags(config)) {
      this.metaService.updateTag(tag);
      tagsApplied.push(this.toSelector(tag));
    }

    // 3. Open Graph (always emit a baseline so social embeds have something).
    for (const tag of this.buildOpenGraphTags(config)) {
      this.metaService.updateTag(tag);
      tagsApplied.push(this.toSelector(tag));
    }

    // 4. Twitter card
    for (const tag of this.buildTwitterTags(config)) {
      this.metaService.updateTag(tag);
      tagsApplied.push(this.toSelector(tag));
    }

    // 5. Canonical link / JSON-LD: managed via dedicated DOM nodes that we
    // either update in place or remove when no longer applicable.
    this.setCanonicalUrl(config.canonicalUrl);
    this.setJsonLd(config.jsonLd);

    this.previousTags = tagsApplied;
  }

  /**
   * Reset everything `setSeo` may have written. Useful in `ngOnDestroy` for
   * leaf pages so navigating away doesn't leave their tags lingering until
   * the next page's `setSeo`.
   */
  reset(): void {
    this.removePreviousTags();
    this.removeCanonical();
    this.removeJsonLd();
  }

  /**
   * Load SEO config from Supabase for a given slug. The `signal` lets callers
   * (and SSR) abort the request if it takes too long; the returned status
   * disambiguates row-hit vs fallback vs failure.
   *
   * Concurrency: on every call we abort and replace the previous in-flight
   * controller. After the await, we check `controller.signal.aborted` before
   * applying tags so a stale earlier response can't overwrite the tags
   * written by the call that superseded it.
   *
   * SSR hydration: on the server, a successful row is written to
   * `TransferState`; on the browser, `loadFromSupabase` first consumes any
   * cached entry (one-shot) and skips the network call entirely. Avoids the
   * double-fetch + post-hydration tag flicker that `withHttpTransferCacheOptions`
   * doesn't cover (Supabase JS uses native `fetch`, not Angular's HttpClient).
   */
  async loadFromSupabase(
    slug: string,
    fallback?: SeoConfig,
    options: { signal?: AbortSignal; timeoutMs?: number } = {},
  ): Promise<SeoLoadStatus> {
    const stateKey = this.seoStateKey(slug);

    // Browser: drain the SSR-transferred row first so we don't refetch.
    if (!this.isServer && this.transferState.hasKey(stateKey)) {
      const cached = this.transferState.get(stateKey, null);
      this.transferState.remove(stateKey);
      // Seed the memo from the SSR handoff so a follow-up load of this slug
      // (e.g. the course-fallback phase) is served without a network call.
      this.rememberRow(slug, cached);
      if (cached) {
        this.applyRowConfig(seoPageToConfig(cached), fallback);
        return 'row';
      }
      // Cached null means the server confirmed "no row" — apply fallback
      // without re-issuing the network call.
      if (fallback) {
        this.setSeo(fallback);
        return 'fallback';
      }
      return 'failed';
    }

    const timeoutMs = options.timeoutMs ?? (this.isServer ? TIMEOUT_SERVER_MS : TIMEOUT_BROWSER_MS);

    // Abort any prior in-flight call and own a fresh controller.
    this.currentLoadController?.abort();
    const controller = new AbortController();
    this.currentLoadController = controller;
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else
        options.signal.addEventListener('abort', () => controller.abort(), {
          once: true,
        });
    }

    try {
      // `getRowSingleFlight` dedupes concurrent + repeat loads of the SAME
      // slug to one Supabase fetch and memoizes the result, so the course
      // page's two-phase SEO setup (URL fallback → course fallback) costs a
      // single network read instead of one per phase. It also normalizes a
      // blank-title row to `null` ("not yet filled in") so callers prefer
      // their fallback over clobbering `index.html` with empty meta.
      const usableRow = await this.withTimeout(
        this.getRowSingleFlight(slug),
        timeoutMs,
        controller.signal,
      );
      // A newer load superseded us — skip writing stale tags.
      if (controller.signal.aborted) return 'failed';
      if (this.isServer) this.transferState.set(stateKey, usableRow);
      if (usableRow) {
        this.applyRowConfig(seoPageToConfig(usableRow), fallback);
        return 'row';
      }
      if (fallback) {
        this.setSeo(fallback);
        return 'fallback';
      }
      return 'failed';
    } catch {
      if (controller.signal.aborted) return 'failed';
      if (fallback) {
        this.setSeo(fallback);
        return 'fallback';
      }
      return 'failed';
    } finally {
      // Only clear if this call still owns the slot — a newer call may have
      // replaced us already.
      if (this.currentLoadController === controller) {
        this.currentLoadController = null;
      }
    }
  }

  /**
   * Fetch the (title-usable) SEO row for `slug` exactly once: served from the
   * memo on a repeat call, shared with any in-flight fetch for the same slug,
   * otherwise fetched fresh. Decoupled from tag application so each caller can
   * still apply its own fallback against the shared result. A blank-title row
   * is normalized to `null` so callers fall back rather than render empty meta.
   *
   * The underlying `getBySlug` is intentionally NOT passed the caller's abort
   * signal: an aborted/superseded caller gives up waiting (via `withTimeout`)
   * but the shared fetch runs to completion so a concurrent caller still
   * benefits — matching the pre-existing behavior where abort never cancelled
   * the Supabase request.
   */
  private getRowSingleFlight(slug: string): Promise<SeoPage | null> {
    if (this.rowMemo.has(slug)) {
      return Promise.resolve(this.rowMemo.get(slug) ?? null);
    }
    const existing = this.inflightRows.get(slug);
    if (existing) return existing;

    const pending = this.supabaseSeo
      .getBySlug(slug)
      .then((page) => {
        const usableRow = page && page.title?.trim() ? page : null;
        this.rememberRow(slug, usableRow);
        return usableRow;
      })
      .finally(() => this.inflightRows.delete(slug));

    this.inflightRows.set(slug, pending);
    return pending;
  }

  /** Memoize a resolved row, evicting the oldest entry once past the cap. */
  private rememberRow(slug: string, row: SeoPage | null): void {
    this.rowMemo.set(slug, row);
    if (this.rowMemo.size > SeoManager.ROW_MEMO_CAP) {
      const oldest = this.rowMemo.keys().next().value;
      if (oldest !== undefined) this.rowMemo.delete(oldest);
    }
  }

  /**
   * Apply a Supabase-row-derived config, backfilling the self-referencing
   * canonical, the matching `og:url`, and the site-wide JSON-LD from the
   * route's fallback whenever the admin row left those blank. An SEO row that
   * only customizes title/description therefore still keeps a canonical tag and
   * structured data, instead of `setSeo` stripping them (empty → removed).
   * An explicit value in the row always wins.
   */
  private applyRowConfig(rowConfig: SeoConfig, fallback?: SeoConfig): void {
    const merged: SeoConfig = { ...rowConfig };

    if (!merged.canonicalUrl && fallback?.canonicalUrl) {
      merged.canonicalUrl = fallback.canonicalUrl;
    }

    const ogUrl = merged.openGraph?.url || fallback?.openGraph?.url || merged.canonicalUrl;
    if (ogUrl) {
      merged.openGraph = { ...merged.openGraph, url: ogUrl };
    }

    if (!merged.jsonLd && fallback?.jsonLd) {
      merged.jsonLd = fallback.jsonLd;
    }

    this.setSeo(merged);
  }

  updateTitle(title: string): void {
    this.titleService.setTitle(title);
  }

  updateMeta(name: string, content: string): void {
    this.metaService.updateTag({ name, content });
  }

  // ----- Tag builders --------------------------------------------------------

  private buildStandardTags(config: SeoConfig): MetaDefinition[] {
    const tags: MetaDefinition[] = [];
    if (config.description) tags.push({ name: 'description', content: config.description });
    if (config.keywords?.length) {
      tags.push({ name: 'keywords', content: config.keywords.join(', ') });
    }
    tags.push({ name: 'robots', content: config.robots ?? 'index, follow' });
    if (config.author) tags.push({ name: 'author', content: config.author });
    if (config.publisher) tags.push({ name: 'publisher', content: config.publisher });
    return tags;
  }

  private buildOpenGraphTags(config: SeoConfig): MetaDefinition[] {
    const og = config.openGraph ?? {};
    const title = og.title || config.title;
    const description = og.description || config.description;
    const image = og.image || config.image;
    const url = og.url || config.canonicalUrl;

    const tags: MetaDefinition[] = [
      { property: 'og:title', content: title },
      { property: 'og:type', content: og.type ?? 'website' },
    ];
    if (description) tags.push({ property: 'og:description', content: description });
    if (image) tags.push({ property: 'og:image', content: image });
    if (og.video) tags.push({ property: 'og:video', content: og.video });
    if (url) tags.push({ property: 'og:url', content: url });
    if (og.site_name) tags.push({ property: 'og:site_name', content: og.site_name });
    if (og.locale) tags.push({ property: 'og:locale', content: og.locale });
    return tags;
  }

  private buildTwitterTags(config: SeoConfig): MetaDefinition[] {
    const tw = config.twitter ?? {};
    const title = tw.title || config.title;
    const description = tw.description || config.description;
    const image = tw.image || config.image;

    const tags: MetaDefinition[] = [
      { name: 'twitter:card', content: tw.card ?? 'summary_large_image' },
      { name: 'twitter:title', content: title },
    ];
    if (description) tags.push({ name: 'twitter:description', content: description });
    if (image) {
      tags.push({ name: 'twitter:image', content: image });
      if (tw.imageAlt) tags.push({ name: 'twitter:image:alt', content: tw.imageAlt });
    }
    if (tw.site) tags.push({ name: 'twitter:site', content: tw.site });
    if (tw.creator) tags.push({ name: 'twitter:creator', content: tw.creator });
    return tags;
  }

  // ----- DOM helpers ---------------------------------------------------------

  /**
   * Remove tags written by the previous `setSeo` call. Nodes carrying
   * `data-seo-default` (anchored in `index.html`) are preserved as a floor —
   * `Meta.updateTag` may have updated their `content` in place; we only want
   * to remove the *new* nodes we created, not the flagged defaults.
   */
  private removePreviousTags(): void {
    const head = this.document.head;
    if (!head) {
      this.previousTags = [];
      return;
    }
    for (const sel of this.previousTags) {
      const nodes = head.querySelectorAll(`meta[${this.selectorString(sel)}]`);
      nodes.forEach((node) => {
        if ((node as HTMLElement).hasAttribute('data-seo-default')) return;
        node.parentNode?.removeChild(node);
      });
    }
    this.previousTags = [];
  }

  private toSelector(tag: MetaDefinition): ManagedTagSelector {
    if (tag.property) return { property: tag.property };
    if (tag.name) return { name: tag.name };
    // Should be unreachable for the tags we build; fall back to name=''.
    return { name: '' };
  }

  private selectorString(sel: ManagedTagSelector): string {
    return sel.property ? `property="${sel.property}"` : `name="${sel.name}"`;
  }

  private setCanonicalUrl(url: string | undefined): void {
    if (!url) {
      this.removeCanonical();
      return;
    }
    let link: HTMLLinkElement | null = this.document.querySelector(`link[rel='${CANONICAL_REL}']`);
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', CANONICAL_REL);
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private removeCanonical(): void {
    const link = this.document.querySelector(`link[rel='${CANONICAL_REL}']`);
    if (!link || (link as HTMLElement).hasAttribute('data-seo-default')) return;
    link.parentNode?.removeChild(link);
  }

  private setJsonLd(data: Record<string, unknown> | undefined): void {
    if (!data || Object.keys(data).length === 0) {
      this.removeJsonLd();
      return;
    }
    let script = this.document.getElementById(JSON_LD_ID) as HTMLScriptElement | null;
    if (!script) {
      script = this.document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute('id', JSON_LD_ID);
      this.document.head.appendChild(script);
    }
    // Escape `<` so an admin-supplied string containing `</script>` cannot
    // break out of the JSON-LD block. Crawlers parse the JSON, where the
    // `<` sequence decodes back to `<`.
    script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
  }

  private removeJsonLd(): void {
    const script = this.document.getElementById(JSON_LD_ID);
    script?.parentNode?.removeChild(script);
  }

  /**
   * Race a promise against a timeout (and an optional caller-provided
   * `AbortSignal`) so SSR can't block indefinitely on Supabase.
   */
  private withTimeout<T>(p: Promise<T>, timeoutMs: number, abortSignal?: AbortSignal): Promise<T> {
    if (abortSignal?.aborted) return Promise.reject(new Error('aborted'));
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      };
      const timer = setTimeout(() => {
        abortSignal?.removeEventListener('abort', onAbort);
        reject(new Error(`SeoManager.loadFromSupabase timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      abortSignal?.addEventListener('abort', onAbort, { once: true });
      p.then(
        (v) => {
          clearTimeout(timer);
          abortSignal?.removeEventListener('abort', onAbort);
          resolve(v);
        },
        (err) => {
          clearTimeout(timer);
          abortSignal?.removeEventListener('abort', onAbort);
          reject(err);
        },
      );
    });
  }
}
