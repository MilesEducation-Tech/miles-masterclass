import { isPlatformBrowser } from '@angular/common';
import { Service, PLATFORM_ID, inject } from '@angular/core';
import type { AuditCategory, AuditDetail } from '../models/audit-log.model';
import { Logger } from '@core/services/logger/logger';
import { Supabase } from '@core/services/supabase/supabase';

/**
 * Client half of the admin audit log — the things Postgres cannot see for
 * itself: Django API calls, page views and auth events. Everything that touches
 * a Supabase table is captured by triggers instead and never comes through
 * here (see supabase/migrations/20260918000000_admin_audit_log.sql).
 *
 * Writes go through the `log_admin_activity` RPC rather than an insert, because
 * the browser must not choose its own identity: the RPC stamps `actor_id` from
 * `auth.uid()`, the timestamp from `now()` and `source` as `'client'`. The app
 * has no INSERT grant on the table at all. So the actor on a client row is
 * trustworthy even though the action description is not — an admin with
 * devtools can withhold a call, they just cannot forge who made it.
 *
 * Strictly fire-and-forget, modelled on `MilesActivity`: `record()` returns
 * void, never blocks the caller, never toasts. A dropped event is logged to the
 * console and forgotten, because an audit write must never break the admin
 * action it is describing.
 *
 * Deliberately depends on nothing but Supabase and Logger. In particular it
 * does NOT inject `AdminAuth` — that would be a dependency cycle (AdminAuth
 * records its own sign-in) and the server is the authority on identity anyway.
 */
@Service()
export class AuditLog {
  private readonly supabase = inject(Supabase);
  private readonly logger = inject(Logger);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Record one admin action. No-ops on the server. When there is no Supabase
   * session the RPC itself discards the call, so an unauthenticated visitor
   * cannot put rows in the log.
   *
   * Returns a promise so the one caller that MUST not race can await it —
   * `AdminAuth.signOut()` has to get the row written before it destroys the
   * session, or the RPC finds no `auth.uid()` and drops it. Everyone else
   * discards it with `void`: the contract is still fire-and-forget, and the
   * promise never rejects.
   */
  record(category: AuditCategory, action: string, detail: AuditDetail = {}): Promise<void> {
    if (!this.isBrowser) return Promise.resolve();
    return this.send(category, action, detail);
  }

  private async send(category: AuditCategory, action: string, detail: AuditDetail): Promise<void> {
    try {
      // `getClient()` throws when Supabase is unconfigured — must not escape.
      const client = await this.supabase.getClient();
      const { error } = await client.rpc('log_admin_activity', {
        p_category: category,
        p_action: action,
        p_entity_type: detail.entityType ?? null,
        p_entity_id: detail.entityId ?? null,
        p_changed: detail.changed ?? null,
        p_context: detail.context ?? null,
      });
      if (error) throw error;
    } catch (err) {
      // Never rethrow, never toast. A lost audit row is worth strictly less
      // than the admin's action failing because of it.
      this.logger.warn('[AuditLog] record failed (non-blocking):', err);
    }
  }
}
