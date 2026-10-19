import { Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { CountryContext } from '@core/services/country-context/country-context';
import { LanguageContext } from '@core/services/language-context/language-context';
import { countryName } from '@core/utils/country';

/**
 * "You appear to be in X": a one-time hint for a visitor whose URL country isn't where the edge
 * places them, with no explicit choice on record. Non-blocking, and never a redirect: browsing any
 * country stays free. Either answer writes `preferred_country` (Switch also navigates), so it
 * never shows again in this browser; there is no third "close", since it would write the same cookie.
 *
 * Browser-only: `main-layout` renders it inside `@defer (on idle)`, so the server emits the
 * placeholder and hydration has nothing to mismatch. The cookies are read once, at creation;
 * in-app navigation to the geo country hides it through `current()`.
 */
@Component({
  selector: 'app-country-banner',
  imports: [TranslocoPipe],
  templateUrl: './country-banner.html',
  // The banner positions itself fixed, so the host shouldn't affect layout.
  host: { class: 'contents' },
})
export class CountryBanner {
  private readonly country = inject(CountryContext);
  private readonly locale = inject(LanguageContext).current;

  /** The edge's answer, only while the visitor has made no choice; `undefined` otherwise. */
  private readonly geo = this.country.preferred() ? undefined : this.country.geo();
  private readonly answered = signal(false);

  protected readonly show = computed(
    () => !this.answered() && !!this.geo && this.geo !== this.country.current(),
  );
  protected readonly geoName = this.geo ? countryName(this.geo, this.locale) : '';
  protected readonly currentName = computed(() => countryName(this.country.current(), this.locale));

  protected switchCountry(): void {
    this.answered.set(true);
    if (this.geo) this.country.use(this.geo);
  }

  protected stay(): void {
    this.answered.set(true);
    this.country.prefer(this.country.current());
  }
}
