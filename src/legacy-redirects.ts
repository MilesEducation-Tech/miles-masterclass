import type { Express, NextFunction, Request, Response } from 'express';
import { timezone } from './app/shared/core/constant/timezone';

/**
 * Server-side 30x redirects from the legacy `CPE-Masterclass` URL shape to the
 * v3 `/:country/:profession_type/...` shape.
 *
 * Background: the old app served every feature under a flat `/accounting/...`
 * prefix (plus a few partner paths under `/partnerships/...`). v3 nests
 * everything under `/:country/:profession_type/...` (default country resolved
 * from geo, profession always `accounting`). Without these redirects an old
 * deep link such as `/accounting/masterclass` is parsed by the v3 router as
 * `country=accounting / profession_type=masterclass`, fails
 * `validateProfessionCountryGuard`, and dumps the user at `/us/accounting` —
 * silently losing the deep link. See ROUTE_REDIRECT_MIGRATION_PLAN.md.
 *
 * This must be registered BEFORE the static + Angular catch-all handlers in
 * `server.ts` (it already is, right after `registerSeoRoutes`). It only ever
 * acts on known legacy patterns; every other path passes straight through.
 */

/**
 * Valid ISO2 country codes, sourced from the SAME `timezone` constant that
 * `validateProfessionCountryGuard` validates against — so a country we redirect
 * to can never be rejected by the guard on arrival.
 */
const LEGACY_ISO2: ReadonlySet<string> = new Set(timezone.map((t) => t.iso2.toLowerCase()));

/** Profession segment is fixed for the accounting product. */
const PROFESSION = 'accounting';

/**
 * Placeholder `:courseTitle` slugs per offering. The old feedback /
 * final-assessment URLs carried a course id but no title slug; v3's
 * `:courseId/:courseTitle` routes only use the title for display/SEO, so a
 * stable placeholder lets us preserve the course id and land on the right page.
 */
const COURSE_TITLE: Record<string, string> = {
  masterclass: 'masterclass-course',
  podcast: 'podcast-course',
  'micro-learning': 'micro-learning-course',
};

/**
 * Pick the country for a premiere URL that may already carry one. If the URL
 * captured a valid ISO2 (`/in/accounting/premiere/...`) we preserve it;
 * otherwise we emit the `{c}` placeholder so the geo-resolved country is filled
 * in (matches the legacy `/accounting/premiere/...` shape with no country).
 */
const pickCountry = (captured?: string): string =>
  captured && LEGACY_ISO2.has(captured) ? captured : '{c}';

/**
 * Specific rename / reshape rules, evaluated in order BEFORE the generic
 * prefix rule below. Tuple = [matcher, build(target), permanent].
 *   permanent=true  → 308 (≈301): stable marketing/content URLs (SEO equity)
 *   permanent=false → 307 (≈302): auth-gated, transient, best-effort, or
 *                                  deprecated fallbacks whose target may change
 *
 * `{c}` is replaced with the resolved country and `{p}` with the profession.
 */
type Rule = readonly [RegExp, (m: RegExpMatchArray) => string, boolean];

const RULES: readonly Rule[] = [
  // ---- terms (plural → singular; mobile webview variant) -----------------
  [/^\/accounting\/terms-of-services-mobile\/?$/, () => '/{c}/{p}/mobile/terms-of-service', true],
  [/^\/accounting\/terms-of-services\/?$/, () => '/{c}/{p}/terms-of-service', true],

  // ---- premiere → webinar -------------------------------------------------
  // Matches BOTH the legacy prefix (`/accounting/premiere/...`) and the v3
  // prefix that still carries the old name (`/<cc>/accounting/premiere/...`) —
  // those exist because some links kept `premiere` under the new
  // country/profession structure. The optional `([a-z]{2})` group preserves an
  // existing country; absent/invalid → `{c}` (geo). Specific sub-pages MUST be
  // listed before the generic rename so each lands on a VALID v3 route.

  // feedback: old `:id` = course id → webinar feedback with placeholder title
  [
    /^(?:\/([a-z]{2}))?\/accounting\/premiere\/([^/]+)\/feedback(?:\/.*)?$/,
    (m) => `/${pickCountry(m[1])}/accounting/webinar/${m[2]}/webinar/feedback`,
    false,
  ],
  // instructor/expert page → top-level /instructor/:id/:name
  [
    /^(?:\/([a-z]{2}))?\/accounting\/premiere\/([^/]+)\/expert\/([^/]+)\/?$/,
    (m) => `/${pickCountry(m[1])}/accounting/instructor/${m[2]}/${m[3]}`,
    true,
  ],
  // details with ONLY an id (no title slug — the common webinar-details link
  // `navigateTo('accounting/premiere/'+id)`). v3 needs `:courseId/:courseTitle`,
  // so add the `webinar` placeholder title; otherwise `/webinar/:id` is a 404.
  [
    /^(?:\/([a-z]{2}))?\/accounting\/premiere\/([^/]+)\/?$/,
    (m) => `/${pickCountry(m[1])}/accounting/webinar/${m[2]}/webinar`,
    true,
  ],
  // listing (no id) + details WITH a title slug (`:id/:name`) — plain rename
  [
    /^(?:\/([a-z]{2}))?\/accounting\/premiere(\/.*)?$/,
    (m) => `/${pickCountry(m[1])}/accounting/webinar${m[2] ?? ''}`,
    true,
  ],

  // ---- renamed features --------------------------------------------------
  [
    /^\/accounting\/credly(?:\/how-to-claim)?\/?$/,
    () => '/{c}/{p}/how-to-claim-credly-badge',
    true,
  ],
  [/^\/accounting\/order\/?$/, () => '/{c}/{p}/payment/order-history', false],
  [/^\/accounting\/plan\/?$/, () => '/{c}/{p}/payment/plan', true],
  [/^\/accounting\/library\/masters-of-ai\/?$/, () => '/{c}/{p}/library/instructor-library', true],

  // ---- instructor page moved out from under masterclass/podcast ----------
  [
    /^\/accounting\/(?:masterclass|podcast)\/([^/]+)\/expert\/([^/]+)\/?$/,
    (m) => `/{c}/{p}/instructor/${m[1]}/${m[2]}`,
    true,
  ],

  // ---- final-assessment ---------------------------------------------------
  // Exam START: old `:id` is the COURSE id (course-exam-rules.component.ts) →
  // route to the course landing with a placeholder title; the learner
  // re-launches the exam there. The `/report` variant's `:id` is a sessionId
  // (not a course id) and can't be mapped to a course → listing fallback.
  [
    /^\/accounting\/(masterclass|podcast|micro-learning)\/final-assessment\/exam\/[^/]+\/report\/?$/,
    (m) => `/{c}/{p}/${m[1]}`,
    false,
  ],
  [
    /^\/accounting\/(masterclass|podcast|micro-learning)\/final-assessment\/exam\/([^/]+)\/?$/,
    (m) => `/{c}/{p}/${m[1]}/${m[2]}/${COURSE_TITLE[m[1]]}`,
    false,
  ],

  // ---- course feedback: old `:id` is the COURSE id; v3 needs
  //      `:courseId/:courseTitle/feedback`. Placeholder title per offering. --
  [
    /^\/accounting\/masterclass\/([^/]+)\/feedback(?:\/.*)?$/,
    (m) => `/{c}/{p}/masterclass/${m[1]}/masterclass-course/feedback`,
    false,
  ],
  [
    /^\/accounting\/podcast\/([^/]+)\/feedback(?:\/.*)?$/,
    (m) => `/{c}/{p}/podcast/${m[1]}/podcast-course/feedback`,
    false,
  ],
  [
    /^\/accounting\/micro-learning\/([^/]+)\/feedback(?:\/.*)?$/,
    (m) => `/{c}/{p}/micro-learning/${m[1]}/micro-learning-course/feedback`,
    false,
  ],

  // ---- micro-learning: the old route carried a listing-filter segment ------
  // Legacy shape was `/micro-learning/:type/:id/:title` where `:type` is one of
  // the six listing filters below (see the old `routeType` route data). v3
  // dropped the segment — filters are in-page state — so its course route is
  // just `:courseId/:courseTitle`. Without this rule the generic prefix rule
  // emits `/micro-learning/course/29/slug`, which v3 parses as
  // courseId=`course` / courseTitle=`29` + an unmatched child → page-not-found.
  // The title is optional so a truncated `/micro-learning/course/29` still
  // lands on course 29 (with the placeholder slug) instead of loading a course
  // literally named `course`.
  [
    /^\/accounting\/micro-learning\/(?:explore|track|bookmark|completed|inprogress|course)\/([^/]+)(?:\/([^/]+))?\/?$/,
    (m) => `/{c}/{p}/micro-learning/${m[1]}/${m[2] ?? COURSE_TITLE['micro-learning']}`,
    true,
  ],
  // Bare filter segment (`/micro-learning/explore`) → the v3 listing page.
  [
    /^\/accounting\/micro-learning\/(?:explore|track|bookmark|completed|inprogress|course)\/?$/,
    () => '/{c}/{p}/micro-learning',
    true,
  ],

  // ---- deprecated in v3 → interim fallback (307 so target can change once
  //      product decides; see ROUTE_REDIRECT_MIGRATION_PLAN.md §4.4) --------
  [/^\/accounting\/library\/ai-library\/?$/, () => '/{c}/{p}/library/course-library', false],
  // No v3 equivalent: the old marketing invite for industry professionals to
  // teach a Masterclass. v3's `/faculty` is a different programme (AI-in-
  // Accounting courses for educators), so it is NOT the successor page.
  [/^\/accounting\/become-an-instructor\/?$/, () => '/{c}/{p}/home', false],
  // Old staff-only sitemap GENERATOR tool; v3 serves `/sitemap.xml` from the
  // server instead, so the tool page has no user-facing successor.
  [/^\/accounting\/sitemap\/?$/, () => '/{c}/{p}/home', false],
  [/^\/accounting\/guides(?:\/.*)?$/, () => '/{c}/{p}/home', false],
  [/^\/accounting\/help-desk\/?$/, () => '/{c}/{p}/connect-us', false],
  [/^\/accounting\/credits\/?$/, () => '/{c}/{p}/home', false],
  [/^\/accounting\/learning-pathway\/.*$/, () => '/{c}/{p}/masterclass', false],

  // ---- partners (subdomain + /partnerships/* consolidate here) -----------
  [/^\/partnerships\/boomer\/?$/, () => '/{c}/{p}/partners/boomer-knowledge-network', true],
  [/^\/partnerships\/icpas\/?$/, () => '/{c}/{p}/partners/illinois-society-of-cpas', true],
  [/^\/partnerships\/dscpa\/?$/, () => '/{c}/{p}/partners/delaware-society-of-cpas', true],
  [/^\/partnerships\/ctcpa\/?$/, () => '/{c}/{p}/partners/connecticut-society-of-cpas', true],
  [/^\/partnerships\/hscpa\/?$/, () => '/{c}/{p}/partners/hawaii-society-of-cpas', true],
  [/^\/partnerships\/?$/, () => '/{c}/{p}', false],

  // ---- admin section renames (internal; 307) -----------------------------
  [/^\/admin\/dashboard\/reports\/?$/, () => '/admin/reports/users', false],
  [/^\/admin\/dashboard\/seo-manager\/?$/, () => '/admin/seo', false],
];

/** True for any path we might rewrite — everything else is left untouched. */
function isLegacyPath(path: string): boolean {
  return (
    /^\/(accounting|partnerships)(\/|$)/.test(path) ||
    // v3-prefixed but stale `premiere` name: /<cc>/accounting/premiere/...
    /^\/[a-z]{2}\/accounting\/premiere(\/|$)/.test(path) ||
    /^\/admin\/dashboard\/(reports|seo-manager)\/?$/.test(path)
  );
}

/** Resolve a Vercel geo country header to a valid lowercased ISO2, default `us`. */
function resolveCountry(ipCountryHeader: string | undefined): string {
  const c = (ipCountryHeader ?? '').toLowerCase();
  return LEGACY_ISO2.has(c) ? c : 'us';
}

export interface LegacyRedirect {
  target: string;
  /** 308 (permanent) or 307 (temporary). */
  status: 307 | 308;
}

/**
 * Pure mapping used by both the Express handler and the unit tests.
 * Returns `null` when the path is not a legacy URL (caller should pass through).
 *
 * @param path        request path WITHOUT query string (Express `req.path`)
 * @param ipCountry   value of the `x-vercel-ip-country` header (optional)
 */
export function mapLegacyPath(path: string, ipCountry?: string): LegacyRedirect | null {
  if (!isLegacyPath(path)) return null;

  const country = resolveCountry(ipCountry);
  const fill = (s: string) => s.replace('{c}', country).replace('{p}', PROFESSION);

  // Specific rules first.
  for (const [re, build, permanent] of RULES) {
    const m = path.match(re);
    if (m) return { target: fill(build(m)), status: permanent ? 308 : 307 };
  }

  // Generic prefix rule: /accounting/<rest> → /<country>/accounting/<rest>.
  // Auth-gated / transient sections use 307 so they aren't permanently cached.
  if (/^\/accounting(\/|$)/.test(path)) {
    const target = `/${country}` + path; // path already begins with `/accounting`
    const permanent = !/^\/accounting\/(payment|cpe-tracker)(\/|$)/.test(path);
    return { target, status: permanent ? 308 : 307 };
  }

  return null;
}

/**
 * Mounts the legacy-redirect handler. Only GET/HEAD are redirected (legacy
 * bookmarks/links are always GETs); anything else passes through. The original
 * query string is reattached to the `Location` so UTM / `dXRt` params survive.
 */
export function registerLegacyRedirects(app: Express): void {
  app.use(legacyRedirectHandler);
}

/**
 * The Express middleware body, exported for unit testing. Redirects legacy URLs
 * to their v3 equivalent and cleans up stray duplicate slashes on otherwise
 * valid paths.
 */
export function legacyRedirectHandler(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const hit = mapLegacyPath(req.path, asHeader(req.headers['x-vercel-ip-country']));
  if (!hit) return next();

  const qIndex = req.originalUrl.indexOf('?');
  const qs = qIndex === -1 ? '' : req.originalUrl.slice(qIndex);
  res.redirect(hit.status, hit.target + qs);
}

/** Normalize a possibly-array header to a single string. */
function asHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
