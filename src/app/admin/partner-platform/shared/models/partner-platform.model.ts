/**
 * Models for the Partner Platform admin feature — the Django API documented in
 * `docs/PARTNER_PLATFORM_API.md`.
 *
 * Two bases, one auth mode:
 *   - `partners/superadmin/…` — Miles ops, sees everything, must scope each
 *     report call to exactly one network or firm.
 *   - `partners/panel/…` — network and firm admins, auto-scoped server-side by
 *     the caller's `PartnerAdmin` row. Never send a scope the server didn't ask
 *     for; a firm admin must not be able to widen their view with a param.
 *
 * Every endpoint authenticates with the Supabase access token: set
 * `adminContext()` on the request so `adminTokenInterceptor` attaches
 * `Authorization: Bearer <token>`.
 *
 * Vocabulary note: a **partner code** is a price plan (creating one mints
 * nothing); a **seat** is a real voucher, minted by an allocation. The API used
 * to call seats "coupons" — it no longer does, and neither does this file.
 */
import { HttpContext } from '@angular/common/http';
import { IS_ADMIN_REQUEST } from '../../../../shared/core/models/http.model';

/** Attach the Supabase admin token to a Partner Platform request. */
export function adminContext(): HttpContext {
  return new HttpContext().set(IS_ADMIN_REQUEST, true);
}

/**
 * Failure body for a write. Successful writes return the created/updated entity
 * directly (201/200) — there is no `{status:true}` wrapper to check, so a
 * resolved request IS the success path.
 */
export interface PartnerApiError {
  status: false;
  message: string;
}

/**
 * Pull the backend `message` out of a failed request. A Partner Platform
 * failure is `{ status:false, message }` with a 4xx, so HttpClient throws an
 * `HttpErrorResponse` whose own `.message` is Angular's generic "Http failure
 * response for <url>: 400 Bad Request" — reading that swallows the only useful
 * text. The real body is on `err.error`.
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

/**
 * `partnerErrorMessage` for a `responseType: 'blob'` request (the CSV exports):
 * a 4xx there arrives with the JSON body wrapped in a Blob, so the sync helper
 * can't see it. Reads the blob, then falls through to the normal parsing.
 */
export async function partnerBlobErrorMessage(
  err: unknown,
  fallback = 'Please try again.',
): Promise<string> {
  const body = (err as { error?: unknown } | null | undefined)?.error;
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    try {
      return partnerErrorMessage({ error: JSON.parse(await body.text()) }, fallback);
    } catch {
      return fallback;
    }
  }
  return partnerErrorMessage(err, fallback);
}

/**
 * The one pagination envelope. Every paginated Partner Platform list uses it,
 * and `next_page`/`previous_page` are page NUMBERS, not URLs — no
 * `parseNextPage()` needed.
 */
export interface PartnerPagination {
  total_count: number;
  current_page_number: number;
  next_page: number | null;
  previous_page: number | null;
}

/** Shared zero-state so every facade renders the same "page 1 of nothing". */
export const EMPTY_PAGINATION: PartnerPagination = {
  total_count: 0,
  current_page_number: 1,
  next_page: null,
  previous_page: null,
};

// ---------------------------------------------------------------------------
// Capabilities (Django PartnerAdmin) — fine-grained, action-level.
// ---------------------------------------------------------------------------

export const PARTNER_CAPABILITIES = [
  'report:network:read',
  'report:firm:read',
  'seat:usage:read',
  'seat:send',
  'user:block',
  'code:create:network',
  'code:create:firm',
] as const;

export type PartnerCapability = (typeof PARTNER_CAPABILITIES)[number];

/** Django PartnerAdmin role. */
export type PartnerRole = 'super' | 'network' | 'firm';

/** Operator-facing names for the capability picker. */
export const CAPABILITY_LABELS: Record<PartnerCapability, string> = {
  'report:network:read': 'Read network reports & dashboard',
  'report:firm:read': 'Read firm reports & dashboard',
  'seat:usage:read': 'View the Seat Tracker',
  'seat:send': 'Send seat codes by email',
  'user:block': 'Block / unblock users',
  'code:create:network': 'Create network partner codes',
  'code:create:firm': 'Create firm partner codes',
};

/**
 * What a freshly provisioned admin gets before the operator edits the picker.
 * `seat:usage:read` is in both — without it the Seat Tracker renders
 * "not enabled" forever, which is exactly what the old hard-coded lists did.
 * Django supers hold no capabilities: `IsSuperAdmin` is the gate.
 */
export const CAPABILITY_DEFAULTS: Record<PartnerRole, readonly PartnerCapability[]> = {
  super: [],
  network: [
    'report:network:read',
    'seat:usage:read',
    'seat:send',
    'user:block',
    'code:create:firm',
  ],
  firm: ['report:firm:read', 'seat:usage:read', 'seat:send', 'user:block'],
};

/** How a network is embedded in another payload. */
export interface PartnerNetworkRef {
  id: number;
  name: string;
  /** Only the standalone network payloads carry it. */
  slug?: string;
}

/** How a firm is embedded in another payload. */
export interface PartnerFirmRef {
  id: number;
  name: string;
}

// ---------------------------------------------------------------------------
// Networks
// ---------------------------------------------------------------------------

export interface Network {
  id: number;
  name: string;
  slug: string;
  total_seats: number;
  allocated_seats: number;
  unallocated_seats: number;
  used_seats: number;
  is_active: boolean;
}

export interface NetworksResponse {
  networks: Network[];
}

export interface CreateNetworkRequest {
  name: string;
  /** Defaults server-side to a slugified `name`. */
  slug?: string;
  total_seats?: number;
}

/**
 * Mint seats into a pool. `partner_code` is the plan id; the seats are priced
 * from it. On a network PATCH they land in the network pool (`firm: null`).
 */
export interface SeatAllocation {
  partner_code: number;
  count: number;
  /** ISO date, optional. */
  expiry_date?: string;
}

export type UpdateNetworkRequest = Partial<{
  name: string;
  /** Can't drop below what's already allocated. */
  total_seats: number;
  is_active: boolean;
  allocations: SeatAllocation[];
}>;

/** `PATCH /superadmin/networks/<id>/` — the network, plus a mint count if seats were minted. */
export interface NetworkMutationResponse extends Network {
  seats_minted?: number;
}

/** `GET /superadmin/networks/<id>/` — the network and its member firms. */
export interface NetworkDetailResponse {
  network: Network;
  firms: Firm[];
}

// ---------------------------------------------------------------------------
// Firms
// ---------------------------------------------------------------------------

/**
 * One firm shape for every payload that returns one. `network` is null for a
 * standalone firm — but prefer `is_standalone` for that question, since it's
 * the field the backend maintains for it.
 */
export interface Firm {
  id: number;
  name: string;
  network: PartnerNetworkRef | null;
  is_standalone: boolean;
  /** Every domain that gates redemption for this firm. Empty = any email. */
  email_domains: string[];
  is_active: boolean;
  allocated_seats: number;
  used_seats: number;
}

export interface FirmsResponse {
  firms: Firm[];
}

/** Firm admin created alongside the firm, in one atomic call. */
export interface CreateFirmAdmin {
  supabase_uid: string;
  email?: string;
  capabilities?: PartnerCapability[];
}

export interface CreateFirmRequest {
  name: string;
  /** Omit for a standalone firm. */
  network?: number;
  /** Gates who can redeem this firm's seats. The API also accepts a bare string. */
  email_domains?: string[];
  admin?: CreateFirmAdmin;
  allocations?: SeatAllocation[];
}

/** `PATCH /superadmin/firms/<id>/` — super-admin only. */
export type UpdateFirmRequest = Partial<{
  name: string;
  email_domains: string[];
  is_active: boolean;
}>;

/** `POST /superadmin/firms/` — the firm, plus what the optional extras produced. */
export interface CreateFirmResponse extends Firm {
  seats_minted?: number;
  /** Only present when an `admin` object was sent. */
  admin?: PartnerAdmin;
}

/** `POST /superadmin/firms/<id>/allocate/` — top up an existing firm. */
export interface AllocateSeatsRequest {
  partner_code: number;
  count: number;
  expiry_date?: string;
}

export interface AllocateSeatsResponse {
  seats_minted: number;
}

/** `POST /superadmin/seats/<id>/assign-firm/` — move a pool seat onto a firm. */
export interface AssignSeatResponse {
  id: number;
  code: string;
  firm_id: number;
}

// ---------------------------------------------------------------------------
// Partner codes (price plans — creating one mints nothing)
// ---------------------------------------------------------------------------

export interface PartnerCode {
  id: number;
  code: string;
  description: string | null;
  /** Serialised as a string by the API, e.g. "299.00". */
  discounted_price: string;
  stripe_price_id: string | null;
  /** true = a free Active subscription on redeem; false = discount only. */
  auto_subscribe: boolean;
  /** Scope — network XOR firm XOR neither (global). */
  network: PartnerNetworkRef | null;
  firm: PartnerFirmRef | null;
  /** Expiry for direct (non-seat) redemption. */
  valid_to: string | null;
  is_active: boolean;
}

export interface PartnerCodesResponse {
  partner_codes: PartnerCode[];
}

/** Scope to a network OR a firm, never both; omit both for a global code. */
export interface CreatePartnerCodeRequest {
  code: string;
  discounted_price: number;
  description?: string;
  stripe_price_id?: string;
  auto_subscribe?: boolean;
  network?: number;
  firm?: number;
  valid_to?: string;
}

// ---------------------------------------------------------------------------
// Partner admins (provisioning)
// ---------------------------------------------------------------------------

export interface PartnerAdmin {
  id: number;
  email: string;
  supabase_uid: string;
  role: PartnerRole;
  network: PartnerNetworkRef | null;
  firm: PartnerFirmRef | null;
  capabilities: PartnerCapability[];
  is_active: boolean;
}

export interface PartnerAdminsResponse {
  partner_admins: PartnerAdmin[];
}

export interface CreatePartnerAdminRequest {
  supabase_uid: string;
  /** Display only. */
  email?: string;
  role: PartnerRole;
  /** Required when `role === 'network'`. */
  network?: number;
  /** Required when `role === 'firm'`. */
  firm?: number;
  capabilities?: PartnerCapability[];
}

// ---------------------------------------------------------------------------
// Panel: identity (/me) + dashboard
// ---------------------------------------------------------------------------

export interface PartnerAdminMeProfile extends PartnerAdmin {
  is_partner_admin: true;
}

/** Observe-mode fallback when the login has no PartnerAdmin row. */
export interface PartnerAdminMeAbsent {
  is_partner_admin: false;
}

export type PartnerAdminMeResponse = PartnerAdminMeProfile | PartnerAdminMeAbsent;

/**
 * `GET /panel/dashboard/`. `total_seats`/`unallocated_seats` appear only for a
 * network admin — a firm has no seat budget of its own.
 */
export interface DashboardStats {
  total_seats?: number;
  unallocated_seats?: number;
  allocated_seats: number;
  used_seats: number;
  available_seats: number;
  shared_seats: number;
  expired_seats: number;
}

// ---------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------

export type SeatStatus = 'available' | 'shared' | 'applied' | 'expired';
export type SeatStatusFilter = 'all' | SeatStatus;

export interface Seat {
  id: number;
  code: string;
  /** The plan this seat was minted from. */
  partner_code: { id: number; code: string };
  /** Null for a seat minted straight to the network pool — render `—`. */
  firm: PartnerFirmRef | null;
  /**
   * Derived server-side: `applied` wins even past expiry; otherwise an expired
   * row reads `expired` regardless of what's stored.
   */
  status: SeatStatus;
  /** Serialised as a string by the API, e.g. "299.00". */
  purchase_cost: string;
  expiry_date: string | null;
  sent_to_email: string | null;
  shared_on: string | null;
  applied_by_email: string | null;
  applied_on: string | null;
}

export interface SeatsResponse {
  seats: Seat[];
  pagination_data: PartnerPagination;
}

export interface SendSeatRequest {
  email: string;
}

// ---------------------------------------------------------------------------
// Panel: users
// ---------------------------------------------------------------------------

export type BlockedStatusFilter = 'all' | 'blocked' | 'active';

/** `GET /panel/users/` — users who redeemed a seat under this admin's scope. */
export interface PartnerPanelUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  is_blocked: boolean;
  courses_completed_cpe: number;
  cpe_credits_earned: number;
  courses_in_progress_cpe: number;
  cpe_credits_in_progress: number;
  courses_completed_preview: number;
  courses_in_progress_preview: number;
}

export interface PartnerPanelUsersResponse {
  data: PartnerPanelUser[];
  pagination_data: PartnerPagination;
}

export interface BlockStatusRequest {
  is_blocked: boolean;
  reason?: string;
}

export interface BlockStatusResponse {
  status: boolean;
  is_blocked: boolean;
  user_id: number;
}
