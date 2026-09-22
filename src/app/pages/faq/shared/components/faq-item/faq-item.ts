import { Component, computed, effect, input, output, signal } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { matKeyboardArrowDownRound } from '@ng-icons/material-icons/round';
import { FaqContent } from '@shared/components/faq-content/faq-content';
import { FAQ } from '@core/models/faq.model';

export type AccordionMode = 'single' | 'multi';

@Component({
  selector: 'app-faq-item',
  imports: [FaqContent, NgIcon],
  templateUrl: './faq-item.html',
  styleUrl: './faq-item.css',
})
export class FaqItem {
  // Inputs
  faq = input.required<FAQ>();
  level = input<number>(0);
  mode = input<AccordionMode>('multi');
  openFaqId = input<number | null>(null);

  // Outputs
  faqToggled = output<number>();

  // State
  protected isOpen = signal(false);

  // Each parent manages its own children's open state (for single mode)
  protected openChildId = signal<number | null>(null);

  // Icons
  protected readonly icons = computed(() => ({
    matKeyboardArrowDownRound,
  }));

  constructor() {
    // Sync isOpen with openFaqId in single mode (for this item's own state)
    effect(() => {
      const mode = this.mode();
      const openId = this.openFaqId();
      const faqId = this.faq().id;

      if (mode === 'single') {
        this.isOpen.set(openId === faqId);
      }
    });
  }

  toggle(): void {
    if (this.mode() === 'single') {
      // Emit toggle event for parent to manage
      this.faqToggled.emit(this.faq().id);
    } else {
      // Multi mode: toggle locally
      this.isOpen.update((v) => !v);
    }
  }

  /**
   * Handle child FAQ toggle in single mode.
   * Each parent manages its own children independently.
   */
  handleChildToggle(childId: number): void {
    if (this.openChildId() === childId) {
      // Close if already open
      this.openChildId.set(null);
    } else {
      // Open the clicked child
      this.openChildId.set(childId);
    }
  }
}
