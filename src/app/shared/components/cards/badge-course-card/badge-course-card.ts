import { NgClass, NgOptimizedImage } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { badgeInstructorName, BadgeCourseItem } from '@core/models/badge.model';

@Component({
  selector: 'app-badge-course-card',
  imports: [NgOptimizedImage, NgClass],
  templateUrl: './badge-course-card.html',
  styleUrl: './badge-course-card.css',
})
export class BadgeCourseCard {
  readonly badge = input.required<BadgeCourseItem>();
  readonly cardClicked = output<BadgeCourseItem>();

  /**
   * Normalized view of whichever course payload is non-null on the badge item.
   * Masterclass / nano_learning use `title` / `host_instructor` / `class_credits`;
   * webinars use `webinar_title` / `instructor_details` / `webinar_credits` —
   * collapsed here into a single `{ title, instructorName, credits, ... }`
   * shape so the template doesn't have to branch on which API was returned.
   * Returns `null` only if the backend ships an item with all three payloads
   * empty (defensive).
   */
  readonly course = computed(() => {
    const b = this.badge();

    if (b.webinar) {
      const w = b.webinar;
      return {
        title: w.webinar_title,
        horizontal_thumbnail: w.horizontal_thumbnail,
        instructorName: badgeInstructorName(w.instructor_details),
        credits: w.webinar_credits ?? null,
      };
    }

    const c = b.master_class ?? b.nano_learning;
    if (!c) return null;
    return {
      title: c.title,
      horizontal_thumbnail: c.horizontal_thumbnail,
      instructorName: badgeInstructorName(c.instructor_details),
      credits: c.class_credits ?? null,
    };
  });

  readonly userBadge = computed(() => this.badge().user_badges?.[0] ?? null);

  readonly statusLabel = computed(() => {
    const ub = this.userBadge();
    if (!ub) return '';
    if (ub.status === 'earned') return 'Earned';
    if (ub.status === 'unlocked') return 'Ready to claim';
    if (ub.status === 'locked') return 'Locked';
    return ub.status;
  });

  readonly statusTone = computed(() => {
    const ub = this.userBadge();
    if (!ub) return 'bg-muted/30 text-muted-foreground border-border';
    if (ub.status === 'earned') return 'bg-green-500/15 text-green-400 border-green-500/30';
    if (ub.status === 'unlocked') return 'bg-accent/15 text-accent border-accent/30';
    return 'bg-muted/30 text-muted-foreground border-border';
  });

  handleClick() {
    this.cardClicked.emit(this.badge());
  }
}
