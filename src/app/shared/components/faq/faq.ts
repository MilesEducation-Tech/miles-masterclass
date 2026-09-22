import { Component, computed, inject, input, signal } from '@angular/core';
import { AccordionMode, FaqItem } from '../faq-item/faq-item';
import { resolveFaqData } from '@core/constants/faq';
import { Utils } from '@shared/services/utils';

@Component({
  selector: 'app-faq',
  imports: [FaqItem],
  templateUrl: './faq.html',
  styleUrl: './faq.css',
})
export class Faq {
  private readonly utils = inject(Utils);

  standalone = input<boolean>(true);

  /** Re-resolves whenever the user navigates between locales. */
  protected readonly faqs = computed(() =>
    resolveFaqData(this.utils.country(), this.utils.profession()),
  );

  /** Accordion mode: 'single' = only one open at a time, 'multi' = multiple can be open */
  accordionMode = signal<AccordionMode>('single');

  /** Currently open FAQ ID (used in single mode) */
  openFaqId = signal<number | null>(null);

  /**
   * Handle FAQ toggle events.
   * In single mode, toggles the clicked FAQ (closes if already open, opens otherwise).
   */
  handleFaqToggle(faqId: number): void {
    if (this.openFaqId() === faqId) {
      // Close if already open
      this.openFaqId.set(null);
    } else {
      // Open the clicked one
      this.openFaqId.set(faqId);
    }
  }

  /** Toggle between single and multi accordion mode */
  toggleMode(): void {
    const newMode = this.accordionMode() === 'single' ? 'multi' : 'single';
    this.accordionMode.set(newMode);
    // Reset open state when switching modes
    this.openFaqId.set(null);
  }
}
