import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LANGUAGE_NAMES } from '@core/constants/languages';
import { LanguageContext } from '@core/services/language-context/language-context';
import { toLanguage } from '@core/utils/language';
import { NativeSelect } from '@shared/ui/native-select/native-select';

/**
 * Lets the visitor pick their language from the ones this build offers. A native `<select>`:
 * accessible as-is, and the platform's own picker on phones. Choosing one reloads the page in that
 * language (`LanguageContext.use`). Only render it where `LanguageContext.canSwitch` is true.
 */
@Component({
  selector: 'app-language-switcher',
  imports: [NativeSelect, TranslocoPipe],
  templateUrl: './language-switcher.html',
})
export class LanguageSwitcher {
  private readonly language = inject(LanguageContext);

  protected readonly current = this.language.current;

  /** Each language by its own name, with `lang` so a screen reader pronounces it right. */
  protected readonly options = this.language.enabled.map((code) => ({
    code,
    name: LANGUAGE_NAMES[code],
  }));

  protected select(event: Event): void {
    // The value is still validated: an <option> can be edited in devtools like any other input.
    const value = (event.target as HTMLSelectElement).value;
    const language = toLanguage(value, this.language.enabled);
    if (language) this.language.use(language);
  }
}
