import { NgOptimizedImage } from '@angular/common';
import { WaveCanvas } from '../../../../../../shared/components/wave-canvas/wave-canvas';
import { environment } from './../../../../../../../environments/environment';
import { Component } from '@angular/core';

@Component({
  selector: 'app-podcast-hero',
  imports: [WaveCanvas, NgOptimizedImage],
  templateUrl: './podcast-hero.html',
  styleUrl: './podcast-hero.css',
})
export class PodcastHero {
  S3_BUCKET_URL = environment.S3_BUCKET_URL;
}
