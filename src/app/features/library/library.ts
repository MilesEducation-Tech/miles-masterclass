import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Backward } from '@shared/components/backward/backward';

@Component({
  selector: 'app-library',
  imports: [Backward, RouterOutlet],
  template: `
    <div class="container mx-auto pt-28 space-y-10">
      <app-backward />
      <router-outlet />
    </div>
  `,
})
export class Library {}
