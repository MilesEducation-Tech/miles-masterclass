import { Component, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { logoIcon } from '@core/constant/icon';

@Component({
  selector: 'app-miles-slug',
  imports: [NgIcon],
  templateUrl: './miles-slug.html',
  styleUrl: './miles-slug.css',
})
export class MilesSlug {
  slug = input<string>('masterclass');
  icon = logoIcon;
}
