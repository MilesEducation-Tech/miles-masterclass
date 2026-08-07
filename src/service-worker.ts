/**
 * Dynamic Netcore/FCM service worker, served by the SSR Express server at
 * `/sw.js` — the same build-driven pattern as `src/seo.ts`.
 *
 * The push credentials come from the running build's
 * `environment.ANALYTICS.netcore` (so the prod build serves prod config and the
 * UAT build serves UAT), instead of maintaining one static file per environment
 * in `public/`. The client registers `/sw.js` via
 * `Analytics.injectNetcore` (`netcore.swPath`).
 *
 * Registered BEFORE `express.static` + the Angular catch-all in `src/server.ts`
 * so this route wins over any static file.
 */
import type { Express, Request, Response } from 'express';
import { environment } from './environments/environment';

/** The `var config = {…}; importScripts(…)` body Netcore's swv4.js expects. */
function buildServiceWorker(): string {
  const n = environment.ANALYTICS.netcore;
  const config = {
    apiKey: n.push.apiKey,
    messagingSenderId: n.push.messagingSenderId,
    appId: n.push.appId, // FCM web app id
    projectId: n.push.projectId,
    user_key: n.siteKey, // Netcore panel id
    siteid: n.appId, // Netcore website id
  };
  return `var config = ${JSON.stringify(config, null, 2)};\nimportScripts("//cdnt.netcoresmartech.com/swv4.js");\n`;
}

export function registerServiceWorkerRoute(app: Express): void {
  app.get('/sw.js', (_req: Request, res: Response) => {
    res.type('text/javascript; charset=utf-8');
    // The worker must control the root scope; allow it explicitly.
    res.setHeader('Service-Worker-Allowed', '/');
    // Revalidate on every load so a redeploy with new push config propagates.
    res.setHeader('Cache-Control', 'no-cache');
    res.send(buildServiceWorker());
  });
}
