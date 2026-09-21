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
  /** @deprecated first entry of `roles` — kept for the DB/bundle mid-deploy window. */
  role: AdminRoleRecord | null;
  /** Every role held, super_admin first then by slug. Permissions are the union. */
  roles?: AdminRoleRecord[];
  permissions: string[];
  email_domains?: string[];
}

/**
 * One role per admin sidenav section; an admin may hold several. The four
 * Django-mapped slugs (super_admin, partner_platform_admin,
 * partner_network_admin, partner_subcompany_admin) are mutually exclusive —
 * Django keeps one PartnerAdmin row per login.
 */
export type AdminRoleSlug =
  | 'super_admin'
  | 'seo_manager'
  | 'leads_manager'
  | 'reports_viewer'
  | 'partner_platform_admin' // Miles ops — Partner v2 super-admin console; Django role=super
  | 'partner_network_admin' // external partner HQ — Seat Tracker + Users; Django role=network
  | 'partner_subcompany_admin' // external firm admin — Users only; Django role=firm
  | 'admin_manager'
  | (string & {});

export interface AdminSignInResult {
  ok: boolean;
  error?: string;
}
