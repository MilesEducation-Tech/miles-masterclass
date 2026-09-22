/**
 * Global unit-test setup, wired via `setupFiles` on the `test` target in
 * angular.json.
 *
 * jsdom ships no `IntersectionObserver`, and several components construct one
 * unguarded inside `afterNextRender` — `section-nav`, the library pagination
 * pages (course / instructor / badge) and the tracker badge lists. Those
 * constructors run on a timer, so they throw AFTER the test that triggered
 * them has finished, and Vitest attributes the unhandled exception to whatever
 * suite happens to be running at that moment. That is why one missing global
 * surfaced as errors in `home.spec.ts` and `masterclass.spec.ts`, which never
 * mention it.
 *
 * The stub deliberately never fires its callback: jsdom performs no layout, so
 * nothing ever intersects and a callback firing here would be fiction. A test
 * that needs intersection behaviour has to drive it explicitly rather than
 * lean on this.
 */
class IntersectionObserverStub implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '0px';
  // Added to the DOM lib alongside `rootMargin`; TS 6 requires it on the interface.
  readonly scrollMargin: string = '0px';
  readonly thresholds: readonly number[] = [0];

  observe(): void {
    // Intentionally inert — see the note above.
  }
  unobserve(): void {
    // Intentionally inert — see the note above.
  }
  disconnect(): void {
    // Intentionally inert — see the note above.
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

globalThis.IntersectionObserver = IntersectionObserverStub;

/**
 * jsdom's `Blob` implements no `text()`. Real browsers do, and
 * `partnerBlobErrorMessage()` calls it to read the JSON body out of a failed
 * `responseType: 'blob'` export — so without this the helper always fell into
 * its catch and every blob test silently asserted the fallback string instead
 * of the code path it names. FileReader is what jsdom does provide.
 */
if (typeof Blob !== 'undefined' && typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function (this: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

export {};
