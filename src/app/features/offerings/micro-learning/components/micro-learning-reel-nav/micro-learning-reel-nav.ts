import { Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matKeyboardArrowDownRound, matKeyboardArrowUpRound } from '@ng-icons/material-icons/round';
import { Button } from '@shared/ui/button/button';

@Component({
  selector: 'app-micro-learning-reel-nav',
  imports: [NgIcon, Button],
  template: `
    <div class="flex items-center flex-col gap-3" role="group" aria-label="Reel navigation">
      <button
        app-button
        type="button"
        class="rounded-full bg-secondary/60 border border-border/40 hover:bg-secondary"
        variant="ghost"
        size="icon"
        [disabled]="!canGoPrev()"
        (click)="prev.emit()"
      >
        <ng-icon name="matKeyboardArrowUpRound" size="22" aria-label="Previous episode" />
      </button>
      <button
        app-button
        type="button"
        class="rounded-full bg-secondary/60 border border-border/40 hover:bg-secondary"
        variant="ghost"
        size="icon"
        [disabled]="!canGoNext()"
        (click)="next.emit()"
      >
        <ng-icon name="matKeyboardArrowDownRound" size="22" aria-label="Next episode" />
      </button>
    </div>
  `,
  host: { class: 'block' },
  viewProviders: [provideIcons({ matKeyboardArrowUpRound, matKeyboardArrowDownRound })],
})
export class MicroLearningReelNav {
  readonly canGoPrev = input<boolean>(true);
  readonly canGoNext = input<boolean>(true);

  readonly prev = output<void>();
  readonly next = output<void>();
}
