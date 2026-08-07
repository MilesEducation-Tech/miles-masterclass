import { computed, inject, Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { AriaSelectOption } from '../../models/aria.model';
import { ApiClient } from '../api-client/api-client';
import { Logger } from '../logger/logger';

const AUTOCOMPLETE_URL = 'v2/locations/autocomplete/';

interface LocationSuggestion {
  place_id: string;
  /** Full display string, e.g. "Bengaluru, Karnataka, India". */
  description: string;
  city: string;
  country: string;
}

interface LocationAutocompleteResponse {
  status: boolean;
  message: string;
  data: LocationSuggestion[];
}

/**
 * Debounced place predictions for an `<app-aria-autocomplete>`. Call from a
 * component field initializer (needs an injection context).
 *
 * Backed by our own `v2/locations/autocomplete/`, which proxies Google Places
 * server-side. Doing it in the browser meant shipping the Maps API key in the
 * bundle, where the only protection available is an HTTP referrer allowlist —
 * and `Referer` is a client-supplied header, so one line of curl gets full use
 * of the key. Behind the proxy the key never reaches the client at all.
 *
 * @param query     the field's `(queryChange)` text
 * @param selected  the field's committed value, so its label survives seeding
 */
export function placeSuggestions(
  query: Signal<string>,
  selected: Signal<string | null | undefined>,
): Signal<AriaSelectOption<string>[]> {
  const http = inject(ApiClient);
  const logger = inject(Logger);

  const suggestions = toSignal(
    toObservable(query).pipe(
      map((q) => q.trim()),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((q) =>
        q.length < 2
          ? of<string[]>([])
          : http
              .get<LocationAutocompleteResponse>(AUTOCOMPLETE_URL, { params: { search: q } })
              .pipe(
                map((res) => (res.data ?? []).map((s) => s.description).filter(Boolean)),
                catchError((err) => {
                  logger.error('LocationAutocomplete: fetch failed', err);
                  return of<string[]>([]);
                }),
              ),
      ),
    ),
    { initialValue: [] as string[] },
  );

  return computed(() => {
    const options = suggestions().map((label) => ({ label, value: label }));
    // Keep the committed value in the list: `app-aria-autocomplete` mirrors a
    // value's label into the input by looking it up in `options`, and a form
    // seeded from the API (profile's saved location) has no suggestions yet.
    const current = selected();
    if (current && !options.some((o) => o.value === current)) {
      options.unshift({ label: current, value: current });
    }
    return options;
  });
}
