export interface AdminUserProfile {
  user_id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  last_login_at: string | null;
  /** Optional report scope — forwarded as `report_type` to the vendor admin API. */
  report_type?: string | null;
}

export interface AdminRoleRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

export interface AdminProfileResponse {
  user: AdminUserProfile | null;
  role: AdminRoleRecord | null;
  permissions: string[];
  email_domains?: string[];
}

export type AdminRoleSlug =
  | 'super_admin'
  // Partner Platform personas — the only other roles in the catalog. The
  // create/assign split is driven by the Django /partner-admin/me/ role +
  // capabilities, not by these Supabase slugs.
  | 'partner_network_admin' // external partner HQ — Tracker + Vendor Users; Django role=network
  | 'partner_subcompany_admin' // external firm admin — Vendor Users ONLY; Django role=network (firm-scoped)
  | (string & {});

export interface AdminSignInResult {
  ok: boolean;
  error?: string;
}
