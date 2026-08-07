/**
 * Options for setting a cookie
 */
export interface CookieOptions {
  expires?: number | Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: 'Lax' | 'None' | 'Strict';
}
