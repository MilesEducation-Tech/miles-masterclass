import { afterNextRender, Component, signal } from '@angular/core';

const UAT_BANNER_BASE = 'https://asset.milesmasterclass.com/media/';

const UAT_BANNERS: readonly string[] = [
  'static/banner/processed_e45b6f4f8a98420ab337d597572cdc0a.webp',
  'static/banner/processed_3a6653131d0545409d907dc43c4b0cbc.webp',
  'static/banner/processed_409a3a5dee6749399017090221929d8b.webp',
  'media/static/banner/processed_c3573d4631f547cf95683a346b9ce3a7.webp',
  'static/banner/processed_466f9168631049c2bb5277cf56de672a.webp',
  'static/banner/processed_a33cb56971a541b2ba88d8a7170d6cb6.webp',
  'static/banner/processed_ac07d9e9c214455286f73ddd2a4f1b62.webp',
  'static/banner/processed_c153db040a8b4142bef56a21de82aa00.webp',
  'static/banner/processed_738f9f1f9727427282d1dc8869a9efe1.webp',
  'static/banner/processed_d2b907c58b6c404b85b8cee139cda16b.webp',
  'static/banner/processed_771710dd3251487aa505636dc84d27f3.webp',
  'static/banner/processed_632fb24aaa5d4a5db9a09b78e0549b34.webp',
  'static/banner/processed_c392825242754e2d9a1d31b17a5b0bc1.webp',
  'static/banner/processed_90c29f2b7cb14becafa27eb4e711757b.webp',
  'static/banner/processed_08261336bd15470eaaa89491de6c4925.webp',
  'static/banner/processed_b3d12b66ae3f44bd923f30f0271f9d86.webp',
  'static/banner/processed_2b1e62aa53004827aa497148a8ef5797.webp',
  'static/banner/processed_c1c2fe1685a74b01ab0f7febf2957991.webp',
  'static/banner/processed_3cbdd308bc334f9fbbce2f1c23bc50c9.webp',
].map((f) => UAT_BANNER_BASE + f);

const ALL_IMAGES: readonly string[] = [...UAT_BANNERS];

interface GalleryColumn {
  images: string[];
  delay: string;
}

@Component({
  selector: 'app-plan-scrolling-gallery',
  templateUrl: './plan-scrolling-gallery.html',
  styleUrl: './plan-scrolling-gallery.css',
  host: { class: 'block min-h-0 flex-1' },
})
export class PlanScrollingGallery {
  // Deterministic initial order so SSR and hydration match. Re-shuffled on the
  // browser via afterNextRender once hydration is complete.
  protected readonly columns = signal<readonly GalleryColumn[]>(this.buildColumns(ALL_IMAGES));

  constructor() {
    afterNextRender(() => {
      this.columns.set(this.buildColumns(this.shuffle(ALL_IMAGES)));
    });
  }

  private buildColumns(images: readonly string[]): readonly GalleryColumn[] {
    const cols: string[][] = [[], [], []];
    images.forEach((src, i) => cols[i % 3].push(src));
    return [
      { images: this.doubled(cols[0]), delay: '0s' },
      { images: this.doubled(cols[1]), delay: '-9s' },
      { images: this.doubled(cols[2]), delay: '-18s' },
    ];
  }

  private doubled(images: readonly string[]): string[] {
    return [...images, ...images];
  }

  private shuffle<T>(arr: readonly T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
