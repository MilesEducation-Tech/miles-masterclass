/**
 * Shared blob-download utilities used by certificate flows (course dialog,
 * cpe-tracker per-row, cpe-tracker bulk). Extracted so both consumers go
 * through the same fetch + zip + save path — single source of truth for:
 *   - request timeouts via AbortController
 *   - JSZip lazy-load (kept out of the main bundle)
 *   - human-readable filename suggestions + collision dedup
 *   - SSR safety (no DOM/fetch usage outside the browser)
 *   - deferred `URL.revokeObjectURL` to dodge Safari's revoke-before-download race
 */

/** One file in a download set. Pass a `suggestedName` for human-readable zip entries. */
export interface BlobDownloadItem {
  url: string;
  /** Preferred filename for this item; collisions inside a zip are deduped. */
  suggestedName?: string;
}

/** Default network timeout for asset fetches — long enough for slow CDNs, short enough to fail visibly. */
const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

/** Delay before revoking object URLs — gives the browser one task tick to start the download. */
const REVOKE_DELAY_MS = 1_000;

/**
 * Download one or more files. Single item downloads directly; multiple items
 * are bundled into a `${baseName}.zip` via JSZip (lazy-loaded). Returns once
 * the save anchor has been clicked (the actual write is browser-managed).
 *
 * No-ops on the server (SSR) — caller can invoke without an `isPlatformBrowser`
 * guard, but should still gate on `isBrowser` if the surrounding logic depends
 * on the download actually happening.
 */
export async function downloadFiles(
  items: BlobDownloadItem[],
  baseName: string,
  options: { timeoutMs?: number } = {},
): Promise<void> {
  if (typeof document === 'undefined' || items.length === 0) return;
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

  if (items.length === 1) {
    const item = items[0];
    const blob = await fetchAsBlob(item.url, timeoutMs);
    saveBlob(blob, item.suggestedName ?? fileNameFromUrl(item.url) ?? `${baseName}.pdf`);
    return;
  }

  // Lazy-load JSZip so the chunk only ships when a user actually triggers a
  // multi-file download.
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const blobs = await Promise.all(items.map((item) => fetchAsBlob(item.url, timeoutMs)));
  const used = new Set<string>();
  blobs.forEach((blob, i) => {
    const item = items[i];
    const base = item.suggestedName ?? fileNameFromUrl(item.url) ?? `${baseName}-${i + 1}.pdf`;
    const name = uniqueZipName(base, used);
    used.add(name);
    zip.file(name, blob);
  });
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveBlob(zipBlob, `${baseName}.zip`);
}

/**
 * Fetch a URL as a Blob with an AbortController-based timeout. Throws on
 * non-2xx, network failure, or timeout — callers are expected to catch.
 */
export async function fetchAsBlob(
  url: string,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Blob> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Fetch failed for ${url}: ${res.status}`);
    }
    return await res.blob();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Save a blob via an anchor click. SSR-safe: no-ops outside the browser.
 * The object URL is revoked after a short delay rather than synchronously —
 * Safari has historically raced the click handler against an immediate revoke.
 */
export function saveBlob(blob: Blob, fileName: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

/**
 * Pull a filename from a `Content-Disposition` header, handling both the plain
 * `filename="..."` form and the RFC 5987 `filename*=UTF-8''...` form (the latter
 * wins when present). The result is sanitized; falls back to `fallback` (which
 * should already include any extension) when the header is missing or unparsable.
 */
export function fileNameFromContentDisposition(
  disposition: string | null,
  fallback: string,
): string {
  if (disposition) {
    const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    if (utf8?.[1]) return sanitizeFileName(decodeURIComponent(utf8[1]));
    const plain = /filename="?([^";]+)"?/i.exec(disposition);
    if (plain?.[1]) return sanitizeFileName(plain[1].trim());
  }
  return fallback;
}

/** Best-effort filename: prefer the URL's tail if it ends in `.pdf`. */
export function fileNameFromUrl(url: string): string | null {
  try {
    const tail = new URL(url).pathname.split('/').pop();
    return tail && tail.toLowerCase().endsWith('.pdf') ? tail : null;
  } catch {
    return null;
  }
}

/**
 * Sanitize a string into a filesystem-safe filename component. Strips
 * Windows-illegal chars (`<>:"/\|?*`), collapses whitespace runs, and trims
 * trailing dots/spaces (also illegal on Windows).
 */
export function sanitizeFileName(input: string): string {
  return input
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/, '')
    .trim();
}

/** Build `{title}{ - field}.pdf`, sanitized. Falls back to `${fallback}.pdf` if empty. */
export function buildPdfFileName(
  title: string | null | undefined,
  field: string | null | undefined,
  fallback: string,
): string {
  const safeTitle = sanitizeFileName(title ?? '');
  const safeField = sanitizeFileName(field ?? '');
  const stem = [safeTitle, safeField].filter(Boolean).join(' - ') || fallback;
  return `${stem}.pdf`;
}

/** If `name` collides inside a zip, append ` (n)` before the extension. */
export function uniqueZipName(name: string, used: Set<string>): string {
  if (!used.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 2;
  while (used.has(`${stem} (${i})${ext}`)) i++;
  return `${stem} (${i})${ext}`;
}
