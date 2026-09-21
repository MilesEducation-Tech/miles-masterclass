import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadFiles, FAILED_MANIFEST_NAME, isAbortError, saveBlob } from './blob-download';

/**
 * Certificate zips are slow and admin-critical: pin the job-control behaviour
 * of `downloadFiles` — bounded concurrency, progress, cancel, and that a
 * partial failure still ships a zip with a FAILED.txt instead of nothing.
 */
describe('downloadFiles', () => {
  const saved: { name: string; blob: Blob }[] = [];
  let inFlight = 0;
  let peak = 0;
  /** Per-URL behaviour: 'ok', 'fail', or a promise gate to hold the request open. */
  let behaviour: Record<string, 'ok' | 'fail'>;

  beforeEach(() => {
    saved.length = 0;
    inFlight = peak = 0;
    behaviour = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        if (init?.signal?.aborted) throw init.signal.reason;
        if (behaviour[url] === 'fail') return new Response(null, { status: 404 });
        return new Response(new Blob([`pdf:${url}`], { type: 'application/pdf' }));
      }),
    );
    // Capture saves instead of poking a real anchor.
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push({ name: this.download, blob: new Blob() });
    });
  });

  afterEach(() => vi.restoreAllMocks());

  const items = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      url: `https://cdn/cert-${i}.pdf`,
      suggestedName: `Course ${i % 2}/Course ${i % 2} - User.pdf`,
    }));

  it('caps parallel fetches and reports progress through every phase', async () => {
    const phases: string[] = [];
    const result = await downloadFiles(items(10), 'certs', {
      concurrency: 3,
      onProgress: (p) => phases.push(p.phase),
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(result).toEqual({ saved: 10, failed: [] });
    expect(new Set(phases)).toEqual(new Set(['fetching', 'zipping', 'saving']));
    expect(saved.map((s) => s.name)).toEqual(['certs.zip']);
  });

  it('ships a zip with FAILED.txt when some fetches fail and tolerateFailures is on', async () => {
    behaviour['https://cdn/cert-1.pdf'] = 'fail';
    const result = await downloadFiles(items(3), 'certs', { tolerateFailures: true });
    expect(result.saved).toBe(2);
    expect(result.failed.map((f) => f.item.url)).toEqual(['https://cdn/cert-1.pdf']);
    expect(saved.map((s) => s.name)).toEqual(['certs.zip']);
    // FAILED_MANIFEST_NAME is what the toast points the admin at — keep them in sync.
    expect(FAILED_MANIFEST_NAME).toBe('FAILED.txt');
  });

  it('rejects instead of saving when every fetch fails', async () => {
    behaviour['https://cdn/cert-0.pdf'] = 'fail';
    await expect(downloadFiles(items(1), 'one', { tolerateFailures: true })).rejects.toThrow(
      /None of the 1 files/,
    );
    expect(saved).toEqual([]);
  });

  it('is all-or-nothing without tolerateFailures', async () => {
    behaviour['https://cdn/cert-1.pdf'] = 'fail';
    await expect(downloadFiles(items(2), 'certs')).rejects.toThrow(/404/);
    expect(saved).toEqual([]);
  });

  it('cancels via AbortSignal with an AbortError and saves nothing', async () => {
    const abort = new AbortController();
    const run = downloadFiles(items(6), 'certs', {
      concurrency: 1,
      signal: abort.signal,
      onProgress: (p) => p.done === 2 && abort.abort(new DOMException('x', 'AbortError')),
    });
    await expect(run).rejects.toSatisfy(isAbortError);
    expect(saved).toEqual([]);
  });

  it('saves a single item directly unless forceZip asks for the folder structure', async () => {
    await downloadFiles([{ url: 'https://cdn/a.pdf', suggestedName: 'A - U.pdf' }], 'x');
    await downloadFiles([{ url: 'https://cdn/a.pdf', suggestedName: 'A/A - U.pdf' }], 'x', {
      forceZip: true,
    });
    expect(saved.map((s) => s.name)).toEqual(['A - U.pdf', 'x.zip']);
  });

  it('saveBlob no-ops on the server', () => {
    const doc = globalThis.document;
    // @ts-expect-error simulate SSR
    delete globalThis.document;
    expect(() => saveBlob(new Blob(), 'f.pdf')).not.toThrow();
    globalThis.document = doc;
  });
});
