import type { NextFunction, Request, Response } from 'express';
import {
  DEFAULT_COUNTRY,
  GEO_COUNTRY_COOKIE,
  GEO_COUNTRY_HEADER,
} from './app/core/constants/countries';
import type { CountryCode } from './app/core/models/route-params.model';
import { toCountry } from './app/core/utils/country';
import { asHeader } from './legacy-redirects';

/**
 * Server half of country resolution. The browser half is `CountryContext`
 * (`core/services/country-context/`); both read the same edge answer, so they never disagree.
 *
 * The country comes from Vercel's `x-vercel-ip-country`: free, set on every request, no lookup
 * call. There is deliberately no timezone or IP-API fallback (see `prompts/country-resolution.md`).
 */

/** One day: no `Set-Cookie` on every page, yet a visitor who moves is followed within a day. */
const GEO_COOKIE_MAX_AGE_SECONDS = 86_400;

/** Same precedence as `CountryContext.detect()`: edge header, then our own cookie, then `us`. */
export function detectCountry(req: Request): CountryCode {
  return (
    toCountry(asHeader(req.headers[GEO_COUNTRY_HEADER])) ??
    toCountry(readCookie(req.headers.cookie, GEO_COUNTRY_COOKIE)) ??
    DEFAULT_COUNTRY
  );
}

/**
 * `GET /` → 302 `/<country>/accounting/home`, answered here so the server doesn't boot an Angular
 * render just to redirect. Temporary and `no-store` because the answer is per visitor (crawlers,
 * from the US, get `/us/accounting/home`, the canonical locale). The query string is kept so
 * campaign UTMs on the bare domain survive.
 *
 * Straight to `/home`, the final URL: `/<country>/accounting` would itself redirect there
 * (`features.routes.ts`), costing a second round trip on the most-visited entry point.
 */
export function geoRootRedirect(req: Request, res: Response, next: NextFunction): void {
  if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path !== '/') return next();

  const qIndex = req.originalUrl.indexOf('?');
  const qs = qIndex === -1 ? '' : req.originalUrl.slice(qIndex);
  res.setHeader('Cache-Control', 'private, no-store');
  res.redirect(302, `/${detectCountry(req)}/accounting/home${qs}`);
}

/**
 * Hands the edge's country to the browser in the `geo_country` cookie, so client-rendered routes
 * (`auth/**`, `payment/**`, admin) and in-app navigations resolve the same country the server did.
 * Register it in front of the Angular handler only, so static assets never carry a `Set-Cookie`;
 * it is skipped when the request already holds the same value, so repeat visits carry none either.
 * Not `HttpOnly`: the browser has to read it. It holds a country code, nothing personal.
 */
export function geoCountryCookie(req: Request, res: Response, next: NextFunction): void {
  const geo = toCountry(asHeader(req.headers[GEO_COUNTRY_HEADER]));
  if (geo && readCookie(req.headers.cookie, GEO_COUNTRY_COOKIE) !== geo) {
    res.append(
      'Set-Cookie',
      `${GEO_COUNTRY_COOKIE}=${geo}; Path=/; Max-Age=${GEO_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax; Secure`,
    );
  }
  next();
}

/** One cookie's value from a raw `Cookie` header (Express doesn't parse them without middleware). */
function readCookie(header: string | undefined, name: string): string | undefined {
  return header?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))?.[1];
}
