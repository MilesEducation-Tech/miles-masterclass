import { environment } from '@env/environment';
import { resolveStatusUrl, WEBINAR_ENDPOINTS } from './webinar.model';

const ROOT = environment.BASE_API_URL;

describe('resolveStatusUrl', () => {
  it('resolves a root-relative path against the API origin', () => {
    expect(resolveStatusUrl('/api/v1/events/register-via-zoom-status/abc/')).toBe(
      `${ROOT}api/v1/events/register-via-zoom-status/abc/`,
    );
  });

  it('passes an absolute URL through when it is the API origin', () => {
    const same = `${ROOT}api/v1/events/register-via-zoom-status/abc/`;
    expect(resolveStatusUrl(same)).toBe(same);
  });

  it('REFUSES a foreign origin and rebuilds the path instead', () => {
    // The whole point: `ApiClient` forwards an absolute URL untouched and
    // `appInterceptor` attaches the learner bearer to it, so following this
    // would hand the token to attacker.example.
    expect(resolveStatusUrl('https://attacker.example/steal/', 'abc')).toBe(
      WEBINAR_ENDPOINTS.registerStatus('abc'),
    );
  });

  it('refuses an unparseable URL the same way', () => {
    expect(resolveStatusUrl('https://[not-a-url', 'abc')).toBe(
      WEBINAR_ENDPOINTS.registerStatus('abc'),
    );
  });

  it('throws rather than following a foreign origin when it cannot rebuild', () => {
    expect(() => resolveStatusUrl('https://attacker.example/steal/')).toThrow(/foreign origin/);
  });
});
