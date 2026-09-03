import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { APP_VERSION } from './app/shared/core/version/app-version';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();

/**
 * Hosts allowed to drive SSR. Angular's SSRF guard rejects any hostname not
 * in this list and silently falls back to client-side rendering. Extend at
 * runtime via the `NG_ALLOWED_HOSTS` env var (comma-separated).
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
  // Vercel's edge sets X-Forwarded-*; without this @angular/ssr deopts to CSR.
  trustProxyHeaders: true,
});

/**
 * Report the currently deployed build version. `no-store` so neither the
 * browser nor a CDN serves a stale value.
 */
app.get('/version.json', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.json({ version: APP_VERSION });
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req, res, next) => {
  appEngine
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
