/**
 * Models for the Partner Platform admin feature — the Django API documented in
 * `docs/PARTNER_PLATFORM_API.md` (base `/api/reports`, branch `feat/partner-admin`).
 *
 * Every endpoint authenticates with the Supabase access token: set
 * `adminContext()` on the request so `adminTokenInterceptor` attaches
 * `Authorization: Bearer <token>` + `X-Admin-Request: 1`.
 */
import { HttpContext } from '@angular/common/http';
import { IS_ADMIN_REQUEST } from '../../../../shared/core/models/http.model';

/** Attach the Supabase admin token to a Partner Platform request. */
export function adminContext(): HttpContext {
  return new HttpContext().set(IS_ADMIN_REQUEST, true);
}

/** Standard error body shared by every write endpoint. */
export interface PartnerApiError {
  status: false;
  message: string;
}

/**
 * Pull the backend `message` out of a failed request. Every Partner Platform
 * failure is `{ status:false, message }` with a 400/401/403, so HttpClient
 * throws an `HttpErrorResponse` whose own `.message` is Angular's generic
 * "Http failure response for <url>: 400 Bad Request" — reading that swallows
 * the only useful text. The real body is on `err.error`.
 */
export function partnerErrorMessage(err: unknown, fallback = 'Please try again.'): string {
  const body = (err as { error?: unknown } | null | undefined)?.error;
  if (typeof body === 'string' && body.trim()) return body.trim();
  const message = (body as { message?: unknown } | null | undefined)?.message;
  if (typeof message === 'string' && message.trim()) return message.trim();
  return fallback;
}

/**
 * Same, for a `resource()` error signal: the backend `message` when the load
 * failed, else null — so an `@if` banner stays a truthiness check and renders
 * the real reason (e.g. "network_id or firm_id is required.") instead of a
 * generic "failed to load".
 */
export function partnerLoadError(err: unknown, fallback: string): string | null {
  return err ? partnerErrorMessage(err, fallback) : null;
}

// ---------------------------------------------------------------------------
// Capabilities (Django PartnerAdmin) — fine-grained, action-level.
// ---------------------------------------------------------------------------

export const PARTNER_CAPABILITIES = [
  'report:network:read',
  'report:firm:read',
  'coupon:usage:read',
  'coupon:send',
  'user:block',
  'code:create:network',
  'code:create:firm',
] as const;

export type PartnerCapability = (typeof PARTNER_CAPABILITIES)[number];

/** Django PartnerAdmin role (`docs/PARTNER_PLATFORM_API.md`). */
export type PartnerRole = 'super' | 'network' | 'firm';

/** Reference to a network, as embedded in `/me`, dashboard, and coupon rows. */
export interface PartnerNetworkRef {
  id: number;
  name: string;
  slug: string;
}

/**
 * Reference to a firm (sub-company). Embedded in `/me`, the firm-admin
 * dashboard, and every coupon row. `network` is null for a standalone firm.
 */
export interface PartnerFirmRef {
  id: number;
  name: string;
  network?: number | null;
  email_domain?: string;
}

// ---------------------------------------------------------------------------
// Super-admin: networks
// ---------------------------------------------------------------------------

export interface Network {
  id: number;
  name: string;
  slug: string;
  total_seats: number;
  allocated: number;
  unallocated: number;
  is_active: boolean;
}

export interface NetworksResponse {
  networks: Network[];
}

export interface CreateNetworkRequest {
  name: string;
  slug: string;
  total_seats: number;
}

export type UpdateNetworkRequest = Partial<{
  name: string;
  total_seats: number;
  is_active: boolean;
  /**
   * Stock the network's own pool: mints coupons with **no sub-company**
   * (`coupon.firm === null`). The only way network-level coupons come to exist.
   */
  allocations: SubCompanyAllocation[];
}>;

export interface NetworkMutationResponse {
  status: boolean;
  network?: Network;
  /** Present when the PATCH carried `allocations`. */
  coupons_minted?: number;
  message?: string;
}

// ---------------------------------------------------------------------------
// Super-admin: partner codes (plan/price templates — the "create coupon" step)
// ---------------------------------------------------------------------------

export interface PartnerCode {
  id: number;
  code: string;
  /** Serialised as a string by the API, e.g. "299.00". */
  discounted_price: string;
  partner_network: number | null;
  partner_firm: number | null;
  auto_subscribe: boolean;
  is_active: boolean;
}

export interface PartnerCodesResponse {
  partner_codes: PartnerCode[];
}

/** Scope to a network OR a firm, never both; omit both for a global code. */
export interface CreatePartnerCodeRequest {
  code: string;
  discounted_price: number;
  partner_network_id?: number | null;
  partner_firm_id?: number | null;
  auto_subscribe?: boolean;
  description?: string;
}

export interface PartnerCodeMutationResponse {
  status: boolean;
  partner_code?: Pick<PartnerCode, 'id' | 'code'>;
  message?: string;
}

// ---------------------------------------------------------------------------
// Super-admin: partner-admin logins (provisioning)
// ---------------------------------------------------------------------------

export interface PartnerAdmin {
  id: number;
  supabase_uid: string;
  email: string;
  role: PartnerRole;
  network: number | null;
  firm: number | null;
  capabilities: string[];
  is_active: boolean;
}

export interface PartnerAdminsResponse {
  partner_admins: PartnerAdmin[];
}

export interface CreatePartnerAdminRequest {
  supabase_uid: string;
  email: string;
  role: PartnerRole;
  /** Required for role = 'network'; mutually exclusive with `firm_id`. */
  network_id?: number | null;
  /** Required for role = 'firm' (network is derived from the firm). */
  firm_id?: number | null;
  capabilities?: string[];
}

export interface PartnerAdminMutationResponse {
  status: boolean;
  partner_admin?: Pick<PartnerAdmin, 'id' | 'supabase_uid' | 'role' | 'network' | 'firm'>;
  message?: string;
}

// ---------------------------------------------------------------------------
// Super-admin: firms created directly (single-company onboarding, flow B)
// ---------------------------------------------------------------------------

export interface SuperFirm {
  id: number;
  name: string;
  /** null for a standalone firm (no network). */
  network: number | null;
  email_domain: string;
  is_active: boolean;
}

export interface SuperFirmsResponse {
  firms: SuperFirm[];
}

export interface CreateFirmRequest {
  /** Omit for a standalone firm (uncapped, no network); include for a member firm. */
  network_id?: number | null;
  name: string;
  email_domain: string;
  /** Optional — omit to create the firm with 0 minted coupons (mint later). */
  allocations?: SubCompanyAllocation[];
}

export interface CreateFirmResponse {
  status: boolean;
  firm?: { id: number; name: string; network: number | null };
  coupons_minted?: number;
  /** Present only for a member firm (standalone omits it). */
  network?: { id: number; unallocated_seats: number };
  message?: string;
}

// ---------------------------------------------------------------------------
// Network-admin: identity (/me) + dashboard
// ---------------------------------------------------------------------------

export interface PartnerAdminMeProfile {
  supabase_uid: string;
  email: string;
  role: PartnerRole;
  /** Present for a network admin; null for a firm admin. */
  network: PartnerNetworkRef | null;
  /** Present for a firm admin; null for a network admin. */
  firm: PartnerFirmRef | null;
  capabilities: string[];
}

/** Observe-mode fallback when there's no verified partner admin. */
export interface PartnerAdminMeAbsent {
  is_partner_admin: false;
}

export type PartnerAdminMeResponse = PartnerAdminMeProfile | PartnerAdminMeAbsent;

/** Network-admin dashboard — network-wide totals (seat + coupon metrics). */
export interface NetworkDashboardStats {
  network: PartnerNetworkRef;
  total_seats: number;
  allocated: number;
  unallocated: number;
  used: number;
  available: number;
  shared: number;
  applied: number;
  expired: number;
}

/** Firm-admin dashboard — own-firm totals (no seat pool: no total_seats/unallocated). */
export interface FirmDashboardStats {
  firm: PartnerFirmRef;
  allocated: number;
  used: number;
  available: number;
  shared: number;
  applied: number;
  expired: number;
}

export type DashboardStats = NetworkDashboardStats | FirmDashboardStats;

/**
 * Super-admin network tracker header (`GET /superadmin/networks/<id>/`) — the
 * network's stat-card summary plus its sub-companies.
 */
export interface NetworkTrackerResponse {
  summary: NetworkDashboardStats;
  sub_companies: Firm[];
}

// ---------------------------------------------------------------------------
// Network-admin: sub-companies (firms) + coupons
// ---------------------------------------------------------------------------

export interface Firm {
  id: number;
  name: string;
  allocated: number;
  used: number;
  available: number;
  is_active: boolean;
}

export interface SubCompaniesResponse {
  sub_companies: Firm[];
}

export interface SubCompanyAllocation {
  partner_code_id: number;
  count: number;
  /** ISO date, optional. */
  expiry_date?: string;
}

/**
 * Network-admin sub-company creation (`POST /partner-admin/sub-companies/`).
 * Network is derived server-side from the caller; only the firm + its coupon
 * allocations are sent. No admin login is created here.
 */
export interface CreateSubCompanyRequest {
  name: string;
  email_domain: string;
  allocations?: SubCompanyAllocation[];
}

export type CouponStatus = 'available' | 'shared' | 'applied' | 'expired';
export type CouponStatusFilter = 'all' | CouponStatus;

export interface Coupon {
  id: number;
  code: string;
  /** Serialised as a string by the API, e.g. "299.00". */
  purchase_cost: string;
  /** null when the coupon never expires — render `—`, not a blank cell. */
  expiry_date: string | null;
  status: CouponStatus;
  sent_to_email: string | null;
  shared_on: string | null;
  applied_on: string | null;
  applied_by: string | null;
  /** The firm this coupon belongs to — null for coupons minted straight to a network. */
  firm: PartnerFirmRef | null;
}

/**
 * Coupon tracker pagination, as returned by `/partner-admin/coupons/` and
 * `/superadmin/coupons/`. Page-number form (not the full-URL form the `/users/`
 * endpoint uses) — see `docs/PARTNER_PLATFORM_API.md`.
 */
export interface CouponPagination {
  total_count: number;
  current_page_number: number;
  next_page: number | null;
  previous_page: number | null;
}

export interface CouponsResponse {
  coupons: Coupon[];
  pagination_data: CouponPagination;
}

export interface SendCouponRequest {
  email: string;
}

export interface SendCouponResponse {
  status: boolean;
  coupon?: Pick<Coupon, 'id' | 'status' | 'sent_to_email'>;
  message?: string;
}
