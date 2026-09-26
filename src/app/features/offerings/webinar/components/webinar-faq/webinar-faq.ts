import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  NgpAccordion,
  NgpAccordionContent,
  NgpAccordionItem,
  NgpAccordionTrigger,
} from 'ng-primitives/accordion';
import { matAddRound, matRemoveRound } from '@ng-icons/material-icons/round';
import { FaqContent } from '@shared/components/faq-content/faq-content';
import { resolveFaqData } from '@core/constants/faq';
import { FAQ } from '@core/models/faq.model';
import { Utils } from '@shared/services/utils';

/**
 * The page's FAQ accordion.
 *
 * Data is the platform's own `FAQ_DATA`, reached through `resolveFaqData` so
 * per-market overrides work the day one is added — today the override map is
 * empty and every locale gets the same list. Answers render through
 * `app-faq-content`, the same renderer the FAQ page uses, which is what turns
 * the typed `FAQContent` blocks — text, headings, lists, notes, tables — into
 * markup. This component never touches that.
 *
 * TWO LEVELS, because that is what the data is: five categories, each holding
 * its questions. Both levels are single-open, and opening a different category
 * closes whatever question was open inside the last one — otherwise a
 * collapsed category quietly keeps state that reappears later.
 *
 * The accordion is local rather than the FAQ page's `app-faq-item`: that one
 * recurses to arbitrary depth and carries grey-card styling, and this list is
 * two fixed levels styled as dividers. Both levels are `ngpAccordion`s.
 */
@Component({
  selector: 'app-webinar-faq',
  host: { class: 'block' },
  imports: [
    NgIcon,
    FaqContent,
    NgpAccordion,
    NgpAccordionContent,
    NgpAccordionItem,
    NgpAccordionTrigger,
  ],
  templateUrl: './webinar-faq.html',
  providers: [provideIcons({ matAddRound, matRemoveRound })],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebinarFaq {
  readonly heading = input('Frequently Asked Questions');
  /** Defaults to the platform FAQ; pass a list to show something narrower. */
  readonly faqs = input<readonly FAQ[] | null>(null);
  /** Support address for the "write to" line under the heading. */
  readonly supportEmail = input('support1@milesmasterclass.com');
  /** Omitted when there is nowhere to point at yet. */
  readonly helpCentreUrl = input<string | null>(null);

  private readonly utils = inject(Utils);

  protected readonly items = computed<readonly FAQ[]>(() => {
    const provided = this.faqs();
    if (provided) return provided;
    return resolveFaqData(this.utils.country(), this.utils.profession());
  });

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
