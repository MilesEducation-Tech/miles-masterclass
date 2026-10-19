/**
 * SEO endpoints (`/robots.txt` + `/sitemap.xml`) served by the SSR Express
 * server in `src/server.ts`.
 *
 * Why server-side and not static files in `public/`:
 *   - `robots.txt` is **host-aware** — only the production hostnames advertise
 *     themselves as indexable; every preview / UAT / localhost host returns
 *     `Disallow: /` so Google never indexes a `*.vercel.app` duplicate.
 *   - `sitemap.xml` lists the static pages plus the **live webinars** and the
 *     **masterclass courses** from the web API, so a new webinar or course
 *     shows up without a redeploy (cached in-memory, see `SITEMAP_TTL_MS`).
 *     Podcast, micro-learning and instructor URLs are not listed: those pages
 *     still run on legacy ids with no public web feed.
 *
 * Both routes are registered before `express.static` + the Angular catch-all so
 * they win over the SPA shell (which is why the SEO audit saw HTML at these
 * paths — nothing served them, so they fell through to Angular).
 */
import type { Express, Request, Response } from 'express';
import { environment } from './environments/environment';
import { CANONICAL_COUNTRY, CANONICAL_PROFESSION } from './app/core/models/seo.constants';

/**
 * Canonical production origin for every absolute URL the sitemap emits.
 * Defaults to the build's `environment.SITE_URL` (so the prod build advertises
 * `.com` and the UAT build `.us`), matching the canonical/og:url tags the app
 * emits. Override without a redeploy via `SITE_ORIGIN`.
 */
const SITE_ORIGIN = (process.env['SITE_ORIGIN'] ?? environment.SITE_URL).replace(/\/+$/, '');

/**
 * Canonical locale segment. The app serves identical content under every
 * `/:country/:profession` prefix, so we list exactly ONE to avoid
 * duplicate-content URLs. Shared with `CANONICAL_LOCALE_PREFIX` (seo.constants)
 * so the sitemap and the app's canonical tags always agree. Override via
 * `SITEMAP_COUNTRY`.
 */
const COUNTRY = (process.env['SITEMAP_COUNTRY'] ?? CANONICAL_COUNTRY).toLowerCase();
const PROFESSION = CANONICAL_PROFESSION;
const PREFIX = `/${COUNTRY}/${PROFESSION}`;

/**
 * Backend API base. Defaults to the build's environment (so a UAT build hits
 * the UAT API), with a trailing slash trimmed. Override via `SITEMAP_API_BASE`.
 */
const API_BASE = (process.env['SITEMAP_API_BASE'] ?? environment.BASE_API_URL).replace(/\/+$/, '');

/** How long a generated sitemap is reused before regeneration (default 6h). */
const SITEMAP_TTL_MS = Number(process.env['SITEMAP_TTL_MS'] ?? 6 * 60 * 60 * 1000);

/**
 * Hostnames allowed to declare themselves indexable in `robots.txt`. Every
 * other host (vercel previews, UAT, localhost) gets `Disallow: /`.
 */
const PRODUCTION_HOSTS = new Set([
  'milesmasterclass.us',
  'www.milesmasterclass.us',
  'milesmasterclass.com',
  'www.milesmasterclass.com',
]);

/**
 * Public, crawlable static pages (relative to `PREFIX`). Authenticated or
 * no-SEO-value routes (chapters, exams, feedback, payment checkout, mobile
 * webviews, admin, auth) are intentionally excluded and also blocked in
 * robots.txt — except the public `payment/plan` pricing page, which is
 * included here and carved out of the robots `payment` disallow.
 */
const STATIC_PATHS = [
  'home',
  'masterclass',
  'podcast',
  'webinar',
  'micro-learning',
  'library/course-library',
  'library/instructor-library',
  'library/badge-library',
  'faq',
  'terms-of-service',
  'privacy-policy',
  'connect-us',
  // Public subscription-plan / pricing page (no auth; checkout steps below it
  // stay excluded).
  'payment/plan',
  // Partner / CPA-society landing pages (public marketing, no auth — see
  // features/partners/partner.routes.ts).
  'caira',
  'cpe-for-corporate',
  'partners/boomer-knowledge-network',
  'partners/connecticut-society-of-cpas',
  'partners/delaware-society-of-cpas',
  'partners/illinois-society-of-cpas',
  'partners/hawaii-society-of-cpas',
  'partners/cpacanada',
];

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Static page URLs — always available even if the webinar API is unreachable. */
function staticLocs(): string[] {
  return STATIC_PATHS.map((path) => `${SITE_ORIGIN}${PREFIX}/${path}`);
}

/**
 * A webinar's sitemap entry. UUID only, and no title — the canonical detail URL
 * is `webinar/:id` with no slug segment.
 */
interface WebinarLoc {
  id: string;
}

/** A feed bucket: the paginated block (`results` holds the rows), or a bare list. */
type WebinarBucket = { id?: string }[] | { results?: { id?: string }[] };

/**
 * Crawlable webinars, from the Events v1 landing feed.
 *
 * `?login_type=pre_login` is the anonymous surface and the endpoint is
 * `AllowAny`, so this needs no token — which is what makes it usable from a
 * sitemap generator. Only the two forward-looking buckets are listed: the three
 * backward-looking ones are statements about a BOOKING and are empty without a
 * token anyway.
 *
 * Ids are UUIDs. The legacy `webinar/filter/` feed this replaced returned the
 * integer `webinar_id_as_per_mf_sf`, which the detail page cannot resolve —
 * the contract is explicit that the id is the UUID and never that integer.
 */
async function fetchWebinars(): Promise<WebinarLoc[]> {
  const response = await fetch(
    // Each bucket is paged at 6 by default; ask for the ceiling so none is cut.
    `${API_BASE}/web-api/v1/events/webinar-main-page/?login_type=pre_login` +
      '&highlight_webinars.page_size=100&upcoming_webinars.page_size=100',
    { headers: { accept: 'application/json' } },
  );
  if (!response.ok) return [];
  const json = (await response.json()) as { data?: Record<string, WebinarBucket | undefined> };
  const buckets = [json.data?.['highlight_webinars'], json.data?.['upcoming_webinars']];

  const ids = new Set<string>();
  for (const bucket of buckets) {
    // Every bucket is a paginated block since 2026-10-09; iterating the block
    // itself threw, and the `.catch` in `collectLocs` dropped every webinar.
    const rows = Array.isArray(bucket) ? bucket : (bucket?.results ?? []);
    for (const row of rows) {
      if (typeof row?.id === 'string' && row.id) ids.add(row.id);
    }
  }
  return [...ids].map((id) => ({ id }));
}

/** A masterclass course's sitemap entry: `masterclass/:id/:slug`. */
interface CourseLoc {
  id: string;
  slug: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** 100 per page; 10 pages is ten times today's catalogue (64 on 2026-10-19). */
const COURSE_PAGE_SIZE = 100;
const COURSE_PAGE_LIMIT = 10;
/** Per request, so a hung API can't hold the sitemap (and the crawler) open. */
const COURSE_FETCH_TIMEOUT_MS = 8000;

/**
 * Public masterclass courses, from the web course filter. It is `AllowAny` and
 * takes no `login_type`, so it needs no token.
 *
 * The URL uses the feed's `slug`, which the course page keeps in its canonical
 * (`setupCourseSeo`), so each `<loc>` equals its page's canonical. A row whose
 * id or slug doesn't look like one is dropped rather than put into a URL.
 */
async function fetchCourses(): Promise<CourseLoc[]> {
  const courses: CourseLoc[] = [];
  for (let page = 1; page <= COURSE_PAGE_LIMIT; page++) {
    const response = await fetch(
      `${API_BASE}/web-api/v1/masterclass/filter/?content_type=masterclass_course` +
        `&page_size=${COURSE_PAGE_SIZE}&page=${page}`,
      {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(COURSE_FETCH_TIMEOUT_MS),
      },
    );
    if (!response.ok) break;
    const json = (await response.json()) as {
      data?: { courses?: { has_next?: boolean; results?: { id?: unknown; slug?: unknown }[] } };
    };
    const block = json.data?.courses;
    for (const row of block?.results ?? []) {
      const { id, slug } = row;
      if (typeof id === 'string' && UUID.test(id) && typeof slug === 'string' && SLUG.test(slug)) {
        courses.push({ id, slug });
      }
    }
    if (!block?.has_next) break;
  }
  return courses;
}

/** Gather every crawlable absolute URL. An API failure degrades gracefully. */
async function collectLocs(): Promise<string[]> {
  const locs = new Set<string>(staticLocs());

  // One segment, no title slug: `webinar/:id` is the canonical detail URL the
  // page itself emits. The two-segment form still resolves, but only via a 302,
  // and a sitemap full of redirects is a sitemap search engines discount.
  const webinars = await fetchWebinars().catch(() => [] as WebinarLoc[]);
  for (const webinar of webinars) {
    locs.add(`${SITE_ORIGIN}${PREFIX}/webinar/${webinar.id}`);
  }

  const courses = await fetchCourses().catch(() => [] as CourseLoc[]);
  for (const course of courses) {
    locs.add(`${SITE_ORIGIN}${PREFIX}/masterclass/${course.id}/${course.slug}`);
  }

  return [...locs];
}

function buildSitemapXml(locs: string[]): string {
  const urls = locs.map((loc) => `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n  </url>`).join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${urls}\n` +
    '</urlset>\n'
  );
}

/**
 * Sitemap index pointing at the single URL sitemap. `/sitemap_index.xml`
 * previously 404'd (audit finding); a crawler that probes the index path now
 * gets a valid document, and `<lastmod>` advertises when the URL set was last
 * regenerated so Google can prioritise re-crawls. `generatedAt` is the
 * generation time of the cached `/sitemap.xml` (falls back to now if the URL
 * sitemap hasn't been built yet this cold start).
 */
function buildSitemapIndexXml(generatedAt: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '  <sitemap>\n' +
    `    <loc>${xmlEscape(`${SITE_ORIGIN}/sitemap.xml`)}</loc>\n` +
    `    <lastmod>${generatedAt}</lastmod>\n` +
    '  </sitemap>\n' +
    '</sitemapindex>\n'
  );
}

// In-memory cache + single-flight guard so concurrent crawler hits trigger at
// most one sitemap build. Reset on every cold start, which is fine — the first
// request after a deploy simply repopulates it. `generatedAt` (ISO) backs the
// sitemap-index `<lastmod>`.
let cache: { xml: string; expires: number; generatedAt: string } | null = null;
let inflight: Promise<string> | null = null;

async function getSitemapXml(): Promise<string> {
  if (cache && cache.expires > Date.now()) return cache.xml;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const xml = buildSitemapXml(await collectLocs());
      cache = {
        xml,
        expires: Date.now() + SITEMAP_TTL_MS,
        generatedAt: new Date().toISOString(),
      };
      return xml;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** ISO timestamp of the cached URL sitemap, or now if not yet generated. */
function sitemapGeneratedAt(): string {
  return cache?.generatedAt ?? new Date().toISOString();
}

const PROD_ROBOTS = `User-agent: *
Allow: /

# Authenticated / no-SEO-value areas
Disallow: /admin
Disallow: /api/
Disallow: /blog-test
Allow: /*/payment/plan
Disallow: /*/payment
Disallow: /*/chapter/
Disallow: /*/final-assessment/
Disallow: /*/feedback
Disallow: /*/mobile/

Sitemap: ${SITE_ORIGIN}/sitemap_index.xml
Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;

const NONPROD_ROBOTS = `User-agent: *
Disallow: /
`;

/**
 * Register the SEO routes. Must be called BEFORE `express.static` and the
 * Angular catch-all in `src/server.ts`.
 */
export function registerSeoRoutes(app: Express): void {
  app.get('/robots.txt', (req: Request, res: Response) => {
    const host = (req.headers.host ?? '').toLowerCase().split(':')[0];
    res.type('text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(PRODUCTION_HOSTS.has(host) ? PROD_ROBOTS : NONPROD_ROBOTS);
  });

  app.get('/sitemap.xml', async (_req: Request, res: Response) => {
    res.type('application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    try {
      res.send(await getSitemapXml());
    } catch {
      // Never 500 a crawler — fall back to the static pages we always know.
      res.send(buildSitemapXml(staticLocs()));
    }
  });

  app.get('/sitemap_index.xml', async (_req: Request, res: Response) => {
    res.type('application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    // Ensure the URL sitemap is generated so `<lastmod>` reflects a real
    // build; ignore failures (the index is still valid on its own).
    try {
      await getSitemapXml();
    } catch {
      /* fall through — emit index with a current-time lastmod */
    }
    res.send(buildSitemapIndexXml(sitemapGeneratedAt()));
  });
}
