import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { Coupon, Network, PartnerCode, SuperFirm } from '../models/partner-platform.model';

/**
 * Serves §3 of `docs/PARTNER_PLATFORM_API.md` — the mock dataset — so the whole
 * three-portal flow (§1) is clickable before the Django `feat/partner-admin`
 * branch is deployed. Off unless BOTH hold:
 *
 *   1. the page is served from localhost, and
 *   2. `localStorage.partnerMock` is `super`, `network`, or `firm`
 *      (the role `/partner-admin/me/` reports back — switch portals with it).
 *
 * Anything it doesn't recognise falls through to the real API untouched.
 *
 * Deliberately keyed on the HOSTNAME, not `environment.production`: in this repo
 * `ng serve` defaults to the *production* configuration (see angular.json
 * `serve.defaultConfiguration`), so `environment.production` is true on the dev
 * server too and would switch this off exactly where it is wanted.
 *
 * ponytail: a flat URL→body lookup, no request recording, no persistence — this
 * is for eyeballing the binding, not a test double. It fakes only the DJANGO
 * layer; the Supabase route/sidebar RBAC still needs a real admin login, so
 * reach the pages with a super-admin session.
 */

type MockRole = 'super' | 'network' | 'firm';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function mockRole(): MockRole | null {
  if (typeof location === 'undefined' || typeof localStorage === 'undefined') return null;
  if (!LOCAL_HOSTS.has(location.hostname)) return null;
  const role = localStorage.getItem('partnerMock');
  return role === 'super' || role === 'network' || role === 'firm' ? role : null;
}

// ---- §3 dataset ------------------------------------------------------------

const NETWORK: Network = {
  id: 11,
  name: 'Acme Alliance',
  slug: 'acme-alliance',
  total_seats: 100,
  allocated: 12,
  unallocated: 88,
  is_active: true,
};

/** Sub-companies of network 11. */
const SUB_COMPANIES = [
  { id: 16, name: 'Google', allocated: 10, used: 3, available: 7, is_active: true },
  { id: 17, name: 'Amazon', allocated: 2, used: 0, available: 2, is_active: true },
];

const FIRMS: SuperFirm[] = [
  { id: 16, name: 'Google', network: 11, email_domain: 'google.com', is_active: true },
  { id: 17, name: 'Amazon', network: 11, email_domain: 'amazon.com', is_active: true },
  // Standalone firm — no network.
  { id: 18, name: 'Deloitte', network: null, email_domain: 'deloitte.com', is_active: true },
];

const PARTNER_CODES: PartnerCode[] = [
  {
    id: 31,
    code: 'ACME-STD',
    discounted_price: '299.00',
    partner_network: 11,
    partner_firm: null,
    auto_subscribe: false,
    is_active: true,
  },
  {
    id: 32,
    code: 'GLOBAL-99',
    discounted_price: '99.00',
    partner_network: null,
    partner_firm: null,
    auto_subscribe: false,
    is_active: true,
  },
  {
    id: 33,
    code: 'DELOITTE',
    discounted_price: '200.00',
    partner_network: null,
    partner_firm: 18,
    auto_subscribe: false,
    is_active: true,
  },
];

const GOOGLE = { id: 16, name: 'Google' };

const COUPONS: Coupon[] = [
  {
    id: 101,
    code: 'GOOGLE-1A2B3C4D',
    purchase_cost: '299.00',
    expiry_date: null,
    status: 'applied',
    sent_to_email: 'jane@google.com',
    shared_on: '2026-07-10T10:00:00Z',
    applied_on: '2026-07-11T08:00:00Z',
    applied_by: 'jane@google.com',
    firm: GOOGLE,
  },
  {
    id: 102,
    code: 'GOOGLE-9F8E7D6C',
    purchase_cost: '299.00',
    expiry_date: null,
    status: 'shared',
    sent_to_email: 'spoc@google.com',
    shared_on: '2026-07-12T09:00:00Z',
    applied_on: null,
    applied_by: null,
    firm: GOOGLE,
  },
  {
    // Minted straight to the network — no sub-company, renders as "—" (§0.4).
    id: 103,
    code: 'ACMEALLI-55AA11BB',
    purchase_cost: '299.00',
    expiry_date: null,
    status: 'available',
    sent_to_email: null,
    shared_on: null,
    applied_on: null,
    applied_by: null,
    firm: null,
  },
];

const ME: Record<MockRole, unknown> = {
  super: {
    supabase_uid: 'sup1-mock',
    email: 'ops@mileseducation.com',
    role: 'super',
    network: null,
    firm: null,
    capabilities: [
      'report:network:read',
      'code:create:network',
      'code:create:firm',
      'coupon:send',
      'user:block',
    ],
  },
  network: {
    supabase_uid: 'acc1-mock',
    email: 'hq@acme.com',
    role: 'network',
    network: { id: 11, name: 'Acme Alliance', slug: 'acme-alliance' },
    firm: null,
    capabilities: ['report:network:read', 'code:create:firm', 'coupon:send', 'user:block'],
  },
  firm: {
    supabase_uid: 'b7c3-mock',
    email: 'admin@deloitte.com',
    role: 'firm',
    network: null,
    firm: { id: 18, name: 'Deloitte', network: null, email_domain: 'deloitte.com' },
    capabilities: ['report:network:read', 'coupon:send', 'user:block'],
  },
};

const COUPON_STATS = { used: 3, available: 8, shared: 1, applied: 3, expired: 0 };

const DASHBOARD: Record<MockRole, unknown> = {
  super: {
    network: ME['network'],
    total_seats: 100,
    allocated: 12,
    unallocated: 88,
    ...COUPON_STATS,
  },
  network: {
    network: { id: 11, name: 'Acme Alliance', slug: 'acme-alliance' },
    total_seats: 100,
    allocated: 12,
    unallocated: 88,
    ...COUPON_STATS,
  },
  // Firm dashboard: no seat pool (§6).
  firm: {
    firm: { id: 18, name: 'Deloitte', network: null, email_domain: 'deloitte.com' },
    allocated: 10,
    used: 0,
    available: 10,
    shared: 0,
    applied: 0,
    expired: 0,
  },
};

const USERS = {
  data: [
    {
      id: 57,
      name: 'Jane Doe',
      email: 'jane@google.com',
      is_blocked: false,
      courses_completed_cpe: 3,
      cpe_credits_earned: 12,
    },
    {
      id: 58,
      name: 'Sam Patel',
      email: 'spoc@google.com',
      is_blocked: true,
      courses_completed_cpe: 0,
      cpe_credits_earned: 0,
    },
  ],
  // The users endpoint pages by full URL, not page number (§0.7).
  pagination_data: { total_count: 2, current_page_number: 1, next_page: null, previous_page: null },
};

// ---- Wiring ----------------------------------------------------------------

/** Coupons filtered the way the server would, then wrapped in page-number pagination. */
function couponPage(params: URLSearchParams): unknown {
  const status = params.get('status');
  const firmId = params.get('firm_id');
  let rows = COUPONS;
  if (status && status !== 'all') rows = rows.filter((c) => c.status === status);
  if (firmId) rows = rows.filter((c) => c.firm?.id === Number(firmId));
  return {
    coupons: rows,
    pagination_data: {
      total_count: rows.length,
      current_page_number: Number(params.get('page') ?? 1),
      next_page: null,
      previous_page: null,
    },
  };
}

export const partnerMockInterceptor: HttpInterceptorFn = (req, next) => {
  const role = mockRole();
  if (!role || !req.url.includes('/api/reports/')) return next(req);

  const path = req.url.slice(req.url.indexOf('/api/reports/') + '/api/reports/'.length);
  const query = new URLSearchParams(req.params.toString());
  const ok = (body: unknown) => of(new HttpResponse({ status: 200, body }));

  // Uniform error body, so the panel's message surfacing is exercised too (§0.6).
  const fail = (status: number, message: string) =>
    throwError(
      () => new HttpErrorResponse({ status, url: req.url, error: { status: false, message } }),
    );

  if (req.method === 'GET') {
    if (path === 'partner-admin/me/') return ok(ME[role]);
    if (path === 'partner-admin/dashboard/') return ok(DASHBOARD[role]);
    if (path === 'partner-admin/sub-companies/') return ok({ sub_companies: SUB_COMPANIES });
    if (path === 'partner-admin/partner-codes/') return ok({ partner_codes: PARTNER_CODES });
    if (path === 'partner-admin/coupons/') {
      // A firm admin is pinned server-side to their own firm (§6).
      if (role === 'firm') query.set('firm_id', '18');
      return ok(couponPage(query));
    }
    if (path === 'partner-admin/users/') return ok(USERS);
    if (path === 'superadmin/networks/') return ok({ networks: [NETWORK] });
    if (path === 'superadmin/networks/11/') {
      return ok({
        summary: {
          network: ME['network'],
          total_seats: 100,
          allocated: 12,
          unallocated: 88,
          ...COUPON_STATS,
        },
        sub_companies: SUB_COMPANIES,
      });
    }
    if (path === 'superadmin/partner-codes/') return ok({ partner_codes: PARTNER_CODES });
    if (path === 'superadmin/firms/') {
      const networkId = query.get('network_id');
      const standalone = query.get('standalone');
      let rows = FIRMS;
      if (networkId) rows = rows.filter((f) => f.network === Number(networkId));
      else if (standalone === '1') rows = rows.filter((f) => f.network == null);
      return ok({ firms: rows });
    }
    if (path === 'superadmin/coupons/') {
      if (!query.get('network_id') && !query.get('firm_id')) {
        return fail(400, 'network_id or firm_id is required.');
      }
      return ok(couponPage(query));
    }
  }

  if (req.method === 'POST') {
    const sendMatch = /^partner-admin\/coupons\/(\d+)\/send\/$/.exec(path);
    if (sendMatch) {
      const email = (req.body as { email?: string } | null)?.email ?? '';
      return ok({
        status: true,
        coupon: { id: Number(sendMatch[1]), status: 'shared', sent_to_email: email },
      });
    }
    if (path === 'partner-admin/sub-companies/' || path === 'superadmin/firms/') {
      return ok({
        status: true,
        firm: {
          id: 19,
          name: (req.body as { name?: string } | null)?.name ?? 'New firm',
          network: 11,
        },
        coupons_minted: 10,
        network: { id: 11, unallocated_seats: 78 },
      });
    }
    if (path === 'superadmin/networks/') {
      return ok({ status: true, network: { ...NETWORK, id: 12, allocated: 0, unallocated: 100 } });
    }
    if (path === 'superadmin/partner-codes/') {
      return ok({ status: true, partner_code: { id: 34, code: 'NEW-CODE' } });
    }
    if (path === 'superadmin/partner-admins/') {
      return ok({
        status: true,
        partner_admin: {
          id: 3,
          supabase_uid: 'acc1-mock',
          role: 'network',
          network: 11,
          firm: null,
        },
      });
    }
  }

  if (req.method === 'PATCH' && /^superadmin\/networks\/\d+\/$/.test(path)) {
    const body = req.body as { allocations?: { count: number }[] } | null;
    const minted = (body?.allocations ?? []).reduce((sum, a) => sum + a.count, 0);
    return ok({
      status: true,
      network: { ...NETWORK, allocated: NETWORK.allocated + minted },
      coupons_minted: minted,
    });
  }

  return next(req);
};
