import { Component, computed, input } from '@angular/core';

export interface RecordDiskConfig {
  /** Show only the disk without the cover sleeve. When true, slide-out is disabled. */
  diskOnly?: boolean;
  /** Triggers the spin animation of the disk. */
  animate?: boolean;
  /** Triggers the slide-out (ignored when diskOnly is true). */
  slideOut?: boolean;
  /** Which side the disk slides out from. Default: 'right'. */
  direction?: 'left' | 'right' | 'top' | 'bottom';
  /** How far out the disk slides (percentage). Default: 55. */
  slideOutPercent?: number;
  /** Duration of a single spin rotation. Default: '4s'. */
  spinDuration?: string;
  /** Static rotation angle when sliding out. Default: '90deg'. */
  diskRotation?: string;
}

const DEFAULT_CONFIG: Required<RecordDiskConfig> = {
  diskOnly: false,
  animate: false,
  slideOut: false,
  direction: 'right',
  slideOutPercent: 55,
  spinDuration: '4s',
  diskRotation: '90deg',
};

@Component({
  selector: 'app-record-disk',
  imports: [],
  templateUrl: './record-disk.html',
  styleUrl: './record-disk.css',
  host: {
    class: 'block w-full h-full relative',
  },
})
export class RecordDisk {
  /**
   * The thumbnail image for the album cover. Nullable because CAIRA card
   * artwork is — the template already guards with `@if (coverImage())` and
   * binds plain `[src]`, so a missing cover renders the bare disk.
   */
  readonly coverImage = input.required<string | null>();

  /** The image to display on the center label of the disk. Defaults to coverImage. */
  readonly diskImage = input<string | null>();

  /** Configuration object controlling disk behavior and appearance. */
  readonly config = input<RecordDiskConfig>({});

  /** Merged config with defaults applied. */
  private readonly resolvedConfig = computed<Required<RecordDiskConfig>>(() => ({
    ...DEFAULT_CONFIG,
    ...this.config(),
  }));

  readonly diskOnly = computed(() => this.resolvedConfig().diskOnly);
  readonly isAnimating = computed(() => this.resolvedConfig().animate);
  readonly spinDuration = computed(() => this.resolvedConfig().spinDuration);

  readonly diskTransformStyle = computed(() => {
    const cfg = this.resolvedConfig();

    // In diskOnly mode, slide-out is disabled — disk stays centered
    if (cfg.diskOnly) {
      return 'translate(0px, 0px) rotate(0deg)';
    }

    if (!cfg.animate && !cfg.slideOut) {
      return 'translate(0px, 0px) rotate(0deg)';
    }

    const dist = cfg.slideOutPercent;
    const rot = cfg.diskRotation;

    switch (cfg.direction) {
      case 'left':
        return `translate(-${dist}%, 0) rotate(-${rot})`;
      case 'right':
        return `translate(${dist}%, 0) rotate(${rot})`;
      case 'top':
        return `translate(0, -${dist}%) rotate(-${rot})`;
      case 'bottom':
        return `translate(0, ${dist}%) rotate(${rot})`;
      default:
        return `translate(${dist}%, 0) rotate(${rot})`;
    }
  });
}
