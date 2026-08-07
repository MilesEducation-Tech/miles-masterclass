import { Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matKeyboardArrowDownRound, matKeyboardArrowUpRound } from '@ng-icons/material-icons/round';
import { Button } from '../../../../../../shared/components/ui/button/button';

@Component({
  selector: 'app-micro-learning-reel-nav',
  imports: [NgIcon, Button],
  template: `
    <div class="flex items-center flex-col gap-3" role="group" aria-label="Reel navigation">
      <app-button
        variant="ghost"
        size="icon"
        class="rounded-full bg-secondary/60 border border-border/40 hover:bg-secondary"
        [disabled]="!canGoPrev()"
        (clicked)="prev.emit()"
      >
        <ng-icon name="matKeyboardArrowUpRound" size="22" aria-label="Previous episode" />
      </app-button>
      <app-button
        variant="ghost"
        size="icon"
        class="rounded-full bg-secondary/60 border border-border/40 hover:bg-secondary"
        [disabled]="!canGoNext()"
        (clicked)="next.emit()"
      >
        <ng-icon name="matKeyboardArrowDownRound" size="22" aria-label="Next episode" />
      </app-button>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  viewProviders: [provideIcons({ matKeyboardArrowUpRound, matKeyboardArrowDownRound })],
})
export class MicroLearningReelNav {
  readonly canGoPrev = input<boolean>(true);
  readonly canGoNext = input<boolean>(true);

  readonly prev = output<void>();
  readonly next = output<void>();
}
