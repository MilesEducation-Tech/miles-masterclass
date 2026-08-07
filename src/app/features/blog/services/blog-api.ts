import { isPlatformServer } from '@angular/common';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import {
  Injectable,
  PLATFORM_ID,
  TransferState,
  inject,
  makeStateKey,
  type StateKey,
} from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { SKIP_AUTH_TOKEN, SKIP_ERROR_NOTIFICATION } from '../../../shared/core/models/http.model';
import { BlogListQuery, BlogPostsResult, WpCategory, WpPost } from '../models/blog.model';

/**
 * Data access for the headless WordPress blog.
 *
 * - **Browser** calls the same-origin `/blog-api/*` proxy path so there's no
 *   CORS / mixed-content and the `X-WP-Total*` headers stay readable.
 * - **SSR** calls the WordPress HTTPS host directly (no browser constraints),
 *   then stashes the result in `TransferState` so the browser hydrates from
 *   the embedded payload instead of re-fetching (no flash, no double request).
 * - Every request opts out of the Miles auth token and the global error toast
 *   via the shared `HttpContext` flags.
 */
@Injectable({ providedIn: 'root' })
export class BlogApi {
  private readonly http = inject(HttpClient);
  private readonly transferState = inject(TransferState);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));

  private readonly baseUrl = this.isServer
    ? environment.WP_BLOG.apiBaseUrlSsr
    : environment.WP_BLOG.apiBaseUrlBrowser;

  /** Fetch a page of posts (newest first), with embedded media/author/terms. */
  getPosts(query: BlogListQuery = {}): Observable<BlogPostsResult> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 9;
    const key = makeStateKey<BlogPostsResult>(
      `blog:posts:${page}:${perPage}:${query.search ?? ''}:${query.categoryId ?? ''}:${
        query.exclude?.join(',') ?? ''
      }`,
    );

    const cached = this.readTransfer(key);
    if (cached !== undefined) return of(cached);

    let params = new HttpParams()
      .set('page', page)
      .set('per_page', perPage)
      .set('_embed', '1')
      .set('orderby', 'date')
      .set('order', 'desc');
    if (query.search) params = params.set('search', query.search);
    if (query.categoryId) params = params.set('categories', query.categoryId);
    if (query.exclude?.length) params = params.set('exclude', query.exclude.join(','));

    return this.http
      .get<WpPost[]>(`${this.baseUrl}/posts`, {
        params,
        observe: 'response',
        context: this.blogContext(),
      })
      .pipe(
        map((res) => ({
          posts: res.body ?? [],
          total: Number(res.headers.get('X-WP-Total') ?? 0),
          totalPages: Number(res.headers.get('X-WP-TotalPages') ?? 1),
        })),
        tap((result) => this.writeTransfer(key, result)),
      );
  }

  /** Fetch a single published post by its slug, or `null` if none matches. */
  getPostBySlug(slug: string): Observable<WpPost | null> {
    const key = makeStateKey<WpPost | null>(`blog:post:${slug}`);

    const cached = this.readTransfer(key);
    if (cached !== undefined) return of(cached);

    const params = new HttpParams().set('slug', slug).set('_embed', '1');
    return this.http
      .get<WpPost[]>(`${this.baseUrl}/posts`, { params, context: this.blogContext() })
      .pipe(
        map((posts) => posts[0] ?? null),
        tap((post) => this.writeTransfer(key, post)),
      );
  }

  /** Fetch non-empty categories, most-used first (for the filter chips). */
  getCategories(): Observable<WpCategory[]> {
    const key = makeStateKey<WpCategory[]>('blog:categories');

    const cached = this.readTransfer(key);
    if (cached !== undefined) return of(cached);

    const params = new HttpParams()
      .set('per_page', 100)
      .set('hide_empty', 'true')
      .set('orderby', 'count')
      .set('order', 'desc');
    return this.http
      .get<WpCategory[]>(`${this.baseUrl}/categories`, { params, context: this.blogContext() })
      .pipe(tap((categories) => this.writeTransfer(key, categories)));
  }

  /** Skip the Miles auth token + global error toast on these public calls. */
  private blogContext(): HttpContext {
    return new HttpContext().set(SKIP_AUTH_TOKEN, true).set(SKIP_ERROR_NOTIFICATION, true);
  }

  /** Browser reads a server-seeded value exactly once, then drops the key. */
  private readTransfer<T>(key: StateKey<T>): T | undefined {
    if (this.isServer || !this.transferState.hasKey(key)) return undefined;
    // `hasKey` is true here, so the default is never actually used — the cast
    // just satisfies `get`'s `defaultValue: T` signature.
    const value = this.transferState.get(key, undefined as unknown as T);
    this.transferState.remove(key);
    return value;
  }

  /** Server stashes a fetched value for the browser to hydrate from. */
  private writeTransfer<T>(key: StateKey<T>, value: T): void {
    if (this.isServer) this.transferState.set(key, value);
  }
}
