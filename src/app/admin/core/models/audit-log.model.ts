/**
 * Rows of `public.admin_audit_log` (see
 * supabase/migrations/20260918000000_admin_audit_log.sql).
 */

/**
 * Which tier wrote the row, and therefore how much it proves.
 *
 * - `trigger` — written by a Postgres trigger on the committed write. Cannot be
 *   bypassed from the browser, and also catches Supabase dashboard edits.
 * - `client`  — written by this app for things Postgres cannot see (Django API
 *   calls, page views, auth events). The actor and timestamp are still stamped
 *   server-side from `auth.uid()`, so identity is trustworthy, but the action
 *   itself is client-asserted and could be withheld.
 *
 * Never present a `client` row as proof that something did or did not happen.
 */
export type AuditSource = 'trigger' | 'client';

export type AuditCategory = 'mutation' | 'auth' | 'navigation' | 'export' | 'api';

export interface AuditLogRow {
  id: number;
  occurred_at: string;
  /** Null for Supabase dashboard, service-role and migration writes. */
  actor_id: string | null;
  actor_email: string | null;
  actor_roles: string[] | null;
  source: AuditSource;
  category: AuditCategory;
  /** insert | update | delete | sign_in | sign_out | page_view | POST | PATCH … */
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  /** `{column: {old, new}}` for updates, the row for insert/delete, payload for client rows. */
  changed: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
}

/** Optional detail passed to `AuditLog.record()`. */
export interface AuditDetail {
  entityType?: string | null;
  entityId?: string | null;
  changed?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
}

export const AUDIT_CATEGORIES: readonly AuditCategory[] = [
  'mutation',
  'auth',
  'navigation',
  'export',
  'api',
];

/** Human labels for the viewer's filter chips. */
export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  mutation: 'Data changes',
  auth: 'Sign-in',
  navigation: 'Page views',
  export: 'Exports',
  api: 'API calls',
};
