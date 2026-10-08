/**
 * The trust boundary for the offerings' web API (`web-api/v1/<offering>/`),
 * shared by the offerings' models.
 *
 * Hand-written, like the webinar model's: a renamed key would otherwise render
 * as `undefined` with no signal. Every key a page reads is checked; EXTRA keys
 * pass, because the contract adds keys without notice. A missing or retyped key
 * fails the whole response, once, in the resource's `parse`, so it lands in
 * `error()` rather than half-rendered on screen.
 */

export type Json = Record<string, unknown>;

export const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
export const isStr = (v: unknown): v is string => typeof v === 'string';
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
export const isStrOrNull = (v: unknown): v is string | null => v === null || isStr(v);
export const isNumOrNull = (v: unknown): v is number | null => v === null || isNum(v);

export const listOf =
  <T>(guard: (v: unknown) => v is T) =>
  (v: unknown): v is T[] =>
    Array.isArray(v) && v.every(guard);

/** Thrown from `parse`; the message names the route so the log says where. */
export function contractError(route: string): Error {
  return new Error(`[offerings] ${route} response does not match the contract.`);
}
