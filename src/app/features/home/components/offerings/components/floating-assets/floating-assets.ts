import { Component, input, type Type } from '@angular/core';
import { NgComponentOutlet, NgOptimizedImage } from '@angular/common';
import type { FloatingAsset } from '../../offerings.config';

@Component({
  selector: 'app-floating-assets',
  imports: [NgComponentOutlet, NgOptimizedImage],
  templateUrl: './floating-assets.html',
  styleUrl: './floating-assets.css',
})
export class FloatingAssets {
  readonly assets = input<FloatingAsset[]>([]);

  protected asComponent(media: FloatingAsset['media']): Type<unknown> | null {
    return typeof media === 'function' ? media : null;
  }

  protected asUrl(media: FloatingAsset['media']): string {
    return typeof media === 'string' ? media : '';
  }
}
