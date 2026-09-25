import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { APP_BUILT_AT, APP_SEMVER, APP_SHA, APP_VERSION } from './app/core/version/app-version';
import { registerSeoRoutes } from './seo';
import { registerServiceWorkerRoute } from './service-worker';
import { registerLegacyRedirects } from './legacy-redirects';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();

/**
 * Hosts allowed to drive SSR. Angular's SSRF guard rejects any hostname not
 * in this list and silently falls back to client-side rendering — which
 * defeats SEO because social crawlers don't run JS. The list must include
 * every production / preview / local hostname Vercel (or a reverse proxy)
 * may forward as the `Host` header.
 *
 * Extend at runtime via the `NG_ALLOWED_HOSTS` env var (comma-separated)
 * without redeploying — useful when adding a new custom domain.
 */
const appEngine = new AngularNodeAppEngine({
  allowedHosts: [
    'localhost',
    '127.0.0.1',
    '14.98.4.214',
    '*.vercel.app',
    'milesmasterclass.com',
    '*.milesmasterclass.com',
    'milesmasterclass.us',
    '*.milesmasterclass.us',
  ],
  /**
   * Trust the `X-Forwarded-*` headers that Vercel's edge attaches to every
   * request it forwards to this function. Without this, `@angular/ssr` only
   * trusts `x-forwarded-host`/`x-forwarded-proto` by default and **deopts to
   * client-side rendering** the moment it sees any other forwarded header
   * (Vercel always sends `x-forwarded-for`) — serving an empty `<app-root>`
   * shell with no SSR. That's why SSR worked in `ng serve`/bare `node` (no
   * proxy, no forwarded headers) but produced a blank CSR page on Vercel.
   * Safe here because Vercel's edge sets/overwrites these headers, so clients
   * can't spoof them; `allowedHosts` above still validates the resolved host.
   * Override at runtime via the `NG_TRUST_PROXY_HEADERS` env var.
   */
  trustProxyHeaders: true,
});

/**
 * Report the currently deployed build version. The client polls this and
 * compares it to the version baked into its bundle to detect a new deploy.
 * `no-store` so neither the browser nor a CDN serves a stale value. Registered
 * before the static + Angular handlers so it always wins.
 */
app.get('/version.json', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  // `buildId` is what UpdateChecker compares; `version`/`sha`/`builtAt` are for
  // humans — a support ticket or a bug report maps to an exact commit from these.
  res.json({ version: APP_SEMVER, sha: APP_SHA, builtAt: APP_BUILT_AT, buildId: APP_VERSION });
});

/**
 * SEO endpoints: host-aware `/robots.txt` and a catalog-driven `/sitemap.xml`.
 * Registered before the static + Angular catch-all handlers so crawlers get
 * the real files instead of the SPA shell. See `src/seo.ts`.
 */
registerSeoRoutes(app);

/**
 * Netcore/FCM web-push service worker at `/sw.js`, generated per-build from
 * `environment.ANALYTICS.netcore`. Registered before the static + Angular
 * catch-all so it wins over any static file. See `src/service-worker.ts`.
 */
registerServiceWorkerRoute(app);

/**
 * 30x redirects from the legacy CPE-Masterclass URL shape (`/accounting/*`,
 * `/partnerships/*`) to the v3 `/:country/:profession_type/*` shape. Registered
 * before the static + Angular catch-all so legacy deep links are redirected
 * (with geo + query-string preserved) instead of being swallowed by the
 * `:country/:profession_type` route. See ROUTE_REDIRECT_MIGRATION_PLAN.md and
 * `src/legacy-redirects.ts`.
 */
registerLegacyRedirects(app);

/**
 * Reverse-proxy the headless WordPress blog REST API.
 *
 * The browser calls the same-origin `/blog-api/*` path (see
 * `environment.WP_BLOG.apiBaseUrlBrowser`) and we forward it to WordPress over
 * HTTPS. Keeping it same-origin means the browser never deals with CORS or
 * mixed-content, and the `X-WP-Total*` pagination headers stay readable.
 *
 * In `ng serve` this is handled by `proxy.conf.json`; this handler is what
 * runs in production (the Vercel function mounts this Express app). It must be
 * registered BEFORE the static + Angular catch-all handlers so `/blog-api`
 * wins. Read-only: only GET/HEAD are forwarded.
 *
 * Override the upstream without a redeploy via the `WP_BLOG_UPSTREAM` env var.
 */
const WP_BLOG_UPSTREAM =
  process.env['WP_BLOG_UPSTREAM'] ?? 'https://wp.milesmasterclass.com/blog/wp-json';

// Response headers worth forwarding to the client (esp. WP pagination).
const WP_FORWARDED_HEADERS = [
  'content-type',
  'cache-control',
  'last-modified',
  'etag',
  'x-wp-total',
  'x-wp-totalpages',
];

app.use('/blog-api', async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).set('Allow', 'GET, HEAD').end();
    return;
  }

  // `req.url` is already stripped of the `/blog-api` mount prefix, so it holds
  // the WordPress sub-path plus query string (e.g. `/wp/v2/posts?per_page=9`).
  const upstreamUrl = `${WP_BLOG_UPSTREAM}${req.url}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: { accept: 'application/json' },
      redirect: 'follow',
    });

    res.status(upstream.status);
    for (const name of WP_FORWARDED_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) {
        res.setHeader(name, value);
      }
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    res.send(body);
  } catch (error) {
    console.error('[blog-api] upstream request failed:', error);
    res.status(502).json({ error: 'Blog upstream unavailable' });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  // The SSR-rendered HTML is the entry point, so it must never be cached: a stale
  // shell hands the browser asset filenames that no longer exist on the newest
  // deployment. Set here rather than in `vercel.json` on purpose — a Cache-Control
  // rule broad enough to catch extensionless routes there would also have to be
  // ordered against the hashed-asset `immutable` rule, and getting that precedence
  // wrong silently breaks asset caching. `express.static` is registered above, so
  // this only ever touches rendered HTML.
  res.setHeader('Cache-Control', 'no-cache');
  appEngine
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
