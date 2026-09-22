import { afterNextRender, Component, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { environment } from '@env/environment';

@Component({
  selector: 'app-badge-spot-animation',
  imports: [],
  templateUrl: './badge-spot-animation.html',
  styleUrl: './badge-spot-animation.css',
  host: {
    class: 'block w-full h-full',
  },
})
export class BadgeSpotAnimation {
  private sanitizer = inject(DomSanitizer);
  S3_BUCKET_URL = environment.S3_BUCKET_URL;

  roundStar: SafeHtml = this.sanitizer
    .bypassSecurityTrustHtml(`<svg width="6" height="5" viewBox="0 0 6 5" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M2.84614 4.73999C1.27834 4.73999 0 3.68 0 2.37C0 1.06 1.27834 0 2.84614 0C4.41394 0 5.70436 1.06 5.70436 2.37C5.70436 3.68 4.426 4.73999 2.84614 4.73999Z" fill="white"/>
</svg>
`);
  curveStar: SafeHtml = this.sanitizer
    .bypassSecurityTrustHtml(`<svg width="17" height="14" viewBox="0 0 17 14" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M8.59879 1.12C8.59879 4.27999 11.6861 6.84 15.4971 6.84C15.8589 6.84 16.2207 6.80999 16.5704 6.75999L16.8478 6.99001L16.5704 7.22C16.2207 7.17 15.871 7.14 15.4971 7.14C11.6861 7.14 8.59879 9.70001 8.59879 12.85C8.59879 13.15 8.63495 13.45 8.69525 13.74L8.41789 13.97L8.1405 13.74C8.2008 13.45 8.237 13.15 8.237 12.85C8.237 9.70001 5.14961 7.14 1.35071 7.14C0.988914 7.14 0.627133 7.17 0.277393 7.22L0 6.99001L0.277393 6.75999C0.627133 6.79999 0.988914 6.84 1.35071 6.84C5.14961 6.84 8.237 4.27999 8.237 1.12C8.237 0.819995 8.2008 0.519996 8.1405 0.229996L8.41789 0L8.69525 0.229996C8.63495 0.519996 8.59879 0.819995 8.59879 1.12Z" fill="white"/>
</svg>
`);

  stars = signal<
    {
      svg: SafeHtml;
      x: number;
      y: number;
      width: number;
      height: number;
      shouldAnimate: boolean;
      delay: number;
      slideDirection: 'left' | 'right';
    }[]
  >([]);

  // Generate random non-overlapping positions around edges
  private generateBadgePositions(count: number): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    const minDistance = 18; // Minimum distance between badges to avoid overlap

    const isOverlapping = (newX: number, newY: number): boolean => {
      return positions.some((pos) => {
        const distance = Math.sqrt(Math.pow(newX - pos.x, 2) + Math.pow(newY - pos.y, 2));
        return distance < minDistance;
      });
    };

    const isInCenter = (x: number, y: number): boolean => {
      // Avoid center area (25-75% on x-axis and 20-80% on y-axis)
      return x > 25 && x < 75 && y > 20 && y < 80;
    };

    // Generate positions only around edges (accounting for badge size ~10-12% of container)
    const generateEdgePosition = (): { x: number; y: number } => {
      const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
      let x: number, y: number;

      switch (edge) {
        case 0: // top edge
          x = 5 + Math.random() * 60;
          y = 3 + Math.random() * 12;
          break;
        case 1: // right edge
          x = 70 + Math.random() * 15;
          y = 8 + Math.random() * 60;
          break;
        case 2: // bottom edge
          x = 5 + Math.random() * 60;
          y = 72 + Math.random() * 12;
          break;
        case 3: // left edge
          x = 3 + Math.random() * 12;
          y = 8 + Math.random() * 60;
          break;
        default:
          x = 5;
          y = 5;
      }
      return { x, y };
    };

    let attempts = 0;
    const maxAttempts = 1000;

    while (positions.length < count && attempts < maxAttempts) {
      attempts++;

      // Generate position on edge
      const { x, y } = generateEdgePosition();

      // Check if position is valid (not in center and not overlapping)
      if (!isInCenter(x, y) && !isOverlapping(x, y)) {
        positions.push({ x, y });
      }
    }

    return positions;
  }

  badges = signal<
    {
      image: string;
      x: number;
      y: number;
      width: number;
      height: number;
      shouldAnimate: boolean;
      delay: number;
      slideDirection: 'left' | 'right';
      rotate: number;
      scale: number;
      skewX: number;
      skewY: number;
      opacity: number;
    }[]
  >([]);

  constructor() {
    // Random values are computed only on the client to avoid SSR/CSR
    // hydration mismatches and post-hydration flicker.
    afterNextRender(() => {
      this.stars.set(
        Array.from({ length: 45 }, (_, index) => {
          const isRound = Math.random() > 0.5;
          const slideDirection: 'left' | 'right' = Math.random() > 0.5 ? 'left' : 'right';
          return {
            svg: isRound ? this.roundStar : this.curveStar,
            x: Math.random() * 100,
            y: Math.random() * 100,
            width: isRound ? 6 : 17,
            height: isRound ? 5 : 14,
            shouldAnimate: Math.random() > 0.9,
            delay: index * 0.02,
            slideDirection,
          };
        }),
      );

      const badgePositions = this.generateBadgePositions(9);
      const rotations = [-15, -10, -5, 0, 5, 10, 15, 20, -20];
      const scales = [0.8, 0.9, 1, 1.1, 1.2];

      this.badges.set(
        Array.from({ length: 9 }, (_, index) => {
          const slideDirection: 'left' | 'right' = Math.random() > 0.5 ? 'left' : 'right';
          const position = badgePositions[index];
          return {
            image: `${this.S3_BUCKET_URL}static-assests/web-app/badges/badge-${index + 1}.webp`,
            x: position.x,
            y: position.y,
            width: 55 + Math.random() * 30,
            height: 55 + Math.random() * 30,
            shouldAnimate: Math.random() > 0.3,
            delay: index * 0.15,
            slideDirection,
            rotate: rotations[index % rotations.length],
            scale: scales[Math.floor(Math.random() * scales.length)],
            skewX: (Math.random() - 0.5) * 10,
            skewY: (Math.random() - 0.5) * 5,
            opacity: 0.7 + Math.random() * 0.3,
          };
        }),
      );
    });
  }
}
