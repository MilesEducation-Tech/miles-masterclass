import { Injectable, PLATFORM_ID, REQUEST, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { timezone } from '../../constants/timezone';
import { country } from '../../constants/country';
import { Logger } from '../logger/logger';
import { Storage } from '../storage/storage';

// Country the browser resolved from its timezone, persisted so the NEXT server
// render (e.g. a refresh) uses it instead of the server's own timezone.
const COUNTRY_COOKIE = 'country';

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  private logger = inject(Logger);
  private readonly storage = inject(Storage);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly request = inject(REQUEST, { optional: true });

  getUserCountry(): string {
    // SSR: the server has no browser timezone yet — its own TZ is the host's
    // (e.g. US), which is the pricing bug. Instead trust, in order:
    //   1. the `country` cookie the browser saved from a prior timezone lookup,
    //   2. Vercel's IP geo header on a first-ever visit (no cookie yet),
    //   3. 'us' as a last resort.
    // Both 1 & 2 are validated against the known ISO2 list because Vercel sends
    // "XX"/"T1" for un-geolocatable IPs and a stale cookie could hold anything.
    if (!this.isBrowser) {
      const saved = this.storage.getCookie(COUNTRY_COOKIE)?.toUpperCase();
      if (saved && country.includes(saved)) return saved.toLowerCase();

      const geo = this.request?.headers.get('x-vercel-ip-country')?.toUpperCase();
      return geo && country.includes(geo) ? geo.toLowerCase() : 'us';
    }

    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Find country matching the timezone
      const match = timezone.find((c) =>
        c.timezones?.some((tz: any) => tz.zoneName === userTz || tz.timeZone === userTz),
      );

      if (match && match.iso2) {
        const iso2 = match.iso2.toLowerCase();
        // Persist for the next server render so a refresh renders this country's
        // pricing instead of falling back to the server's US timezone.
        if (this.storage.getCookie(COUNTRY_COOKIE) !== iso2) {
          this.storage.setCookie(COUNTRY_COOKIE, iso2, { expires: 365 });
        }
        return iso2;
      }
    } catch (e) {
      this.logger.error('Error detecting user location:', e);
    }
    return 'us';
  }
}
