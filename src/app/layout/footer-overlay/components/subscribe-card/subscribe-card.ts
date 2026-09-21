import { Component, input, output } from '@angular/core';
import { Button } from '../../../../shared/components/ui/button/button';

@Component({
  selector: 'app-subscribe-card',
  imports: [Button],
  templateUrl: './subscribe-card.html',
  styleUrl: './subscribe-card.css',
})
export class SubscribeCard {
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly ctaLabel = input<string>('Subscribe');

  readonly ctaClick = output<void>();

  protected onCta(): void {
    this.ctaClick.emit();
  }
}
