import { Component } from '@angular/core';
import { environment } from '@env/environment';
import { BadgeSpotAnimation } from '../badge-spot-animation/badge-spot-animation';

@Component({
  selector: 'app-badge-library-hero',
  imports: [BadgeSpotAnimation],
  templateUrl: './badge-library-hero.html',
})
export class BadgeLibraryHero {
  protected readonly S3_BUCKET_URL = environment.S3_BUCKET_URL;
}
