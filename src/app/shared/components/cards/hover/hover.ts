import { Component, DestroyRef, inject, input, model, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Utils } from '../../../core/services/utils/utils';
import { RecordDisk } from '../../record-disk/record-disk';
import { Button } from '../../ui/button/button';
import { NgIconComponent } from '@ng-icons/core';
import { faSolidPlay, faSolidInfo, faSolidRobot } from '@ng-icons/font-awesome/solid';
import { matBookmarkBorderRound, matBookmarkRound } from '@ng-icons/material-icons/round';
import { CourseCard } from '../../../core/models/caira/masterclass.model';
import { CategoriesList } from '../../categories-list/categories-list';
import { TotalCpeCreditsPipe } from '../../../core/pipes/total-cpe-credits/total-cpe-credits.pipe';
import { CairaCredlyBadge } from '../caira-credly-badge/caira-credly-badge';
import { CairaUuid } from '../../../core/models/caira/envelope.model';

@Component({
  selector: 'app-hover',
  imports: [
    RecordDisk,
    Button,
    NgIconComponent,
    CategoriesList,
    TotalCpeCreditsPipe,
    CairaCredlyBadge,
  ],
  templateUrl: './hover.html',
  styleUrl: './hover.css',
  host: {
    class: 'w-full h-auto overflow-hidden block',
  },
})
export class Hover {
  private readonly utils = inject(Utils);
  private readonly destroyRef = inject(DestroyRef);

  card = model.required<CourseCard>();
  type = input<'masterclass' | 'podcast' | 'micro-learning'>('masterclass');

  isHovering = signal(false);

  icons = signal({
    faSolidPlay,
    faSolidInfo,
    faSolidRobot,
    matBookmarkRound,
    matBookmarkBorderRound,
  });

  navigateToCourse(id: CairaUuid, title: string) {
    this.utils.navigateToCourse(this.type(), id, title);
  }

  openCourseInfo() {
    this.utils.openCourseInfo(this.card());
  }

  openVideoDialog() {
    this.utils.openVideoDialog(this.card().trailer_link, this.card().title);
  }

  toggleBookmark(event: Event) {
    event.stopPropagation();
    const apiType = this.type() === 'micro-learning' ? 'micro_learning' : this.type();
    this.utils
      .toggleBookmarkCourse(this.card().id, { course_type: apiType })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        if (res.status) {
          this.card.update((c) => ({ ...c, added_bookmark: res.is_bookmarked }));
        }
      });
  }
}
