export type MockRole = 'super' | 'network' | 'firm';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * The mock is on only when the page is served from localhost AND
 * `localStorage.partnerMock` names a role. Deliberately keyed on the HOSTNAME,
 * not `environment.production`: in this repo `ng serve` defaults to the
 * *production* configuration, so `environment.production` is true on the dev
 * server too and would switch this off exactly where it is wanted.
 */
export function mockRole(): MockRole | null {
  if (typeof location === 'undefined' || typeof localStorage === 'undefined') return null;
  if (!LOCAL_HOSTS.has(location.hostname)) return null;
  const role = localStorage.getItem('partnerMock');
  return role === 'super' || role === 'network' || role === 'firm' ? role : null;
}
