import { DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown } from '@ng-icons/lucide';
import { Button } from '../../../../../shared/components/ui/button/button';
import {
  BadgeContentType,
  CairaCategory,
  CairaLevel,
} from '../../../../../shared/core/models/caira/cpe.model';
import { BADGE_CATEGORIES, BADGE_LEVELS } from '../../mappers/badge-to-table';

/**
 * Tracker filters.
 *
 * **Reshaped for CAIRA.** The year selector and the field-of-study filter are
 * gone: CAIRA aggregates credits by *level*, not by calendar year (G-25, G-37),
 * and #23 carries no field-of-study breakdown. In their place are the three
 * controls the shipped LMS's progress page actually has — a CAIRA / NON-CAIRA
 * category toggle, a level selector, and a content-type selector.
 *
 * The NASBA-template and bulk-certificate download buttons are gone too. Both
 * were Django-era endpoints with no CAIRA counterpart (G-26, G-27); CAIRA's
 * certificates are per-row embedded URLs, opened from the table.
 */
@Component({
  selector: 'app-tracker-toolbar',
  imports: [DecimalPipe, Button, NgIcon],
  providers: [provideIcons({ lucideChevronDown })],
  templateUrl: './tracker-toolbar.html',
  styleUrl: './tracker-toolbar.css',
  host: { class: 'block w-full' },
})
export class TrackerToolbar {
  readonly category = input.required<CairaCategory>();
  readonly level = input.required<CairaLevel>();
  readonly contentType = input.required<BadgeContentType>();
  /**
   * Only the types that have badges under the current category and level, so
   * the filter cannot land on an always-empty combination.
   */
  readonly contentTypeOptions = input.required<BadgeContentType[]>();
  readonly credits = input<{ earned: number } | null>(null);

  readonly categoryChange = output<CairaCategory>();
  readonly levelChange = output<CairaLevel>();
  readonly contentTypeChange = output<BadgeContentType>();
  readonly openCompliance = output<void>();

  protected readonly categories = BADGE_CATEGORIES;
  protected readonly levels = BADGE_LEVELS;

  protected onLevel(event: Event): void {
    this.levelChange.emit((event.target as HTMLSelectElement).value as CairaLevel);
  }

  protected onContentType(event: Event): void {
    this.contentTypeChange.emit((event.target as HTMLSelectElement).value as BadgeContentType);
  }
}
