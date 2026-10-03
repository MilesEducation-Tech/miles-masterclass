import { describe, expect, it } from 'vitest';
import { geoCountryCookie, geoRootRedirect } from './geo-country';

type Req = Parameters<typeof geoRootRedirect>[0];
type Res = Parameters<typeof geoRootRedirect>[1];
type Next = Parameters<typeof geoRootRedirect>[2];

interface Captured {
  status?: number;
  location?: string;
  headers: Record<string, string>;
  setCookie: string[];
  nexted?: boolean;
}

interface CallOptions {
  path?: string;
  originalUrl?: string;
  method?: string;
  headers?: Record<string, string>;
}

function call(
  handler: typeof geoRootRedirect,
  { path = '/', originalUrl = path, method = 'GET', headers = {} }: CallOptions = {},
): Captured {
  const cap: Captured = { headers: {}, setCookie: [] };
  const req = { method, path, originalUrl, headers } as never as Req;
  const res = {
    redirect: (status: number, location: string) => {
      cap.status = status;
      cap.location = location;
    },
    setHeader: (name: string, value: string) => {
      cap.headers[name] = value;
    },
    append: (name: string, value: string) => {
      if (name === 'Set-Cookie') cap.setCookie.push(value);
    },
  } as never as Res;
  handler(req, res, (() => (cap.nexted = true)) as never as Next);
  return cap;
}

const geo = (cc: string, cookie?: string): Record<string, string> => ({
  'x-vercel-ip-country': cc,
  ...(cookie ? { cookie } : {}),
});

describe('geoRootRedirect', () => {
  it('sends / straight to the geo country home in one hop, uncacheable', () => {
    const r = call(geoRootRedirect, { headers: geo('IN') });
    expect(r.status).toBe(302);
    expect(r.location).toBe('/in/accounting/home');
    expect(r.headers['Cache-Control']).toBe('private, no-store');
  });

  it('falls back to us for an unknown, unsupported or missing country', () => {
    expect(call(geoRootRedirect, { headers: geo('XX') }).location).toBe('/us/accounting/home');
    expect(call(geoRootRedirect, { headers: geo('KE') }).location).toBe('/us/accounting/home');
    expect(call(geoRootRedirect).location).toBe('/us/accounting/home');
  });

  // Locally there is no Vercel header; the cookie is what makes the flow testable.
  it('uses the geo cookie when there is no header, and the header over the cookie', () => {
    expect(call(geoRootRedirect, { headers: { cookie: 'a=1; geo_country=de' } }).location).toBe(
      '/de/accounting/home',
    );
    expect(call(geoRootRedirect, { headers: geo('IN', 'geo_country=de') }).location).toBe(
      '/in/accounting/home',
    );
  });

  it('keeps the query string so campaign UTMs survive', () => {
    const r = call(geoRootRedirect, { originalUrl: '/?utm_source=x', headers: geo('AE') });
    expect(r.location).toBe('/ae/accounting/home?utm_source=x');
  });

  it('passes every other path and non-GET method through', () => {
    expect(call(geoRootRedirect, { path: '/in/accounting' }).nexted).toBe(true);
    expect(call(geoRootRedirect, { method: 'POST' }).nexted).toBe(true);
  });
});

describe('geoCountryCookie', () => {
  it('hands the geo country to the browser', () => {
    const r = call(geoCountryCookie, { path: '/us/accounting', headers: geo('IN') });
    expect(r.setCookie).toEqual(['geo_country=in; Path=/; Max-Age=86400; SameSite=Lax; Secure']);
    expect(r.nexted).toBe(true);
  });

  it('sends no Set-Cookie when the browser already holds the same value', () => {
    const r = call(geoCountryCookie, { headers: geo('IN', 'x=1; geo_country=in') });
    expect(r.setCookie).toEqual([]);
    expect(r.nexted).toBe(true);
  });

  it('updates a stale value', () => {
    expect(call(geoCountryCookie, { headers: geo('DE', 'geo_country=in') }).setCookie).toHaveLength(
      1,
    );
  });

  it('writes nothing it cannot vouch for (no header, unknown or unsupported)', () => {
    for (const headers of [{}, geo('XX'), geo('KE')]) {
      expect(call(geoCountryCookie, { headers }).setCookie).toEqual([]);
    }
  });
});
