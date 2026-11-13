import { Component } from '@angular/core';
import { Backward } from '@shared/components/backward/backward';

@Component({
  selector: 'app-micro-learning-top-bar',
  imports: [Backward],
  templateUrl: './micro-learning-top-bar.html',
  host: { class: 'block' },
})
export class MicroLearningTopBar {}
