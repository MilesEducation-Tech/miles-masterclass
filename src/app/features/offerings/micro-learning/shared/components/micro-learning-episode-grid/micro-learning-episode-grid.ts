import { Component, input, output } from '@angular/core';
import { Vertical } from '@shared/components/cards/vertical/vertical';
import { MicroLearningReel } from '@core/models/micro-learning-course.model';

@Component({
  selector: 'app-micro-learning-episode-grid',
  imports: [Vertical],
  templateUrl: './micro-learning-episode-grid.html',
  styleUrl: './micro-learning-episode-grid.css',
})
export class MicroLearningEpisodeGrid {
  readonly episodes = input.required<MicroLearningReel[]>();
  readonly activeId = input<number | null>(null);

  readonly episodeSelected = output<MicroLearningReel>();
}
