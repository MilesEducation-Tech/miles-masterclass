import { Component, computed, inject, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  NgpAccordion,
  NgpAccordionContent,
  NgpAccordionItem,
  NgpAccordionTrigger,
} from 'ng-primitives/accordion';
import { matAddRound, matRemoveRound } from '@ng-icons/material-icons/round';
import { FAQ_SUPPORT_EMAIL, resolveFaqData } from '@core/constants/faq';
import { FAQ } from '@core/models/faq.model';
import { FaqContent } from '@shared/components/faq-content/faq-content';
import { Utils } from '@shared/services/utils';
import { AccordionScope } from '@shared/ui/accordion/accordion-scope';

/**
 * The platform FAQ: the one FAQ every page shows, and the `/faq` route itself.
 *
 * Data is `FAQ_DATA`, reached through `resolveFaqData` so per-market overrides
 * work the day one is added — today the override map is empty and every locale
 * gets the same list. Answers render through `app-faq-content`, which turns the
 * typed `FAQContent` blocks — text, headings, lists, notes, tables — into
 * markup. This component never touches that.
 *
 * TWO LEVELS, because that is what the data is: five categories, each holding
 * its questions. Both levels are single-open, and opening a different category
 * closes whatever question was open inside the last one — otherwise a
 * collapsed category quietly keeps state that reappears later. Both levels are
 * `ngpAccordion`s, and the inner one sits inside an `appAccordionScope` so the
 * two do not share state (see `AccordionScope`).
 */
@Component({
  selector: 'app-faq',
  imports: [
    NgIcon,
    FaqContent,
    AccordionScope,
    NgpAccordion,
    NgpAccordionContent,
    NgpAccordionItem,
    NgpAccordionTrigger,
  ],
  templateUrl: './faq.html',
  providers: [provideIcons({ matAddRound, matRemoveRound })],
})
export class Faq {
  /**
   * `true` on the `/faq` route and connect-us, where the FAQ heading is the
   * page's `<h1>`. Embedded in any other page it must be an `<h2>`, so it does
   * not hijack that page's `<h1>` (audit: "the only <h1> on the home page was
   * the FAQ heading").
   */
  readonly standalone = input<boolean>(true);

  private readonly utils = inject(Utils);

  protected readonly supportEmail = FAQ_SUPPORT_EMAIL;

  /** Re-resolves whenever the user navigates between locales. */
  protected readonly items = computed<readonly FAQ[]>(() =>
    resolveFaqData(this.utils.country(), this.utils.profession()),
  );

  /** The FAQ heading's level. Categories and questions sit one and two below it. */
  protected readonly headingLevel = computed(() => (this.standalone() ? 1 : 2));

  /** `null` = all collapsed, which is how the page first renders. */
  protected readonly openId = signal<number | null>(null);
  protected readonly openChildId = signal<number | null>(null);

  /** Single, collapsible accordion: the value is one id, or `null` when all are closed. */
  protected openCategory(value: number | number[] | null): void {
    this.openId.set(Array.isArray(value) ? (value[0] ?? null) : value);
    // Leaving a category behind should not leave a question open inside it.
    this.openChildId.set(null);
  }

  protected openQuestion(value: number | number[] | null): void {
    this.openChildId.set(Array.isArray(value) ? (value[0] ?? null) : value);
  }
}
