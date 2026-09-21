import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpHeaders,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { InternalUser } from '../../../user-onboarding/shared/models/user-onboarding.model';
import {
  ReportCertificate,
  ReportCertificatesResponse,
  ReportCertificateUser,
  ReportFilters,
  ReportItemsResponse,
  ReportSummary,
  ReportUsersResponse,
} from '../../reports/shared/models/partner-report.model';
import {
  DashboardStats,
  Firm,
  Network,
  PartnerAdmin,
  PartnerAdminMeResponse,
  PartnerCode,
  PartnerPanelUsersResponse,
  Seat,
} from '../models/partner-platform.model';

/**
 * Fixtures and handlers for `partnerMockInterceptor`. Split into its own module
 * so the whole dataset is a LAZY chunk — the interceptor is registered eagerly
 * in `app.config.ts`, and this never needs to reach a production bundle.
 *
 * Every fixture is explicitly typed against the real interfaces. That is the
 * point: an untyped literal would keep serving a stale shape long after the API
 * moved on, which is exactly how this file drifted last time.
 */

import { MockRole } from './partner-mock-role';

// ---- Dataset ---------------------------------------------------------------

const NETWORK_REF = { id: 11, name: 'Acme Alliance' };

const NETWORK: Network = {
  id: 11,
  name: 'Acme Alliance',
  slug: 'acme-alliance',
  total_seats: 100,
  allocated_seats: 12,
  unallocated_seats: 88,
  used_seats: 3,
  is_active: true,
};

const GOOGLE = { id: 16, name: 'Google' };

const FIRMS: Firm[] = [
  {
    id: 16,
    name: 'Google',
    network: NETWORK_REF,
    is_standalone: false,
    email_domains: ['google.com'],
    is_active: true,
    allocated_seats: 10,
    used_seats: 3,
  },
  {
    id: 17,
    name: 'Amazon',
    network: NETWORK_REF,
    is_standalone: false,
    email_domains: ['amazon.com'],
    is_active: true,
    allocated_seats: 2,
    used_seats: 0,
  },
  {
    id: 18,
    name: 'Deloitte',
    network: null,
    is_standalone: true,
    email_domains: ['deloitte.com'],
    is_active: true,
    allocated_seats: 5,
    used_seats: 1,
  },
];

const PARTNER_CODES: PartnerCode[] = [
  {
    id: 31,
    code: 'ACME-STD',
    description: null,
    discounted_price: '299.00',
    stripe_price_id: null,
    auto_subscribe: false,
    network: NETWORK_REF,
    firm: null,
    valid_to: null,
    is_active: true,
  },
  {
    id: 32,
    code: 'GLOBAL-99',
    description: 'Available to every partner',
    discounted_price: '99.00',
    stripe_price_id: null,
    auto_subscribe: false,
    network: null,
    firm: null,
    valid_to: null,
    is_active: true,
  },
  {
    id: 33,
    code: 'DELOITTE',
    description: null,
    discounted_price: '200.00',
    stripe_price_id: null,
    auto_subscribe: true,
    network: null,
    firm: { id: 18, name: 'Deloitte' },
    valid_to: null,
    is_active: true,
  },
];

const ACME_STD = { id: 31, code: 'ACME-STD' };

const SEATS: Seat[] = [
  {
    id: 101,
    code: 'GOOGLE-1A2B3C4D',
    partner_code: ACME_STD,
    firm: GOOGLE,
    status: 'applied',
    purchase_cost: '299.00',
    expiry_date: null,
    sent_to_email: 'jane@google.com',
    shared_on: '2026-07-10T10:00:00Z',
    applied_by_email: 'jane@google.com',
    applied_on: '2026-07-11T08:00:00Z',
  },
  {
    id: 102,
    code: 'GOOGLE-9F8E7D6C',
    partner_code: ACME_STD,
    firm: GOOGLE,
    status: 'shared',
    purchase_cost: '299.00',
    expiry_date: null,
    sent_to_email: 'spoc@google.com',
    shared_on: '2026-07-12T09:00:00Z',
    applied_by_email: null,
    applied_on: null,
  },
  {
    // Minted to the network pool — no firm. Renders `—`, and is the row
    // `POST /seats/<id>/assign-firm/` exists to move onto a firm.
    id: 103,
    code: 'ACMEALLI-55AA11BB',
    partner_code: ACME_STD,
    firm: null,
    status: 'available',
    purchase_cost: '299.00',
    expiry_date: null,
    sent_to_email: null,
    shared_on: null,
    applied_by_email: null,
    applied_on: null,
  },
];

const ME: Record<MockRole, PartnerAdminMeResponse> = {
  super: {
    id: 1,
    email: 'ops@mileseducation.com',
    supabase_uid: 'super-mock',
    role: 'super',
    network: null,
    firm: null,
    // A real Django super holds no capabilities (IsSuperAdmin is the gate);
    // the fixture keeps some so the panel pages have something to render.
    capabilities: [
      'report:network:read',
      'code:create:network',
      'code:create:firm',
      'seat:send',
      'user:block',
    ],
    is_active: true,
    is_partner_admin: true,
  },
  network: {
    id: 2,
    email: 'hq@acme.com',
    supabase_uid: 'network-mock',
    role: 'network',
    network: NETWORK_REF,
    firm: null,
    capabilities: [
      'report:network:read',
      'seat:usage:read',
      'code:create:firm',
      'seat:send',
      'user:block',
    ],
    is_active: true,
    is_partner_admin: true,
  },
  firm: {
    id: 3,
    email: 'admin@deloitte.com',
    supabase_uid: 'firm-mock',
    role: 'firm',
    network: null,
    firm: { id: 18, name: 'Deloitte' },
    capabilities: ['report:firm:read', 'seat:usage:read', 'seat:send', 'user:block'],
    is_active: true,
    is_partner_admin: true,
  },
};

const DASHBOARD: Record<MockRole, DashboardStats> = {
  super: {
    total_seats: 100,
    unallocated_seats: 88,
    allocated_seats: 12,
    used_seats: 3,
    available_seats: 8,
    shared_seats: 1,
    expired_seats: 0,
  },
  network: {
    total_seats: 100,
    unallocated_seats: 88,
    allocated_seats: 12,
    used_seats: 3,
    available_seats: 8,
    shared_seats: 1,
    expired_seats: 0,
  },
  // A firm has no seat budget of its own — no total_seats/unallocated_seats.
  firm: {
    allocated_seats: 5,
    used_seats: 1,
    available_seats: 4,
    shared_seats: 0,
    expired_seats: 0,
  },
};

const PANEL_USERS: PartnerPanelUsersResponse = {
  data: [
    {
      id: 501,
      name: 'Jane Doe',
      email: 'jane@google.com',
      phone: '+15551234567',
      is_blocked: false,
      courses_completed_cpe: 3,
      cpe_credits_earned: 12,
      courses_in_progress_cpe: 1,
      cpe_credits_in_progress: 4,
      courses_completed_preview: 2,
      courses_in_progress_preview: 0,
    },
    {
      id: 502,
      name: 'Ravi Kumar',
      email: 'ravi@google.com',
      phone: '+15559876543',
      is_blocked: true,
      courses_completed_cpe: 0,
      cpe_credits_earned: 0,
      courses_in_progress_cpe: 2,
      cpe_credits_in_progress: 6,
      courses_completed_preview: 0,
      courses_in_progress_preview: 1,
    },
  ],
  pagination_data: {
    total_count: 2,
    current_page_number: 1,
    next_page: null,
    previous_page: null,
  },
};

const INTERNAL_USERS: InternalUser[] = [
  {
    id: 501,
    email: 'jane@google.com',
    email_domain: 'google.com',
    first_name: 'Jane',
    last_name: 'Doe',
    mobile: '+15551234567',
    country_code: '+1',
    location: 'New York',
    qualification_status: 'completed',
    license_status: 'licensed',
    is_currently_working: true,
    terms_accepted: true,
    sms_consent: true,
    created_at: '2026-08-01T10:00:00Z',
    last_login: '2026-08-20T09:00:00Z',
    creation_platform: 'PartnerOnboarding',
    account_type: 'SGA',
    profession: 'CPA',
    professional_courses: ['Auditing'],
    state_board: ['New York'],
    country_selected: 'United States',
    company: 'Google',
    sector: 'Finance',
    job_role: 'Analyst',
    partner_code: 'ACME-STD',
    is_subscribed: true,
  },
  {
    id: 502,
    email: 'ravi@google.com',
    email_domain: 'google.com',
    first_name: 'Ravi',
    last_name: 'Kumar',
    mobile: '+15559876543',
    country_code: '+1',
    location: 'Austin',
    qualification_status: 'in_progress',
    license_status: null,
    is_currently_working: false,
    terms_accepted: true,
    sms_consent: false,
    created_at: '2026-08-05T10:00:00Z',
    last_login: null,
    creation_platform: 'PartnerOnboarding',
    account_type: null,
    profession: null,
    professional_courses: [],
    state_board: [],
    country_selected: null,
    company: null,
    sector: null,
    job_role: null,
    // Discount-only code, no subscription yet — the offline-payment target.
    partner_code: 'GLOBAL-99',
    is_subscribed: false,
  },
];

function reportSummary(subject: string): ReportSummary {
  const common = {
    users_onboarded: 2,
    active_in_last_15_days: 1,
    total_cpe_credits_awarded: 16,
    avg_cpe_credits_per_user: 8,
    total_certificates_awarded: 3,
    total_partner_codes: 3,
  };
  return subject === 'webinars'
    ? {
        ...common,
        webinars_registered_for: 2,
        total_registrations: 3,
        avg_registrations_per_webinar: 1.5,
        total_attendance: 2,
        avg_attendance_per_webinar: 1,
        avg_feedback_per_webinar: 4.4,
      }
    : {
        ...common,
        total_courses_completed: 3,
        avg_courses_completed_per_user: 1.5,
        avg_feedback_per_course: 4.2,
      };
}

/** A one-page "Certificate" PDF as a data: URL — `fetch()` accepts it, so zips build offline. */
const MOCK_PDF =
  'data:application/pdf;base64,' +
  btoa(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n' +
      '4 0 obj<</Length 60>>stream\nBT /F1 18 Tf 40 70 Td (Mock certificate) Tj ET\nendstream\nendobj\n' +
      '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>',
  );

const CERT_AUDITING: ReportCertificate = {
  course_type: 'masterclass',
  course_id: 88,
  course_name: 'Advanced Auditing',
  cpe_credits: 4,
  issued_on: '2026-08-14T10:32:05Z',
  certificate_url: MOCK_PDF,
};
const CERT_ETHICS: ReportCertificate = {
  course_type: 'webinar',
  course_id: 40,
  course_name: 'Ethics in Practice',
  cpe_credits: 2,
  issued_on: '2026-08-20T09:00:00Z',
  certificate_url: MOCK_PDF,
};

/** Jane holds both; Ravi's reels course has a Miles-only certificate → null URL (the API caveat). */
const CERT_USERS: ReportCertificateUser[] = [
  {
    user_id: 501,
    uuid: 'miles-jane01',
    name: 'Jane Doe',
    email: 'jane@google.com',
    certificates: [CERT_AUDITING, CERT_ETHICS],
  },
  {
    user_id: 502,
    uuid: 'miles-ravi02',
    name: 'Ravi Kumar',
    email: 'ravi@google.com',
    certificates: [
      {
        course_type: 'nano_learning',
        course_id: 12,
        course_name: 'Revenue Recognition Reels',
        cpe_credits: 1,
        issued_on: '2026-07-01T12:00:00Z',
        certificate_url: null,
      },
    ],
  },
];

/** `certificates/` — flat for a user, grouped by user for a firm, firm → user for a network. */
function reportCertificates(
  base: string,
  role: MockRole,
  q: URLSearchParams,
): ReportCertificatesResponse {
  const courseId = q.get('course_id');
  const byCourse = (c: ReportCertificate) => !courseId || c.course_id === Number(courseId);
  const users = CERT_USERS.map((u) => ({ ...u, certificates: u.certificates.filter(byCourse) }));
  const userId = q.get('user_id');
  if (userId) {
    const u = users.find((x) => x.user_id === Number(userId));
    return {
      certificates: (u?.certificates ?? []).map((c) => ({
        ...c,
        user_id: u!.user_id,
        uuid: u!.uuid,
        name: u!.name,
        email: u!.email,
      })),
    };
  }
  const networkWide = base === 'superadmin' ? q.has('network_id') : role === 'network';
  if (networkWide) {
    return {
      firms: [
        { firm_id: 16, firm_name: 'Google', users },
        { firm_id: 17, firm_name: 'Amazon', users: [] },
      ],
      unassigned_users: [],
    };
  }
  return { users };
}

function reportUsers(subject: string, params: URLSearchParams): ReportUsersResponse {
  const identities = [
    { user_id: 501, uuid: 'miles-jane01', name: 'Jane Doe', email: 'jane@google.com' },
    { user_id: 502, uuid: 'miles-ravi02', name: 'Ravi Kumar', email: 'ravi@google.com' },
  ].filter((u) => inDateRange(u.user_id, params));
  const page = paginate(identities, params, 30);
  return {
    users: page.rows.map((u, i) =>
      subject === 'webinars'
        ? {
            ...u,
            active_in_last_15_days: i === 0,
            total_webinars_registered: 2 - i,
            total_webinars_attended: 1,
            total_cpe_credits_awarded: 8,
            avg_feedback_per_webinar: 4.4,
            total_certificates_awarded: 1,
          }
        : {
            ...u,
            active_in_last_15_days: i === 0,
            total_courses_completed: 2 - i,
            total_cpe_credits_awarded: 8,
            avg_feedback_per_course: 4.2,
            total_certificates_awarded: 2 - i,
          },
    ),
    pagination_data: page.pagination_data,
  };
}

function reportItems(subject: string, userId: number): ReportItemsResponse {
  const who =
    userId === 502
      ? { name: 'Ravi Kumar', uuid: 'miles-ravi02', email: 'ravi@google.com', user_id: 502 }
      : { name: 'Jane Doe', uuid: 'miles-jane01', email: 'jane@google.com', user_id: 501 };
  if (subject === 'webinars') {
    return {
      items: [
        {
          ...who,
          webinar_id: 40,
          webinar_name: 'Ethics in Practice',
          is_attended: true,
          cpe_credits: 2,
          feedback_rating: 4,
          has_certificate: true,
        },
      ],
    };
  }
  // Mixed course_type rows, so the delivery-type filter chips have work to do.
  return {
    items: [
      {
        ...who,
        course_type: 'masterclass',
        course_id: 88,
        course_name: 'Advanced Auditing',
        cpe_mode: true,
        is_completed: true,
        progress_percent: 100,
        cpe_credits: 4,
        feedback_rating: 4.5,
        has_certificate: true,
      },
      {
        ...who,
        course_type: 'nano_learning',
        course_id: 12,
        course_name: 'Revenue Recognition Reels',
        cpe_mode: true,
        is_completed: false,
        progress_percent: 60,
        cpe_credits: 1,
        feedback_rating: null,
        has_certificate: false,
      },
    ],
  };
}

const REPORT_FILTERS: ReportFilters = {
  delivery_types: ['masterclass', 'nano_learning', 'webinar'],
  fields_of_study: ['Accounting', 'Ethics', 'Others'],
};

const NEW_ADMIN: PartnerAdmin = {
  id: 9,
  email: 'admin@acme.com',
  supabase_uid: 'acc1-mock',
  role: 'firm',
  network: null,
  firm: GOOGLE,
  capabilities: ['report:firm:read', 'user:block'],
  is_active: true,
};

// ---- Wiring ----------------------------------------------------------------

/** Page-number pagination the way every list endpoint does it. */
function paginate<T>(rows: T[], params: URLSearchParams, defaultSize: number) {
  const page = Math.max(1, Number(params.get('page') ?? 1));
  const size = Math.max(1, Number(params.get('page_size') ?? defaultSize));
  const pages = Math.max(1, Math.ceil(rows.length / size));
  return {
    rows: rows.slice((page - 1) * size, page * size),
    pagination_data: {
      total_count: rows.length,
      current_page_number: page,
      next_page: page < pages ? page + 1 : null,
      previous_page: page > 1 ? page - 1 : null,
    },
  };
}

/** Last activity per report identity — what `date_from`/`date_to` filter on. */
const LAST_ACTIVE: Record<number, string> = { 501: '2026-08-20', 502: '2026-07-01' };

function inDateRange(userId: number, params: URLSearchParams): boolean {
  const day = LAST_ACTIVE[userId] ?? '';
  const from = params.get('date_from');
  const to = params.get('date_to');
  return (!from || day >= from) && (!to || day <= to);
}

/** Seats filtered the way the server would, then wrapped in page-number pagination. */
function seatPage(params: URLSearchParams) {
  const status = params.get('status');
  const firmId = params.get('firm_id');
  const search = params.get('search')?.trim().toLowerCase();
  let rows = SEATS;
  if (status && status !== 'all') rows = rows.filter((s) => s.status === status);
  if (firmId) rows = rows.filter((s) => s.firm?.id === Number(firmId));
  if (search) {
    rows = rows.filter((s) =>
      [s.code, s.sent_to_email ?? '', s.applied_by_email ?? '']
        .join(' ')
        .toLowerCase()
        .includes(search),
    );
  }
  const page = paginate(rows, params, 20);
  return { seats: page.rows, pagination_data: page.pagination_data };
}

/**
 * Answer `req` from the fixtures, or null when nothing matches (the caller then
 * forwards to the real API).
 */
export function handleMock(
  req: HttpRequest<unknown>,
  role: MockRole,
  _next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> | null {
  const marker = '/api/partners/';

  const ok = (body: unknown) => of(new HttpResponse({ status: 200, body }));
  const created = (body: unknown) => of(new HttpResponse({ status: 201, body }));
  // Uniform error body, so the panel's message surfacing is exercised too.
  const fail = (status: number, message: string) =>
    throwError(
      () => new HttpErrorResponse({ status, url: req.url, error: { status: false, message } }),
    );
  /** A CSV download with the filename in content-disposition, like the API's. */
  const csv = (fileName: string, rows: string[][]) =>
    of(
      new HttpResponse({
        status: 200,
        body: new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }),
        headers: new HttpHeaders({
          'content-disposition': `attachment; filename="${fileName}"`,
        }),
      }),
    );

  if (!req.url.includes(marker)) return null;

  const path = req.url.slice(req.url.indexOf(marker) + marker.length);
  const query = new URLSearchParams(req.params.toString());

  // Reports — same five leaves under both bases; only the scope rule differs.
  const report =
    /^(superadmin|panel)\/report\/(summary|users|user-items|certificates|filters|export-csv)\/$/.exec(
      path,
    );
  if (req.method === 'GET' && report) {
    const [, base, leaf] = report;
    // `filters/` takes no params; `certificates/` may anchor on user_id instead;
    // everything else on the superadmin base requires exactly one of network_id/firm_id.
    if (
      base === 'superadmin' &&
      leaf !== 'filters' &&
      !(leaf === 'certificates' && query.has('user_id'))
    ) {
      const scoped = [query.get('network_id'), query.get('firm_id')].filter(Boolean).length;
      if (scoped !== 1) return fail(400, 'Pass exactly one of network_id or firm_id.');
    }
    const subject = query.get('subject') ?? 'courses';
    if (leaf === 'summary') return ok(reportSummary(subject));
    if (leaf === 'users') return ok(reportUsers(subject, query));
    if (leaf === 'user-items') {
      const userId = Number(query.get('user_id'));
      return ok(inDateRange(userId, query) ? reportItems(subject, userId) : { items: [] });
    }
    if (leaf === 'filters') return ok(REPORT_FILTERS);
    if (leaf === 'certificates') return ok(reportCertificates(base, role, query));
    return csv(`Partner Report ${subject} ${query.get('view') ?? 'user-summary'}.csv`, [
      ['name', 'email', 'total_cpe_credits_awarded'],
      ['Jane Doe', 'jane@google.com', '8'],
      ['Ravi Kumar', 'ravi@google.com', '8'],
    ]);
  }

  if (req.method === 'GET') {
    // Panel — auto-scoped to the calling admin.
    if (path === 'panel/me/') return ok(ME[role]);
    if (path === 'panel/dashboard/') return ok(DASHBOARD[role]);
    if (path === 'panel/firms/') {
      // A firm admin has no sibling firms to see.
      return ok({ firms: role === 'firm' ? [] : FIRMS.filter((f) => !f.is_standalone) });
    }
    if (path === 'panel/partner-codes/') return ok({ partner_codes: PARTNER_CODES });
    if (path === 'panel/seats/') {
      // Firm admins are pinned server-side, whatever the client sent.
      if (role === 'firm') query.set('firm_id', '18');
      return ok(seatPage(query));
    }
    if (path === 'panel/users/') {
      const search = query.get('search')?.trim().toLowerCase();
      const blocked = query.get('blocked_status');
      let rows = PANEL_USERS.data;
      if (blocked === 'blocked') rows = rows.filter((u) => u.is_blocked);
      if (blocked === 'active') rows = rows.filter((u) => !u.is_blocked);
      if (search) {
        rows = rows.filter((u) =>
          `${u.name} ${u.email} ${u.phone ?? ''}`.toLowerCase().includes(search),
        );
      }
      const page = paginate(rows, query, 30);
      return ok({ data: page.rows, pagination_data: page.pagination_data });
    }
    if (path === 'panel/users/export-csv/') {
      return csv('Partner Users Report.csv', [
        ['Name', 'Email', 'Phone', 'Blocked'],
        ['Jane Doe', 'jane@google.com', '+15551234567', 'No'],
        ['Ravi Kumar', 'ravi@google.com', '+15559876543', 'Yes'],
      ]);
    }

    if (path === 'superadmin/users/') {
      const search = query.get('search')?.trim().toLowerCase();
      const domains = query
        .get('domain')
        ?.split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
      let rows = INTERNAL_USERS;
      if (domains?.length) rows = rows.filter((u) => domains.includes(u.email_domain ?? ''));
      if (search) {
        rows = rows.filter((u) =>
          `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search),
        );
      }
      const page = paginate(rows, query, 30);
      return ok({
        status_code: 200,
        message: 'Users returned successfully!',
        data: page.rows,
        pagination_data: page.pagination_data,
      });
    }

    // Superadmin.
    if (path === 'superadmin/networks/') return ok({ networks: [NETWORK] });
    if (/^superadmin\/networks\/\d+\/$/.test(path)) {
      return ok({ network: NETWORK, firms: FIRMS.filter((f) => !f.is_standalone) });
    }
    if (path === 'superadmin/partner-codes/') return ok({ partner_codes: PARTNER_CODES });
    if (path === 'superadmin/partner-admins/') return ok({ partner_admins: [NEW_ADMIN] });
    if (path === 'superadmin/firms/') {
      const networkId = query.get('network_id');
      if (networkId) return ok({ firms: FIRMS.filter((f) => f.network?.id === Number(networkId)) });
      if (query.get('standalone') === '1')
        return ok({ firms: FIRMS.filter((f) => f.is_standalone) });
      return ok({ firms: FIRMS });
    }
  }

  if (req.method === 'POST') {
    const sendSeat = /^panel\/seats\/(\d+)\/send\/$/.exec(path);
    if (sendSeat) {
      const id = Number(sendSeat[1]);
      const seat = SEATS.find((s) => s.id === id) ?? SEATS[0];
      const email = (req.body as { email?: string } | null)?.email ?? '';
      return ok({
        ...seat,
        status: 'shared',
        sent_to_email: email,
        shared_on: '2026-08-01T00:00:00Z',
      });
    }

    const blockUser = /^panel\/users\/(\d+)\/block-status\/$/.exec(path);
    if (blockUser) {
      const isBlocked = (req.body as { is_blocked?: boolean } | null)?.is_blocked ?? false;
      return ok({ status: true, is_blocked: isBlocked, user_id: Number(blockUser[1]) });
    }

    if (path === 'superadmin/networks/') {
      const body = (req.body ?? {}) as { name?: string; total_seats?: number };
      const total = body.total_seats ?? 0;
      return created({
        ...NETWORK,
        id: 12,
        name: body.name ?? 'New network',
        total_seats: total,
        allocated_seats: 0,
        unallocated_seats: total,
        used_seats: 0,
      });
    }

    if (path === 'superadmin/firms/') {
      const body = (req.body ?? {}) as {
        name?: string;
        network?: number;
        email_domains?: string[];
        admin?: { supabase_uid: string; email?: string };
        allocations?: { count: number }[];
      };
      const minted = (body.allocations ?? []).reduce((sum, a) => sum + (a.count ?? 0), 0);
      return created({
        id: 19,
        name: body.name ?? 'New firm',
        network: body.network != null ? NETWORK_REF : null,
        is_standalone: body.network == null,
        email_domains: body.email_domains ?? [],
        is_active: true,
        allocated_seats: minted,
        used_seats: 0,
        seats_minted: minted,
        ...(body.admin ? { admin: { ...NEW_ADMIN, supabase_uid: body.admin.supabase_uid } } : {}),
      });
    }

    const allocate = /^superadmin\/firms\/(\d+)\/allocate\/$/.exec(path);
    if (allocate) {
      const count = (req.body as { count?: number } | null)?.count ?? 0;
      if (count <= 0) return fail(400, 'count must be greater than 0.');
      return created({ seats_minted: count });
    }

    const assign = /^superadmin\/seats\/(\d+)\/assign-firm\/$/.exec(path);
    if (assign) {
      const id = Number(assign[1]);
      const seat = SEATS.find((s) => s.id === id);
      if (!seat) return fail(404, 'Seat not found.');
      if (seat.firm) return fail(409, 'That seat already belongs to a firm.');
      const firmId = (req.body as { firm?: number } | null)?.firm ?? 0;
      return ok({ id: seat.id, code: seat.code, firm_id: firmId });
    }

    if (path === 'superadmin/partner-codes/') {
      const body = (req.body ?? {}) as {
        code?: string;
        discounted_price?: number;
        description?: string;
        stripe_price_id?: string;
        auto_subscribe?: boolean;
        network?: number;
        firm?: number;
        valid_to?: string;
      };
      return created({
        id: 34,
        code: body.code ?? 'NEW-CODE',
        description: body.description ?? null,
        discounted_price: String(body.discounted_price ?? 0),
        stripe_price_id: body.stripe_price_id ?? null,
        auto_subscribe: body.auto_subscribe ?? false,
        network: body.network != null ? NETWORK_REF : null,
        firm: body.firm != null ? (FIRMS.find((f) => f.id === body.firm) ?? GOOGLE) : null,
        valid_to: body.valid_to ?? null,
        is_active: true,
      } satisfies PartnerCode);
    }

    if (path === 'superadmin/partner-admins/') {
      const body = (req.body ?? {}) as {
        supabase_uid?: string;
        email?: string;
        role?: PartnerAdmin['role'];
        network?: number;
        firm?: number;
        capabilities?: PartnerAdmin['capabilities'];
      };
      return created({
        ...NEW_ADMIN,
        supabase_uid: body.supabase_uid ?? NEW_ADMIN.supabase_uid,
        email: body.email ?? NEW_ADMIN.email,
        role: body.role ?? NEW_ADMIN.role,
        network: body.network != null ? NETWORK_REF : null,
        firm: body.firm != null ? (FIRMS.find((f) => f.id === body.firm) ?? GOOGLE) : null,
        capabilities: body.capabilities ?? [],
      } satisfies PartnerAdmin);
    }

    if (path === 'superadmin/users/') {
      const body = (req.body ?? {}) as { email?: string; partner_code?: string };
      const email = (body.email ?? '').toLowerCase();
      if (INTERNAL_USERS.some((u) => u.email === email)) {
        return fail(409, 'A user with that email already exists.');
      }
      if (body.partner_code && !PARTNER_CODES.some((c) => c.code === body.partner_code)) {
        return fail(400, 'Invalid partner code.');
      }
      return created({ status: true, message: 'User created.' });
    }

    const offlinePayment = /^superadmin\/users\/(\d+)\/offline-payment\/$/.exec(path);
    if (offlinePayment) {
      const body = req.body instanceof FormData ? req.body : new FormData();
      const invoice = body.get('invoice');
      const comment = body.get('comment');
      if (!invoice && !comment) return fail(400, 'Attach an invoice or add a comment.');
      if (invoice && comment) return fail(400, 'Send an invoice or a comment, not both.');
      const userId = Number(offlinePayment[1]);
      // Already subscribed → the proof attaches to the existing transaction;
      // otherwise the proof IS the payment and a subscription is granted now.
      const subscribed = INTERNAL_USERS.find((u) => u.id === userId)?.is_subscribed ?? false;
      const message = invoice
        ? 'Invoice updated.'
        : subscribed
          ? 'Note recorded.'
          : 'Free access recorded.';
      return ok({
        status: true,
        message,
        data: {
          user_id: userId,
          order_id: 812,
          transaction_id: 900,
          payment_id: 'TXN-MOCK-1',
          payment_mode: 'Offline',
          amount_paid: 99,
          subscription_status: 'Active',
          receipt_url: invoice ? 'https://example.com/invoices/mock.pdf' : null,
          payment_note: typeof comment === 'string' ? comment : null,
        },
      });
    }
  }

  if (req.method === 'PATCH' && path === 'superadmin/users/') {
    const body = (req.body ?? {}) as { user_id?: number; partner_code?: string };
    if (!body.user_id || !INTERNAL_USERS.some((u) => u.id === body.user_id)) {
      return fail(404, 'User not found.');
    }
    if (body.partner_code && !PARTNER_CODES.some((c) => c.code === body.partner_code)) {
      return fail(400, 'Invalid partner code.');
    }
    return ok({ status: true, message: 'User updated.' });
  }

  if (req.method === 'PATCH' && /^superadmin\/networks\/\d+\/$/.test(path)) {
    const body = (req.body ?? {}) as { allocations?: { count: number }[] };
    const minted = (body.allocations ?? []).reduce((sum, a) => sum + (a.count ?? 0), 0);
    return ok({
      ...NETWORK,
      allocated_seats: NETWORK.allocated_seats + minted,
      unallocated_seats: NETWORK.unallocated_seats - minted,
      ...(minted > 0 ? { seats_minted: minted } : {}),
    });
  }

  return null;
}
