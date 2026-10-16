import { PlatformLocation } from '@angular/common';
import { REQUEST, Service, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PRIMARY_OUTLET, ResolveStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import {
  DEFAULT_COUNTRY,
  GEO_COUNTRY_COOKIE,
  GEO_COUNTRY_HEADER,
  PREFERRED_COUNTRY_COOKIE,
} from '../../constants/countries';
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
 * decides: the learner's own choice (`prefer()`), else where the edge places them, else `us`.
 *
 * There is deliberately no timezone or `navigator.language` signal: the device clock says nothing
 * reliable about where someone is, and on the server it is the host's.
 */
@Service()
export class CountryContext {
  private readonly request = inject(REQUEST, { optional: true });
  private readonly storage = inject(Storage);
  private readonly router = inject(Router);

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
    this.router.events
      .pipe(
        filter((e): e is ResolveStart => e instanceof ResolveStart),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        const country = countryFromUrl(e.urlAfterRedirects);
        if (country) this._current.set(country);
      });
  }

  /** The learner's explicit choice (`prefer()`), if any. Outranks geo wherever the URL has no country. */
  preferred(): CountryCode | undefined {
    return toCountry(this.storage.getCookie(PREFERRED_COUNTRY_COOKIE));
  }

  /**
   * Where the edge places the visitor. Server: Vercel's `x-vercel-ip-country` header. Browser:
   * the `geo_country` cookie, which `src/geo-country.ts` writes from that same header, so both sides
   * answer identically. The cookie is also the server's fallback, which is what makes it testable
   * locally, where there is no Vercel header. Unknown (`XX`, `T1`), unsupported or missing →
   * `undefined`, so a caller can tell "placed elsewhere" from "not placed at all".
   */
  geo(): CountryCode | undefined {
    return (
      toCountry(this.request?.headers.get(GEO_COUNTRY_HEADER)) ??
      toCountry(this.storage.getCookie(GEO_COUNTRY_COOKIE))
    );
  }

  /**
   * The country for a URL that names none: the learner's choice, else where they are, else `us`.
   * The same order as Express's `detectCountry()`, so `/` and the guard never disagree.
   */
  detect(): CountryCode {
    return this.preferred() ?? this.geo() ?? DEFAULT_COUNTRY;
  }

  /**
   * Remember `country` as the learner's choice: the ONLY writer of `preferred_country`. A year,
   * `Lax` (the `Storage` default) and `Secure`; not `HttpOnly`, since this very service reads it
   * in the browser. It holds a validated code, nothing personal.
   */
  prefer(country: CountryCode): void {
    this.storage.setCookie(PREFERRED_COUNTRY_COOKIE, country, { expires: 365, secure: true });
  }

  /**
   * Switch to `country`: remember it and go to the same page under it, swapping only the country
   * segment so the path, query string and fragment survive (as `validateProfessionCountryGuard`
   * does). Outside the country tree (`/compliance`) there is no page to keep, so: home. A router
   * navigation, not a reload: the plans and cart resources key on `current()` and re-read by
   * themselves, and `ResolveStart` above updates `current()`.
   */
  use(country: CountryCode): void {
    this.prefer(country);
    if (!countryFromUrl(this.router.url)) {
      this.router.navigate(['/', country, 'accounting', 'home']);
      return;
    }
    const tree = this.router.parseUrl(this.router.url);
    tree.root.children[PRIMARY_OUTLET].segments[0].path = country;
    this.router.navigateByUrl(tree);
  }
}
