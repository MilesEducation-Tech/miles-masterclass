import { PlatformLocation } from '@angular/common';
import { REQUEST, Service, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ResolveStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { DEFAULT_COUNTRY, GEO_COUNTRY_COOKIE, GEO_COUNTRY_HEADER } from '../../constants/countries';
import type { CountryCode } from '../../models/route-params.model';
import { countryFromUrl, toCountry } from '../../utils/country';
import { Storage } from '../storage/storage';

/**
 * The visitor's country — the one source the whole app (links, guards, and the API country)
 * reads from.
 *
 * Precedence: a supported country in the URL always wins and is never overridden by geo, so a
 * crawler from the US still reaches `/in/...`. Outside the country tree (`/`, `/auth/*`, an
 * unsupported `/zz/...`) the last valid URL country is kept; on a first visit with none, `detect()`
 * decides.
 *
 * There is deliberately no timezone or `navigator.language` signal: the device clock says nothing
 * reliable about where someone is, and on the server it is the host's.
 */
@Service()
export class CountryContext {
  private readonly request = inject(REQUEST, { optional: true });
  private readonly storage = inject(Storage);

  // `PlatformLocation` holds the requested URL on the server too, so server and browser seed
  // identically and hydration sees the same country.
  private readonly _current = signal<CountryCode>(
    countryFromUrl(inject(PlatformLocation).pathname) ?? this.detect(),
  );

  readonly current = this._current.asReadonly();

  constructor() {
    // `ResolveStart`, not `NavigationEnd`: it fires after guards and redirects but BEFORE the new
    // route's components are created, so anything they read while constructing is already right.
    // ponytail: a navigation that then fails in a resolver leaves `current` on the target's
    // country. Harmless, since both are supported countries; reset on `NavigationError` if that matters.
    inject(Router)
      .events.pipe(
        filter((e): e is ResolveStart => e instanceof ResolveStart),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        const country = countryFromUrl(e.urlAfterRedirects);
        if (country) this._current.set(country);
      });
  }

  /**
   * Where the visitor is, from the edge. Server: Vercel's `x-vercel-ip-country` header. Browser:
   * the `geo_country` cookie, which `src/geo-country.ts` writes from that same header, so both sides
   * answer identically. The cookie is also the server's fallback, which is what makes it testable
   * locally, where there is no Vercel header. Unknown (`XX`, `T1`), unsupported or missing → `us`.
   */
  detect(): CountryCode {
    return (
      toCountry(this.request?.headers.get(GEO_COUNTRY_HEADER)) ??
      toCountry(this.storage.getCookie(GEO_COUNTRY_COOKIE)) ??
      DEFAULT_COUNTRY
    );
  }
}
