/**
 * SEO endpoints (`/robots.txt` + `/sitemap.xml`) served by the SSR Express
 * server in `src/server.ts`.
 *
 * Why server-side and not static files in `public/`:
 *   - `robots.txt` is **host-aware** — only the production hostnames advertise
 *     themselves as indexable; every preview / UAT / localhost host returns
 *     `Disallow: /` so Google never indexes a `*.vercel.app` duplicate.
 *   - `sitemap.xml` is **generated from the live course catalog** so newly
 *     published masterclasses / podcasts / webinars / micro-learning reels show
 *     up without a redeploy (cached in-memory, see `SITEMAP_TTL_MS`).
 *
 * Both routes are registered before `express.static` + the Angular catch-all so
 * they win over the SPA shell (which is why the SEO audit saw HTML at these
 * paths — nothing served them, so they fell through to Angular).
 */
import type { Express, Request, Response } from 'express';
import { environment } from './environments/environment';
import { CANONICAL_COUNTRY, CANONICAL_PROFESSION } from './app/shared/core/models/seo.constants';

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
];

/**
 * Catalog feeds that back a public `:courseId/:courseTitle` detail page. `type`
 * is the API `course_type`; `segment` is the URL segment (note `micro_learning`
 * → `micro-learning`, mirroring `Utils.buildCourseUrl`).
 */
const CATALOG: { type: string; segment: string }[] = [
  { type: 'masterclass', segment: 'masterclass' },
  { type: 'podcast', segment: 'podcast' },
  { type: 'micro_learning', segment: 'micro-learning' },
];

/**
 * Slug used in course URLs. Kept byte-for-byte in sync with `Utils.slugify`
 * (src/app/shared/core/services/utils/utils.ts) so generated links match what
 * the Angular router produces — if one changes, change both.
 */
function slugify(text: string): string {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Static page URLs — always available even if the catalog API is unreachable. */
function staticLocs(): string[] {
  return STATIC_PATHS.map((path) => `${SITE_ORIGIN}${PREFIX}/${path}`);
}

interface CatalogItem {
  id: number;
  title: string;
}

type ApiRow = Record<string, unknown>;

/**
 * Follow an API's absolute `pagination_data.next_page` links from `firstUrl`,
 * mapping each row via `pick` (rows that map to `null` are skipped). Bounded by
 * a page guard so a malformed `next_page` loop can't run forever; returns
 * whatever was gathered before any non-OK page.
 */
async function fetchPaginated(
  firstUrl: string,
  pick: (row: ApiRow) => CatalogItem | null,
): Promise<CatalogItem[]> {
  const items: CatalogItem[] = [];
  let next: string | null = firstUrl;
  let guard = 0;

  while (next && guard++ < 100) {
    const response: globalThis.Response = await fetch(next, {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) break;
    const json = (await response.json()) as {
      data?: ApiRow[];
      pagination_data?: { next_page?: string | null };
    };
    for (const row of json.data ?? []) {
      const item = pick(row);
      if (item) items.push(item);
    }
    next = json.pagination_data?.next_page ?? null;
  }

  return items;
}

/** Course catalog row (`v2/library/`) → `{ id, title }`. */
function pickCourse(row: ApiRow): CatalogItem | null {
  const { id, title } = row;
  return typeof id === 'number' && typeof title === 'string' && title ? { id, title } : null;
}

/** Instructor row (`instructor/`) → `{ id, title: "First Last" }`. */
function pickInstructor(row: ApiRow): CatalogItem | null {
  const { id, first_name, last_name } = row;
  const name = `${(first_name as string) ?? ''} ${(last_name as string) ?? ''}`.trim();
  return typeof id === 'number' && name ? { id, title: name } : null;
}

/** All published courses of a type, paged through `v2/library/`. */
function fetchCatalog(courseType: string): Promise<CatalogItem[]> {
  return fetchPaginated(`${API_BASE}/v2/library/?course_type=${courseType}&page=1`, pickCourse);
}

/** Public instructor detail pages, paged through `instructor/`. */
function fetchInstructors(): Promise<CatalogItem[]> {
  return fetchPaginated(`${API_BASE}/instructor/?page=1`, pickInstructor);
}

/** Webinars exposed via the public `webinar/filter/` feed. */
async function fetchWebinars(): Promise<CatalogItem[]> {
  const response = await fetch(`${API_BASE}/webinar/filter/`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) return [];
  const json = (await response.json()) as {
    data?: { id?: number; webinar_title?: string }[];
  };
  return (json.data ?? [])
    .filter((w): w is { id: number; webinar_title: string } => {
      return typeof w?.id === 'number' && !!w.webinar_title;
    })
    .map((w) => ({ id: w.id, title: w.webinar_title }));
}

/** Gather every crawlable absolute URL. Catalog failures degrade gracefully. */
async function collectLocs(): Promise<string[]> {
  const locs = new Set<string>(staticLocs());

  const catalogResults = await Promise.allSettled(CATALOG.map((c) => fetchCatalog(c.type)));
  catalogResults.forEach((result, index) => {
    if (result.status !== 'fulfilled') return;
    const { segment } = CATALOG[index];
    for (const item of result.value) {
      locs.add(`${SITE_ORIGIN}${PREFIX}/${segment}/${item.id}/${slugify(item.title)}`);
    }
  });

  const webinars = await fetchWebinars().catch(() => [] as CatalogItem[]);
  for (const webinar of webinars) {
    locs.add(`${SITE_ORIGIN}${PREFIX}/webinar/${webinar.id}/${slugify(webinar.title)}`);
  }

  const instructors = await fetchInstructors().catch(() => [] as CatalogItem[]);
  for (const instructor of instructors) {
    locs.add(`${SITE_ORIGIN}${PREFIX}/instructor/${instructor.id}/${slugify(instructor.title)}`);
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
// most one catalog crawl. Reset on every cold start, which is fine — the first
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
