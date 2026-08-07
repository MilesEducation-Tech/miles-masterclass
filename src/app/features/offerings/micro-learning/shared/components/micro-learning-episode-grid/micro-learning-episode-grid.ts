import { Component, input, output } from '@angular/core';
import { Vertical } from '../../../../../../shared/components/cards/vertical/vertical';

@Component({
  selector: 'app-micro-learning-episode-grid',
  imports: [Vertical],
  templateUrl: './micro-learning-episode-grid.html',
  styleUrl: './micro-learning-episode-grid.css',
})
export class MicroLearningEpisodeGrid {
  readonly episodes = input.required<any[]>();
  readonly activeId = input<number | null>(null);

  readonly episodeSelected = output<any>();
}
