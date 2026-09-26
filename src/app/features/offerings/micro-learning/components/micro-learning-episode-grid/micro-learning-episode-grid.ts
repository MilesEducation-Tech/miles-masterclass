import { Component, input, output } from '@angular/core';
import { Vertical } from '@shared/components/cards/vertical/vertical';
import { MicroLearningReel } from '@features/offerings/models/micro-learning-course.model';

@Component({
  selector: 'app-micro-learning-episode-grid',
  imports: [Vertical],
  templateUrl: './micro-learning-episode-grid.html',
  host: { class: 'block' },
})
export class MicroLearningEpisodeGrid {
  readonly episodes = input.required<MicroLearningReel[]>();
  readonly activeId = input<number | null>(null);

  readonly episodeSelected = output<MicroLearningReel>();
}
