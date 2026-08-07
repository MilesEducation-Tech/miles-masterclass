import { inject, PLATFORM_ID, Service } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../../../environments/environment';

/**
 * Anonymous-only Supabase client for **public** surfaces (enquiry form, lead
 * capture, anything submitted by an unauthenticated visitor).
 *
 * Why this is separate from `Supabase` (the admin client):
 *
 * The admin client persists its session in localStorage so the admin panel
 * can stay signed in across reloads. The Supabase JS client, once it has a
 * persisted session, sends the **session's JWT** as `Authorization: Bearer`
 * for every request — *including* requests that conceptually have nothing to
 * do with that user (e.g. a public contact form submission). If the same
 * client backed both flows, the enquiry form would silently submit as the
 * logged-in admin (or with a stale token), which:
 *   1. Breaks RLS — policies written `to anon` won't match.
 *   2. Leaks identity — every lead row gets stamped with the admin's auth
 *      context (`auth.uid()`) instead of being truly anonymous.
 *
 * This client opts out of all session machinery:
 *   - `persistSession: false`    → never touches localStorage.
 *   - `autoRefreshToken: false`  → no token refresh loop.
 *   - `detectSessionInUrl: false`→ ignores `?access_token=` hashes.
 *
 * Net effect: every request goes out with the anon key in *both* `apikey`
 * and `Authorization: Bearer` headers, and Postgres sees role = `anon`.
 */
@Service()
export class SupabasePublic {
  private client: SupabaseClient | null = null;
  private clientPromise: Promise<SupabaseClient> | null = null;
  private readonly platformId = inject(PLATFORM_ID);

  /**
   * `@supabase/supabase-js` is loaded via dynamic import so it ships in its
   * own lazy chunk — the home/auth/landing flows that never submit an
   * enquiry don't pay for the ~150 kB client in the initial bundle.
   */
  async getClient(): Promise<SupabaseClient> {
    if (this.client) return this.client;
    if (this.clientPromise) return this.clientPromise;

    const url = environment.SUPABASE?.url;
    const key = environment.SUPABASE?.anonKey;

    if (!url || !key || url === 'YOUR_SUPABASE_PROJECT_URL') {
      throw new Error(
        '[SupabasePublic] Not configured. Set SUPABASE.url and SUPABASE.anonKey in your environment file.',
      );
    }

    // Stateless on every platform — the snapshot is just here to mirror the
    // shape of the admin client for consistency.
    isPlatformBrowser(this.platformId);

    this.clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
      this.client = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      return this.client;
    });

    return this.clientPromise;
  }
}
