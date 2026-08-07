import { Component, input, model, output } from '@angular/core';
import { Backward } from '../../../../../../shared/components/backward/backward';

@Component({
  selector: 'app-micro-learning-top-bar',
  imports: [Backward],
  templateUrl: './micro-learning-top-bar.html',
  styleUrl: './micro-learning-top-bar.css',
})
export class MicroLearningTopBar {
  readonly placeholder = input<string>('Shows, Episodes, and More');
  readonly searchValue = model<string>('');

  readonly filterToggled = output<void>();

  handleFilterClick(): void {
    this.filterToggled.emit();
  }
}
