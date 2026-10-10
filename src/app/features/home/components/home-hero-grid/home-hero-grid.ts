import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HOME_HERO_GRID_BASE } from '../../constants/home-assets';
import { HERO_GRID_COLUMNS } from './hero-grid-columns';

/**
 * The four columns of Figma `2175:21140` (1726×868 frame): 2175:21157 (the
 * left one, behind the copy) and 2175:21142 / 21147 / 21152. Each is a
 * 406.87-wide strip of 16:9 cards rotated 11.7° clockwise about its own
 * top-left corner; `x`/`y` are that corner in frame px — Figma's x/y for a
 * rotated node, not its bounding box. Middle-right column sits 19.5px higher.
 */
const COLUMN_BOXES = [
  { x: 261.02, y: -247, desktopOnly: true },
  { x: 678.71, y: -192.69, desktopOnly: false },
  { x: 1095.04, y: -212.22, desktopOnly: false },
  { x: 1511.38, y: -192.7, desktopOnly: false },
] as const;

/** Seconds per card: every column is the same length, so the grid slides as one. */
const SECONDS_PER_CARD = 5;

/**
 * Cards per column before the strip repeats. The 64 thumbnails deal out to 16;
 * 8 halves the `<img>` count (64 instead of 128) for a 40s loop few visitors
 * watch to the end, with no visible difference. Set 16 for the full set.
 */
const CARDS_PER_COLUMN = 8;

/**
 * The design shows four cards per column at load (the fifth is behind the
 * clip), so only those are eager — and only in the columns a phone shows.
 */
const EAGER_PER_COLUMN = 4;

interface Column {
  x: number;
  y: number;
  desktopOnly: boolean;
  /** Its thumbnails twice over: sliding by exactly one copy loops seamlessly. */
  cards: readonly string[];
}

/**
 * The home hero's backdrop: course thumbnails of the first three masterclass
 * tracks, dealt across the design's four tilted columns, sliding bottom → top
 * on a loop. Decorative — the real cards sit right below in the track rails.
 *
 * The thumbnails are q60 / 480px copies on the asset bucket (the API's originals
 * are 240–716 KB on an origin that can't resize), so the grid costs no API call
 * and renders in SSR. Plain `<img>`, not `NgOptimizedImage`: the directive pins
 * `fetchpriority` and `decoding`, and this artwork must yield to the logo, the
 * fonts and the JS (`fetchpriority="low"`, `decoding="async"`); with no image
 * loader it would add no srcset either.
 */
@Component({
  selector: 'app-home-hero-grid',
  templateUrl: './home-hero-grid.html',
  styleUrl: './home-hero-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    class: 'pointer-events-none absolute inset-0 overflow-hidden select-none',
  },
})
export class HomeHeroGrid {
  protected readonly eagerPerColumn = EAGER_PER_COLUMN;

  protected readonly columns: readonly Column[] = (() => {
    // Deal round-robin so each column mixes the tracks and all are one length.
    const thumbs = HERO_GRID_COLUMNS.flat().map((name) => HOME_HERO_GRID_BASE + name);
    return COLUMN_BOXES.map((box, i) => {
      const own = thumbs.filter((_, k) => k % COLUMN_BOXES.length === i).slice(0, CARDS_PER_COLUMN);
      return { ...box, cards: [...own, ...own] };
    });
  })();

  protected readonly duration = `${CARDS_PER_COLUMN * SECONDS_PER_CARD}s`;
}
