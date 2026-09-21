import { Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { faSolidPlay } from '@ng-icons/font-awesome/solid';
import { Button } from '../../../../shared/components/ui/button/button';
import { Content } from '../../../../shared/core/models/course.model';

@Component({
  selector: 'app-continue-learning-card',
  imports: [Button, NgIcon],
  providers: [provideIcons({ faSolidPlay })],
  templateUrl: './continue-learning-card.html',
  styleUrl: './continue-learning-card.css',
})
export class ContinueLearningCard {
  readonly course = input.required<Content>();

  readonly resume = output<Content>();

  protected onResume(): void {
    this.resume.emit(this.course());
  }
}
