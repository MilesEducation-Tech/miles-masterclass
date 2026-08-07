import { describe, expect, it } from 'vitest';
import { legacyRedirectHandler, mapLegacyPath, type LegacyRedirect } from './legacy-redirects';

/**
 * Table-driven coverage of the legacy → v3 redirect map. Each row is
 * [inputPath, ipCountryHeader, expectedTarget|null, expectedStatus|null].
 * A null expected target means "not a legacy URL — must pass through".
 */
type Case = [string, string | undefined, string | null, 307 | 308 | null];

const CASES: Case[] = [
  // --- direct prefix change only (permanent) ---
  ['/accounting', 'US', '/us/accounting', 308],
  ['/accounting/home', 'US', '/us/accounting/home', 308],
  ['/accounting/masterclass', 'US', '/us/accounting/masterclass', 308],
  [
    '/accounting/masterclass/42/calculus-101',
    'US',
    '/us/accounting/masterclass/42/calculus-101',
    308,
  ],
  [
    '/accounting/masterclass/42/calculus-101/chapter/7/intro',
    'US',
    '/us/accounting/masterclass/42/calculus-101/chapter/7/intro',
    308,
  ],
  ['/accounting/podcast/9/series', 'US', '/us/accounting/podcast/9/series', 308],
  ['/accounting/micro-learning', 'US', '/us/accounting/micro-learning', 308],
  ['/accounting/faq', 'US', '/us/accounting/faq', 308],
  ['/accounting/connect-us', 'US', '/us/accounting/connect-us', 308],
  ['/accounting/cpe-for-corporate', 'US', '/us/accounting/cpe-for-corporate', 308],
  ['/accounting/caira', 'US', '/us/accounting/caira', 308],
  ['/accounting/library/course-library', 'US', '/us/accounting/library/course-library', 308],
  ['/accounting/library/badge-library', 'US', '/us/accounting/library/badge-library', 308],

  // --- auth-gated / transient (temporary) ---
  ['/accounting/cpe-tracker', 'US', '/us/accounting/cpe-tracker', 307],
  ['/accounting/payment', 'US', '/us/accounting/payment', 307],
  ['/accounting/payment/plan', 'US', '/us/accounting/payment/plan', 307],
  ['/accounting/payment/cart', 'US', '/us/accounting/payment/cart', 307],
  ['/accounting/payment/invoice/ORD123', 'US', '/us/accounting/payment/invoice/ORD123', 307],

  // --- geo resolution ---
  ['/accounting/masterclass', 'IN', '/in/accounting/masterclass', 308],
  ['/accounting/masterclass', 'XX', '/us/accounting/masterclass', 308], // unknown ISO2 → us
  ['/accounting/masterclass', undefined, '/us/accounting/masterclass', 308], // no header → us

  // --- renamed / reshaped ---
  ['/accounting/plan', 'US', '/us/accounting/payment/plan', 308],
  ['/accounting/order', 'US', '/us/accounting/payment/order-history', 307],
  // premiere → webinar (legacy prefix, geo country)
  ['/accounting/premiere', 'US', '/us/accounting/webinar', 308], // listing
  ['/accounting/premiere/123', 'US', '/us/accounting/webinar/123/webinar', 308], // details, id only → placeholder title
  ['/accounting/premiere/55/keynote', 'US', '/us/accounting/webinar/55/keynote', 308], // details, id + slug
  ['/accounting/premiere/12/expert/jane-doe', 'US', '/us/accounting/instructor/12/jane-doe', 308], // instructor
  // premiere → webinar (already v3-prefixed with a country code — preserve the URL country)
  ['/in/accounting/premiere', 'US', '/in/accounting/webinar', 308],
  ['/in/accounting/premiere/123', 'US', '/in/accounting/webinar/123/webinar', 308],
  ['/us/accounting/premiere/55/keynote', 'IN', '/us/accounting/webinar/55/keynote', 308], // URL country wins over geo
  ['/in/accounting/premiere/7/feedback/6', 'US', '/in/accounting/webinar/7/webinar/feedback', 307],
  ['/zz/accounting/premiere/9', 'IN', '/in/accounting/webinar/9/webinar', 308], // invalid URL country → geo fallback
  ['/accounting/terms-of-services', 'US', '/us/accounting/terms-of-service', 308],
  ['/accounting/terms-of-services-mobile', 'US', '/us/accounting/mobile/terms-of-service', 308],
  ['/accounting/credly', 'US', '/us/accounting/how-to-claim-credly-badge', 308],
  ['/accounting/credly/how-to-claim', 'US', '/us/accounting/how-to-claim-credly-badge', 308],
  [
    '/accounting/masterclass/12/expert/jane-doe',
    'US',
    '/us/accounting/instructor/12/jane-doe',
    308,
  ],
  ['/accounting/podcast/8/expert/jo', 'US', '/us/accounting/instructor/8/jo', 308],
  ['/accounting/library/masters-of-ai', 'US', '/us/accounting/library/instructor-library', 308],

  // --- course feedback: course id preserved + placeholder title (307) ---
  [
    '/accounting/masterclass/88/feedback/post',
    'US',
    '/us/accounting/masterclass/88/masterclass-course/feedback',
    307,
  ],
  [
    '/accounting/podcast/3/feedback/post',
    'US',
    '/us/accounting/podcast/3/podcast-course/feedback',
    307,
  ],
  [
    '/accounting/micro-learning/5/feedback/post',
    'US',
    '/us/accounting/micro-learning/5/micro-learning-course/feedback',
    307,
  ],
  ['/accounting/premiere/7/feedback/6', 'US', '/us/accounting/webinar/7/webinar/feedback', 307],

  // --- final-assessment exam START: old id is the course id → course landing + placeholder title (307) ---
  [
    '/accounting/masterclass/final-assessment/exam/88',
    'US',
    '/us/accounting/masterclass/88/masterclass-course',
    307,
  ],
  [
    '/accounting/podcast/final-assessment/exam/9',
    'US',
    '/us/accounting/podcast/9/podcast-course',
    307,
  ],
  [
    '/accounting/micro-learning/final-assessment/exam/5',
    'US',
    '/us/accounting/micro-learning/5/micro-learning-course',
    307,
  ],

  // --- final-assessment REPORT: old id is a sessionId (no course context) → listing fallback (307) ---
  [
    '/accounting/masterclass/final-assessment/exam/88/report',
    'US',
    '/us/accounting/masterclass',
    307,
  ],
  ['/accounting/podcast/final-assessment/exam/12/report', 'US', '/us/accounting/podcast', 307],

  // --- deprecated (interim fallback) ---
  ['/accounting/guides', 'US', '/us/accounting/home', 307],
  ['/accounting/guides/tax/how-to', 'US', '/us/accounting/home', 307],
  ['/accounting/help-desk', 'US', '/us/accounting/connect-us', 307],
  ['/accounting/credits', 'US', '/us/accounting/home', 307],
  ['/accounting/learning-pathway/p1/22/topic', 'US', '/us/accounting/masterclass', 307],
  ['/accounting/library/ai-library', 'US', '/us/accounting/library/course-library', 307],

  // --- partners ---
  ['/partnerships/boomer', 'US', '/us/accounting/partners/boomer-knowledge-network', 308],
  ['/partnerships/icpas', 'US', '/us/accounting/partners/illinois-society-of-cpas', 308],
  ['/partnerships/dscpa', 'US', '/us/accounting/partners/delaware-society-of-cpas', 308],
  ['/partnerships/ctcpa', 'US', '/us/accounting/partners/connecticut-society-of-cpas', 308],
  ['/partnerships/hscpa', 'US', '/us/accounting/partners/hawaii-society-of-cpas', 308],

  // --- admin renames ---
  ['/admin/dashboard/reports', 'US', '/admin/reports/users', 307],
  ['/admin/dashboard/seo-manager', 'US', '/admin/seo', 307],

  // --- MUST NOT TOUCH (pass through) ---
  ['/auth/login', 'US', null, null],
  ['/admin/seo', 'US', null, null],
  ['/admin/login', 'US', null, null],
  ['/blog/some-post', 'US', null, null],
  ['/us/accounting/masterclass', 'US', null, null], // already correct
  ['/in/accounting/webinar/55/keynote', 'IN', null, null], // already-correct v3 webinar (not premiere)
  ['/in/accounting/masterclass', 'IN', null, null], // v3-prefixed non-premiere — untouched
  ['/compliance', 'US', null, null],
  ['/assets/app.js', 'US', null, null],
];

describe('mapLegacyPath', () => {
  it.each(CASES)('%s (geo=%s) → %s', (path, geo, expectedTarget, expectedStatus) => {
    const result: LegacyRedirect | null = mapLegacyPath(path, geo);
    if (expectedTarget === null) {
      expect(result).toBeNull();
    } else {
      expect(result).not.toBeNull();
      expect(result!.target).toBe(expectedTarget);
      expect(result!.status).toBe(expectedStatus);
    }
  });

  it('preserves the country only when it is a valid ISO2', () => {
    expect(mapLegacyPath('/accounting/home', 'ae')!.target).toBe('/ae/accounting/home');
    expect(mapLegacyPath('/accounting/home', 'zz')!.target).toBe('/us/accounting/home');
  });

  it('never rewrites an already-correct v3 URL', () => {
    expect(mapLegacyPath('/in/accounting/masterclass', 'in')).toBeNull();
  });
});

describe('legacyRedirectHandler (Express middleware)', () => {
  interface Captured {
    status?: number;
    location?: string;
    nexted?: boolean;
  }
  function run(path: string, originalUrl = path, method = 'GET'): Captured {
    const cap: Captured = {};
    const req = { method, path, originalUrl, headers: {} } as never as Parameters<
      typeof legacyRedirectHandler
    >[0];
    const res = {
      redirect: (s: number, l: string) => {
        cap.status = s;
        cap.location = l;
      },
    } as never as Parameters<typeof legacyRedirectHandler>[1];
    const next = (() => {
      cap.nexted = true;
    }) as never as Parameters<typeof legacyRedirectHandler>[2];
    legacyRedirectHandler(req, res, next);
    return cap;
  }

  it('redirects a legacy premiere details URL (one hop)', () => {
    expect(run('/in/accounting/premiere/143/ai-101')).toEqual({
      status: 308,
      location: '/in/accounting/webinar/143/ai-101',
    });
  });

  it('redirects an id-only webinar details link with placeholder title', () => {
    expect(run('/in/accounting/premiere/143')).toEqual({
      status: 308,
      location: '/in/accounting/webinar/143/webinar',
    });
  });

  it('passes a clean, non-legacy URL straight through', () => {
    expect(run('/in/accounting/webinar/143/slug')).toEqual({ nexted: true });
  });

  it('preserves the query string on redirect', () => {
    expect(run('/accounting/masterclass', '/accounting/masterclass?utm=x').location).toBe(
      '/us/accounting/masterclass?utm=x',
    );
  });

  it('does not redirect non-GET/HEAD requests', () => {
    expect(run('/in/accounting/premiere/143/x', '/in/accounting/premiere/143/x', 'POST')).toEqual({
      nexted: true,
    });
  });
});
