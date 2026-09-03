import { Component, DestroyRef, inject, input, model, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Utils } from '../../../core/services/utils/utils';
import { RecordDisk } from '../../record-disk/record-disk';
import { Content } from '../../../core/models/course.model';
import { Button } from '../../ui/button/button';
import { NgIconComponent } from '@ng-icons/core';
import { faSolidPlay, faSolidInfo, faSolidRobot } from '@ng-icons/font-awesome/solid';
import { matBookmarkBorderRound, matBookmarkRound } from '@ng-icons/material-icons/round';
import { FeatureFacade } from '../../../../features/shared/services/feature-facade/feature-facade';
import { Logger } from '../../../core/services/logger/logger';
import { CategoriesList } from '../../categories-list/categories-list';
import { TotalCpeCreditsPipe } from '../../../core/pipes/total-cpe-credits/total-cpe-credits.pipe';
import { CairaCredlyBadge } from '../caira-credly-badge/caira-credly-badge';

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
  private readonly feature = inject(FeatureFacade);
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);

  card = model.required<Content>();
  type = input<'masterclass' | 'podcast' | 'micro-learning'>('masterclass');

  isHovering = signal(false);
  loading = signal(false);

  icons = signal({
    faSolidPlay,
    faSolidInfo,
    faSolidRobot,
    matBookmarkRound,
    matBookmarkBorderRound,
  });

  navigateToCourse(id: number, title: string) {
    this.utils.navigateToCourse(this.type(), id, title);
  }

  openCourseInfo() {
    if (!this.card().allDataFetched) {
      this.loading.set(true);
      this.feature.getAbout(this.card().id, this.type()).subscribe({
        next: (res: any) => {
          const updatedCard = {
            ...this.card(),
            ...res.data,
            allDataFetched: true,
            learning_objective_list: res.data.learning_objectives.split('\r\n'),
          };
          this.card.set(updatedCard);
          this.utils.openCourseInfoDialog(this.card());
          this.loading.set(false);
        },
        error: (err: any) => {
          this.logger.error('Failed to load course info', err);
          this.loading.set(false);
        },
      });
    } else {
      this.loading.set(false);
      this.utils.openCourseInfoDialog(this.card());
    }
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
