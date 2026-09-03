import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../../../environments/environment';

const ADMIN_STORAGE_KEY = environment.SUPABASE.SupabaseUser;

@Injectable({
  providedIn: 'root',
})
export class Supabase {
  private client: SupabaseClient | null = null;
  private clientPromise: Promise<SupabaseClient> | null = null;
  private readonly platformId = inject(PLATFORM_ID);

  /**
   * Returns the per-platform Supabase client. The client persists the admin
   * auth session in localStorage on the browser and is stateless on the
   * server (so SSR doesn't try to touch localStorage).
   *
   * `@supabase/supabase-js` is ~150 kB; importing it eagerly from a
   * `providedIn: 'root'` service pulls the whole thing into the initial
   * bundle. The dynamic `import()` below keeps it in its own lazy chunk so
   * users who never touch a Supabase-backed feature (SEO loads, admin auth)
   * never pay for it. The promise is memoised so repeat callers share one
   * resolution and one client instance.
   *
   * Important: Angular SSR creates **separate injectors** for the server and
   * the browser, so the `client` field is effectively per-platform — the
   * `isBrowser` snapshot taken at construction time is correct for that
   * injector's lifetime. If we ever provided this service in a shared
   * injector the snapshot would become a footgun.
   */
  async getClient(): Promise<SupabaseClient> {
    if (this.client) return this.client;
    if (this.clientPromise) return this.clientPromise;

    const url = environment.SUPABASE?.url;
    const key = environment.SUPABASE?.anonKey;

    if (!url || !key || url === 'YOUR_SUPABASE_PROJECT_URL') {
      throw new Error(
        '[Supabase] Not configured. Set SUPABASE.url and SUPABASE.anonKey in your environment file.',
      );
    }

    const isBrowser = isPlatformBrowser(this.platformId);

    this.clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
      this.client = createClient(url, key, {
        auth: {
          persistSession: isBrowser,
          autoRefreshToken: isBrowser,
          detectSessionInUrl: isBrowser,
          storageKey: ADMIN_STORAGE_KEY,
        },
      });
      return this.client;
    });

    return this.clientPromise;
  }
}
