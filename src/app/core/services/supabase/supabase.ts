import { Service } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { environment } from '@env/environment';

@Service()
export class Supabase {
  private client: SupabaseClient | null = null;
  private clientPromise: Promise<SupabaseClient> | null = null;

  /**
   * Returns the Supabase client. It is stateless on both platforms: nothing
   * signs in to Supabase (the app only reads `seo_pages` anonymously), so it
   * never persists or refreshes a session and never touches localStorage.
   *
   * `@supabase/supabase-js` is ~150 kB; importing it eagerly from a
   * `providedIn: 'root'` service pulls the whole thing into the initial
   * bundle. The dynamic `import()` below keeps it in its own lazy chunk so
   * users who never touch a Supabase-backed feature (SEO loads)
   * never pay for it. The promise is memoised so repeat callers share one
   * resolution and one client instance.
   *
   * Angular SSR creates **separate injectors** for the server and the
   * browser, so the `client` field is per-platform.
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

    this.clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
      this.client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      return this.client;
    });

    return this.clientPromise;
  }
}
