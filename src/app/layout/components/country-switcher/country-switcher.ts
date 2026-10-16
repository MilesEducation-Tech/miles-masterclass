import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SUPPORTED_COUNTRIES } from '@core/constants/countries';
import { CountryContext } from '@core/services/country-context/country-context';
import { LanguageContext } from '@core/services/language-context/language-context';
import { countryName, toCountry } from '@core/utils/country';
import { NativeSelect } from '@shared/ui/native-select/native-select';

/**
 * Lets the visitor pick the country they browse, and are priced, in. The language switcher's
 * shape: a native `<select>`, accessible as-is and the platform's own picker on phones. Choosing
 * one remembers it and moves to the same page under that country (`CountryContext.use`).
 */
@Component({
  selector: 'app-country-switcher',
  imports: [NativeSelect, TranslocoPipe],
  templateUrl: './country-switcher.html',
})
export class CountrySwitcher {
  private readonly country = inject(CountryContext);
  private readonly locale = inject(LanguageContext).current;

  protected readonly current = this.country.current;

  /**
   * Every supported country by its name in the visitor's language, A–Z: a 57-entry list is scanned
   * by name, not in the grouped order `SUPPORTED_COUNTRIES` keeps for maintainers.
   */
  protected readonly options = SUPPORTED_COUNTRIES.map((code) => ({
    code,
    name: countryName(code, this.locale),
  })).sort((a, b) => a.name.localeCompare(b.name, this.locale));

  protected select(event: Event): void {
    // The value is still validated: an <option> can be edited in devtools like any other input.
    const country = toCountry((event.target as HTMLSelectElement).value);
    if (country && country !== this.current()) this.country.use(country);
  }
}
