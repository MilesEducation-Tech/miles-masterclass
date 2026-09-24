import { Service, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { Supabase } from '@core/services/supabase/supabase';
import { AuditLog } from './audit-log';
import { Logger } from '@core/services/logger/logger';
import {
  AdminProfileResponse,
  AdminRoleRecord,
  AdminRoleSlug,
  AdminSignInResult,
  AdminUserProfile,
} from '../models/admin-auth.model';

@Service()
export class AdminAuth {
  private readonly supabase = inject(Supabase);
  private readonly logger = inject(Logger);
  private readonly audit = inject(AuditLog);
  private readonly platformId = inject(PLATFORM_ID);

  // ---- writable state ----
  readonly session = signal<Session | null>(null);
  readonly adminUser = signal<AdminUserProfile | null>(null);
  /** Every role held (super_admin first, then by slug). Permissions are the union. */
  readonly roles = signal<readonly AdminRoleRecord[]>([]);
  readonly permissions = signal<ReadonlySet<string>>(new Set<string>());
  readonly emailDomains = signal<readonly string[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // ---- derived ----
  readonly isAuthenticated = computed(() => !!this.session() && !!this.adminUser());
  readonly roleSlugs = computed<readonly AdminRoleSlug[]>(() => this.roles().map((r) => r.slug));
  readonly isSuperAdmin = computed(() => this.roleSlugs().includes('super_admin'));

  private initPromise: Promise<void> | null = null;

  /**
   * Idempotent. Wires Supabase auth listener and hydrates from any stored
   * session. Browser-only — on the server it resolves immediately so SSR
   * never touches localStorage.
   */
  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.bootstrap();
    return this.initPromise;
  }

  private async bootstrap(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const client = await this.supabase.getClient();

    const {
      data: { session },
    } = await client.auth.getSession();
    this.session.set(session);

    if (session) {
      // Enforce on load too, not just on live auth events — otherwise a disabled
      // (or de-admined) user who simply reloads keeps a usable session. Only
      // enforce when the profile fetch succeeded, so a transient RPC failure on
      // boot doesn't sign out a valid admin.
      const fetched = await this.refreshProfile();
      if (fetched) await this.enforceAdminSession();
    }

    client.auth.onAuthStateChange((event: AuthChangeEvent, newSession) => {
      this.handleAuthChange(event, newSession);
    });
  }

  private async handleAuthChange(
    event: AuthChangeEvent,
    newSession: Session | null,
  ): Promise<void> {
    this.session.set(newSession);

    if (event === 'SIGNED_OUT' || !newSession) {
      this.clearProfile();
      return;
    }

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      const fetched = await this.refreshProfile();
      // Only enforce when the profile fetch actually succeeded. A transient RPC
      // failure clears the in-memory profile but must NOT sign the user out —
      // otherwise a routine TOKEN_REFRESHED during a network blip would log out
      // a perfectly valid admin. The session survives and recovers next refresh.
      if (fetched) await this.enforceAdminSession();
    }
  }

  /**
   * Reject a Supabase session that isn't a valid, active admin. The password
   * sign-in path does this inline, but magic-link / recovery sessions arrive
   * via onAuthStateChange — enforcing here covers every session source. Only
   * called after a SUCCESSFUL profile fetch, so a null adminUser here means the
   * account genuinely isn't an admin (not a failed lookup).
   * Leaves PASSWORD_RECOVERY alone: the reset page needs that session to set a
   * new password before the user has any admin row yet.
   */
  private async enforceAdminSession(): Promise<void> {
    if (!this.session()) return;
    const user = this.adminUser();
    if (!user) {
      await this.signOut('rejected_not_admin');
      this.error.set('This account is not configured for admin access.');
      return;
    }
    if (!user.is_active) {
      await this.signOut('rejected_inactive');
      this.error.set('Your admin account is disabled. Contact a super admin.');
    }
  }

  /**
   * Sign in with email + password. On success, hydrates the admin profile
   * and verifies the user has an active admin_users record.
   */
  async signIn(email: string, password: string): Promise<AdminSignInResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return { ok: false, error: 'Sign-in is browser-only.' };
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const client = await this.supabase.getClient();
      const { data, error } = await client.auth.signInWithPassword({ email, password });

      if (error || !data.session) {
        const message = error?.message || 'Sign-in failed. Please try again.';
        this.error.set(message);
        return { ok: false, error: message };
      }

      this.session.set(data.session);
      await this.refreshProfile();

      // Authenticated but not configured as an admin
      if (!this.adminUser()) {
        await this.signOut('rejected_not_admin');
        const message = 'This account is not configured for admin access.';
        this.error.set(message);
        return { ok: false, error: message };
      }

      if (!this.adminUser()?.is_active) {
        await this.signOut('rejected_inactive');
        const message = 'Your admin account is disabled. Contact a super admin.';
        this.error.set(message);
        return { ok: false, error: message };
      }

      // Best-effort: bump last_login_at
      try {
        await client.rpc('touch_admin_login');
      } catch (rpcErr) {
        this.logger.warn('[AdminAuth] touch_admin_login failed (non-blocking):', rpcErr);
      }

      void this.audit.record('auth', 'sign_in', { context: { method: 'password' } });

      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-in failed.';
      this.logger.error('[AdminAuth] signIn error:', message);
      this.error.set(message);
      return { ok: false, error: message };
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * `reason` separates a deliberate log-out from the forced ones this service
   * performs when a Supabase session turns out not to belong to an active
   * admin — without it the audit log would show those as ordinary sign-outs.
   */
  async signOut(reason = 'user_initiated'): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    // AWAITED, unlike every other audit call. log_admin_activity() derives the
    // actor from auth.uid(), so a row that lands after the session is destroyed
    // has no actor and is dropped — sign-out would be the one event missing
    // from the log. The promise never rejects, so this cannot block sign-out.
    await this.audit.record('auth', 'sign_out', { context: { reason } });

    try {
      const client = await this.supabase.getClient();
      await client.auth.signOut();
    } catch (err) {
      this.logger.warn('[AdminAuth] signOut error (clearing local state anyway):', err);
    }

    // Sweep any legacy admin auth flag from the previous hardcoded-password flow.
    try {
      sessionStorage.removeItem('ADMIN_AUTHENTICATED');
    } catch {
      // ignore — non-browser or storage unavailable
    }

    this.session.set(null);
    this.clearProfile();
  }

  /**
   * Re-fetch admin profile via the get_my_admin_profile() RPC. The RPC
   * returns the user, their role, and the full permission set in one call.
   *
   * Returns `true` only when the fetch completed and the profile reflects
   * authoritative data — so callers can distinguish "fetched, not an admin"
   * (return true, adminUser null) from "fetch failed" (return false). On
   * failure the profile is cleared but the session is left intact to recover.
   */
  async refreshProfile(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) return false;
    if (!this.session()) {
      this.clearProfile();
      return false;
    }

    try {
      const client = await this.supabase.getClient();
      const { data, error } = await client.rpc('get_my_admin_profile');

      if (error) {
        this.logger.error('[AdminAuth] refreshProfile RPC error:', error.message);
        this.clearProfile();
        return false;
      }

      const profile = data as AdminProfileResponse | null;
      this.adminUser.set(profile?.user ?? null);
      // Older RPC builds return only `role`; tolerate both shapes mid-deploy.
      this.roles.set(profile?.roles ?? (profile?.role ? [profile.role] : []));
      this.permissions.set(new Set(profile?.permissions ?? []));
      this.emailDomains.set(profile?.email_domains ?? []);
      return true;
    } catch (err) {
      this.logger.error('[AdminAuth] refreshProfile error:', err);
      this.clearProfile();
      return false;
    }
  }

  hasPermission(key: string): boolean {
    if (this.isSuperAdmin()) return true;
    return this.permissions().has(key);
  }

  hasAny(...keys: string[]): boolean {
    if (this.isSuperAdmin()) return true;
    if (keys.length === 0) return true;
    const perms = this.permissions();
    return keys.some((k) => perms.has(k));
  }

  hasAll(...keys: string[]): boolean {
    if (this.isSuperAdmin()) return true;
    const perms = this.permissions();
    return keys.every((k) => perms.has(k));
  }

  /**
   * Email a password-reset link. The link lands on /admin/reset-password where
   * the recovery session lets the user set a new password.
   */
  async sendPasswordReset(email: string): Promise<AdminSignInResult> {
    return this.runAuthAction(async (client) => {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
      return error?.message ?? null;
    });
  }

  /**
   * Email a passwordless magic link. `shouldCreateUser: false` so only existing
   * Supabase users get one — never silently provisions a brand-new login.
   */
  async sendMagicLink(email: string): Promise<AdminSignInResult> {
    return this.runAuthAction(async (client) => {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/admin/login`,
        },
      });
      return error?.message ?? null;
    });
  }

  /** Set a new password for the recovery session opened by the reset link. */
  async updatePassword(newPassword: string): Promise<AdminSignInResult> {
    return this.runAuthAction(async (client) => {
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (!error) void this.audit.record('auth', 'password_change');
      return error?.message ?? null;
    });
  }

  /**
   * Shared wrapper for the email-link auth actions: browser guard, isLoading /
   * error bookkeeping mirroring signIn(). `action` returns an error message or
   * null on success.
   */
  private async runAuthAction(
    action: (client: Awaited<ReturnType<Supabase['getClient']>>) => Promise<string | null>,
  ): Promise<AdminSignInResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return { ok: false, error: 'This action is browser-only.' };
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const client = await this.supabase.getClient();
      const message = await action(client);
      if (message) {
        this.error.set(message);
        return { ok: false, error: message };
      }
      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      this.logger.error('[AdminAuth] auth action error:', message);
      this.error.set(message);
      return { ok: false, error: message };
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Returns the current Supabase access token, or null if not signed in. */
  getAccessToken(): string | null {
    return this.session()?.access_token ?? null;
  }

  private clearProfile(): void {
    this.adminUser.set(null);
    this.roles.set([]);
    this.permissions.set(new Set<string>());
    this.emailDomains.set([]);
  }
}
