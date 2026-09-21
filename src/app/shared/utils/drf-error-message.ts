/** Keys that carry the message itself rather than a field name. */
const MESSAGE_KEYS = ['message', 'detail', 'non_field_errors'] as const;
/** Gateway envelope metadata — never a field error, never worth showing. */
const META_KEYS = new Set(['field', 'error_code', 'status', 'code']);

function firstString(value: unknown): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

/**
 * One toast line from a Django error body. The Miles gateway wraps DRF errors
 * as `{ field, message, error_code }`, so the message keys are checked BEFORE
 * falling back to field-keyed validation errors — otherwise a 401 renders as
 * the useless "field: detail".
 *
 *   "text"                                 → "text"
 *   { field, message, error_code }         → message          (gateway envelope)
 *   { detail: "..." }                      → detail           (plain DRF)
 *   { non_field_errors: ["..."] }          → that message
 *   { email: ["This field is required."] } → "email: This field is required."
 *
 * Anything else (HTML 5xx, network error, no body) → fallback.
 */
export function drfErrorMessage(err: unknown, fallback = 'Please try again.'): string {
  const body = (err as { error?: unknown } | null | undefined)?.error;
  if (typeof body === 'string') return body.trim() || fallback;
  if (!body || typeof body !== 'object') return fallback;

  const record = body as Record<string, unknown>;
  for (const key of MESSAGE_KEYS) {
    const msg = firstString(record[key]);
    if (msg) return msg;
  }
  for (const [key, value] of Object.entries(record)) {
    if (META_KEYS.has(key)) continue;
    const msg = firstString(value);
    if (msg) return `${key.replace(/_/g, ' ')}: ${msg}`;
  }
  return fallback;
}
