import { Component, input } from '@angular/core';

/** A single dashboard stat card: label, big number, and an accent bar. */
@Component({
  selector: 'app-stat-card',
  templateUrl: './stat-card.html',
  host: { class: 'block' },
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input.required<number | string>();
  readonly accent = input<string>('var(--mm-fg-3)');
}
